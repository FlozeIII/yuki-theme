# 01: 打包出一个可安装的 zip

**What to build:** 跑一条命令，得到一个能直接装的主题包。解开之后顶层是 `yuki/` **一个**目录——WordPress 就是靠这个认出它是一支主题——里面没有开发与验证的产物，有主题该有的东西。

排除清单仍然只有 `.distignore` 一处。这条要守住：加一份 `.gitattributes` 就等于把同一份清单抄成两份，而两份漂掉之后**不会有任何测试变红**，只会有一天发给别人的包里多了东西。

读取器遇到**看不懂的行**（通配、取反）必须报错停下，不能默默跳过——默默跳过就是「包错了但没人知道」。兜底是包的内容由验收脚本断言，打错了会红。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

实现与验收已完成（起点 `ad73d6c`）。

- [x] 跑打包命令产出一个 zip，退出码为 0
- [x] 解开后顶层只有 `yuki/` 一个目录，不是一个散开的文件堆
- [x] 包里没有 `tests/`、`docs/`、`.scratch/`、版本控制目录、`.distignore`、以及 `AGENTS.md`、`CONTEXT.md`、`DESIGN.md` 三份协作文档
- [x] 包里有 `style.css`、`index.php`、`comments.php`、`LICENSE`
- [x] 排除清单只有 `.distignore` 一处；遇到看不懂的行会报错停下，不静默跳过
- [x] 断言包内容的验收脚本用 `node` 直接跑得起来，**不需要 WP-CLI**
- [x] 把包解到 `wp-content/themes/` 下，WordPress 认得出它是一支主题

## Comments

### 实现与用法

```bash
node tests/bin/package-theme.mjs [输出.zip]
node tests/bin/verify-package.mjs
```

默认产物是 `.scratch/release-prep/yuki.zip`。需要 Node.js 22.2+ 与 Git，不需要 npm 依赖、PHP 或 WP-CLI。

- 打包锁定一次 HEAD，主题与 `.distignore` 都读该提交；其他会话的未提交修改和未跟踪文件不入包。要发布自己的改动，先提交再打包。
- 排除清单仍只有 `.distignore`，没有新增 `.gitattributes`。读取器支持根目录相对字面路径、末尾 `/`、空行、整行注释；通配、取反、转义、绝对与越级路径均报错，并指出清单行号。
- ZIP 交给 Git 自带的 `archive` 生成，固定前缀 `yuki/`；不另写压缩实现。禁用本次命令的 `core.autocrlf`，保留提交中的字节，不改用户 Git 配置。
- 审查发现 `git archive` 仍受本地/全局 attributes 的 `export-ignore`、`export-subst` 影响。现通过临时裸仓库只读取原对象，隔离原仓库的 attributes，并覆盖归档与文本转换属性；选哪些文件仍只由 `.distignore` 决定。
- 先生成临时文件，再替换输出；语法错误不产出新包，也不毁掉已有包。README 已补齐发行包安装和源码打包的说明。

### 验证

`node tests/bin/verify-package.mjs`：**44/44 通过**。通过 ZIP 中央目录、解压后的正文与 CRC 校验观察产物，不导入生产脚本的内部函数。

覆盖：目录名、必需与排除文件、新增自定义排除规则、中文/空格文件名、二进制截图原样入包、HEAD 与工作树隔离、Git attributes 不删文件或改写正文、从其他工作目录运行、清单出错停止且保留旧包。fixture 使用临时 Git 仓库，并显式打开其 `core.autocrlf`，不改全局 Git 配置。

红绿记录：最初缺少脚本时 0/2；加入通配语法检查前 24/26；发现本机换行设置改变包内文本时 41/43；清单首行空白导致错误行号偏移时 42/43；加入 attributes 回归时 40/44。各自修复后通过。

手工安装识别：用系统 `Expand-Archive` 将真实 ZIP 解到本地 `wp-content/themes/yuki-package-01-20261016-a4e2f7/yuki/`，再在 WordPress **7.1.3** / PHP **8.3.35** 中定点调用 `wp_get_theme(本次目录, 显式主题根目录)`，得到：

```json
{"ok":true,"exists":true,"errors":false,"name":"Yuki","version":"1.0.0","path_matches_extracted":true}
```

没有激活验收主题、修改全站设置或清空共享日志。原 `themes/yuki` 是通向仓库的目录联接，没有覆盖它。临时解包目录及子项已核实均非链接；清理命令被自动审批拒绝（只返回 `blocked by policy`，未给具体原因），因此保留该目录，没有换手段绕过删除。

既有完整回归串行执行一次：**388/388 通过**，9 份脚本退出码均为 0（删除 38、点赞 63、嵌套 53、待审 33、防垃圾 34、基建 29、一言 46、说说版式 43、说说 49）。结束后确认启用主题仍为 `yuki`、stub 模式为 `ok`。完整本地输出保存在被 ignore 的 `.scratch/release-prep/01-regression-results.log`。

## Standards

两个独立审查代理按 `ad73d6c` 起点审查本件暂存路径。规范轴最初发现 1 项 P2：Git attributes 能破坏快照隔离；已修复并独立复验 **44/44 通过**。复核没有未解决的规范违反或需要修改的代码气味；新增的临时裸仓库直接对应该已复现问题。

## Spec

工单轴最初发现 1 项 P2：attributes 成为隐式第二排除来源；已修复。独立复验 **44/44 通过**，未发现 01 的缺失要求、错误实现或范围扩张。02 截图和 03/04 仍由各自工单负责。

复核结论：Standards 0 项未解决，Spec 0 项未解决。
