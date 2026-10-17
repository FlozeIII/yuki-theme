// 工单 01 的验收：正文与说说里的图片灯箱。
//
// 分三层：
//   1. 文件——脚本、加载、token、DESIGN.md、reduced-motion 规则；
//   2. HTTP——服务端不输出遮罩，图片与脚本在页面里；
//   3. 真浏览器——点、键盘、焦点、链接接管、范围排除、深色、窄屏、reduced motion。
//
// 用法: node tests/bin/verify-image-lightbox.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, tokens } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'image-lightbox-fixtures.php');

/* ---------------- 静态 ---------------- */

section('脚本、加载与视觉规范');

const jsPath = path.join(REPO_ROOT, 'assets', 'js', 'image-lightbox.js');
check('灯箱脚本存在', fs.existsSync(jsPath), jsPath);

const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';
check('脚本没有模块导入或外链', !/\b(import|require)\s*\(/.test(js) && !/https?:\/\//.test(js));

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
check('functions.php 排上了 yuki-image-lightbox',
  /wp_enqueue_script\(\s*'yuki-image-lightbox'/.test(functions));
check('文案走 wp_localize_script',
  /wp_localize_script\(\s*'yuki-image-lightbox'/.test(functions));

const css = themeCss();
const root = tokens(css);

check('遮罩 token 定义正确',
  root['--yuki-overlay-backdrop'] === 'rgba(24, 24, 31, 0.92)',
  root['--yuki-overlay-backdrop']);
check('前景 token 定义正确',
  root['--yuki-overlay-foreground'] === '#F3F0EA',
  root['--yuki-overlay-foreground']);
check('灯箱规则存在', css.includes('.yuki-lightbox') && css.includes('.yuki-lightbox-trigger'));
check('reduced-motion 覆盖灯箱',
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.yuki-lightbox/.test(css));

const design = fs.readFileSync(path.join(REPO_ROOT, 'DESIGN.md'), 'utf8');
check('DESIGN.md 记录了浮层 token',
  design.includes('--yuki-overlay-backdrop') && design.includes('--yuki-overlay-foreground'));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

/* ---------------- HTTP ---------------- */

section('服务端不输出遮罩');

const page = await get(facts.page_url);
check('验收页面能打开', page.status === 200, `status=${page.status}`);
check('页面里有裸图/区块图/链接图',
  ['YUKI-LIGHTBOX-BARE', 'YUKI-LIGHTBOX-FIG-ALT', 'YUKI-LIGHTBOX-MEDIA', 'YUKI-LIGHTBOX-ANCHOR', 'YUKI-LIGHTBOX-ATTACH']
    .every((alt) => page.body.includes(`alt="${alt}"`)));
check('服务端没有遮罩标记', !/class="[^"]*yuki-lightbox/.test(page.body));
check('灯箱脚本已排上', /image-lightbox\.js/.test(page.body));

if (facts.shuoshuo_url) {
  const shuoshuo = await get(facts.shuoshuo_url);
  check('说说归档能打开', shuoshuo.status === 200, `status=${shuoshuo.status}`);
  check('说说归档里有正文图', shuoshuo.body.includes('YUKI-LIGHTBOX-SHUOSHUO'));
} else {
  note('站点没有配置说说承载分类，跳过说说那一组');
}

/* ---------------- 真浏览器 ---------------- */

async function waitOpen(tab) {
  // 打开与聚焦分两帧：等「浮层已开 + 焦点在关闭按钮」都成立再断言。
  await tab.waitFor(`(() => {
    const box = document.querySelector('.yuki-lightbox.is-open');
    return !!box && document.activeElement &&
      document.activeElement.classList.contains('yuki-lightbox-close');
  })()`, 5000);
}

async function waitClosed(tab) {
  await tab.waitFor(`!document.querySelector('.yuki-lightbox.is-open')`, 5000);
}

async function clickAlt(tab, alt) {
  await tab.evaluate(`document.querySelector('img[alt="${alt}"]').click()`);
}

async function esc(tab) {
  await tab.evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitClosed(tab);
}

section('真浏览器：打开与关闭');

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const tab = await newPage(browser, { colorScheme: 'light' });
    await tab.setViewport(1200, 900);
    await tab.goto(facts.page_url);
    await tab.waitFor(`!!document.querySelector('.yuki-prose img.yuki-lightbox-trigger')`, 10000);

    const result = {};

    /* 1. 裸图：点开，大图取 srcset 最大候选 */
    await clickAlt(tab, 'YUKI-LIGHTBOX-BARE');
    await waitOpen(tab);

    result.open = await tab.evaluate(`(() => {
      const box = document.querySelector('.yuki-lightbox');
      const image = document.querySelector('.yuki-lightbox-image');
      const caption = document.querySelector('.yuki-lightbox-caption');
      return {
        src: image.getAttribute('src'),
        alt: image.getAttribute('alt'),
        caption: caption.textContent,
        focus: document.activeElement ? document.activeElement.className : '',
        locked: document.body.classList.contains('yuki-lightbox-locked'),
        role: box.getAttribute('role'),
        modal: box.getAttribute('aria-modal'),
      };
    })()`);

    /* 2. Esc 关闭，焦点回到触发图 */
    await esc(tab);
    result.afterEsc = await tab.evaluate(`(() => ({
      focusAlt: document.activeElement ? document.activeElement.getAttribute('alt') : '',
      locked: document.body.classList.contains('yuki-lightbox-locked'),
    }))()`);

    /* 3. 裸图键盘：聚焦后 Enter 打开 */
    await tab.evaluate(`(() => {
      const img = document.querySelector('img[alt="YUKI-LIGHTBOX-BARE"]');
      img.focus();
      img.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    })()`);
    await waitOpen(tab);
    result.keyboardOpened = await tab.evaluate(`!!document.querySelector('.yuki-lightbox.is-open')`);

    /* 4. Tab 锁在浮层里：只有关闭按钮时，焦点留在它上面 */
    result.tabTrap = await tab.evaluate(`(() => {
      const before = document.activeElement.className;
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      return { before, after: document.activeElement.className };
    })()`);
    await esc(tab);

    /* 5. 点遮罩关闭 */
    await clickAlt(tab, 'YUKI-LIGHTBOX-BARE');
    await waitOpen(tab);
    await tab.evaluate(`document.querySelector('.yuki-lightbox-backdrop').click()`);
    await waitClosed(tab);
    result.backdropClosed = await tab.evaluate(`!document.querySelector('.yuki-lightbox.is-open')`);

    /* 6. 点关闭按钮关闭 */
    await clickAlt(tab, 'YUKI-LIGHTBOX-BARE');
    await waitOpen(tab);
    await tab.evaluate(`document.querySelector('.yuki-lightbox-close').click()`);
    await waitClosed(tab);
    result.closeButtonClosed = await tab.evaluate(`!document.querySelector('.yuki-lightbox.is-open')`);

    /* 7. 区块图：图注来自 figcaption */
    await clickAlt(tab, 'YUKI-LIGHTBOX-FIG-ALT');
    await waitOpen(tab);
    result.figureCaption = await tab.evaluate(`document.querySelector('.yuki-lightbox-caption').textContent`);
    await esc(tab);

    /* 8. 链接到媒体文件：接管，不导航 */
    const beforeMedia = await tab.evaluate('location.href');
    await clickAlt(tab, 'YUKI-LIGHTBOX-MEDIA');
    await waitOpen(tab);
    result.media = await tab.evaluate(`(() => ({
      href: location.href,
      src: document.querySelector('.yuki-lightbox-image').getAttribute('src'),
    }))()`);
    result.mediaBefore = beforeMedia;
    await esc(tab);

    /* 9. 链接到页内锚点：不接管，链接照常生效 */
    await clickAlt(tab, 'YUKI-LIGHTBOX-ANCHOR');
    await tab.waitFor(`location.hash === '#yuki-lightbox-anchor'`, 3000);
    result.anchor = await tab.evaluate(`(() => ({
      hash: location.hash,
      open: !!document.querySelector('.yuki-lightbox.is-open'),
    }))()`);

    /* 10. 带 rel=attachment：接管，大图走 srcset */
    const beforeAttach = await tab.evaluate('location.href');
    await clickAlt(tab, 'YUKI-LIGHTBOX-ATTACH');
    await waitOpen(tab);
    result.attach = await tab.evaluate(`(() => ({
      href: location.href,
      src: document.querySelector('.yuki-lightbox-image').getAttribute('src'),
    }))()`);
    result.attachBefore = beforeAttach;
    await esc(tab);

    /* 11. 特色图不在范围里 */
    await tab.evaluate(`document.querySelector('.yuki-article-featured img').click()`);
    await tab.waitFor(`!document.querySelector('.yuki-lightbox.is-open')`, 1000).catch(() => {});
    result.featured = await tab.evaluate(`!!document.querySelector('.yuki-lightbox.is-open')`);

    /* 12. 深色：遮罩仍是同一个 token */
    const dark = await newPage(browser, { colorScheme: 'dark' });
    await dark.setViewport(1200, 900);
    await dark.goto(facts.page_url);
    await dark.waitFor(`!!document.querySelector('.yuki-prose img.yuki-lightbox-trigger')`, 10000);
    await clickAlt(dark, 'YUKI-LIGHTBOX-BARE');
    await waitOpen(dark);
    result.darkBackdrop = await dark.evaluate(
      `getComputedStyle(document.querySelector('.yuki-lightbox-backdrop')).backgroundColor`
    );
    await dark.close();

    /* 13. 窄屏：图片完整落在视口里，不横向滚动 */
    const narrow = await newPage(browser, { colorScheme: 'light' });
    await narrow.setViewport(640, 900);
    await narrow.goto(facts.page_url);
    await narrow.waitFor(`!!document.querySelector('.yuki-prose img.yuki-lightbox-trigger')`, 10000);
    await clickAlt(narrow, 'YUKI-LIGHTBOX-BARE');
    await waitOpen(narrow);
    result.narrow = await narrow.evaluate(`(() => {
      const r = document.querySelector('.yuki-lightbox-image').getBoundingClientRect();
      return {
        left: r.left, top: r.top, right: r.right, bottom: r.bottom,
        vw: innerWidth, vh: innerHeight,
        doc: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      };
    })()`);
    await narrow.close();

    /* 14. reduced motion：没有过渡、没有缩放 */
    const reduced = await newPage(browser, { colorScheme: 'light', reducedMotion: true });
    await reduced.setViewport(1200, 900);
    await reduced.goto(facts.page_url);
    await reduced.waitFor(`!!document.querySelector('.yuki-prose img.yuki-lightbox-trigger')`, 10000);
    await clickAlt(reduced, 'YUKI-LIGHTBOX-BARE');
    await waitOpen(reduced);
    result.reduced = await reduced.evaluate(`(() => {
      const box = getComputedStyle(document.querySelector('.yuki-lightbox'));
      const figure = getComputedStyle(document.querySelector('.yuki-lightbox-figure'));
      return { overlay: box.transitionDuration, figure: figure.transitionDuration, transform: figure.transform };
    })()`);
    await reduced.close();

    /* 15. 说说正文图 */
    if (facts.shuoshuo_url) {
      const shuoshuo = await newPage(browser, { colorScheme: 'light' });
      await shuoshuo.setViewport(1200, 900);
      await shuoshuo.goto(facts.shuoshuo_url);
      await shuoshuo.waitFor(`!!document.querySelector('.yuki-shuoshuo-body img.yuki-lightbox-trigger')`, 10000);
      await clickAlt(shuoshuo, 'YUKI-LIGHTBOX-SHUOSHUO');
      await waitOpen(shuoshuo);
      result.shuoshuo = await shuoshuo.evaluate(
        `document.querySelector('.yuki-lightbox-image').getAttribute('src')`
      );
      await shuoshuo.close();
    }

    await tab.close();
    return result;
  });
} catch (error) {
  browserError = error.message;
}

