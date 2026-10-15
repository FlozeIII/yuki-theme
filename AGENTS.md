# Yuki

一个 WordPress 博客主题（极简 × 二次元）。领域词汇见 `CONTEXT.md`，
视觉规范见 `DESIGN.md`。

## 并行会话

这个仓库常常**同时开着几个会话**做不同工单：共用一棵工作树、一份 dev 环境、一个 `wp-dev/var/`。
今天（2026-10-15）吃过三次同文件冲突，下面六条是为此定的，不是礼貌，是操作步骤。

1. **一个文件同时只给一个会话写。** 要动这几个共享文件时（`functions.php`、`style.css`、
   `comments.php`、`sidebar.php`、`languages/yuki.pot`、`AGENTS.md`、`tests/bin/lib.mjs`），
   先在 `.scratch/holds.md` 里加一行 `路径 → 会话 → 目的`，提交后再删掉那行；动手前先看那张表。
   表本身不进版本库（已 ignore），它是同一棵工作树上的白板，不必提交、也别提交。
2. **优先新建文件，其次才改共享文件。** 一个功能的代码放 `inc/<功能>.php`（在 `functions.php` 里
   用**显式** `require_once` 接上，别用 glob 扫目录——往目录里丢个文件就悄悄多出行为，不是好事），
   模板放 `template-parts/`，验收脚本放 `tests/bin/`。新增文件天然不冲突。
3. **提交只提自己的路径**，绝不用 `git add -A` / `git commit -a`。提交完用
   `git log --stat -1` 核一眼只含自己的文件。
4. **同一个文件里的不同 hunk**：要把「只有我那块」塞进暂存区，用 `git apply --cached`
   （补丁能干净地只取一半时）或 `git hash-object -w` + `git update-index --cacheinfo`
   （更稳，全程不碰工作区）。**合成前先核两件事**：HEAD 里是不是已经有你这段（别贴第二遍）、
   有没有混进别人的规则（比对禁用词）。
5. **生成物按 HEAD + 自己改的文件重建**，不要扫工作区：`git archive HEAD` 到临时目录，
   把自己改的文件拷进去，再跑生成器。`languages/yuki.pot` 尤其如此——扫工作区会把别人未提交的
   字符串连行号一起写进你的提交。永远不要去改别人的字符串。
6. **别猜账**：要谢谁、要怪谁、要引用「谁说过什么」之前，先看那条消息的 `from=` 或
   `git log` 的作者。今天出过两次认错会话，三个会话同时对账时这种串线会让人开始怀疑自己的记录。

共享运行状态也要当心：dev 环境里的全站 theme mod、`wp-dev/var/` 下的 stub `mode`/`body.txt`
是所有会话共写的——不要清空 `var/mail.log`、`var/upstream/hits.log`，断言认**带本次标记**的内容
而不是「文件里多了几条」。造数尽量**读**全站设置而不是改；必须设时设成 WordPress 默认值，并在
造数脚本里写明。

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/` in this repo.
See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, used as-is.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root plus `docs/adr/`.
See `docs/agents/domain.md`.
