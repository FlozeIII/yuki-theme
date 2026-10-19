# 代码块复制

Status: ready-for-agent
Type: spec

## Problem Statement

正文里的代码块今天只能看，不能一键带走。读者想在自己的编辑器里试一段示例，得先用鼠标
从第一行拖到最后一行——代码块一横向滚动，选择就更容易漏行或带上行号；在手机上长按选择
更是难受。主题已经有统一的代码块外观（卡片底、圆角、等宽字体、横向滚动），但没有一个
「复制」动作。

这是阅读体验里很小、很具体的一件：不改变内容，不改变代码块的样子，只让「把这段代码拿走」
少一步。

## Solution

在正文与说说里的每个代码块右上角加一枚**复制**按钮：点一下把代码原文写进剪贴板，按钮短暂
变成「已复制」；失败时变成「复制失败」，并让读屏器听到结果。

它是**增强**：禁用 JS 时服务端 HTML 与今天完全一样——没有按钮、没有包装容器；不改变正文
标记，不新增服务端端点，不引外部库、不加构建步骤。

## User Stories

### 复制

1. 作为读者，我希望点代码块右上角的按钮，就把整段代码复制走，而不是手动拖选。
2. 作为读者，我希望复制的是代码原文：多行、缩进、引号、`<`、`&` 这些字符都不变形，
   也不带按钮文字或行号。
3. 作为读者，我希望复制成功后按钮明确告诉我「已复制」，不用去别处验证。
4. 作为读者，我希望复制失败时按钮告诉我「复制失败」，而不是毫无反应。
5. 作为手机读者，我希望按钮始终可见、点得到，不需要先悬停。

### 范围与边界

6. 作为读者，我希望正文里的经典 `<pre><code>`、区块编辑器代码块、说说正文里的代码块都能复制。
7. 作为读者，我希望只有代码块有按钮；普通段落、行内 `code`、图片、引用都不该多出按钮。
8. 作为站主，我希望禁用 JS 时主题行为一点不变，服务端不输出按钮或包装容器。
9. 作为站主，我希望代码块在宽屏、窄屏与 `alignwide` / `alignfull` 下仍保持原来的宽度与对齐，
   不因为多了一层容器而变形或撑出横向滚动。

### 键盘与无障碍

10. 作为键盘用户，我希望 Tab 能聚焦复制按钮，Enter/Space 能触发它，并有可见的焦点环。
11. 作为屏幕阅读器用户，我希望按钮有明确的名字（「复制代码」），复制结果会被播报，
    而不是只改一个视觉文字。
12. 作为视觉敏感的用户，我希望按钮沿用现有设计 token，不新添颜色；浅色与深色下都清晰可辨。

## Implementation Decisions

### 触发范围

- 只选**白名单作用域**：`.yuki-prose pre` 与 `.yuki-shuoshuo-body pre`。
- 包含：WordPress 核心 `wp-block-code`、经典 `<pre><code>`、以及它们里面带高亮 `<span>` 的代码。
- 排除：编辑器画布（`.editor-styles-wrapper`）、行内 `code`、正文容器之外任何 `pre`。
- 只处理页面加载时已存在的代码块；不做 MutationObserver / 无限滚动适配。
- 代码文本只取 `pre` 里的 `code`（没有 `code` 就取 `pre`）的 `textContent`。空白代码块
  （`trim()` 后为空）不包装、不加按钮。

### DOM 与对齐

- 脚本给每个命中的 `pre` 外包一层 `<div class="yuki-code-block">`，按钮放在容器内、
  `pre` 之前；用绝对定位浮在右上角。
- `pre` 上的对齐类 `alignwide` / `alignfull` / `alignleft` / `alignright` / `aligncenter`
  **转移到容器**、从 `pre` 上移除，让既有的对齐规则继续作用在「代码块整体」上，而不是
  只作用在内层 `pre`。其余类（`wp-block-code`、语言类等）留在 `pre` 上。
- 容器 `position: relative`，`pre` 的外边距归零；容器承担原来 `pre` 的上下间距。
- 按钮是原生 `<button type="button">`，文字「复制代码」，`aria-label` 同为「复制代码」；
  不劫持代码块点击，不在代码文本里插入任何标记。

### 剪贴板

- 优先用 `navigator.clipboard.writeText()`（需要安全上下文与 API 可用）。
- 失败或不可用时回退到临时 `<textarea>` + `document.execCommand('copy')`；临时节点在
  复制后立即移除，不进入可访问性树。
- 不申请额外权限、不弹自定义提示、不上报任何数据。

### 反馈与可访问性

- 成功后按钮文字变「已复制」，加 `.is-copied`（主色边框/文字）；约 2 秒后恢复「复制代码」。
- 失败后文字变「复制失败」，加 `.is-failed`；约 2 秒后恢复。
- 页面里只放一个视觉隐藏的 `role="status"` / `aria-live="polite"` 区域（复用
  `.screen-reader-text`），成功与失败都把同一句结果写进去，让读屏器播报。
