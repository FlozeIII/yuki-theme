# 会话弧线记录：session-deb3d979

**为什么有这份文件**：原会话（`~/.dsh/sessions/--D-Projects-yuki-theme--/session-deb3d979-*`）
累积到约 120 万 token，超过上游 1M 窗口，整段历史裸发被 400 拒绝，无法继续对话。
磁盘上的记录没丢（8543 条记录 / 23MB / 42 轮），但没有压缩态就发不出去。
这份文件是它的可读摘要，供后续会话直接接手。

- 会话时间：2026-10-19 → 2026-10-22 12:19
- 规模：42 轮用户输入、1348 次工具调用、1320 条助手消息

## 落点（2026-10-22 核对）

- `main` = `6632639`，与 `origin/main` 同步，工作树干净，`.scratch/holds.md` 为空。
- 已发布 `v1.3.0`（标签 `v1.3.0`）；之后的改动已合并、**未发版**。
- 32 个验收脚本全绿；`verify-package` 65/65；`wptk check` 0 error / 0 warning。
- 本地验证站默认没在跑，起法见 `docs/agents/handoff.md`。

## 这段时间做完的事（按提交）

| 提交 | 内容 |
| --- | --- |
| `f9b9a92` | 代码块复制：`assets/js/code-copy.js`，只处理 `.yuki-prose` / `.yuki-shuoshuo-body` 里的非空 `pre`，`textContent` 复制，clipboard 失败回退 `textarea + execCommand` |
| `14964e4` | 整站改成「设定资料集 / Production Bible」UI（方向 J） |
| `2387a62` | 再改成「数字档案」UI：深色系统外壳 + 浅色文档面板（SCP 式） |
| `d2d0052` | 浅色主题下外壳跟随页面（B 方案），并修无头 Edge 退出时临时 profile 的 EPERM |
| `37f0691` | 雪兔改成白底证件照卡（`assets/images/mascot-yuki.png` 512×512） |
| `ccc0087` | 文章内五个档案 pattern：注记、规格表、时间线、证据图卡、双栏简报（只用核心块） |
| `ca3a53a` | 单篇目录、阅读进度条、系列导航（非公开 `yuki_series` 分类） |
| `9cf12cf` | 站点模块：数据条、标签墙、作者卡、订阅卡、页脚链接组 |
| `986a41b` | 修单篇侧栏与文章头部对齐 |
| `6632639` | 浅色下单篇侧栏与证据图框改用纸面 |

## 设计决策与理由（重开设计前先看，别推翻重来）

1. **UI 方向是四轮演化出来的，不是一次定的**：原版「深色底 + 紫色 + 圆角卡片 + 居中 Hero」
   被认为有通用模板感 → 给了 12 个方向 → 用户选 J（设定资料集）→ 实现后用户嫌纸质感，
   参照 SCP 改成数字档案（深色外壳包住浅色文档）→ 又修了一轮浅色协调性。现版 = J 的档案
   语法 + SCP 的深色系统外壳。
2. **主题切换被误认为坏了**：实测浅色 `body` `rgb(220,227,230)` → 深色 `rgb(7,12,16)`，确实在变；
   但状态条、导航、首页 hero 固定深色，而首页第一屏恰好全是外壳。给了 A/B/C 三方案对比图后
   用户选 **B**：浅色下状态栏 `#E7EDEF`、导航 `rgba(241,245,246,.96)`、hero `#DCE3E6`，
   深色仍保留控制台。**不要再退回「外壳恒定深色」。**
3. **吉祥物为什么不直接换成 AI 图**：主题里的雪兔是内联 SVG，围巾用 `var(--yuki-season)` 跟随季节。
   AI 生图（`gpt-image-2`）不支持透明底；按轮廓抠白时，胸像版的白毛和背景连通、脸被一起抠掉。
   最终采用「白底证件照卡」：PNG 胸像 + 底部一条内联 SVG 季节条，保住 `.yuki-mascot` 钩子与季节色。
4. **侧栏空列 bug 的根因**：`.yuki-single-layout` 只包住正文与侧栏，`filebar` 和
   `.yuki-article-header` 在它外面，侧栏要等标题区结束才开始，标题右侧就空一整列（深色下不明显，
   浅色下是一块白）。修法是把 `filebar` 与 `.yuki-article-header` 移进 `.yuki-article-main`。
   **宽度契约未动**：正文 722px、侧栏 300px、640px 以下单列。

## 环境坑（踩过，别再踩）

- 工作区沙箱会挡住 `C:\Users\Floze\wp-dev` 的写权限，本地站因此起不来；需要 danger-full-access。
- 无头 Edge 退出时清理临时 profile 会 EPERM，曾在 `d2d0052` 里修过，否则会伪装成断言失败。
- `verify-hitokoto` 出现过 44/46，是本机上游请求超时的耗时断言，与主题改动无关。
- `wptk` 不在 PATH 时用
  `node C:/Users/Floze/AppData/Roaming/npm/node_modules/wp-theme-kit/bin/wp-theme-kit.mjs`。

## 未回答的问题（原会话就结束在这里）

用户在第 39、41 轮问了两次同一句，都没得到回答：

> 为什么里面还有 php，不能全用 nodejs 吗

接手的人应正面回答，而不是绕开。要点：Yuki 是 WordPress 主题，页面由 PHP 模板层渲染
（`functions.php` / `template-parts/` / `inc/`），仓库里的 Node 只用于 `tests/bin/` 验收与
`wptk` 工具链；「全用 Node」等于放弃 WordPress、换 SSG 或 headless 方案，会推翻
`CONTEXT.md` 里「主题形态」这条约束，属于换项目而不是改代码。

## 下一步候选（与 roadmap 一致）

1. **发 v1.4.0**：升版本号、重建 POT、重跑 Theme Check 与 `verify-package`、打 tag。
2. 灯箱同页多图左右切换（Fog 里只剩这一项）。
3. 相册 / 画廊页。
4. 说说增强。
