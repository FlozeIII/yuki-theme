# 01 · 白底证件照卡

Status: ready-for-agent

## What to build

把 `template-parts/mascot.php` 从内联 SVG 插画改为白底证件照卡：AI 胸像图片 + 卡框/阴影 +
底部季节色条。所有旧尺寸钩子、`aria-hidden`、首页/404/空状态调用位置保持不变。

## 范围

- `assets/images/mascot-yuki.png`：512×512、白底、不透明，由 `ai-id-photo.png` 裁掉左右白边后缩放。
- `template-parts/mascot.php`：`<span class="yuki-mascot yuki-mascot--photo yuki-mascot--{size}">`
  包 `<img class="yuki-mascot-photo">` 和内联季节条 SVG。
- `assets/css/mascot-card.css`：卡框、硬阴影、`object-fit`、季节条高度、reduced-motion。
- `inc/production-bible.php`：在 `yuki-archive-console` 之后入队 `yuki-mascot-card`。
- `tests/bin/verify-mascot.mjs`：从“内联 SVG”改为“图片卡 + 季节条”。
- `DESIGN.md`：季节只走卡底；雪兔改成方形照片卡。
- `.scratch/mascot-id-photo/spec.md`：本工单依据。

## Blocked by

无。用户已经选定白底证件照卡（m02465），AI 胸像已生成。

## 验收

- [x] 模板输出 `.yuki-mascot yuki-mascot--photo`，外层 `aria-hidden="true"`，图片 `alt=""`。
- [x] 图片来源为 `assets/images/mascot-yuki.png`，不是远程 URL。
- [x] 卡片内有 `fill="var(--yuki-season)"` 的季节条。
- [x] 首页 hero 的卡宽 176px、404 为 96px、640px 下仍有尺寸且不横向滚动。
- [x] 深色主题下卡片仍可见，卡框/阴影不塌。
- [x] `verify-mascot` 31/31、`verify-season` 23/23、`verify-ui-redesign` 58/58。
- [x] `verify-stickers` 24/24 不被空状态照片卡破坏。
- [x] `verify-screenshot` 16/16；`screenshot.png` 重拍后能看到新卡。
- [x] `verify-package` 65/65；`wptk check` 0 error / 0 warning / 8 info。
- [ ] 全套 29 个 `verify-*.mjs` 全绿；当前 28/29，`verify-harness` 被 8099 端口占用挡住。
- [x] 只提交本工单路径；`ui-redesign/` 临时文件不提交。

## Comments

- 实现：`template-parts/mascot.php` 改为白底照片卡；`assets/images/mascot-yuki.png` 由 AI 胸像裁掉左右白边后缩到 512×512；`assets/css/mascot-card.css` 负责卡框、硬阴影与底部季节条；`inc/production-bible.php` 在 `archive-console.css` 之后加载。
- 测试：`verify-mascot` 改为检查图片来源、`aria-hidden` 和季节条；31/31。`verify-season` 23/23（卡底仍是 `var(--yuki-season)`）。`verify-ui-redesign` 58/58；`verify-stickers` 24/24；`verify-screenshot` 16/16；全量 28/29 通过，`verify-package` 65/65，`wptk check` 0 error / 0 warning / 8 info。
- 已知环境边界：`verify-harness` 未通过，因为本机 8099 端口被另一个会话的 `serve_vega` 占用，stub 起不来；不是主题改动导致。其余 28 个脚本全绿。
- 视觉：首页 hero 176px 卡、404 96px 卡、深色主题下卡框仍可见；`screenshot.png` 已重拍为 1200×900。
