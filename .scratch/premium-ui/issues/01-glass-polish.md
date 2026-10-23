# 工单 01 · 玻璃精修与动效

Status: ready-for-agent

> **已被取代**：玻璃层/科技 HUD 层已删除，当前视觉以 `.scratch/flat-ui/spec.md` 与 `assets/css/flat.css` 为准；本文件仅保留历史决策。

## What to build

在数字档案层之上加一层 `assets/css/premium.css`：圆角矩形、轻量玻璃、层次阴影和短促入场/悬停动画。模板、宽度和已有 token 不动。

## 范围

- 新建 `assets/css/premium.css`。
- `inc/production-bible.php` 在优先级 30 入队 `yuki-premium`，依赖 `yuki-archive-console`、`yuki-components`、`yuki-site-modules`、`yuki-mascot-card`。
- 覆盖表面：导航、侧栏 `.yuki-widget`、`.yuki-tag-wall`、`.yuki-subscribe-card`、`.yuki-toc`、`.yuki-series`、`.yuki-post-nav a`、`.yuki-character-sheet`、`.yuki-article-featured`、`.yuki-post-thumb`、`.yuki-stats-bar`、`.yuki-search-dialog`、按钮/输入。
- 动效：封面/角色卡/列表/侧栏入场，卡片 hover 上浮，按钮扫光，导航阴影；reduced-motion 全关。
- 不碰 `.yuki-post-item:hover` 背景、`.yuki-post-thumb` 的 `-1px`、`.yuki-btn` 背景、`.yuki-code-copy` 背景、`.yuki-comment-body` 背景、`.yuki-empty-state p` 的 16px 圆角。

## Blocked by

无。

## 验收

- [x] `premium.css` 在全部前台页面加载，且排在现有档案样式之后；没有新增 JS。
- [x] 侧栏卡片/标签墙/订阅卡/目录/系列/上下篇/角色卡/证据图框有 14–26px 圆角，按钮/输入 10–12px。
- [x] 导航、侧栏卡片、标签墙、订阅卡、角色卡、搜索框在支持的浏览器上有可见的 `backdrop-filter`，不支持时仍有实色回退。
- [x] 首页有短距入场，列表项依次出现；悬停卡片/按钮有层次反馈，不改变正文宽度与布局。
- [x] 单篇正文、评论、代码块仍是实色，宽度 724px、侧栏 300px 不变。
- [x] 640px 无横向滚动；深色玻璃文字仍可读。
- [x] `prefers-reduced-motion: reduce` 下新增动画与 transform 关闭。
- [x] `verify-premium-ui` 通过；既有 32 个脚本与 `verify-package` 通过。
- [x] `DESIGN.md` 增加这一层；只提交自己的路径。

## Comments

### 实现

- 新 `assets/css/premium.css`：`--yp-radius-sm/md/lg/xl` 10/14/20/26px，玻璃 light/dark
  与 soft/lift 阴影。
- 覆盖导航、侧栏 widget、标签墙、订阅卡、目录、系列、上下篇、角色卡、证据图框、缩略图、
  数据条、搜索对话框、文章内组件与按钮/输入。filebar 也用 10px 圆角。
- `yp-rise` 用于封面/角色卡/列表/侧栏/单篇头部；`yp-sheen` 用于 hero 极轻扫光；
  `fill-mode: backwards` 不覆盖 hover。
- `@supports not (backdrop-filter: blur(1px))` 回退实色；reduced-motion 关闭新增动画与
  transform。

### 验收

- `verify-premium-ui` 36/36；33 个 `tests/bin/verify-*.mjs` 全部 rc=0；
  `verify-package` 65/65；`wptk check` 0 error / 0 warning / 10 info。
- 截图检查：浅色/深色首页、单篇、390px 手机；正文 722px、侧栏 300px 未变，640px 无横向滚动。
- `make-screenshot.mjs` 在截图前多等 700ms，避免入场动画未落定时截到半透明帧。

### 已知边界

- 玻璃只用于导航/侧栏/目录/证据等表面；正文、评论、代码块保持实色。
- 支持 `backdrop-filter` 的浏览器看到真实模糊；不支持的浏览器得到实色回退。
- 动效只在减少动效设置之外启用；没有打开 reduced-motion 的用户会看到一次入场与 hover 反馈。
