# 04: 补齐头部字段 + 对产物跑 Theme Check，记录基线

**What to build:** 把体检做到干净，并把结论留下来。这一件是整件事的集成关口——它验的是**前面三张做完之后的产物**，不是工作区。

`style.css` 头部补上 `Author` 与 `Tested up to`（只写数字，不写成 `WP 7.1`）——这两条正是体检报出来的其中两条 REQUIRED。

**必须对「打包后的样子」跑，不是对工作区跑。** 工作区里住着 `tests/`、`docs/`、`.scratch/`，它们被排除在包外，却会被检查逐文件扫到。实测：工作区比产物**多出 9 条 REQUIRED 与 10 条 WARNING 的假阳性**（fixture 脚本里的 `fwrite`，以及中文提示文案里的小写 `wordpress`）。照工作区的结论去改，就是在追一批根本不会发出去的文件。

结论里**够格但这一轮不修**的那些要逐条说明，不能只丢一句「没修」：编辑器样式与区块支持、对齐与图注的 CSS 类，这两组有可见后果但属于设计工作，另立一件；`Theme URI`/`Author URI`、`style.css` 的 `minimal` 与 `light`/`dark` 标签、block patterns、版权声明，这几条不产生可见后果。

**Blocked by:** 01、02、03

**Status:** ready-for-agent

实现与验收已完成（起点 `1b48bb7`；体检在提交产物上跑，完整输出见 `.scratch/release-prep/04-theme-check-*.log`）。

- [x] `style.css` 头部含 `Author` 与 `Tested up to`，后者只写数字
- [x] 对**打包后的样子**跑 Theme Check，REQUIRED 只剩 `readme.txt` 一条
- [x] 包里有截图、有完整的头部，并且能装
- [x] 体检的完整结论（Required / Warning / Recommended / Info 四级的条目）记在本工单里
- [x] 够格但不修的那些，逐条写明为什么不修
- [x] 结论确实是在**产物**上跑出来的，不是工作区——工单里能看出这两者差了哪些条目

## Comments

### 一、头部那两行

```diff
 Theme Name: Yuki
+Author: FlozeIII
 Description: 极简 × 二次元风格 WordPress 博客主题。……
 Version: 1.0.0
 Requires at least: 6.0
+Tested up to: 7.1
 Requires PHP: 7.4
```

- `Author` 的值由站主定（spec 的原话），本件问过之后填 `FlozeIII`。
- `Tested up to` 写主次版本 `7.1`。本机实跑的是 `7.1.3`，但官方的写法就是主次版本——写补丁号
  反而会多一条 INFO（Theme Check 那条 version-tested 的建议）。另外八个字段一个字没动。
- **一处得说清的事实：核心不解析 `Tested up to`。** `WP_Theme::$file_headers`
  （`wp-includes/class-wp-theme.php:30-45`）里没有它，所以后台「外观 → 主题」看不到这一项，
  `wp_get_theme()->get( 'Tested up to' )` 实测返回 `false`。它存在是给 **Theme Check 的头部检查**
  （`checks/class-style-css-header-check.php`，拿正则扫原始 CSS）与目录式工具看的。spec 的用户故事 22
  说「主题在后台被正确识别——版本、兼容范围、翻译域都在」，后台真正读得到的是**版本**与**翻译域**
  这两项，兼容范围这一项不该指望后台显示。
- `languages/yuki.pot` **不用重生成**：这一件没有新增或删除任何字符串，而且那份 .pot 里
  没有 `style.css` 的出处行（`grep -c style.css languages/yuki.pot` 是 0），头部这两行也进不去。

### 二、验收侧只加断言，不新增 seam

改动落在 `tests/bin/verify-package.mjs`（这一件的产物就是包，spec 也点名「不新增 seam」）：

- `screenshot.png` 进「必需文件」那一组——「包里有截图」只有这一层看得见。
- 另起一段读**包里那一份** `style.css`，逐项核对官方列的十个头部字段，并看住 `Tested up to` 是纯数字。
  解析本身落在 `tests/bin/theme-css.mjs` 的 `themeHeader()`（spec 的 Testing Decisions 就写着
  「头部字段那条断言直接用它，不重写解析」）：它收的是**文本**而不是路径，所以工作区那份与
  包里那份喂得进同一个函数，行尾归一也就只有一处。包里的 `style.css` 在这个脚本里只读一次、
  只解析一次——「主题名」那条与这十个字段共用一份。

