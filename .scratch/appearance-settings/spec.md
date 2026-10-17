# 外观设置

Status: ready-for-agent
Type: spec

## Problem Statement

主题的外观今天是固定的：背景、页头、主色、字体都由 `DESIGN.md` 与 `style.css` 决定。站主想换成
自己的背景图或页头图、换一枚强调色、换一套字体，只能改代码。

这不违背**极简线**——它是站主自己的表达；但要守住「氛围不能盖过可读性」，所以每一项都要有
主题提供的护栏，而不是把一个原始设置直接倒给用户。

## Solution

分四批把四类外观设置接进 WordPress 原生自定义器，每批单独验收：

1. **背景图 + 背景色**：原生 `custom-background`；有背景图时加一层跟随深浅色的蒙层，强度可调。
2. **页头图**：原生 `custom-header`；图出现在头部，无图时布局不变。
3. **强调色**：一枚主色替换 `--yuki-primary` 及其深浅变体；链接、按钮、开关随之变化。
4. **字体切换**：在几套**系统字体栈**之间切换；不引外部字体（主机在境内，外部字体不可靠）。

## User Stories

1. 作为站主，我希望在后台自定义器里上传一张全站背景图，不用改代码。
2. 作为站主，我希望只设背景色也能生效，不被主题的蒙层冲淡。
3. 作为站主，我希望背景图的蒙层强度可以调，默认就能保持正文可读。
4. 作为访客，我希望换成背景图之后正文仍然清楚，深浅色都成立。
5. 作为站主，我希望能换页头图、强调色与字体（后续三批）。

## Implementation Decisions

### 第一批：背景图 + 蒙层（已实现）

- `add_theme_support( 'custom-background' )`，**不设 `default-color`**：设了之后核心会在没选背景时
  也输出浅色底，覆盖深色模式。
- 有背景图时由 `body_class` 加 `yuki-has-background-image`；只设背景色时不加。
- 蒙层：`body.yuki-has-background-image::before`，`position: fixed; inset: 0; z-index: -1;`
  `background: var(--yuki-background)`，`opacity: var(--yuki-bg-scrim)`，`pointer-events: none`。
  浅色是暖白、深色是堇紫黑，自动跟随。
- 自定义器里在核心的「背景图像」一节加一个 `range` 滑杆 `yuki_background_scrim`：
  0–100、默认 80、步长 5；`sanitize_callback` 夹在 0–100。
- 滑杆值通过 `wp_add_inline_style()` 输出成 `--yuki-bg-scrim`；CSS 的默认值是 `.8`。
- 自定义器回调改到 `customize_register` 优先级 20——核心的「背景图像」一节要先注册出来。

### 第二批：页头图（已实现）

- 原生 `custom-header`；图以**全宽横幅**放在导航上方，不链接；无图时不输出标记，布局不变。
- `width` 1600 / `height` 500、`flex-height`、`flex-width`；`header-text` 关掉。
- CSS 兜底：宽度铺满、最高 420px（窄屏 220px）、`object-fit: cover`。

### 第三批：强调色（已实现）

- 自定义器「颜色」一节加 color control `yuki_accent`，默认展示主题堇紫 `#A5B4FC`；
  **留空不产生覆盖**，主题保持原样。
- 输出 `:root,.dark { … }`，覆盖 `--yuki-primary`、`--yuki-primary-600/700`、
  `--yuki-primary-foreground`、`--yuki-ring`。
- hover 档由 `color-mix(in srgb, 强调色 82%/64%, #000)` 自动压深；按钮文字按亮度自动选
  深墨 `#0F0F14` 或暖白 `#F3F0EA`。
- 季节点缀色 `--yuki-season` 不受影响：它只染雪兔与贴纸胶带。

### 第四批：字体切换（已实现）

- 自定义器「Yuki 字体设置」下拉：无衬线（默认）/ 衬线 / 圆体；三档白名单。
- 选择输出成 `--yuki-font-sans`，正文与标题一起换；`sans` 不输出覆盖。
- 三套都是系统字体栈，不引外部字体；代码块仍用独立的 `--yuki-font-mono`。

### 明确不做的

- 不做访客级的外观偏好。
- 不引外部字体、外部图片或第三方上传服务。
- 不让背景图/页头图/强调色破坏正文可读性。

## Testing Decisions

### Seam

HTTP + 真浏览器；外观设置是全站 theme mod，测试必须**读原值、设临时值、验完恢复**，并删除测试附件。

### 要测的模块（第一批）

- 有背景图时 `body` 带 `yuki-has-background-image` 与核心的 `custom-background`。
- 蒙层的 `opacity` 等于滑杆值；浅色/深色背景色正确；`fixed`、`pointer-events: none`、`z-index: -1`。
- 滑杆取值夹在 0–100。
- 没有背景图时不挂蒙层（类名过滤 + 静态断言）；深色模式不被默认色覆盖。

### 明确不测什么

- 自定义器 UI 的拖拽/预览（核心行为）。
- 用户上传图片的内容本身。
- 后三批——各自批次再测。

## Out of Scope

- 页头图、强调色、字体切换（后续批次）。
- 访客级外观偏好。
- 外部字体与图片托管。

## Further Notes

- **共享文件**：`functions.php`、`style.css`、`languages/yuki.pot`。开工前挂 `.scratch/holds.md`。
- **记录反转**：`release-prep` 的 04/06 曾把 `custom-background` 判为「加了比不加差」；站主这次
  明确要背景图，06 已追加更正。再看到旧结论时以本条为准。
- theme mod 是全站状态；测试用 transient 存原值，`finally` 里恢复。
