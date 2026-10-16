# 本地测试基建

主题以外的东西：给本地验证环境装上两个观察点，让**用 HTTP 断言**这件事能覆盖到
原本够不着的两处——邮件里的链接，和一言的上游。

## 为什么要有它

验收的 seam 只有**一个：HTTP**。请求进去、HTML 出来。这一层一次性覆盖路由、模板层级、
函数、转义，以及评论提交这类真正的写入路径。仓库里不引入 PHPUnit / Jest，也不加构建步骤。

但有两件事 HTTP 够不着：

1. **删除链接在邮件里。** 本地站发不出邮件，链接也就无从取出再打一遍。
2. **一言的上游。** 它依赖第三方，既不能每次验收都去敲真的 hitokoto.cn，也没法让它按需故障。

所以补的不是新 seam，是**观察点**：基建不改变产品的任何接口，只是让本地环境能看见、
能控制这两个出口。

## 装

```bash
node tests/bin/harness.mjs install
```

它做两件事，都在 WordPress 里、都在主题之外：

- 把 `tests/wp/mu-plugins/yuki-dev-*.php` **复制**进 `wp-content/mu-plugins/`
- 在 WordPress 目录的同级建 `var/`（捕获文件与 stub 的状态目录）

用复制而不是符号链接/目录联接：联接会把「删掉 WordPress 里的 `mu-plugins`」悄悄变成
「删掉仓库里的源文件」。每轮验收都会先跑一遍 install，所以改完 mu-plugin 不会有旧副本。

两个细节是为了同一份环境里可能还有别的会话：

- 装过哪些文件记在 `wp-content/mu-plugins/.yuki-dev-installed` 里，清理**只认这份清单**。
  不按文件名前缀去扫——那会误删别的会话放在这里的文件。
- 复制是「先写临时文件再 rename」。原地覆盖会让并发中的请求读到写了一半的 PHP 文件，
  直接致命错误；rename 在同一卷上是原子的。

## 用

```bash
node tests/bin/verify-harness.mjs   # 基建自己的验收（工单 01）
```

验收脚本和后续工单的测试都从 `tests/bin/lib.mjs` 取公共辅助：`get` / `postForm`、
`readMails` / `linksIn`、`startStub` / `stopStub` / `stubSetMode` / `stubHits` / `probe`。

另外三份共用件，都是「同一段写两遍就会分叉」才抽出来的：`report.mjs`（断言与报告）、
`theme-css.mjs`（读 `style.css` 的 token、算颜色）、`homepage.mjs`（工单 02：首页第一屏的
视口与选择器——产 `screenshot.png` 的那条命令与验收那条共用一份）。`browser.mjs` 是无头
Edge 那个观察点本身。

### 观察点一：邮件捕获

`wp_mail()` 的每一封邮件被写进 `var/mail.log`，格式：

```
===== MAIL 2026-10-15T14:01:02+00:00 =====
to: admin@example.com
subject: [站点] Please moderate: "…"
headers: Content-Type: text/plain; charset=UTF-8
----- body -----
<正文原样>
===== END MAIL =====
```

接在核心的 `pre_wp_mail` 上，所以在 PHPMailer 之前就接管了：本地站不会真的去发信，
而调用方拿到的仍然是「发送成功」——完整的调用路径照走，只是出口落到文件里。

**正文按原样写入、不折行**，长链接完整落在文件里。这一点是刻意的：
PHPMailer 的 `WordWrap` 默认是 `0`（关着，WordPress 也没有打开它），所以真实发送同样
不会折断长链接——捕获到的正文就是收件人会看到的正文。

因为它是 mu-plugin，主题换任何一个都照样工作。验收里有一条就是切到 `twentytwentyfive`
提交一次，确认捕获依旧。

### 观察点三：关掉内核的评论频率限制

`yuki-dev-comment-flood.php` 是本目录里**唯一一处刻意改变产品行为**的地方，所以单独说明。

内核的频率限制（`wp_throttle_comment_flood`）按「IP + 邮箱」在 15 秒内去重，而这个 15 秒
是硬编码的、没有筛子可调（WP 7.1.3，`wp-includes/comment.php:2315`）。本地环境里每个请求
都来自 `127.0.0.1`，所以它区分不了「测试套件」和「攻击者」，只会把正常跑测试的第二条评论
判成刷屏（429）。

