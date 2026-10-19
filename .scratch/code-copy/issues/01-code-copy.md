# 01: 代码块右上角加复制按钮

**What to build:** 在 `.yuki-prose` 与 `.yuki-shuoshuo-body` 的每个非空代码块右上角加一枚
原生按钮，点一下把代码原文写进剪贴板；成功后短暂显示「已复制」，失败显示「复制失败」，
并通过 `role="status"` 播报结果。

**范围。** 只处理页面加载时已有的 `pre`；空白代码块跳过。按钮由 JS 创建，服务端不输出
按钮或包装容器；禁用 JS 时行为不变。不给编辑器画布、行内 `code`、正文外的 `pre` 加按钮。

**DOM 与对齐。** 外层新增 `.yuki-code-block` 容器；把 `alignwide` / `alignfull` /
`alignleft` / `alignright` / `aligncenter` 从 `pre` 转移到容器，其余类留在 `pre` 上。
容器承担原来的上下间距，`pre` 外边距归零。

**剪贴板。** 优先 `navigator.clipboard.writeText()`，失败回退临时 `textarea` +
`document.execCommand('copy')`；两种都失败才报「复制失败」。复制文本严格取
`textContent`，不额外 trim 每行、不加行号。

**视觉。** 按钮 pill、12px、`--yuki-card` 背景、`--yuki-border` 边框、`--yuki-ink-2`
文字；hover / 已复制用主色；`:focus-visible` 用 `--yuki-ring`。不新增颜色 token。
浅色/深色可辨；640px 不横向溢出。

**加载与文案。** 新文件 `assets/js/code-copy.js`（IIFE、无依赖、无构建）；在
`functions.php` 的 `yuki_assets()` 里 footer 加载 `yuki-code-copy`，用
`wp_localize_script` 注入「复制代码」「已复制」「复制失败」三条文案。`languages/yuki.pot`
按 HEAD + 本件改过的 `functions.php` 重建。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `cd6ce60`）。

- [x] 正文核心代码块、经典 `<pre><code>` 都有复制按钮；行内 `code`、编辑器画布没有
- [x] 说说正文里的代码块也有复制按钮（站点配置了说说分类时）
- [x] 空白代码块不包装、不按钮
- [x] 点击后剪贴板拿到逐字等于 `textContent` 的代码（多行、缩进、引号、`<`、`&` 不变形）
- [x] 成功显示「已复制」，约 2 秒后恢复；失败显示「复制失败」
- [x] `navigator.clipboard` 不可用或被拒时走 `execCommand` 回退；两者都失败才报错
- [x] 读屏器播报区收到结果；按钮可 Tab 聚焦、有可见焦点环
- [x] `alignwide` / `alignfull` 的宽度与对齐不变，对齐类已转移到容器
- [x] 640px 视口下页面无横向滚动；深色下按钮底色仍等于 `--yuki-card`
- [x] 服务端 HTML 没有按钮/容器；禁用 JS 时行为不变
- [x] 没有新增外部依赖、构建步骤或模板改动
- [x] 新增文案走 `__()`，`languages/yuki.pot` 按 HEAD + 自己改的文件重建
- [x] `node tests/bin/verify-code-copy.mjs` 全绿，`node tests/bin/verify-package.mjs` 仍通过

## Comments

### 实现

- **新文件** `assets/js/code-copy.js`：IIFE + `'use strict'`、无依赖、无构建。只处理
  `.yuki-prose pre` 与 `.yuki-shuoshuo-body pre`，跳过空白块与已在 `.yuki-code-block` 里的块。
- **容器与对齐**：每个 `pre` 外包一层 `.yuki-code-block`，把 `alignwide` / `alignfull` /
  `alignleft` / `alignright` / `aligncenter` 从 `pre` 移到容器，`pre` 外边距归零。按钮是原生
  `<button type="button">`，绝对定位在容器右上角；服务端不输出容器或按钮。
- **复制文本**：严格取 `(pre.querySelector('code') || pre).textContent`，不逐行 trim、不加行号。
- **剪贴板**：优先 `navigator.clipboard.writeText()`；不可用或被拒时回退到临时 `textarea` +
  `document.execCommand('copy')`；两者都失败才显示「复制失败」。
- **反馈与可访问性**：成功/失败改按钮文字并保持约 2 秒；`.screen-reader-text` +
  `role="status"` + `aria-live="polite"` 播报同一句结果。`aria-busy` 防重入，按钮可 Tab 聚焦，
  `:focus-visible` 使用 `--yuki-ring`。

### 加载与文案

- `functions.php` 的 `yuki_assets()` 增加 `yuki-code-copy`（footer、无依赖、
  `yuki_asset_version()`），并用 `wp_localize_script` 注入 `copyLabel`、`copiedLabel`、
  `failedLabel` 三条文案，全部走 `__()`。
- `languages/yuki.pot` 按 `AGENTS.md` 第 5 条重建：`git archive HEAD` 到临时目录，只拷入本件
  改过的 `functions.php`，再跑生成器。生成 115 条；三条新文案的 `#:` 指向
  `functions.php:109-111`。`check-pot.mjs` 全绿：121 条引用都指向真实 gettext 调用。

### 验收

新增 `tests/bin/code-copy-fixtures.php` 与 `tests/bin/verify-code-copy.mjs`，静态 + HTTP +
无头 Edge 共 **51/51**。造数覆盖核心 `wp-block-code`、经典 `<pre><code>`、`alignwide` 块、
空白块、行内 `code` 与说说代码块。实测要点：宽块保持 1120px、正文列仍 720px；逐字复制多行/
缩进/引号/`<`/`&`；成功反馈与播报、2 秒恢复；clipboard 被拒时走 `execCommand`，两条都失败
才报错；640px 无横向滚动；深色按钮底色为 `--yuki-card`。全套 28 个验收脚本通过，
`verify-package.mjs` 65/65；浅色/深色 1200 与 640px 截图已人工看过。

### 已知边界

- 只处理页面加载时已有的 `pre`；无限滚动等动态插入的代码块不会自动加按钮。
- 按钮常驻右上角，不做 hover 才显示；触屏与键盘都能直接找到。
- 复制的是 `textContent` 原文，不清理行首缩进，也不把行号或语法高亮拆成额外格式。
- 失败态不发明「危险色」，只把按钮边框换成 `--yuki-ink-3`；与 `.yuki-comment-error` 的取舍一致。
- 造数脚本带 `--cleanup`，验收结束会删除自己的页面与说说，避免污染共享的说说分类。
