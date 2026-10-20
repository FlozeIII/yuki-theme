# 整站 UI 重设计 · 数字档案

Status: ready-for-agent

## Problem Statement

主题在一轮纸面「设定资料集」之后，功能与结构已经齐了，但用户明确否决了纸质感：
他要的是**电脑上的档案**，参考 SCP 的信息组织方式，而不是一本印刷出来的制作圣经。
纸面版的暖纸、蓝图线、信号橙和「CHARACTER SHEET / EPISODE INDEX」虽然完整，却把
「二次元」误解成了编辑部物料；用户要的是临床、官僚、被审阅的数字文档：深色系统外壳、
浅色阅读面板、等宽元数据、权限/状态标记，长文仍然好读。

同时，整站不能退化成黑底绿字的终端，也不能复制 SCP 的标识、原文或具体故事。它应当是
Yuki 自己的个人档案系统：有站点状态、案件文件、角色档案、文档索引、文档编号、扇区与
权限标记，但所有内容仍然来自真实文章、分类和站点统计。

## Solution

把整站改成 **数字档案 / Archive Console**：

- 深色系统外壳承载状态栏、导航、首页 hero、归档/搜索 hero、404 与页脚；浅色文档面板
  承载单篇与静态页的阅读区。首页索引留在冷灰页面上，形成「系统 → 档案 → 文档」的层次。
- 生产信息栏改成系统状态栏：`YUKI ARCHIVE // SITE-01`、`PERSONAL RECORDS / CLEARANCE 02`、
  `BUILD 1.3.0 / 日期`；品牌仍是 Yuki 验证站与雪兔。
- 首页第一屏是 **CASE FILE 01**：左侧是站名、简介和真实统计（RECORDS / SECTORS / UPDATED），
  右侧是 **SUBJECT PROFILE**，把雪兔放进带十字定位线、图号、字段表的档案框。
- 文章列表是 **DOCUMENT INDEX**：每篇一条带编号的档案行，缩略图是证据板，分类徽章保留
  资料标签的旋转/虚线/季节胶带（旧验收要求），但表面改为冷白/深底。
- 单篇与静态页是 **DOCUMENT**：标题上方有 `DOCUMENT / SECTOR / STATUS` 档案条，特色图带
  `EVIDENCE / PLATE 01` 帧标；正文仍是 768px 列、侧栏 300px，文档面板宽度 1120px。
- 归档/搜索/404 沿用同一套语法：`RECORDS / BACK MATTER`、`RECORDS / SEARCH`、
  `FILE NOT FOUND`；侧栏是 `SYSTEM NOTES / ACCESS LOG`，页脚是 `ARCHIVE UPLINK`。
- 颜色：深色 void `#070B0F`、shell `#0B1217`、line `#263740`；cyan `#67C3D2`、
  red `#C04A42`、red-soft `#E4776A`；浅色文档 `#F1F5F6`、文档 ink `#162126`、
  doc muted `#4B5F68`、doc line `#BBC9CF`。`--yuki-background` 改成冷灰 `#DCE3E6` /
  黑 `#070C10`；正文/卡片/边框继续走既有 token。
- 字体：页面标题继续跟随自定义器字体设置；档案小标签/编号/状态用等宽栈
  `--yuki-font-mono`；中文正文继续 Noto Sans SC / PingFang SC / Microsoft YaHei；
  不引入外部字体请求或构建。
- 控件统一近直角、细边框、编号与短横线；卡片圆角从 16px 收敛到 2px，
  雪兔、头像和既有交互控件保留必要的圆形。
- 现有功能、宽度契约、无障碍语义、reduced-motion、深浅色切换、图片灯箱、代码块复制、
  评论增强、说说、一言、订阅、备案号全部保留。

## User Stories

1. 作为第一次访问的读者，我能在第一屏知道这是谁的系统、有多少份记录、最近更新在什么时候，
   并且能从一个明确的 DOCUMENT INDEX 开始读。
2. 作为长文读者，我能在单篇的浅色文档面板里舒服地读 768px 正文，不被装饰打断；
   标题、图注、侧栏仍然告诉我这是一份档案。
3. 作为作者，我发布一篇新文章后，RECORDS / UPDATED / DOCUMENT INDEX 会自动跟着变，
   不需要手工维护。
4. 作为使用深色模式的读者，我得到同一套档案语言：深色外壳、深色文档面、清晰的层级，
   而不是把浅色页面简单反色。
