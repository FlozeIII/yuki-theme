// 从主题的 style.css 里读 token、规则与头部字段，以及几个算颜色的小工具。
//
// 工单 03（评论区的配色）与工单 08（说说归档的版式）都要做同一类事情：断言某处的颜色
// 就是某个 token、以及在真浏览器里量到的颜色与 token 对得上。同一段解析写两遍就会分叉，
// 所以放这里共用。工单 04 要的是同一份 style.css 的**头部字段**（对产物那份读），
// 也就落在同一个道理上。
//
// 用法：
//   import { themeCss, themeHeader, cssBlock, tokens, hexToRgb, contrast } from './theme-css.mjs';
//   const css = themeCss();
//   const dark = tokens( '.dark' );
//   const header = themeHeader( css );   // 也可以喂产物里那份（ZIP 条目的文本）

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib.mjs';

/** 行尾统一成 \n：工作区里是 CRLF，包里是提交中的字节，按行找东西会找不到。 */
function lf(text) {
  return text.replace(/\r\n/g, '\n');
}

/** 仓库里那份 style.css 的内容。 */
export function themeCss() {
  return lf(fs.readFileSync(path.join(REPO_ROOT, 'style.css'), 'utf8'));
}

/**
 * style.css 开头那段注释的表头：读一次，给一份 `键: 值`。
 *
 * 收在这里而不是各处自己写一遍：要读的有时候不是仓库里那份，而是**产物里那份**
 * （ZIP 条目，与工作区不是同一串字节），所以参数是文本而不是路径——「行尾归一」与
 * 「表头就是开头那块注释」这两件事也就只写这一处。
 */
export function themeHeader(css) {
  const block = /^\s*\/\*([\s\S]*?)\*\//.exec(lf(css))?.[1] ?? '';
  const header = {};
  for (const m of block.matchAll(/^([^:\n]+):[ \t]*(.*)$/gm)) {
    header[m[1].trim()] = m[2].trim();
  }
  return header;
}

/** 取一个 `选择器 { ... }` 块的内容，找不到返回空串。 */
export function cssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'i').exec(css)?.[1]?.trim() ?? '';
}

/** 取一段 token 块（:root 或 .dark）里的 `--yuki-x: 值`。 */
export function tokens(css, selector = ':root') {
  const out = {};
  for (const m of cssBlock(css, selector).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** 一段 CSS 里用到的 var(--x)，去重后按出现顺序。 */
export function usedTokens(text) {
  return [...new Set([...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))];
}

/** 值看起来是不是颜色：hex / rgb() / hsl()，以及 white、black 这类命名色。 */
export function isColor(value) {
  const v = (value ?? '').trim();
  return /^(#|rgb|hsl)/i.test(v) || /^(white|black|red|blue|green|gray|grey)$/i.test(v);
}

/** `#22222B` → `rgb(34, 34, 43)`（浏览器 getComputedStyle 给的格式）。 */
export function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** WCAG 相对亮度，接受 `rgb(r, g, b)` 或 `#rrggbb`。 */
function luminance(color) {
  const parts = color.startsWith('#')
    ? hexToRgb(color).match(/\d+/g)
    : color.match(/\d+/g);

  const [r, g, b] = parts.slice(0, 3).map((v) => Number(v) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** 两个颜色的对比度。两者都可以是 `#rrggbb` 或 `rgb(r, g, b)`。 */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
