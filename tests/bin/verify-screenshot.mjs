// 工单 02 的验收：主题顶层那张 screenshot.png——首页 · 浅色的真实渲染。
//
// 分两层看，都不碰生成脚本的实现，只看产物：
//   - **文件级的事实**从字节里读：是 PNG 吗、多大。这一段单看文件就够，不依赖浏览器。
//   - **画面级的事实**交给真浏览器：把图当普通图片加载进一个页面，画到 canvas 上读像素。
//     「不是纯色」「不是空白」「底色是浅色那一套的底」在文件头里看不出来，只有像素知道。
//     这正是 browser.mjs 存在的理由（它本来就是「HTML 里看不出来的东西」那只眼睛）。
//
// 最后一节把**现在的首页**在同一视口下重渲染一遍：不是重拍一张比对（页面上有日期、
// 别的会话还会改内容，比对必然抖），而是确认「拍的时候那些条件」还在——首页模板在、
// 文章够、第一屏有缩略图、实时底色与图里读到的底色是同一个值。条件没了，图也就不作数了。
// 视口多大、一篇文章以哪些类名算，都在 homepage.mjs 里，与产图那条命令共用一份。
//
// 用法: node tests/bin/verify-screenshot.mjs [图.png]
// 不给参数就验仓库顶层那张。给路径是为了能在**不动产物**的前提下验这些断言本身灵不灵
// （拿几张故意做坏的图喂进来，看该红的红没红）。
// 前置：本地站已在跑（YUKI_SITE，默认 http://localhost:8080）。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, tokens, hexToRgb } from './theme-css.mjs';
import { VIEWPORT, MIN_POSTS, measureFirstScreen } from './homepage.mjs';

if (process.argv.length > 3) {
  console.error('用法: node tests/bin/verify-screenshot.mjs [图.png]');
  process.exit(2);
}

const FILE = path.resolve(process.argv[2] || path.join(REPO_ROOT, 'screenshot.png'));

if (!fs.existsSync(FILE)) {
  section('截图文件');
  check('截图文件在', false, `${FILE} 不存在——先跑 node tests/bin/make-screenshot.mjs`);
  report();
}

// 官方的硬线：不大于 1200×900、宽高比 4:3。主题取的是上限。
const { width: WIDTH, height: HEIGHT } = VIEWPORT;

// 判「不是纯色」「有字」「有缩略图」的下限。取得很松——这些断言要抓的是
// 「一张纯色/空白的图」，不是去度量设计；真正紧的是底色那两条（跟设计 token 比）。
const MIN_COLORS = 200;   // 一页正常渲染出来带抗锯齿的文字，颜色数远不止这些
const MIN_INK = 500;      // 采样点里够暗的（文字）至少这么多
const MIN_COLORED = 500;  // 既不是底也不是字的彩色像素（缩略图）至少这么多

/* ---------------- 文件级：从字节里读 ---------------- */

const bytes = fs.readFileSync(FILE);
const PNG_MAGIC = Buffer.from('89504e470d0a1a0a', 'hex');

const isPng = bytes.length > 24 && bytes.subarray(0, 8).equals(PNG_MAGIC);
// IHDR 是 PNG 的第一个块：8 字节魔数 + 4 长度 + 4 类型，宽高各 4 字节大端。
const width = isPng ? bytes.readUInt32BE(16) : 0;
const height = isPng ? bytes.readUInt32BE(20) : 0;

/* ---------------- 画面级：在浏览器里读像素 ---------------- */

/**
 * 把图片画到 canvas 上，按 4 像素取一个样点，数一数画面里有什么。
 *
 * 取样而不是全量：1200×900 有 108 万个点，隔着取一个既够看出「纯不纯」，
 * 又把这段在页面里跑的循环压到几十毫秒。
 */
const READ_PIXELS = (dataUrl) => `(async () => {
  const img = new Image();
  img.src = ${JSON.stringify(dataUrl)};
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('图片解不开'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const counts = new Map();
  let samples = 0;
  let ink = 0;
  let colored = 0;

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // 拼成 getComputedStyle 那种格式（逗号后有空格），好跟主题 token 直接比字符串。
      const key = 'rgb(' + r + ', ' + g + ', ' + b + ')';
      counts.set(key, (counts.get(key) || 0) + 1);
      samples++;

      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (lum < 0.5) ink++;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (spread > 25 && lum > 0.35) colored++;
    }
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  return {
    width: canvas.width,
    height: canvas.height,
    samples,
    colors: counts.size,
    ink,
    colored,
    top: top.map(([rgb, n]) => ({ rgb, share: n / samples })),
  };
})()`;