断言读的是产物：包按 HEAD 出，所以**改之前跑就是红的**。

    红绿：补头部之前 53/56（红的是 Author、Tested up to 与「只写数字」那三条），提交头部那两行之后 56/56。

为什么不做成一份新脚本：spec 说这一件「不新增 seam」，而这两个断言的主体都是**包**——`verify-package.mjs`
本来就是「看产物」的那只眼睛，另起一份只会让同一个产物被两处各读一遍。

### 三、体检是怎么跑的（这一节是给下一次复用的）

两条弯路都踩过，记下来：

1. **不能扫工作区。** `tests/`、`docs/`、`.scratch/` 都在工作区里、都被包排除在外，却会被逐文件扫到。
2. **产物也不能解到 `wp-content/themes/` 下随便起个名字跑。** Theme Check 的
   `checks/class-textdomain-check.php:203` 会拿**目录名**跟 `Text Domain` 比：解成
   `themes/yuki-package-04/` 时会多报一条 WARNING「Your theme appears to be in the wrong directory
   for the theme name」。多出来的这一条正好属于「产物没有、我的解包方式才有」的假阳性。

所以做法是搭一个**临时 WordPress 根**：core 用 junction 借真实安装（目录 junction 指过去、
顶层文件拷过去），`plugins`、`mu-plugins`、`database` 也 junction，**只有** `wp-content/themes/yuki`
放产物。这样目录名就是 `yuki`，与真装一模一样。

```bash
node tests/bin/package-theme.mjs .scratch/release-prep/yuki.zip
# 解开，把 yuki/ 放到 <临时根>/wp-content/themes/yuki/
C:/Users/Floze/wp-dev/tools/wp.cmd theme-check run yuki --path="<临时根>"
```

跑完临时根与解包目录一起删掉，**删链接时不跟进 junction**（跟进就是删掉别人的 WordPress 与数据库）。
清理之后核过：core `7.1.3`、29 篇文章、主题列表与 `themes/yuki` 的 junction 都在，站点回 200。

两轮完整输出（被 ignore，不在包里）：`.scratch/release-prep/04-theme-check-artifact.log`
（对产物）与 `04-theme-check-workspace.log`（对工作区）。跑工作区那一轮时，
`tests/bin/comment-submit-fixtures.php` 与 `tests/bin/verify-comment-submit.mjs` 上有**另一个会话**
未提交的改动——工作区那份结论会带上它们，产物那份不会（包只取 HEAD）。

### 四、产物的结论（`1b48bb7` 打出来的包）

**REQUIRED 1 · WARNING 1 · RECOMMENDED 18 · INFO 5**

REQUIRED（1）：

- 没有 `readme.txt`。**这是本件主动不要的**，见下。

WARNING（1）：

- 找不到版权声明（GPL 主题要有）。

RECOMMENDED（18）：

- 编辑器样式与区块支持（6）：`add_editor_style()`、`register_block_pattern`、`register_block_style`、
  `responsive-embeds`、`align-wide`、`wp-block-styles`。
- 对齐与图注的 CSS 类（8）：`.sticky`、`.bypostauthor`、`.alignleft`、`.alignright`、`.aligncenter`、
  `.wp-caption`、`.wp-caption-text`、`.gallery-caption`。
- 头部（2）：`Theme URI`、`Author URI`。
- 主题支持（2）：`custom-header`、`custom-background`。

INFO（5）：

- 找不到 `comment-reply` 脚本的 enqueue（但找到了对它的引用）。
- `style.css` 的 `minimal` 标签不对。
- `light`、`dark` 两个标签已弃用。
- 整个主题只用一个翻译域 `yuki`。

### 五、产物 vs 工作区：差的就是 `tests/`

工作区那一轮是 **REQUIRED 14 · WARNING 15 · RECOMMENDED 18 · INFO 5**。差出来的每一条都指向
包外的文件：

- **13 条 REQUIRED**：`tests/` 下十二份脚本的用法提示里写着 `<wordpress目录>`（小写的
  `wordpress`），外加 `tests/README.md` 的两行同款。
- **14 条 WARNING**：十二份脚本里的 `fwrite( STDERR, ... )`（截图那份命中两处），
  加上 `tests/wp/mu-plugins/yuki-dev-mailbox.php` 里的 `file_put_contents`。
