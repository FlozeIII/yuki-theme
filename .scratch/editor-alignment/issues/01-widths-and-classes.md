# 01: 正文有一份宽度契约，对齐与图注类真的生效

**What to build:** 把「正文多宽」收成一组 CSS 变量，改写现有硬编码宽度；补上 Theme Check 点名的
8 个类；声明 `align-wide` 与 `responsive-embeds`。`DESIGN.md` 增加「布局」一节，记录数值与单篇/无侧栏的差异。

**宽度契约。** 正文列宽 768px、宽对齐最大 1120px、容器 1120px、侧栏 300px、间距 48px，全部落成 `:root`
变量；`.yuki-container`、`.yuki-narrow`、`.yuki-post-list`、`.yuki-article-header`、
`.yuki-single-layout` 改引用变量，不再各写裸数字。

**宽对齐分模板。** 单篇主列约 772px，宽块在那里**退化为正文列宽**，不越界、不遮侧栏；`page.php` 与
说说没有侧栏，宽块可以到 1120px。这个差异是刻意的，写进 `DESIGN.md`。

**8 个类。** `.alignleft`、`.alignright`、`.aligncenter`、`.wp-caption`、`.wp-caption-text`、
`.gallery-caption`、`.sticky`、`.bypostauthor`。前六个是正文呈现；后两个是语义标记，样式克制到不影响阅读。
**只用现有 token，不新添颜色。**

**区块支持。** `add_theme_support( 'align-wide' )` 与 `add_theme_support( 'responsive-embeds' )`；
**不加 `wp-block-styles`**（核心默认区块样式会与手写的 `.yuki-prose` 规则互相覆盖）。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

- [ ] 左/右/居中对齐在正文明细里真的生效，浮动有清除机制
- [ ] 图注与画廊图注使用主题的字号、颜色、间距，而不是浏览器默认
- [ ] 窄屏下左/右浮动收成居中或占满宽度，页面不出现横向滚动
- [ ] 置顶文章在列表里有克制的标记；作者本人的评论在评论区有克制的标记
- [ ] 新增规则没有硬编码颜色，色值全部来自已定义 token
- [ ] 正文/宽对齐/容器/侧栏/间距的数值只在一处定义，现有规则改为引用变量
- [ ] 单篇里宽块不越过主列、不遮侧栏；页面与说说里宽块可达 1120px
- [ ] `align-wide` 与 `responsive-embeds` 已声明；`wp-block-styles` 没有声明
- [ ] `DESIGN.md` 的「布局」一节与 CSS 变量一致
- [ ] 嵌入内容在正文里自适应宽度，不撑破布局

## Comments
