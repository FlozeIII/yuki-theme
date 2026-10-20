# 工单 01 · 整站数字档案 UI

Status: ready-for-agent
Blocked by: 无
起点: `14964e4`（纸面版，用户已否决）

实现与验收已完成（2026-10-20），待提交。未发版，`style.css` 的 Version 仍为 1.3.0。

## What to build

把纸面「设定资料集」改成 **数字档案 / Archive Console**：深色系统外壳 + 浅色文档面板，
参考 SCP 的信息组织方式，但不复制其标识、原文或故事。状态栏、CASE FILE、SUBJECT PROFILE、
DOCUMENT INDEX、DOCUMENT / SECTOR / STATUS、EVIDENCE、FILE NOT FOUND、SYSTEM NOTES、
ARCHIVE UPLINK 全部落到真实模板与真实站点数据上。

保留现有功能和测试钩子，不引入构建或外部依赖。纸面版 `14964e4` 仍在历史里，但不再代表
当前方向；数字层覆盖它的颜色与文案，布局底座继续复用。

## 范围

- 新增 `assets/css/archive-console.css`，由 `inc/production-bible.php` 在
  `production-bible.css` 之后入队；`production-bible.css` 继续作为布局底座。
- `style.css` 只改颜色 token 与 Description：背景 `#DCE3E6/#070C10`、muted `#E7EDEF/#18242B`
  等；不改 Version、默认 primary、宽度 token。
- 改 `header.php`、`footer.php`、`index.php`、`single.php`、`page.php`、`archive.php`、
  `search.php`、`404.php`、`sidebar.php`、`template-parts/post-item.php` 的文案与局部结构。
- 保留 `.yuki-hero.yuki-dot-pattern`、7 枚 `.yuki-hero-petals`、`.yuki-hero-title-row`、
  `.yuki-post-item`、`.yuki-post-list`、`.yuki-post-thumb img`、`.yuki-post-title`、
  `.yuki-cat-badge`、`.yuki-article-header`、`.yuki-article-main`、`.yuki-single-layout`、
  `.yuki-sidebar`、`.yuki-widget`、`.yuki-empty-state`、`.yuki-404`、`.yuki-code-copy`。
- 分类徽章的季节胶带继续用 `var(--yuki-season)`；数字层只改徽章表面/边框，不覆盖胶带颜色。
- 新文案全部 `esc_html_e()` / `esc_attr_e()`，重建 `languages/yuki.pot`。
- 更新 `tests/bin/verify-ui-redesign.mjs`、`verify-background.mjs`、`verify-motion.mjs`、
  `verify-screenshot.mjs`；既有 28 个脚本继续全绿。

## 不做什么

- 不发版、不改 `style.css` 的 Version、不生成 ZIP。
- 不改雪兔 SVG、不改数据模型、不加后台设置。
- 不复制 SCP 的标识、原文、等级名称或具体故事。
- 不删测试钩子；如测试要改，逐条写明理由。
- 不做灯箱多图切换、目录、阅读进度。

## 验收

- [x] `archive-console.css` 存在，由 `inc/production-bible.php` 入队并依赖 `production-bible`。
- [x] 首页有系统状态栏、`CASE FILE`、`SUBJECT PROFILE`、`DOCUMENT INDEX` 和真实统计。
- [x] 首页 1440 两栏、640 单栏，无横向滚动；7 枚花瓣与雪兔仍在。
- [x] 单篇有 `.yuki-filebar` 与 `EVIDENCE`，正文列 722px、侧栏 300px，宽块不遮侧栏。
- [x] 关于/归档/搜索/404 有数字档案语言；空状态与雪兔仍可用。
- [x] 浅色/深色都成立；`prefers-reduced-motion` 下花瓣隐藏。
- [x] `verify-ui-redesign` 55/55；`verify-background` 25/25；`verify-motion` 19/19；
  `verify-screenshot` 16/16；season/stickers/accent/comment/font/editor/code-copy 定向回归全绿。
- [x] 既有 28 个脚本 + `verify-ui-redesign` 全量重跑全部通过；`verify-package` 65/65。
- [x] `wptk check` 0 error / 0 warning（8 条既有 info）；POT 155 条，169 个行号引用全部指向真实调用。
- [x] `.scratch/roadmap/map.md`、`DESIGN.md` 与本工单最终更新。
- [x] 只提交自己的路径；holds 自己的行已删；提交后 `git log --stat -1` 核对。

## Comments

### 实现

