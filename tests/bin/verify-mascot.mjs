// 工单 01 的验收：雪兔与空状态微文案。
//
// 静态看模板、图片卡与季节条；HTTP 看 404、空归档、空搜索与首页 hero；
// 真浏览器量 hero 与 404 的角色尺寸、640px 是否横向滚动、深色下是否还在。
//
// 用法: node tests/bin/verify-mascot.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'mascot-fixtures.php');
const CUSTOM_FIXTURES = path.join(import.meta.dirname, 'mascot-customizer-fixtures.php');

const readFacts = (result) => JSON.parse(/YUKI-JSON: (\{.*\})/.exec(result.stdout)[1]);

/* ---------------- 静态 ---------------- */

section('角色、模板与样式');

const mascotPath = path.join(REPO_ROOT, 'template-parts', 'mascot.php');
check('雪兔模板存在', fs.existsSync(mascotPath));

const mascot = fs.existsSync(mascotPath) ? fs.readFileSync(mascotPath, 'utf8') : '';
const mascotCss = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'css', 'mascot-card.css'), 'utf8');
const mascotImage = path.join(REPO_ROOT, 'assets', 'images', 'mascot-yuki.png');
check('是白底证件照卡', mascot.includes('<span') && mascot.includes('<img') &&
  mascot.includes('class="yuki-mascot-photo"') && mascot.includes('aria-hidden="true"'));
check('图片与季节条都在卡片里',
  mascot.includes('assets/images/mascot-yuki.png') && mascot.includes('class="yuki-mascot-season"') &&
  mascot.includes('fill="var(--yuki-season)"'));
