# 图片灯箱

Status: ready-for-agent
Type: spec

## Problem Statement

正文里的图片今天**点不开**：点下去要么什么也不发生（默认不链接），要么整页跳到附件页或媒体文件。
读者只能按正文列宽看那张图，图注与 `alt` 也没有一个更大的阅读面。

主题的文章页、页面与说说都在用图，但这个最基本的「看清楚」动作是缺的。图片空间有限、图注字号 13px，
一张信息量大的长图或截图在 720px 的正文列里读不清。

## Solution

在正文与说说里做一层**图片灯箱**：点图片（或聚焦后按 Enter/Space）打开一层深色遮罩，显示页面里
已经声明过的最大可用图与图注；Esc、点遮罩、点关闭按钮都能关，关闭后焦点回到触发图。

它是**增强**：禁用 JS 时图片保持今天的行为，不改变正文标记，不新增服务端输出。不引外部库、不加构建步骤。

## User Stories

### 打开与关闭

1. 作为读者，我希望点正文里的图片就能看大图，而不用先跳到附件页。
2. 作为读者，我希望点说说正文里的图片也能看大图。
3. 作为读者，我希望点遮罩、点关闭按钮或按 Esc 都能关掉，不必猜。
4. 作为读者，我希望关闭之后回到我刚才看的位置，而不是被丢到页首。

### 图片与图注

5. 作为读者，我希望灯箱里是页面能提供的**最大**那张图，而不是正文列里那张缩略版。
6. 作为读者，我希望图注（`figcaption` / 传统图注 / 画廊图注）在灯箱里也看得到。
7. 作为读者，我希望没有图注时用 `alt` 作为说明，而不是一片空白。
8. 作为读者，我希望图片被链接到媒体文件时，点它是看大图，而不是把当前页导航走。
9. 作为读者，我希望图片链接指向别的内容（比如另一篇文章）时，链接照常工作——灯箱不该劫持它。

### 键盘与无障碍

10. 作为键盘用户，我希望 Tab 能聚焦到正文图片，Enter/Space 打开灯箱。
11. 作为键盘用户，我希望灯箱打开后焦点在关闭按钮上，Tab 不会跑到背景页面里。
12. 作为屏幕阅读器用户，我希望灯箱是一个有名字的对话框，图片保留它原本的 `alt`。
13. 作为对动效敏感的用户，我希望 `prefers-reduced-motion` 下不做缩放动画。

### 外观与边界

14. 作为访客，我希望灯箱在浅色与深色模式下都是同一块深色舞台，控件清晰可辨。
15. 作为移动端访客，我希望图片完整落在视口里，不出现横向滚动。
16. 作为访客，我希望特色图、文章列表缩略图、头像与站点 Logo 不受影响——它们不是「正文图」。
17. 作为站主，我希望禁用 JS 时主题行为一点不变，不因为灯箱多出一层只有脚本才能关掉的东西。

## Implementation Decisions

### 触发范围

- 只选**白名单作用域**：`.yuki-prose img` 与 `.yuki-shuoshuo-body img`。
- 包含：裸 `<img>`、`figure.wp-block-image`、传统 `.wp-caption`、画廊、说说正文图。
- 排除：特色图（`.yuki-article-featured`）、文章列表缩略图（`.yuki-post-thumb`）、侧栏作者头像、
  评论头像、自定义 Logo、任何 SVG 图标。它们都在正文容器之外，白名单天然排除。
- 图片外包着 `<a href>` 时：
  - `href` 指向图片文件（`jpe?g` / `png` / `gif` / `webp` / `avif` / `svg` / `bmp`，允许查询串）→
    用 `href` 作大图，`preventDefault()`。
  - 链接带 `rel` 含 `attachment`（WordPress 附件页链接的常见标记）→ 接管，大图走 `srcset`。
  - 其余链接一律**不接管**，照常导航。没带 `rel` 的附件页链接会落到这一条，宁可让它导航，
    也不要劫持一个不知道指向哪里的链接。
- 只处理页面加载时已存在的图片；不做 MutationObserver / 无限滚动适配。

### 大图来源

按以下顺序取第一张能用的：

1. 外层图片链接的 `href`（仅当它是图片文件）；
2. `img.srcset` 里描述符最大的候选（`w` 优先，其次 `x`；解析失败就用最后一个）；
3. `img.currentSrc`；
4. `img.src`。

不注册新尺寸、不做服务端裁剪，也不请求第三方。大图加载失败时回退到 `currentSrc`，只回退一次。

### 浮层与视觉

- 视觉 token 已写进 `DESIGN.md` 的「浮层」一节：`--yuki-overlay-backdrop`（`rgba(24, 24, 31, 0.92)`）
  与 `--yuki-overlay-foreground`（`#F3F0EA`），浅色/深色共用。**不新添第三种浮层颜色。**
- 浮层由 JS 在第一次打开时创建并追加到 `body`，全页只有一个实例；服务端不输出遮罩标记。
- 结构：根 `.yuki-lightbox`（`position: fixed; inset: 0`，`z-index` 高于搜索浮层的 100）→
  遮罩层（`data-lightbox-close`）→ `<figure>` → `<img>` + `<figcaption>` → 关闭按钮。
- 图片 `max-width: 92vw; max-height: 85vh; object-fit: contain;` 圆角沿用 `--yuki-radius-lg`；
  图注用 `--yuki-overlay-foreground`、13px、居中。
- 关闭按钮固定在右上，`×` 图标，`aria-label` 用可翻译的「关闭」。
- 打开/关闭用 opacity + 轻微缩放；`@media (prefers-reduced-motion: reduce)` 下取消过渡。
- 打开时给 `body` 加 `yuki-lightbox-locked`（`overflow: hidden`），关闭时移除。

