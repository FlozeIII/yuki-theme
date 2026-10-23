# 玻璃精修 · 数字档案的高级感

Status: ready-for-agent

> **已被取代**：玻璃层/科技 HUD 层已删除，当前视觉以 `.scratch/flat-ui/spec.md` 与 `assets/css/flat.css` 为准；本文件仅保留历史决策。

## Problem Statement

数字档案界面已经能用，但表面仍是直角、实色、平铺的档案卡片，动效也克制到接近静止。用户希望在不丢掉档案语言的前提下，多一点「高级感」：更柔和的圆角矩形、轻量的玻璃层次，以及更明显的过渡与入场动画。

## Solution

只加一层可移除的 `assets/css/premium.css`，在现有样式之后加载，不改模板、不改宽度契约、不改已有颜色 token。圆角与玻璃集中在可交互和可阅读的表面上，动效只做进入、悬停和状态提示，不拦截阅读。

## User Stories

1. 作为读者，我打开首页时看到卡片和侧栏有柔和的圆角、轻微透明和层次阴影，而不是一叠直角实色块。
2. 作为读者，我悬停文章、角色卡、目录或按钮时能得到轻微上浮、光晕或扫光反馈，但不会误触或跳动。
3. 作为读者，正文、评论和代码块仍然保持原来的宽度、对比度和可读性。
4. 作为对动效敏感的用户，开启减少动效后所有新增动画停止，只保留颜色变化。
5. 作为维护者，我可以在不改模板、不引 JS、不引外部字体的情况下移除这一层，回到原来的档案界面。

## Implementation Decisions

- 新文件 `assets/css/premium.css`，由 `inc/production-bible.php` 在 `wp_enqueue_scripts` 优先级 30 入队，依赖 `yuki-archive-console`、`yuki-components`、`yuki-site-modules`、`yuki-mascot-card`。
- 新增局部变量 `--yp-radius-sm/md/lg/xl`、`--yp-glass-*`、`--yp-shadow-*`；不覆盖 `--yuki-radius-*`，避免影响空状态气泡的 16px 契约。
- 圆角：侧栏卡片/标签墙/订阅卡/目录/系列/上下篇/角色卡/证据图框/搜索框 14–26px，按钮与输入 10–12px，缩略图 10px。
- 玻璃：只放在导航、侧栏卡片、标签墙、订阅卡、角色卡、搜索对话框、上下篇等表面；正文面板、评论区、代码块按钮保持实色。使用 `backdrop-filter` + `@supports` 回退。
- 动效：页面入场（标题、角色卡、列表项、侧栏卡片）用短距上浮 + 淡入；悬停用阴影/边框/轻微上浮；按钮加扫光；导航加滚动阴影；全部在 `prefers-reduced-motion: reduce` 下关闭动画和 transform。
- 不改变 `.yuki-nav`、`.yuki-post-item:hover`、`.yuki-btn`、`.yuki-code-copy`、`.yuki-comment-body`、`.yuki-empty-state p` 的既有背景色/边框/宽度契约。

## Testing Decisions

- 新增 `tests/bin/verify-premium-ui.mjs`：静态检查 CSS/加载/圆角/玻璃/动画/reduced-motion；HTTP 检查样式表、无新增 JS；无头 Edge 检查 1440 圆角与 `backdrop-filter`、首页入场动画、单篇目录/侧栏、640 无横向滚动、深色玻璃和 reduced-motion 动画关闭。
- 既有 32 个 `tests/bin/verify-*.mjs` 全跑；重点 `verify-ui-redesign`、`verify-motion`、`verify-stickers`、`verify-code-copy`、`verify-comment-nesting`、`verify-package`。
- 截图：浅色/深色首页、单篇、640 移动端；确认正文不变窄、不遮挡。

## Out of Scope

- 不加 JS、不引外部字体/图片、不做鼠标跟随或滚动监听。
- 不改模板结构、页面宽度、侧栏宽度、正文 724px、B 外壳策略。
- 不改品牌主色、季节色、分类徽章胶带和空状态气泡。
- 不把正文、代码块、评论区做成玻璃；可读性优先。

## Further Notes

玻璃效果按 `@supports (backdrop-filter: blur(1px))` 渐进增强；不支持的浏览器仍得到圆角、阴影和实色表面。圆角/动画均为可移除层，出问题时可单独停用 `yuki-premium`。

## 科技感 HUD（后续迭代，m04985）

在 `premium.css` 之上再加 `assets/css/tech.css`，只在装饰层补：
- 导航底部 cyan 信号线、品牌状态点；
- 封面四角 bracket 与跨封面的低频扫描线；
- 数据条读角/短刻度、侧栏与目录右上角标、证据图卡四角 bracket；
- 角色卡/按钮 hover 的 cyan 边光。

不新增可见文案、不改底色/尺寸/宽度，扫描线与状态点在 `prefers-reduced-motion: reduce` 下停止；640px 隐藏跨封面扫描线。完整验收见 `issues/02-tech-accent.md`。
