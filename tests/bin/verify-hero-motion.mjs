// 工单 04 的验收：hero 的樱瓣/星光。
//
// 静态看标记与 CSS；真浏览器量 7 枚花瓣、动画名/时长、季节色、pointer-events、
// 640px 不横向滚动，以及 reduced motion 下整层隐藏。花瓣只该出现在首页 hero。
//
// 用法: node tests/bin/verify-hero-motion.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, hexToRgb } from './theme-css.mjs';

const SEASON_FIXTURES = path.join(import.meta.dirname, 'season-fixtures.php');
const MASCOT_FIXTURES = path.join(import.meta.dirname, 'mascot-fixtures.php');

/* ---------------- 静态 ---------------- */

section('花瓣标记与样式');

const index = fs.readFileSync(path.join(REPO_ROOT, 'index.php'), 'utf8');
const css = themeCss();

check('hero 里有花瓣层', index.includes('class="yuki-hero-petals" aria-hidden="true"'));
check('正好 7 枚花瓣', (index.match(/<span><\/span>/g) ?? []).length === 7,
  `找到 ${(index.match(/<span><\/span>/g) ?? []).length} 枚`);

check('花瓣层不接收点击',
  /\.yuki-hero-petals\s*\{[^}]*pointer-events:\s*none/.test(css));
check('花瓣用季节色',
  /\.yuki-hero-petals span\s*\{[^}]*background:\s*var\(--yuki-season\)/.test(css));
check('有飘落动画', /@keyframes yuki-petal-fall/.test(css) &&
  /\.yuki-hero-petals span\s*\{[^}]*animation:\s*yuki-petal-fall/.test(css));
check('reduced motion 下整层隐藏',
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yuki-hero-petals\s*\{\s*display:\s*none/.test(css));

/* ---------------- 当前季节色 ---------------- */

const seasonOut = php([SEASON_FIXTURES, WP_ROOT]);
const season = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(seasonOut.stdout)?.[1] ?? '{}');
const expectedRgb = hexToRgb(season.hex);

const mascotOut = php([MASCOT_FIXTURES, WP_ROOT]);
const mascot = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(mascotOut.stdout)?.[1] ?? '{}');

/* ---------------- HTTP ---------------- */

section('首页与别处');

const home = await get(season.home_url);
check('首页能打开', home.status === 200, `status=${home.status}`);
check('首页有花瓣层', home.body.includes('yuki-hero-petals'));
check('首页有 7 枚花瓣', (home.body.match(/<span><\/span>/g) ?? []).length === 7);

const archive = await get(mascot.empty_archive_url);
check('归档页能打开', archive.status === 200, `status=${archive.status}`);
check('花瓣只在首页 hero', !archive.body.includes('yuki-hero-petals'));

/* ---------------- 真浏览器 ---------------- */

section('动画与减少动效');

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(season.home_url);
    await page.waitFor(`!!document.querySelector('.yuki-hero-petals span')`, 10000);
    result.petals = await page.evaluate(`(() => {
      const spans = [...document.querySelectorAll('.yuki-hero-petals span')];
      const first = spans[0];
      const style = first ? getComputedStyle(first) : null;
      const layer = getComputedStyle(document.querySelector('.yuki-hero-petals'));
      return {
        count: spans.length,
        animationName: style ? style.animationName : '',
        animationDuration: style ? style.animationDuration : '',
        background: style ? style.backgroundColor : '',
        pointerEvents: layer.pointerEvents,
      };
    })()`);

    await page.setViewport(640, 900);
    await page.goto(season.home_url);
    result.narrow = await page.evaluate(`({
      doc: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    })`);
    await page.close();

    const reduced = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
    await reduced.setViewport(1200, 900);
    await reduced.goto(season.home_url);
    result.reduced = await reduced.evaluate(
      `getComputedStyle(document.querySelector('.yuki-hero-petals')).display`
    );
    await reduced.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
}

if (measured) {
  check('浏览器里有 7 枚花瓣', measured.petals.count === 7, `${measured.petals.count} 枚`);
  check('花瓣在跑动画', measured.petals.animationName === 'yuki-petal-fall' &&
    measured.petals.animationDuration !== '0s',
    `${measured.petals.animationName} / ${measured.petals.animationDuration}`);
  check('花瓣用季节色', measured.petals.background === expectedRgb,
    `${measured.petals.background} vs ${expectedRgb}`);
  check('花瓣层不接收点击', measured.petals.pointerEvents === 'none', measured.petals.pointerEvents);
  check('640px 下不横向滚动',
    measured.narrow.doc <= measured.narrow.client + 1, JSON.stringify(measured.narrow));
  check('reduced motion 下整层隐藏', measured.reduced === 'none', measured.reduced);
} else {
  check('无头浏览器跑到底', false, browserError);
}

report();
