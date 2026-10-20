# 03 · 页面与侧栏模块

Status: ready-for-agent

## What to build

把页面级重复模块收成可选组件，复用第一批的标签、边框和格线：

- **数据条**：显示文章数、分类数、最近更新；首页与归档可复用，数据来自 `yuki_production_stats()`，不写死。
- **标签墙**：分类/标签的密集列表，超过一定数量时限制高度并可展开；无 JS 时显示完整列表。
- **作者卡**：头像、名称、角色、一句话；无头像时用主题内的方块标记，不请求外部头像。
- **订阅卡**：标题、说明、表单；沿用现有 `#newsletter` 行为，不新增第三方服务。
- **页脚链接组**：把页脚导航拆成 2–3 列，支持菜单为空时的兜底。

要求：

- 优先用 `template-parts/` 新文件与 `inc/components.php` 的注册，不把逻辑堆进 `footer.php`。
- 所有输出转义；字符串用 `yuki` 文本域。
- 不改宽度 token、正文宽度和深色主题策略（B：浅色外壳跟随页面，深色保留控制台）。

## 范围

首页、归档、侧栏、页脚；不碰文章内 pattern 与单篇目录。

## Blocked by

01、02（组件样式与单篇契约稳定后）。

## 验收

- [x] 数据条与真实站点统计一致，空站不出现 NaN/0 条假数据。
- [x] 标签墙在长列表下不撑破侧栏；640px 无横向溢出。
- [x] 作者卡在无头像/有头像两种情况下布局稳定。
- [x] 订阅表单仍提交到现有处理路径，空邮箱有可读错误。
- [x] 页脚链接组在菜单为空时不渲染空列。
- [x] `tests/bin/verify-site-modules.mjs` 全绿；既有 29+ 脚本继续通过。
- [x] POT、DESIGN、issue、roadmap 同步。

## Comments

### 实现

- `inc/site-modules.php`：注册 `footer` 菜单位；入队 `assets/css/site-modules.css`（依赖
  `yuki-components`）与 `assets/js/site-modules.js`（无依赖、footer）。
- 五个模板部件：`site-stats.php`（复用 `yuki_production_stats()`）、`site-tag-wall.php`
  （`<details>` + 12 项折叠阈值）、`site-author-card.php`（只在头像 host 是本机时用
  `get_avatar_url()`，否则字母方块）、`site-subscribe.php`、`site-footer-links.php`
  （有 `footer` 菜单用菜单，否则站点/索引/关于三组兜底）。
- `sidebar.php` 换成作者卡、标签墙与订阅卡；`footer.php` 插入页脚链接组并给订阅邮箱加
  `required`；`index.php` 与 `archive.php` 复用数据条。
- 标签墙列表用 `.yuki-production-bible .yuki-widget .yuki-tag-wall-list` 压过旧
  `.yuki-widget ul { display:flex }`，否则标签会挤成一行。
- 没有新增外部请求；作者头像只接受本站 URL。新闻订阅仍由主题现有前端行为接管，不接第三方。

### 验收

- `verify-site-modules` **34/34**：五个模块在首页/归档/侧栏/页脚；长标签墙收起与点击展开；
  空邮箱 `checkValidity() === false`；桌面三列、640px 单列且无横向溢出；归档数据条。
- `verify-hitokoto` 的侧栏兜底断言改为「作者/分类/热门 + 标签墙」，**46/46**。
- 关联脚本：`verify-reading` 39/39、`verify-ui-redesign` 58/58、`verify-editor-alignment` 58/58、
  `verify-font` 18/18、`verify-motion` 19/19、`verify-comment-nesting` 53/53、
  `verify-package` 65/65；全套 32 个脚本 rc=0。
- 页脚新增「登录」链接后，`verify-comment-pending` 原来用正文里有没有 `wp-login.php`
  判断是否被带去登录，会把合法链接误报成跳转；已改成只看 3xx 的 `Location`，33/33。
- `wptk check` 0 error / 0 warning / 10 info；其中 `template-parts/site-author-card.php:26`
  与 `patterns/archive-evidence.php:14` 的 `html.img-alt` 是扫描器对动态 PHP 属性的误报，
  两处实际都有 `alt`（作者头像是装饰性空 alt）。其余 8 条为既有项。

### 已知边界

- 数据条展示全站统计，不随分类/搜索条件变化；归档另有 entries 数。
- 标签墙的折叠阈值是 12，仅在前端 JS 可用时收起；无 JS 始终完整展开。
- 订阅卡只做前端校验，不新增邮件服务；真正的订阅处理仍走站点既有路径。
