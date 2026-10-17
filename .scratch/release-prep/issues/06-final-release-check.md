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

实现与验收已完成（发布提交 `7953be7`；`v1.1.0` 已推送并发布）。

- [x] `style.css` 的 `Version` 为 `1.1.0`，`v1.1.0` 打在发布提交上并推送
- [x] 包用 `--rev v1.1.0` 产出，顶层目录为 `yuki/`，打印的提交号与标签一致
- [x] `verify-package.mjs` 全绿，通过数记进本工单
- [x] Theme Check 在**产物**上跑，四级计数与 01–04 的基线对得上
- [x] 每条残留都写明「为什么留着」，没有只写「没修」
- [x] 产物里的 `README.md` 含 GPL 声明
- [x] 全套 `verify-*.mjs` 在发布提交上通过，数字记进本工单
- [x] release notes 由 `git log v1.0.0..v1.1.0` 整理，未混入别的会话的提交
- [x] GitHub release 与 zip 已挂上（站主确认后）
- [x] 共享环境没有被清空或改坏；`holds.md` 里自己的行已删除

## Comments

### 一、版本与资产缓存

- `style.css` 的 `Version` 改为 `1.1.0`。
- 顺手修了一处会让发版白做的缓存问题：`yuki_assets()` 原来把样式与脚本的版本写死成 `1.0.0`，
  访客的浏览器会继续用缓存里的旧 CSS。现在三者都读 `wp_get_theme()->get( 'Version' )`，
  发版只改 `style.css` 一处。实测首页输出 `style.css?ver=1.1.0`。
- 发布提交 `7953be7`；标签 `v1.1.0` 指向它。

### 二、出包

```bash
node tests/bin/package-theme.mjs --rev v1.1.0 .scratch/release-prep/yuki-1.1.0.zip
```

- 打印的提交号：`7953be712b1071bcfc1c6cf7835a20b0fcc2e9d1`，与 `git rev-parse 'v1.1.0^{commit}'` 相同。
- ZIP 注释里也是这个提交号；顶层目录只有 `yuki/`。
- `node tests/bin/verify-package.mjs` → **65/65**。
- 包里的 `style.css` 是 `Version: 1.1.0`；`README.md` 含「GPL-2.0-or-later、100% GPL 兼容」声明。
- ZIP 在 `.gitignore` 的 `*.zip` 里，是本地发布物，不进仓库。

### 三、Theme Check（对产物，不是工作区）

临时 WordPress 根按 04 工单记的办法搭：core 目录用 junction、顶层文件拷过去，`plugins`、
`mu-plugins`、`database`、`uploads` 也 junction，只把解开的 `yuki/` 放进
`wp-content/themes/yuki`。对 `<临时根>` 跑 `wp theme-check run yuki --format=json`。

**REQUIRED 1 · WARNING 1 · RECOMMENDED 7 · INFO 5**，与预期基线一致。完整输出在
`.scratch/release-prep/06-theme-check-artifact.log`（被 `*.log` 忽略）。

| 级别 | 条目 | 为什么留着 |
| --- | --- | --- |
| REQUIRED | 缺 `readme.txt` | ADR 0002：自托管分发，主动不写 |
| WARNING | 无版权声明 | 无可见后果；不产生使用者会撞上的问题 |
| RECOMMENDED | `register_block_pattern` | 区块样板是使用者的版式库，超出**极简线**；ADR 0003 |
| RECOMMENDED | `register_block_style` | 同上 |
| RECOMMENDED | `wp-block-styles` | 会加载核心默认区块样式，与手写的正文规则互相覆盖；ADR 0003 |
| RECOMMENDED | `Theme URI` | 没有公开主题站点；无可见后果 |
| RECOMMENDED | `Author URI` | 同上 |
| RECOMMENDED | `custom-header` | 主题用的是 logo，不是头图；加支持比不加差 |
| RECOMMENDED | `custom-background` | 背景是设计 token，不是可配置项 |
| INFO | `comment-reply` | 误报：已作为依赖排上（`inc/comment-submit.php:408`），Theme Check 只认直接调用；见 05 |
| INFO | `minimal` 标签 | 只影响官方目录筛选；自托管 |
| INFO | `light` / `dark` 弃用标签 | 同上 |
| INFO | 单一翻译域 `yuki` | 正确且预期 |

### 四、全套回归（发布提交 `7953be7`）

| 脚本 | 通过 | 脚本 | 通过 |
| --- | --- | --- | --- |
| verify-comment-deletion | 38/38 | verify-hitokoto | 46/46 |
| verify-comment-likes | 63/63 | verify-package | 65/65 |
| verify-comment-nesting | 53/53 | verify-screenshot | 15/15 |
| verify-comment-pending | 33/33 | verify-shuoshuo-density | 43/43 |
| verify-comment-spam | 34/34 | verify-shuoshuo | 49/49 |
| verify-comment-submit | 173/173 | verify-theme-check-defects | 33/33 |
| verify-editor-alignment | 58/58 | | |
| verify-editor-styles | 23/23 | | |
| verify-harness | 29/29 | **合计** | **755/755** |

完整输出在 `.scratch/release-prep/06-regression.log`（被 `*.log` 忽略）。

### 五、共享环境

- 临时 WordPress 根 `C:/Users/Floze/wp-dev/tmp-release-06` 已删除；删 junction 时用
  `Directory.Delete(path, false)`，只删链接、不跟进目标。
- 删完复核：共享 `wp-admin` 在、`wp-content/themes/yuki` 的 junction 在、站点回 **200**。
- 没有清空 `var/mail.log` / `var/upstream/hits.log`，没有改全站 theme mod。
- `holds.md` 里本件的两行已删除。

### 六、release notes 草稿

```markdown
Yuki 1.1.0

编辑器与前台对齐
- 正文宽度收成 CSS 变量；文章列表、页面与单篇布局引用同一份定义。
- 补齐对齐、图注、画廊图注样式；置顶文章与作者本人的评论有克制标记。
- 支持宽对齐与自适应嵌入；单篇宽块止于主列，页面里可放宽到 1120px。
- 编辑器直接使用主题样式，画布 720px；字体、引用、代码块、图片圆角与前台一致。

分发
- 新增 docs/RELEASING.md；打包脚本支持 --rev，从标签出包。
- README 补充 GPL-2.0-or-later 与 100% GPL 兼容声明。
- 主题版本 1.1.0；前台资产版本跟随主题版本。

已知
- Theme Check 仍报 1 条 REQUIRED（缺 readme.txt）——自托管分发下刻意不写，见 ADR 0002。
```

### 七、外向动作（已执行）

站主确认后执行：

1. `git push origin main`（`0153f4a..b8ac2ab`）。
2. `git push origin v1.1.0`（远端标签指向带注释的 tag 对象 `bbbb447`，提交 `7953be7`）。
3. `gh release create v1.1.0 .scratch/release-prep/yuki-1.1.0.zip --title "Yuki 1.1.0" --notes-file …`。

结果：<https://github.com/FlozeIII/yuki-theme/releases/tag/v1.1.0>，挂上 `yuki-1.1.0.zip`
（168,746 字节），非草稿、非预发布。
