# 组件库：把档案语法变成可复用零件

Status: ready-for-agent

## Problem Statement

主题已经有完整的页面骨架（数字档案外壳、档案索引、单篇文档面板、侧栏与页脚），
但文章内部仍然只有段落、图片、引用、代码这类核心块。想写一条注记、一张规格表、
一条时间线或一组证据图，只能每次手写 HTML 或临时加 CSS，页面之间没有共同的语法。

读者看到的是「一个页面一个样子」，作者也没有可复用的积木。

## Solution

分三批增加可复用组件，全部基于 WordPress 核心块与主题 CSS，不引入构建、不新增
JavaScript 框架、不注册自定义块：

1. **第一批 · 文章内档案组件**：档案注记、规格表、时间线、证据图卡、双栏简报。
   用 `patterns/` 下的 block pattern + `assets/css/components.css`，编辑器和前台共用。
2. **第二批 · 单篇阅读组件**：自动目录、阅读进度、系列/上下篇导航。
3. **第三批 · 页面与侧栏模块**：数据条、标签墙、作者卡、订阅卡、页脚链接组。

第一批是后两批的样式底座：颜色、边框、等宽标签、格线全部沿用数字档案的
`--da-*` 与既有全局 token。

## User Stories

- 作为作者，我可以在编辑器里插入「档案注记」，写提示、警告或补充说明，不用记 CSS 类名。
- 作为作者，我可以用「规格表」把编号、状态、位置排成两列表格，并在窄屏横向滚动。
- 作为作者，我可以用「时间线」按日期排列事件，每条自动带节点和竖线。
- 作为作者，我可以用「证据图卡」放一张图和一段图注，图卡自带 `EVIDENCE / 01` 标签。
- 作为作者，我可以用「双栏简报」并排放两段短内容，在手机上自动堆叠。
- 作为读者，我在浅色和深色主题下都能看清这些组件的标签、边框和正文。
- 作为维护者，我可以用 `patterns/` 和一份 CSS 修改所有组件，不需要改文章内容。

## Implementation Decisions

- 新增 `inc/components.php`：
  - `register_block_pattern_category( 'yuki-archive', ... )`，标签为「Yuki 档案组件」。
  - 在 `wp_enqueue_scripts` 优先级 20 入队 `yuki-components`，依赖 `yuki-style`。
  - 通过 `add_editor_style()` 把 `assets/css/components.css` 加进编辑器画布。
- 新增 `patterns/` 目录，WordPress 自动注册主题 pattern；每个文件只输出核心块：
  - `yuki/archive-note`：`core/group` + `core/paragraph`，类 `yuki-note`。
  - `yuki/archive-spec`：`core/table`，类 `yuki-spec-table`。
  - `yuki/archive-timeline`：`core/group` 嵌套多个 `yuki-timeline-item`，每项日期、标题、说明。
  - `yuki/archive-evidence`：`core/group` + `core/image` + 元数据；图片使用主题内占位 SVG。
  - `yuki/archive-brief`：`core/columns`，两列，类 `yuki-brief`。
- 不注册自定义块、不新增 JS、不引入外部字体或图标；编辑器与前台共用同一份 CSS。
- 组件外观沿用数字档案语法：2px 直角、等宽 uppercase 标签、细格线/边框、红/青强调；
  不新造一套颜色 token，尽量使用 `--da-*` 与 `--yuki-*`，并为编辑器缺失的 `--da-*`
  提供回退色。
- 兼容 `.yuki-prose`、`.editor-styles-wrapper` 与 `.yuki-shuoshuo-body` 三个正文作用域。
- 新增占位图 `assets/images/component-evidence.svg`（内置 SVG，无外部请求）。
- 第二批、第三批各自独立 issue；第一批先落地，后续复用它的标签/边框/间距语法。

### 第二批 · 单篇阅读

- `inc/reading.php`：
  - 注册非公开分类 `yuki_series`（`post`），只在编辑器给作者归类，不生成前台系列归档；
  - 只在 `is_singular('post')` 时入队 `assets/js/reading.js`，用 `wp_localize_script` 注入目录/进度文案；
  - `yuki_series_nav()` 取当前文章的第一条系列，按日期升序输出；少于两篇或没有系列时不输出。
- `single.php`：在 `.yuki-prose` 前放 `[data-yuki-toc]` 空槽，在上下篇导航前调用 `yuki_series_nav()`。
  JS 不参与时目录不出现，服务端不预生成目录。
- `assets/js/reading.js`：IIFE、无依赖；从正文 `h2/h3` 生成 `<details class="yuki-toc">`，
  `h2` 为一级、`h3` 缩进；点击平滑滚动、更新 hash、把焦点放到标题；
  滚动时更新 `aria-current`。少于两个标题不建目录。
