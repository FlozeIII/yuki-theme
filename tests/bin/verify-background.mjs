// 背景图 + 蒙层的验收。
//
// 用临时 theme mod 设一张背景图与 60 的蒙层，验完在 finally 里恢复原值：
//   - 有背景图时 body 带 yuki-has-background-image，核心输出 custom-background 样式；
//   - 蒙层是 body::before，强度来自 --yuki-bg-scrim，跟随深浅色；
//   - 只设背景色时不该出现蒙层（本脚本只验有图这一路，类名过滤是静态断言）。
//
// 用法: node tests/bin/verify-background.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'background-fixtures.php');

/* ---------------- 静态 ---------------- */

section('支持、滑杆与蒙层样式');

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
const css = themeCss();
const pot = fs.readFileSync(path.join(REPO_ROOT, 'languages', 'yuki.pot'), 'utf8');

check('声明了 custom-background', /add_theme_support\(\s*'custom-background'/.test(functions));
check('自定义器有蒙层滑杆',
  /yuki_background_scrim/.test(functions) && /'type'\s*=>\s*'range'/.test(functions));
check('蒙层取值夹在 0–100', /function yuki_sanitize_background_scrim/.test(functions));
check('有背景图时给 body 加类',
  /function yuki_background_body_class/.test(functions) && /yuki-has-background-image/.test(functions));
check('蒙层强度输出成 CSS 变量', /--yuki-bg-scrim/.test(functions));

check('样式里有蒙层变量', /--yuki-bg-scrim:\s*\.8/.test(css));
check('蒙层只挂在有背景图的 body 上',
  /body\.yuki-has-background-image::before\s*\{[^}]*opacity:\s*var\(--yuki-bg-scrim\)/.test(css) &&
  /body\.yuki-has-background-image::before\s*\{[^}]*pointer-events:\s*none/.test(css) &&
  /body\.yuki-has-background-image::before\s*\{[^}]*z-index:\s*-1/.test(css));

check('文案进了 pot', pot.includes('背景蒙层强度') && pot.includes('只在设置了背景图时生效'));

/* ---------------- 取值夹取 ---------------- */

section('滑杆取值');

const sanitizeOut = php([FIXTURES, WP_ROOT, '--sanitize']);
const sanitize = JSON.parse(/YUKI-SANITIZE: (\{.*\})/.exec(sanitizeOut.stdout)?.[1] ?? '{}');

check('-10 夹到 0', sanitize['-10'] === 0, String(sanitize['-10']));
check('0 还是 0', sanitize['0'] === 0, String(sanitize['0']));
check('60 还是 60', sanitize['60'] === 60, String(sanitize['60']));
check('100 还是 100', sanitize['100'] === 100, String(sanitize['100']));
check('150 夹到 100', sanitize['150'] === 100, String(sanitize['150']));
check('字符串 75 变 75', sanitize['75'] === 75, String(sanitize['75']));

/* ---------------- 造数与验页面 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const imageName = facts.image_url.split('/').pop();

let measured = null;
let browserError = '';

try {
  section('页面里的背景与蒙层');

  const home = await get(facts.home_url);
  check('首页能打开', home.status === 200, `status=${home.status}`);
  check('body 有背景图类',
    /class="[^"]*\byuki-has-background-image\b/.test(home.body) &&
    /class="[^"]*\bcustom-background\b/.test(home.body));
  check('页面里有核心的背景图样式', home.body.includes(imageName));
  check('蒙层强度写进了页面', /--yuki-bg-scrim:0?\.6/.test(home.body));

  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    await page.waitFor(`document.body.classList.contains('yuki-has-background-image')`, 10000);
    result.light = await page.evaluate(`(() => {
      const body = getComputedStyle(document.body);
      const scrim = getComputedStyle(document.body, '::before');
      return {
        bodyImage: body.backgroundImage,
        content: scrim.content,
        opacity: scrim.opacity,
        background: scrim.backgroundColor,
        position: scrim.position,
        pointerEvents: scrim.pointerEvents,
        zIndex: scrim.zIndex,
      };
    })()`);
    await page.close();

    const dark = await newPage(browser, { colorScheme: 'dark' });
    await dark.setViewport(1200, 900);
    await dark.goto(facts.home_url);
    await dark.waitFor(`document.body.classList.contains('yuki-has-background-image')`, 10000);
    result.dark = await dark.evaluate(
      `getComputedStyle(document.body, '::before').backgroundColor`
    );
    await dark.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
} finally {
  php([FIXTURES, WP_ROOT, '--cleanup']);
}

section('量到的蒙层');

if (measured) {
  check('背景图真的在 body 上', measured.light.bodyImage.includes(imageName), measured.light.bodyImage);
  check('蒙层存在', measured.light.content !== 'none', measured.light.content);
  check('蒙层强度是滑杆的 60%', measured.light.opacity === '0.6', measured.light.opacity);
  check('浅色蒙层是冷灰', measured.light.background === 'rgb(220, 227, 230)', measured.light.background);
  check('蒙层固定铺满、不挡点击',
    measured.light.position === 'fixed' && measured.light.pointerEvents === 'none',
    `${measured.light.position} / ${measured.light.pointerEvents}`);
  check('蒙层在内容之下', measured.light.zIndex === '-1', measured.light.zIndex);
  check('深色蒙层是档案黑', measured.dark === 'rgb(7, 12, 16)', measured.dark);
} else {
  check('无头浏览器跑到底', false, browserError);
}

report();
