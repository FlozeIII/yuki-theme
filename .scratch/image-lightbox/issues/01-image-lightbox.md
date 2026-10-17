# 01: 正文图点开看大图

**What to build:** 在 `.yuki-prose` 与 `.yuki-shuoshuo-body` 里做一层图片灯箱：点击（或聚焦后
Enter/Space）打开深色遮罩，显示页面里能提供的最大可用图与图注；Esc、点遮罩、点关闭按钮都能关，
关闭后焦点回到触发图。

**范围。** 裸图、区块图、传统图注、画廊、说说正文图。特色图、列表缩略图、头像、Logo 不碰。
图片外有链接时：指向图片文件或带 `rel=attachment` 的附件页链接才接管，其余链接照常导航。

**大图。** 依次取：链接 `href`（仅图片文件）→ `srcset` 最大候选 → `currentSrc` → `src`。
不注册新尺寸、不做服务端裁剪。

**视觉。** `DESIGN.md` 已定义 `--yuki-overlay-backdrop` / `--yuki-overlay-foreground`；不新添颜色。
浮层由 JS 在首次打开时创建，服务端不输出遮罩；禁用 JS 时行为不变。

**可访问性。** `role="dialog"`、`aria-modal="true"`、可翻译的对话框名；焦点进入关闭按钮、
Tab 在浮层内循环、关闭后回到触发图；锁背景滚动；`prefers-reduced-motion` 下无过渡。
裸图补 `tabindex="0"` / `role="button"` / `aria-label`；已在链接里的图沿用链接语义。

**Blocked by:** 无（可以立刻开始）

**Status:** ready-for-agent

- [ ] 点正文裸图，遮罩出现并显示 `srcset` 里最大的那张
- [ ] 图注优先 `figcaption`，其次传统图注/画廊图注，最后 `alt`
- [ ] Esc、点遮罩、点关闭按钮三条路都能关
- [ ] 打开时焦点在关闭按钮；关闭后回到触发图；Tab 不会跑到背景页面
- [ ] Tab 能聚焦裸图，Enter/Space 能打开
- [ ] 图片链接到媒体文件时，点击被接管且当前页 URL 不变
- [ ] 图片链接到站内锚点/别的页面时，链接照常工作
- [ ] 带 `rel=attachment` 的附件页链接被接管，大图走 `srcset`
- [ ] 说说正文图可以打开
- [ ] 特色图、列表缩略图、头像、Logo 点击后不出现遮罩
- [ ] 浅色/深色遮罩都等于 token；640px 视口无横向滚动
- [ ] `prefers-reduced-motion` 下没有缩放/淡入过渡
- [ ] 服务端 HTML 里没有遮罩标记；禁用 JS 时图片保持原行为
- [ ] 没有新增外部依赖、构建步骤或模板改动
- [ ] 新增文案走 `__()`，`languages/yuki.pot` 按 HEAD + 自己改的文件重建
- [ ] 真浏览器断言覆盖打开/关闭/键盘/链接/范围；静态断言覆盖 token 与 reduced-motion

## Comments
