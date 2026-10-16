# 01: 打包出一个可安装的 zip

**What to build:** 跑一条命令，得到一个能直接装的主题包。解开之后顶层是 `yuki/` **一个**目录——WordPress 就是靠这个认出它是一支主题——里面没有开发与验证的产物，有主题该有的东西。

排除清单仍然只有 `.distignore` 一处。这条要守住：加一份 `.gitattributes` 就等于把同一份清单抄成两份，而两份漂掉之后**不会有任何测试变红**，只会有一天发给别人的包里多了东西。

读取器遇到**看不懂的行**（通配、取反）必须报错停下，不能默默跳过——默默跳过就是「包错了但没人知道」。兜底是包的内容由验收脚本断言，打错了会红。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

- [ ] 跑打包命令产出一个 zip，退出码为 0
- [ ] 解开后顶层只有 `yuki/` 一个目录，不是一个散开的文件堆
- [ ] 包里没有 `tests/`、`docs/`、`.scratch/`、版本控制目录、`.distignore`、以及 `AGENTS.md`、`CONTEXT.md`、`DESIGN.md` 三份协作文档
- [ ] 包里有 `style.css`、`index.php`、`comments.php`、`LICENSE`
- [ ] 排除清单只有 `.distignore` 一处；遇到看不懂的行会报错停下，不静默跳过
- [ ] 断言包内容的验收脚本用 `node` 直接跑得起来，**不需要 WP-CLI**
- [ ] 把包解到 `wp-content/themes/` 下，WordPress 认得出它是一支主题
