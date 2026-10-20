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
check('雪兔样式存在',
  css.includes('.yuki-mascot') && css.includes('.yuki-mascot--lg') && css.includes('.yuki-mascot--sm'));
check('hero 标题行存在', css.includes('.yuki-hero-title-row'));
check('空状态与 404 的布局样式存在',
  css.includes('.yuki-empty-state') && css.includes('.yuki-404 .yuki-mascot'));

const pot = fs.readFileSync(path.join(REPO_ROOT, 'languages', 'yuki.pot'), 'utf8');
check('新文案进了 pot',
  ['雪兔在雪地里找了半天', '雪兔翻遍了这一栏', '雪兔竖起耳朵听了半天', '雪兔把院子扫干净了']
    .every((text) => pot.includes(text)));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

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

report();
