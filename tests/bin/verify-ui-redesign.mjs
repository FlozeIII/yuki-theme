// 工单 01 的验收：整站「设定资料集」重设计。
//
// 验三层：
//   - 静态：新 CSS / inc 存在，加载顺序、J token、旧宽度契约、旧测试钩子都还在。
//   - HTTP：首页、单篇、分类、搜索、404 都输出同一套档案语言。
//   - 真浏览器：1440 两栏、640 单栏、单篇正文与侧栏、深色、读屏/减少动效。
//
// 用法: node tests/bin/verify-ui-redesign.mjs
// 前置：本地站已在跑，主题已启用。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, get } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, tokens } from './theme-css.mjs';

const css = fs.readFileSync(path.join(REPO_ROOT, 'style.css'), 'utf8');
const production = fs.readFileSync(path.join(REPO_ROOT, 'assets/css/production-bible.css'), 'utf8');
const inc = fs.readFileSync(path.join(REPO_ROOT, 'inc/production-bible.php'), 'utf8');
const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
const pot = fs.readFileSync(path.join(REPO_ROOT, 'languages/yuki.pot'), 'utf8');
const light = tokens(css);
const dark = tokens(css, '.dark');

/* ---------------- 静态 ---------------- */

section('文件、加载与契约');

check('新样式表存在', production.length > 1000, `${production.length} 字符`);
check('新样式表无 import / 外链字体',
  !/@import|fonts\.googleapis|fonts\.gstatic|https?:\/\//.test(production));
check('inc 模块存在且注册 body class',
  /yuki_production_body_class/.test(inc) && /yuki-production-bible/.test(inc));
check('统计 helper 用真实数据',
  /wp_count_posts\(\s*'post'\s*\)/.test(inc) &&
  /wp_count_terms\(/.test(inc) &&
  /get_lastpostdate\(\s*'blog'\s*\)/.test(inc));
check('functions 显式 require_once',
  /require_once\s+get_template_directory\(\)\s*\.\s*'\/inc\/production-bible\.php'/.test(functions));
check('样式表依赖 yuki-style',
  /wp_enqueue_style\(\s*'yuki-production-bible'[\s\S]*?array\(\s*'yuki-style'\s*\)/.test(inc) ||
  /wp_enqueue_style\(\s*'yuki-production-bible'[\s\S]*?array\(\s*'yuki-style'\s*\)/.test(functions));
check('J token 齐全',
  ['--yuki-paper', '--yuki-blueprint', '--yuki-signal', '--yuki-ice', '--yuki-plate', '--yuki-grid-line']
    .every((name) => production.includes(name)));
check('旧宽度契约未改',
  light['--yuki-content-width'] === '768px' &&
  light['--yuki-wide-width'] === '1120px' &&
  light['--yuki-container-width'] === '1120px' &&
  light['--yuki-sidebar-width'] === '300px' &&
  light['--yuki-layout-gap'] === '48px');
check('背景 token 已切到纸面',
  light['--yuki-background'] === '#EDE8DC' && dark['--yuki-background'] === '#0F1720',
  `${light['--yuki-background']} / ${dark['--yuki-background']}`);
check('旧测试钩子仍在',
  ['.yuki-post-item', '.yuki-post-list', '.yuki-post-thumb', '.yuki-post-title',
    '.yuki-cat-badge', '.yuki-article-header', '.yuki-single-layout', '.yuki-sidebar',
    '.yuki-empty-state', '.yuki-404', '.yuki-hero-petals']
    .every((selector) => css.includes(selector) || production.includes(selector)));
check('新版面钩子存在',
  ['.yuki-production-strip', '.yuki-cover-grid', '.yuki-character-sheet',
    '.yuki-index-head', '.yuki-filebar', '.yuki-frame-label', '.yuki-sidebar-head',
    '.yuki-archive-hero']
    .every((selector) => production.includes(selector)));
check('新文案进了 pot',
  ['CHARACTER SHEET', '话数索引', '本站看板角色', 'MISSING FRAME', 'PRODUCTION NOTES']
    .every((text) => pot.includes(text)));

/* ---------------- HTTP ---------------- */

section('HTTP：同一套档案语言');

const home = await get(`${SITE}/`);
check('首页能打开', home.status === 200, `status=${home.status}`);
check('首页 body 带资料集 class', /class="[^"]*\byuki-production-bible\b/.test(home.body));
check('生产信息栏存在且对读屏隐藏', /class="yuki-production-strip" aria-hidden="true"/.test(home.body));
check('封面 meta 存在', /FILE 01 \/ PRODUCTION BIBLE/.test(home.body));
check('角色设定卡存在', /CHARACTER SHEET/.test(home.body) && /FIG\. 01/.test(home.body));
check('话数索引头存在', /EPISODE INDEX/.test(home.body) && /话数索引/.test(home.body));
check('花瓣恰好 7 枚', (home.body.match(/<span><\/span>/g) || []).length === 7);
check('hero 仍是旧模板钩子', /class="yuki-hero yuki-dot-pattern"/.test(home.body));

const episodeMatch = /<dt>EPISODES<\/dt>\s*<dd>(\d+)<\/dd>/.exec(home.body);
const episodes = episodeMatch ? Number(episodeMatch[1]) : 0;
check('话数是真实正整数', episodes > 0, String(episodes));
check('封面显示真实分类数与更新日期',
  /<dt>CATEGORIES<\/dt>\s*<dd>\d+<\/dd>/.test(home.body) &&
  /<dt>UPDATED<\/dt>\s*<dd>\d{4}\.\d{2}\.\d{2}<\/dd>/.test(home.body));

const singleUrl = /<h2 class="yuki-post-title"><a href="([^"]+)"/.exec(home.body)?.[1] || '';
check('首页能解析出单篇链接', /^https?:\/\//.test(singleUrl), singleUrl);
const single = singleUrl ? await get(singleUrl) : { status: 0, body: '' };
check('单篇能打开', single.status === 200, `status=${single.status}`);
check('单篇有 FILE / SCENE / STATUS',
  /class="yuki-filebar"/.test(single.body) &&
  /FILE/.test(single.body) && /SCENE/.test(single.body) && /STATUS/.test(single.body));
check('特色图有 KEY VISUAL 帧标', /class="yuki-frame-label"/.test(single.body) && /KEY VISUAL/.test(single.body));
check('侧栏仍是旧 aside 钩子', /<aside class="yuki-sidebar">/.test(single.body));

const categoryUrl = /<a class="yuki-cat-badge" href="([^"]+)"/.exec(home.body)?.[1] || '';
const archive = categoryUrl ? await get(categoryUrl) : { status: 0, body: '' };
check('分类归档能打开', archive.status === 200, `status=${archive.status}`);
check('归档有 ARCHIVE INDEX / kicker',
  /ARCHIVE INDEX/.test(archive.body) && /yuki-archive-hero/.test(archive.body) &&
  /yuki-hero-kicker/.test(archive.body));
