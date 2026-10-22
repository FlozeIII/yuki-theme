# 工单 01 · 自定义吉祥物

Status: ready-for-agent

## What to build

把写死的雪兔照片卡改成可配置的「Yuki 吉祥物」：

- 外观 → 自定义 →「Yuki 吉祥物」。
- 图片上传（方形，留空回退默认雪兔）、显示/隐藏、名称、身份。
- 首页角色卡、404、空状态都读同一组设置；关闭时首页整块角色卡隐藏，网格变单列。
- 默认状态与现在完全一致：默认图片、`雪兔`、`本站看板角色`、`120 px`、`雪 / 线稿`、季节色条。

## 范围

- 新建 `inc/mascot.php`；`functions.php` 末尾 require。
- `template-parts/mascot.php` 改读设置；关闭时返回空。
- `index.php` 角色卡改读名称/身份/来源，开关关闭时不输出整块，grid 加单列类。
- `assets/css/production-bible.css` 增加 `.yuki-cover-grid--solo`。
- 新增 `tests/bin/mascot-customizer-fixtures.php`，扩展 `tests/bin/verify-mascot.mjs`。
- 重建 `languages/yuki.pot`；更新 `README.md`、`DESIGN.md`、`.scratch/roadmap/map.md`。

## Blocked by

无。

## 验收

- [x] 自定义器出现「Yuki 吉祥物」节，图片控件、显示开关、名称/身份字段都可保存。
- [x] 默认状态：首页/404/空状态显示默认雪兔，名称「雪兔」、身份「本站看板角色」、来源「雪 / 线稿」。
- [x] 自定义状态：首页卡片显示上传图、自定义名称与身份、来源「自定义」；默认文案不再出现在角色卡里。
- [x] 隐藏状态：首页不输出角色卡，404/空状态不输出吉祥物；grid 单列、无右侧空白。
- [x] 空名称/空身份/清空图片都回退默认；URL 经 `esc_url`，文本经 `esc_html`。
- [x] `verify-season`（默认状态）仍找到季节色条；`verify-ui-redesign`、`verify-site-modules`、`verify-editor-alignment` 通过。
- [x] `verify-package` 65/65；POT 含新增文案；`wptk check` 无新增 error/warning。
- [x] 只提交本工单文件，`git log --stat -1` 核对；holds 自己的行已删除。

## Comments

- 实现：`inc/mascot.php` 注册 `yuki_mascot` 节（enabled/image/name/role），`functions.php` require；`template-parts/mascot.php` 读设置并在关闭时返回空；`index.php` 角色卡读名称/身份/来源，关闭时输出 `.yuki-cover-grid--solo` 且不输出角色卡；`production-bible.css` 加单列规则。
- 加载与文案：图片默认 `assets/images/mascot-yuki.png`，自定义图来源「自定义」，默认「雪 / 线稿」；名称/身份空值回退；季节色条保留；`esc_url`/`esc_html`。
- 验收：`verify-mascot` 53/53；32 个 `verify-*.mjs` 全绿；`verify-package` 65/65；`wptk check` 0 error/0 warning/10 info（两条 `html.img-alt` 为动态 PHP 图片误报）。
- 边界：不做任意 URL/裁剪器；自定义图建议 512×512；隐藏后首页单列，404/空状态仍不显示吉祥物；POT 192 条/222 引用。

