# 整站 UI 重设计 · 设定资料集

Status: ready-for-agent

## Problem Statement

当前主题能把内容排清楚，但视觉语言仍然停在「模型默认的深色 + 堇紫 + 圆角卡片」：
首页是居中的大标题加雪兔、点阵背景、渐变缩略图与贴纸分类；单篇与关于页是标准的
768px 文章列加 300px 侧栏卡片。功能完整，但整站缺少一个只属于 Yuki 的、能被一眼认出的
世界观。用户要的「二次元」不是再加贴纸或萌系日常，而是让站点本身像一份不存在的动画的
制作资料集：有档案编号、角色设定、话数索引、制作注记和清晰的版面规则，同时长文仍然好读。

## Solution

把整站改成 **J · 设定资料集 / Production Bible**：

- 纸面与蓝图：暖纸底色 + 极淡的工程网格，深色模式是深夜工作台（墨蓝纸面 + 冷蓝网格）。
- 顶部一条生产信息栏，导航像资料集的页签；品牌仍保留站名与「雪兔」。
- 首页第一屏变成 **FILE 01** 封面：左侧是站名、简介和真实站点统计（话数 / 分类 / 最近更新），
  右侧是 **CHARACTER SHEET**，把雪兔放进带十字定位线、尺寸标注和规格引线的角色设定框。
- 文章列表变成 **EPISODE INDEX**：每一篇是一条带话数编号的档案行，缩略图作为 key frame，
  分类徽章保留为资料标签，不再像彩色贴纸墙。
- 单篇是 **SCENE / FILE** 页面：标题上方有档案条，正文列保持 768px，侧栏是 production notes；
  正文本身保持干净，只在标题、分隔线、图注和标签上使用资料集语法。
- 关于页、归档、搜索、404 与页脚沿用同一套「生产信息 / 档案 / 帧」语言，不新增另一套视觉。
- 颜色：纸 `#EDE8DC`、蓝图蓝 `#1F3A5F`、信号橙 `#D96C3B`、冰蓝 `#9FB8C8`；
  深色 `#0F1720`。正文仍用既有 ink 层，交互仍用 `--yuki-primary` 与焦点环，
  避免破坏强调色自定义和已有可访问性测试。`--yuki-background` 本身改成纸面/工作台色，
  这样评论区、说说、截图和页脚带与 J 的纸面一致。
- 字体：资料集小标签/编号用窄体系统栈（Oswald / Archivo Narrow / Arial Narrow 回退），
  页面标题跟随自定义器的字体设置；中文正文继续用 Noto Sans SC / PingFang SC /
  Microsoft YaHei；不引入外部字体请求或构建。
- 控件统一为 2px 直角/近直角、细边框、编号与短横线；卡片圆角从 16px 收敛到 2–6px，
  只有雪兔、头像和既有交互控件保留必要的圆形。
- 现有功能、宽度契约、无障碍语义、reduced-motion、深浅色切换、图片灯箱、代码块复制、
  评论增强、说说、一言、订阅、备案号全部保留。

## User Stories

1. 作为第一次访问的读者，我能在第一屏知道这是谁的地方、有多少话、最近更新在什么时候，
   并且能从一个明确的 EPISODE INDEX 开始读。
2. 作为长文读者，我能在单篇里舒服地读 768px 正文，不被装饰打断；标题、图注和侧栏
   仍然告诉我这是一份资料集。
3. 作为作者，我发布一篇新文章后，首页话数、最近更新和索引会自动跟着变，不需要手工维护。
4. 作为使用深色模式的读者，我得到同一套资料集语言，而不是把浅色页面简单反色。
5. 作为键盘/读屏用户，导航、索引、标签、按钮仍有可读的名称、焦点环和正确层级；
   减少动效时装饰不运动。
6. 作为站点所有者，我在自定义器里设置的强调色、字体、背景图和页头图仍然生效。
7. 作为维护者，我不需要构建步骤或新依赖；所有页面仍由 PHP 模板 + CSS 输出。

