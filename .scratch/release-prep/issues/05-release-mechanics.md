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

- [x] `README.md` 在显眼处声明 GPL-2.0-or-later 与 100% GPL 兼容，并指向 `LICENSE`
- [x] `docs/RELEASING.md` 存在，步骤可从干净工作树一路走到 GitHub release
- [x] `package-theme.mjs` 支持 `--rev <sha|tag>`，默认 `HEAD`
- [x] 不存在的 rev 会报错停下，不会退回 `HEAD`
- [x] 传标签与传 sha 打出的包内容一致，打印的提交号正确
- [x] `verify-package.mjs` 增加三条断言：传标签、传 sha、传不存在的 rev
- [x] `comment-reply` 误报的证据写进本工单，04 工单追加更正
- [x] 没有为了让 Theme Check 闭嘴而改评论代码

## Comments

### 一、README 的许可声明

在标题与「安装」之间加了一节「许可」——安装说明之前，符合「显眼处」：

> Yuki 以 **GPL-2.0-or-later** 发布，是 **100% GPL 兼容**的自由软件：可用于任何站点
> （包括商业站点），也可以修改、再分发。完整条款见 [`LICENSE`](LICENSE)。

`README.md` 留在主题包里（见 spec），所以使用者拿到包就能读到这段；`LICENSE` 也在包里，
`verify-package.mjs` 一直有「包里有 LICENSE」的断言。

### 二、`docs/RELEASING.md`

面向维护者，按顺序写了九步：确认起点 → 改 `Version` → 提交/打标签/推送 → 从标签出包 →
`verify-package` → 对产物跑 Theme Check → 写 release notes → 发 GitHub release → 记账。
里面把几件容易走偏的事写死了：

- 已推送的标签不移动；打完标签先核 `git rev-parse HEAD` 与 `git rev-parse 'vX.Y.Z^{commit}'` 相同。
- 出包必须用 `--rev`，并核对命令打印的**解析后提交号**。
- Theme Check 对**解开的产物**跑，主题目录名必须是 `yuki`；对工作区跑会多出包外文件的假阳性。
- GitHub release 是外向动作，站主确认后才执行；不用 GitHub 自动生成的源码 zip。
- release notes 先核作者与改动文件，别把别的会话的提交混进来。

`docs/` 在 `.distignore` 里，这份文档不会进包。

### 三、`package-theme.mjs --rev`

```
node tests/bin/package-theme.mjs [--rev <sha|tag>] [输出.zip]
```

- 不传 `--rev` 时仍从 `HEAD` 出包，行为与之前一致。
- `--rev` 的值先过 `git rev-parse --verify --end-of-options '<rev>^{commit}'`，解析成提交后才读
  `.distignore`、才 `git archive`。因此标签与提交号走的是同一条路。
- 解析失败直接 `打包失败：找不到提交或标签：<rev>` 并以 1 退出，**不会退回 `HEAD`**，也不会产出文件。
- 打印的 `提交：` 是解析后的提交号；显式传了 `--rev` 时另打一行 `来源：<tag|sha>`。
- 参数只认这三种形状：一个可选输出文件、一个 `--rev <值>`。多余输出、重复 `--rev`、不认识的选项、
  `--rev` 后没有值都会报错；`--rev` 可以放在输出文件之前或之后。

### 四、验收

`verify-package.mjs` 加了一段「指定提交出包」，用一个独立的小仓库（标签指第一次提交，`HEAD` 是第二次，
两次内容不同）验三件事：

| 场景 | 断言 |
| --- | --- |
| 传标签 | 能出包；打印的提交号等于标签解析出的提交；包内容确实是标签那一版（没有第二版的 `later.txt`） |
| 传 sha | 能出包；打印的提交号等于该 sha；内容与传标签时逐项相同 |
| 不存在的 rev | 非零退出；错误里指出是哪个 rev；不产出 ZIP（也就没有退回 `HEAD` 的包） |

`node tests/bin/verify-package.mjs` → **65/65 通过**（原 56 条 + 新增 9 条；三个场景各自的
「能出包 / 提交号 / 内容」分开断言，所以不是三条，而是三组）。

### 五、`comment-reply` 的误报：证据，以及不改代码

事实链：

1. `inc/comment-submit.php:408` 已经把核心的 `comment-reply` 写进 `yuki-comment-submit` 的依赖数组：

   ```php
   array( 'comment-reply' ),
   ```

   WordPress 排 `yuki-comment-submit` 时会连带排上 `comment-reply`，脚本确实在页面上。
2. 引入它的提交是 `544fe71`（评论提交不刷新的工单 02，回复落在被回复的那条下面）。
   `git log --oneline -S'comment-reply' -- inc/comment-submit.php` 只命中这一条。
3. Theme Check 只认**直接调用**。`checks/class-comment-reply-check.php:34` 的正则是
   `wp_enqueue_script\(\s?("|')comment-reply("|')`；匹配不到时，`:35` 再看整个 PHP 里有没有
   `comment-reply` 这个字符串，有就报 INFO（`:45`）而不是 REQUIRED。依赖数组里的那一项只满足
   后一条，所以结论停在 INFO。

**这一件没有为了让 Theme Check 闭嘴而改评论代码。** 改成直接排一次 `comment-reply`（或写成它认的
字面形状）能把 INFO 消掉，但那是为了让扫描器高兴而动产品代码，spec 明确不这样做；而且依赖数组
本来就是「一起排、别排重」的正确形状。

### 六、边界

- 只改了 `README.md`、`docs/RELEASING.md`、`tests/bin/package-theme.mjs`、`tests/bin/verify-package.mjs`
  和本工单/04 的记录。`functions.php`、`comments.php`、`inc/comment-submit.php` 一个字没动。
- 没有新增 `.gitattributes`，`.distignore` 仍是唯一的排除清单。
- 没有发布、没有推标签、没有碰 GitHub release——那些留给 06，且上传要站主确认。
