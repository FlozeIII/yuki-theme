# 工单 02 · 科技感 HUD 精修

Status: ready-for-agent

> **已被取代**：玻璃层/科技 HUD 层已删除，当前视觉以 `.scratch/flat-ui/spec.md` 与 `assets/css/flat.css` 为准；本文件仅保留历史决策。

## What to build

在现有玻璃精修层上再加一点「科技感」，不改模板和布局：细 cyan 信号线、角标、状态点、轻微扫描线，以及只在交互面上的低强度光晕。

## 范围

- 新 `assets/css/tech.css`，由 `inc/production-bible.php` 在 `yuki-premium` 之后入队，依赖 `yuki-premium`。
- 导航底部信号线与品牌状态点。
- 首页封面四角 bracket 与跨封面的缓慢扫描线。
- 数据条右上读角与底部短刻度。
- 侧栏卡片/目录/系列右上角标。
- 证据图卡四角 bracket。
- 角色卡/按钮 hover 的 cyan 边光；不改底色、尺寸、正文宽度。
- `prefers-reduced-motion` 下关闭新增动画；640px 隐藏跨封面扫描线。
- 不新增可见文案，不改 POT，不改 `style.css` 版本。

## Blocked by

无。

## 验收

- [x] `tech.css` 在 `premium.css` 之后加载，HTTP 200。
- [x] 导航、封面、数据条、侧栏、证据图卡的角标/信号线存在。
- [x] 扫描线与状态点在 reduced-motion 下停止。
- [x] 1440 与 640 下无横向溢出；正文仍 722px、侧栏 300px。
- [x] `verify-premium-ui`、`verify-ui-redesign`、`verify-screenshot`、`verify-package` 与全量脚本通过。
- [x] 更新 DESIGN/roadmap/screenshot 后提交。

## Comments

2026-10-23：实现 `assets/css/tech.css`，在 `yuki-premium` 之后加载，依赖 `yuki-premium`。
导航信号线/品牌状态点、封面 bracket 与扫描线、数据条读角/短刻度、侧栏与目录角标、
文档顶栏/证据图卡 bracket、角色卡/按钮 hover 边光；扫描线与状态点在 reduced-motion 停止，
640px 隐藏跨封面扫描线。未新增可见文案，POT 不变。

验收：`verify-tech-accent` 32/32；全部 34 个 `tests/bin/verify-*.mjs` 通过；
`verify-premium-ui` 36/36、`verify-ui-redesign` 58/58、`verify-screenshot` 16/16、
`verify-package` 65/65；`wptk check` 0 error / 0 warning / 10 info。
`DESIGN.md`、README、roadmap 与 `screenshot.png` 已同步。

