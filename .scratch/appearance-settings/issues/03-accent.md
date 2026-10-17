# 03: 可换全局强调色

**What to build:** 自定义器「颜色」一节加一枚强调色；选了之后，链接、按钮、主题开关、分页当前项、
选中态与焦点环都跟着换。hover/深色变体（`--yuki-primary-600/700`）由 `color-mix` 自动压深，
按钮文字按强调色亮度自动选深墨或暖白。留空使用主题默认堇紫。

**边界。** 季节点缀色 `--yuki-season` 保持不变——它只染雪兔与贴纸胶带，和强调色是两件事。

**Blocked by:** 02（按外观设置的批次顺序）

**Status:** ready-for-agent

实现与验收已完成（起点 `ac0050d`）。

- [x] 自定义器「颜色」一节有强调色控件，默认展示 `#A5B4FC`
- [x] 留空不产生任何覆盖，主题保持默认堇紫
- [x] 选了颜色后 `--yuki-primary`、`--yuki-primary-600/700`、`--yuki-primary-foreground`、`--yuki-ring` 一起换
- [x] hover 档由 `color-mix` 自动压深，不需要用户选三枚
- [x] 按钮文字按亮度自动选深墨/暖白
- [x] 深色模式下同样生效
- [x] 季节点缀色不受影响
- [x] 文案走 `__()`，`yuki.pot` 按 HEAD + 本件文件重建
- [x] 真浏览器验主色、按钮底色/文字、深色模式与季节点缀色独立

## Comments

### 实现

- **自定义器**：核心「颜色」一节加 `WP_Customize_Color_Control`，设置 `yuki_accent`；
  默认展示 `#A5B4FC`，`sanitize_hex_color`。留空（theme mod 不存在）时不输出任何覆盖。
- **变量**：`yuki_assets()` 用 `wp_add_inline_style()` 输出 `:root,.dark{…}`，覆盖
  `--yuki-primary`、`--yuki-primary-600/700`、`--yuki-primary-foreground`、`--yuki-ring`。
  选择 `:root,.dark` 是因为主题的深色块也定义了这些变量，内联样式要一起赢。
- **hover 档**：`color-mix(in srgb, 强调色 82% / 64%, #000)`，用户只挑一枚颜色。
- **前景色**：`yuki_accent_foreground()` 按相对亮度选 `#0F0F14` 或 `#F3F0EA`；
  按钮、分页当前项这类「强调色底上的字」跟着换。
- **季节色**：`--yuki-season` 完全不动；雪兔与贴纸胶带仍按月份走。

### 验收

新增 `tests/bin/accent-fixtures.php` 与 `tests/bin/verify-accent.mjs`，**24/24**。
临时把强调色设成 `#E85D75`，`finally` 里恢复原值。

实测：`--yuki-primary` 与 `--yuki-ring` 都是 `#E85D75`；按钮底色 `rgb(232, 93, 117)`、
文字 `rgb(243, 240, 234)`（玫瑰色亮度低，自动选暖白）；深色模式同样；季节点缀色仍是
当前的秋琥珀 `rgb(232, 163, 61)`。前景色探针：`#A5B4FC`→深墨、`#E85D75`→暖白、
`#000000`→暖白、`#FFFFFF`→深墨。

回归：季节 23/23、雪兔 28/28、截图 15/15。

### 文案与生成物

`languages/yuki.pot` 106 条，新增「强调色」与说明。`DESIGN.md` 的色彩一节注明「强调色可由
站主覆盖，本表记录默认值」。

### 已知边界

- 只让用户挑一枚颜色；600/700 由 `color-mix` 推导。老浏览器不支持时，这两档退回主题原来的堇紫；
  主色与前景色仍然正确。
- 非常深的强调色推导出的 700 会接近黑色；这是压深的自然结果。
- 季节性装饰色与强调色是两套变量，互不影响。
