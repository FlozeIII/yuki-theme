# 01: 文章末尾给出三篇关联文章

**What to build:** 在单篇文章的上下篇之后、评论之前，放一块关联文章：同分类优先，不足用同标签补，
最多 3 篇，排除当前文章。没有关联时整段不输出；说说文章不显示。

**查询。** 新文件 `inc/related-posts.php`：`yuki_related_posts( $post_id, $limit )`。
第一轮同分类、按日期倒序；不足时用同标签补齐，排除当前与已选。关联结果排除说说的承载分类。
不随机、不回退到最新文章。

**渲染。** 新模板片段 `template-parts/related-posts.php`：`<nav aria-label="相关文章">` +
`<h2>` + 三项（标题 + 日期），无缩略图。空时直接返回。`single.php` 只加一处模板调用。

**样式。** `style.css` 用现有 token：顶部一条分隔线，标题 18px/600，项 15px，日期 12px 弱化色，
hover 用主色；不新添颜色。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `1dec518`）。

- [x] 当前文章页有关联区块，正好 3 条
- [x] 同分类的两篇排在前面，同标签的一篇补足第三位
- [x] 当前文章不在关联里
- [x] 没有关联的文章页不输出整段
- [x] 说说文章页不输出关联，即使其分类下还有别的说说
- [x] 关联结果不包含说说分类里的文章
- [x] 关联区块在上下篇之后、评论之前
- [x] 样式只用已定义 token，没有硬编码颜色
- [x] `single.php` 只加一处模板调用；查询与渲染在新文件里
- [x] 「相关文章」文案走 `__()`，`languages/yuki.pot` 按 HEAD + 本件文件重建
- [x] HTTP 断言覆盖条数、顺序、排除与位置

## Comments

### 实现

- **查询**：新文件 `inc/related-posts.php` 的 `yuki_related_posts( $post_id, $limit )`。
  第一轮同分类（`wp_get_post_categories`），按 `date DESC` 最多 3 篇；不足时用同标签
  （`wp_get_post_tags`）补齐剩余数量，`post__not_in` 排除当前文章与已选文章。结果再用
  `category__not_in` 排除说说的承载分类。不随机、不回退到最新文章。
- **说说**：当前文章在说说的承载分类里时直接返回空——短碎片不挂延伸阅读。
- **渲染**：新模板片段 `template-parts/related-posts.php`。空时直接 `return`，不输出标记。
  `<nav class="yuki-related" aria-label="相关文章">` + `<h2>` + 三项（标题 + 日期），无缩略图。
- **接入**：`single.php` 在 `.yuki-post-nav` 之后、`comments_template()` 之前加一处
  `get_template_part()`；`functions.php` 在 inc 的显式 require 列表末尾加一行。
- **样式**：`style.css` 的「相关文章」段只用现有 token：分隔线、18px 标题、15px 条目、
  12px 弱化日期；hover 用主色，深色模式单独一条。没有硬编码颜色。

### 验收

新增 `tests/bin/related-posts-fixtures.php` 与 `tests/bin/verify-related-posts.mjs`，**20/20**。

造数：当前文章在分类 A、带标签 T；分类 A 下两篇较新的文章；分类 B 下两篇带标签 T 的较旧文章；
一篇独居分类 C、无标签的文章；一条说说分类下的短说说。

实测：关联正好 3 条，顺序为 A-1、A-2、T-1；当前文章与 T-2 都不在关联里；没有关联的文章整段不输出；
说说文章整段不输出；区块位置在上下篇之后、评论之前；样式无硬编码颜色。

回归：编辑器对齐 58/58、图片灯箱 39/39。

### 文案与生成物

`languages/yuki.pot` 按 `AGENTS.md` 第 5 条重建：`git archive HEAD` 到临时目录，只把本件新增的
`template-parts/related-posts.php` 拷进去，再跑生成器。生成 93 条，「相关文章」的 `#:` 指向
`template-parts/related-posts.php:16` 与 `:17`（aria-label 与 heading 共用一条 msgid）。

### 已知边界

- 当前文章有多个分类时，任一分类下的文章都算「同分类」；不按分类亲疏排序。
- 标签补齐只看当前文章自己的标签，不做相似度计算。
- 没有「最新文章」兜底；没有关联就整段不出现。
