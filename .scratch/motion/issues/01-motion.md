# 01: 动效收敛，减少动效真的生效

**What to build:** 把已有动效收成一套：`prefers-reduced-motion` 下只停运动、保留颜色；
文章列表补 hover 背景与缩略图 1px 浮起；上下篇卡片 hover 1px 浮起；列表/上下篇/关联/标签
补同一枚焦点环。不新增颜色、控件或页面级动画。

**减少动效。** 主题开关滑块只保留背景色过渡，位置立即到位；按钮与上下篇卡片只保留颜色/边框过渡，
hover 不上浮；缩略图无过渡、列表 hover 不位移。

**Hover。** 列表项 hover 背景 `--yuki-muted`，缩略图 `translateY(-1px)`；上下篇卡片
`translateY(-1px)`；关联文章与标签只补焦点环，不加位移。

**验收。** 真浏览器用 CDP 鼠标移动触发真实 `:hover`，用 `reducedMotion` 模拟偏好；
静态断言选择器与 reduced-motion 规则。`browser.mjs` 新增 `hover()`，只增不改。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `17d53df`）。

- [x] reduced motion 下主题开关滑块不再滑动
- [x] reduced motion 下按钮与上下篇卡片 hover 不上浮
- [x] reduced motion 下缩略图与列表 hover 不位移
- [x] reduced motion 下颜色/边框过渡仍然保留
- [x] 普通模式下列表项 hover 有 `--yuki-muted` 背景
- [x] 普通模式下缩略图 hover `translateY(-1px)`
- [x] 普通模式下上下篇卡片 hover `translateY(-1px)`
- [x] 列表/上下篇/关联/标签链接有同一枚 `focus-visible` 焦点环
- [x] 没有新增颜色、控件或页面级动画
- [x] 真浏览器断言覆盖 hover 位移、背景与 reduced motion
- [x] 静态断言覆盖焦点环与四个组件的 reduced-motion 规则

## Comments

### 实现

- **列表**：`.yuki-post-item:hover` 补上 `background: var(--yuki-muted)`；`.yuki-post-thumb` 增加
  `transform 180ms ease`，hover 时 `translateY(-1px)`。整行不位移，分隔线不会被推走。
- **上下篇**：`.yuki-post-nav a` 的 transition 增加 `transform 180ms ease`，hover 时
  `translateY(-1px)`。
- **焦点环**：列表项、上下篇、关联文章、标签的链接共用一条
  `outline: 2px solid var(--yuki-ring); outline-offset: 2px`。
- **减少动效**：在现有 `@media (prefers-reduced-motion: reduce)` 内追加：
  主题开关滑块与按钮只保留背景色过渡；缩略图无过渡；上下篇只保留边框过渡，hover 不上浮。
  **颜色过渡一律保留**——这个偏好针对运动，不针对颜色。
- **测试观察点**：`browser.mjs` 新增 `hover(selector)`，用 CDP `Input.dispatchMouseEvent` 发
  `mouseMoved`；`dispatchEvent(new MouseEvent('mouseover'))` 不会触发 `:hover`。滚动用
  `behavior: 'instant'`，避免站点的 `scroll-behavior: smooth` 让坐标过期。

### 验收

新增 `tests/bin/motion-fixtures.php` 与 `tests/bin/verify-motion.mjs`，**19/19**。

实测：普通模式下列表 hover 背景 `rgb(243, 240, 234)`、缩略图 `matrix(1, 0, 0, 1, 0, -1)`；
上下篇同样 1px；reduced motion 下缩略图与上下篇 `transform: none`，背景仍然变，
主题开关与按钮的 `transition-property` 只剩 `background-color`。

回归：关联文章 20/20、图片灯箱 39/39、截图 15/15。

### 已知边界

- 焦点环只做静态断言；没有新增键盘输入观察点去验 Tab 顺序。
- 不做页面级动画、季节主题或字体切换。
- 搜索浮层与灯箱的动效规则不变。