section('真浏览器里量到的结果');

if (measured) {
  check('遮罩打开且大图取 srcset 最大候选',
    measured.open.src === facts.large_url, `${measured.open.src} vs ${facts.large_url}`);
  check('灯箱图片保留原 alt', measured.open.alt === 'YUKI-LIGHTBOX-BARE', measured.open.alt);
  check('没有图注时用 alt 兜底', measured.open.caption === 'YUKI-LIGHTBOX-BARE', measured.open.caption);
  check('打开后焦点在关闭按钮', measured.open.focus.includes('yuki-lightbox-close'), measured.open.focus);
  check('打开时锁住背景滚动', measured.open.locked === true);
  check('对话框语义正确', measured.open.role === 'dialog' && measured.open.modal === 'true',
    `${measured.open.role}/${measured.open.modal}`);

  check('Esc 关闭', measured.afterEsc.locked === false);
  check('关闭后焦点回到触发图', measured.afterEsc.focusAlt === 'YUKI-LIGHTBOX-BARE',
    measured.afterEsc.focusAlt);
  check('裸图 Enter 能打开', measured.keyboardOpened === true);
  check('Tab 不会跑出浮层', measured.tabTrap.before.includes('yuki-lightbox-close') &&
    measured.tabTrap.after.includes('yuki-lightbox-close'),
    JSON.stringify(measured.tabTrap));
  check('点遮罩能关闭', measured.backdropClosed === true);
  check('点关闭按钮能关闭', measured.closeButtonClosed === true);
  check('区块图的图注来自 figcaption', measured.figureCaption === 'YUKI-LIGHTBOX-CAPTION',
    measured.figureCaption);

  check('媒体文件链接被接管，当前页 URL 不变',
    measured.media.href === measured.mediaBefore, `${measured.media.href} vs ${measured.mediaBefore}`);
  check('媒体文件链接打开的是 href', measured.media.src === facts.large_url, measured.media.src);
  check('页内锚点链接不被接管，链接照常生效',
    measured.anchor.hash === '#yuki-lightbox-anchor' && measured.anchor.open === false,
    JSON.stringify(measured.anchor));
  check('rel=attachment 被接管，大图走 srcset',
    measured.attach.href === measured.attachBefore && measured.attach.src === facts.large_url,
    JSON.stringify(measured.attach));
  check('特色图不触发灯箱', measured.featured === false);

  check('深色下遮罩仍是同一个 token',
    measured.darkBackdrop === 'rgba(24, 24, 31, 0.92)', measured.darkBackdrop);
  check('窄屏下图片完整落在视口里',
    measured.narrow.left >= 0 && measured.narrow.top >= 0 &&
    measured.narrow.right <= measured.narrow.vw + 1 &&
    measured.narrow.bottom <= measured.narrow.vh + 1,
    JSON.stringify(measured.narrow));
  check('窄屏下没有横向滚动',
    measured.narrow.doc <= measured.narrow.client + 1,
    `${measured.narrow.doc} > ${measured.narrow.client}`);
  check('reduced motion 下没有过渡',
    measured.reduced.overlay === '0s' && measured.reduced.figure === '0s',
    JSON.stringify(measured.reduced));
  check('reduced motion 下没有缩放',
    measured.reduced.transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(measured.reduced.transform),
    measured.reduced.transform);

  if (facts.shuoshuo_url) {
    check('说说正文图也能打开', measured.shuoshuo === facts.large_url, measured.shuoshuo);
  }
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

report();
