# 保持 classic 形态，不引入 theme.json

**Status**: accepted

## 决定

主题继续以 PHP 模板加一份 `style.css` 呈现，**不引入 `theme.json`**。编辑器与前台共享同一份样式：正文规则用
`:is(.yuki-prose, .editor-styles-wrapper)` 同时覆盖两端；布局宽度由 `style.css` 里的 CSS 变量定义，
`DESIGN.md` 记录数值。

## 理由

- **视觉规范只有一个来源。** `DESIGN.md` 与 `style.css` 已经是这份主题的规范；把色板、字号、布局再写进
  `theme.json`，就有了第二份会漂移的真相源，而仓库没有构建步骤去同步它们。
- **编辑器里的色板与字号选择器对这个站价值很低。** 这是自托管单人博客，作者就是站长；`theme.json`
  换来的主要是「在编辑器里挑配色」这类能力。
- **对齐与编辑器样式不需要它。** `align-wide`、`responsive-embeds`、`add_editor_style()` 在 classic
  主题里都能工作，宽度交给 CSS 变量即可。

## 被否掉的方案

- **只放 `settings`**（布局宽度、色板、字号进 JSON）。编辑器与前台由核心生成布局样式，视觉细节留 CSS。
  问题是同一套色值与字号存在两个地方，改一个忘一个时没有任何断言会红。
- **`settings` + `styles`**。这是走向区块主题的第一步，等于现在就开始一次主题形态的迁移。那是应该
  单独拍板的事，不该塞进「对齐」这张工单里。

## 影响

- 编辑器画布的宽度只能由 CSS 约束（`.editor-styles-wrapper`），不能由核心的 layout 设置生成。
- 编辑器只能对齐**浅色**形态：深色是访客浏览器里的切换开关，编辑器读不到它。深色 token 不进编辑器。
- Theme Check 的 `register_block_pattern`、`register_block_style`、`wp-block-styles` 会作为
  RECOMMENDED 残留继续存在。它们记在发布工单里，不让工具的红绿决定主题形态。
- 将来真要迁到区块主题，先推翻本条，而不是逐个文件「顺手加上 `theme.json`」。
