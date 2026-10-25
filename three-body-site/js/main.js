/* ============================================================
   三体档案 · 主脚本
   星空粒子 / 三体运动模拟 / 内容渲染 / 滚动交互
   ============================================================ */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ==========================================================
     1. 星空粒子画布
     ========================================================== */
  function initStarfield() {
    const canvas = $('#starfield');
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let stars = [];
    let nebulae = [];
    let shootingStars = [];
    let w = 0, h = 0, dpr = 1;
    let rafId = null;
    let lastShoot = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // 注意：clientWidth / clientHeight 是只读属性，不能赋值。
      // 画布的显示尺寸由 CSS（position:fixed; inset:0）决定，
      // 这里只需按 DPR 设置用于绘制的后备缓冲区尺寸。
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width  = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    function buildStars() {
      // 依据屏幕面积决定粒子数，移动端自动降量
      const density = w < 768 ? 5200 : 3400;
      const count = Math.max(90, Math.min(420, Math.round((w * h) / density)));

      stars = Array.from({ length: count }, () => {
        const depth = Math.random();               // 0 远 → 1 近
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.35 + depth * 1.5,
          baseAlpha: 0.22 + depth * 0.62,
          depth,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.006 + Math.random() * 0.02,
          driftX: (Math.random() - 0.5) * (0.03 + depth * 0.11),
          driftY: (Math.random() - 0.5) * (0.03 + depth * 0.11),
          hue: Math.random() < 0.12 ? 42 : (Math.random() < 0.22 ? 200 : 220)
        };
      });

      // 少量彩色光斑，增加层次
      const nebCount = w < 768 ? 3 : 6;
      nebulae = Array.from({ length: nebCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 90 + Math.random() * 180,
        hue: [200, 220, 268, 42][Math.floor(Math.random() * 4)],
        alpha: 0.035 + Math.random() * 0.05,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08
      }));
    }

    function spawnShootingStar() {
      const fromLeft = Math.random() < 0.5;
      shootingStars.push({
        x: fromLeft ? -40 : w + 40,
        y: Math.random() * h * 0.55,
        vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 5),
        vy: 2.4 + Math.random() * 2.2,
        len: 90 + Math.random() * 110,
        life: 1,
        decay: 0.008 + Math.random() * 0.008
      });
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);

      // 光斑
      nebulae.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -n.r) n.x = w + n.r;
        if (n.x > w + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = h + n.r;
        if (n.y > h + n.r) n.y = -n.r;

        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 78%, 62%, ${n.alpha})`);
        g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 恒星
      stars.forEach(s => {
        s.twinkle += s.twinkleSpeed;
        s.x += s.driftX;
        s.y += s.driftY;

        // 环绕边界
        if (s.x < -4) s.x = w + 4;
        if (s.x > w + 4) s.x = -4;
        if (s.y < -4) s.y = h + 4;
        if (s.y > h + 4) s.y = -4;

        const alpha = reduceMotion
          ? s.baseAlpha
          : s.baseAlpha * (0.62 + 0.38 * Math.sin(s.twinkle));

        ctx.fillStyle = `hsla(${s.hue}, 88%, ${72 + s.depth * 16}%, ${alpha})`;

        if (s.r > 1.25) {
          // 亮星带光晕
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
          g.addColorStop(0, `hsla(${s.hue}, 92%, 82%, ${alpha * 0.55})`);
          g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `hsla(${s.hue}, 92%, 88%, ${alpha})`;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 流星
      if (!reduceMotion && t - lastShoot > 5200 && Math.random() < 0.02) {
        spawnShootingStar();
        lastShoot = t;
      }

      shootingStars = shootingStars.filter(m => {
        m.x += m.vx;
        m.y += m.vy;
        m.life -= m.decay;

        if (m.life <= 0 || m.y > h + 120 || m.x < -160 || m.x > w + 160) return false;

        const ex = m.x - m.vx * (m.len / 12);
        const ey = m.y - m.vy * (m.len / 12);

        const g = ctx.createLinearGradient(m.x, m.y, ex, ey);
        g.addColorStop(0, `rgba(200, 232, 255, ${0.9 * m.life})`);
        g.addColorStop(0.45, `rgba(120, 190, 255, ${0.34 * m.life})`);
        g.addColorStop(1, 'rgba(120, 190, 255, 0)');

        ctx.strokeStyle = g;
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        return true;
      });

      rafId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', debounce(resize, 180), { passive: true });

    // 页面不可见时暂停，节省资源
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!rafId) {
        rafId = requestAnimationFrame(draw);
      }
    });

    rafId = requestAnimationFrame(draw);
  }

  /* ==========================================================
     2. 三体运动模拟（Hero 示意动画）
     ========================================================== */
  function initThreeBody() {
    const svg = $('#orbitSvg');
    const starA = $('#starA');
    const starB = $('#starB');
    const starC = $('#starC');
    const planet = $('#planetDot');
    if (!svg || !starA || !starB || !starC) return;

    const CX = 200, CY = 200;
    // 三颗恒星：不同半径 / 角速度 / 初始相位，形成混沌感
    // 各自沿独立的椭圆轨道运行，避免重叠在一个点上
    const bodies = [
      { el: starA, rx: 140, ry: 118, speed:  0.0042, wobble: 0.16, phase: 0.0 },
      { el: starB, rx: 96,  ry: 134, speed: -0.0063, wobble: 0.22, phase: 2.1 },
      { el: starC, rx: 70,  ry: 62,  speed:  0.0094, wobble: 0.30, phase: 4.3 }
    ];

    let a = 0, rafId = null;
    const planetState = { angle: 0, rx: 168, ry: 146, speed: 0.0125 };

    function place(b, t) {
      // 基础椭圆轨道 + 轻微径向扰动，模拟三体运动的混沌感
      const ang = b.phase + t * b.speed;
      const rx = b.rx * (1 + Math.sin(t * b.speed * 2.7 + b.phase) * b.wobble * 0.5);
      const ry = b.ry * (1 + Math.cos(t * b.speed * 2.1 + b.phase) * b.wobble * 0.5);
      const x = CX + Math.cos(ang) * rx;
      const y = CY + Math.sin(ang) * ry;
      b.el.setAttribute('cx', x.toFixed(2));
      b.el.setAttribute('cy', y.toFixed(2));
    }

    function frame() {
      a += 1;

      bodies.forEach(b => place(b, a));

      if (planet) {
        planetState.angle += planetState.speed;
        const px = CX + Math.cos(planetState.angle) * planetState.rx;
        const py = CY + Math.sin(planetState.angle) * planetState.ry;
        planet.setAttribute('cx', px.toFixed(2));
        planet.setAttribute('cy', py.toFixed(2));
      }

      rafId = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      // 静态摆位
      bodies.forEach(b => place(b, 0));
      return;
    }

    rafId = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!rafId) {
        rafId = requestAnimationFrame(frame);
      }
    });
  }

  /* ==========================================================
     3. 内容渲染
     ========================================================== */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function renderCharacters(filter = 'all') {
    const grid = $('#charGrid');
    if (!grid || typeof CHARACTERS === 'undefined') return;

    const list = filter === 'all'
      ? CHARACTERS
      : CHARACTERS.filter(c => c.faction === filter);

    if (!list.length) {
      grid.innerHTML = '<p class="char-desc">没有符合筛选条件的人物。</p>';
      return;
    }

    grid.innerHTML = list.map(c => `
      <article class="char-card reveal" data-faction="${escapeHtml(c.faction)}">
        <div class="char-head">
          <h3 class="char-name">${escapeHtml(c.name)}</h3>
          <span class="char-en">${escapeHtml(c.en)}</span>
        </div>
        <span class="char-faction">${escapeHtml(c.factionLabel)}</span>
        <p class="char-role">${escapeHtml(c.role)}</p>
        <p class="char-desc">${escapeHtml(c.desc)}</p>
        <p class="char-quote">${escapeHtml(c.quote)}</p>
      </article>
    `).join('');

    observeReveals(grid);
  }

  function renderConcepts() {
    const grid = $('#conceptGrid');
    if (!grid || typeof CONCEPTS === 'undefined') return;

    grid.innerHTML = CONCEPTS.map(c => `
      <article class="concept-card reveal">
        <div class="concept-icon" aria-hidden="true">${escapeHtml(c.icon)}</div>
        <div class="concept-title-row">
          <h3>${escapeHtml(c.title)}</h3>
          <span class="concept-tag">${escapeHtml(c.tag)}</span>
        </div>
        <p>${escapeHtml(c.desc)}</p>
      </article>
    `).join('');
  }

  function renderQuotes() {
    const grid = $('#quoteGrid');
    if (!grid || typeof QUOTES === 'undefined') return;

    grid.innerHTML = QUOTES.map(q => `
      <figure class="quote-card reveal">
        <blockquote class="quote-text">${escapeHtml(q.text)}</blockquote>
        <figcaption class="quote-from">《${escapeHtml(q.from)}》</figcaption>
      </figure>
    `).join('');
  }

  /* ==========================================================
     4. 滚动交互
     ========================================================== */
  let revealObserver = null;
  let revealFallbackTimer = null;

  function showAllReveals() {
    $$('.reveal:not(.is-visible)').forEach(el => el.classList.add('is-visible'));
  }

  function observeReveals(root = document) {
    const items = $$('.reveal:not(.is-visible)', root);
    if (!items.length) return;

    // 不支持 IntersectionObserver 时直接显示
    if (!('IntersectionObserver' in window)) {
      showAllReveals();
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }

    items.forEach(el => revealObserver.observe(el));

    // 安全网：无论观察器是否正常触发，稍后强制显示所有内容，
    // 避免任何环境下出现「整页空白」的不可用状态。
    clearTimeout(revealFallbackTimer);
    revealFallbackTimer = setTimeout(showAllReveals, 2600);
  }

  // 首屏元素立即显示，不等滚动
  function revealAboveFold() {
    const vh = window.innerHeight || 800;
    $$('.reveal').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.92) el.classList.add('is-visible');
    });
  }

  function initScrollUI() {
    const nav = $('#nav');
    const progress = $('#scrollProgress');
    const toTop = $('#toTop');
    const sections = $$('main section[id]');
    const navAnchors = $$('.nav-links a');

    let ticking = false;

    function onScroll() {
      const y = window.scrollY || window.pageYOffset;

      // 导航样式
      if (nav) nav.classList.toggle('is-scrolled', y > 24);

      // 进度条
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (y / max) * 100 : 0;
        progress.style.width = Math.min(100, Math.max(0, pct)).toFixed(2) + '%';
      }

      // 回到顶部
      if (toTop) toTop.classList.toggle('is-visible', y > 560);

      // 当前分区高亮
      const probe = y + window.innerHeight * 0.32;
      let current = '';
      sections.forEach(sec => {
        if (sec.offsetTop <= probe) current = sec.id;
      });

      navAnchors.forEach(a => {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
      });

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    }, { passive: true });

    onScroll();

    if (toTop) {
      toTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }

  function initMobileNav() {
    const toggle = $('#navToggle');
    const links = $('#navLinks');
    if (!toggle || !links) return;

    function close() {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '打开导航菜单');
    }

    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    });

    $$('a', links).forEach(a => a.addEventListener('click', close));

    document.addEventListener('click', e => {
      if (!links.classList.contains('is-open')) return;
      if (!links.contains(e.target) && !toggle.contains(e.target)) close();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });

    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth > 768) close();
    }, 180), { passive: true });
  }

  function initFilters() {
    const wrap = $('#charFilters');
    if (!wrap) return;

    wrap.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;

      $$('.chip', wrap).forEach(c => {
        const active = c === btn;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-selected', String(active));
      });

      renderCharacters(btn.dataset.filter || 'all');
    });
  }

  /* ==========================================================
     5. 工具
     ========================================================== */
  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /* ==========================================================
     6. 启动
     ========================================================== */
  function boot() {
    // 每个模块独立初始化：任一模块出错都不会阻断其余功能，
    // 同时保证页面内容始终可见可用。
    const safe = (name, fn) => {
      try { fn(); } catch (err) {
        console.error('[三体档案] 模块初始化失败:', name, err);
      }
    };

    safe('year', () => {
      const yearEl = $('#year');
      if (yearEl) yearEl.textContent = new Date().getFullYear();
    });

    safe('renderCharacters', () => renderCharacters('all'));
    safe('renderConcepts', () => renderConcepts());
    safe('renderQuotes', () => renderQuotes());

    safe('initStarfield', () => initStarfield());
    safe('initThreeBody', () => initThreeBody());
    safe('initMobileNav', () => initMobileNav());
    safe('initFilters', () => initFilters());
    safe('initScrollUI', () => initScrollUI());
    safe('revealAboveFold', () => revealAboveFold());
    safe('observeReveals', () => observeReveals());

    // 最终兜底：无论如何都要保证内容可见
    safe('showAllReveals', () => showAllReveals());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();