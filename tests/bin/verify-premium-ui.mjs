// 玻璃精修验收：圆角、玻璃、入场动效与 reduced-motion。
//
// 用法: node tests/bin/verify-premium-ui.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, get } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';

const CSS_FILE = path.join(REPO_ROOT, 'assets', 'css', 'premium.css');
const INC_FILE = path.join(REPO_ROOT, 'inc', 'production-bible.php');
const css = fs.readFileSync(CSS_FILE, 'utf8');
const inc = fs.readFileSync(INC_FILE, 'utf8');

const cssValue = (selector, prop) => {
  const block = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  return new RegExp(`${prop}\\s*:\\s*([^;]+)`).exec(block)?.[1]?.trim() ?? '';
};

section('静态：加载与层');

check('premium.css 存在', fs.existsSync(CSS_FILE));
check('由 functions 层在最后入队', inc.includes("'yuki-premium'") && inc.includes('yuki_premium_assets'));
const premiumInc = /function yuki_premium_assets[\s\S]*?add_action/.exec(inc)?.[0] ?? '';
check('依赖既有三个样式层',
  ['yuki-archive-console', 'yuki-components', 'yuki-site-modules', 'yuki-mascot-card']
    .every((handle) => premiumInc.includes(handle)));
check('没有新脚本', !/wp_enqueue_script\([^)]*premium/.test(inc) && !fs.existsSync(path.join(REPO_ROOT, 'assets', 'js', 'premium.js')));

section('静态：圆角 / 玻璃 / 动效');

check('有局部圆角变量', css.includes('--yp-radius-sm') && css.includes('--yp-radius-xl'));
check('有玻璃表面变量', css.includes('--yp-glass-light') && css.includes('--yp-glass-dark'));
check('导航、侧栏、目录有 backdrop-filter',
  css.includes('backdrop-filter: blur(22px)') &&
  css.includes('backdrop-filter: blur(18px)') &&
  css.includes('backdrop-filter: blur(16px)'));
check('玻璃有实色回退', css.includes('@supports not') && css.includes('background: #FFFFFF'));
check('圆角覆盖卡片/输入/按钮',
  css.includes('border-radius: var(--yp-radius-lg)') &&
  css.includes('border-radius: var(--yp-radius-sm)'));
check('有入场与扫光关键帧', css.includes('@keyframes yp-rise') && css.includes('@keyframes yp-sheen'));
check('减少动效关闭新增动画', /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css) &&
  /animation:\s*none/.test(css));
check('按钮减少动效不保留 transform', /prefers-reduced-motion[\s\S]*\.yuki-btn\s*\{[^}]*transition:\s*background-color/.test(css));

section('HTTP');

const home = await get(`${SITE}/`);
check('首页 200', home.status === 200, String(home.status));

const premiumHref = /<link[^>]+id=['"]yuki-premium-css['"][^>]+href=['"]([^'"]+)['"]/.exec(home.body)?.[1];
check('首页输出 premium 样式表', Boolean(premiumHref), premiumHref ?? '');
if (premiumHref) {
  const style = await get(premiumHref);
  check('premium 样式表 200', style.status === 200, String(style.status));
  check('样式表内容正确', style.body.includes('Yuki · Premium Polish'));
}

const singlePath = /<h2 class="yuki-post-title"><a href="([^"]+)"/.exec(home.body)?.[1];
check('能找到一个单篇', Boolean(singlePath), singlePath ?? '');

section('无头 Edge');

let measured = null;
let browserError = '';

