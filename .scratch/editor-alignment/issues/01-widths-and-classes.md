# 01: 正文有一份宽度契约，对齐与图注类真的生效

**What to build:** 把「正文多宽」收成一组 CSS 变量，改写现有硬编码宽度；补上 Theme Check 点名的
8 个类；声明 `align-wide` 与 `responsive-embeds`。`DESIGN.md` 增加「布局」一节，记录数值与单篇/无侧栏的差异。

**宽度契约。** 窄栏容器 768px（含 24px 内边距，正文文字宽约 720）、宽对齐最大 1120px、容器 1120px、
侧栏 300px、间距 48px，全部落成 `:root` 变量；`.yuki-container`、`.yuki-narrow`、`.yuki-post-list`、
`.yuki-article-header`、`.yuki-single-layout` 改引用变量，不再各写裸数字。

**宽对齐分模板。** 单篇主列 724px（容器内容宽 1072 − 300 − 48），宽块在那里**退化为正文列宽**，
不越界、不遮侧栏；`page.php` 与说说没有侧栏，宽块可以到 1120px。这个差异是刻意的，写进 `DESIGN.md`。

**8 个类。** `.alignleft`、`.alignright`、`.aligncenter`、`.wp-caption`、`.wp-caption-text`、
`.gallery-caption`、`.sticky`、`.bypostauthor`。前六个是正文呈现；后两个是语义标记，样式克制到不影响阅读。
**只用现有 token，不新添颜色。**

**区块支持。** `add_theme_support( 'align-wide' )` 与 `add_theme_support( 'responsive-embeds' )`；
**不加 `wp-block-styles`**（核心默认区块样式会与手写的 `.yuki-prose` 规则互相覆盖）。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `a27da2b`）。

- [x] 左/右/居中对齐在正文明细里真的生效，浮动有清除机制
- [x] 图注与画廊图注使用主题的字号、颜色、间距，而不是浏览器默认
- [x] 窄屏下左/右浮动收成居中或占满宽度，页面不出现横向滚动
- [x] 置顶文章在列表里有克制的标记；作者本人的评论在评论区有克制的标记
- [x] 新增规则没有硬编码颜色，色值全部来自已定义 token
- [x] 正文/宽对齐/容器/侧栏/间距的数值只在一处定义，现有规则改为引用变量
- [x] 单篇里宽块不越过主列、不遮侧栏；页面与说说里宽块可达 1120px
- [x] `align-wide` 与 `responsive-embeds` 已声明；`wp-block-styles` 没有声明
- [x] `DESIGN.md` 的「布局」一节与 CSS 变量一致
- [x] 嵌入内容在正文里自适应宽度，不撑破布局

## Comments

### 宽度契约

`:root` 新增 `--yuki-content-width`、`--yuki-wide-width`、`--yuki-container-width`、
`--yuki-sidebar-width`、`--yuki-layout-gap`；`.yuki-container`、`.yuki-narrow`、`.yuki-post-list`、
`.yuki-article-header`、`.yuki-single-layout` 全部改为引用变量，裸数字只剩 `:root` 一处。
`DESIGN.md` 增加「布局」一节，与变量同一提交落地。

**一处数值更正。** `box-sizing: border-box` 下容器的 1120 含左右 24px 内边距，所以单篇主列是
**724px**（1072 − 300 − 48），不是先前记的 772。`DESIGN.md`、spec 与本件里的数字都已改直；
正文文字宽约 720px，这也是 02 里编辑器画布该对齐的宽度。

### 宽对齐

- `.yuki-prose .alignwide/.alignfull` 在单篇里只做约束：`width: 100%`，天然被主列夹住，
  不加负外边距，因此不会去碰侧栏。
- 只有 `.yuki-narrow .yuki-prose .alignwide/.alignfull` 做突破：`width: min(1120px, calc(100vw - 48px))`
  加居中负外边距；页面模板的宽块实测 1120px。
- **不做全出血**：`.alignfull` 也止于 1120px。`width: 100vw` 会在有滚动条的桌面上多出十几像素，
  这个主题也没有全出血的设计语言。
- 窄屏下 clamp 会吃掉窄栏的一点内边距（640px 视口：宽块 592px、窄栏 625px），硬线是**不横向滚动**；
  验证脚本按「不超出窄栏容器」断言，而不是「不超出正文」——宽块本来就该比正文宽。

### 8 个类

- 对齐与图注全部挂在 `.yuki-prose` 下，只用现有 token；浮动图注补了 `.wp-caption.alignleft/.alignright`
  的外边距，否则图注会和正文贴住。
- `.yuki-prose::after` 清除浮动，图片不会漏进标签、上下篇与评论区。
- 640px 以下左/右浮动收成不浮动、水平居中。
- `.sticky`：`template-parts/post-item.php` 改走 `post_class( 'yuki-post-item' )`，列表项才会带上
  `sticky`；标记是左侧一条主色竖线（`::before`），不引入不可翻译的 `content` 文本。
- `.bypostauthor`：核心在「评论作者 == 文章作者」时给类（`comment-template.php:541`）；标记是
  `.comment-body` 左侧主色内阴影，不新添颜色。

### 区块支持

`align-wide` 与 `responsive-embeds` 已声明；`wp-block-styles` 没有声明（ADR 0003 与 spec 的理由）。
`responsive-embeds` 的自适应由核心实现，验收脚本断言这项支持确实存在。

### 验收

新增 `tests/bin/editor-alignment-fixtures.php` 与 `tests/bin/verify-editor-alignment.mjs`，**58/58**。

- 造数：一个页面（左右/居中图片、图注、画廊图注、宽块）、一篇单篇（宽块）、一条作者本人的评论。
- 静态：5 个变量、5 处引用、8 个类、无硬编码颜色、支持项、`post_class()`。
- HTTP：页面上确实带着这些类；作者评论确实带 `bypostauthor`。
- 真浏览器：浮动方向、居中的零偏移、图注 13px 与 token 颜色、页面宽块 1120px、单篇宽块 724px
  不遮侧栏、640px 下不浮动且无横向滚动、作者评论的主色内阴影。
- **`.sticky` 没有真浏览器断言**：它要改全站 `sticky_posts` 才会出现在首页，那是别的会话也会读到的
  全局设置，不值得为一次验收改掉。规则与模板两处都断言了。

回归（工作区，全部通过）：说说版式 43/43、点赞 63/63、嵌套 53/53、防垃圾 34/34、截图 15/15、
评论提交 173/173、Theme Check 缺陷 33/33。

### 已知没做

- 编辑器接入（`add_editor_style()`、`:is(.editor-styles-wrapper)`、画布宽度）留给 02。
- `alignfull` 不做全出血，是刻意的约束，不是漏写。
