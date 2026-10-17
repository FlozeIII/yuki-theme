# 动效收敛与减少动效

Status: ready-for-agent
Type: spec

## Problem Statement

主题里的动效不齐：

- **主题开关的滑块有 0.35s 过渡，但没有 `prefers-reduced-motion` 覆盖**；对动效敏感的用户
  仍然会看到它滑动。按钮的 1px 上浮同样没有覆盖。
- **文章列表声明了 `background-color` 过渡，却没有 hover 背景**——过渡写了，落点没写。
- **上下篇卡片只有边框变色**，与按钮的「1px 上浮」不是同一套节奏。
- 列表项、上下篇、关联文章、标签的链接**没有统一的 `focus-visible` 焦点环**。

这些都不是新功能，是已有交互的收尾。

## Solution

把已有动效收成一套：

- 在 `prefers-reduced-motion: reduce` 下**只停运动**（位移、缩放、滑动），保留颜色过渡。
- 文章列表补上 hover 背景（`--yuki-muted`）与缩略图 1px 浮起。
- 上下篇卡片 hover 时 1px 浮起，与按钮同一节奏。
- 给列表项、上下篇、关联文章、标签的链接补同一枚焦点环。

不新增颜色、控件、设置或页面级动画。

## User Stories

1. 作为对动效敏感的用户，我希望主题开关不再滑动，按钮与卡片不再上浮。
2. 作为对动效敏感的用户，我希望颜色仍然有变化，界面不会因为关了动效而失去反馈。
3. 作为访客，我希望鼠标移到文章列表的一行时，背景与缩略图给出克制的反馈。
4. 作为访客，我希望上下篇卡片的 hover 与按钮是同一套节奏。
5. 作为键盘用户，我希望列表、上下篇、关联文章与标签的链接都有清晰的焦点环。
6. 作为设计者，我希望这一批不引入新颜色或新控件。

## Implementation Decisions

### 减少动效

- 在现有 `@media (prefers-reduced-motion: reduce)` 块内追加：
  - `.theme-switch-knob` 只保留 `background-color` 过渡（滑块位置立即到位）。
  - `.yuki-btn` 只保留 `background-color` 过渡，hover 时 `transform: none`。
  - `.yuki-post-thumb` 无过渡，列表 hover 时不位移。
  - `.yuki-post-nav a` 只保留 `border-color` 过渡，hover 时 `transform: none`。
- 已有的搜索浮层、灯箱规则保持不变。
- **不关闭颜色过渡**：`prefers-reduced-motion` 针对运动，不针对颜色。

### Hover

- `.yuki-post-item:hover { background: var(--yuki-muted); }`。
- `.yuki-post-thumb` 增加 `transform 180ms ease`；列表项 hover 时 `translateY(-1px)`。
- `.yuki-post-nav a` 的 transition 增加 `transform 180ms ease`；hover 时 `translateY(-1px)`。
- 关联文章只补焦点环，不加位移；标签只补焦点环。
- 全部复用现有 token；不新增颜色。

### 焦点环

```css
.yuki-post-item a:focus-visible,
.yuki-post-nav a:focus-visible,
.yuki-related-item a:focus-visible,
.yuki-tag:focus-visible {
  outline: 2px solid var(--yuki-ring);
  outline-offset: 2px;
}
```

与主题开关、搜索按钮、灯箱关闭按钮的焦点环同一枚 token。

### 明确不做的

- 不做页面切换/入场动画。
- 不做季节主题、字体切换。
- 不改搜索浮层与灯箱的动效。
- 不引入新的 hover 颜色或阴影。

## Testing Decisions

### Seam

- **真浏览器**：CDP 鼠标移动到元素上触发真实 `:hover`；`prefers-reduced-motion` 用现有的
  `newPage({ reducedMotion: true })` 模拟。
- **文件阅读**：静态断言选择器与 reduced-motion 规则。
- 给 `browser.mjs` 增加 `hover(selector)`（只增不改）；键盘焦点环只做静态断言，
  不新增键盘输入观察点。

### 要测的模块

- 普通动效：列表项 hover 后背景为 `--yuki-muted`、缩略图 `translateY(-1px)`；
  上下篇卡片 hover 后 `translateY(-1px)`。
- reduced motion：缩略图与上下篇 hover 后 `transform: none`；主题开关与按钮的
  `transition-property` 不含 `transform`；列表背景仍然变化（颜色过渡保留）。
- 静态：焦点环选择器存在；reduced-motion 规则覆盖四个组件。

### 明确不测什么

- 动画帧率与观感。
- 颜色过渡的时长——只验「颜色仍然在变」。
- 键盘 Tab 的实际顺序——焦点环的存在用静态断言。

## Out of Scope

- 页面级动画、入场效果、季节主题、字体切换。
- 新的 hover 颜色或阴影。
- 搜索浮层与灯箱的动效改造。

## Further Notes

- 共享文件：`style.css`。开工前在 `.scratch/holds.md` 挂行，提交后删掉。
- `browser.mjs` 不在共享清单上；`hover()` 是新增方法，不改现有调用。
- 没有新文案，`languages/yuki.pot` 不动。