更要紧的是它会制造**假通过**：工单 02 要验「页面渲染到提交不足 3 秒就不该产生评论」，
而这样的提交必然落在 15 秒窗口里，会被频率限制先挡掉——测试看到「没有产生评论」，
却是在验错的原因。

它动的是内核行为，不是主题行为：没有任何一条验收标准是关于频率限制的，主题自己的防垃圾
（蜜罐 + 时间戳令牌）在工单 02 里另外验。

### 观察点二：一言上游的 stub

`var/upstream/` 里的**文件**就是 stub 的控制面——刻意不走 HTTP，因为测试要能在 stub
整个死掉之后照样读得到命中次数、照样改得了状态。

| 文件 | 作用 |
| --- | --- |
| `mode` | `ok`（默认）/ `500` / `garbage` / `hang` |
| `body.txt` | `mode=ok` 时返回的正文 |
| `hits.log` | 每个上游请求追加一行：`<ISO 时间> <方法> <路径>` |

```bash
node tests/bin/upstream-stub.mjs --port=8099 --var=C:/Users/Floze/wp-dev/var
```

- **切故障**：把 `mode` 写成 `500`（返回 500）、`garbage`（返回没法解析的正文），
  或者 `hang`（接住请求但**永不回应**，客户端只能按自己的 timeout 收场；60 秒后自行销毁连接，
  免得挂着的那次请求的 socket 留到进程结束）
- `hang` 是用来造「上游**超时**」的。杀掉 stub 得到的是**连接被拒**——那是另一种失败，
  快得很，验不出「超时不能拖慢页面」。**它的影响面比其他取值大**：别的取值只影响单次响应，
  `hang` 会让**所有**敲这个 stub 的请求一起挂住，包括另一个会话的。用完立刻写回 `ok`。
  （`lib.mjs` 的 `get` / `postForm` 和 `statusOf` 都带了超时，所以真撞上会变成一条明确的
  失败，而不是无限等下去。）
- **整个停掉**：杀掉进程——端口不再监听，连接被拒，「上游不可达」才是真的不可达
- **数命中**：读 `hits.log` 的行数，或 GET `/__mode`、`/__hits`

除 `/__mode` 与 `/__hits` 外，任何路径都算一次上游请求——一言具体打哪个路径由工单 09
决定，基建不该抢先定下来。

#### 上游怎么被指到 stub 上的

`yuki-dev-upstream.php` 用核心的 `pre_http_request` 转投。**主题那一侧完全无感**：
它照常 `wp_remote_get()` 上游，请求落到 stub 上，而传输层是真的走了一遍。

之所以不在主题里留一个「上游地址」的选项：主题一旦为了测试长出一个开关，这个开关就跟着
发给每一个使用者了。工单 01 的验收里有一条就是扫主题源码，确认没有任何测试专用的痕迹。

扫的是这些字符串，都是明确的「测试环境标识」，不是「用到了某个核心钩子」这种间接证据：

```
YUKI_DEV   pre_wp_mail   pre_http_request   http_request_host_is_external
http_allowed_safe_ports   127.0.0.1   localhost:8099   wp-dev
```

后四个是核心钩子名，单看只说明「挂了个钩子」；列进来是因为在博客主题里出现这几个，
值得人看一眼。失败信息会指明文件和字符串，判断起来很快。

**这个扫描有边界，别当成保证。** 它认的是「测试环境标识字符串」，认不出**语义上**为测试存在、
但用了普适词汇的写法——一个放行分支、一个为绕开校验而加的参数、一条只在某种调用方式下
才走的路。这些只能靠人看。扫过不等于干净，只等于「没有留下测试环境的指纹」。

反过来，命中也不等于有问题：主题将来要是**出于产品理由**用了上面某个钩子（比如一言为了
服务端缓存去挂 `pre_http_request`），那是正当的，改这份清单而不是改主题。

转投要过 WordPress 自己的两道门，两个过滤器都补上了，否则请求还没出 WordPress 就被拦下：

- `http_request_host_is_external` —— `127.0.0.1` 是回环地址，默认被 `wp_http_validate_url()` 判为不安全
- `http_allowed_safe_ports` —— 默认只放行 80、443、8080，stub 的 8099 不在其中

### 需要 WordPress 引导的探针

