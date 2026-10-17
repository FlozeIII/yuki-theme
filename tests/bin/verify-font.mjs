// 工单 04 的验收：字体切换。
//
// 临时把 yuki_font_style 设成 serif，验完在 finally 里恢复原值。
// 验：body 与 h1 一起换到衬线栈、代码块仍用等宽、深色模式不变、取值白名单。
//
// 用法: node tests/bin/verify-font.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';

const FIXTURES = path.join(import.meta.dirname, 'font-fixtures.php');

/* ---------------- 静态 ---------------- */

section('设置、字体栈与白名单');

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
const css = fs.readFileSync(path.join(REPO_ROOT, 'style.css'), 'utf8');
const pot = fs.readFileSync(path.join(REPO_ROOT, 'languages', 'yuki.pot'), 'utf8');

check('自定义器有字体风格', /yuki_font_style/.test(functions) && /yuki_typography/.test(functions));
check('三档白名单', /function yuki_sanitize_font_style/.test(functions));
check('衬线栈存在', /Noto Serif SC/.test(functions) && /Songti SC/.test(functions));
check('圆体栈存在', /Yuanti SC/.test(functions) && /YouYuan/.test(functions));
check('输出 --yuki-font-sans', /--yuki-font-sans/.test(functions));
check('等宽字体仍是独立 token',
  /--yuki-font-mono:\s*"JetBrains Mono"/.test(css));
check('文案进了 pot', pot.includes('字体风格') && pot.includes('无衬线（默认）'));

/* ---------------- 白名单 ---------------- */

section('取值');

const sanitizeOut = php([FIXTURES, WP_ROOT, '--sanitize']);
const sanitize = JSON.parse(/YUKI-SANITIZE: (\{.*\})/.exec(sanitizeOut.stdout)?.[1] ?? '{}');

check('sans 保留', sanitize.sans === 'sans', sanitize.sans);
check('serif 保留', sanitize.serif === 'serif', sanitize.serif);
check('rounded 保留', sanitize.rounded === 'rounded', sanitize.rounded);
check('未知值回到 sans', sanitize.bogus === 'sans', sanitize.bogus);
check('空值回到 sans', sanitize[''] === 'sans', sanitize['']);

/* ---------------- 造数与验页面 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}
const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

let measured = null;
let browserError = '';

try {
  section('页面里的字体');

  const home = await get(facts.home_url);
  check('首页能打开', home.status === 200, `status=${home.status}`);
  check('衬线栈写进了页面',
    home.body.includes('--yuki-font-sans') && home.body.includes('Noto Serif SC'));

  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    await page.waitFor(`!!document.querySelector('h1')`, 10000);
    result.light = await page.evaluate(`(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        body: getComputedStyle(document.body).fontFamily,
        heading: getComputedStyle(document.querySelector('h1')).fontFamily,
        mono: root.getPropertyValue('--yuki-font-mono').trim(),
      };
    })()`);
    await page.close();

    const dark = await newPage(browser, { colorScheme: 'dark' });
    await dark.setViewport(1200, 900);
    await dark.goto(facts.home_url);
    result.dark = await dark.evaluate(`getComputedStyle(document.body).fontFamily`);
    await dark.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
} finally {
  php([FIXTURES, WP_ROOT, '--cleanup']);
}

section('量到的字体');

if (measured) {
  check('正文换到衬线栈', measured.light.body.includes('Noto Serif SC'), measured.light.body);
  check('标题跟着换', measured.light.heading.includes('Noto Serif SC'), measured.light.heading);
  check('等宽字体保持独立',
    measured.light.mono.includes('JetBrains Mono') && measured.light.mono.includes('monospace'),
    measured.light.mono);
  check('深色模式字体不变', measured.dark.includes('Noto Serif SC'), measured.dark);
} else {
  check('无头浏览器跑到底', false, browserError);
}

report();
