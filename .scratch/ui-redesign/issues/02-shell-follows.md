# 工单 02 · 浅色主题外壳跟随

Status: ready-for-agent
Blocked by: 无（工单 01 已完成）
起点: `2387a62`（数字档案整站）

实现与验收已完成（2026-10-20），待提交。未发版，`style.css` 的 Version 仍为 1.3.0。

## What to build

把浅色主题下的顶部外壳从「固定深色」改成 **跟随页面**（B 方案）：状态栏、导航、
首页 hero、归档/搜索 hero 都变成冷灰/浅色，文字与状态色同步转成深色。
深色主题保持原有的深色控制台；侧栏、页脚、filebar、sheet header 仍保留深色块。
单篇与静态页的浅色文档面板不变。

这样切换主题时第一屏会有明确反馈，而不是只有文档面板/页面底色在变。

## 范围

- 只改 `assets/css/archive-console.css`：新增 `html:not(.dark)` 覆盖，不动
  `production-bible.css` 的布局、`style.css` 的全局 token、默认 primary 与宽度契约。
- 浅色状态栏 `#E7EDEF`、导航 `rgba(241,245,246,.96)`、hero `#DCE3E6`；
  文字 `#162126` / `#3F525B`，状态 cyan `#1C6B7A`、red `#A94A25`。
- 搜索按钮、主题开关、brand mark、cover meta、cover specs、character sheet 的边框/阴影
  同步改成浅色语境，避免顶部变浅后出现白字或黑框硬切。
- 深色模式规则保持不变；`verify-ui-redesign` 增加浅色状态栏/导航/hero 的颜色断言。
- `verify-screenshot` 接受浅色或深色的系统外壳，不再要求截图里有深色控制台。
- 顺手修 `tests/bin/browser.mjs` 的关闭清理：Edge 退出慢时重试删除临时 profile，
  不让 `EPERM` 伪装成断言失败。

## 不做什么

- 不改模板文案、不改 POT（没有新增可翻译字符串）。
- 不改 `style.css` 的 Version、不发版、不生成 ZIP。
- 不把侧栏、页脚、filebar 也刷成浅色；它们仍是深色块。
- 不改强调色、季节胶带、宽度 token 或既有测试钩子。

## 验收

- [x] 浅色首页状态栏 `rgb(231, 237, 239)`、导航 `rgba(241, 245, 246, 0.96)`、
  hero `rgb(220, 227, 230)`。
- [x] 深色首页仍是 `#030608` 状态栏与 `#0A1116` hero，控制台外壳没有回退。
- [x] 单篇浅色文档面板、722px 正文、300px 侧栏、filebar 左对齐全部保持。
- [x] 640px 首页仍单栏、无横向滚动；主题切换不再只改页面底色。
- [x] `verify-ui-redesign` 58/58（新增 3 条浅色外壳断言）。
- [x] 全量 29 个脚本与 `verify-package` 65/65 全部通过。
- [x] `wptk check` 0 error / 0 warning（8 条既有 info）。
- [x] `screenshot.png` 重拍为浅色 B 版 1200×900。
- [x] 只提交自己的路径；holds 没有新增占用；提交后核对 `git log --stat -1`。

## Comments

### 实现

- 用户在 A/B/C 对比中选 B：A 的固定深色外壳让浅色切换看起来「顶部没变」，
  C 的浅色导航 + 深色 hero 断开，B 整页一起切。
- 覆盖写在 `archive-console.css` 末尾的 `html:not(.dark)` 段，包含状态栏、导航、搜索按钮、
  主题开关、首页 hero、archive hero、cover meta/specs、character sheet 阴影。
- 深色规则仍由 `.dark body.yuki-production-bible` 和原有 `.yuki-production-bible` 规则承担；
  没有改 `--da-*` 的全局值，侧栏/页脚继续用深色。
- `tests/bin/browser.mjs` 的 `close()` 先等 Edge 退出，再对 `EPERM/EBUSY/ENOTEMPTY`
  重试删除临时 profile；清理失败不再抛成验收失败。

### 验收

- `verify-ui-redesign` 58/58；浅色外壳三条断言均为实际 computed 值。
- 分批跑完 29 个 `tests/bin/verify-*.mjs`，全部 rc=0；`verify-package` 65/65。
- 定向：background 25/25、motion 19/19、screenshot 16/16、season 23/23、stickers 24/24、
  accent 24/24、code-copy 51/51、comment-nesting 53/53、font 18/18、editor-alignment 58/58。
- `wptk check` 0 error / 0 warning / 8 info。

### 已知边界

- 浅色下侧栏和页脚仍是深色块，这是刻意的「档案夹封底/边注」，不是遗漏。
- 分类徽章仍带季节胶带（当前秋季橙色）；不覆盖 `var(--yuki-season)`。
- 没有新增文案，POT 不变；`style.css` 的 Version 仍为 1.3.0。