5. 作为键盘/读屏用户，导航、索引、标签、按钮仍有可读名称、焦点环和正确层级；
   减少动效时装饰不运动。
6. 作为站点所有者，我在自定义器里设置的强调色、字体、背景图和页头图仍然生效。
7. 作为维护者，我不需要构建步骤或新依赖；所有页面仍由 PHP 模板 + CSS 输出。

## Implementation Decisions

### 视觉与结构

- `assets/css/production-bible.css` 继续作为布局底座：生产信息栏、封面网格、角色档案、
  文档索引、filebar、侧栏头、订阅区、响应式。纸面颜色仍在这个文件里，但会被数字层覆盖。
- 新增 `assets/css/archive-console.css`，在 `production-bible.css` 之后加载，负责数字档案的
  颜色、表面、边框、字体语汇和局部结构；不重写布局网格。
- `inc/production-bible.php` 提供：
  - `yuki_production_body_class()`：加 `yuki-production-bible`。
  - `yuki_production_stats()`：真实统计（已发布文章数、非空分类数、最近发布日期），
    不伪造数据；无文章时回退为 0 和「—」。
  - `yuki_production_assets()`：在 `wp_enqueue_scripts` 上以 `yuki_asset_version()` 加载
    `production-bible.css` 与 `archive-console.css`，后者依赖前者和 `yuki-style`。
  - 在 `functions.php` 末尾显式 `require_once`，不扫目录。
- 保留所有现有测试钩子：`.yuki-hero.yuki-dot-pattern`、`.yuki-hero-petals`（仍 7 枚）、
  `.yuki-hero-title-row`、`.yuki-mascot--lg`、`.yuki-post-list`、`.yuki-post-item`、
  `.yuki-post-thumb img`、`.yuki-post-title`、`.yuki-cat-badge`、`.yuki-article-header`、
  `.yuki-article-main`、`.yuki-single-layout`、`.yuki-sidebar`、`.yuki-widget`、
  `.yuki-empty-state`、`.yuki-404`、`.yuki-code-copy`。
- 首页仍由 `index.php` 输出 hero，但重排为 12 栏封面：左 7 栏文字/统计，右 5 栏角色档案。
  窄屏叠成单列，角色档案放在文字之后。
- 文章列表改成档案行：CSS counter 生成 `01 / 02 …`，缩略图保留在 `.yuki-post-thumb`，
  但改成 4:3 的证据板；标题更大，摘要更短，分类徽章保留旋转/虚线/季节胶带。
- 单篇/页面标题区加 `.yuki-filebar`（DOCUMENT / SECTOR / STATUS），使用真实日期、分类和发布状态；
  `.yuki-article-header` 仍引用 `--yuki-content-width`，正文列宽度不变。
- 侧栏加 `.yuki-sidebar-head`，小工具改成 system notes 的版式；不改变小工具注册和回退逻辑。
- 归档/搜索 hero 加 `.yuki-hero-kicker` 与 `.yuki-hero-rule`；404 加 `FILE NOT FOUND` 标签。
- 页脚/订阅区使用同一套编号与细线，不加新功能。

### 颜色与 token

- 数字层新增 `--da-void`、`--da-shell`、`--da-shell-2`、`--da-line`、`--da-cyan`、
  `--da-red`、`--da-red-soft`、`--da-doc`、`--da-doc-ink`、`--da-doc-muted`、`--da-doc-line`。
- 不改既有 `--yuki-primary`、`--yuki-primary-600/700`、`--yuki-primary-foreground`、`--yuki-ring`
  的默认值；强调色自定义、`.yuki-btn`、`.yuki-cat-badge::before` 的既有验收继续成立。
- 不改 `--yuki-content-width: 768px`、`--yuki-wide-width: 1120px`、`--yuki-container-width: 1120px`、
  `--yuki-sidebar-width: 300px`、`--yuki-layout-gap: 48px`。
- **刻意改动**：`--yuki-background` 从暖白/深灰改为 `#DCE3E6` / `#070C10`，
  `--yuki-muted` 改为 `#E7EDEF` / `#18242B`，让评论区、说说、页脚和文档面板都落在同一套
  冷灰/黑系统里。相关断言已同步更新并写明理由。
- 深色模式使用 `.dark body.yuki-production-bible` 覆盖 `--da-*` 与页面底色；正文/卡片/边框
  继续走既有 token。