- **RECOMMENDED 与 INFO 两边逐条相同**（diff 为空）——工作区多出来的文件在这一级上一条都没添。

与 spec 里记的「工作区比产物多出 **9 条 REQUIRED 与 10 条 WARNING**」对不上，原因是那个数是
**工单 01–03 之前**量的；此后又多了三份 fixture 脚本（提交评论、截图、两处缺陷）与 `tests/README.md`
里那两行。基准要按当期量，所以这里记的是 `1b48bb7` 这一轮的实测值。

### 六、够格但这一轮不修（逐条，含为什么不修）

1. **`readme.txt`（REQUIRED，唯一一条）**：本件**主动不要**，不是没做。自托管分发下它非必需
   （ADR 0002），进官方目录才要。这是决定，不是缺口。
2. **版权声明（WARNING）**：它要的只是在头部或 readme 里多一行版权文字，**无可见后果**；
   包的根上有 `LICENSE`，头部有 `License` 与 `License URI`，授权本身已经说清楚了。
3. **编辑器样式与区块支持（RECOMMENDED 6 条）**：`add_editor_style`、`register_block_pattern`、
   `register_block_style`、`responsive-embeds`、`align-wide`、`wp-block-styles`。这组**有可见后果**
   （编辑器里看到的样子与前台不一致、宽对齐区块压不住），是真东西——但它属于**设计工作**，
   spec 的 Further Notes 已经把它另立一件（与先前记下的「主题没有 `theme.json`」是同一件事）。
4. **对齐与图注的 CSS 类（RECOMMENDED 8 条）**：同样**有可见后果**（从别处粘进来的对齐图片、
   图注、画廊不长这个主题的样子），与上一条是同一件设计工作，同一件工单处理。
5. **`Theme URI` / `Author URI`（RECOMMENDED 2 条）**：只影响后台里那两个链接，**不产生可见后果**。
   另外自托管这条路上 `Author URI` 指向哪儿还没定，硬填一个只是多一个将来要维护的事实。
6. **`custom-header` / `custom-background`（RECOMMENDED 2 条）**：主题不吃这两个特性（头部是圆点
   纹理、底色是设计 token）。声明它等于给使用者两个能拨、却会跟设计系统打架的开关——**加了比不加差**。
7. **`style.css` 的 `minimal` 与 `light`/`dark` 标签（INFO 3 条）**：标签只用于官方目录的筛选，
   自托管不读它；**不产生可见后果**，改它还要动 `style.css`（共享文件）。
8. **`comment-reply` 脚本没被 enqueue（INFO）**：**这条不是误报**，核过机制——核心只**注册**它
   （`wp-includes/script-loader.php:1059`），**enqueue 只发生在区块评论那两条路**上
   （`wp-includes/blocks/comments.php:82`、`blocks/post-comments-form.php:52`）以及 theme-compat 的
   兜底页头（`theme-compat/header.php:46`）。跑一次 `comment_form()` 实测「没有 enqueue；注册：是」，
   活页面上也确实没有 `comment-reply.min.js`——**经典的评论表单这条路，核心不会替你装它**。
   后果：点「回复」是**整页跳转**（`?replytocom=N#respond`），不是把表单搬到那条评论下面。
   它不是缺陷：没有任何坏掉的东西给使用者撞上（回复照样发得出去、嵌套也对），只是少了一层增强，
   而 Theme Check 也只给了 INFO。按 spec 那把尺子（「它是不是一个使用者会撞上的功能缺陷或呈现缺陷」）
   它落不进这一轮要修的那些。就算要加，那也是**评论增强**那条线上的一件事——
   `comment-submit-ajax` 的工单 02 正文里已经假设这个脚本存在（spec 原话「调核心 comment-reply 脚本
   自带的取消回复，别自己搬 DOM」），归它顺手做才对。**留给那一件。**
   （顺带一提，真去动它还要碰 `functions.php` 与 `comments.php`——两个都在共享清单上、
   那个会话此刻正占着 `functions.php`；但那是次要的一条，判断不靠它。）
9. **「只用一个翻译域」（INFO）**：这是好的，不是要修的事。

### 七、能装

在临时根里（主题目录就是产物的那份，不是工作区）：

```
$ wp theme list --fields=name,status,version --format=json
[{"name":"yuki","status":"active","version":"1.0.0"}]

$ wp eval '… wp_get_theme( "yuki" ) …'
{"name":"Yuki","author":"FlozeIII","version":"1.0.0","screenshot":true,"errors":false}
```

