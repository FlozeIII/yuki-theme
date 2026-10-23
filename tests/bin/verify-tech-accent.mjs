// 科技感 HUD 验收：信号线、角标、扫描线与 reduced-motion。
//
// 用法: node tests/bin/verify-tech-accent.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, get } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';

const CSS_FILE = path.join(REPO_ROOT, 'assets', 'css', 'tech.css');
const INC_FILE = path.join(REPO_ROOT, 'inc', 'production-bible.php');
const css = fs.readFileSync(CSS_FILE, 'utf8');
const inc = fs.readFileSync(INC_FILE, 'utf8');

section('静态：层与加载');

check('tech.css 存在', fs.existsSync(CSS_FILE));
check('在 premium 之后入队', inc.includes("'yuki-tech'") && inc.includes('yuki_tech_assets'));
const techInc = /function yuki_tech_assets[\s\S]*?add_action/.exec(inc)?.[0] ?? '';
check('只依赖 premium', techInc.includes("array( 'yuki-premium' )"));
check('没有新增脚本', !/wp_enqueue_script\([^)]*tech/.test(inc) && !fs.existsSync(path.join(REPO_ROOT, 'assets', 'js', 'tech.js')));
check('没有新增可见文案', !/content:\s*["'][^"']+["']/.test(css));

section('静态：HUD 语法');

check('有 cyan 信号线变量', css.includes('--yt-line') && css.includes('--yt-glow'));
check('导航/品牌/封面/数据条/卡片都有挂点',
  css.includes('.yuki-nav::after') &&
  css.includes('.yuki-nav .brand::after') &&
  css.includes('.yuki-cover-grid::before') &&
  css.includes('.yuki-cover-grid::after') &&
  css.includes('.yuki-stats-bar::before') &&
  css.includes('.yuki-widget::after'));
check('有低频扫描与状态点关键帧', css.includes('@keyframes yt-scan') && css.includes('@keyframes yt-pulse'));
check('证据图卡有 bracket', css.includes('.yuki-article-featured::before') && css.includes('.yuki-article-featured::after'));
check('文档顶栏有 bracket', css.includes('.yuki-filebar::before') && css.includes('.yuki-filebar::after'));
check('减少动效关闭扫描与状态点', /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none/.test(css));
check('640 隐藏跨封面扫描线', /@media\s*\(max-width:\s*640px\)[\s\S]*\.yuki-hero \.yuki-container::after[\s\S]*display:\s*none/.test(css));

section('HTTP');

const home = await get(`${SITE}/`);
check('首页 200', home.status === 200, String(home.status));
const techHref = /<link[^>]+id=['"]yuki-tech-css['"][^>]+href=['"]([^'"]+)['"]/.exec(home.body)?.[1];
check('首页输出 tech 样式表', Boolean(techHref), techHref ?? '');
if (techHref) {
  const style = await get(techHref);
  check('tech 样式表 200', style.status === 200, String(style.status));
  check('样式表内容正确', style.body.includes('Yuki · Tech Accent'));
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
        const brand = q('.yuki-nav .brand');
        const cover = q('.yuki-cover-grid');
        const hero = q('.yuki-hero .yuki-container');
        const stats = q('.yuki-stats-bar');
        return {
          navLine: getComputedStyle(nav, '::after').backgroundImage,
          brandDot: getComputedStyle(brand, '::after').animationName,
          coverTL: getComputedStyle(cover, '::before').borderTopColor,
          coverBR: getComputedStyle(cover, '::after').borderBottomColor,
          statsTick: getComputedStyle(stats, '::before').borderTopStyle,
          heroScan: getComputedStyle(hero, '::after').animationName,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()`);
      await h.close();

      const s = await newPage(browser, { colorScheme: 'light' });
      await s.setViewport(1440, 1000);
      await s.goto(singlePath);
      result.single = await s.evaluate(`(() => {
        const q = (s) => document.querySelector(s);
        const featured = q('.yuki-article-featured');
        const widget = q('.yuki-widget');
        const filebar = q('.yuki-filebar');
        return {
          filebarTL: getComputedStyle(filebar, '::before').borderTopStyle,
          filebarBR: getComputedStyle(filebar, '::after').borderBottomStyle,
          featuredTL: getComputedStyle(featured, '::before').borderTopStyle,
          featuredBR: getComputedStyle(featured, '::after').borderBottomStyle,
          widgetCorner: getComputedStyle(widget, '::after').borderTopStyle,
          bodyWidth: Math.round(q('.yuki-prose').getBoundingClientRect().width),
        };
      })()`);
      await s.close();

      const m = await newPage(browser, { colorScheme: 'light' });
      await m.setViewport(640, 900);
      await m.goto(`${SITE}/`);
      result.mobile = await m.evaluate(`(() => {
        const hero = document.querySelector('.yuki-hero .yuki-container');
        return {
          scan: getComputedStyle(hero, '::after').display,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()`);
      await m.close();

      const r = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
      await r.setViewport(1440, 1000);
      await r.goto(`${SITE}/`);
      result.reduced = await r.evaluate(`(() => {
        const hero = document.querySelector('.yuki-hero .yuki-container');
        const brand = document.querySelector('.yuki-nav .brand');
        return {
          scan: getComputedStyle(hero, '::after').animationName,
          dot: getComputedStyle(brand, '::after').animationName,
        };
      })()`);
      await r.close();

      return result;
    });
  } catch (error) {
    browserError = error?.message || String(error);
  }
}

section('实测');

if (browserError) {
  check('无头浏览器跑到底', false, browserError);
} else if (!measured) {
  check('有测量结果', false, '没有拿到数据');
} else {
  check('导航有 cyan 信号线', /linear-gradient/.test(measured.home.navLine), measured.home.navLine);
  check('品牌有状态点动画', measured.home.brandDot === 'yt-pulse', measured.home.brandDot);
  check('封面左上 bracket 有边', measured.home.coverTL !== 'rgba(0, 0, 0, 0)' && measured.home.coverTL !== 'transparent', measured.home.coverTL);
  check('封面右下 bracket 有边', measured.home.coverBR !== 'rgba(0, 0, 0, 0)' && measured.home.coverBR !== 'transparent', measured.home.coverBR);
  check('数据条有读角', measured.home.statsTick === 'solid', measured.home.statsTick);
  check('封面扫描线在跑', measured.home.heroScan === 'yt-scan', measured.home.heroScan);
  check('首页 1440 无横向溢出', !measured.home.overflow);
  check('单篇证据图卡有 bracket', measured.single.featuredTL === 'solid' && measured.single.featuredBR === 'solid');
  check('单篇文档顶栏有 bracket', measured.single.filebarTL === 'solid' && measured.single.filebarBR === 'solid');
  check('单篇侧栏有角标', measured.single.widgetCorner === 'solid');
  check('单篇正文仍 722px', Math.abs(measured.single.bodyWidth - 722) <= 2, String(measured.single.bodyWidth));
  check('640 隐藏跨封面扫描', measured.mobile.scan === 'none', measured.mobile.scan);
  check('640 无横向溢出', !measured.mobile.overflow);
  check('减少动效停掉扫描', measured.reduced.scan === 'none', measured.reduced.scan);
  check('减少动效停掉状态点', measured.reduced.dot === 'none', measured.reduced.dot);
}

report();
