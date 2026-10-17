# 01: 雪兔与空状态微文案

**What to build:** 一枚原创内联 SVG 的白色雪兔，出现在首页 hero、404、空归档、空搜索与首页无文章；
空状态文案换成轻一点的语气。角色只做装饰，不进正文、侧栏、导航或主题开关。

**角色。** 新模板片段 `template-parts/mascot.php`：参数 `size`（`sm`/`lg`）与 `class`；
`aria-hidden="true"`、`focusable="false"`。颜色只用白、墨色、`--yuki-primary`、`--yuki-border`，
不用外部图片。

**位置。** hero 在标题右侧、窄屏落到标题下方（`lg` 112px，640px 以下 88px）；404 用 `lg`；
三个空状态用 `sm` 64px。

**文案。** 404、空归档、空搜索、首页无文章各一句带雪兔的语气；全部走 `__()`。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `59870c5`）。

- [x] `template-parts/mascot.php` 是原创内联 SVG，`aria-hidden="true"`，无外部引用
- [x] 首页 hero 有雪兔：桌面在标题右侧，窄屏落到标题下方
- [x] 404 有雪兔与新文案
- [x] 空归档、空搜索、首页无文章有雪兔与新文案
- [x] 雪兔不出现在正文、侧栏、导航与主题开关
- [x] 640px 下 hero 不横向滚动；深色下雪兔仍有尺寸
- [x] 颜色只用白、墨色、`--yuki-primary`、`--yuki-border`，没有新调色板
- [x] 文案走 `__()`，`languages/yuki.pot` 按 HEAD + 本件文件重建
- [x] HTTP/静态断言覆盖 404、空归档、空搜索与 hero
- [x] 后续三批（贴纸/气泡、季节色、hero 动效）不在本工单里

## Comments

### 实现

- **角色**：新文件 `template-parts/mascot.php`，原创内联 SVG 的白色雪兔（圆身体、长耳、
  墨色眼睛、堇紫围巾、围巾上一枚小雪花）。`aria-hidden="true"`、`focusable="false"`；
  颜色只用 `#FFFFFF`、`#2D2D35`、`var(--yuki-primary)`、`var(--yuki-border)`，没有外部图片。
- **尺寸**：`sm` 64px（空状态）、`lg` 112px（hero/404）；640px 以下 `lg` 缩到 88px。
- **hero**：`index.php` 的标题包进 `.yuki-hero-title-row`，桌面标题右侧、窄屏换行落到标题下方。
- **404**：雪兔在 404 数字上方；文案改为「雪兔在雪地里找了半天，也没找到这一页。……」
- **空状态**：首页无文章、空归档、空搜索统一用 `.yuki-empty-state`，各带一只 `sm` 雪兔与新文案。
- **样式**：`style.css` 新增雪兔、hero 标题行、空状态与 404 的布局规则；全部走现有 token。

### 验收

新增 `tests/bin/mascot-fixtures.php` 与 `tests/bin/verify-mascot.mjs`，**28/28**。
静态核过 SVG 内联、无外部引用、颜色只白/墨/主色/边框；HTTP 核过首页 hero、404、空归档、
空搜索的角色与文案；真浏览器量到 hero 112px、640px 下 88px 且无横向滚动、404 112px、
深色下仍有尺寸。

`verify-screenshot` 重新拍摄了首页截图，现在第一屏带雪兔；回归：动效 19/19、关联文章 20/20。

### 文案与生成物

`languages/yuki.pot` 按 `AGENTS.md` 第 5 条重建：从 HEAD 快照补上本件改过的
`index.php`、`404.php`、`archive.php`、`search.php` 与新模板片段。共 102 条，
四条雪兔文案各占一条。

### 已知边界

- 雪兔只出现在 hero、404 与三个空状态；正文、侧栏、导航、主题开关都没有。
- 角色是白色固定色，深色模式下也不会变成深色；这是刻意的（雪兔在暗处仍然可见）。
- 后续三批不在本工单：贴纸/气泡、季节点缀色、hero 动效。