```bash
php tests/bin/wp-probe.php <wordpress目录> site-info
php tests/bin/wp-probe.php <wordpress目录> comment --post=12 [--theme=twentytwentyfive] [--content=…]
php tests/bin/wp-probe.php <wordpress目录> http-get https://v1.hitokoto.cn/
```

它的用处是**在主题之外发起真实的 WordPress 行为**：一言还没做出来的时候要验上游转投，
或者要验邮件捕获跟主题没关系的时候，都得绕开主题来敲 WordPress 本身。
每个子命令最后一行打印一个 JSON 对象。

## 路径与覆盖

仓库里只有基建的**代码**；捕获文件与状态目录都在仓库之外。

| 环境变量 | 默认 |
| --- | --- |
| `YUKI_WP_ROOT` | `C:/Users/Floze/wp-dev/wordpress` |
| `YUKI_DEV_VAR` | WordPress 目录同级的 `var/` |
| `YUKI_PHP` | WordPress 目录同级的 `tools/php/php.exe` |
| `YUKI_SITE` | `http://localhost:8080` |
| `YUKI_STUB_PORT` | `8099` |

PHP 那一侧（mu-plugin 读不到环境变量时）对应的是在 `wp-config.php` 里定义
`YUKI_DEV_VAR`、`YUKI_DEV_STUB`、`YUKI_DEV_UPSTREAM_HOSTS`。默认的上游主机是
`v1.hitokoto.cn,hitokoto.cn`；工单 09 定下真正用哪个之后，改这里或改 `YUKI_DEV_UPSTREAM_HOSTS` 即可，不必动主题。

## 同一个本地环境可能不止一个会话在用

基建控制的是一份**共享**的 WordPress 和一份共享的 `var/`。同时开着两个会话做不同工单时：

- **别清空 `var/mail.log` 或 `var/upstream/hits.log`** —— 那会把另一个会话的捕获一并抹掉。
  要划界限就用 `markMails()` 记下字节偏移、之后 `readMails(偏移)`；命中次数用 `stubHitCount()`
  的增量。验收脚本就是这么做的，而且只认**带本次标记**的那封邮件，而不是「文件里多了几封」——
  后者在并发下会认错邮件。
- `mode` 与 `body.txt` 是**全局**状态，两个会话同时测一言的故障态会互相踩。这一条躲不掉，
  撞上了就串行跑。
- 造数据也会互相影响：`site-info` 返回的是「最新一篇允许评论的文章」，别的会话新建文章会把它挪走。
  所以断言要认内容，不要认编号。
- **工作树是共享的**：另一个会话正在改主题时，它的未提交改动会直接生效在这个站点上。
  验收脚本里「提交一条评论」这类检查会在那一刻红掉，而原因不在基建。看到莫名其妙的失败
  先 `git status` 一眼，别急着改基建。

### 已解决：主题自己加了防垃圾之后

工单 02 给评论表单加了蜜罐与时间戳令牌，于是「直接 POST 表单字段」这种朴素提交会被主题
判为垃圾（`yuki_comment_spam`），邮件捕获的检查一度提交不进去。

**修法不是让基建去伪造令牌**——那等于让测试绕过被测的那道门，工单 02 就白验了。改成了
「像浏览器一样提交」，就是 `lib.mjs` 里的 `submitComment()`：

```js
import { submitComment } from './lib.mjs';

const res = await submitComment(postUrl, { comment: '正文' });
// GET 文章页 → 从 #commentform 取出表单里**实际存在**的字段（单双引号都认，
// checkbox 只取勾上的）→ 覆盖 comment/author/email/url → 等 3200ms → POST
// 返回 { status, body, location, fields, waitedMs }
```

**那 3.2 秒不能省。** 判定窗口是「提交时刻 − 页面渲染时刻 ≥ 3 秒」，来得太快会被挡掉，
而且被挡的样子和「忘了带令牌」一模一样——不等等就分不清自己在验哪一条。

这个辅助只覆盖「正常访客」这一条路。要验篡改签名、伪造令牌、整条令牌不给、
以及「同一个令牌在窗口前后各提交一次」这类，得自己在 POST 那一步拼字段——工单 02 的用例
就是这么做的，不重叠。

## 发布时不要带出去

`.distignore` 已经把 `tests/`、`.scratch/`、`docs/` 排除在打包之外——这些是开发与验证用的，
不是主题的一部分。
