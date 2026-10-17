// 工单 01 的验收：宽度契约与正文呈现类。
//
// 分三层：
//   1. 读 style.css 与两个 PHP 文件——变量的定义与引用、8 个类真的有规则、没有新添颜色；
//   2. HTTP——造出来的页面确实带着这些类，作者评论确实拿到 bypostauthor；
//   3. 真浏览器——浮动、居中、图注颜色、宽块的实际宽度与「不遮侧栏」只有浏览器知道。
//
// 置顶（.sticky）只验 CSS 规则与模板是否走 post_class()，不设 sticky_posts：
// 那是全站设置，别的会话也会读到，不值得为一次验收改掉。
//
// 用法: node tests/bin/verify-editor-alignment.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, cssBlock, tokens, usedTokens, hexToRgb } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'editor-alignment-fixtures.php');

/* ---------------- 静态：宽度契约 ---------------- */

const css = themeCss();
const root = tokens(css);

section('宽度只有一个来源');

const EXPECTED = {
  '--yuki-content-width': '768px',
  '--yuki-wide-width': '1120px',
  '--yuki-container-width': '1120px',
  '--yuki-sidebar-width': '300px',
  '--yuki-layout-gap': '48px',
};

for (const [name, value] of Object.entries(EXPECTED)) {
  check(`${name} 定义为 ${value}`, root[name] === value, `实际：${root[name] ?? '未定义'}`);
}

const USES = {
  '.yuki-container': 'var(--yuki-container-width)',
  '.yuki-narrow': 'var(--yuki-content-width)',
  '.yuki-post-list': 'var(--yuki-content-width)',
  '.yuki-article-header': 'var(--yuki-content-width)',
};

for (const [selector, expected] of Object.entries(USES)) {
  const body = cssBlock(css, selector);
  check(`${selector} 引用 ${expected}`, body.includes(expected), body || '找不到规则');
}

const single = cssBlock(css, '.yuki-single-layout');
check('.yuki-single-layout 引用侧栏宽度变量', single.includes('var(--yuki-sidebar-width)'), single);
check('.yuki-single-layout 引用间距变量', single.includes('var(--yuki-layout-gap)'), single);
check('单篇布局不再写裸的 300px / 48px', !/300px|48px/.test(single), single);
check('.yuki-container 不再写裸的 1120px', !cssBlock(css, '.yuki-container').includes('1120px'));
check('.yuki-narrow 不再写裸的 768px', !cssBlock(css, '.yuki-narrow').includes('768px'));

/* ---------------- 静态：8 个类 ---------------- */

/** 所有选择器里出现过 needle 的规则体。 */
function blocksMentioning(needle) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].includes(needle)) out.push(m[2]);
  }
  return out;
}

section('Theme Check 点名的 8 个类都有规则');

const CLASSES = [
  '.alignleft', '.alignright', '.aligncenter',
  '.wp-caption', '.wp-caption-text', '.gallery-caption',
  '.sticky', '.bypostauthor',
];

for (const name of CLASSES) {
  check(`${name} 有样式`, blocksMentioning(name).length > 0);
}

const left = blocksMentioning('.alignleft').join('\n');
const right = blocksMentioning('.alignright').join('\n');
const center = blocksMentioning('.aligncenter').join('\n');

check('左对齐是左浮动', /float:\s*left/.test(left), left);
check('右对齐是右浮动', /float:\s*right/.test(right), right);
check('居中是块级 + 自动外边距', /display:\s*block/.test(center) && /margin:\s*1\.5em\s+auto/.test(center), center);
const proseAfter = ':is(.yuki-prose, .editor-styles-wrapper)::after';
check('正文容器清除浮动，浮动不会漏进后面的区块',
  /clear:\s*both/.test(cssBlock(css, proseAfter)),
  cssBlock(css, proseAfter) || `找不到 ${proseAfter}`);

const newBodies = CLASSES.flatMap((name) => blocksMentioning(name)).join('\n');
check('新增规则没有硬编码颜色',
  !/#[0-9a-f]{3,8}\b/i.test(newBodies) && !/rgba?\(\s*\d/.test(newBodies),
  (newBodies.match(/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/gi) ?? []).join(', '));

const dark = tokens(css, '.dark');
const undefinedTokens = usedTokens(newBodies).filter((name) => !(name in root) && !(name in dark));
check('新增规则引用的 token 都已定义', undefinedTokens.length === 0, undefinedTokens.join(', '));

check('编辑器画布会读到的尺寸有名字（宽块规则引用变量）',
  blocksMentioning('.alignwide').some((body) => body.includes('var(--yuki-wide-width)')));
check('alignfull 也有约束规则（不做全出血，止于容器）',
  blocksMentioning('.alignfull').length > 0 &&
  blocksMentioning('.alignfull').every((body) => !/width:\s*100vw/.test(body)));

/* ---------------- 静态：区块支持与模板 ---------------- */

section('区块支持与模板');

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
check("声明了 align-wide", /add_theme_support\(\s*'align-wide'\s*\)/.test(functions));
check("声明了 responsive-embeds", /add_theme_support\(\s*'responsive-embeds'\s*\)/.test(functions));
check('没有声明 wp-block-styles', !/wp-block-styles/.test(functions));

const item = fs.readFileSync(path.join(REPO_ROOT, 'template-parts/post-item.php'), 'utf8');
check('列表项走 post_class()，sticky 类才会出现', /post_class\(\s*'yuki-post-item'\s*\)/.test(item), item.split('\n')[15] ?? '');

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

/* ---------------- HTTP ---------------- */

section('页面里确实带着这些类');

const page = await get(facts.page_url);
const post = await get(facts.post_url);

