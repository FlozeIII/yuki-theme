# 06: 从标签出包，跑完最后一遍体检，把结论留下

**What to build:** 这是发布的集成关口。前两件（`05` 与编辑器对齐）都合并之后，在**发布提交**上打
`v1.1.0`，从标签出包，对产物跑完整验收与 Theme Check，把结论记下来。

**版本。** `v1.0.0` 已经推送并打在 `0153f4a` 上，不能移动。这一批包含评论增强、编辑器对齐与发版机制，
按 semver 是 minor：`style.css` 的 `Version` 改为 `1.1.0`，在发布提交上打 `v1.1.0` 并推送。

**出包。** 用 `node tests/bin/package-theme.mjs --rev v1.1.0 <输出>`，不用工作区直接出包。
产物挂到 GitHub release（外向动作，站主确认后执行）。

**体检。** 对**解开的产物**跑 `wp theme-check run yuki --format=json`，记录四级计数与每条残留的去向。
预期基线：

- **REQUIRED 1**：`readme.txt` 缺失。ADR 0002 主动接受，不追。
- **WARNING 1**：无版权声明。无可见后果，记录不修。
- **RECOMMENDED 7**：`register_block_pattern`、`register_block_style`、`wp-block-styles`（ADR 0003
  刻意不引入）、`Theme URI`、`Author URI`、`custom-header`、`custom-background`。
- **INFO 5**：`comment-reply`（误报，见 05）、`minimal` 标签、`light` / `dark` 弃用标签、单一翻译域。

**回归。** 在发布提交上跑 `tests/bin/` 下全套 `verify-*.mjs`，把每个脚本的通过数记进工单。
共享环境按 `tests/README.md` 的并发规矩操作：不清空别人的日志，断言认带本次标记的内容。

**Blocked by:** 05、`editor-alignment` 的 01 与 02

**Status:** ready-for-agent

- [ ] `style.css` 的 `Version` 为 `1.1.0`，`v1.1.0` 打在发布提交上并推送
- [ ] 包用 `--rev v1.1.0` 产出，顶层目录为 `yuki/`，打印的提交号与标签一致
- [ ] `verify-package.mjs` 全绿，通过数记进本工单
- [ ] Theme Check 在**产物**上跑，四级计数与 01–04 的基线对得上
- [ ] 每条残留都写明「为什么留着」，没有只写「没修」
- [ ] 产物里的 `README.md` 含 GPL 声明
- [ ] 全套 `verify-*.mjs` 在发布提交上通过，数字记进本工单
- [ ] release notes 由 `git log v1.0.0..v1.1.0` 整理，未混入别的会话的提交
- [ ] GitHub release 与 zip 已挂上（站主确认后）
- [ ] 共享环境没有被清空或改坏；`holds.md` 里自己的行已删除

## Comments
