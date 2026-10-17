# 02: 可换页头图，导航上方横幅

**What to build:** 原生 `custom-header`；页头图以全宽横幅出现在导航上方，不链接；无图时不输出任何
标记，布局完全不变。

**尺寸。** `width` 1600 / `height` 500，`flex-height`、`flex-width` 打开；`header-text` 关掉
（主题的站名在导航里，核心那个「显示站点标题」勾选框在这里没有作用）。CSS 兜底：
宽度铺满、最高 420px（窄屏 220px）、`object-fit: cover`。

**Blocked by:** 01（按外观设置的批次顺序）

**Status:** ready-for-agent

实现与验收已完成（起点 `af09fdd`）。

- [x] 自定义器里有「页头图像」控件
- [x] 有图时横幅在导航之前，全宽、无链接
- [x] 无图时不输出标记，布局不变
- [x] 桌面最高 420px、窄屏最高 220px，`object-fit: cover`
- [x] 导航在横幅下方；640px 无横向滚动
- [x] 测试临时设 `header_image`，验完恢复原值并删除测试图
- [x] 没有新文案，`yuki.pot` 不动

## Comments

### 实现

- **支持**：`add_theme_support( 'custom-header', … )`，`width` 1600 / `height` 500、
  `flex-height`、`flex-width`；`header-text` 关掉，避免出现一个对主题无效的「显示站点标题」勾选框。
- **模板**：`header.php` 在 `wp_body_open()` 之后、`<header class="yuki-nav">` 之前输出
  `.yuki-header-image` 横幅；**不包链接**。无图时整段不输出。
- **样式**：宽度铺满、`max-height: 420px`（640px 以下 220px）、`object-fit: cover`；
  导航始终在横幅下方。
- 没有新文案，`yuki.pot` 不动。

### 验收

新增 `tests/bin/header-image-fixtures.php` 与 `tests/bin/verify-header-image.mjs`，**16/16**。
造数临时设一张 1600×700 的 `header_image`（含 `header_image_data`），`finally` 里恢复原值并删除测试图。

实测：横幅宽 1185 = 视口 clientWidth（有滚动条）、高 420、`object-fit: cover`；导航 top 420，
正好在横幅下方；640px 下高 220、无横向滚动；横幅在导航之前，页面里没有外链包裹。

### 已知边界

- 页头图是全站设置；首页、文章、归档都会显示。
- 不链接任何地址；回首页仍走导航里的站名/Logo。
- 无图时零输出、零布局变化。
