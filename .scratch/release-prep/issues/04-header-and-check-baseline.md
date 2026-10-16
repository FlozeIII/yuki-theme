# 04: 补齐头部字段 + 对产物跑 Theme Check，记录基线

**What to build:** 把体检做到干净，并把结论留下来。这一件是整件事的集成关口——它验的是**前面三张做完之后的产物**，不是工作区。

`style.css` 头部补上 `Author` 与 `Tested up to`（只写数字，不写成 `WP 7.1`）——这两条正是体检报出来的其中两条 REQUIRED。

**必须对「打包后的样子」跑，不是对工作区跑。** 工作区里住着 `tests/`、`docs/`、`.scratch/`，它们被排除在包外，却会被检查逐文件扫到。实测：工作区比产物**多出 9 条 REQUIRED 与 10 条 WARNING 的假阳性**（fixture 脚本里的 `fwrite`，以及中文提示文案里的小写 `wordpress`）。照工作区的结论去改，就是在追一批根本不会发出去的文件。

结论里**够格但这一轮不修**的那些要逐条说明，不能只丢一句「没修」：编辑器样式与区块支持、对齐与图注的 CSS 类，这两组有可见后果但属于设计工作，另立一件；`Theme URI`/`Author URI`、`style.css` 的 `minimal` 与 `light`/`dark` 标签、block patterns、版权声明，这几条不产生可见后果。

**Blocked by:** 01、02、03

**Status:** ready-for-agent

- [ ] `style.css` 头部含 `Author` 与 `Tested up to`，后者只写数字
- [ ] 对**打包后的样子**跑 Theme Check，REQUIRED 只剩 `readme.txt` 一条
- [ ] 包里有截图、有完整的头部，并且能装
- [ ] 体检的完整结论（Required / Warning / Recommended / Info 四级的条目）记在本工单里
- [ ] 够格但不修的那些，逐条写明为什么不修
- [ ] 结论确实是在**产物**上跑出来的，不是工作区——工单里能看出这两者差了哪些条目
