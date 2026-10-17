// 工单 02 的验收：分类贴纸与空状态对话气泡。
//
// 静态看 CSS；HTTP 看徽章与空状态确实在页面里；真浏览器量贴纸的旋转/虚线边/胶带、
// hover 转正、reduced motion 保持静止，以及气泡的边框/圆角/尖角。
//
// 用法: node tests/bin/verify-stickers.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'mascot-fixtures.php');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const IDENTITY = 'matrix(1, 0, 0, 1, 0, 0)';

/* ---------------- 静态 ---------------- */

section('贴纸与气泡的样式');

const css = themeCss();

check('贴纸有旋转', /\.yuki-cat-badge\s*\{[^}]*transform:\s*rotate\(-2deg\)/.test(css));
check('贴纸有虚线边', /\.yuki-cat-badge\s*\{[^}]*border:\s*1px dashed var\(--yuki-border\)/.test(css));
check('贴纸有胶带', /\.yuki-cat-badge::before\s*\{[^}]*background:\s*var\(--yuki-primary\)/.test(css));
check('贴纸 hover 转正', css.includes('.yuki-cat-badge:hover { transform: rotate(0); }'));

check('气泡有边框与圆角',
  /\.yuki-empty-state p\s*\{[^}]*border:\s*1px solid var\(--yuki-border\)/.test(css) &&
  /\.yuki-empty-state p\s*\{[^}]*border-radius:\s*var\(--yuki-radius-lg\)/.test(css));
check('气泡有朝上的尖角',
  /\.yuki-empty-state p::before\s*\{[^}]*transform:\s*translateX\(-50%\) rotate\(45deg\)/.test(css));

check('徽章也有焦点环', css.includes('.yuki-cat-badge:focus-visible'));
check('reduced motion 下贴纸保持静止',
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yuki-cat-badge:hover\s*\{\s*transform:\s*rotate\(-2deg\)/.test(css));

const flavorBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].includes('.yuki-cat-badge') || m[1].includes('.yuki-empty-state p'))
  .map((m) => m[2])
  .join('\n');
check('贴纸与气泡没有硬编码颜色',
  !/#[0-9a-f]{3,8}\b/i.test(flavorBlocks) && !/rgba?\(\s*\d/.test(flavorBlocks));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

/* ---------------- HTTP ---------------- */

section('页面里的贴纸与气泡');

const home = await get(facts.home_url);
check('首页能打开', home.status === 200, `status=${home.status}`);
check('首页有分类徽章', /class="yuki-cat-badge"/.test(home.body));

const emptyArchive = await get(facts.empty_archive_url);
check('空归档能打开', emptyArchive.status === 200, `status=${emptyArchive.status}`);
check('空状态里有文案段落', /class="yuki-narrow yuki-empty-state"[\s\S]*?<p[\s>]/.test(emptyArchive.body));

/* ---------------- 真浏览器 ---------------- */

section('量到的贴纸与气泡');

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    await page.waitFor(`!!document.querySelector('.yuki-cat-badge')`, 10000);

    result.sticker = await page.evaluate(`(() => {
      const badge = document.querySelector('.yuki-cat-badge');
      const style = getComputedStyle(badge);
      const tape = getComputedStyle(badge, '::before');
      return {
        transform: style.transform,
        borderStyle: style.borderTopStyle,
        tapeContent: tape.content,
        tapeOpacity: tape.opacity,
      };
    })()`);

    await page.hover('.yuki-cat-badge');
    await sleep(320);
    result.hovered = await page.evaluate(
      `getComputedStyle(document.querySelector('.yuki-cat-badge')).transform`
    );

    await page.setViewport(640, 900);
    await page.goto(facts.home_url);
    result.narrow = await page.evaluate(`({
      doc: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    })`);
    await page.close();

    const empty = await newPage(browser, { colorScheme: 'light' });
    await empty.setViewport(1200, 900);
    await empty.goto(facts.empty_archive_url);
    await empty.waitFor(`!!document.querySelector('.yuki-empty-state p')`, 10000);
    result.bubble = await empty.evaluate(`(() => {
      const p = document.querySelector('.yuki-empty-state p');
      const style = getComputedStyle(p);
      const tail = getComputedStyle(p, '::before');
      return {
        borderStyle: style.borderTopStyle,
        radius: style.borderTopLeftRadius,
        background: style.backgroundColor,
        tailContent: tail.content,
      };
    })()`);
    await empty.setViewport(640, 900);
    await empty.goto(facts.empty_archive_url);
    result.emptyNarrow = await empty.evaluate(`({
      doc: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    })`);
    await empty.close();

    const reduced = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
    await reduced.setViewport(1200, 900);
    await reduced.goto(facts.home_url);
    await reduced.waitFor(`!!document.querySelector('.yuki-cat-badge')`, 10000);
    result.reducedBefore = await reduced.evaluate(
      `getComputedStyle(document.querySelector('.yuki-cat-badge')).transform`
    );
    await reduced.hover('.yuki-cat-badge');
    await sleep(320);
    result.reducedAfter = await reduced.evaluate(
      `getComputedStyle(document.querySelector('.yuki-cat-badge')).transform`
    );
    await reduced.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
}

if (measured) {
  check('贴纸是旋转的', measured.sticker.transform !== 'none' && measured.sticker.transform !== IDENTITY,
    measured.sticker.transform);
  check('贴纸边框是虚线', measured.sticker.borderStyle === 'dashed', measured.sticker.borderStyle);
  check('贴纸有胶带',
    measured.sticker.tapeContent !== 'none' && measured.sticker.tapeOpacity !== '0',
    `${measured.sticker.tapeContent} / ${measured.sticker.tapeOpacity}`);
  check('hover 时贴纸转正', measured.hovered === IDENTITY, measured.hovered);
  check('640px 下首页不横向滚动',
    measured.narrow.doc <= measured.narrow.client + 1, JSON.stringify(measured.narrow));

  check('气泡是实线边框', measured.bubble.borderStyle === 'solid', measured.bubble.borderStyle);
  check('气泡是 16px 圆角', measured.bubble.radius === '16px', measured.bubble.radius);
  check('气泡底色是卡片色', measured.bubble.background === 'rgb(255, 255, 255)', measured.bubble.background);
  check('气泡有尖角', measured.bubble.tailContent !== 'none', measured.bubble.tailContent);
  check('640px 下空归档不横向滚动',
    measured.emptyNarrow.doc <= measured.emptyNarrow.client + 1, JSON.stringify(measured.emptyNarrow));

  check('reduced motion 下贴纸不转正',
    measured.reducedBefore !== IDENTITY && measured.reducedBefore === measured.reducedAfter,
    `${measured.reducedBefore} -> ${measured.reducedAfter}`);
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

report();
