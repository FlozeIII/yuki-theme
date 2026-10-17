// 工单 02 的验收：页头图横幅。
//
// 临时设一张 1600×700 的 header_image，验完在 finally 里恢复原 theme mod 并删测试图。
// 验：横幅在导航之前、宽度铺满、桌面最高 420px、窄屏最高 220px、object-fit: cover、无横向滚动。
//
// 用法: node tests/bin/verify-header-image.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'header-image-fixtures.php');

/* ---------------- 静态 ---------------- */

section('支持、模板与样式');

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
const header = fs.readFileSync(path.join(REPO_ROOT, 'header.php'), 'utf8');
const css = themeCss();

check('声明了 custom-header', /add_theme_support\(\s*'custom-header'/.test(functions));
check('宽度/高度与弹性裁剪',
  /'width'\s*=>\s*1600/.test(functions) && /'height'\s*=>\s*500/.test(functions) &&
  /'flex-height'\s*=>\s*true/.test(functions) && /'flex-width'\s*=>\s*true/.test(functions));
check('关掉了无用的 header-text', /'header-text'\s*=>\s*false/.test(functions));
check('模板输出页头图',
  /get_header_image\(\)/.test(header) && /the_header_image_tag\(/.test(header));
check('横幅在导航之前', header.indexOf('yuki-header-image') < header.indexOf('class="yuki-nav"'));
check('样式有横幅与高度上限',
  css.includes('.yuki-header-image') && /max-height:\s*420px/.test(css) &&
  /@media\s*\(max-width:\s*640px\)[\s\S]*?yuki-header-image-tag[^}]*max-height:\s*220px/.test(css));

/* ---------------- 造数 ---------------- */

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
  section('页面里的横幅');

  const home = await get(facts.home_url);
  check('首页能打开', home.status === 200, `status=${home.status}`);
  check('页面里有页头图', home.body.includes('yuki-header-image') && home.body.includes(imageName));
  const posImage = home.body.indexOf('yuki-header-image');
  const posNav = home.body.indexOf('class="yuki-nav"');
  check('横幅在导航之前', posImage >= 0 && posNav > posImage, `image=${posImage} nav=${posNav}`);

  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    await page.waitFor(`!!document.querySelector('.yuki-header-image-tag')`, 10000);
    result.desktop = await page.evaluate(`(() => {
      const img = document.querySelector('.yuki-header-image-tag');
      const ir = img.getBoundingClientRect();
      const nav = document.querySelector('.yuki-nav').getBoundingClientRect();
      return {
        width: ir.width,
        height: ir.height,
        fit: getComputedStyle(img).objectFit,
        navTop: nav.top,
        navBottom: nav.bottom,
        imageBottom: ir.bottom,
        doc: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      };
    })()`);

    await page.setViewport(640, 900);
    await page.goto(facts.home_url);
    result.narrow = await page.evaluate(`(() => {
      const img = document.querySelector('.yuki-header-image-tag');
      const r = img.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        doc: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      };
    })()`);
    await page.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
} finally {
  php([FIXTURES, WP_ROOT, '--cleanup']);
}

section('量到的横幅');

if (measured) {
  check('横幅铺满视口宽度',
    Math.abs(measured.desktop.width - measured.desktop.client) <= 1,
    `${measured.desktop.width}px / client ${measured.desktop.client}px`);
  check('桌面最高 420px', measured.desktop.height <= 420 + 1, `${measured.desktop.height}px`);
  check('用 cover 裁剪', measured.desktop.fit === 'cover', measured.desktop.fit);
  check('导航在横幅下方', measured.desktop.navTop >= measured.desktop.imageBottom - 1,
    JSON.stringify(measured.desktop));
  check('桌面没有横向滚动',
    measured.desktop.doc <= measured.desktop.client + 1, JSON.stringify(measured.desktop));

  check('窄屏最高 220px', measured.narrow.height <= 220 + 1, `${measured.narrow.height}px`);
  check('窄屏没有横向滚动',
    measured.narrow.doc <= measured.narrow.client + 1, JSON.stringify(measured.narrow));
} else {
  check('无头浏览器跑到底', false, browserError);
}

report();
