// 工单 03 的验收：强调色。
//
// 临时把 yuki_accent 设成 #E85D75，验完在 finally 里恢复原值。
// 验：全局主色与焦点环跟着换、按钮底色/前景色正确、深色模式同样生效、
// 季节点缀色不被强调色影响。
//
// 用法: node tests/bin/verify-accent.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { hexToRgb } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'accent-fixtures.php');
const SEASON_FIXTURES = path.join(import.meta.dirname, 'season-fixtures.php');

/* ---------------- 静态 ---------------- */

section('支持、推导与输出');

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
const pot = fs.readFileSync(path.join(REPO_ROOT, 'languages', 'yuki.pot'), 'utf8');

check('自定义器有强调色', /yuki_accent/.test(functions) && /WP_Customize_Color_Control/.test(functions));
check('强调色走 hex 校验', /'sanitize_callback'\s*=>\s*'sanitize_hex_color'/.test(functions));
check('前景色按亮度选', /function yuki_accent_foreground/.test(functions));
check('hover 档用 color-mix 推导', /--yuki-primary-600:color-mix/.test(functions));
check('焦点环跟着强调色', /--yuki-ring:/.test(functions));
check('文案进了 pot', pot.includes('强调色') && pot.includes('留空使用主题默认的堇紫'));

/* ---------------- 前景色 ---------------- */

section('前景色');

const fgOut = php([FIXTURES, WP_ROOT, '--foreground']);
const fg = JSON.parse(/YUKI-FOREGROUND: (\{.*\})/.exec(fgOut.stdout)?.[1] ?? '{}');

check('主题堇紫用深墨字', fg['#A5B4FC'] === '#0F0F14', fg['#A5B4FC']);
check('玫瑰色用暖白字', fg['#E85D75'] === '#F3F0EA', fg['#E85D75']);
check('黑色用暖白字', fg['#000000'] === '#F3F0EA', fg['#000000']);
check('白色用深墨字', fg['#FFFFFF'] === '#0F0F14', fg['#FFFFFF']);

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}
const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

const seasonOut = php([SEASON_FIXTURES, WP_ROOT]);
const season = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(seasonOut.stdout)?.[1] ?? '{}');
const seasonRgb = hexToRgb(season.hex);

const accentRgb = hexToRgb(facts.accent);
const foregroundRgb = hexToRgb(facts.foreground);

let measured = null;
let browserError = '';

try {
  section('页面里的强调色');

  const home = await get(facts.home_url);
  check('首页能打开', home.status === 200, `status=${home.status}`);
  check('主色变量写进了页面', home.body.includes(`--yuki-primary:${facts.accent}`));
  check('前景色写进了页面', home.body.includes(`--yuki-primary-foreground:${facts.foreground}`));
  check('焦点环写进了页面', home.body.includes(`--yuki-ring:${facts.accent}`));
  check('hover 档是推导出来的', /--yuki-primary-600:color-mix/.test(home.body));

  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    await page.waitFor(`!!document.querySelector('.yuki-btn')`, 10000);
    result.light = await page.evaluate(`(() => {
      const root = getComputedStyle(document.documentElement);
      const btn = document.querySelector('.yuki-btn');
      const badge = document.querySelector('.yuki-cat-badge');
      const tape = badge ? getComputedStyle(badge, '::before') : null;
      return {
        primary: root.getPropertyValue('--yuki-primary').trim(),
        ring: root.getPropertyValue('--yuki-ring').trim(),
        foreground: root.getPropertyValue('--yuki-primary-foreground').trim(),
        buttonBg: btn ? getComputedStyle(btn).backgroundColor : '',
        buttonColor: btn ? getComputedStyle(btn).color : '',
        tapeBg: tape ? tape.backgroundColor : '',
      };
    })()`);
    await page.close();

    const dark = await newPage(browser, { colorScheme: 'dark' });
    await dark.setViewport(1200, 900);
    await dark.goto(facts.home_url);
    await dark.waitFor(`!!document.querySelector('.yuki-btn')`, 10000);
    result.dark = await dark.evaluate(`(() => {
      const root = getComputedStyle(document.documentElement);
      const btn = document.querySelector('.yuki-btn');
      return {
        primary: root.getPropertyValue('--yuki-primary').trim(),
        buttonBg: btn ? getComputedStyle(btn).backgroundColor : '',
        buttonColor: btn ? getComputedStyle(btn).color : '',
      };
    })()`);
    await dark.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
} finally {
  php([FIXTURES, WP_ROOT, '--cleanup']);
}

section('量到的结果');

if (measured) {
  check('浅色主色是强调色', measured.light.primary === facts.accent, measured.light.primary);
  check('浅色焦点环是强调色', measured.light.ring === facts.accent, measured.light.ring);
  check('浅色前景色正确', measured.light.foreground === facts.foreground, measured.light.foreground);
  check('按钮底色是强调色', measured.light.buttonBg === accentRgb,
    `${measured.light.buttonBg} vs ${accentRgb}`);
  check('按钮文字是推导的前景色', measured.light.buttonColor === foregroundRgb,
    `${measured.light.buttonColor} vs ${foregroundRgb}`);
  check('季节点缀色不受影响', measured.light.tapeBg === seasonRgb,
    `${measured.light.tapeBg} vs ${seasonRgb}`);

  check('深色主色也是强调色', measured.dark.primary === facts.accent, measured.dark.primary);
  check('深色按钮底色是强调色', measured.dark.buttonBg === accentRgb, measured.dark.buttonBg);
  check('深色按钮文字是前景色', measured.dark.buttonColor === foregroundRgb, measured.dark.buttonColor);
} else {
  check('无头浏览器跑到底', false, browserError);
}

report();