check('图片文件存在', fs.existsSync(mascotImage));
check('没有引用外部图片', !/src=["']https?:/i.test(mascot));

const mascotModulePath = path.join(REPO_ROOT, 'inc', 'mascot.php');
check('吉祥物设置模块存在', fs.existsSync(mascotModulePath));
const mascotModule = fs.existsSync(mascotModulePath) ? fs.readFileSync(mascotModulePath, 'utf8') : '';
check('自定义器注册了图片/开关/名称/身份',
  mascotModule.includes("add_section( 'yuki_mascot'") &&
  mascotModule.includes("'yuki_mascot_enabled'") &&
  mascotModule.includes("'yuki_mascot_image'") &&
  mascotModule.includes("'yuki_mascot_name'") &&
  mascotModule.includes("'yuki_mascot_role'") &&
  mascotModule.includes('WP_Customize_Image_Control'));
check('设置模块在 functions.php 里显式接入',
  fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8').includes('/inc/mascot.php'));
check('自定义图片时来源改成自定义',
  mascotModule.includes('yuki_mascot_has_custom_image()') &&
  mascotModule.includes("__( '自定义', 'yuki' )"));

check('卡片样式存在',
  mascotCss.includes('.yuki-mascot--photo') && mascotCss.includes('.yuki-mascot-photo') &&
  mascotCss.includes('.yuki-mascot-season'));

const index = fs.readFileSync(path.join(REPO_ROOT, 'index.php'), 'utf8');
const notFound = fs.readFileSync(path.join(REPO_ROOT, '404.php'), 'utf8');
const archive = fs.readFileSync(path.join(REPO_ROOT, 'archive.php'), 'utf8');
const search = fs.readFileSync(path.join(REPO_ROOT, 'search.php'), 'utf8');

const calls = (src) => (src.match(/get_template_part\(\s*'template-parts\/mascot'/g) ?? []).length;
check('首页 hero 与空状态都有雪兔', calls(index) >= 2, `找到 ${calls(index)} 处`);
check('404 有雪兔', calls(notFound) >= 1);
check('空归档有雪兔', calls(archive) >= 1);
check('空搜索有雪兔', calls(search) >= 1);

const css = themeCss();
const productionCss = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'css', 'production-bible.css'), 'utf8');
check('雪兔样式存在',
  css.includes('.yuki-mascot') && css.includes('.yuki-mascot--lg') && css.includes('.yuki-mascot--sm'));
check('hero 标题行存在', css.includes('.yuki-hero-title-row'));
check('空状态与 404 的布局样式存在',
  css.includes('.yuki-empty-state') && css.includes('.yuki-404 .yuki-mascot'));
check('关闭时首页有单列布局', productionCss.includes('.yuki-cover-grid--solo'));

const pot = fs.readFileSync(path.join(REPO_ROOT, 'languages', 'yuki.pot'), 'utf8');
check('新文案进了 pot',
  ['雪兔在雪地里找了半天', '雪兔翻遍了这一栏', '雪兔竖起耳朵听了半天', '雪兔把院子扫干净了']
    .every((text) => pot.includes(text)));
check('吉祥物设置文案进了 pot',
  ['Yuki 吉祥物', '显示吉祥物', '吉祥物图片', '吉祥物名称', '吉祥物身份', '自定义']
    .every((text) => pot.includes(text)));

/* ---------------- 造数 ---------------- */

const preCleanup = php([CUSTOM_FIXTURES, WP_ROOT, '--cleanup']);
if (preCleanup.status !== 0) {
  note(`开跑前恢复自定义设置失败：${preCleanup.stderr || preCleanup.stdout}`);
}

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = readFacts(fixtures);

/* ---------------- HTTP ---------------- */

section('页面里的雪兔');

const home = await get(facts.home_url);
check('首页能打开', home.status === 200, `status=${home.status}`);
check('hero 里有雪兔', home.body.includes('yuki-hero-title-row') &&
  /class="yuki-mascot yuki-mascot--photo yuki-mascot--lg/.test(home.body));
check('雪兔对读屏软件隐藏', /<span class="yuki-mascot[^"]*"[^>]*aria-hidden="true"/.test(home.body));
check('雪兔图片是本站资源', /src="[^"]*assets\/images\/mascot-yuki\.png"/.test(home.body));

const missing = await get(facts.not_found_url);
check('404 能打开', missing.status === 404, `status=${missing.status}`);
check('404 有雪兔', /class="yuki-mascot yuki-mascot--photo yuki-mascot--lg/.test(missing.body));
check('404 有新文案', missing.body.includes(facts.copy.not_found));

const emptyArchive = await get(facts.empty_archive_url);
check('空归档能打开', emptyArchive.status === 200, `status=${emptyArchive.status}`);
check('空归档有雪兔', emptyArchive.body.includes('yuki-empty-state') &&
  /class="yuki-mascot yuki-mascot--photo yuki-mascot--sm/.test(emptyArchive.body));
check('空归档有新文案', emptyArchive.body.includes(facts.copy.archive));

const emptySearch = await get(facts.empty_search_url);
check('空搜索能打开', emptySearch.status === 200, `status=${emptySearch.status}`);
check('空搜索有雪兔', emptySearch.body.includes('yuki-empty-state') &&
  /class="yuki-mascot yuki-mascot--photo yuki-mascot--sm/.test(emptySearch.body));
check('空搜索有新文案', emptySearch.body.includes(facts.copy.search));

/* ---------------- 真浏览器 ---------------- */

section('尺寸与深色');

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const result = {};

    const page = await newPage(browser, { colorScheme: 'light' });
    await page.setViewport(1200, 900);
    await page.goto(facts.home_url);
    result.hero = await page.evaluate(`(() => {
      const el = document.querySelector('.yuki-hero .yuki-mascot');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    })()`);

    await page.setViewport(640, 900);
    await page.goto(facts.home_url);
    result.narrow = await page.evaluate(`(() => {
      const el = document.querySelector('.yuki-hero .yuki-mascot');
      const r = el ? el.getBoundingClientRect() : null;
      return {
        width: r ? r.width : 0,
        doc: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      };
    })()`);
    await page.close();

    const missingPage = await newPage(browser, { colorScheme: 'light' });
    await missingPage.setViewport(1200, 900);
    await missingPage.goto(facts.not_found_url);
    result.notFound = await missingPage.evaluate(`(() => {
      const el = document.querySelector('.yuki-404 .yuki-mascot');
      return el ? el.getBoundingClientRect().width : 0;
    })()`);
    await missingPage.close();

    const darkPage = await newPage(browser, { colorScheme: 'dark' });
    await darkPage.setViewport(1200, 900);
    await darkPage.goto(facts.home_url);
    result.dark = await darkPage.evaluate(`(() => {
      const el = document.querySelector('.yuki-hero .yuki-mascot');
      return el ? el.getBoundingClientRect().width : 0;
    })()`);
    await darkPage.close();

    return result;
  });
} catch (error) {
  browserError = error.message;
}

if (measured) {
  check('hero 里的雪兔有尺寸',
    measured.hero && measured.hero.width > 0 && measured.hero.height > 0,
    JSON.stringify(measured.hero));
  check('640px 下雪兔仍在且不横向滚动',
    measured.narrow.width > 0 && measured.narrow.doc <= measured.narrow.client + 1,
    JSON.stringify(measured.narrow));
  check('404 的雪兔有尺寸', measured.notFound > 0, `${measured.notFound}px`);
  check('深色下雪兔仍有尺寸', measured.dark > 0, `${measured.dark}px`);
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

/* ---------------- 自定义与隐藏 ---------------- */

section('自定义与隐藏');

let customFlowError = '';
let customFacts = null;
let hiddenFacts = null;
let customMeasured = null;

try {
  const customRun = php([CUSTOM_FIXTURES, WP_ROOT, 'custom']);
  if (customRun.status !== 0) {
    throw new Error(`自定义造数失败：${customRun.stderr || customRun.stdout}`);
  }
  customFacts = readFacts(customRun);

  const customHome = await get(customFacts.home_url);
  check('自定义首页能打开', customHome.status === 200, `status=${customHome.status}`);
  check('自定义图片 URL 生效', customHome.body.includes('yuki-custom=1'));
  check('自定义名称生效', customHome.body.includes('<dd>YUKI-CUSTOM-NAME</dd>'));
  check('自定义身份生效', customHome.body.includes('<dd>YUKI-CUSTOM-ROLE</dd>'));
  check('自定义来源显示「自定义」', customHome.body.includes('<dd>自定义</dd>'));
  check('角色卡不再显示默认文案',
    !customHome.body.includes('<dd>雪兔</dd>') &&
    !customHome.body.includes('<dd>本站看板角色</dd>'));

  const customMissing = await get(facts.not_found_url);
  check('自定义后 404 也用同一张图', customMissing.body.includes('yuki-custom=1') &&
    /class="yuki-mascot yuki-mascot--photo yuki-mascot--lg/.test(customMissing.body));

  const hiddenRun = php([CUSTOM_FIXTURES, WP_ROOT, 'hidden']);
  if (hiddenRun.status !== 0) {
    throw new Error(`隐藏造数失败：${hiddenRun.stderr || hiddenRun.stdout}`);
  }
  hiddenFacts = readFacts(hiddenRun);

  const hiddenHome = await get(hiddenFacts.home_url);
  check('隐藏后首页没有角色卡', !hiddenHome.body.includes('yuki-character-sheet'));
  check('隐藏后首页没有吉祥物', !hiddenHome.body.includes('class="yuki-mascot'));
  check('隐藏后 grid 变成单列', hiddenHome.body.includes('yuki-cover-grid--solo'));

  const hiddenMissing = await get(facts.not_found_url);
  check('隐藏后 404 没有吉祥物', !hiddenMissing.body.includes('class="yuki-mascot'));

  customMeasured = await withBrowser(async (browser) => {
    const result = {};

    const customAgain = php([CUSTOM_FIXTURES, WP_ROOT, 'custom']);
    if (customAgain.status !== 0) {
      throw new Error(`重新切到自定义失败：${customAgain.stderr || customAgain.stdout}`);
    }

    const customPage = await newPage(browser, { colorScheme: 'light' });
    await customPage.setViewport(1440, 900);
    await customPage.goto(customFacts.home_url);
    result.custom = await customPage.evaluate(`(() => {
      const img = document.querySelector('.yuki-hero .yuki-mascot-photo');
      const grid = document.querySelector('.yuki-cover-grid');
      return {
        src: img ? img.getAttribute('src') : '',
        columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      };
    })()`);
    await customPage.close();

    const hiddenAgain = php([CUSTOM_FIXTURES, WP_ROOT, 'hidden']);
    if (hiddenAgain.status !== 0) {
      throw new Error(`重新切到隐藏失败：${hiddenAgain.stderr || hiddenAgain.stdout}`);
    }

    const hiddenPage = await newPage(browser, { colorScheme: 'light' });
    await hiddenPage.setViewport(1440, 900);
    await hiddenPage.goto(hiddenFacts.home_url);
    result.hidden = await hiddenPage.evaluate(`(() => {
      const grid = document.querySelector('.yuki-cover-grid');
      return {
        mascot: !!document.querySelector('.yuki-mascot'),
        sheet: !!document.querySelector('.yuki-character-sheet'),
        columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      };
    })()`);
    await hiddenPage.close();

    return result;
  });
} catch (error) {
  customFlowError = error.message;
} finally {
  const cleanup = php([CUSTOM_FIXTURES, WP_ROOT, '--cleanup']);
  if (cleanup.status !== 0) {
    note(`自定义设置恢复失败：${cleanup.stderr || cleanup.stdout}`);
  }
}

if (customFlowError) {
  check('自定义流程跑到底', false, customFlowError);
} else {
  check('自定义图片真的进了 img', !!customMeasured && customMeasured.custom.src.includes('yuki-custom=1'),
    customMeasured ? customMeasured.custom.src : '');
  check('自定义时首页仍是两栏', !!customMeasured && customMeasured.custom.columns === 2,
    JSON.stringify(customMeasured));
  check('隐藏时首页没有吉祥物与角色卡', !!customMeasured &&
    !customMeasured.hidden.mascot && !customMeasured.hidden.sheet,
    JSON.stringify(customMeasured));
  check('隐藏时首页 grid 是一列', !!customMeasured && customMeasured.hidden.columns === 1,
    JSON.stringify(customMeasured));
}

const restored = await get(facts.home_url);
check('恢复默认后角色卡与默认图回来',
  restored.body.includes('yuki-character-sheet') &&
  /src="[^"]*assets\/images\/mascot-yuki\.png"/.test(restored.body) &&
  restored.body.includes('<dd>雪兔</dd>'));

report();
