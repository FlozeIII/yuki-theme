# 工单 01 · 扁平表面层

Status: ready-for-agent

## What to build

用 `assets/css/flat.css` 替换玻璃/科技层：实色表面、1px 细边框、2–5px 小圆角、颜色/边框反馈；去掉背景图、模糊、HUD、扫描线和新增阴影。模板、宽度和已有 token 不动。

## 范围

- 新建 `assets/css/flat.css`。
- `inc/production-bible.php` 删除 `yuki_premium_assets()`/`yuki_tech_assets()`，新增 `yuki_flat_assets()`，优先级 30，依赖 `yuki-archive-console`、`yuki-components`、`yuki-site-modules`、`yuki-mascot-card`。
- 删除 `assets/css/premium.css`、`assets/css/tech.css`、`tests/bin/verify-premium-ui.mjs`、`tests/bin/verify-tech-accent.mjs`。
- 新建 `tests/bin/verify-flat-ui.mjs`。
- 更新 `DESIGN.md`、`README.md`、`.scratch/roadmap/map.md`；在 `.scratch/premium-ui/` 标注历史。

## 验收

- [x] `assets/css/flat.css` 存在，导航 radius 0 / blur none / shadow none。
- [x] 角色卡 3px 且无阴影；数据条 5px；侧栏无玻璃/阴影/5px；按钮 2px。
- [x] body/hero 无背景图；640px 无横向溢出；正文仍 722px。
- [x] reduced-motion 动画/过渡压到 0s。
- [x] `verify-flat-ui` 36/36（含头部图标圆角矩形）。
- [x] 既有 33 个脚本全部通过。
- [x] `verify-package` 65/65；`wptk check` 0 error / 0 warning / 10 info（既有 info）。
- [x] `screenshot.png` 重建为扁平版，1200×900、约 122 KB。
- [x] 只提交自己的路径并确认工作树干净。

## Comments

- 2026-10-23：玻璃/科技层已删除，扁平层实现完成；`verify-flat-ui` 32/32。全量回归与截图完成。
- 减少动效从 `0.01ms` 改为 `0s`，修复 `verify-image-lightbox` 与 `verify-reading` 对 `transition-duration` 的断言；两者恢复 39/39。
- 截图时发现自定义器字体被此前的测试留在 serif，已把 `yuki_font_style` 恢复默认 `sans` 后重拍。
- 2026-10-23：头部搜索按钮与主题开关改为 4px 圆角矩形，滑块 3px；`verify-flat-ui` 扩到 36/36。
