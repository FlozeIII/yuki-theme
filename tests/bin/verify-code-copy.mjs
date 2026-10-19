// 工单 01 的验收：正文与说说里的代码块复制按钮。
//
// 分三层：
//   1. 文件——脚本、加载、文案、CSS 规则；
//   2. HTTP——服务端不输出按钮/容器，脚本与本地化文案在页面里；
//   3. 真浏览器——范围、对齐、剪贴板成功/回退/全失败、按钮位置、键盘焦点、深色、窄屏。
//
// 剪贴板不碰系统权限：在页面里替换 navigator.clipboard 与 document.execCommand，
// 分别验成功、写权限被拒后回退、两条路都失败三种结局。
//
// 用法: node tests/bin/verify-code-copy.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, tokens, hexToRgb, contrast } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'code-copy-fixtures.php');
const SCRIPT = path.join(REPO_ROOT, 'assets', 'js', 'code-copy.js');

/* ---------------- 静态 ---------------- */

section('脚本、加载与视觉规范');

check('复制脚本存在', fs.existsSync(SCRIPT), SCRIPT);

const js = fs.existsSync(SCRIPT) ? fs.readFileSync(SCRIPT, 'utf8') : '';
check('脚本没有模块导入或外链', !/\b(?:import|require)\s*\(/.test(js) && !/https?:\/\//.test(js));
check('脚本用 IIFE 包住', js.includes('(function () {') && js.trimEnd().endsWith('})();') && js.includes("'use strict'"));
check('只扫正文与说说范围',
  js.includes("'.yuki-prose pre, .yuki-shuoshuo-body pre'") &&
  /querySelectorAll\(\s*SCOPES\s*\)/.test(js));
check('剪贴板优先、execCommand 回退',
  js.includes('navigator.clipboard') && js.includes('writeText') && js.includes("execCommand('copy')"));
check('复制文本取 textContent', /textContent/.test(js));
check('对齐类转给外层容器',
  /align\(\?:wide\|full/.test(js) && js.includes('wrapper.classList.add') && js.includes('pre.classList.remove'));
check('空白代码块跳过', /!text\.trim\(\)/.test(js));
check('结果经 aria-live 播报',
  js.includes("setAttribute('role', 'status')") && js.includes("setAttribute('aria-live', 'polite')"));

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
check('functions.php 排上了 yuki-code-copy',
  /wp_enqueue_script\(\s*'yuki-code-copy'/.test(functions));
check('文案走 wp_localize_script',
  /wp_localize_script\(\s*'yuki-code-copy'/.test(functions));
check('三条文案都过 __()',
  ["复制代码", "已复制", "复制失败"].every((text) =>
    new RegExp(`__\\(\\s*'${text}'\\s*,\\s*'yuki'\\s*\\)`).test(functions)));

const css = themeCss();
const root = tokens(css);
const dark = tokens(css, '.dark');

check('外层容器是定位上下文',
  /:is\(\.yuki-prose, \.yuki-shuoshuo-body\) \.yuki-code-block\s*\{[^}]*position:\s*relative/.test(css));
check('pre 外边距归零', /\.yuki-code-block\s*>\s*pre\s*\{[^}]*margin:\s*0/.test(css));
check('按钮绝对定位在右上',
  /\.yuki-code-copy\s*\{[^}]*position:\s*absolute[^}]*top:\s*8px[^}]*right:\s*8px/.test(css));
check('按钮底色与文字沿用 card / ink-2',
  /\.yuki-code-copy\s*\{[^}]*background:\s*var\(--yuki-card\)[^}]*color:\s*var\(--yuki-ink-2\)/.test(css));
check('键盘焦点环用 ring token',
  /\.yuki-code-copy:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--yuki-ring\)/.test(css));
check('深色 hover 用主色', /\.dark \.yuki-code-copy:hover/.test(css));

const buttonRule = /\.yuki-code-copy\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
check('按钮没有写死颜色', !/#[0-9a-f]{3,6}\b/i.test(buttonRule) && !/rgba?\(/i.test(buttonRule), buttonRule);

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

/* ---------------- HTTP ---------------- */

section('服务端保持渐进增强');

const page = await get(facts.page_url);
check('验收页面能打开', page.status === 200, `status=${page.status}`);
check('页面里有宽块、经典块与行内 code',
  ['YUKI-CODE-COPY-WIDE', 'YUKI-CODE-COPY-CLASSIC', 'YUKI-CODE-COPY-INLINE', 'data-yuki-empty="1"']
    .every((marker) => page.body.includes(marker)));
check('脚本已排上', /code-copy\.js/.test(page.body));
check('文案已本地化', /yukiCodeCopy\s*=/.test(page.body) && page.body.includes('copyLabel'));
check('服务端没有按钮或容器', !/class="[^"]*yuki-code-(?:block|copy)/.test(page.body));

if (facts.shuoshuo_url) {
  const shuoshuo = await get(facts.shuoshuo_url);
  check('说说归档能打开', shuoshuo.status === 200, `status=${shuoshuo.status}`);
  check('说说正文里有代码块', shuoshuo.body.includes('YUKI-CODE-COPY-SHUOSHUO'));
  check('说说服务端也没有按钮或容器', !/class="[^"]*yuki-code-(?:block|copy)/.test(shuoshuo.body));
} else {
  note('站点没有配置说说承载分类，跳过说说那一组');
}

