# 工单 01 · 整站设定资料集 UI

Status: ready-for-agent
Blocked by: 无
起点: `f9b9a92`

实现与验收已完成（2026-10-20）。未发版，`style.css` 的 Version 仍为 1.3.0。

## What to build

按 J · 设定资料集重做整站视觉：纸面 + 工程网格、生产信息栏、首页 FILE 01 封面、
CHARACTER SHEET、EPISODE INDEX、单篇/页面的档案条、production notes 侧栏，以及归档/
搜索/404/页脚的同一套语言。保留现有功能和测试钩子，不引入构建或外部依赖。

## 范围

- 新增 `assets/css/production-bible.css`，由 `inc/production-bible.php` 入队；`functions.php`
  只加一行显式 `require_once`。
- 新增 body class 与真实站点统计 helper（话数 / 分类 / 最近更新）。
- 改 `header.php`、`footer.php`、`index.php`、`single.php`、`page.php`、`archive.php`、
  `search.php`、`404.php`、`sidebar.php`、`template-parts/post-item.php`。
- 保留 `.yuki-hero.yuki-dot-pattern`、7 枚 `.yuki-hero-petals`、`.yuki-hero-title-row`、
  `.yuki-post-item`、`.yuki-post-list`、`.yuki-post-thumb img`、`.yuki-post-title`、
  `.yuki-cat-badge`、`.yuki-article-header`、`.yuki-article-main`、`.yuki-single-layout`、
  `.yuki-sidebar`、`.yuki-widget`、`.yuki-empty-state`、`.yuki-404`。
- 新 token 只加 J 需要的纸/蓝图/信号橙/冰蓝/网格/plate；不改默认 primary、宽度契约和
  `--yuki-muted` 浅色值。
- 新文案全部 `esc_html_e()` / `esc_attr_e()`，重建 `languages/yuki.pot`。
- 新增 `tests/bin/verify-ui-redesign.mjs`；既有 28 个脚本继续全绿。

## 不做什么

- 不发版、不改 `style.css` 的 Version、不生成 ZIP。
- 不改雪兔 SVG、不改数据模型、不加后台设置。
- 不删测试钩子；如测试要改，逐条写明理由。
- 不做灯箱多图切换、目录、阅读进度。

## 验收

- [x] `assets/css/production-bible.css` 存在并在 `style.css` 之后入队。
- [x] 首页有生产信息栏、`CHARACTER SHEET`、`EPISODE INDEX` 和真实统计。
- [x] 首页 1440 两栏、640 单栏，无横向滚动；`.yuki-hero` / 7 枚花瓣 / 雪兔仍在。
- [x] 单篇有 `.yuki-filebar`，内容 token 仍 768px、实际正文列 724px，侧栏仍 300px，宽块不遮侧栏。
- [x] 关于/归档/搜索/404 有同一套 kicker/档案语言，空状态与雪兔仍可用。
- [x] 浅色/深色都成立；`prefers-reduced-motion` 下不新增运动。
- [x] `verify-ui-redesign` 50/50；既有 28 个脚本全绿；`verify-package` 65/65。
- [x] `wptk check` 0 error / 0 warning（8 条既有 info）；POT 153 条，169 个行号引用全部指向真实调用。
- [x] `.scratch/roadmap/map.md` 与本工单更新；只提交自己的路径；holds 自己的行已删。

## Comments

### 实现

- **视觉层**：新增 `assets/css/production-bible.css`，由 `inc/production-bible.php` 在
  `yuki-style` 之后入队；body 加 `yuki-production-bible`。它是覆盖层，旧 `style.css`
  继续提供宽度、强调色、灯箱、代码复制、评论与说说的稳定契约。
- **模板**：`header.php` 加生产信息栏与方块 brand；`index.php` 改成 FILE 01 +
  CHARACTER SHEET + EPISODE INDEX；`single.php`/`page.php` 加 filebar 与
  KEY VISUAL 帧标；`archive.php`/`search.php` 用同一套 archive hero；`404.php` 用
  MISSING FRAME；`sidebar.php` 加 production notes 栏头；`footer.php` 把 newsletter
  收成两列。`template-parts/post-item.php` 把 meta 移到第四列，无缩略图时输出
  `NO KEY FRAME`。
- **真实数据**：`yuki_production_stats()` 用 `wp_count_posts()`、`wp_count_terms()`、
  `get_lastpostdate()`，不写死话数，也不伪造更新日期。
- **刻意改底色**：`--yuki-background` 从 `#FDFBF7/#18181F` 改为 `#EDE8DC/#0F1720`，
  让评论区、说说、页脚、截图和 J 的纸面共用一张纸。`--yuki-muted`、默认
  `--yuki-primary`、宽度 token 均未改。
- **字体**：资料集小标签用窄体/等宽栈；页面标题继续跟随自定义器字体设置，避免
  `verify-font` 的字体切换失效。没有引入 Google Fonts 或构建。
- **截图**：`screenshot.png` 用 `node tests/bin/make-screenshot.mjs` 重拍为 1200×900。

### 验收

- `node tests/bin/verify-ui-redesign.mjs`：**50/50**。
- 既有 28 个 `tests/bin/verify-*.mjs`（含 `verify-package`）：**全部 rc=0**；
  `verify-package` 65/65。
- `wptk check`：**0 error / 0 warning / 8 info**，8 条均为既有项。
- `languages/yuki.pot`：153 条（含主题头 Description），169 个行号引用全部指向真实
  gettext 调用，`check-pot` 全绿。
- `tests/bin/shuoshuo-density-fixtures.php` 增加专用分类清理：灯箱/关联文章验收会把
  说说挂到当前 theme mod 指向的分类，上一次全量留下的条目会污染密度测量；只清
  `yuki-test-density-shuoshuo`，不碰其他分类。

### 已知边界

- 深色生产信息栏固定为 `#081018`，比纸面 `#0F1720` 更深；这是刻意的双层纸面。
- 窄体依赖系统字体（Oswald / Archivo Narrow / Arial Narrow），缺失时回退到 sans；
  不额外请求字体文件。
- `ui-redesign/` 是本地截图/调试目录，不进入提交；`probe.mjs`、`inspect.mjs`、
  `final-shots.mjs` 在收尾时删除。
