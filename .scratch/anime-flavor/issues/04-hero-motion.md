# 04: hero 的樱瓣/星光

**What to build:** 首页 hero 里放 7 枚纯 CSS 的飘落花瓣，颜色用季节点缀色 `--yuki-season`；
`prefers-reduced-motion: reduce` 下整层隐藏。只在 hero，不铺到全站。

**实现。** `index.php` 的 `.yuki-hero` 内加一层 `aria-hidden="true"` 的 `.yuki-hero-petals`，
里面 7 个空 `<span>`；CSS 负责形状、位置、延迟与 `yuki-petal-fall` 动画。花瓣层
`pointer-events: none`，hero `overflow: hidden`，文字在花瓣之上。

**不做。** 不加 JS、不做全站飘落、不做光标或页面转场；不新增文案。

**Blocked by:** 01、03（角色与季节色已就位）

**Status:** ready-for-agent

实现与验收已完成（起点 `8e97f7f`）。

- [x] hero 里有 7 枚花瓣，`aria-hidden="true"`，不接收点击
- [x] 花瓣是纯 CSS：形状、位置、时长、延迟各不相同
- [x] 花瓣颜色用 `--yuki-season`
- [x] `prefers-reduced-motion: reduce` 下整层隐藏
- [x] 花瓣只在 hero，正文与其他页面不出现
- [x] 640px 下不造成横向滚动
- [x] 真浏览器断言花瓣数量、动画名/时长、季节色、reduced motion
- [x] 不新增文案，`yuki.pot` 不动

## Comments

### 实现

- `index.php` 的 `.yuki-hero` 内加一层 `aria-hidden="true"` 的 `.yuki-hero-petals`，里面
  7 个空 `<span>`；hero 加 `position: relative; overflow: hidden`，正文内容 `z-index: 1`。
- `style.css`：花瓣是 `50% 0 50% 0` 的圆角形状，`background: var(--yuki-season)`，
  `pointer-events: none`；7 个 `nth-child` 各自给 `left`、大小、`animation-duration` 与负
  `animation-delay`。`@keyframes yuki-petal-fall` 负责下落、横向轻摆与旋转。
- `prefers-reduced-motion: reduce` 下 `.yuki-hero-petals { display: none; }`。
- 没有 JS、没有新文案、没有全站飘落或光标/转场。

### 验收

新增 `tests/bin/verify-hero-motion.mjs`，**17/17**。真浏览器量到 7 枚花瓣、
`animation-name: yuki-petal-fall`、时长 12s、颜色等于当前季节色（10 月是 `rgb(232, 163, 61)`）、
花瓣层 `pointer-events: none`、640px 无横向滚动、reduced motion 下 `display: none`。
归档页没有花瓣层，确认只出现在首页 hero。

首页截图重拍；回归：雪兔 28/28、动效 19/19。

### 已知边界

- 花瓣只在首页 hero；文章页、归档、搜索都不放。
- 动画是纯 CSS 无限循环；没有 JS 控制，也不做「播放一次」。
- 花瓣颜色跟季节走，秋天是琥珀、春天是樱粉；截图记录的是拍摄当天的季节。
