# 前台发说说

Status: ready-for-agent
Type: spec

## Problem Statement

说说现在是「已经发出去的内容」：要发一条，站主得进后台、新建文章、选说说分类、发布，再回到前台看。
对一条短碎片来说，这条路径太重。

说说归档本身已经是站主看内容的地方；把「写一条」放在那里，才符合「单人作者的表达工具」这条线。

## Solution

在说说归档顶部、列表之前，给有 `publish_posts` 权限的登录用户一个写作框：填正文、点发布，
普通表单 POST + 重定向回归档，新说说出现在列表顶部。无标题、发布即公开。

匿名访客看不到写作框，也发不了；空内容、坏 nonce、无权限都明确拒绝，不静默吞掉。失败时保留正文。

不改说说的数据模型：仍然是一条 `post`，在配置好的说说分类里。

## User Stories

1. 作为站主，我希望在说说归档里直接写一条并发布，不用进后台。
2. 作为站主，我希望发布后立刻在归档顶部看到它。
3. 作为站主，我希望说说不需要标题，写完正文就能发。
4. 作为站主，我希望发布失败时写的内容还在，不用重打一遍。
5. 作为访客，我不该看到写作框，也不该能通过直接 POST 发内容。
6. 作为设计者，我希望这件事复用现有 token 与按钮，不引入新的编辑器或媒体上传。

## Implementation Decisions

### 入口

- `archive.php` 在 `$yuki_is_shuoshuo` 为真时，于 `<main class="yuki-container">` 内、列表之前调用
  `template-parts/shuoshuo-composer.php`。
- 模板片段自己再判一次 `current_user_can( 'publish_posts' )`；不具备就 `return`。

### 表单与提交

- 表单 `method="post"`、`action=admin_url( 'admin-post.php' )`，隐藏 `action=yuki_shuoshuo_publish`，
  `wp_nonce_field( 'yuki_shuoshuo_publish', 'yuki_shuoshuo_nonce' )`。
- 字段：`content` 一个 textarea（必填）；无标题字段。
- 提交后**普通重定向**回归档（`wp_safe_redirect`），不用 AJAX。
- 发布：`wp_insert_post()`，`post_type=post`、`post_status=publish`、`post_author=当前用户`、
  `post_category=[说说分类]`、`post_title=''`、`post_content=wp_kses_post( 去斜杠并 trim )`。
- 成功：重定向到归档并带 `yuki_shuoshuo_posted=1`，表单上方显示「说说已发布。」。
- 失败：重定向到归档并带 `yuki_shuoshuo_error=<code>`；表单上方按 code 显示一句可照做的话。
  非空正文写入一个 5 分钟的 per-user transient，表单渲染时取出并删除——重定向后内容还在。

### 权限与失败码

- 只有 `publish_posts` 能提交；贡献者与订阅者看不到表单，直接 POST 也会被拒绝。
- 失败码：`empty`（正文为空）、`nonce`（nonce 失效）、`failed`（入库失败）、`no_category`
  （说说分类未配置）、`capability`（无权限）。
- 不允许开放重定向：目标固定为说说归档（或首页兜底），走 `wp_safe_redirect`。

### 视觉

- 卡片：`--yuki-card` 底、`--yuki-border` 边框、`--yuki-radius-lg` 圆角。
- textarea：`--yuki-background` 底、`--yuki-input` 边框、`--yuki-radius-md`；focus 用 `--yuki-ring`。
- 按钮复用 `.yuki-btn`；不新增颜色，不引入媒体上传或富文本编辑器。
- 错误/成功提示用中性左边线，不新造「危险色」——与评论错误框同一取舍。

### 明确不做的

- 不做 AJAX 就地插入。
- 不做草稿、定时发布、编辑/删除已有说说。
- 不做图片上传、富文本、标签/分类选择。
- 不放开给贡献者或匿名访客。

## Testing Decisions

### Seam

HTTP + 登录 cookie。表单是普通的 `admin-post.php` POST，`lib.mjs` 的 `postForm`
支持带 cookie 与 `redirect: 'manual'`，不需要新观察点。

### 要测的模块

- 匿名 GET 归档：没有写作框；匿名 POST：不产生说说。
- 登录 GET 归档：写作框、nonce、textarea、发布按钮都在。
- 登录 POST 正常正文：产生一条 `publish` 的说说、在说说分类里、出现在归档顶部。
- 空正文：不产生说说，重定向带 `error=empty`。
- 坏 nonce：不产生说说，重定向带 `error=nonce`；非空正文在重定向后的表单里还在。
- 无权限用户（订阅者）：看不到表单，直接 POST 不产生说说。
- 归档里出现成功提示。

### 明确不测什么

- 富文本/媒体上传（不在这一版）。
- 草稿与定时发布。
- 编辑器内的说说发布。

## Out of Scope

- AJAX 提交、就地插入。
- 草稿、定时、编辑/删除。
- 贡献者的待审说说。
- 媒体上传与富文本。

## Further Notes

- 共享文件：`functions.php`（显式 require）、`style.css`、`languages/yuki.pot`。开工前挂
  `.scratch/holds.md`，提交后删掉。
- 新文件优先：`inc/shuoshuo-composer.php` 放处理器，`template-parts/shuoshuo-composer.php` 放表单；
  `archive.php` 只加一处调用。
- 文案需要重建 `yuki.pot`（HEAD + 本件文件）。
- 测试登录 cookie 沿用 `editor-styles-fixtures.php` 的做法：`WP_Session_Tokens::create` 建真实会话，
  种 `AUTH_COOKIE` 与 `LOGGED_IN_COOKIE`，验完销毁 token。
