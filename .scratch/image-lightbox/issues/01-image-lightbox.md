# 01: 正文图点开看大图

**What to build:** 在 `.yuki-prose` 与 `.yuki-shuoshuo-body` 里做一层图片灯箱：点击（或聚焦后
Enter/Space）打开深色遮罩，显示页面里能提供的最大可用图与图注；Esc、点遮罩、点关闭按钮都能关，
关闭后焦点回到触发图。

**范围。** 裸图、区块图、传统图注、画廊、说说正文图。特色图、列表缩略图、头像、Logo 不碰。
图片外有链接时：指向图片文件或带 `rel=attachment` 的附件页链接才接管，其余链接照常导航。

**大图。** 依次取：链接 `href`（仅图片文件）→ `srcset` 最大候选 → `currentSrc` → `src`。
不注册新尺寸、不做服务端裁剪。

**视觉。** `DESIGN.md` 已定义 `--yuki-overlay-backdrop` / `--yuki-overlay-foreground`；不新添颜色。
浮层由 JS 在首次打开时创建，服务端不输出遮罩；禁用 JS 时行为不变。

**可访问性。** `role="dialog"`、`aria-modal="true"`、可翻译的对话框名；焦点进入关闭按钮、
Tab 在浮层内循环、关闭后回到触发图；锁背景滚动；`prefers-reduced-motion` 下无过渡。
裸图补 `tabindex="0"` / `role="button"` / `aria-label`；已在链接里的图沿用链接语义。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `56ab0cc`）。

- [x] 点正文裸图，遮罩出现并显示 `srcset` 里最大的那张
- [x] 图注优先 `figcaption`，其次传统图注/画廊图注，最后 `alt`
- [x] Esc、点遮罩、点关闭按钮三条路都能关
- [x] 打开时焦点在关闭按钮；关闭后回到触发图；Tab 不会跑到背景页面
- [x] Tab 能聚焦裸图，Enter/Space 能打开
- [x] 图片链接到媒体文件时，点击被接管且当前页 URL 不变
- [x] 图片链接到站内锚点/别的页面时，链接照常工作
- [x] 带 `rel=attachment` 的附件页链接被接管，大图走 `srcset`
- [x] 说说正文图可以打开
- [x] 特色图、列表缩略图、头像、Logo 点击后不出现遮罩
- [x] 浅色/深色遮罩都等于 token；640px 视口无横向滚动
- [x] `prefers-reduced-motion` 下没有缩放/淡入过渡
- [x] 服务端 HTML 里没有遮罩标记；禁用 JS 时图片保持原行为
- [x] 没有新增外部依赖、构建步骤或模板改动
- [x] 新增文案走 `__()`，`languages/yuki.pot` 按 HEAD + 自己改的文件重建
- [x] 真浏览器断言覆盖打开/关闭/键盘/链接/范围；静态断言覆盖 token 与 reduced-motion

## Comments

### 实现

- **新文件** `assets/js/image-lightbox.js`：IIFE + `'use strict'`、无依赖、无构建。浮层在第一次打开时
  创建并追加到 `body`，服务端不输出任何遮罩标记。
- **触发范围**：`.yuki-prose img` 与 `.yuki-shuoshuo-body img`。裸图由脚本补
  `tabindex="0"` / `role="button"` / `aria-label`；已经在链接里的图沿用链接本身。
- **链接规则**：`href` 是图片文件 → 用 href 并 `preventDefault`；`rel` 含 `attachment` →
  用 `srcset` 最大候选并接管；其余链接不劫持。
- **大图**：链接 href（仅图片文件）→ `srcset` 最大候选 → `currentSrc` → `src`；加载失败回退一次。
- **图注**：`figcaption` → `.wp-caption-text` → `.gallery-caption` → `alt`。
- **可访问性**：`role="dialog"`、`aria-modal="true"`、可翻译的对话框名；焦点进入关闭按钮、
  Tab 在浮层内循环、关闭后回到触发图；锁背景滚动；`prefers-reduced-motion` 下取消过渡与缩放。
- **视觉**：`style.css` 的 `:root` 新增 `--yuki-overlay-backdrop` / `--yuki-overlay-foreground`，
  与 `DESIGN.md` 的「浮层」一节一致；没有裸 rgba。

### 加载与文案

- `functions.php` 的 `yuki_assets()` 增加 `yuki-image-lightbox`（footer、无依赖、
  `yuki_asset_version()`），并用 `wp_localize_script` 注入 `closeLabel`、`dialogLabel`、
  `openLabel`、`openLabelPlain` 四条文案，全部走 `__()`。
- `languages/yuki.pot` 按 `AGENTS.md` 第 5 条重建：`git archive HEAD` 到临时目录，只把本件改过的
  `functions.php` 拷进去，再跑生成器；**没有扫工作区**。生成 92 条，四条新文案的 `#:` 分别指向
  `functions.php:63-66`，与源码一致。

### 验收

新增 `tests/bin/image-lightbox-fixtures.php` 与 `tests/bin/verify-image-lightbox.mjs`，
真浏览器 + 静态共 **39/39**。造数包含裸图、区块图 + 图注、媒体链接、页内锚点链接、
`rel=attachment` 链接、特色图与一条说说；站点没有配置说说分类时脚本会跳过那一组。

实测要点：裸图打开 `srcset` 最大候选；图注来自 `figcaption` 或 `alt`；Esc/遮罩/按钮都能关；
关闭后焦点回到触发图；Tab 不会跑出浮层；媒体链接不导航、锚点链接照常生效；
`rel=attachment` 走 `srcset`；特色图不触发；深色遮罩 `rgba(24, 24, 31, 0.92)`；
640px 下图片完整落在视口、无横向滚动；reduced motion 下过渡 `0s`、无缩放。

`browser.mjs` 为此加了 `reducedMotion` 选项（只增不改），编辑器样式 23/23、编辑器对齐 58/58、
截图 15/15、说说版式 43/43 均通过。

### 已知边界

- 第一版只做单图；同页多图的左右切换留在路线图 Fog。
- 没有 `rel=attachment` 的附件页链接会照常导航——宁可让它导航，也不劫持一个不知道指向哪里的链接。
- 不处理动态插入的图片（无限滚动等）。
- 浮层关闭后留在 DOM 里，靠 `visibility: hidden` 移出无障碍树与 Tab 顺序；没有用 `inert` 锁背景，
  与现有搜索浮层保持一致。
