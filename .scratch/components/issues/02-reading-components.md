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

- [x] 无标题文章不渲染空目录。
- [x] 目录只收 h2/h3，层级正确；点击后滚动并更新 hash。
- [x] 阅读进度从 0 到 100，宽度与文档高度一致；reduced-motion 下无过渡。
- [x] 640px 下目录可折叠或不遮挡正文，无横向溢出。
- [x] 上下篇导航不重复、不断链；无上一篇/下一篇时不留空卡。
- [x] `tests/bin/verify-reading.mjs` 全绿；既有 29 个脚本继续通过。
- [ ] POT、DESIGN、issue、roadmap 同步。

## Comments

### 实现

- 新增 `inc/reading.php`：单篇入队 `assets/js/reading.js`，注册**非公开** `yuki_series` 分类，
  输出 `yuki_series_nav()`；没有系列或系列里只有一篇时返回空，不渲染容器。
- `single.php` 在正文前放 `[data-yuki-toc]` 空槽，在上下篇前调用系列导航；服务端不预生成目录。
- 目录从正文 `h2/h3` 生成 `<details class="yuki-toc">`；桌面展开、960px 以下折叠，
  点击滚动并写 hash，焦点落到标题，滚动时用 `aria-current="location"` 标当前小节。
- 进度条固定在视口顶端，`role="progressbar"`，只作视觉提示；reduced-motion 下过渡为 `none`。
- 样式追加到 `assets/css/components.css`，不改正文 724px、侧栏 300px 和 B 外壳策略。

### 系列的数据来源

- 没有沿用分类/标签猜测「系列」，新增非公开 `yuki_series` 分类：作者在编辑器里归类，
  不在前台生成系列归档页，也不影响分类/标签的既有行为。
- 单篇按发布日期升序列出同系列文章；系列列在上下篇之前，当前项不是链接。

### 验收

- `verify-reading` **39/39**：目录 3 项（2 个 h2 + 1 个 h3）、桌面展开、首屏当前项、点击 `#section-3`
  后焦点落到 `H2`、进度 0→100、640px 折叠且无横向溢出、无标题不建目录、无系列不留空容器、
  reduced-motion 过渡为 `0s`。
- 既有受影响脚本：`verify-editor-alignment` 58/58、`verify-editor-styles` 23/23、`verify-font` 18/18、
  `verify-motion` 19/19、`verify-ui-redesign` 58/58、`verify-package` 65/65。