## Implementation Decisions

### 视觉与结构

- 新增 `assets/css/production-bible.css`，在 `style.css` 之后加载。旧样式保留，作为基础契约
  和测试的稳定锚点；新文件负责整站覆盖与新增组件。这样避免把 1100 行共享 CSS 大改，
  也避免与并行会话冲突。
- `inc/production-bible.php` 提供：
  - `yuki_production_body_class()`：加 `yuki-production-bible`。
  - `yuki_production_stats()`：真实统计（已发布文章数、非空分类数、最近发布日期），
    不伪造数据；无文章时回退为 0 和「—」。
  - `yuki_production_assets()`：在 `wp_enqueue_scripts` 上以 `yuki_asset_version()` 加载新 CSS。
  - 在 `functions.php` 末尾显式 `require_once`，不扫目录。
- 保留所有现有测试钩子：`.yuki-hero.yuki-dot-pattern`、`.yuki-hero-petals`（仍 7 枚）、
  `.yuki-hero-title-row`、`.yuki-mascot--lg`、`.yuki-post-list`、`.yuki-post-item`、
  `.yuki-post-thumb img`、`.yuki-post-title`、`.yuki-cat-badge`、`.yuki-article-header`、
  `.yuki-article-main`、`.yuki-single-layout`、`.yuki-sidebar`、`.yuki-widget`、
  `.yuki-empty-state`、`.yuki-404`。
- 首页仍由 `index.php` 输出 hero，但重排为 12 栏封面：左 7 栏文字/统计，右 5 栏角色设定。
  窄屏叠成单列，角色设定放在文字之后。
- 文章列表改成档案行：CSS counter 生成 `01 / 02 …`，缩略图保留在 `.yuki-post-thumb`，
  但改成 4:3 的 key frame 框；标题更大，摘要更短，分类徽章保留贴纸的旋转/虚线/胶带
  （测试要求），但用纸色和蓝图线让它像资料标签。
- 单篇/页面标题区加 `.yuki-filebar`（FILE / SCENE / STATUS），使用真实日期、分类和发布状态；
  `.yuki-article-header` 仍引用 `--yuki-content-width`，正文列宽度不变。
- 侧栏加 `.yuki-sidebar-head`，小工具改成 production notes 的版式；不改变小工具注册和回退逻辑。
- 归档/搜索 hero 加 `.yuki-hero-kicker` 与 `.yuki-hero-rule`；404 加缺失帧标签。
- 页脚/订阅区使用同一套编号与细线，不加新功能。

### 颜色与 token

- 新增 token：`--yuki-paper`、`--yuki-paper-deep`、`--yuki-blueprint`、`--yuki-blueprint-soft`、
  `--yuki-signal`、`--yuki-signal-ink`、`--yuki-ice`、`--yuki-grid-line`、`--yuki-plate`。
- 不改既有 `--yuki-primary`、`--yuki-primary-600/700`、`--yuki-primary-foreground`、`--yuki-ring`
  的默认值；强调色自定义、`.yuki-btn`、`.yuki-cat-badge::before` 的既有验收继续成立。
- 不改 `--yuki-content-width: 768px`、`--yuki-wide-width: 1120px`、`--yuki-container-width: 1120px`、
  `--yuki-sidebar-width: 300px`、`--yuki-layout-gap: 48px`。
- 保留 `--yuki-muted` 的浅色值 `#F3F0EA`（列表 hover 验收依赖它）；J 的纸面用新 token。
- **刻意改动**：`--yuki-background` 从 `#FDFBF7/#18181F` 改为 `#EDE8DC/#0F1720`。
  这不是顺手改色：评论区、说说、页脚带、截图和 `--yuki-paper` 必须共用同一张纸，
  否则整站会分成「新封面」和「旧内容」两层。相关断言已同步更新并写明理由。