### 可访问性

- 根节点：`role="dialog"`、`aria-modal="true"`、`aria-label`（可翻译的「图片查看」）。
- 打开时保存 `document.activeElement`，聚焦关闭按钮；关闭后焦点回到触发图（若它还在文档里）。
- Tab 在浮层内可聚焦元素之间循环；只有关闭按钮时，Tab 留在它上面。
- Esc 关闭；点遮罩关闭；点图片本身不关闭。
- 裸图由 JS 补 `tabindex="0"`、`role="button"` 与 `aria-label`（模板「查看大图：%s」，`%s` 用
  `alt`；没有 `alt` 就用「查看大图」）。已经在链接里的图不补这些，链接本身就是键盘入口。
- 灯箱里的 `<img>` 保留原图 `alt`；图注单独放在 `<figcaption>`，不合并进 `alt`。

### 脚本与加载

- 新文件 `assets/js/image-lightbox.js`：IIFE + `'use strict'`、无依赖、无构建，写法与
  `theme-toggle.js` / `search-overlay.js` 同级。
- 在 `functions.php` 的 `yuki_assets()` 里以 footer、无依赖、`yuki_asset_version()` 版本加载。
  全站加载（脚本很小，找不到正文容器就退出），避免按模板条件漏掉说说归档。
- 文案通过 `wp_localize_script( 'yuki-image-lightbox', 'yukiImageLightbox', … )` 注入：
  `closeLabel`、`openLabel`（含 `%s`）、`dialogLabel`，全部走 `__()`。
- 新增字符串要重建 `languages/yuki.pot`：按 `AGENTS.md` 第 5 条，用 `git archive HEAD` 加自己改的文件，
  不扫工作区，不动别人的字符串。
- 不修改任何模板；不新增 PHP 端点；不引入第三方库。

### 明确不做的

- 不做同页多图的左右切换/滑动（路线图 Fog）。
- 不做捏合缩放、拖拽平移。
- 不接管特色图、列表缩略图、头像、Logo。
- 不做灯箱里的图片下载/分享按钮。
- 不处理动态插入的图片（无限滚动等）。
- 不改 WordPress 的默认图片链接设置。

## Testing Decisions

### 什么算一个好测试

只断言**用户能观察到的东西**：点下去遮罩有没有出现、显示的是哪张图、图注是什么、焦点在哪、
按 Esc 之后焦点去了哪、页面 URL 有没有变。不断言「调用了某个内部函数」。

### Seam

沿用现有的两个观察点：

1. **HTTP**——页面里图片的标记、没有服务端遮罩、禁用 JS 时的原样。
2. **无头浏览器**——点击、键盘事件、焦点、计算样式、视口宽度。`browser.mjs` 已有
   `evaluate` / `waitFor` / `setViewport`；键盘可以用 `evaluate` 里派发 `KeyboardEvent`，
   `prefers-reduced-motion` 可通过给 `newPage` 增加一个 CDP 媒体特性选项来模拟（只增不改）。
3. **文件阅读**——`theme-css.mjs` 断言浮层 token、选择器与 `prefers-reduced-motion` 规则。

### 要测的模块

- **打开**：点裸图 → 遮罩可见；显示的大图等于 `srcset` 最大候选；图注等于 `figcaption`。
- **关闭**：Esc、点遮罩、点关闭按钮三条路都关闭；关闭后焦点回到触发图。
- **键盘**：Tab 聚焦裸图；Enter/Space 打开；打开后 `document.activeElement` 是关闭按钮；
  Tab 不跑到背景页面。
- **链接**：链接到媒体文件的图被接管且 URL 不变；链接到站内锚点的图不接管、链接照常生效；
  带 `rel=attachment` 的图被接管。
- **范围**：特色图、列表缩略图、头像、Logo 点击后不出现遮罩；说说正文图能打开。
- **视觉**：浅色/深色下遮罩色等于 token；640px 视口无横向滚动；`prefers-reduced-motion` 下无过渡。
- **渐进增强**：HTTP 里没有 `.yuki-lightbox` 标记；禁用 JS 时图片仍是普通图片（没有 `role`/`tabindex`）。

### 明确不测什么

- 多图切换、捏合缩放、拖拽平移——不在这一版。
- 灯箱动画的帧率/观感——只验 reduced-motion 的开关。
- 第三方图片 CDN / 字体加载。
- 各浏览器差异——沿用现有的 Edge 无头观察点。

## Out of Scope

- 同页多图的左右切换与滑动。
- 特色图灯箱。
- 灯箱里的下载、分享、原图链接。
- 编辑器内的图片行为。
- 动态插入内容的图片。
- 第三方灯箱库或构建步骤。

## Further Notes

- **共享文件**：`functions.php`、`style.css`、`languages/yuki.pot`。开工前在 `.scratch/holds.md`
  各挂一行，提交后删掉；提交只带自己的路径。
- **视觉规范**：`DESIGN.md` 的「浮层」一节已经定义了 token；实现时不要再写一份裸 rgba。
- **a11y 参照**：`assets/js/search-overlay.js` 已有打开/关闭、Esc、焦点陷阱、焦点返回与滚动锁；
  灯箱照这套骨架写，但**不要**顺手重构搜索浮层。
- **测试参照**：`verify-editor-alignment.mjs` / `verify-editor-styles.mjs` 的浏览器计算样式断言可直接
  借用；新增的键盘断言只在灯箱的脚本里做，不新造一套测试框架。
- **下一步**：多图切换（路线图 Fog）如果要做，应该是这张 spec 之后的独立工单；不要在第一版里
  预埋「组」的状态。