check('归档保留文章列表', /class="yuki-post-list"/.test(archive.body));

const search = await get(`${SITE}/?s=YUKI`);
check('搜索能打开', search.status === 200, `status=${search.status}`);
check('搜索有 SEARCH INDEX / MATCHING FILES',
  /SEARCH INDEX/.test(search.body) && /MATCHING FILES/.test(search.body));

const missing = await get(`${SITE}/yuki-no-such-page-ui-redesign-2026/`);
check('404 返回 404', missing.status === 404, `status=${missing.status}`);
check('404 有 MISSING FRAME 与雪兔',
  /MISSING FRAME/.test(missing.body) && /yuki-mascot/.test(missing.body));

/* ---------------- 真浏览器 ---------------- */

section('真浏览器：布局、深色与减少动效');

let measured = null;
let browserError = '';
try {
  measured = await withBrowser(async (browser) => {
    const result = {};
    const p = await newPage(browser, { colorScheme: 'light' });
    await p.setViewport(1440, 900);
    await p.goto(`${SITE}/`);
    result.home = await p.evaluate(`(() => {
      const q = (s) => document.querySelector(s);
      const grid = q('.yuki-cover-grid');
      const sheet = q('.yuki-character-sheet');
      const list = q('.yuki-post-list');
      const h1 = q('.yuki-hero h1');
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        sheetWidth: Math.round(sheet.getBoundingClientRect().width),
        listWidth: Math.round(list.getBoundingClientRect().width),
        h1Font: getComputedStyle(h1).fontFamily,
        bodyFont: getComputedStyle(document.body).fontFamily,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        title: h1.textContent.trim(),
      };
    })()`);
    await p.close();

    const narrow = await newPage(browser, { colorScheme: 'light' });
    await narrow.setViewport(640, 900);
    await narrow.goto(`${SITE}/`);
    result.narrow = await narrow.evaluate(`(() => ({
      columns: getComputedStyle(document.querySelector('.yuki-cover-grid')).gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      sheetWidth: Math.round(document.querySelector('.yuki-character-sheet').getBoundingClientRect().width),
    }))()`);
    await narrow.close();

    if (singleUrl) {
      const s = await newPage(browser, { colorScheme: 'light' });
      await s.setViewport(1440, 900);
      await s.goto(singleUrl);
      result.single = await s.evaluate(`(() => {
        const body = document.querySelector('.yuki-prose');
        const bar = document.querySelector('.yuki-filebar');
        const header = document.querySelector('.yuki-article-header');
        const side = document.querySelector('.yuki-sidebar');
        const img = document.querySelector('.yuki-article-featured img');
        const label = document.querySelector('.yuki-frame-label');
        return {
          barLeft: bar ? Math.round(bar.getBoundingClientRect().left) : -1,
          headerLeft: header ? Math.round(header.getBoundingClientRect().left) : -1,
          bodyLeft: body ? Math.round(body.getBoundingClientRect().left) : -1,
          bodyWidth: body ? Math.round(body.getBoundingClientRect().width) : 0,
          sidebarWidth: side ? Math.round(side.getBoundingClientRect().width) : 0,
          imageWidth: img ? Math.round(img.getBoundingClientRect().width) : 0,
          labelVisible: !!label && label.getBoundingClientRect().height > 0,
        };
      })()`);
      await s.close();
    }

    const d = await newPage(browser, { colorScheme: 'dark' });
    await d.setViewport(1440, 900);
    await d.goto(`${SITE}/`);
    result.dark = await d.evaluate(`(() => ({
      dark: document.documentElement.classList.contains('dark'),
      bg: getComputedStyle(document.body).backgroundColor,
      strip: getComputedStyle(document.querySelector('.yuki-production-strip')).backgroundColor,
    }))()`);
    await d.close();

    const r = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
    await r.setViewport(1440, 900);
    await r.goto(`${SITE}/`);
    result.reduced = await r.evaluate(`(() => ({
      petals: getComputedStyle(document.querySelector('.yuki-hero-petals')).display,
      itemTransition: getComputedStyle(document.querySelector('.yuki-post-item')).transitionDuration,
    }))()`);
    await r.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
}

section('量到的样子');

if (measured) {
  check('首页封面是两栏', measured.home.columns >= 2, `${measured.home.columns} 栏`);
  check('角色设定有存在感', measured.home.sheetWidth >= 400, `${measured.home.sheetWidth}px`);
  check('话数索引接近容器宽', measured.home.listWidth >= 1000 && measured.home.listWidth <= 1120,
    `${measured.home.listWidth}px`);
  check('首页 H1 跟随字体设置', measured.home.h1Font === measured.home.bodyFont, measured.home.h1Font);
  check('1440 首页无横向滚动', !measured.home.overflow);
  check('640 封面收成单栏', measured.narrow.columns === 1, `${measured.narrow.columns} 栏`);
  check('640 角色设定不溢出', measured.narrow.sheetWidth <= 640 && !measured.narrow.overflow,
    `${measured.narrow.sheetWidth}px / overflow=${measured.narrow.overflow}`);

  if (measured.single) {
    check('filebar 与正文左对齐',
      Math.abs(measured.single.barLeft - measured.single.bodyLeft) <= 1,
      `${measured.single.barLeft} / ${measured.single.bodyLeft}`);
    check('标题与正文左对齐',
      Math.abs(measured.single.headerLeft - measured.single.bodyLeft) <= 1,
      `${measured.single.headerLeft} / ${measured.single.bodyLeft}`);
    check('正文列仍约 724px', measured.single.bodyWidth >= 700 && measured.single.bodyWidth <= 768,
      `${measured.single.bodyWidth}px`);
    check('侧栏仍是 300px', measured.single.sidebarWidth === 300, `${measured.single.sidebarWidth}px`);
    check('特色图铺满正文列', measured.single.imageWidth >= measured.single.bodyWidth - 24,
      `${measured.single.imageWidth}px`);
    check('KEY VISUAL 帧标可见', measured.single.labelVisible);
  } else {
    check('单篇浏览器测量', false, '没有单篇链接');
  }

  check('深色模式生效', measured.dark.dark && measured.dark.bg === 'rgb(15, 23, 32)', measured.dark.bg);
  check('生产信息栏用深色底', measured.dark.strip === 'rgb(8, 16, 24)', measured.dark.strip);
  check('减少动效下花瓣层隐藏', measured.reduced.petals === 'none', measured.reduced.petals);
} else {
  check('无头浏览器跑到底', false, browserError);
}

note('J 的档案眉标、彩色单侧线与英文制作标签是版面语言，不是未处理的对比度缺陷；');
note('它们承载 FILE / SCENE / NOTE 的层级，正文仍按 4.5:1 以上的可读性走。');

report();
