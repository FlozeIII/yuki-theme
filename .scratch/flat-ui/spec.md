# 扁平表面 · 更简洁的档案界面

Status: ready-for-agent

## Problem Statement

玻璃层和科技 HUD 层让界面变得柔和、有层次，但也增加了模糊、阴影、扫描线与装饰性伪元素。用户希望界面更简洁，回到扁平化设计：少一点效果，多一点结构。

## Solution

删除 `assets/css/premium.css` 与 `assets/css/tech.css`，新增一层 `assets/css/flat.css`，在现有档案层、组件、站点模块和雪兔卡之后加载。只保留实色表面、细边框、2–5px 小圆角和颜色/边框反馈；不改模板、不改正文宽度、不改已有颜色 token。

## User Stories

- 读者希望导航、侧栏、目录、卡片和按钮看起来干净、平整，没有玻璃模糊或重阴影。
- 读者希望悬停和减少动效时不发生位移，不出现装饰性扫描线或 HUD 角标。
- 站主希望视觉层可以整体移除，不影响模板、宽度和已有内容。

## Implementation Decisions

- `flat.css` 定义 `--yf-radius: 3px`、`--yf-radius-lg: 5px`；导航、角色卡、侧栏、目录、数据条、证据图卡和输入使用实色 + 1px 细边框。
- 去掉页面/封面背景图、`backdrop-filter`、HUD 伪元素、扫描线与新增阴影。
- 按钮/输入/标签 2px 圆角；头部搜索与主题开关 8px、滑块 6px；头像保留圆形；空状态气泡保留 16px 白卡。
- 只保留颜色/边框过渡；`prefers-reduced-motion: reduce` 下压到 0s，不做入场位移。
- `inc/production-bible.php` 用 `yuki_flat_assets()` 在优先级 30 入队，依赖 `yuki-archive-console`、`yuki-components`、`yuki-site-modules`、`yuki-mascot-card`。

## Testing Decisions

- `tests/bin/verify-flat-ui.mjs`：静态/HTTP/无头 Edge，检查导航 radius 0、blur none、shadow none、角色卡 3px 无阴影、数据条 5px、头部搜索/主题开关 8px、滑块 6px、body/hero 无背景图、侧栏无玻璃/阴影/5px、按钮 2px、正文 722px、640 无溢出、reduced-motion。
- 既有 33 个脚本与 `verify-package` 必须继续通过；`wptk check` 只允许既有 info。

## Out of Scope

- 不改模板结构、正文 722px、侧栏 300px、B 外壳策略或全局色彩 token。
- 不新增自定义区块、JS、构建步骤或外部字体。
- 不恢复玻璃/科技层；历史决策保留在 `.scratch/premium-ui/`。

## Further Notes

- 扁平层的目标是「退后一层」，让内容、等宽标签和档案结构承担视觉。
- 空状态气泡的 16px 圆角是 `verify-stickers` 的既有契约，作为唯一例外保留。
