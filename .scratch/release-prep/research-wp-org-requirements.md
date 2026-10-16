# 调研：WordPress 主题发布要求

Type: research
Status: resolved
日期: 2026-10-16

一手来源：

- [Required（必过项）指南](https://make.wordpress.org/themes/handbook/review/required/)（更新于 2026-06-09，审核的权威清单）
- [Required Theme Files](https://developer.wordpress.org/themes/release/required-theme-files/)
- [style.css 主样式表规范](https://developer.wordpress.org/themes/basics/main-stylesheet-style-css/)
- [Theme Check 插件页](https://make.wordpress.org/themes/handbook/review/required/theme-check-plugin/) · [官方仓库](https://github.com/WordPress/theme-check)
- [Theme Sniffer](https://make.wordpress.org/themes/handbook/theme-sniffer/)
- [Review Process](https://make.wordpress.org/themes/handbook/review/)
- [Themes Team 周报 2026-09-08](https://make.wordpress.org/updates/2026/09/09/themes-team-update-september-8-2026/)（队列数据）

**一句话结论：** 目录外分发（GitHub / 自托管 zip）**不需要送审**，只有「进官方目录」才受下面那套约束。所以本主题选定的自托管路线，真正要做的只有截图与一次体检。

## 1. 进官方目录的硬性文件

经典主题：`style.css` + `index.php` + `comments.php` + `screenshot` + **`readme.txt`**（最后一项由 Required §9 硬性要求，原文「A valid readme.txt file must be included.」）。

- **screenshot**：不大于 `1200 × 900px`，宽高比 **4:3**，顶层目录，`screenshot.png` 或 `screenshot.jpg`。缺失时**上传表单直接拒**（「The zip file must include a file named screenshot.png or screenshot.jpg.」）。
- **readme.txt 必需节**：Theme Name / Contributors / Requires at least / Tested up to / Requires PHP / License / License URI、≤150 字短描述，以及 `== Description ==`、`== Frequently Asked Questions ==`、`== Changelog ==`、`== Upgrade Notice ==`、`== Resources ==`。
- **style.css 必需头**：Theme Name / Author / Description / Version（X.X 或 X.X.X）/ Requires at least（X.X）/ Tested up to（只写数字）/ Requires PHP（只写数字）/ License / License URI / Text Domain。

## 2. 外部服务调用（本主题的最大风险点）

Required §9 原文：

> No remote resources are allowed without user consent … **Do not** fetch any files or data from a remote resource, including your websites, without the user's explicit consent. … This is because of GDPR and privacy requirements.

唯一的豁免是 Google Fonts。

**对本主题两条外呼的判断：**

- **一言**（页面加载即服务端请求 `v1.hitokoto.cn`）正属于「未获用户明示同意就向远程资源取数据」，**默认开启=不过审**。要合规必须：① 默认关闭、用户显式开启；② 在 readme.txt 里写明请求去向与关闭方式；③ 超时/缓存/兜底是好工程，但**不改变「默认外呼」违规这个事实**——合规的关键是 opt-in。
- **头像镜像**（改写 Gravatar 到 cravatar.cn / 自定义镜像）：没有针对 gravatar 的专门条文，但同受 §2 隐私与 §9 远程资源两条约束。改写 URL 本身用过滤器做是正确做法，问题在**默认启用**。建议默认关闭 + 披露。

（这两条只在走官方目录时成立。自托管分发不受约束。）

## 3. Theme Check

官方口径：「Themes have to pass the Theme Check plugin without errors before they can be included in the theme directory.」结果分 Required / Warning / Recommended / Info 四类，**Required 一条都不能有**。插件持续活跃（[github.com/WordPress/theme-check](https://github.com/WordPress/theme-check)），推荐用 WP-CLI：`wp theme-check run [<theme>] [--format=table|json]`。Theme Sniffer（PHPCS 规则）是建议项，非必过。

简单博客主题最常踩的 Required：缺 screenshot/readme；style.css 缺 Tested up to / Requires PHP / Text Domain；前缀不足 4 字母或不唯一（函数、常量、option、enqueue handle、image size 名）；输出未转义/入库未消毒；text domain 不等于 slug；缺经典主题钩子（`wp_head` `wp_footer` `wp_body_open` `body_class` `post_class` `wp_link_pages` `title-tag` `automatic-feed-links` `$content_width` `language_attributes`）；缺必备 CSS 类（`.sticky` `.bypostauthor` `.alignleft/.alignright/.aligncenter` `.wp-caption` `.wp-caption-text` `.gallery-caption`）；用 `TEMPLATEPATH`；禁用函数；plugin-territory（shortcode、`register_post_type`、SEO 选项、社交分享按钮、**资源缓存**）。

## 4. .pot 与 text domain

- text domain 必须**等于主题 slug**（`yuki`），且写进 style.css 的 `Text Domain:` 头——这是必过项。
- `.pot` 文件本身**不是**必过项。wordpress.org 的 GlotPress 直接解析源码。保留它属「预期/推荐」，对目录外分发更有实际价值。

## 5. 许可与捆绑

- 主题 zip 里的一切（代码、数据、图片、第三方库）必须 GPL 兼容。捆绑资源要逐个附许可、版权与来源，并集中列在 readme.txt 的 `== Resources ==` 节。
- 不得在主题目录里放 zip 或插件、不得自动装插件。不得捆绑 WP 已自带库的副本（jQuery 等），minified 文件必须同附原始文件。
- 禁止出现的文件：`.git` 等 VCS 目录、`thumbs.db`、`desktop.ini`、`php.ini`、`web.config`、`.sql`、`__MACOSX`、zip、隐藏文件。
- 前端只允许**最多一条**署名链接，且限于 style.css 的 Theme URI / Author URI。不得 upsell、不得隐瞒联盟链接。

## 6. 队列与目录外分发

- 队列（2026-09-08 官方数据）：新主题 62 票待审、审核员 13 人；过去 7 天放行新主题 46 个。官方明说「There are no exact time frames for the queues.」
- **目录外分发可以，不需送审。** 但 Required §14 仍然约束任何分发：只能分发 100% GPL 兼容的主题，且分发页面要在显眼处声明 GPL 兼容。商标方面不得用「WordPress / Theme / Twenty\*」字样。

## 7. 对 Yuki 的差距清单

| 项 | 现状 | 若走官方目录 | 若只自托管 |
|---|---|---|---|
| `screenshot.png` | 无 | **拦**（上传即拒） | **要补**（否则主题卡片空白） |
| `readme.txt` | 无 | **拦**（必过项） | 可选（README.md 已在） |
| 一言默认外呼 | 页面加载即请求 hitokoto.cn | **拦**（须改 opt-in + 披露） | 不受约束 |
| 头像→cravatar/自定义 | 已有，默认 gravatar 不重写 | 风险（建议默认关 + 披露） | 不受约束 |
| style.css 头 | 有（待核 Tested up to / Requires PHP / Text Domain） | 需补齐 | 建议补齐，近乎零成本 |
| .pot + gettext | 已有 `languages/yuki.pot` | 达标（.pot 非必需） | 达标 |
| 前缀 / 转义 / 钩子 / CSS 类 | 未核 | 必过项，需跑 Theme Check | 不强制 |
| LICENSE | GPL-2.0 已在 | 达标 | 达标（自托管只需 100% GPL 兼容） |
