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

- **图片灯箱**：正文与说说里的图片可点开看大图。已完成，已随 v1.2.0 发布；同页多图切换仍在 Fog。
- **代码块复制按钮**：正文与说说里的非空代码块一键复制；已完成，待随下一版发布。
- **长文目录**：只从 h2/h3 生成，不做后台配置；已完成。
- **阅读进度**：单篇顶部进度条，`role="progressbar"`；已完成。

### B. 内容形态

- **关联文章**：按分类/标签，站内数据；已完成。
- **相册/画廊页**：尚未开工。
- **文章系列**：非公开 `yuki_series` 分类 + 单篇系列导航；已完成。
- **说说增强**：不引入新数据模型的前提下；尚未开工。

### C. 站点氛围

- **细微动效**：主题切换、卡片 hover，克制；已完成。
- **季节主题 / 背景纹理**：已完成。
- **字体切换**：已完成。
- **自定义吉祥物**：上传/隐藏/名称/身份；已完成。

### D. 作者工作流

- **前台发说说**：登录作者，表单 + 端点；已完成。
- **草稿预览**：尚未开工。
- 不做批量管理与多角色。

## 当前批次

当前没有进行中的批次。第五、六、七、八批均已完成，等待随下一版发布；可选候选见上方四类列表。

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

**第五批：A · 代码块复制。** spec：`.scratch/code-copy/spec.md`；工单：
`.scratch/code-copy/issues/01-code-copy.md`。**实现与验收已完成，待随下一版发布。**
只处理页面已有的非空代码块；容器与按钮由 JS 创建，服务端保持原样；对齐类转移到容器；
剪贴板优先 `writeText`，失败回退 `execCommand`；不新增 token。验收 51/51，全套 28 个验收
脚本与 `verify-package` 65/65 通过。

**第六批：C · 整站数字档案 UI。** spec：`.scratch/ui-redesign/spec.md`；工单：
`.scratch/ui-redesign/issues/01-ui-redesign.md`、
`.scratch/ui-redesign/issues/02-shell-follows.md`。**实现与验收已完成，未发版。**
把整站从纸面资料集改成数字档案：浅色主题下状态栏/导航/hero 跟随冷灰页面，深色主题下
保留深色控制台外壳；CASE FILE、SUBJECT PROFILE、DOCUMENT INDEX、单篇 DOCUMENT/
SECTOR/STATUS + EVIDENCE、归档/搜索/404/侧栏/footer 同一套档案语言。纯 PHP 模板 + CSS，
无构建、无外部字体；保留全部功能、宽度契约与测试钩子。纸面版 `14964e4` 保留在历史里，
但不再代表当前方向。

**第七批：组件库（分三批）。** spec：`.scratch/components/spec.md`；工单：
`.scratch/components/issues/01-content-components.md`、
`.scratch/components/issues/02-reading-components.md`、
`.scratch/components/issues/03-site-modules.md`。**三批实现与验收完成，未发版。**
用户选「全都要，分批做」。第一批只做正文里的五个核心块 pattern（注记/规格表/时间线/证据图卡/
双栏简报），配 `assets/css/components.css`；不注册自定义块、不加 JS、不改单篇布局。
第二批加自动目录、阅读进度与非公开系列分类；目录/进度只在单篇加载，系列不生成前台归档。
第三批是数据条、标签墙、作者卡、订阅卡、页脚链接组，全部复用第一批的标签/边框语法。

**第八批：外观设置 · 自定义吉祥物。** spec：`.scratch/mascot-customizer/spec.md`；工单：
`.scratch/mascot-customizer/issues/01-mascot-customizer.md`。**实现与验收已完成，未发版。**
自定义器新增「Yuki 吉祥物」：方形图上传、显示/隐藏、名称与身份；默认图仍是雪兔，
换图后来源显示「自定义」；关闭时首页角色卡整块移除、封面单列，404/空状态也不出现。

**第九批：C · 玻璃精修与动效。** spec：`.scratch/premium-ui/spec.md`；工单：
`.scratch/premium-ui/issues/01-glass-polish.md`。只加 `assets/css/premium.css` 一层：
导航/侧栏/目录/角色卡/证据图框/数据条/搜索/按钮的圆角与轻量玻璃，封面/列表/侧栏短距入场，
reduced-motion 全关；正文、评论、代码块保持实色，宽度契约不变。**实现与验收已完成，未发版。**

**第九批补充：科技感 HUD。** 工单：`.scratch/premium-ui/issues/02-tech-accent.md`。
在玻璃层之后加 `assets/css/tech.css`：导航信号线/状态点、封面角标与扫描线、数据条读角、
侧栏/目录角标、证据图框 bracket；640px 隐藏扫描线，reduced-motion 停止动画。
**实现与验收已完成，未发版。**

### 二次元成分（跨类）

见 `.scratch/anime-flavor/spec.md`，四批推进：

1. **雪兔 + 微文案**：已实现（`issues/01-mascot.md`）。
2. **贴纸/气泡**：已实现（`issues/02-stickers.md`）——分类徽章变贴纸，空状态用对话气泡。
3. **季节点缀色**：已实现（`issues/03-season.md`）——按月份自动，只染雪兔与贴纸胶带。
4. **hero 动效**：已实现（`issues/04-hero-motion.md`）——7 枚纯 CSS 花瓣，reduced-motion 全停。

### 外观设置（跨类）

见 `.scratch/appearance-settings/spec.md`，四批：