- **数字层**：新增 `assets/css/archive-console.css`，在 `production-bible.css` 之后加载。
  深色 void/shell/line、cyan/red 状态色、浅色 doc/doc-ink/doc-muted/doc-line 全部走
  `--da-*`；深色覆盖在 `.dark body.yuki-production-bible`。
- **表面分工**：状态栏/导航/首页 hero/归档搜索 hero/404/侧栏/页脚是深色系统外壳；
  单篇与静态页 main 是浅色文档面板；首页索引留在冷灰页面。正文 722px、侧栏 300px。
  后续由工单 02 改为 B：浅色主题下状态栏/导航/hero 跟随页面，深色模式仍保留深色外壳。
- **模板**：`header.php` 系统状态栏；`index.php` CASE FILE + SUBJECT PROFILE + DOCUMENT INDEX；
  `single.php`/`page.php` DOCUMENT/SECTOR/STATUS + EVIDENCE/PLATE 01；`archive.php`/
  `search.php` 用 `RECORDS / BACK MATTER` 与 `RECORDS / SEARCH`；`404.php` 用
  FILE NOT FOUND；`sidebar.php` 用 SYSTEM NOTES / ACCESS LOG；`footer.php` 用 ARCHIVE UPLINK。
- **刻意改底色**：`--yuki-background` 从纸面 `#EDE8DC/#0F1720` 改为冷灰 `#DCE3E6` / 黑
  `#070C10`，让评论区、说说、页脚、截图和数字档案共用一套表面。
- **测试同步**：`verify-ui-redesign` 改写为数字档案；`verify-background` 改
  `rgb(220,227,230)` / `rgb(7,12,16)`；`verify-motion` 的 muted 改 `rgb(231,237,239)`；
  `verify-screenshot` 允许深色或浅色系统外壳与浅色文档面同时存在，不再要求浅色底占最大比例。
- **POT**：按 HEAD + 自己改的文件重建，155 条 / 169 个引用，`check-pot` 全绿。
- **截图**：`screenshot.png` 重拍为 1200×900、约 105 KB，深色 hero + 浅色档案索引。

### 验收

- `node tests/bin/verify-ui-redesign.mjs`：**55/55**。
- 全量 29 个 `tests/bin/verify-*.mjs`（28 个既有 + 本工单）逐个重跑全部 rc=0；
  `verify-package` 65/65。`verify-comment-submit` 第一次因浏览器忙碌出现 172/173，
  单独重跑 173/173；不是模板回归。
- 定向回归：`verify-background` 25/25、`verify-motion` 19/19、`verify-screenshot` 16/16、
  `verify-season` 23/23、`verify-stickers` 24/24、`verify-accent` 24/24、
  `verify-comment-nesting` 53/53、`verify-font` 18/18、`verify-editor-alignment` 58/58、
  `verify-code-copy` 51/51、`verify-shuoshuo-density` 43/43、`verify-mascot` 28/28。
- `wptk check`：0 error / 0 warning / 8 info，8 条均为既有项。
- POT 重建后 155 条，`check-pot` 全绿；截图和深色/浅色文档面板已人工看过。

### 已知边界

- 深色状态栏实际底色是 `#030608` / `#0A1116`，比 body 的 `#070C10` 更深；这是刻意的
  外壳层次，不是遗漏。
- 分类徽章的季节胶带仍随季节变色（当前秋季是橙色）；这是既有功能，也是 `verify-season`
  的契约，不属于纸面残留。
- 默认 `--yuki-primary` 仍是堇紫 `#A5B4FC`，按钮/焦点环/输入焦点没有改成数字档案的青色；
  这是为了不破坏强调色自定义与既有验收。数字层用 cyan 做状态色，不用它替换交互主色。
- 数字面板的最终视觉仍依赖 `production-bible.css` 的网格；如果后续删除那个文件，需要先把
  布局规则迁进 `archive-console.css`。
- 纸面版提交 `14964e4` 的截图、文案和 token 已被本工单覆盖；历史保留，不回滚。
- `ui-redesign/` 是本地截图/调试目录，不进入提交；临时探针脚本在收尾时删除。

### 后续

- 2026-10-20 用户反馈浅色主题下顶部外壳不随主题变化；比较 A/B/C 后选 B。
  工单 `.scratch/ui-redesign/issues/02-shell-follows.md` 把状态栏、导航、首页/归档 hero
  在浅色下改为跟随页面；本工单的深色外壳描述以该工单为准。
