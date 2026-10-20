# Yuki 设计规范

新会话/新工具迭代本主题时，遵循以下 Token，保持风格一致。

2026-10-20 起，整站方向从「纸面设定资料集」改为 **数字档案 / Archive Console**：
浅色主题下外壳跟随页面、深色主题下是深色控制台，文档面板始终是浅色阅读面。
参考 SCP 的信息组织方式，但不复制其标识、原文或故事。纸面 token 与暖纸截图已退出当前规范，
历史见 `.scratch/ui-redesign/spec.md` 与提交 `14964e4`。

## 色彩

| Token | 浅色 | 深色 |
| --- | --- | --- |
| 主色 --yuki-primary | #A5B4FC | #A5B4FC |
| 主色 hover --yuki-primary-600 | #818CF8 | #818CF8 |
| 主色深 --yuki-primary-700 | #6366F1 | #6366F1 |
| 背景 --yuki-background | #DCE3E6（冷灰页面） | #070C10（系统黑） |
| 前景 --yuki-foreground | #182126 | #D7E0E4 |
| 卡片 --yuki-card | #FFFFFF | #111A20 |
| 弱化面 --yuki-muted | #E7EDEF | #18242B |
| 弱化文字 --yuki-muted-foreground | #52666F | #93A5AD |
| 边框 --yuki-border | #C7D2D7 | #293841 |
| 正文 --yuki-ink-2 | #3F525B | #B2C0C7 |
| 辅助文字 --yuki-ink-3 | #6A7C85 | #7F929B |

- 主色只承担链接、按钮、焦点环和强调色自定义；数字档案的 cyan 是状态色，不替代主色。
- 深色模式不是纯黑外壳，但 body 基底是 `#070C10`；状态栏/导航比 body 更深，形成系统层次。
- 浅色模式的外壳不再固定深色：状态栏、导航、首页/归档 hero 跟随冷灰页面变浅（见下文 B 方案）。
- 站主可在自定义器里覆盖强调色；主题会自动推导 hover 档与按钮前景色。本表记录的是默认值。

### 数字档案层（Archive Console）

整站布局底座由 `assets/css/production-bible.css` 提供，数字表面由
`assets/css/archive-console.css` 覆盖；两者都在 `style.css` 之后加载，`body` 带
`yuki-production-bible`。这些 token 只负责系统外壳、文档面板与状态标记，不替代交互主色。

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--da-void` | #070B0F | #070B0F | 系统最深处/背景 |
| `--da-shell` | #0B1217 | #0B1217 | 页脚、侧栏与深色模式外壳 |
| `--da-shell-2` | #111B21 | #111B21 | 外壳上的次级块 |
| `--da-line` | #263740 | #263740 | 外壳分隔线 |
| `--da-cyan` | #67C3D2 | #67C3D2 | 系统状态/索引眉标 |
| `--da-red` | #C04A42 | #C04A42 | 缺失、编号、状态方块 |
| `--da-red-soft` | #E4776A | #E4776A | 深色外壳上的红色文字 |
| `--da-doc` | #F1F5F6 | #0D161C | 单篇/静态页文档面板 |
| `--da-doc-ink` | #162126 | #D8E2E6 | 文档面板标题/正文 |
| `--da-doc-muted` | #4B5F68 | #93A5AD | 文档面板元数据 |
| `--da-doc-line` | #BBC9CF | #293841 | 文档面板分隔线 |

- 深色模式是「系统外壳 + 文档」两套表面；浅色模式把状态栏/导航/hero 也交给页面冷灰，
  只保留文档面板、侧栏与页脚的深色块。正文永远落在文档面板上。
- 小字号状态/标签优先用 cyan/red-soft，并保证在 shell 上 ≥4.5:1；正文用 doc-ink/doc-muted。
- 分类徽章的季节胶带继续用 `var(--yuki-season)`；数字层只改徽章表面和边框，不覆盖胶带颜色。

### 外壳主题策略（B，2026-10-20）

用户在 A/B/C 对比中选 B：顶部外壳跟随主题，避免「切了主题但第一屏没变」。

| 表面 | 浅色 | 深色 |
| --- | --- | --- |
| 状态栏 | `#E7EDEF` | `#030608` |
| 导航 | `rgba(241,245,246,.96)` | `rgba(9,15,19,.96)` |
| 首页/归档 hero | `#DCE3E6` | `#0A1116` |
| 文档面板 | `#F1F5F6` | `#0D161C` |
| 侧栏 / 页脚 | 仍为深色 `#0B1217` / `#05090C` | 同左 |

- 浅色下状态条/导航文字用 `#162126` / `#3F525B`，状态用 `#1C6B7A` / `#A94A25`；
  深色下保持 cyan/red-soft。
- 侧栏和页脚仍保留深色块，像档案夹的封底与边注；不要把它们也刷成浅色。
- 该覆盖只写在 `archive-console.css`，不要再改 `style.css` 的全局 token。

### 季节点缀