- 深色模式新增 `--yuki-paper: #0F1720`、`--yuki-grid-line` 等覆盖；正文/卡片/边框继续走既有 token。

### 字体与控件

- 不请求 Google Fonts；资料集小标签/编号使用
  `"Oswald", "Archivo Narrow", "Arial Narrow", "Roboto Condensed", sans-serif`，
  中文回退到现有 sans 栈。若系统没有窄体，用字距、字号和短横线保持资料集语调。
- 页面 h1/h2 和正文标题继续跟随 `--yuki-font-sans/--yuki-font-serif/--yuki-font-round`，
  不把标题钉在窄体上；否则自定义器字体切换会失效，`verify-font` 也会红。
- 标签/编号使用等宽栈 `--yuki-font-mono`；正文不用等宽。
- 按钮/输入/分页统一 2px 圆角与 1px 蓝图边；`.yuki-btn` 的底色/前景仍由 primary token 决定，
  只改形状与字距。
- 保留 `:focus-visible` 的 2px ring，不缩小点击目标。

### 可访问性与降级

- 装饰性编号、引线、网格全部用 CSS 或 `aria-hidden`；真实信息（话数、日期、分类）用文本输出。
- 档案条不隐藏可读信息；如果标签只是装饰，加 `aria-hidden="true"`。
- `prefers-reduced-motion` 下不新增动画；已有花瓣/贴纸/卡片动效的收敛规则继续有效。
- 禁用 JS 时页面结构、导航、列表、正文、搜索全部可用；代码块复制按钮本来就没有服务端标记。
- 窄屏 640px 无横向滚动；角色设定、档案条、索引行都允许换行。

## Testing Decisions

- 新增 `tests/bin/verify-ui-redesign.mjs`：
  - 静态：新 CSS 存在、由 `inc/production-bible.php` 入队并依赖 `yuki-style`、J token 存在、
    旧宽度 token 未改、关键选择器仍保留、新文案已进 POT。
  - HTTP：首页有生产信息栏/CHARACTER SHEET/EPISODE INDEX/真实统计；单篇有 filebar；
    归档/搜索/404 有对应 kicker；深色/浅色都输出同一结构。
  - 无头 Edge：首页 1440/900 两栏、640px 单栏且无横向溢出；角色设定与索引可见；
    列表仍能被 `homepage.mjs` 的观察点识别；单篇正文列 724、侧栏 300；
    深色 token 生效；reduced-motion 下不新增运动。
- 既有 28 个验收脚本必须继续全绿；特别是 `verify-editor-alignment`、`verify-motion`、
  `verify-stickers`、`verify-mascot`、`verify-hero-motion`、`verify-accent`、`verify-code-copy`。
- `wptk check` 0 error；POT 按 HEAD + 自己改的文件重建；`verify-package` 65/65。

## Out of Scope

- 不改主题版本号，不发版，不生成新的 release ZIP。
- 不改数据模型、不新增后台设置、不引入页面构建器或区块。
- 不改现有文章内容、不伪造站点统计、不更换雪兔 SVG 的几何。
- 不做同页多图灯箱切换、长文目录、阅读进度等 roadmap 功能。
- 不改评论提交/删除/点赞端点、说说发布端点、一言上游行为。
- 不为了视觉效果删除任何现有测试钩子；如确需调整测试，必须逐条说明理由。

## Further Notes

- 设计方向来自用户在 A–L 中选定的 J；J 的目标是「二次元在世界观和界面语言里」，
  而不是把雪兔和贴纸堆得更多。
- 参考基线在 `ui-redesign/baseline/`，新截图放 `ui-redesign/after/`，不提交截图产物。
- 共享文件（`functions.php`、`style.css`、`sidebar.php`、`languages/yuki.pot`）已在
  `.scratch/holds.md` 挂行；模板文件也一并挂行，避免并行会话撞车。
