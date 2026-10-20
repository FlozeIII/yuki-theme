# 01 · 文章内档案组件

Status: ready-for-agent

## What to build

新增五个可插入文章的 Gutenberg block pattern，并配一份共用 CSS：

1. **档案注记** `yuki/archive-note`
   - `core/group` + `core/paragraph`；类 `yuki-note`，标签 `NOTE / 01`。
   - 用于提示、警告、补充说明；左侧红色细线 + 冷白/深色卡片。
2. **规格表** `yuki/archive-spec`
   - `core/table`；类 `yuki-spec-table`；两列（字段/内容）三行。
   - 表头等宽小字；窄屏 `overflow-x:auto`，不撑破正文。
3. **时间线** `yuki/archive-timeline`
   - `core/group` 容器 + 三个 `yuki-timeline-item`；
   - 每项：日期、标题、说明；竖线与节点由 CSS 画。
4. **证据图卡** `yuki/archive-evidence`
   - `core/group` + `core/image` + 元数据；类 `yuki-evidence`；
   - 使用 `assets/images/component-evidence.svg` 作为占位图；
   - 图下 `EVIDENCE / 01` 与说明。
5. **双栏简报** `yuki/archive-brief`
   - `core/columns` 两列；类 `yuki-brief`；
   - 每列一个 label、一个 h3、一段说明；640px 下自动堆叠。

同时新增：

- `inc/components.php`：pattern 分类 `yuki-archive`、前台 enqueue、编辑器样式。
- `assets/css/components.css`：五个组件的浅色/深色/窄屏/reduced-motion 样式。
- `assets/images/component-evidence.svg`：内置占位图，无外部请求。
- `functions.php`：显式 `require_once` 新模块（共享文件，已在 holds 挂行）。
- `patterns/archive-*.php` 五个文件。
- `tests/bin/components-fixtures.php`、`tests/bin/verify-components.mjs`。
- POT、DESIGN/roadmap 与 issue 同步。

## 范围

只做文章正文内组件。不注册自定义块、不加 JS、不改单篇布局、不改首页/侧栏。

## Blocked by

无。

## 验收

- [x] `patterns/` 下五个文件都被 WordPress 注册为 `yuki/archive-*`，分类为 `yuki-archive`。
- [ ] 编辑器「图案」面板能插入五个 pattern；插入后块结构不失效。
- [x] 前台页面（fixtures 拼接页）渲染出 `.yuki-note`、`.yuki-spec-table`、`.yuki-timeline`、`.yuki-evidence`、`.yuki-brief`。
- [x] 浅色与深色下标签、边框、正文对比度可读。
- [x] 640px 下双栏堆叠、表格横向滚动、页面无横向溢出。
- [x] `prefers-reduced-motion: reduce` 下没有新增动画。
- [x] `node tests/bin/verify-components.mjs` 全绿。
- [x] 既有 `verify-editor-styles`、`verify-editor-alignment`、`verify-ui-redesign` 继续通过。
- [x] POT 按 HEAD + 本次文件重建，`check-pot` 全绿。
- [ ] 工单、spec、DESIGN、roadmap 更新；只提交自己的路径；holds 自己那两行删除。

## Comments

### 实现

- `inc/components.php` 注册 `yuki-archive` 分类、前台 `yuki-components` 样式、编辑器 `components.css`。
- `patterns/` 五个文件，均为 `Categories: yuki-archive`，只用核心块；没有自定义块和 JS。
- `assets/css/components.css` 提供浅色/深色/640px/reduced-motion；颜色只读 `--da-doc*` 和组件自己的 `--yuki-comp-*`。
- `assets/images/component-evidence.svg` 是内置占位图，无外部请求。
- `functions.php` 显式 `require_once inc/components.php`。

### 加载与缓存

- 主题版本仍 1.3.0，WordPress 会按主题 Version 缓存 patterns；本次 fixtures 先 `delete_pattern_cache()` 再 `_register_theme_block_patterns()`，否则新 pattern 不出现。正式发版时 Version 变化会自然失效。
- 编辑器面板的点击插入没有做浏览器自动化；已用 pattern registry、`theme.json` 等价的编辑器样式输出和前台渲染验证。剩余这一项留给人工在编辑器里过一遍。

### 验收

- `verify-components` 64/64：浅色注记 3px 红线、规格表可横向滚动、时间线 3 个 9px 节点、证据图可加载、双栏并排；640px 双栏堆叠且无横向溢出；深色表面与文字可读。
- 既有受影响脚本：`verify-editor-styles` 23/23、`verify-editor-alignment` 58/58、`verify-ui-redesign` 58/58、`verify-font` 18/18、`verify-accent` 24/24、`verify-screenshot` 16/16、`verify-package` 65/65。
- `wptk check` 0 error / 0 warning / 9 info；新增的一条是证据图动态 `src` 导致的 `html.img-alt` 误报，`alt` 已写成「证据占位图」。
