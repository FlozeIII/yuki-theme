# 05: 发版有可重复的步骤，分发页面有 GPL 声明

**What to build:** 把「发一次版」从记忆变成文档，把 ADR 0002 要求的分发声明补上，并让打包脚本能指定
「打哪个提交」。这一件**不发布**，只把机制与文档立起来。

**README 的 GPL 声明。** `ADR 0002:27` 与调研文档都要求：自托管分发页面要在**显眼处**声明主题是
100% GPL 兼容的。`README.md` 今天对 `gpl|license|许可|授权` 零命中。补一节简短的许可说明：
GPL-2.0-or-later、100% GPL 兼容、完整文本见 `LICENSE`，位置在安装说明之前或紧邻其旁。

**`docs/RELEASING.md`。** 面向维护者，`docs/` 已在 `.distignore` 里排除，不会进包。步骤至少包括：
工作树干净、`HEAD == 发布提交`、改 `style.css` 的 `Version`、提交、打标签、从标签出包、
跑 `verify-package`、对产物跑 Theme Check、写 release notes、把 zip 挂到 GitHub release、
把 revision 与体检计数记进发布工单。**上传 GitHub release 是外向动作，由站主确认后执行。**

**打包脚本加 `--rev`。** `package-theme.mjs` 现在固定 `HEAD`（`package-theme.mjs:29`）。
加可选 `--rev <sha|tag>`，默认仍是 `HEAD`；用 `git rev-parse --verify <rev>^{commit}` 校验，
不存在的 rev 必须报错停下，不能悄悄退回 `HEAD`。出包时打印的提交号就是解析后的提交。

**`comment-reply` 的误报结账。** 当前 `inc/comment-submit.php:408` 已把 `comment-reply` 写进
`yuki-comment-submit` 的依赖数组，脚本确实排上了。Theme Check 只找直接的
`wp_enqueue_script( 'comment-reply' )`，所以报 INFO。**代码不动**；把证据写进本工单，
并在 `04-header-and-check-baseline.md` 的 Comments **追加一条更正**（不改旧记录），说明
04 里「从来没被 enqueue」「留给评论增强线」描述的是 `1b48bb7` 时的状态，`544fe71` 已经接上。

**Blocked by:** 无（可与 `.scratch/editor-alignment/` 并行）

**Status:** ready-for-agent

- [ ] `README.md` 在显眼处声明 GPL-2.0-or-later 与 100% GPL 兼容，并指向 `LICENSE`
- [ ] `docs/RELEASING.md` 存在，步骤可从干净工作树一路走到 GitHub release
- [ ] `package-theme.mjs` 支持 `--rev <sha|tag>`，默认 `HEAD`
- [ ] 不存在的 rev 会报错停下，不会退回 `HEAD`
- [ ] 传标签与传 sha 打出的包内容一致，打印的提交号正确
- [ ] `verify-package.mjs` 增加三条断言：传标签、传 sha、传不存在的 rev
- [ ] `comment-reply` 误报的证据写进本工单，04 工单追加更正
- [ ] 没有为了让 Theme Check 闭嘴而改评论代码

## Comments
