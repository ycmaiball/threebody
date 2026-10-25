#!/usr/bin/env node
/**
 * 三体档案 · 自动化验证脚本
 *
 * 用法:
 *   node tools/verify.js
 *
 * 功能: 启动零依赖本地服务器 + 无头 Edge/Chrome，
 *       验证渲染、交互、无横向溢出、无 JS 错误。
 *
 * 环境变量:
 *   EDGE / CHROME  指定浏览器可执行文件路径
 *   PORT           本地端口（默认 4173）
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const DEBUG_PORT = 9222 + Math.floor(Math.random() * 600);

/* ---------- 输出工具 ---------- */
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m'
};
let passCount = 0, failCount = 0;

const ok = (msg) => { passCount++; console.log(`  ${C.green}✓${C.reset} ${msg}`); };
const bad = (msg) => { failCount++; console.log(`  ${C.red}✗${C.reset} ${msg}`); };
const info = (msg) => console.log(`  ${C.dim}·${C.reset} ${msg}`);
const head = (msg) => console.log(`\n${C.bold}${C.cyan}${msg}${C.reset}`);

const check = (cond, label, detail) => {
  if (cond) ok(label + (detail ? ` ${C.dim}(${detail})${C.reset}` : ''));
  else bad(label + (detail ? ` ${C.dim}(${detail})${C.reset}` : ''));
  return cond;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- 查找浏览器 ---------- */
function findBrowser() {
  const candidates = [
    process.env.EDGE, process.env.CHROME,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

/* ---------- 静态服务器 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) {
        fs.readFile(path.join(ROOT, '404.html'), (e2, d2) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(e2 ? '404' : d2);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(res => server.listen(PORT, '127.0.0.1', () => res(server)));
}

/* ---------- CDP 客户端 ---------- */
function createCdp(port) {
  const getJSON = (p) => new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port, path: p }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });

  return {
    getJSON,
    async connect() {
      let list = null;
      for (let i = 0; i < 80; i++) {
        try { list = await getJSON('/json/list'); if (list && list.length) break; } catch { }
        await sleep(250);
      }
      if (!list || !list.length) throw new Error('无法连接到浏览器调试端口');
      const target = list.find(t => t.type === 'page') || list[0];
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      let id = 0;
      const pending = new Map();
      const events = [];

      ws.addEventListener('message', (ev) => {
        const o = JSON.parse(ev.data);
        if (o.method === 'Runtime.exceptionThrown') {
          events.push('异常: ' + ((o.params.exceptionDetails.exception || {}).description || o.params.exceptionDetails.text));
        }
        if (o.method === 'Runtime.consoleAPICalled' && o.params.type === 'error') {
          events.push('console.error: ' + o.params.args.map(a => a.value || a.description || '').join(' '));
        }
        if (o.id && pending.has(o.id)) { pending.get(o.id)(o.result); pending.delete(o.id); }
      });

      await new Promise(r => ws.addEventListener('open', r));

      const send = (method, params = {}) => new Promise(r => {
        const i = ++id; pending.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
      });

      const evaluate = async (expr) => {
        const r = await send('Runtime.evaluate', { returnByValue: true, expression: expr, awaitPromise: true });
        if (r.exceptionDetails) {
          throw new Error(r.exceptionDetails.text + ' :: ' + ((r.exceptionDetails.exception || {}).description || ''));
        }
        return r.result.value;
      };

      return { send, evaluate, events, close: () => { try { ws.close(); } catch { } } };
    }
  };
}

