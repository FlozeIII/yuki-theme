# 01: 可换全站背景图，蒙层强度可调

**What to build:** 在自定义器里支持全站背景图与背景色（原生 `custom-background`）；有背景图时
主题加一层跟随深浅色的蒙层，强度用一个 0–100 的滑杆调，默认 80。只设背景色时不加蒙层。

**护栏。** 蒙层用 `var(--yuki-background)`，浅色暖白、深色堇紫黑；正文卡片保持不透明；
`pointer-events: none`，不挡点击；`z-index: -1`，在内容之下。

**不设默认色。** 设了 `default-color` 核心会在没选背景时也输出浅色底，覆盖深色模式。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `88d3e47`）。

- [x] 自定义器「背景图像」一节有图片/颜色控件
- [x] 有背景图时 `body` 带 `yuki-has-background-image` 与 `custom-background`
- [x] 只设背景色时不挂蒙层
- [x] 蒙层强度滑杆 0–100、默认 80、步长 5，取值夹取
- [x] 蒙层浅色暖白、深色堇紫黑，`fixed`、`pointer-events: none`、`z-index: -1`
- [x] 没有背景图时深色模式不被默认色覆盖
- [x] 自定义器回调优先级 20，确保核心的「背景图像」一节已注册
- [x] 文案走 `__()`，`yuki.pot` 按 HEAD + 本件文件重建
- [x] HTTP 与真浏览器断言覆盖蒙层强度、深浅色、位置与点击穿透
- [x] 测试读原 theme mod、验完恢复并删除测试附件

## Comments

### 实现

- **支持**：`add_theme_support( 'custom-background' )`，**不设 `default-color`**。设了之后核心会在
  没选背景时也输出浅色底，覆盖深色模式——这一条是实测踩出来的。
- **有图才加蒙层**：`body_class` 过滤里用 `get_background_image()` 判断，加
  `yuki-has-background-image`；只设背景色时不加，避免把用户选的颜色冲淡。
- **蒙层**：`body.yuki-has-background-image::before`，`position: fixed; inset: 0; z-index: -1;`
  `background: var(--yuki-background)`，`opacity: var(--yuki-bg-scrim)`，`pointer-events: none`。
- **滑杆**：`customize_register` 里在核心的「背景图像」一节加 `range` 控件
  `yuki_background_scrim`（0–100、默认 80、步长 5），`sanitize_callback` 夹取。
  自定义器回调改到优先级 20，否则核心那一节还没注册出来。
- **输出**：`yuki_assets()` 用 `wp_add_inline_style()` 把值写成 `--yuki-bg-scrim`；CSS 默认 `.8`。

### 验收

新增 `tests/bin/background-fixtures.php` 与 `tests/bin/verify-background.mjs`，**25/25**。
造数临时设一张背景图与蒙层 60，`finally` 里恢复原 theme mod、删除测试附件，不污染共享环境。

实测：`body` 带 `yuki-has-background-image` 与 `custom-background`；核心的背景图样式在页面里；
`--yuki-bg-scrim:0.6`；蒙层 `opacity: 0.6`、浅色 `rgb(253, 251, 247)`、深色 `rgb(24, 24, 31)`、
`fixed` / `pointer-events: none` / `z-index: -1`。滑杆取值 -10→0、150→100、字符串 75→75。

回归：截图 15/15（深色底仍是 `rgb(24, 24, 31)`）、雪兔 28/28。

### 文案与记录

`languages/yuki.pot` 104 条，新增「背景蒙层强度」与说明。`release-prep` 06 追加了「自定义背景」
一节，撤销原先「custom-background 加了比不加差」的判断。

### 已知边界

- 蒙层只作用于背景图；只设背景色时完全按用户颜色显示。
- 滑杆可以调到 0（完全不蒙）；这是用户的选择，默认 80 已守住可读性。
- 不做访客级外观偏好；页头图、强调色、字体是后续三批。
