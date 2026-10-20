# 02 · 单篇阅读组件

Status: ready-for-agent

## What to build

在第一批的组件语法之上，增加单篇文章的阅读辅助：

- **自动目录**：只从正文 `h2` / `h3` 生成；无标题或只有一项时不显示；点击平滑滚动并更新 URL hash。
- **阅读进度**：页面顶部一条细进度线，跟随滚动；`prefers-reduced-motion` 下不做过渡。
- **系列/上下篇导航**：复用现有 `yuki_post_nav()` 之前的位置，补一个「系列」分组；没有系列时退回现有上一篇/下一篇，不显示空容器。

要求：

- 目录与进度用独立 `assets/js/reading.js`（IIFE、无依赖、无构建），不接受内联脚本。
- 目录锚点由 PHP/JS 生成时都补 `id`，不重复；键盘可聚焦，`aria-current` 标记当前小节。
- 进度条 `role="progressbar"` 或 `aria-hidden` 装饰二选一，不制造读屏噪音。
- 不改变单篇正文 724px、侧栏 300px、header/filebar 左对齐的既有契约。

## 范围

单篇 `single.php` 与正文标题；不碰首页、归档、页脚。

## Blocked by

01（组件样式底座）。

## 验收

- [ ] 无标题文章不渲染空目录。
- [ ] 目录只收 h2/h3，层级正确；点击后滚动并更新 hash。
- [ ] 阅读进度从 0 到 100，宽度与文档高度一致；reduced-motion 下无过渡。
- [ ] 640px 下目录可折叠或不遮挡正文，无横向溢出。
- [ ] 上下篇导航不重复、不断链；无上一篇/下一篇时不留空卡。
- [ ] `tests/bin/verify-reading.mjs` 全绿；既有 29 个脚本继续通过。
- [ ] POT、DESIGN、issue、roadmap 同步。

## Comments

（实现记录追加在下方。）
