# 三体 · 黑暗森林 | 三体档案

> 给岁月以文明，而不是给文明以岁月。

一个致敬刘慈欣《三体》三部曲的**沉浸式设定集网站**。纯静态、零依赖、开箱即用。

![状态](https://img.shields.io/badge/status-ready-58a6ff) ![依赖](https://img.shields.io/badge/dependencies-0-6ee7ff) ![许可](https://img.shields.io/badge/license-MIT-e8c37a)

---

## ✨ 特性

| 模块 | 说明 |
| --- | --- |
| 🌌 **序章** | 动态星空画布 + 三体运动模拟（三颗恒星独立混沌轨道） |
| 📚 **三部曲** | 《三体》《黑暗森林》《死神永生》分卷介绍 |
| 🕰 **宇宙纪年** | 从公元纪年到银河纪元的 6 个关键节点时间线 |
| 👤 **人物图鉴** | 12 位核心人物，支持按阵营筛选（地球 / ETO / 面壁者 / 三体） |
| ⚙️ **核心设定** | 智子、水滴、二向箔、面壁计划等 9 项设定词条 |
| 🌑 **宇宙社会学** | 两条公理 → 猜疑链 → 技术爆炸 → 黑暗森林法则 |
| 💬 **经典语录** | 12 句原著金句，瀑布流排版 |

**技术要点**

- 零第三方依赖，无构建步骤
- 原生 Canvas 粒子星空（自动适配 DPR、页面隐藏时暂停、移动端降量）
- `IntersectionObserver` 滚动揭示动画 + 失败安全网
- 完整响应式：桌面 / 平板 / 手机（≤420px 专项优化）
- 无障碍：语义化标签、ARIA、键盘可操作、`prefers-reduced-motion` 支持
- SEO：Open Graph、语义化 meta、描述性标题
- 模块化容错启动：任一模块异常不影响其余功能

---

## 🚀 本地预览

无需安装任何依赖，二选一：

```bash
# 方式一：使用内置零依赖服务器（推荐）
node dev-server.js
# → http://127.0.0.1:4173

# 方式二：直接用浏览器打开
# 双击 index.html 即可
```

> 想换端口：`node dev-server.js 8080`

---

## 📁 目录结构

```
three-body-site/
├── index.html          # 主页面（全部内容区块）
├── 404.html            # 自定义 404（含独立星空背景）
├── css/
│   └── style.css       # 设计令牌 + 全部样式与响应式
├── js/
│   ├── data.js         # 数据层：人物 / 设定 / 语录
│   └── main.js         # 交互层：星空 / 三体模拟 / 渲染 / 滚动
├── tools/
│   └── verify.js       # 自动化验证脚本
├── dev-server.js       # 零依赖本地服务器
├── vercel.json         # Vercel 部署与缓存/安全头配置
├── package.json
├── .gitignore
├── 部署手册.md          # 详细部署步骤（GitHub + Vercel）
└── README.md
```

---

## ✅ 自动化验证

```bash
node tools/verify.js
```

该脚本会启动无头浏览器，检查：

- 页面无 JS 运行时错误
- 所有内容区块正确渲染（人物 / 设定 / 语录数量）
- Canvas 星空确实绘制了像素
- 移动端与桌面端均**无横向溢出**
- 人物筛选、移动菜单、滚动交互均正常工作

---

## 🌐 部署

详细步骤见 **[部署手册.md](部署手册.md)**。快速版：

### 部署到 Vercel（推荐，30 秒）

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 在项目目录执行
vercel

# 3. 生产环境发布
vercel --prod
```

或直接在 [vercel.com/new](https://vercel.com/new) 导入 GitHub 仓库 —— 本项目是纯静态站点，**无需任何构建配置**，Vercel 会自动识别。

### 推送到 GitHub

```bash
git init
git add .
git commit -m "feat: 三体沉浸式设定集网站"
git branch -M main
git remote add origin https://github.com/<你的用户名>/three-body-site.git
git push -u origin main
```

> 仓库地址需先在 GitHub 网页端手动创建（**不要**勾选 README / .gitignore 初始化，避免冲突）。

---

## 🎨 自定义

**改配色** —— 编辑 `css/style.css` 顶部的设计令牌：

```css
:root {
  --accent:  #58a6ff;  /* 地球蓝：主强调色 */
  --accent-2:#6ee7ff;  /* 等离子青 */
  --gold:    #e8c37a;  /* 三体金 */
  --red:     #ff6b5e;  /* 警告红 */
  --violet:  #a78bfa;  /* 星云紫 */
}
```

**增改内容** —— 只需编辑 `js/data.js` 中的 `CHARACTERS` / `CONCEPTS` / `QUOTES` 数组，页面会自动渲染。
新增人物阵营时，在 `css/style.css` 里补一条 `--faction-color` 规则即可。

**调星空密度** —— `js/main.js` 的 `buildStars()` 中修改 `density`（数值越小星星越多）。

---

## ⚠️ 版权声明

本项目为**非官方粉丝作品**，仅供学习与技术交流。

《三体》三部曲及其全部设定、人物、引文的著作权归**刘慈欣**及相关出版方所有。
站点内容基于原著设定整理归纳，不含原著正文。如有侵权，请联系删除。

代码部分以 MIT 许可开源。

---

<p align="center">
  <sub>宇宙就是一座黑暗森林，每个文明都是带枪的猎人。</sub>
</p>