check('验收页面能打开', page.status === 200, `status=${page.status}`);
check('单篇能打开', post.status === 200, `status=${post.status}`);
check('左对齐图片带 class', page.body.includes('class="alignleft"'));
check('右对齐图片带 class', page.body.includes('class="alignright"'));
check('居中图片带 class', page.body.includes('class="aligncenter"'));
check('图注带 wp-caption-text', page.body.includes('wp-caption-text'));
check('画廊图注带 gallery-caption', page.body.includes('gallery-caption'));
check('宽块带 alignwide', page.body.includes('alignwide') && post.body.includes('alignwide'));
check('作者本人的评论带 bypostauthor', /class="[^"]*\bbypostauthor\b/.test(post.body));

/* ---------------- 真浏览器 ---------------- */

section('真浏览器里量到的样子');

const measured = await withBrowser(async (browser) => {
  const tab = await newPage(browser, { colorScheme: 'light' });

  await tab.setViewport(1200, 900);
  await tab.goto(facts.page_url);
  const wide = await tab.evaluate(`(() => {
    const q = (s) => document.querySelector(s);
    const cs = (s) => getComputedStyle(q(s));
    const r = (s) => q(s).getBoundingClientRect();
    const prose = r('.yuki-prose');
    const center = r('.yuki-prose .aligncenter');
    return {
      leftFloat: cs('.yuki-prose .alignleft').cssFloat,
      rightFloat: cs('.yuki-prose .alignright').cssFloat,
      centerDisplay: cs('.yuki-prose .aligncenter').display,
      centerOffset: Math.abs((center.left + center.width / 2) - (prose.left + prose.width / 2)),
      captionFont: cs('.yuki-prose .wp-caption-text').fontSize,
      captionColor: cs('.yuki-prose .wp-caption-text').color,
      galleryColor: cs('.yuki-prose .gallery-caption').color,
      wideWidth: r('.yuki-prose .alignwide').width,
      docWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  })()`);

  await tab.goto(facts.post_url);
  const singleView = await tab.evaluate(`(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const main = r('.yuki-article-main');
    const wide = r('.yuki-prose .alignwide');
    const sidebar = r('.yuki-sidebar');
    return {
      mainWidth: main.width,
      wideWidth: wide.width,
      wideRight: wide.right,
      sidebarLeft: sidebar.left,
      shadow: getComputedStyle(document.querySelector('.bypostauthor > .comment-body')).boxShadow,
      docWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  })()`);

  await tab.setViewport(640, 900);
  await tab.goto(facts.page_url);
  const narrow = await tab.evaluate(`(() => ({
    leftFloat: getComputedStyle(document.querySelector('.yuki-prose .alignleft')).cssFloat,
    wideWidth: document.querySelector('.yuki-prose .alignwide').getBoundingClientRect().width,
    narrowWidth: document.querySelector('.yuki-narrow').getBoundingClientRect().width,
    docWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))()`);

  await tab.close();
  return { wide, singleView, narrow };
});

const { wide, singleView, narrow } = measured;
const muted = hexToRgb(root['--yuki-muted-foreground']);
const primary = hexToRgb(root['--yuki-primary']);

check('左对齐在浏览器里是 float:left', wide.leftFloat === 'left', wide.leftFloat);
check('右对齐在浏览器里是 float:right', wide.rightFloat === 'right', wide.rightFloat);
check('居中的图片在正文中轴线上', wide.centerOffset <= 1.5, `偏移 ${wide.centerOffset.toFixed(1)}px`);
check('图注字号是 13px', wide.captionFont === '13px', wide.captionFont);
check('图注颜色是 --yuki-muted-foreground', wide.captionColor === muted, `${wide.captionColor} vs ${muted}`);
check('画廊图注颜色同为 --yuki-muted-foreground', wide.galleryColor === muted, `${wide.galleryColor} vs ${muted}`);
check('页面里的宽块达到 1120px', Math.abs(wide.wideWidth - 1120) <= 1, `${wide.wideWidth}px`);
check('桌面宽度下没有横向滚动', wide.docWidth <= wide.clientWidth + 1, `${wide.docWidth} > ${wide.clientWidth}`);

check('单篇里宽块不超出主列', singleView.wideWidth <= singleView.mainWidth + 1,
  `${singleView.wideWidth} > ${singleView.mainWidth}`);
check('单篇里宽块不遮侧栏', singleView.wideRight <= singleView.sidebarLeft + 1,
  `宽块右缘 ${singleView.wideRight}，侧栏左缘 ${singleView.sidebarLeft}`);
check('单篇没有横向滚动', singleView.docWidth <= singleView.clientWidth + 1,
  `${singleView.docWidth} > ${singleView.clientWidth}`);
check('作者评论的左缘有主色内阴影',
  /inset/.test(singleView.shadow) && singleView.shadow.includes(primary),
  singleView.shadow);

check('窄屏下左浮动收成不浮动', narrow.leftFloat === 'none', narrow.leftFloat);
// 宽块本来就比正文宽；窄屏下允许吃满窄栏的内边距，硬线是「不超出窄栏容器、不横向滚动」。
check('窄屏下宽块不超出窄栏容器', narrow.wideWidth <= narrow.narrowWidth + 1,
  `${narrow.wideWidth} > ${narrow.narrowWidth}`);
check('窄屏下没有横向滚动', narrow.docWidth <= narrow.clientWidth + 1,
  `${narrow.docWidth} > ${narrow.clientWidth}`);

note(`单篇主列实测 ${singleView.mainWidth}px；宽块在页面 ${wide.wideWidth}px、在单篇 ${singleView.wideWidth}px`);

report();
