# 雪兔改成白底证件照卡

Status: ready-for-agent

## Problem Statement

主题现在的雪兔是一张内联 SVG 插画。它足够轻，但在数字档案的界面语言里没有“被系统收录”的感觉：
插画浮在 `SUBJECT PROFILE` 的网格上，更像一张贴纸，而不是档案里的一张照片。读者看到的
`SUBJECT PROFILE` 字段（DESIGNATION / CLASS / HEIGHT / ORIGIN）也没有一个真正的“照片内容”去对应。

用户在看到三版矢量草稿与本机生成的 AI 胸像后，选择了 **白底证件照卡**：不追求透明背景，
把 AI 胸像放进一张白底照片卡，卡框、阴影和季节色条由主题负责。这样既保留“雪兔”这个角色，
又让首页的 `SUBJECT PROFILE` 与 404/空状态的角色档案看起来像同一套档案材料。

## Solution

把 `template-parts/mascot.php` 从内联 SVG 改成：

1. 一张 `assets/images/mascot-yuki.png`（512×512，白底，不透明）作为照片内容；
2. 外层 `<span class="yuki-mascot yuki-mascot--photo yuki-mascot--{size}">`，保持原来的
   `.yuki-mascot` / `--sm` / `--lg` 钩子与 `aria-hidden="true"`；
3. 内联 SVG 季节条贴在卡片底部，`fill="var(--yuki-season)"`；
4. 新样式 `assets/css/mascot-card.css` 负责卡框、硬阴影、图片裁切和季节条，由
   `inc/production-bible.php` 在 `archive-console.css` 之后加载。

## User Stories

- 作为读者，我在首页 `SUBJECT PROFILE` 里看到一张像证件照的雪兔，而不是一张浮在网格上的贴纸。
- 作为读者，我在 404 和空归档/空搜索里仍能认出同一个角色，只是尺寸更小。
- 作为读者，季节变化仍能被感知：卡底细色条随春/夏/秋/冬切换，但角色本人不换脸。
- 作为使用读屏软件的读者，这张卡是纯装饰，不读出一张没有说明的图片。
- 作为维护者，我不需要为这张卡引入构建步骤、外部字体或 CDN 图片。

## Implementation Decisions

- **固定白底，不做透明抠图**。`gpt-image-2` 不支持透明背景；胸像的白毛与白底连通，泛洪抠图会
  把脸一起抠掉。白底本身就是照片纸，卡框负责边界。
- **图片只保留一张 512×512 PNG**，由 AI 胸像裁掉左右白边后缩放。所有尺寸共用同一张图，浏览器
  缓存一次；`width`/`height` 固定，避免布局抖动。
- **卡片是装饰性的**：外层 `aria-hidden="true"`，`img` 用空 `alt`；语义由旁边的
  `SUBJECT PROFILE` / 字段表承担。
- **季节色只走卡底**：SVG 条 `viewBox="0 0 12 4"`、`preserveAspectRatio="none"`，CSS 高度
  `clamp(3px, 4%, 6px)`；角色围巾固定橙色，不再随季节变色，避免“换季换角色”的错觉。
- **卡框语法**：1px 墨色边框 + 3px 硬阴影；hero 用 2px 边框 + 6px 硬阴影；`prefers-reduced-motion`
  下去掉阴影。圆角保持 0，和数字档案的 2px 直角语汇一致。
- **不改 `style.css`**：新样式放独立文件，避免触碰共享的全局 token 与并行会话 hold。
- **`verify-mascot` 需要同步**：原来要求 `class="yuki-mascot` 直接出现在 `<svg>` 上；现在外层是
  `<span>`，季节条才是 SVG。测试改为检查图片卡、图片来源、`aria-hidden` 和季节条。
- **`verify-season` 不变**：静态仍能匹配 `var(--yuki-season)`，运行时仍能查到
  `[fill="var(--yuki-season)"]` 并量到当前季节色。

## Testing Decisions

- `node tests/bin/verify-mascot.mjs`：模板结构、图片文件存在、图片来源是本站、HTTP 四类页面
  （首页 / 404 / 空归档 / 空搜索）、hero 176px、404 96px、640px 不横向滚动、深色下有尺寸。
- `node tests/bin/verify-season.mjs`：卡底季节条 computed fill 等于当前 season。
- `node tests/bin/verify-ui-redesign.mjs`：数字档案外壳与文档面板没有被这张卡破坏。
- `node tests/bin/verify-stickers.mjs`：空状态气泡仍是 16px 白卡，不被照片卡样式影响。
- `node tests/bin/make-screenshot.mjs`：1200×900 主题截图里能看到新卡；`verify-screenshot` 继续
  接受“深色控制台外壳 + 浅色文档面”的混合画面。
- 全套 29 个 `tests/bin/verify-*.mjs`、`verify-package.mjs`、`wptk check`。

## Out of Scope

- 透明背景 PNG / 抠图；`gpt-image-2` 当前不支持。
- 每个季节一张不同立绘；季节只换色条。
- 用 AI 图替换头像、文章缩略图或站点图标。
- 为照片卡增加新的后台设置。
- 改 `style.css` 的全局 token 或主题版本号。

## Further Notes

- 图片由本机 image-gen 生成（`gpt-image-2`，1024×1024 白底），裁掉左右白边后缩到 512×512；
  源图只留在临时目录，不随主题发布。
- 卡底季节条是新的“季节装饰”入口；`DESIGN.md` 里“雪兔耳朵/脸颊/围巾随季节”的旧说明已同步改成
  “只有卡底色条随季节”。
- 这张卡不解决“雪兔是否要更矢量/更扁平”的问题；它只是把现有角色放进档案系统。如果以后要换插画，
  替换 `assets/images/mascot-yuki.png` 即可，模板和测试不需要重写。