WordPress 认得出它是一支主题（`errors` 是 `false`），名字、作者、版本都从产物的头部读出来，
`Tested up to` 不在里面——那是上面第一节说的那件事，不是没写进去。

### 八、整套回归

13 份验收脚本串行跑一遍（完整输出在被 ignore 的 `.scratch/release-prep/04-regression-results.log`）：

    38（删除）+ 63（点赞）+ 53（嵌套）+ 33（待审）+ 34（防垃圾）+ 129/131（评论提交）
    + 29（基建）+ 46（一言）+ 56（打包）+ 15（截图）+ 43（说说版式）+ 49（说说）
    + 33（两处缺陷）= 621 条，619 通过

**12 份全绿，只有 `verify-comment-submit.mjs` 是 129/131**，而那两条红不是这一件引起的：

- 两条红都落在**另一个会话正在做的工单 02 那条路上**——「浏览器里跑到底（回复那一趟）」
  与「（滚动那一趟）」，失败信息都是「文章页上没有 `#commentform`」。
- 这一件给主题加的只有 `style.css` 头部两行注释，动不了评论表单；这一轮里其余五份评论相关的
  脚本（删除、点赞、嵌套、待审、防垃圾）都是绿的。
- 同一个地址后来单独拉一次，`id="commentform"` **在**（页面 200、43 KB）。也就是说它当时是
  **一阵**的状态，不是这个提交的状态。
- 当时的工作树里，`functions.php`、`inc/comment-submit.php`、`assets/js/comment-submit.js`、
  两份 `comment-submit` 测试件都带着那个会话未提交的改动（本件开工时只有后两份，跑到一半
  前三个也进了工作树）。工单 03 与 `tests/README.md` 都记过同一类干扰：另一个会话临时换主题
  做验收时，「页面上什么都没有」就是这么来的。

所以报告里按红线如实写，但**这一条红不算在本件账上**，也没有去替那个会话改它——它正在动这几个
文件（`holds.md` 里 `functions.php` 那一行就是它挂的）。要重跑请在它收工之后。

审查之后又改了那个共用件（`f635f83`：头部解析从 `verify-package.mjs` 收进
`tests/bin/theme-css.mjs`），所以**用到它的五份脚本各重跑一遍**：打包 56、点赞 63、嵌套 53、
截图 15、说说版式 43，全绿（输出在 `.scratch/release-prep/04-regression-results-theme-css.log`）。
其余脚本不 import 它，没有重跑。

### 九、共享文件与账

- 动 `style.css` 之前按 `AGENTS.md` 第 1 条在 `.scratch/holds.md` 挂了一行，提交后删掉。
- 这一件只改了两个路径：`style.css`（两行）与 `tests/bin/verify-package.mjs`（断言），提交 `1b48bb7`；
  本工单的记录另提交。
- 临时 WordPress 根、解到共享 dev 环境 `wp-content/themes/` 下的产物目录、以及中间用到的两个
  临时脚本，**都删干净了**（删链接不跟进 junction）。共享环境清理后复核：core `7.1.3`、
  29 篇文章、四支主题都在、`themes/yuki` 那条 junction 仍指向仓库、站点回 200。
  没有动全站 theme mod，也没有清别人的日志。
- **一处给下一个会话的提醒**：上面第六节第 8 条——`comment-reply` 脚本在这个主题上从来没被
  enqueue 过（`git log -S"comment-reply"` 在 `functions.php`/`comments.php` 里只有一条注释改动，
  没有过 enqueue），而 `comment-submit-ajax` 工单 02 的正文假设它存在。

## Standards

两个独立审查代理按 `7d309dd` 起点审本件（两个提交：`1b48bb7` 代码、`f84c1de` 工单记录）。
起点先说清：我最初记的是 `a372988`，那是**上一件**工单（评论提交不刷新）的提交，三点 diff 会把
那一件两千多行一起卷进来，改成 `1b48bb7` 的父提交 `7d309dd`。工作树里另一个会话未提交的改动
（`functions.php`、`inc/comment-submit.php`、`assets/js/comment-submit.js`、两份 `comment-submit`
测试件）明确排除在审查范围外，也不许动。

