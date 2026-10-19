# Yuki 设计规范

新会话/新工具迭代本主题时，遵循以下 Token，保持风格一致。

## 色彩

| Token | 浅色 | 深色 |
| --- | --- | --- |
| 主色 --yuki-primary | #A5B4FC | #A5B4FC |
| 主色 hover --yuki-primary-600 | #818CF8 | #818CF8 |
| 主色深 --yuki-primary-700 | #6366F1 | #6366F1 |
| 背景 --yuki-background | #EDE8DC（纸面） | #0F1720（深夜工作台） |
| 前景 --yuki-foreground | #2D2D35 | #F3F0EA |
| 卡片 --yuki-card | #FFFFFF | #22222B |
| 弱化面 --yuki-muted | #F3F0EA | #2A2A35 |
| 边框 --yuki-border | #E8E5DF | #3A3A47 |

- 主色调象征「雪与暮色」，正文永远用 --yuki-ink-2 (#5C5C6D)，保持低对比柔和感。
- 深色模式不是纯黑，是带蓝墨倾向的 #0F1720。
- 站主可在自定义器里覆盖强调色；主题会自动推导 hover 档与按钮前景色。本表记录的是默认值。

### 设定资料集层（J）

整站视觉由 `assets/css/production-bible.css` 提供，在 `style.css` 之后加载；
`body` 带 `yuki-production-bible`。这些 token 只负责「制作资料集」的纸面、蓝图线和
信号色，不替代上面的交互主色。

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--yuki-paper` | #EDE8DC | #0F1720 | 纸面/工作台底色 |
| `--yuki-paper-deep` | #E3DCCB | #0A1118 | 页脚带、次级纸面 |
| `--yuki-plate` | #F7F3EA | #15212B | 设定卡/侧栏 note |
| `--yuki-blueprint` | #1F3A5F | #9FB8C8 | 标题、档案线、深色条 |
| `--yuki-blueprint-soft` | #4F6579 | #8FA6B5 | 眉标、日期、辅助文字（≥4.5:1） |
| `--yuki-signal` | #D96C3B | #E08A5B | 胶带、色块、装饰线 |
| `--yuki-signal-ink` | #A94A25 | #E08A5B | 小字号信号文字（≥4.5:1） |
| `--yuki-ice` | #9FB8C8 | #B9CEDB | 深色条上的冷色文字 |

- 蓝图蓝是「生产信息」，信号橙是「标记/状态」；两者都不承担链接和按钮语义。
- 交互仍用 `--yuki-primary`、`--yuki-ring`，强调色自定义继续生效。
- 小字号不要直接用 `--yuki-signal`：浅色纸面上对比度不足，用 `--yuki-signal-ink`。

### 季节点缀

| `--yuki-season` | 值 |
| --- | --- |
| 春 | #F2A6C2 |
| 夏 | #7CC7E8 |
| 秋 | #E8A33D |
| 冬 | #A5B4FC（主色） |

- 按站点时区的月份自动切换（3–5 春、6–8 夏、9–11 秋、其余冬）。
- **只用于装饰**：雪兔的耳朵/脸颊/围巾、分类贴纸的胶带。正文、链接、按钮、主题开关仍用
  `--yuki-primary`，不随季节变。

## 布局

| Token | 值 | 用途 |
| --- | --- | --- |
| `--yuki-content-width` | 768px | 窄栏容器外宽（含左右 24px 内边距）；正文文字宽约 720px |
| `--yuki-wide-width` | 1120px | 宽对齐能达到的最大宽度 |
| `--yuki-container-width` | 1120px | 页面容器外宽（首页、单篇外层，含左右 24px 内边距） |
| `--yuki-sidebar-width` | 300px | 单篇侧栏 |
| `--yuki-layout-gap` | 48px | 单篇主列与侧栏的间距 |
| `--yuki-gutter` | 24px | 容器左右内边距；编辑器画布宽 = 768 − 2×24 = 720px |

- 单篇主列 = 容器内容宽 1072 − 300 − 48 = **724px**。宽对齐在**有侧栏**的布局里退化为正文列宽；
  只有 `page.php` 这类无侧栏模板才会突破到 1120px。**这是刻意的，不是缺陷。**
- 编辑器画布按正文文字宽约 720px 预览（工单 02）；页面里的 1120px 宽块在编辑器里按 720px 显示。

## 浮层

| Token | 浅色 | 深色 |
| --- | --- | --- |
| `--yuki-overlay-backdrop` | rgba(24, 24, 31, 0.92) | rgba(24, 24, 31, 0.92) |
| `--yuki-overlay-foreground` | #F3F0EA | #F3F0EA |

- 遮罩是一块**深色舞台**，浅色与深色模式共用同一套；不用纯黑。
- 控件与图注用 `--yuki-overlay-foreground`。图注优先用 `figcaption`，没有就用 `alt`。
- 第一次引入浮层表面：图片灯箱。后续浮层引用这两个 token，不另造颜色。

## 圆角 / 阴影

- 资料集层：卡片/设定框 2px、输入 2px、按钮/标签 2px；只有头像、雪兔和主题开关保留圆形。
- 旧交互控件（主题开关、灯箱关闭按钮）保留原有 pill/圆形，不为了统一而缩成直角。
- 阴影极轻（alpha ≤ 0.12），hover 只上浮 1px；档案行 hover 只换底色，不做卡片浮起。

## 组件签名

- **主题开关**：60×30 pill，左侧太阳/右侧月亮灰提示图标，24px 圆形滑块，0.35s cubic-bezier(0.45,0,0.2,1) 滑动；滑块内图标浅色=太阳(橙 #E8A33D)、深色=月亮(紫 #6366F1)。
- **文章列表**：宽屏四列 `42px 编号 / 144px key frame / 正文 / 170px 分类与日期`，项间 1px 蓝图分隔线；无缩略图时显示 `NO KEY FRAME` 虚线框。640px 以下收成三列，分类/日期落到正文下方。
- **首页封面**：7fr 文字 + 5fr 角色设定；左侧 FILE 01 / 标题 / 简介 / 真实统计，右侧 CHARACTER SHEET（雪兔 + 十字定位线 + 规格表）。
- **单篇**：FILE / SCENE / STATUS 档案条与正文列左对齐，正文 724px，侧栏 300px；featured 图下沿有 `KEY VISUAL / FRAME 01` 帧标。
- **资料集点缀**：生产信息栏、眉标、编号、虚线胶带、细蓝图线。`.yuki-dot-pattern` 与 `.yuki-soft-frame` 作为旧钩子保留，但首页不再显示圆点纹理。

## 字体

- 正文 15–16px / line-height 1.7；标题跟随自定义器的字体设置，不再固定窄体。
- 只有资料集层的小标签、编号、档案条使用窄体/等宽组合：
  `"Oswald", "Archivo Narrow", "Arial Narrow", "Roboto Condensed", sans-serif`。
- 字体栈："Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui。
- 站主可在自定义器切换字体风格：无衬线（默认）/ 衬线 / 圆体。三套都是系统字体栈；
  代码块仍用独立的等宽栈。