/* ---------------- 看现在的首页 ---------------- */

const css = themeCss();
const lightTokens = tokens(css);
const darkTokens = tokens(css, '.dark');

if (!lightTokens['--yuki-background'] || !darkTokens['--yuki-background']) {
  console.error('style.css 里找不到 --yuki-background（:root 或 .dark），没法判断深浅形态。');
  process.exit(1);
}

const lightBg = hexToRgb(lightTokens['--yuki-background']);
const darkBg = hexToRgb(darkTokens['--yuki-background']);

// 一次浏览器，量两样：图里的像素，和现在首页的条件。
//
// 两样都各自包在 try 里：量不到**不是「脚本坏了」，是「这一条红了」**——图截断了、
// 站没起来、请求打不通，都该照常把报告打完并退出 1，而不是抛个栈出来、一条断言都不说。
const { read, readError, home, homeError } = await withBrowser(async (browser) => {
  let read = null;
  let readError = '';

  try {
    const page = await newPage(browser);

    try {
      const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
      read = await page.evaluate(READ_PIXELS(dataUrl));
    } finally {
      await page.close();
    }
  } catch (error) {
    readError = error.message;
  }

  // 用与拍摄时相同的视口与配色，再看一眼现在的首页。
  let home = null;
  let homeError = '';

  try {
    home = await measureFirstScreen(browser);
  } catch (error) {
    homeError = error.message;
  }

  return { read, readError, home, homeError };
});

/* ---------------- 报告 ---------------- */

section('截图文件');
check('截图文件在', fs.existsSync(FILE), FILE);
check('是 PNG（文件头是 PNG 的魔数）', isPng, isPng ? '' : `头 8 字节 ${bytes.subarray(0, 8).toString('hex')}`);
check(`尺寸是 ${WIDTH}×${HEIGHT}`, width === WIDTH && height === HEIGHT, `读到 ${width}×${height}`);
check('宽高比是 4:3', height > 0 && width * 3 === height * 4, `${width}×${height}`);
check('画面解出来与文件头报的尺寸一致', !!read && read.width === width && read.height === height,
  read ? `图里是 ${read.width}×${read.height}` : readError);

section('画面成色');
if (!read) {
  check('画面能在浏览器里解出来', false, readError);
} else {
  check('不是一块纯色', read.colors >= MIN_COLORS, `${read.colors} 种颜色`);
  check('有文字（暗像素够多）', read.ink >= MIN_INK, `采样 ${read.samples} 点，暗的 ${read.ink} 点`);
  check('有缩略图那类彩色块', read.colored >= MIN_COLORED, `彩色 ${read.colored} 点`);
  check('画面有深色控制台外壳',
    read.top.some((c) => c.rgb === 'rgb(10, 17, 22)' || c.rgb === 'rgb(11, 18, 23)'),
    read.top.map((c) => c.rgb).join(' / '));
  check('画面有浅色文档面',
    read.top.some((c) => c.rgb === lightBg || c.rgb === 'rgb(241, 245, 246)'),
    read.top.map((c) => c.rgb).join(' / '));
  check('画面不是单一的深色形态',
    read.top.some((c) => c.rgb === lightBg || c.rgb === 'rgb(241, 245, 246)'));
}

section('拍的是首页（现在的条件）');
if (!home) {
  check('首页能量到（本地站已跑起来）', false, homeError);
} else {
  check('页面就是浅色形态', !home.htmlClass.split(/\s+/).includes('dark'), `html class="${home.htmlClass}"`);
  check('实时正文底色是浅色文档面', home.bodyBg === lightBg, `实时 ${home.bodyBg}，token ${lightBg}`);
  check('首页模板在（圆点纹理的头部）', home.hero);
  check(`首页有若干篇文章（≥ ${MIN_POSTS}）`, home.posts >= MIN_POSTS, `${home.posts} 篇`);
  check('第一屏里有带缩略图的文章', home.thumbsInView >= 1, `视口内 ${home.thumbsInView} 张`);
}

note(`截图 ${FILE}（${(bytes.length / 1024).toFixed(0)} KB，${width}×${height}）`);
if (read) {
  note(`画面里占比前四的颜色：${read.top.map((c) => `${c.rgb} ${(c.share * 100).toFixed(1)}%`).join('、')}`);
}
note(`深色形态的底（对照）：${darkBg}`);
report();