- 进度条由 JS 插入 body 顶部，`role="progressbar"`，`aria-valuenow` 跟随滚动；
  reduced-motion 下不启用过渡。
- 系列导航与目录样式都追加在 `assets/css/components.css`；不改正文 724px、侧栏 300px 和 B 外壳策略。

## Testing Decisions

唯一 seam 仍是 HTTP；不引入 PHPUnit/Jest/构建。

- `tests/bin/components-fixtures.php`：
  - 按 `YUKI-COMPONENTS` 标记清理旧页面；
  - 从 `WP_Block_Patterns_Registry` 读取五个 pattern 的内容，拼成一页发布；
  - 返回页面 URL、pattern slug 列表和每个 pattern 的块名。
- `tests/bin/verify-components.mjs`：
  - 静态：`inc/components.php` 注册分类、入队 CSS、编辑器和前台都引用；五个 pattern 文件存在；
    CSS 有 `.yuki-note`、`.yuki-spec-table`、`.yuki-timeline`、`.yuki-evidence`、`.yuki-brief`；
    没有新增 JS。
  - PHP/HTTP：五个 pattern 均已注册；页面 200；五个组件 class 都出现在 HTML；CSS 已入队。
  - 无头 Edge：浅色 1440 下注记边框/标签、规格表列数、时间线节点、证据图卡、双栏并排；
    深色下卡片背景与文字可读；640px 下双栏堆叠、表格可横向滚动、页面无横向溢出；
    reduced-motion 下无新增动画。
- 既有 `verify-editor-styles` 必须继续通过（编辑器仍只有主题样式，不另立构建产物）。
- 第二批新增 `tests/bin/reading-fixtures.php` 与 `tests/bin/verify-reading.mjs`：
  - fixtures 造三篇同系列文章，其中一篇含 h2/h3；另造一篇无标题、无系列文章；
  - 静态检查脚本、分类、入队条件、单篇钩子；
  - 浏览器检查目录层级/默认展开/点击 hash/焦点/`aria-current`、进度 0→100、640px 折叠与无溢出、
    无标题不建目录、无系列不留空容器、reduced-motion 去掉进度过渡。
- 第三批新增 `tests/bin/site-modules-fixtures.php` 与 `tests/bin/verify-site-modules.mjs`：
  - fixtures 造 14 个标签和一篇管理员文章，返回首页/归档/文章 URL 与真实统计；支持 `--cleanup`；
  - 静态检查模板注册、页脚菜单位、enqueue、隐藏的 Gravatar 请求；
  - 浏览器检查标签墙收起/展开、空邮箱原生校验、桌面三列、640px 单列与无横向、归档数据条。

### 第三批 · 站点模块

- `inc/site-modules.php`：注册 `footer` 菜单位；入队 `assets/css/site-modules.css`
  （依赖 `yuki-components`）与 `assets/js/site-modules.js`（无依赖、footer）。
- `template-parts/site-stats.php`：复用 `yuki_production_stats()`，输出数据条；首页与归档共用，
  归档额外保留 entries 数。
- `template-parts/site-tag-wall.php`：`get_tags()` 全量输出；`<details open>` 默认展开，
  超过 12 项时由 JS 收起，无 JS 时完整显示；空站显示「暂无标签。」。
- `template-parts/site-author-card.php`：头像只在 host 是本站时输出，否则用姓名首字母方块；
  不请求 Gravatar/外部头像。
- `template-parts/site-subscribe.php`：沿用 `#newsletter` 的前端行为，邮箱 `required`，
  不接第三方服务。
- `template-parts/site-footer-links.php`：有 `footer` 菜单用菜单，否则站点/索引/关于三组兜底；
  分类为空时省略该组。
- 数据条、标签墙、作者卡、订阅卡落在 `sidebar.php`/`index.php`/`archive.php`/`footer.php`；
  B 外壳策略、正文 724px、侧栏 300px 不变。

## Out of Scope

- 自定义 Gutenberg 块、Inspector 控件、区块样式变体（本批用 pattern + core blocks）。
- 图标库、字体文件、构建工具。
- 自动迁移旧文章内容。

## Further Notes

- 第二批见 `issues/02-reading-components.md`。
- 第三批见 `issues/03-site-modules.md`。
- 第三批的站点模块在 2026-10-20 完成；数据条、标签墙、作者卡、订阅卡、页脚链接组
  都复用了第一批的标签/边框语法。
- 第一批提交前需要按 HEAD + 本次文件重建 POT（pattern 标题/描述若含 PHP 字符串才会计入）。
- 第二批的系列是**非公开分类**：作者在编辑器里归类，读者通过单篇导航移动；不新增系列归档页。