/* ---------------- 真浏览器 ---------------- */

const stubClipboard = (mode) => `(() => {
  window.__yukiCopied = null;
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText(text) {
        window.__yukiCopied = text;
        return ${mode === 'resolve' ? 'Promise.resolve()' : "Promise.reject(new Error('denied'))"};
      },
    },
  });
})()`;

section('真浏览器：贴按钮、复制与反馈');

let measured = null;
let browserError = '';

try {
  measured = await withBrowser(async (browser) => {
    const tab = await newPage(browser, { colorScheme: 'light' });
    await tab.setViewport(1200, 900);
    await tab.goto(facts.page_url);
    await tab.waitFor(`document.querySelectorAll('.yuki-prose .yuki-code-copy').length === 2`, 10000);

    const result = {};

    result.base = await tab.evaluate(`(() => {
      const prose = document.querySelector('.yuki-prose');
      const pres = Array.from(prose.querySelectorAll('pre'));
      const wide = pres.find((pre) => pre.textContent.includes('YUKI-CODE-COPY-WIDE'));
      const classic = pres.find((pre) => pre.textContent.includes('YUKI-CODE-COPY-CLASSIC'));
      const empty = prose.querySelector('pre[data-yuki-empty]');
      const inline = prose.querySelector('p code');
      const wideBlock = wide.closest('.yuki-code-block');
      const button = wideBlock.querySelector('.yuki-code-copy');
      const width = wideBlock.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      const style = getComputedStyle(button);

      return {
        preCount: pres.length,
        blockCount: prose.querySelectorAll('.yuki-code-block').length,
        buttonCount: prose.querySelectorAll('.yuki-code-copy').length,
        wideText: wide.textContent,
        classicText: classic.textContent,
        wideHasAlign: wide.classList.contains('alignwide'),
        blockHasAlign: wideBlock.classList.contains('alignwide'),
        emptyWrapped: !!empty.closest('.yuki-code-block'),
        inlineWrapped: !!inline.closest('.yuki-code-block'),
        inlineButton: !!inline.closest('.yuki-code-block')?.querySelector('.yuki-code-copy'),
        tag: button.tagName,
        type: button.type,
        tabIndex: button.tabIndex,
        ariaLabel: button.getAttribute('aria-label'),
        buttonText: button.textContent,
        wrapperPosition: getComputedStyle(wideBlock).position,
        buttonPosition: style.position,
        buttonInside: box.left >= width.left - 1 && box.right <= width.right + 1 &&
          box.top >= width.top - 1 && box.bottom <= width.bottom + 1,
        topGap: box.top - width.top,
        rightGap: width.right - box.right,
        wideWidth: width.width,
        proseWidth: prose.getBoundingClientRect().width,
        lightColor: style.color,
        lightBg: style.backgroundColor,
      };
    })()`);

    /* 成功：clipboard.writeText 拿到逐字文本，按钮与 live region 都反馈。 */
    await tab.evaluate(stubClipboard('resolve'));
    await tab.evaluate(`document.querySelector('.yuki-code-block.alignwide .yuki-code-copy').click()`);
    await tab.waitFor(`document.querySelector('.yuki-code-block.alignwide .yuki-code-copy').textContent === '已复制'`, 3000);
    await tab.waitFor(`(() => {
      const live = document.querySelector('[data-yuki-code-live]');
      return !!live && live.textContent === '已复制';
    })()`, 2000);

    result.copied = await tab.evaluate(`(() => {
      const button = document.querySelector('.yuki-code-block.alignwide .yuki-code-copy');
      return {
        text: window.__yukiCopied,
        label: button.getAttribute('aria-label'),
        buttonText: button.textContent,
        copiedClass: button.classList.contains('is-copied'),
        failedClass: button.classList.contains('is-failed'),
        busy: button.getAttribute('aria-busy'),
        live: document.querySelector('[data-yuki-code-live]').textContent,
      };
    })()`);

    await tab.waitFor(`document.querySelector('.yuki-code-block.alignwide .yuki-code-copy').textContent === '复制代码'`, 4000);
    result.reset = await tab.evaluate(`(() => {
      const button = document.querySelector('.yuki-code-block.alignwide .yuki-code-copy');
      return { text: button.textContent, copiedClass: button.classList.contains('is-copied') };
    })()`);

    /* 回退：写权限被拒，execCommand 成功；文本要来自临时 textarea。 */
    await tab.evaluate(stubClipboard('reject'));
    await tab.evaluate(`document.execCommand = function (command) {
      if (command === 'copy') {
        const area = document.querySelector('textarea[aria-hidden="true"]');
        window.__yukiLegacy = area ? area.value : null;
        return true;
      }
      return false;
    }`);
    await tab.evaluate(`document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy').click()`);
    await tab.waitFor(`document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy').textContent === '已复制'`, 3000);

    result.legacy = await tab.evaluate(`(() => {
      const button = document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy');
      return {
        text: window.__yukiLegacy,
        buttonText: button.textContent,
        copiedClass: button.classList.contains('is-copied'),
      };
    })()`);

    await tab.waitFor(`document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy').textContent === '复制代码'`, 4000);

    /* 全失败：两条路都不成，按钮报「复制失败」，不能假装成功。 */
    await tab.evaluate(stubClipboard('reject'));
    await tab.evaluate(`document.execCommand = function () { return false; }`);
    await tab.evaluate(`document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy').click()`);
    await tab.waitFor(`document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy').textContent === '复制失败'`, 3000);
    await tab.waitFor(`(() => {
      const live = document.querySelector('[data-yuki-code-live]');
      return !!live && live.textContent === '复制失败';
    })()`, 2000);

    result.failure = await tab.evaluate(`(() => {
      const button = document.querySelector('.yuki-code-block:not(.alignwide) .yuki-code-copy');
      return {
        buttonText: button.textContent,
        copiedClass: button.classList.contains('is-copied'),
        failedClass: button.classList.contains('is-failed'),
        live: document.querySelector('[data-yuki-code-live]').textContent,
      };
    })()`);

    /* 键盘：原生按钮、可聚焦、有可见焦点环（规则在静态层已断言）。 */
    result.focus = await tab.evaluate(`(() => {
      const button = document.querySelector('.yuki-code-block.alignwide .yuki-code-copy');
      button.focus();
      return {
        active: document.activeElement === button,
        tabIndex: button.tabIndex,
        tag: button.tagName,
      };
    })()`);

    await tab.close();

    /* 窄屏：宽块贴边，按钮不把页面撑出横向滚动。 */
    const narrow = await newPage(browser, { colorScheme: 'light' });
    await narrow.setViewport(640, 900);
    await narrow.goto(facts.page_url);
    await narrow.waitFor(`document.querySelectorAll('.yuki-prose .yuki-code-copy').length === 2`, 10000);
    result.narrow = await narrow.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.yuki-prose .yuki-code-copy'));
      const wide = document.querySelector('.yuki-code-block.alignwide').getBoundingClientRect();
      return {
        doc: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        vw: innerWidth,
        left: Math.min(...buttons.map((b) => b.getBoundingClientRect().left)),
        right: Math.max(...buttons.map((b) => b.getBoundingClientRect().right)),
        wideLeft: wide.left,
        wideRight: wide.right,
      };
    })()`);
    await narrow.close();

    /* 深色：按钮底色仍是 card token，文字对比度够。 */
    const darkPage = await newPage(browser, { colorScheme: 'dark' });
    await darkPage.setViewport(1200, 900);
    await darkPage.goto(facts.page_url);
    await darkPage.waitFor(`document.querySelectorAll('.yuki-prose .yuki-code-copy').length === 2`, 10000);
    result.dark = await darkPage.evaluate(`(() => {
      const style = getComputedStyle(document.querySelector('.yuki-prose .yuki-code-copy'));
      return { bg: style.backgroundColor, color: style.color };
    })()`);
    await darkPage.close();

    /* 说说正文：同一套初始化也要覆盖 .yuki-shuoshuo-body。 */
    if (facts.shuoshuo_url) {
      const shuoshuo = await newPage(browser, { colorScheme: 'light' });
      await shuoshuo.setViewport(1200, 900);
      await shuoshuo.goto(facts.shuoshuo_url);
      await shuoshuo.waitFor(`document.querySelectorAll('.yuki-shuoshuo-body .yuki-code-copy').length >= 1`, 10000);

      result.shuoshuoInit = await shuoshuo.evaluate(`(() => {
        const pre = Array.from(document.querySelectorAll('.yuki-shuoshuo-body pre'))
          .find((item) => item.textContent.includes('YUKI-CODE-COPY-SHUOSHUO'));
        return {
          found: !!pre,
          wrapped: !!pre.closest('.yuki-code-block'),
          buttons: pre.closest('.yuki-code-block').querySelectorAll('.yuki-code-copy').length,
          text: pre.textContent,
        };
      })()`);

      await shuoshuo.evaluate(stubClipboard('resolve'));
      await shuoshuo.evaluate(`(() => {
        const pre = Array.from(document.querySelectorAll('.yuki-shuoshuo-body pre'))
          .find((item) => item.textContent.includes('YUKI-CODE-COPY-SHUOSHUO'));
        pre.closest('.yuki-code-block').querySelector('.yuki-code-copy').click();
      })()`);
      await shuoshuo.waitFor(`(() => {
        const pre = Array.from(document.querySelectorAll('.yuki-shuoshuo-body pre'))
          .find((item) => item.textContent.includes('YUKI-CODE-COPY-SHUOSHUO'));
        return pre.closest('.yuki-code-block').querySelector('.yuki-code-copy').textContent === '已复制';
      })()`, 3000);
      result.shuoshuoCopied = await shuoshuo.evaluate('window.__yukiCopied');
      await shuoshuo.close();
    }

    return result;
  });
} catch (error) {
  browserError = error.message;
} finally {
  // 这条说说在共享的说说分类里，验完就拆掉，别把别的工单的归档条数改了。
  php([FIXTURES, WP_ROOT, '--cleanup']);
}

section('真浏览器里量到的结果');

if (measured) {
  const base = measured.base;

  check('两个非空代码块都包装并配了按钮',
    base.preCount === 3 && base.blockCount === 2 && base.buttonCount === 2,
    JSON.stringify({ pre: base.preCount, block: base.blockCount, button: base.buttonCount }));
  check('空白代码块不包装', base.emptyWrapped === false);
  check('行内 code 不包装、没有按钮', base.inlineWrapped === false && base.inlineButton === false);
  check('宽块对齐类已转移到容器', base.wideHasAlign === false && base.blockHasAlign === true);
  check('按钮是原生 button，可 Tab 聚焦',
    base.tag === 'BUTTON' && base.type === 'button' && base.tabIndex === 0,
    `${base.tag}/${base.type}/${base.tabIndex}`);
  check('按钮有可读名称与初始文字',
    base.ariaLabel === '复制代码' && base.buttonText === '复制代码',
    `${base.ariaLabel}/${base.buttonText}`);
  check('容器相对定位、按钮绝对定位',
    base.wrapperPosition === 'relative' && base.buttonPosition === 'absolute',
    `${base.wrapperPosition}/${base.buttonPosition}`);
  check('按钮落在容器右上角内',
    base.buttonInside === true && base.topGap <= 20 && base.rightGap <= 20,
    JSON.stringify({ inside: base.buttonInside, top: base.topGap, right: base.rightGap }));
  check('宽块确实比正文列宽',
    base.wideWidth > base.proseWidth + 100,
    `${base.wideWidth} vs ${base.proseWidth}`);
  check('复制文本逐字等于代码原文',
    base.wideText === facts.wide_code && base.classicText === facts.classic_code);
  check('浅色按钮文字对比度 ≥ 4.5',
    contrast(base.lightColor, base.lightBg) >= 4.5,
    `${contrast(base.lightColor, base.lightBg).toFixed(2)} ${base.lightColor} on ${base.lightBg}`);

  check('成功复制拿到逐字文本', measured.copied.text === facts.wide_code);
  check('成功时按钮显示「已复制」并切 is-copied',
    measured.copied.buttonText === '已复制' && measured.copied.copiedClass === true &&
    measured.copied.failedClass === false && measured.copied.busy === null,
    JSON.stringify(measured.copied));
  check('成功时 live region 播报', measured.copied.live === '已复制', measured.copied.live);
  check('约 2 秒后按钮恢复',
    measured.reset.text === '复制代码' && measured.reset.copiedClass === false,
    JSON.stringify(measured.reset));

  check('写权限被拒时回退 execCommand 并复制成功',
    measured.legacy.text === facts.classic_code && measured.legacy.buttonText === '已复制' &&
    measured.legacy.copiedClass === true,
    JSON.stringify(measured.legacy));
  check('两条路都失败时报「复制失败」',
    measured.failure.buttonText === '复制失败' && measured.failure.failedClass === true &&
    measured.failure.copiedClass === false && measured.failure.live === '复制失败',
    JSON.stringify(measured.failure));
  check('按钮能获得焦点', measured.focus.active === true && measured.focus.tabIndex === 0 &&
    measured.focus.tag === 'BUTTON', JSON.stringify(measured.focus));

  check('640px 下没有横向滚动',
    measured.narrow.doc <= measured.narrow.client + 1,
    `${measured.narrow.doc} > ${measured.narrow.client}`);
  check('640px 下按钮与宽块都在视口内',
    measured.narrow.left >= -1 && measured.narrow.right <= measured.narrow.vw + 1 &&
    measured.narrow.wideLeft >= -1 && measured.narrow.wideRight <= measured.narrow.vw + 1,
    JSON.stringify(measured.narrow));
  check('深色按钮底色仍是 card token',
    measured.dark.bg === hexToRgb(dark['--yuki-card']),
    `${measured.dark.bg} vs ${hexToRgb(dark['--yuki-card'])}`);
  check('深色按钮文字对比度 ≥ 4.5',
    contrast(measured.dark.color, measured.dark.bg) >= 4.5,
    `${contrast(measured.dark.color, measured.dark.bg).toFixed(2)} ${measured.dark.color} on ${measured.dark.bg}`);

  if (facts.shuoshuo_url) {
    check('说说正文的代码块也包装并配了按钮',
      measured.shuoshuoInit.found === true && measured.shuoshuoInit.wrapped === true &&
      measured.shuoshuoInit.buttons === 1,
      JSON.stringify(measured.shuoshuoInit));
    check('说说里复制的是说说的那段代码',
      measured.shuoshuoCopied === facts.shuoshuo_code,
      measured.shuoshuoCopied);
  }
} else {
  note(`无头浏览器没跑完：${browserError}`);
  check('无头浏览器跑到底', false, browserError);
}

report();