if (singlePath) {
  try {
    measured = await withBrowser(async (browser) => {
      const result = {};

      const h = await newPage(browser, { colorScheme: 'light' });
      await h.setViewport(1440, 1000);
      await h.goto(`${SITE}/`);
      result.home = await h.evaluate(`(() => {
        const q = (s) => document.querySelector(s);
        const nav = q('.yuki-nav');
        const sheet = q('.yuki-character-sheet');
        const stats = q('.yuki-stats-bar');
        const copy = q('.yuki-cover-copy');
        const style = (el) => getComputedStyle(el);
        return {
          radius: parseFloat(style(sheet).borderTopLeftRadius),
          statsRadius: parseFloat(style(stats).borderTopLeftRadius),
          navRadius: parseFloat(style(nav).borderBottomLeftRadius),
          navBlur: style(nav).backdropFilter || style(nav).webkitBackdropFilter || '',
          sheetBlur: style(sheet).backdropFilter || style(sheet).webkitBackdropFilter || '',
          animation: style(copy).animationName,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()`);
      await h.close();

      const s = await newPage(browser, { colorScheme: 'light' });
      await s.setViewport(1440, 1000);
      await s.goto(singlePath);
      result.single = await s.evaluate(`(() => {
        const q = (s) => document.querySelector(s);
        const style = (el) => getComputedStyle(el);
        const widget = q('.yuki-widget');
        const toc = q('.yuki-toc');
        const featured = q('.yuki-article-featured');
        const body = q('.yuki-prose');
        return {
          widgetRadius: parseFloat(style(widget).borderTopLeftRadius),
          widgetBlur: style(widget).backdropFilter || style(widget).webkitBackdropFilter || '',
          tocRadius: toc ? parseFloat(style(toc).borderTopLeftRadius) : null,
          featuredRadius: parseFloat(style(featured).borderTopLeftRadius),
          bodyWidth: Math.round(body.getBoundingClientRect().width),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()`);
      await s.close();

      const n = await newPage(browser, { colorScheme: 'light' });
      await n.setViewport(640, 900);
      await n.goto(singlePath);
      result.narrow = await n.evaluate(`(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        bodyWidth: Math.round(document.querySelector('.yuki-prose').getBoundingClientRect().width),
        widgetRadius: parseFloat(getComputedStyle(document.querySelector('.yuki-widget')).borderTopLeftRadius),
      }))()`);
      await n.close();

      const d = await newPage(browser, { colorScheme: 'dark' });
      await d.setViewport(1440, 1000);
      await d.goto(singlePath);
      result.dark = await d.evaluate(`(() => {
        const w = getComputedStyle(document.querySelector('.yuki-widget'));
        return {
          blur: w.backdropFilter || w.webkitBackdropFilter || '',
          bg: w.backgroundColor,
        };
      })()`);
      await d.close();

      const r = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
      await r.setViewport(1440, 1000);
      await r.goto(`${SITE}/`);
      result.reduced = await r.evaluate(`(() => ({
        copy: getComputedStyle(document.querySelector('.yuki-cover-copy')).animationName,
        sheet: getComputedStyle(document.querySelector('.yuki-character-sheet')).animationName,
        heroAfter: getComputedStyle(document.querySelector('.yuki-hero'), '::after').animationName,
      }))()`);
      await r.close();

      return result;
    });
  } catch (error) {
    browserError = error.message;
  }
}

section('量到的结果');

if (measured) {
  check('角色卡圆角 >= 18', measured.home.radius >= 18, `${measured.home.radius}px`);
  check('数据条是圆角玻璃', measured.home.statsRadius >= 12,
    `${measured.home.statsRadius}px`);
  check('导航有圆角与 blur', measured.home.navRadius >= 10 && measured.home.navBlur.includes('blur'),
    `${measured.home.navRadius}px / ${measured.home.navBlur}`);
  check('首页封面有入场动画', measured.home.animation !== 'none', measured.home.animation);
  check('1440 首页无横向滚动', !measured.home.overflow);

  check('侧栏卡片圆角 >= 14', measured.single.widgetRadius >= 14, `${measured.single.widgetRadius}px`);
  check('侧栏卡片有玻璃 blur', measured.single.widgetBlur.includes('blur'), measured.single.widgetBlur);
  check('目录有圆角（该篇有目录时）', measured.single.tocRadius === null || measured.single.tocRadius >= 14,
    measured.single.tocRadius === null ? '该篇无目录' : `${measured.single.tocRadius}px`);
  check('证据图框有圆角', measured.single.featuredRadius >= 16, `${measured.single.featuredRadius}px`);
  check('正文列仍约 724px', measured.single.bodyWidth >= 700 && measured.single.bodyWidth <= 768,
    `${measured.single.bodyWidth}px`);
  check('1440 单篇无横向滚动', !measured.single.overflow);

  check('640 无横向滚动', !measured.narrow.overflow);
  check('640 正文仍收窄', measured.narrow.bodyWidth <= 640, `${measured.narrow.bodyWidth}px`);
  check('640 卡片仍有圆角', measured.narrow.widgetRadius >= 14, `${measured.narrow.widgetRadius}px`);

  check('深色侧栏仍有玻璃', measured.dark.blur.includes('blur'), measured.dark.blur);
  check('深色玻璃不是全实色', measured.dark.bg.startsWith('rgba'), measured.dark.bg);

  check('减少动效关闭封面入场', measured.reduced.copy === 'none', measured.reduced.copy);
  check('减少动效关闭角色卡入场', measured.reduced.sheet === 'none', measured.reduced.sheet);
  check('减少动效关闭 hero 扫光', measured.reduced.heroAfter === 'none', measured.reduced.heroAfter);
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

note('玻璃只在导航/侧栏/目录/证据等表面；正文、评论、代码块仍是实色。');
note('英文眉标与档案编号是版面语言；圆角与动效不改变正文 724px 与侧栏 300px。');

report();
