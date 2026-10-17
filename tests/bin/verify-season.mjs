// 工单 03 的验收：季节点缀色。
//
// 静态看 CSS/DESIGN.md/函数；PHP 探针验 1–12 月映射；HTTP/浏览器验当前季节的 body 类，
// 以及雪兔与贴纸胶带确实用了这一个季节色。
//
// 用法: node tests/bin/verify-season.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, hexToRgb } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'season-fixtures.php');

/* ---------------- 静态 ---------------- */

section('季节 token 与只染装饰');

const css = themeCss();
const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
const design = fs.readFileSync(path.join(REPO_ROOT, 'DESIGN.md'), 'utf8');
const mascot = fs.readFileSync(path.join(REPO_ROOT, 'template-parts', 'mascot.php'), 'utf8');

check('根部有 --yuki-season', /:root\s*\{[^}]*--yuki-season:\s*#A5B4FC/.test(css));
check('四季各有覆盖',
  /body\.season-spring\s*\{\s*--yuki-season:\s*#F2A6C2/.test(css) &&
  /body\.season-summer\s*\{\s*--yuki-season:\s*#7CC7E8/.test(css) &&
  /body\.season-autumn\s*\{\s*--yuki-season:\s*#E8A33D/.test(css) &&
  /body\.season-winter\s*\{\s*--yuki-season:\s*#A5B4FC/.test(css));
check('贴纸胶带用季节色',
  /\.yuki-cat-badge::before\s*\{[^}]*background:\s*var\(--yuki-season\)/.test(css));
check('雪兔用季节色', mascot.includes('var(--yuki-season)'));
check('DESIGN.md 记录了四季',
  ['#F2A6C2', '#7CC7E8', '#E8A33D', '#A5B4FC'].every((hex) => design.includes(hex)));
check('月份函数与 body_class 过滤都在',
  /function yuki_season_slug\(/.test(functions) &&
  /add_filter\(\s*'body_class'\s*,\s*'yuki_season_body_class'/.test(functions));

/* ---------------- 月份映射 ---------------- */

section('月份映射');

const monthsOut = php([FIXTURES, WP_ROOT, '--months']);
const months = JSON.parse(/YUKI-MONTHS: (\{.*\})/.exec(monthsOut.stdout)?.[1] ?? '{}');

for (const month of [3, 4, 5]) {
  check(`${month} 月是春`, months[month] === 'season-spring', months[month]);
}
for (const month of [6, 7, 8]) {
  check(`${month} 月是夏`, months[month] === 'season-summer', months[month]);
}
for (const month of [9, 10, 11]) {
  check(`${month} 月是秋`, months[month] === 'season-autumn', months[month]);
}
for (const month of [12, 1, 2]) {
  check(`${month} 月是冬`, months[month] === 'season-winter', months[month]);
}

/* ---------------- 当前季节 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`探针失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const expectedRgb = hexToRgb(facts.hex);

section('当前季节落到页面');

const home = await get(facts.home_url);
check('首页能打开', home.status === 200, `status=${home.status}`);
check(`body 带 ${facts.current}`, new RegExp(`class="[^"]*\\b${facts.current}\\b`).test(home.body));

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    await page.waitFor(`!!document.querySelector('.yuki-mascot') && !!document.querySelector('.yuki-cat-badge')`, 10000);

    return await page.evaluate(`(() => {
      const path = document.querySelector('.yuki-mascot [fill="var(--yuki-season)"]');
      const badge = document.querySelector('.yuki-cat-badge');
      const tape = badge ? getComputedStyle(badge, '::before') : null;
      return {
        bodyClass: document.body.className,
        scarfFill: path ? getComputedStyle(path).fill : '',
        tapeBg: tape ? tape.backgroundColor : '',
      };
    })()`);
  });
} catch (error) {
  browserError = error.message;
}

if (measured) {
  check('当前 season 类在 body 上',
    new RegExp(`\\b${facts.current}\\b`).test(measured.bodyClass), measured.bodyClass);
  check('雪兔的装饰用了季节色', measured.scarfFill === expectedRgb,
    `${measured.scarfFill} vs ${expectedRgb}`);
  check('贴纸胶带用了季节色', measured.tapeBg === expectedRgb,
    `${measured.tapeBg} vs ${expectedRgb}`);
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

report();
