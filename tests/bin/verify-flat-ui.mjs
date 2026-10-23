// 扁平表面验收：无玻璃、无重阴影、小圆角、正文宽度不变。
//
// 用法: node tests/bin/verify-flat-ui.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, get } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';

const CSS_FILE = path.join(REPO_ROOT, 'assets', 'css', 'flat.css');
const INC_FILE = path.join(REPO_ROOT, 'inc', 'production-bible.php');
const css = fs.readFileSync(CSS_FILE, 'utf8');
const inc = fs.readFileSync(INC_FILE, 'utf8');

section('静态：层与加载');

check('flat.css 存在', fs.existsSync(CSS_FILE));
check('由 flat_assets 入队', inc.includes("'yuki-flat'") && inc.includes('yuki_flat_assets'));
const flatInc = /function yuki_flat_assets[\s\S]*?add_action/.exec(inc)?.[0] ?? '';
check('依赖档案/组件/站点/雪兔层',
  ['yuki-archive-console', 'yuki-components', 'yuki-site-modules', 'yuki-mascot-card']
    .every((handle) => flatInc.includes(handle)));
check('不再加载 premium/tech',
  !inc.includes("'yuki-premium'") && !inc.includes("'yuki-tech'") &&
  !fs.existsSync(path.join(REPO_ROOT, 'assets', 'css', 'premium.css')) &&
  !fs.existsSync(path.join(REPO_ROOT, 'assets', 'css', 'tech.css')));

section('静态：扁平语法');

check('去掉页面/封面背景图', css.includes('background-image: none'));
check('去掉阴影与玻璃', css.includes('box-shadow: none') && css.includes('backdrop-filter: none'));
check('小圆角变量', css.includes('--yf-radius: 3px') && css.includes('--yf-radius-lg: 5px'));
check('覆盖导航/卡片/控件/雪兔卡',
  ['.yuki-nav', '.yuki-widget', '.yuki-character-sheet', '.yuki-btn', '.yuki-mascot--photo']
    .every((selector) => css.includes(selector)));
check('头部图标用圆角矩形',
  css.includes('.yuki-search-btn') && css.includes('.theme-switch') &&
  css.includes('border-radius: 8px') && css.includes('.theme-switch-knob'));
check('移除 HUD 伪元素', css.includes('content: none') && css.includes('display: none'));
check('减少动效近乎关闭', /prefers-reduced-motion[\s\S]*animation-duration:\s*0s/.test(css));

section('HTTP');

const home = await get(`${SITE}/`);
check('首页 200', home.status === 200, String(home.status));
const flatHref = /<link[^>]+id=['"]yuki-flat-css['"][^>]+href=['"]([^'"]+)['"]/.exec(home.body)?.[1];
check('首页输出 flat 样式表', Boolean(flatHref), flatHref ?? '');
if (flatHref) {
  const style = await get(flatHref);
  check('flat 样式表 200', style.status === 200, String(style.status));
  check('样式表内容正确', style.body.includes('Yuki · Flat Surface'));
}
check('首页不再输出 premium/tech', !home.body.includes('yuki-premium-css') && !home.body.includes('yuki-tech-css'));
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
        const style = (el) => getComputedStyle(el);
        const nav = q('.yuki-nav');
        const sheet = q('.yuki-character-sheet');
        const stats = q('.yuki-stats-bar');
        return {
          navRadius: parseFloat(style(nav).borderBottomLeftRadius),
          navBlur: style(nav).backdropFilter || style(nav).webkitBackdropFilter || 'none',
          navShadow: style(nav).boxShadow,
          sheetRadius: parseFloat(style(sheet).borderTopLeftRadius),
          sheetShadow: style(sheet).boxShadow,
          statsRadius: parseFloat(style(stats).borderTopLeftRadius),
          searchRadius: parseFloat(style(q('.yuki-search-btn')).borderTopLeftRadius),
          themeRadius: parseFloat(style(q('.theme-switch')).borderTopLeftRadius),
          knobRadius: parseFloat(style(q('.theme-switch-knob')).borderTopLeftRadius),
          bodyImage: style(document.body).backgroundImage,
          heroImage: style(q('.yuki-hero')).backgroundImage,
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
        const body = q('.yuki-prose');
        const btn = q('.yuki-btn') || q('button[type="submit"]');
        return {
          widgetRadius: parseFloat(style(widget).borderTopLeftRadius),
          widgetBlur: style(widget).backdropFilter || style(widget).webkitBackdropFilter || 'none',
          widgetShadow: style(widget).boxShadow,
          btnRadius: parseFloat(style(btn).borderTopLeftRadius),
          bodyWidth: Math.round(body.getBoundingClientRect().width),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()`);
      await s.close();

      const m = await newPage(browser, { colorScheme: 'light' });
      await m.setViewport(640, 900);
      await m.goto(`${SITE}/`);
      result.mobile = await m.evaluate(`(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }))()`);
      await m.close();

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
  check('导航无圆角', measured.home.navRadius === 0, String(measured.home.navRadius));
  check('导航无玻璃', measured.home.navBlur === 'none', measured.home.navBlur);
  check('导航无阴影', measured.home.navShadow === 'none', measured.home.navShadow);
  check('角色卡小圆角', measured.home.sheetRadius > 0 && measured.home.sheetRadius <= 5, String(measured.home.sheetRadius));
  check('角色卡无阴影', measured.home.sheetShadow === 'none', measured.home.sheetShadow);
  check('数据条小圆角', measured.home.statsRadius <= 5, String(measured.home.statsRadius));
  check('搜索按钮圆角矩形', measured.home.searchRadius === 8, String(measured.home.searchRadius));
  check('主题开关圆角矩形', measured.home.themeRadius === 8, String(measured.home.themeRadius));
  check('主题开关滑块小圆角', measured.home.knobRadius === 6, String(measured.home.knobRadius));
  check('页面背景无图', measured.home.bodyImage === 'none', measured.home.bodyImage);
  check('封面无背景图', measured.home.heroImage === 'none', measured.home.heroImage);
  check('首页 1440 无横向溢出', !measured.home.overflow);
  check('侧栏无玻璃', measured.single.widgetBlur === 'none', measured.single.widgetBlur);
  check('侧栏无阴影', measured.single.widgetShadow === 'none', measured.single.widgetShadow);
  check('侧栏小圆角', measured.single.widgetRadius <= 5, String(measured.single.widgetRadius));
  check('按钮小圆角', measured.single.btnRadius <= 2, String(measured.single.btnRadius));
  check('单篇正文仍 722px', Math.abs(measured.single.bodyWidth - 722) <= 2, String(measured.single.bodyWidth));
  check('单篇无横向溢出', !measured.single.overflow);
  check('640 无横向溢出', !measured.mobile.overflow);
}

report();