1. **背景图 + 蒙层**：已实现（`issues/01-background.md`）。
2. **页头图**：已实现（`issues/02-header-image.md`）——原生 `custom-header`，导航上方横幅。
3. **强调色**：已实现（`issues/03-accent.md`）——全局主色，hover/前景色自动推导。
4. **字体切换**：已实现（`issues/04-font.md`）——三套系统字体栈，正文与标题一起换。

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
- 2026-10-17：外观设置四批全部完成：**背景图 + 蒙层**、**页头图**、**强调色**、**字体切换**。
- 2026-10-17：`v1.3.0` 发布，二次元四批与外观设置四批一起交付（1039/1039 回归）。
- 2026-10-19：第五批选 **A · 代码块复制**：只认 `.yuki-prose` 与 `.yuki-shuoshuo-body` 的
  非空 `pre`；按钮与容器由 JS 创建，禁用 JS 时原样；对齐类转移到容器；剪贴板优先
  `writeText`、失败回退 `execCommand`；反馈走按钮文字 + `role="status"`；不新增 token。
  验收 `verify-code-copy` 51/51，全套 28 个脚本与 `verify-package` 65/65 通过。
- 2026-10-20：第六批选 **C · 整站设定资料集 UI**。用户在 A–L 中选定 J：二次元放在
  世界观与界面语言里，而不是继续贴雪兔/贴纸。纸面 + 工程网格、蓝图蓝 + 信号橙、
  FILE/SCENE/CHARACTER SHEET/EPISODE INDEX 的档案语法；正文仍 724px，长文优先。
- 2026-10-20：第七批组件库，用户选「全都要，分批做」。先做**文章内档案组件**：
  五个核心块 pattern + 单份 CSS，不注册自定义块、不加 JS；颜色只读 `--da-doc*` 和
  组件自己的 `--yuki-comp-red`，不覆盖全局主色与季节色。编辑器面板点击插入留人工复验。
- 2026-10-20：第二批**单篇阅读组件**完成：目录/进度只在单篇加载；系列用**非公开**
  `yuki_series` 分类，不生成系列归档，少于两篇不输出容器；正文 724px 与侧栏 300px 不变。
  为让评论区、说说、页脚与封面共用一张纸，刻意把既有 `--yuki-background` 从
  `#FDFBF7/#18181F` 改为 `#EDE8DC/#0F1720`，相关断言同步更新并在 spec 写明理由。
  页面标题继续跟随自定义器字体，只有资料集小标签用窄体；截图 `screenshot.png`
  同步重拍为 1200×900。验收 `verify-ui-redesign` 50/50，既有 28 个脚本全绿，
  `verify-package` 65/65 通过。
- 2026-10-20：用户否决纸面 J，要求「电脑上档案那种，参考 scp」；选定**深色控制台 +
  浅色文档面板**。保留 `production-bible.css` 作布局底座，新增 `archive-console.css`
  做数字表面；`--yuki-background` 从纸面 `#EDE8DC/#0F1720` 改为冷灰/黑
  `#DCE3E6/#070C10`，默认 primary 不动；分类徽章继续用季节胶带，不覆盖
  `var(--yuki-season)`。不复制 SCP 标识/原文/等级名称。`verify-ui-redesign` 已改写为
  数字档案；提交 `2387a62` 后全量 29 个脚本与 `verify-package` 均通过。
- 2026-10-20：用户发现浅色主题下顶部外壳不随主题变，比较 A/B/C 后选 **B · 外壳跟随**。
  浅色状态栏/导航/首页与归档 hero 改冷灰，深色模式保留控制台外壳；侧栏与页脚仍是深色块。
  `archive-console.css` 新增 `html:not(.dark)` 覆盖，`verify-ui-redesign` 扩到 58/58；
  同时修了无头 Edge 关闭时临时 profile 的 EPERM 清理，29 个脚本与 package 65/65 全绿。
- 2026-10-20：雪兔改为 **白底证件照卡**：AI 胸像 `assets/images/mascot-yuki.png`
  + 卡框/硬阴影 + 卡底季节色条；不再追求透明抠图，季节只走色条，角色本体固定。
  `verify-mascot` 改为图片卡断言，`verify-season` 继续验卡底颜色；`DESIGN.md` 同步。
- 2026-10-20：第三批**站点模块**完成：首页/归档数据条、侧栏标签墙（12 项后前端收起，
  无 JS 完整展开）、作者卡（只有本站头像回源，否则字母方块）、订阅卡（原生 `required`）、
  页脚三组链接（有 `footer` 菜单时接管）。`verify-site-modules` 34/34，
  全套 32 个脚本与 `verify-package` 65/65 通过；不改正文 724px、侧栏 300px 和 B 外壳。
- 2026-10-22：第八批**自定义吉祥物**完成：自定义器上传方形图 + 显示/隐藏 + 名称/身份；
  默认回退雪兔，换图后来源显示「自定义」；关闭时首页角色卡整块移除、封面单列，
  404/空状态也不出现。`verify-mascot` 扩到 53/53，`verify-season` 23/23 保持默认季节色条。
- 2026-10-23：第九批**玻璃精修**完成：用户要「多运用圆角矩形和玻璃特效，多加动画」。
  在档案层之后加 `assets/css/premium.css`：局部 10–26px 圆角、导航/侧栏/目录/搜索/证据图框的
  轻玻璃、封面/列表/侧栏的短距入场；正文、评论、代码块保持实色。减少动效关闭新增动画与
  transform；`verify-premium-ui` 36/36，既有脚本与 `verify-package` 同步回归。
- 2026-10-23：玻璃层被反馈「缺乏一点科技感」，补 `assets/css/tech.css`：只画 cyan 信号线、
  角标、状态点与扫描线，不改布局/底色/正文；`verify-tech-accent` 30/30，全量回归后提交。
- 测试基建另有一张 `comment-submit-ajax/issues/04-browser-retry-flake.md`，不挡路线图。

## Fog

- 灯箱之后是否要同页多图的左右切换（B/C）。
