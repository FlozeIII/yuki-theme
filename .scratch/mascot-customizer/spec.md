# 自定义吉祥物

Status: ready-for-agent

## Problem Statement

吉祥物现在是主题自带的雪兔照片卡：`template-parts/mascot.php` 写死图片，`index.php` 的角色卡写死「雪兔 / 本站看板角色 / 雪 / 线稿」。站长换不了自己的角色，也没法在不想展示时隐藏它。

## Solution

在外观 → 自定义里增加「Yuki 吉祥物」一节：

- 上传方形图片，留空回退默认雪兔。
- 显示 / 隐藏吉祥物。关闭后首页角色卡、404 与空状态的吉祥物一起隐藏。
- 名称、身份两个文本字段，显示在角色卡的 DESIGNATION / CLASS 两栏。
- 高度保持 `120 px`；来源在自定义图片时显示「自定义」，默认图显示「雪 / 线稿」。
- 底部季节色条保留。
- 不做任意 URL 输入、裁剪器、四字段全覆盖，也不改卡片/季节逻辑。

## User Stories

1. 作为站长，我可以上传一张自己的方形角色图，替换默认雪兔。
2. 作为站长，我可以填写角色的名称和身份，让角色卡不再写死「雪兔 / 本站看板角色」。
3. 作为站长，我可以隐藏吉祥物；首页角色卡和 404/空状态不再出现它。
4. 作为访客，我看到的是站长配置的角色卡，图片是站内资源，读屏软件不会把装饰图当内容。
5. 作为主题维护者，我可以在不启用的站点上看到默认雪兔与默认文案，行为与现在一致。

## Implementation Decisions

- 新 `inc/mascot.php`，在 `functions.php` 显式 require；Customizer 节 id `yuki_mascot`，优先级 153。
- 设置：
  - `yuki_mascot_enabled`：bool，默认 true。
  - `yuki_mascot_image`：URL，默认空字符串；用 `WP_Customize_Image_Control`。
  - `yuki_mascot_name`：文本，默认「雪兔」；空值回退默认。
  - `yuki_mascot_role`：文本，默认「本站看板角色」；空值回退默认。
- 读取封装在 `yuki_mascot_*()` 中；图片为空时用 `get_theme_file_uri( 'assets/images/mascot-yuki.png' )`。
- `yuki_mascot_is_enabled()` 同时供模板和首页条件使用；`template-parts/mascot.php` 在关闭时直接返回。
- 首页角色卡整块随开关隐藏；`.yuki-cover-grid` 加 `yuki-cover-grid--solo`，单列铺满，避免右侧留空。
- 自定义图片时 `ORIGIN` 显示「自定义」，不写死「雪 / 线稿」。
- 图片用 `esc_url`，文本用 `esc_html`；`alt=""` 与 `aria-hidden="true"` 保留，角色语义由文字承担。
- 不新增 JS，不改宽度 token（768/1120/1120/300/48）与 B 外壳策略。

## Testing Decisions

- `tests/bin/mascot-customizer-fixtures.php`：保存当前主题设置，切到「自定义」和「隐藏」两种模式；`--cleanup` 恢复原值并删除备份。
- `tests/bin/verify-mascot.mjs`：
  - 默认：图片卡、默认图片、默认文案、首页/404/空状态仍在。
  - 自定义：首页图片 URL、名称、身份、来源「自定义」；浏览器量卡片尺寸/无横向滚动。
  - 隐藏：首页无角色卡、无吉祥物；404 无吉祥物；恢复后默认状态仍通过。
  - 静态：Customizer 注册、require、设置名、图片控件、空值回退、POT 文案。
- 回归：`verify-season`（默认状态季节色条）、`verify-ui-redesign`、`verify-site-modules`、`verify-editor-alignment`、`verify-package`。

## Out of Scope

- 任意远程 URL、图片裁剪器、每篇文章单独换角色。
- 修改角色卡四栏结构、高度、季节色条或数字档案外壳。
- 新增区块/页面模板。

## Further Notes

- 主题版本仍 1.3.0；这是未发版的下一批改动。
- 图片建议 512×512；`object-fit:cover` 会裁切非方形图。
- 隐藏开关只影响装饰性吉祥物，不影响作者头像。