- 按钮保留原生按钮的键盘行为；`:focus-visible` 用现有 `--yuki-ring` 画 2px 焦点环。
- 视觉：按钮背景 `--yuki-card`、边框 `--yuki-border`、文字 `--yuki-ink-2`，hover 用主色；
  圆角 `--yuki-radius-pill`、12px 字号。**不新增颜色 token**；失败态也不引入「危险色」，
  只靠文字与现有中性色区分。

### 脚本与加载

- 新文件 `assets/js/code-copy.js`：IIFE + `'use strict'`、无依赖、无构建，写法与
  `image-lightbox.js` / `theme-toggle.js` 同级。
- 在 `functions.php` 的 `yuki_assets()` 里以 footer、无依赖、`yuki_asset_version()` 版本加载。
  全站加载（脚本很小，找不到代码块就退出），避免按模板条件漏掉说说归档。
- 文案通过 `wp_localize_script( 'yuki-code-copy', 'yukiCodeCopy', … )` 注入：
  `copyLabel`（复制代码）、`copiedLabel`（已复制）、`failedLabel`（复制失败），全部走 `__()`。
- 新增字符串要重建 `languages/yuki.pot`：按 `AGENTS.md` 第 5 条，用 `git archive HEAD`
  加自己改的文件，不扫工作区，不动别人的字符串。
- 不修改任何模板；不新增 PHP 端点；不引入第三方库。

### 明确不做的

- 不做「复制为 Markdown / 富文本」或多格式菜单。
- 不做代码行号、语法高亮、折叠、下载。
- 不给行内 `code`、编辑器画布、代码块之外的 `pre` 加按钮。
- 不做复制历史、统计或任何网络请求。

## Testing Decisions

- 唯一 seam 仍是 HTTP；真浏览器用 `tests/bin/browser.mjs` 的 CDP 页面，不引 PHPUnit/Jest/构建。
- 新增 `tests/bin/code-copy-fixtures.php`：
  - 造一个 `page`，含核心 `wp-block-code`、经典 `<pre><code>`、一个 `alignwide` 代码块、
    一个只有空白的代码块；代码文本带多行、缩进、引号、`<`、`&` 等实体。
  - 若站点配置了说说承载分类，再造一条带代码块的说说；没配置就返回 `null`，验收跳过那一组。
  - 按 `YUKI-CODE-COPY` 标记删旧数据，可重复执行；不改全站设置。
- 新增 `tests/bin/verify-code-copy.mjs`，分三层：
  1. **静态**：脚本存在、无 `import`/`require`/外链；`functions.php` 排上了脚本与
     `wp_localize_script`；`style.css` 有 `.yuki-code-block` / `.yuki-code-copy` 规则；
     `languages/yuki.pot` 含三条新文案。
  2. **HTTP**：验收页面 200、服务端 HTML 里没有 `yuki-code-block` / `yuki-code-copy`
     标记、脚本已排上；代码块原文完整。
  3. **无头 Edge**：按钮数量与「有内容的代码块」数量一致（空白块不按钮）；按钮在容器
     右上、可聚焦、原生 `button`；点击后 `navigator.clipboard.writeText` 收到**逐字等于**
     `textContent` 的文本，按钮变「已复制」并约 2 秒后恢复；拒绝 `writeText` 时走
     `execCommand` 回退并成功；两条都失败时显示「复制失败」；播报区收到结果；
     `alignwide` 容器的宽度仍按既有规则放宽、类已从 `pre` 转移；640px 视口下页面无横向滚动；
     深色下按钮底色仍是 `--yuki-card`。
  - 剪贴板用页面内 stub 断言（成功 / 拒绝 / 全失败三条），不依赖无头浏览器的系统剪贴板权限。
- 回归：`node tests/bin/verify-code-copy.mjs` 全绿；`node tests/bin/verify-package.mjs`
  仍通过（新增 JS 会进包，`verify-package` 的文件清单断言不能因此变红）。

## Out of Scope

- 同页多代码块的批量复制。
- 代码块以外的复制（引用、表格、行内代码）。
- 复制成功后的 toast / 浮层；反馈只在按钮与读屏器播报里。
- 服务端渲染按钮（会破坏禁用 JS 时的渐进增强）。

## Further Notes

- 这次不新建设计 token；按钮的视觉全部来自既有 `DESIGN.md` 变量。失败态沿用
  `.yuki-comment-error` 的做法：设计系统里没有「危险色」，就不临时发明一枚。
- 包装容器会让代码块在 DOM 里多一层；验收要专门盯 `alignwide` / `alignfull` 和 640px
  横向滚动，避免「按钮做出来了，版式却变了」。
- 生成 `yuki.pot` 时只把本件改过的 `functions.php` 拷进 HEAD 快照，不把别的会话未提交的
  字符串带进来。
