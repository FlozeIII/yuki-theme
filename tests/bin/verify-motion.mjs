// 工单 01 的验收：动效收敛与减少动效。
//
// 普通模式用 CDP 鼠标移动触发真实 :hover，量背景与位移；
// reduced motion 用 newPage({ reducedMotion: true }) 模拟偏好，再量一遍。
//
// 用法: node tests/bin/verify-motion.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, tokens } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'motion-fixtures.php');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- 静态 ---------------- */

section('选择器与减少动效规则');

const css = themeCss();
const root = tokens(css);

check('列表 hover 有背景', css.includes('.yuki-post-item:hover { background: var(--yuki-muted); }'));
check('缩略图有 transform 过渡',
  /\.yuki-post-thumb\s*\{[^}]*transition:\s*transform 180ms ease/.test(css));
check('列表 hover 时缩略图上浮',
  css.includes('.yuki-post-item:hover .yuki-post-thumb { transform: translateY(-1px); }'));
check('上下篇 hover 上浮',
  css.includes('.yuki-post-nav a:hover { border-color: var(--yuki-primary); transform: translateY(-1px); }'));

const focusBlock = /\.yuki-post-item a:focus-visible[\s\S]*?\}/.exec(css)?.[0] ?? '';
check('焦点环覆盖列表/上下篇/关联/标签',
  ['.yuki-post-item a:focus-visible', '.yuki-post-nav a:focus-visible',
    '.yuki-related-item a:focus-visible', '.yuki-tag:focus-visible']
    .every((selector) => focusBlock.includes(selector)) && focusBlock.includes('var(--yuki-ring)'),
  focusBlock);

const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
check('reduced motion：主题开关只保留背景色过渡',
  reduced.includes('.theme-switch-knob { transition: background-color 0.35s ease; }'));
check('reduced motion：按钮只保留背景色过渡、不上浮',
  reduced.includes('.yuki-btn { transition: background-color 180ms ease; }') &&
  reduced.includes('.yuki-btn:hover { transform: none; }'));
check('reduced motion：缩略图不动',
  reduced.includes('.yuki-post-thumb { transition: none; }') &&
  reduced.includes('.yuki-post-item:hover .yuki-post-thumb { transform: none; }'));
check('reduced motion：上下篇只保留边框过渡、不上浮',
  reduced.includes('.yuki-post-nav a { transition: border-color 180ms ease; }') &&
  reduced.includes('.yuki-post-nav a:hover { transform: none; }'));

const browserSrc = fs.readFileSync(path.join(REPO_ROOT, 'tests', 'bin', 'browser.mjs'), 'utf8');
check('browser.mjs 有 hover 观察点', /async hover\(selector\)/.test(browserSrc));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const muted = 'rgb(243, 240, 234)';

/* ---------------- 真浏览器 ---------------- */

section('普通模式：真实 hover');

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const result = {};

    /* 首页：列表背景 + 缩略图位移 */
    const home = await newPage(browser, { colorScheme: 'light' });
    await home.setViewport(1200, 900);
    await home.goto(facts.home_url);
    const tagged = await home.evaluate(`(() => {
      const item = [...document.querySelectorAll('.yuki-post-item')]
        .find((el) => el.querySelector('.yuki-post-thumb'));
      if (!item) return false;
      item.id = 'yuki-motion-item';
      return true;
    })()`);
    if (!tagged) {
      throw new Error('首页没有带缩略图的文章列表项');
    }

    await home.hover('#yuki-motion-item');
    await sleep(320);
    result.listHover = await home.evaluate(`(() => {
      const item = document.getElementById('yuki-motion-item');
      const thumb = item.querySelector('.yuki-post-thumb');
      return {
        bg: getComputedStyle(item).backgroundColor,
        transform: getComputedStyle(thumb).transform,
      };
    })()`);
    await home.close();

    /* 单篇：上下篇卡片位移 */
    const post = await newPage(browser, { colorScheme: 'light' });
    await post.setViewport(1200, 900);
    await post.goto(facts.post_url);
    await post.waitFor(`!!document.querySelector('.yuki-post-nav a')`, 10000);
    await post.hover('.yuki-post-nav a');
    await sleep(320);
    result.navHover = await post.evaluate(
      `getComputedStyle(document.querySelector('.yuki-post-nav a')).transform`
    );
    result.hasRelated = await post.evaluate(`!!document.querySelector('.yuki-related-item a')`);
    await post.close();

    /* reduced motion：列表不动、背景仍然变 */
    const reducedPage = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
    await reducedPage.setViewport(1200, 900);
    await reducedPage.goto(facts.home_url);
    const reducedTagged = await reducedPage.evaluate(`(() => {
      const item = [...document.querySelectorAll('.yuki-post-item')]
        .find((el) => el.querySelector('.yuki-post-thumb'));
      if (!item) return false;
      item.id = 'yuki-motion-reduced';
      return true;
    })()`);
    if (!reducedTagged) {
      throw new Error('首页没有带缩略图的文章列表项（reduced motion）');
    }
    await reducedPage.hover('#yuki-motion-reduced');
    await sleep(320);
    result.reducedList = await reducedPage.evaluate(`(() => {
      const item = document.getElementById('yuki-motion-reduced');
      const thumb = item.querySelector('.yuki-post-thumb');
      const knob = document.querySelector('.theme-switch-knob');
      const button = document.querySelector('.yuki-btn');
      return {
        bg: getComputedStyle(item).backgroundColor,
        transform: getComputedStyle(thumb).transform,
        knobTransition: knob ? getComputedStyle(knob).transitionProperty : '',
        buttonTransition: button ? getComputedStyle(button).transitionProperty : '',
      };
    })()`);
    await reducedPage.close();

    /* reduced motion：上下篇不上浮 */
    const reducedPost = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
    await reducedPost.setViewport(1200, 900);
    await reducedPost.goto(facts.post_url);
    await reducedPost.waitFor(`!!document.querySelector('.yuki-post-nav a')`, 10000);
    await reducedPost.hover('.yuki-post-nav a');
    await sleep(320);
    result.reducedNav = await reducedPost.evaluate(
      `getComputedStyle(document.querySelector('.yuki-post-nav a')).transform`
    );
    await reducedPost.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
}

section('量到的结果');

if (measured) {
  check('列表 hover 背景是 --yuki-muted', measured.listHover.bg === muted, measured.listHover.bg);
  check('缩略图 hover 上浮 1px',
    /matrix\(1, 0, 0, 1, 0, -1\)/.test(measured.listHover.transform), measured.listHover.transform);
  check('上下篇 hover 上浮 1px',
    /matrix\(1, 0, 0, 1, 0, -1\)/.test(measured.navHover), measured.navHover);
  check('单篇有关联文章可量', measured.hasRelated === true);

  check('reduced motion：缩略图不位移', measured.reducedList.transform === 'none',
    measured.reducedList.transform);
  check('reduced motion：背景仍然变化（颜色过渡保留）',
    measured.reducedList.bg === muted, measured.reducedList.bg);
  check('reduced motion：主题开关的 transition 不含 transform',
    measured.reducedList.knobTransition !== '' && !/transform/.test(measured.reducedList.knobTransition),
    measured.reducedList.knobTransition);
  check('reduced motion：按钮的 transition 不含 transform',
    measured.reducedList.buttonTransition !== '' && !/transform/.test(measured.reducedList.buttonTransition),
    measured.reducedList.buttonTransition);
  check('reduced motion：上下篇不上浮', measured.reducedNav === 'none', measured.reducedNav);
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

report();
