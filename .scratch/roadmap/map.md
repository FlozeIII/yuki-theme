# 路线图

Status: active
Type: map

四类的全貌与当前批次。每批只开 1–2 件；开工时在 `.scratch/<feature>/` 下写 spec，
并在本文件的「决策记录」里留一条指针。

## 判据

- **极简线**（`CONTEXT.md`）：线内是「单人博客的自我表达与氛围」，线外是「面向社区或运营」。
  作者工具只要服务单人表达就在线内；变成管理（批量、多角色、审核流）就出线。氛围类不能盖过可读性。
- 每件都要能回答：**它是在帮一个人表达，还是在帮一个组织运营？**

## 四类与候选

### A. 阅读体验

- **[当前] 图片灯箱**：正文与说说里的图片可点开看大图。
- 代码块复制按钮。
- 长文目录（只从标题生成，不做后台配置）。
- 阅读进度。

### B. 内容形态

- 关联文章（按分类/标签，站内数据）。
- 相册/画廊页。
- 文章系列。
- 说说增强（不引入新数据模型的前提下）。

### C. 站点氛围

- 细微动效（主题切换、卡片 hover，克制）。
- 季节主题 / 背景纹理。
- 字体切换。

### D. 作者工作流

- 前台发说说（登录作者，表单 + 端点）。
- 草稿预览。
- 不做批量管理与多角色。

## 当前批次

**第一批：A · 图片灯箱。** spec：`.scratch/image-lightbox/spec.md`；工单：
`.scratch/image-lightbox/issues/01-image-lightbox.md`。**实现已完成（`a48c32d`），已随 v1.2.0 发布。**
纯前端、不引外部库、不进数据模型；验收走真浏览器。

**第二批：B · 关联文章。** spec：`.scratch/related-posts/spec.md`；工单：
`.scratch/related-posts/issues/01-related-posts.md`。**实现已完成，已随 v1.2.0 发布。**
同分类优先、同标签补足、最多三篇；无关联不占位，说说不显示。

**第三批：C · 动效收敛。** spec：`.scratch/motion/spec.md`；工单：
`.scratch/motion/issues/01-motion.md`。**实现已完成，已随 v1.2.0 发布。**
只停运动、保留颜色；列表 hover 背景 + 1px 浮起；上下篇 1px；补统一焦点环。

**第四批：D · 前台发说说。** spec：`.scratch/shuoshuo-composer/spec.md`；工单：
`.scratch/shuoshuo-composer/issues/01-shuoshuo-composer.md`。**实现已完成，已随 v1.2.0 发布。**
说说归档顶部写作框；`publish_posts` 才能用；表单 POST + 重定向；失败保留正文。

### 二次元成分（跨类）

见 `.scratch/anime-flavor/spec.md`，四批推进：

1. **雪兔 + 微文案**：已实现（`issues/01-mascot.md`）。
2. **贴纸/气泡**：已实现（`issues/02-stickers.md`）——分类徽章变贴纸，空状态用对话气泡。
3. **季节点缀色**：已实现（`issues/03-season.md`）——按月份自动，只染雪兔与贴纸胶带。
4. **hero 动效**：已实现（`issues/04-hero-motion.md`）——7 枚纯 CSS 花瓣，reduced-motion 全停。

### 外观设置（跨类）

见 `.scratch/appearance-settings/spec.md`，四批：

1. **背景图 + 蒙层**：已实现（`issues/01-background.md`）。
2. 页头图（`custom-header`）：待做。
3. 强调色：待做。
4. 字体切换：待做。

## 决策记录

- 2026-10-17：四类全要，按批推进；第一批选图片灯箱。极简线补上「作者工具」判据（见 `CONTEXT.md`）。
- 2026-10-17：灯箱第一版只做**单图**，同页多图不做左右切换；B/C 留在 Fog。
- 2026-10-17：新增浮层表面 token `--yuki-overlay-backdrop` / `--yuki-overlay-foreground`，已写进 `DESIGN.md`；深浅色共用。
- 2026-10-17：灯箱的关闭与可访问性做到完整一层（Esc/遮罩/按钮、焦点返回、`role="dialog"`、锁滚动、reduced motion）；验收走真浏览器 + 静态。
- 2026-10-17：触发范围只认 `.yuki-prose` 与 `.yuki-shuoshuo-body`；链接只接管图片文件与带 `rel=attachment` 的附件页，其余不劫持。
- 2026-10-17：大图依次取链接 `href`（仅图片文件）→ `srcset` 最大候选 → `currentSrc` → `src`。
- 2026-10-17：键盘入口沿用既有语义；只有裸图补 `tabindex`/`role`/`aria-label`。
- 2026-10-17：第二批选**关联文章**：同分类优先、同标签补足、最多 3 篇；放在上下篇之后、评论之前；
  无关联不占位；说说文章不显示。实现与验收已完成。
- 2026-10-17：第三批选**动效收敛**：`prefers-reduced-motion` 只停运动、保留颜色；列表 hover
  背景 + 缩略图 1px、上下篇 1px；列表/上下篇/关联/标签补同一枚焦点环。实现与验收已完成。
- 2026-10-17：第四批选**前台发说说**：说说归档顶部写作框，`publish_posts` 才能用；
  表单 POST + 重定向；失败保留正文。实现与验收已完成。
- 2026-10-17：`v1.2.0` 发布，A–D 四批一起交付（864/864 回归，Theme Check 计数不变）。
- 2026-10-17：二次元成分分四批；第一批**雪兔 + 微文案**完成（hero/404/空状态），
  第二批**贴纸/气泡**、第三批**季节点缀色**与第四批**hero 动效**都已完成。
- 2026-10-17：外观设置分四批；第一批**背景图 + 蒙层**完成，页头图/强调色/字体待做。
- 测试基建另有一张 `comment-submit-ajax/issues/04-browser-retry-flake.md`，不挡路线图。

## Fog

- 灯箱之后是否要同页多图的左右切换（B/C）。