规范轴：**0 项硬违反**、1 项气味（判断题），已修。它逐条核过 `AGENTS.md` 第 1/3/5 条（只提自己的
路径、共享文件挂占位、生成物按 HEAD 重建的理由）、`docs/agents/issue-tracker.md` 的写法
（`Status:` 保持 `ready-for-agent`，与 01–03 一致，triage 标签里没有「已完成」这一档）、
`tests/README.md` 的断言规矩（断言认外部可观察的产物、报告走 `report.mjs`）。

它报的那条气味，以及按它给的修法做的事：

- **Duplicated Code**。新加的那段自己把 `style.css` 读成文本、统一行尾、再抓表头——与
  `tests/bin/theme-css.mjs:18` 的 `themeCss()` 是同一段，连「CRLF 统一成 `\n`」的理由都重抄了
  一遍；同一个文件里还有一处对同一份 CSS 用 `/\r?\n/` 的另一种行尾处理。它指出 spec 的
  Testing Decisions 点名的正是这条（「头部字段那条断言**直接用它**，不重写解析」）。
  已收进 `tests/bin/theme-css.mjs` 的 **`themeHeader()`**：参数是**文本**不是路径——产物那份
  ZIP 条目才喂得进去；行尾归一只剩 `lf()` 一处，`themeCss()` 也改走它。`verify-package.mjs` 里
  包内 `style.css` 只读一次、只解析一次，「主题名」那条与十个头部字段共用那一份。
- 同一处它还点了脆弱：`/\*([\s\S]*?)\*\//` 隐含「表头是第一块注释」却没锚定。已在 `themeHeader()`
  里从 `^\s*` 锚起——表头不在开头时读出来是**空的**，而不是悄悄读到文件中间那块
  （实测：先写规则再写注释，返回 `{}`）。

工单轴另外指出一处备查：spec 说「已有那十项不动」，而改动前官方列的十个字段实际只存在八项——
§1 里写「另外八个字段」比说「十项没动」更准。这不是本件的问题。

复核结论：Standards 0 项未解决。那条气味已修（提交 `f635f83`），并请**同一个代理独立复验**过：
解析只剩一处、参数语义写进了注释、行尾归一合一、工作区那份 CRLF 喂进去照样解析得对，
无新硬违反；它另外核了 `theme-css.mjs` 不在 `AGENTS.md` 的共享清单上（清单里只有 `lib.mjs`），
所以这次 refactor 不需要挂占位。实跑 `node tests/bin/verify-package.mjs` **56/56**。

## Spec

工单轴：**0 项**。六条验收勾选项逐条实核过，包括对着被 ignore 的两份 Theme Check 日志数条目
（产物 `1`/`1`/`18`/`5`，工作区 `14`/`15`/`18`/`5`；差出来的 13 条 REQUIRED 与 14 条 WARNING
全部指向 `tests/` 下被包排除的文件，与 §5 一字不差），并实跑 `node tests/bin/verify-package.mjs`
（56/56）。结论：没有缺失或半成品的要求、没有范围扩张、没有「看着做了但做错」。

三点它专门核了，值得留下：

- **`style.css` 那两行不算范围扩张。** spec 的 Implementation Decisions「体检」一节自己点名
  「`style.css` 头部补齐两处：`Author`、`Tested up to`」，另有用户故事 22/23/24 与 Testing
  Decisions 的「`style.css` 头部：官方列的字段齐全，含这次新增的两项」。那句「这一轮唯一动到
  主题代码的两处」只约束修 bug 的两条（`wp_link_pages`、确认页标题），与头部补齐是同节并列——
  是 spec 自己的表述松，不是本件越界。
- **「读的是产物，不是工作区」成立**：核过 `package-theme.mjs` 确实从 `git archive HEAD` 出包，
  并把 attributes 隔离掉。
- **`comment-reply` 的机制描述与核心源码一致**（`script-loader.php:1059` 只注册；enqueue 只在
  `blocks/comments.php:82`、`blocks/post-comments-form.php:52`、`theme-compat/header.php:46`）。

它提了一条批评，已照办：**「不修 comment-reply」的理由里不该把并发当理由**——如果那真是 bug，
spec 的「真缺陷当场修掉」不会因为有别的会话占着文件而豁免。说得对，§6 第 8 条已改成先讲判断
（不是缺陷、没有给使用者撞上的坏掉的东西），并发只作次要一句。

复核结论：Spec 0 项未解决。