/* ---------- 主流程 ---------- */
(async () => {
  console.log(`\n${C.bold}三体档案 · 自动化验证${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(46)}${C.reset}`);

  const browser = findBrowser();
  if (!browser) {
    console.error(`\n${C.red}未找到浏览器。${C.reset}请设置环境变量 EDGE 或 CHROME 指向浏览器可执行文件。\n`);
    process.exit(1);
  }
  info('浏览器: ' + browser);

  const server = await startServer();
  info(`本地服务: http://127.0.0.1:${PORT}`);

  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--user-data-dir=' + path.join(require('os').tmpdir(), 'tb-verify-' + Date.now()),
    'about:blank'
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    cdp = await createCdp(DEBUG_PORT).connect();
    const { send, evaluate, events } = cdp;

    await send('Page.enable');
    await send('Runtime.enable');

    /* ===== 桌面端 ===== */
    head('▶ 桌面端 (1440×900)');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await sleep(4200);

    const desktop = JSON.parse(await evaluate(`JSON.stringify({
      title: document.title,
      chars: document.querySelectorAll('.char-card').length,
      concepts: document.querySelectorAll('.concept-card').length,
      quotes: document.querySelectorAll('.quote-card').length,
      timeline: document.querySelectorAll('.tl-item').length,
      books: document.querySelectorAll('.book-card').length,
      canvasPainted: (() => { const c = document.getElementById('starfield');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })(),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: innerWidth,
      overflow: [...document.querySelectorAll('body *')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > innerWidth + 1 && !e.classList.contains('nebula');
      }).length,
      starsVisible: document.querySelectorAll('.reveal.is-visible').length,
      starsTotal: document.querySelectorAll('.reveal').length
    })`));

    check(desktop.chars === 12, '人物卡片渲染', `${desktop.chars} 张`);
    check(desktop.concepts === 9, '设定卡片渲染', `${desktop.concepts} 项`);
    check(desktop.quotes === 12, '语录卡片渲染', `${desktop.quotes} 条`);
    check(desktop.timeline === 6, '时间线节点渲染', `${desktop.timeline} 个`);
    check(desktop.books === 3, '三部曲卡片渲染', `${desktop.books} 张`);
    check(desktop.canvasPainted > 5000, 'Canvas 星空已绘制', `${desktop.canvasPainted} 个像素`);
    check(desktop.overflow === 0, '桌面端无横向溢出');
    check(desktop.starsVisible === desktop.starsTotal, '内容全部可见（无隐藏）',
      `${desktop.starsVisible}/${desktop.starsTotal}`);

    /* ===== 交互 ===== */
    head('▶ 交互功能');

    const filters = {};
    for (const f of ['eto', 'wallfacer', 'alien', 'earth', 'all']) {
      await evaluate(`document.querySelector('.chip[data-filter="${f}"]').click()`);
      await sleep(320);
      const n = await evaluate(`document.querySelectorAll('.char-card').length`);
      const match = await evaluate(`[...document.querySelectorAll('.char-card')].every(c => c.dataset.faction === '${f}')`);
      filters[f] = { n, match };
    }
    check(filters.all.n === 12, '筛选「全部」', `${filters.all.n} 张`);
    check(filters.eto.n === 1 && filters.eto.match, '筛选「ETO」', `${filters.eto.n} 张`);
    check(filters.alien.n === 3 && filters.alien.match, '筛选「三体」', `${filters.alien.n} 张`);
    check(filters.earth.n === 7 && filters.earth.match, '筛选「地球」', `${filters.earth.n} 张`);
    check(filters.wallfacer.n === 1 && filters.wallfacer.match, '筛选「面壁者」', `${filters.wallfacer.n} 张`);

    // 回到顶部 + 进度条
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await sleep(900);
    const scrolled = JSON.parse(await evaluate(`JSON.stringify({
      toTop: document.getElementById('toTop').classList.contains('is-visible'),
      progress: document.getElementById('scrollProgress').style.width,
      active: document.querySelectorAll('.nav-links a.is-active').length
    })`));
    check(scrolled.toTop, '回到顶部按钮显示');
    check(scrolled.progress === '100%', '滚动进度条工作', scrolled.progress);
    check(scrolled.active > 0, '导航当前区块高亮');

    // 三体模拟在运动
    const p1 = await evaluate(`document.getElementById('starA').getAttribute('cx')`);
    await sleep(700);
    const p2 = await evaluate(`document.getElementById('starA').getAttribute('cx')`);
    check(p1 !== p2, '三体运动模拟在运行', `${p1} → ${p2}`);

    /* ===== 移动端 ===== */
    head('▶ 移动端 (390×844)');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await sleep(4000);

    const mobile = JSON.parse(await evaluate(`JSON.stringify({
      innerWidth, scrollWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('body *')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > innerWidth + 1 && !e.classList.contains('nebula');
      }).map(e => e.tagName + '.' + e.className).slice(0, 5),
      toggleDisplay: getComputedStyle(document.querySelector('.nav-toggle')).display
    })`));

    check(mobile.overflow.length === 0, '移动端无横向溢出',
      mobile.overflow.length ? mobile.overflow.join(', ') : '');
    check(mobile.scrollWidth <= mobile.innerWidth, '无水平滚动条',
      `${mobile.scrollWidth} ≤ ${mobile.innerWidth}`);
    check(mobile.toggleDisplay === 'flex', '汉堡菜单按钮显示');

    // 移动菜单交互
    await evaluate(`document.getElementById('navToggle').click()`);
    await sleep(450);
    const opened = await evaluate(`document.getElementById('navLinks').classList.contains('is-open')`);
    check(opened, '移动菜单可展开');

    await evaluate(`document.querySelector('#navLinks a[href="#timeline"]').click()`);
    await sleep(900);
    const closed = await evaluate(`!document.getElementById('navLinks').classList.contains('is-open')`);
    check(closed, '点击链接后菜单自动关闭');

    await evaluate(`document.getElementById('navToggle').click()`);
    await sleep(400);
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    await sleep(300);
    check(await evaluate(`!document.getElementById('navLinks').classList.contains('is-open')`), 'ESC 键关闭菜单');

    /* ===== 404 页面 ===== */
    head('▶ 404 页面');
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/404.html` });
    await sleep(2500);
    const err = JSON.parse(await evaluate(`JSON.stringify({
      hasCode: !!document.querySelector('.err-code'),
      hasBack: !!document.querySelector('.btn-primary'),
      canvas: (() => { const c = document.getElementById('starfield');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })()
    })`));
    check(err.hasCode, '404 页面渲染');
    check(err.hasBack, '404 返回按钮存在');
    check(err.canvas > 100, '404 星空背景已绘制', `${err.canvas} 个像素`);

    /* ===== JS 错误 ===== */
    head('▶ 运行时错误');
    const realErrors = events.filter(e => !/favicon|QQBrowser|task_manager|sync\/engine|ERR_ABORTED/i.test(e));
    check(realErrors.length === 0, '无 JS 运行时错误',
      realErrors.length ? realErrors.slice(0, 3).join(' | ') : '0 个');

    cdp.close();
  } catch (e) {
    bad('验证过程出错: ' + e.message);
  } finally {
    try { child.kill(); } catch { }
    try { server.close(); } catch { }
  }

  /* ===== 汇总 ===== */
  console.log(`\n${C.dim}${'─'.repeat(46)}${C.reset}`);
  const total = passCount + failCount;
  if (failCount === 0) {
    console.log(`${C.bold}${C.green}  全部通过${C.reset}  ${passCount}/${total}\n`);
  } else {
    console.log(`${C.bold}${C.red}  ${failCount} 项失败${C.reset}  ${passCount}/${total} 通过\n`);
  }
  process.exit(failCount === 0 ? 0 : 1);
})();