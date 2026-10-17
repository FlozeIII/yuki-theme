# 02: 分类贴纸与对话气泡

**What to build:** 把文章列表里的分类徽章做成贴纸（轻微旋转 + 虚线边 + 一小段半透明胶带）；
空状态的文案装进对话气泡，气泡尖角朝上指向雪兔。

**边界。** 只动徽章与空状态两处；不改文章列表版式、不改正文、不新增颜色。贴纸的胶带用
`--yuki-primary` 加透明度，气泡用 `--yuki-card` / `--yuki-border` / `--yuki-ink-2`。

**动效。** 贴纸 hover 时轻轻转正；`prefers-reduced-motion` 下不转、保持贴纸角度。

**Blocked by:** 01（雪兔已就位，气泡尖角指向它）

**Status:** ready-for-agent

实现与验收已完成（起点 `77d211e`）。

- [x] 分类徽章是贴纸：轻微旋转、虚线边、半透明胶带
- [x] 贴纸 hover 轻轻转正；reduced motion 下保持静止
- [x] 空状态文案在对话气泡里，气泡尖角朝上
- [x] 气泡在浅色/深色下都用现有 token
- [x] 640px 下贴纸与气泡不造成横向滚动
- [x] 分类徽章补上 `focus-visible` 焦点环
- [x] 不改正文、不改列表版式、不新增颜色
- [x] 真浏览器断言覆盖贴纸 transform/虚线边/胶带与气泡边框/尖角
- [x] 首页截图重拍

## Comments

### 实现

- **贴纸**：`.yuki-cat-badge` 改为 `rotate(-2deg)`、`1px dashed var(--yuki-border)`、
  `var(--yuki-card)` 底；`::before` 是一小段 `var(--yuki-primary)`、`opacity: .18` 的胶带。
  hover 时转正（`rotate(0)`）；`prefers-reduced-motion` 下不转、保持贴纸角度。
- **气泡**：`.yuki-empty-state p` 变成 `var(--yuki-card)` 底、`var(--yuki-border)` 实线边、
  `--yuki-radius-lg` 圆角的对话气泡；`::before` 是朝上的尖角，正好指向雪兔。文案色用
  `--yuki-ink-2`，与正文同一层。
- **焦点**：分类徽章是链接，补进统一焦点环那一条。
- **范围**：只改徽章与空状态两处；列表版式、正文、文案都没有动，也没有新增颜色。

### 验收

新增 `tests/bin/verify-stickers.mjs`（复用 `mascot-fixtures.php` 的空分类），**24/24**。
真浏览器量到：贴纸 `matrix(0.999391, -0.0348995, …)`、`border-style: dashed`、胶带
`content: ""` / `opacity: .18`；hover 后变回单位矩阵；reduced motion 下 hover 仍是原角度；
气泡 `solid` 边、16px 圆角、卡片底色、尖角存在；640px 下首页与空归档都不横向滚动。

首页截图重拍后带贴纸；回归：雪兔 28/28、动效 19/19。

### 已知边界

- 没有新文案，`yuki.pot` 不动。
- 贴纸只作用于分类徽章；标签、分页与别处的 pill 不改。
- 气泡只用于三个空状态；404 保持原有布局。
