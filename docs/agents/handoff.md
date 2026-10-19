# 开发交接

最后更新：2026-10-19。当前发布 **v1.3.0**（标签 `v1.3.0` → `d330fc1`），`main` 已推到
`c6da520`；工作树干净，`.scratch/holds.md` 为空。

## 先读

1. `AGENTS.md` —— 并行会话的六条硬规则。**这是操作步骤，不是礼貌。**
2. `CONTEXT.md` —— 领域词汇：极简线、对外发布、不自足功能、主题形态、说说、一言、头像镜像。
3. `DESIGN.md` —— 视觉 token、布局、浮层、季节点缀。
4. `.scratch/roadmap/map.md` —— 路线图、已完成批次与下一批候选。
5. `docs/agents/issue-tracker.md` —— spec 与工单的写法。

## 当前状态

- 已发布 `v1.3.0`：二次元四批（雪兔、贴纸/气泡、季节点缀色、hero 花瓣）与外观设置四批
  （背景图+蒙层、页头图、强调色、字体切换）。
- 全套 27 个验收脚本、1039/1039；`verify-package` 65/65。
- Theme Check（对产物）：REQUIRED 1（`readme.txt`，ADR 0002 主动不写）· WARNING 1 ·
  RECOMMENDED 5 · INFO 5。
- 已知测试基建项：`.scratch/comment-submit-ajax/issues/04-browser-retry-flake.md`（浏览器
  「太快 → 重试」场景偶发不稳，不挡功能开发）。

## 本地环境

本地站默认没在跑。先起服务（共享 dev 环境，别的会话也可能在用）：

```bash
"C:/Users/Floze/wp-dev/tools/php/php.exe" -S localhost:8080 -t "C:/Users/Floze/wp-dev/wordpress" "C:/Users/Floze/wp-dev/scripts/router.php"
```

装/刷新测试观察点：

```bash
node tests/bin/harness.mjs install
```

确认站起来了：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
```

关键路径：WordPress `C:/Users/Floze/wp-dev/wordpress`，PHP 如上，站点 `http://localhost:8080`，
共享状态在 `C:/Users/Floze/wp-dev/var/`。**不要清空** `var/mail.log` 或
`var/upstream/hits.log`；造数读全站设置，不随手改别人的。

## 开工流程

1. 从 `.scratch/roadmap/map.md` 选**一件**（或用户点名），先写 `.scratch/<feature>/spec.md`
   与 `issues/NN-*.md`；不要一次开多件。
2. 动手前看 `.scratch/holds.md`。要动共享文件——`functions.php`、`style.css`、`comments.php`、
   `sidebar.php`、`languages/yuki.pot`、`AGENTS.md`、`tests/bin/lib.mjs`——先挂一行
   `路径 -> 会话 -> 目的`，提交后删掉。
3. **新文件优先**：功能代码放 `inc/<功能>.php`（在 `functions.php` 里显式 require），模板放
   `template-parts/`，验收脚本放 `tests/bin/`。共享文件只做这一件需要的最小改动。
4. 验收走 `tests/bin/` 的 HTTP + 无头 Edge；不引 PHPUnit / Jest / 构建步骤。
5. 提交只列自己的路径，**绝不用 `git add -A` / `git commit -a`**；提交后 `git log --stat -1`
   核对只含自己的文件。
6. 生成物（`languages/yuki.pot`、发布包）按 **HEAD + 自己改的文件** 生成，不扫工作区；
   永远不要改别人的字符串。
7. 收尾：更新工单与 roadmap，删掉 `holds.md` 里自己那行。

## 下一批候选（来自 roadmap）

- **A 阅读体验**：代码块复制、长文目录（从 h2/h3 生成）、阅读进度。
- **B 内容形态**：相册/画廊页、文章系列、说说增强（不引入新数据模型）。
- **D 作者工作流**：草稿预览。
- 灯箱的多图左右切换仍在 Fog；外观设置四批已完成。
- 优先选**小、可独立验收、不碰共享文件**的一件；一次只开一件。

## 多个 agent 并行时

- **一个工单一个会话**；不要两个会话同时做同一件或同一文件。
- 所有会话共用同一棵工作树与同一份 dev 环境；`holds.md` 是白板，不是装饰。
- 提交前先 `git status`，确认没有混进别人的文件；生成 pot 时尤其如此。
- 如果一个会话要改共享文件而另一个会话正占着，等它提交完再动，或改做不碰该文件的部分。
- 审查/调查类工作可以交给子 agent；**写文件**尽量由持有该文件占位的那个会话做。

## 给新会话的开场提示（复制粘贴）

```text
你在 D:\Projects\yuki-theme 这个 WordPress 主题仓库里接着开发。
先读 AGENTS.md、CONTEXT.md、DESIGN.md、docs/agents/handoff.md、
.scratch/roadmap/map.md、docs/agents/issue-tracker.md。

当前发布 v1.3.0，工作树干净，holds.md 为空。请从 roadmap 的候选里选一件
（或按用户指定的功能），先写 .scratch/<feature>/spec.md 与 issues/NN-*.md，再实现。

遵守 AGENTS.md 的并行会话规则：动共享文件前在 .scratch/holds.md 挂行；
只提交自己的路径；pot 按 HEAD + 自己的文件生成；不要清空共享日志。
开工前确认本地站是否在跑（命令见 docs/agents/handoff.md），没跑就起。
验收走 tests/bin 的 HTTP + 无头 Edge，不引 PHPUnit/Jest/构建。
完成后提交、更新工单与 roadmap、删掉 holds 里自己那行。
```
