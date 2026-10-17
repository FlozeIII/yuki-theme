# 01: 在说说归档里直接发一条

**What to build:** 说说归档顶部给有 `publish_posts` 权限的登录用户一个写作框：正文 + 发布，
普通表单 POST 到 `admin-post.php`，成功后重定向回归档，新说说出现在列表顶部。无标题、发布即公开。

**权限。** 只有 `publish_posts` 能看到表单与提交；匿名与订阅者都不行。直接 POST 也要被拒。
**失败。** 空正文、坏 nonce、入库失败、说说分类未配置都重定向带错误码；非空正文用 5 分钟
per-user transient 保留，重定向后表单里还在。不允许开放重定向。

**文件。** 新 `inc/shuoshuo-composer.php`（处理器）与 `template-parts/shuoshuo-composer.php`（表单）；
`archive.php` 在说说归档时调用；`functions.php` 显式 require；样式进 `style.css`，复用 token 与
`.yuki-btn`。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `0c72272`）。

- [x] 匿名访客看不到写作框，直接 POST 不产生说说
- [x] 登录且有 `publish_posts` 的用户看得到写作框、nonce 与发布按钮
- [x] 正常正文发布后产生一条 `publish` 的说说，在说说分类里，并出现在归档顶部
- [x] 空正文被拒，归档显示一句能照做的错误
- [x] 坏 nonce 被拒，非空正文在重定向后的表单里还在
- [x] 说说分类未配置时不产生说说，并给出明确错误
- [x] 无权限用户看不到表单，直接 POST 不产生说说
- [x] 成功后有「说说已发布。」的提示
- [x] 重定向只去说说归档/首页，不允许外部地址
- [x] 表单复用 `.yuki-btn`，样式只用现有 token
- [x] 文案走 `__()`，`languages/yuki.pot` 按 HEAD + 本件文件重建
- [x] HTTP 登录态断言覆盖上述正反场景

## Comments

### 实现

- **入口**：`archive.php` 在 `$yuki_is_shuoshuo` 为真时，于 `<main class="yuki-container">` 内、
  列表之前调用 `template-parts/shuoshuo-composer.php`；片段自己再判一次
  `current_user_can( 'publish_posts' )`。
- **处理器**：新文件 `inc/shuoshuo-composer.php`，挂在 `admin_post_yuki_shuoshuo_publish`。
  顺序是：权限 → 说说分类 → nonce → 正文非空 → `wp_insert_post`。成功与失败都走
  `wp_safe_redirect` 回归档（分类没配置时退首页），从不接收外部地址。
- **失败保留正文**：非空正文写入 5 分钟的 per-user transient；表单渲染时取出并删除。
  失败码 `empty` / `nonce` / `failed` / `no_category` / `capability` 在模板里映射成
  一句能照做的话，不静默吞掉。
- **表单**：`admin-post.php` + `wp_nonce_field( 'yuki_shuoshuo_publish', 'yuki_shuoshuo_nonce' )`；
  一个 textarea、一个 `.yuki-btn`。没有标题、媒体上传或富文本。
- **样式**：写作框用 `--yuki-card` / `--yuki-border` / `--yuki-radius-lg`，textarea 用
  `--yuki-background` / `--yuki-input` / `--yuki-ring`；错误提示用中性左边线，不新造危险色。
- **接入**：`functions.php` 在 inc 的显式 require 列表末尾加一行。

### 验收

新增 `tests/bin/shuoshuo-composer-fixtures.php` 与 `tests/bin/verify-shuoshuo-composer.mjs`，
**31/31**。测试用真实登录会话（`WP_Session_Tokens::create` + `AUTH_COOKIE` +
`LOGGED_IN_COOKIE`），验完销毁 token、删除测试用户与测试说说。

覆盖：匿名看不到也发不了；管理员看得到表单；订阅者看不到也发不了；空正文被拒；
坏 nonce 被拒且正文保留；正常发布产生一条 `publish` 的说说、在说说分类里、作者正确、
出现在归档并显示成功提示。

回归：说说 49/49、说说版式 43/43。

### 文案与生成物

`languages/yuki.pot` 按 `AGENTS.md` 第 5 条重建：从 HEAD 快照只补上本件新增的
`template-parts/shuoshuo-composer.php` 再生成。共 102 条，新增 9 条文案，`#:` 全部指向
该模板片段（如「说点什么…」指向 44/45 行的标签与 placeholder）。

### 已知边界

- 不做 AJAX 就地插入；提交后刷新回归档。
- 不做草稿、定时发布、编辑/删除已有说说。
- 不做媒体上传与富文本。
- 贡献者与订阅者不能发布；没有「待审说说」这条流程。
- 草稿 transient 只保留 5 分钟，且是同用户共享（两个标签页会互相覆盖）。
