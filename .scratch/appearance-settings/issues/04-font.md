# 04: 三套系统字体栈之间切换

**What to build:** 自定义器「Yuki 字体设置」一节加字体风格下拉：无衬线（默认）/ 衬线 / 圆体。
选择输出成 `--yuki-font-sans`，正文与标题一起换；代码块仍用独立的等宽栈。三套都是系统字体，
不下载、不外链。

**字体栈。**
- 无衬线（默认）：沿用主题现有的 Inter + Noto Sans SC + 系统中文字体。
- 衬线：`Noto Serif SC` / `Songti SC` / `SimSun` / Georgia / Times New Roman / serif。
- 圆体：`Yuanti SC` / `YouYuan` / Microsoft YaHei / PingFang SC / Noto Sans SC / sans-serif。

**默认。** `sans` 不输出任何覆盖，主题保持原样；未知值 sanitize 回 `sans`。

**Blocked by:** 03（按外观设置的批次顺序）

**Status:** ready-for-agent

实现与验收已完成（起点 `ecbebe7`）。

- [x] 自定义器有「Yuki 字体设置」一节与字体风格下拉
- [x] 三档白名单；未知值与空值回到 sans
- [x] 选 serif/rounded 时输出 `--yuki-font-sans`；选 sans 不输出覆盖
- [x] 正文与标题一起换
- [x] 代码块仍用 `--yuki-font-mono`，不参与切换
- [x] 深色模式字体不变
- [x] 文案走 `__()`，`yuki.pot` 按 HEAD + 本件文件重建
- [x] 真浏览器验正文、标题、等宽与深色模式

## Comments

### 实现

- **自定义器**：新增「Yuki 字体设置」一节（优先级 154），一个 `select` 控件 `yuki_font_style`：
  无衬线（默认）/ 衬线 / 圆体；`sanitize_callback` 只放行这三档，其余回到 `sans`。
- **输出**：`yuki_assets()` 把选择写成 `:root{--yuki-font-sans:…}`；`sans` 不输出任何覆盖，
  主题保持现有字体栈。字体与深浅色无关，所以不挂 `.dark`。
- **衬线**：`Noto Serif SC` / `Songti SC` / `SimSun` / Georgia / Times New Roman / serif。
- **圆体**：`Yuanti SC` / `YouYuan` / Microsoft YaHei / PingFang SC / Noto Sans SC / sans-serif。
- **等宽**：`--yuki-font-mono` 不动，代码块不参与切换。
- 没有新模板，没有外部字体。

### 验收

新增 `tests/bin/font-fixtures.php` 与 `tests/bin/verify-font.mjs`，**18/18**。
临时把字体设成 `serif`，`finally` 里恢复原值。

实测：正文与 `h1` 的计算字体都是衬线栈；`--yuki-font-mono` 仍是
`"JetBrains Mono", "Fira Code", …`；深色模式字体不变。白名单：`sans/serif/rounded` 保留，
未知值与空值回到 `sans`。

回归：强调色 24/24、雪兔 28/28、截图 15/15。

### 文案与生成物

`languages/yuki.pot` 112 条，新增「Yuki 字体设置」「字体风格」与三个选项文案。
`DESIGN.md` 的字体一节注明字体风格可由站主切换。

### 已知边界

- 三套都是系统字体栈；机器上没装 `YouYuan`/`Yuanti SC` 时，圆体会回退到黑体，这是预期行为。
- 只换正文与标题；代码块保留等宽。
- 字体是站点级设置，不做访客偏好。