| `--yuki-season` | 值 |
| --- | --- |
| 春 | #F2A6C2 |
| 夏 | #7CC7E8 |
| 秋 | #E8A33D |
| 冬 | #A5B4FC（主色） |

- 按站点时区的月份自动切换（3–5 春、6–8 夏、9–11 秋、其余冬）。
- **只用于装饰**：雪兔的耳朵/脸颊/围巾、分类标签的胶带。正文、链接、按钮、主题开关仍用
  `--yuki-primary`，不随季节变。

## 布局

| Token | 值 | 用途 |
| --- | --- | --- |
| `--yuki-content-width` | 768px | 窄栏容器外宽（含左右 24px 内边距） |
| `--yuki-wide-width` | 1120px | 宽对齐能达到的最大宽度 |
| `--yuki-container-width` | 1120px | 页面容器外宽（首页、单篇外层，含左右 24px 内边距） |
| `--yuki-sidebar-width` | 300px | 单篇侧栏 |
| `--yuki-layout-gap` | 48px | 单篇主列与侧栏的间距 |
| `--yuki-gutter` | 24px | 容器左右内边距；编辑器画布宽 = 768 − 2×24 = 720px |

- 单篇文档面板外宽 1120px、内边距 24px；内部主列约 722px、侧栏 300px，`filebar` 与
  `.yuki-article-header` 左对齐到 772px。宽对齐在有侧栏的布局里退化为正文列宽；
  只有 `page.php` 这类无侧栏模板才会突破到 1120px。**这是刻意的，不是缺陷。**
- 首页在浅色主题下是冷灰 hero + 冷灰索引页，深色主题下是深色 hero + 深色索引；
  单篇在两种主题下都是文档面板（浅色底，深色主题为深文档面），两者共用 1120px 容器。
- 编辑器画布按正文文字宽约 720px 预览；页面里的 1120px 宽块在编辑器里按 720px 显示。

## 浮层

| Token | 浅色 | 深色 |
| --- | --- | --- |
| `--yuki-overlay-backdrop` | rgba(24, 24, 31, 0.92) | rgba(24, 24, 31, 0.92) |
| `--yuki-overlay-foreground` | #F3F0EA | #F3F0EA |

- 遮罩是一块**深色舞台**，浅色与深色模式共用同一套；不用纯黑。
- 控件与图注用 `--yuki-overlay-foreground`。图注优先用 `figcaption`，没有就用 `alt`。
- 第一次引入浮层表面：图片灯箱。后续浮层引用这两个 token，不另造颜色。

## 圆角 / 阴影

- 数字档案层：卡片/文档面板/输入/按钮/标签统一 2px，只有头像、雪兔和主题开关保留圆形。
- 旧契约的空状态气泡仍保留 16px 圆角与白卡，避免破坏 `verify-stickers`；这是唯一例外。
- 旧交互控件（主题开关、灯箱关闭按钮）保留原有 pill/圆形，不为了统一而缩成直角。
- 阴影极轻（alpha ≤ 0.12），hover 只上浮 1px；档案行 hover 只换底色，不做卡片浮起。

## 组件签名

- **系统状态栏**：顶部细条，左侧 `YUKI ARCHIVE // SITE-01`，中间 `PERSONAL RECORDS /
  CLEARANCE 02`，右侧 `BUILD 1.3.0 / 日期`；等宽字、青色状态、红色短分隔。
  浅色主题下整条为 `#E7EDEF`，深色主题下为 `#030608`。
- **文章列表**：宽屏四列 `42px 编号 / 144px 证据板 / 正文 / 170px 分类与日期`，项间 1px
  冷色分隔线；无缩略图时显示 `NO KEY FRAME` 虚线框。640px 以下收成三列，分类/日期落到正文下方。
- **首页封面**：7fr 文字 + 5fr 角色档案；左侧 `CASE FILE 01 / PERSONAL ARCHIVE`、标题、
  简介、RECORDS/SECTORS/UPDATED；右侧 `SUBJECT PROFILE`（雪兔 + 十字定位线 + 字段表）。
- **单篇**：`DOCUMENT / SECTOR / STATUS` 档案条与正文列左对齐，正文约 722px，侧栏 300px；
  featured 图下沿有 `EVIDENCE / PLATE 01` 帧标。
- **归档/搜索/404**：`RECORDS / BACK MATTER`、`RECORDS / SEARCH`、`FILE NOT FOUND`；
  外壳随主题、红色状态、等宽元数据；404 保留雪兔与搜索。
- **系统点缀**：状态栏、眉标、编号、虚线胶带、细冷色线。`.yuki-dot-pattern` 与
  `.yuki-soft-frame` 作为旧钩子保留，但首页不再显示圆点纹理。

## 字体

- 正文 15–16px / line-height 1.7；标题跟随自定义器的字体设置，不固定窄体或等宽。
- 只有数字档案的小标签、编号、状态、日期、计数使用等宽栈 `--yuki-font-mono`。
- 字体栈："Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui。
- 站主可在自定义器切换字体风格：无衬线（默认）/ 衬线 / 圆体。三套都是系统字体栈；
  代码块仍用独立的等宽栈。