- 分类徽章的 `::before` 不覆盖颜色，继续使用 `var(--yuki-season)`；数字层只改徽章表面和边框。
  季节胶带是站点既有功能，不属于纸面残留。

### 字体与控件

- 不请求 Google Fonts；档案小标签/编号使用等宽栈 `--yuki-font-mono`（已有系统栈）。
- 页面 h1/h2 和正文标题继续跟随 `--yuki-font-sans/--yuki-font-serif/--yuki-font-round`，
  不把标题钉在等宽或窄体上；否则自定义器字体切换会失效，`verify-font` 也会红。
- 正文不用等宽；只有标签、编号、状态、日期、计数用等宽。
- 按钮/输入/分页统一 2px 圆角与 1px 冷色边；`.yuki-btn` 的底色/前景仍由 primary token 决定，
  只改形状与字距。
- 保留 `:focus-visible` 的 2px ring，不缩小点击目标。

### 可访问性与降级

- 装饰性编号、引线、网格全部用 CSS 或 `aria-hidden`；真实信息（记录数、日期、分类）用文本输出。
- 档案条不隐藏可读信息；如果标签只是装饰，加 `aria-hidden="true"`。
- `prefers-reduced-motion` 下不新增动画；已有花瓣/贴纸/卡片动效的收敛规则继续有效。
- 禁用 JS 时页面结构、导航、列表、正文、搜索全部可用；代码块复制按钮本来就没有服务端标记。
- 窄屏 640px 无横向滚动；角色档案、档案条、索引行都允许换行。
- 浅色文档面板上的正文/元数据、深色外壳上的状态/导航都要满足既有对比度与可读性；
  数字层不得把正文变成低对比的暗灰。

## Testing Decisions

- `tests/bin/verify-ui-redesign.mjs`（已从纸面版改写）：
  - 静态：`production-bible.css` + `archive-console.css` 存在、由 `inc/production-bible.php`
    入队、`archive-console` 依赖 `production-bible`、`--da-*` 存在、旧宽度 token 未改、
    关键选择器仍保留、数字文案已进 POT。
  - HTTP：首页有系统状态栏 / CASE FILE / SUBJECT PROFILE / DOCUMENT INDEX / 真实统计；
    单篇有 DOCUMENT / EVIDENCE；归档/搜索/404 有对应 kicker。
  - 无头 Edge：首页 1440 两栏、640 单栏且无横向溢出；浅色文档面 `rgb(241,245,246)`、
    深色文档面 `rgb(13,22,28)`、深色 body `rgb(7,12,16)`、生产条 `rgb(3,6,8)`；
    单篇正文列 722、侧栏 300；reduced-motion 下花瓣隐藏。
- 既有 28 个验收脚本必须继续全绿；特别是 `verify-editor-alignment`、`verify-motion`、
  `verify-stickers`、`verify-mascot`、`verify-hero-motion`、`verify-accent`、`verify-code-copy`、
  `verify-background`、`verify-screenshot`。其中 `verify-background` 与
  `verify-screenshot` 已按数字档案的双层表面更新期望。
- `wptk check` 0 error；POT 按 HEAD + 自己改的文件重建；`verify-package` 65/65。

## Out of Scope

- 不改主题版本号，不发版，不生成新的 release ZIP。
- 不改数据模型、不新增后台设置、不引入页面构建器或区块。
- 不改现有文章内容、不伪造站点统计、不更换雪兔 SVG 的几何。
- 不复制 SCP 的标识、原文、等级名称或具体故事；只借用「被审阅的数字档案」的信息组织方式。
- 不做同页多图灯箱切换、长文目录、阅读进度等 roadmap 功能。
- 不改评论提交/删除/点赞端点、说说发布端点、一言上游行为。
- 不为了视觉效果删除任何现有测试钩子；如确需调整测试，必须逐条说明理由。

## Further Notes

- 设计方向来自用户对纸面 J 的否决；用户原话是新方向「电脑上档案那种，参考 scp」，
  随后在选项中选定「深色控制台 + 浅色文档面板」。
- 纸面版提交 `14964e4` 保留在历史里，但不再代表当前方向；数字档案层覆盖它的颜色与文案，
  布局底座继续复用。
- 参考基线在 `ui-redesign/baseline/`；数字档案截图在临时目录，不提交截图产物。
- 共享文件（`functions.php`、`style.css`、`sidebar.php`、`languages/yuki.pot`）已在
  `.scratch/holds.md` 挂行；模板文件也一并挂行，避免并行会话撞车。
