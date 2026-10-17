// 工单 02 的验收：编辑器画布里套上的就是主题的正文样式。
//
// 分三层：
//   1. 读 functions.php 与 style.css——接入声明、作用域别名、画布宽度；
//   2. PHP 探针——get_editor_stylesheets() 里确实有 style.css；
//   3. 真浏览器——用 WP 自己生成的登录 cookie 打开文章编辑器，量 iframe 里的
//      字体、字号、行高、颜色、引用、代码块、图片圆角与图注。
//
// 登录自动化不成立时按工单约定退到「PHP 探针 + 人工目检」，但本脚本会把失败原因打印出来，
// 不静默通过。
//
// 用法: node tests/bin/verify-editor-styles.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, WP_ROOT, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { themeCss, cssBlock, tokens, hexToRgb } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'editor-styles-fixtures.php');

/* ---------------- 静态：接入声明 ---------------- */

section('编辑器接入用同一份 style.css');

const css = themeCss();
const root = tokens(css);
const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');

check("声明了 editor-styles", /add_theme_support\(\s*'editor-styles'\s*\)/.test(functions));
check("add_editor_style() 指向 style.css", /add_editor_style\(\s*'style\.css'\s*\)/.test(functions));
check('正文作用域同时覆盖 .editor-styles-wrapper',
  css.includes(':is(.yuki-prose, .editor-styles-wrapper)'));
check('没有另立编辑器样式表',
  !fs.existsSync(path.join(REPO_ROOT, 'assets', 'css', 'editor.css')));
check('--yuki-gutter 已定义', root['--yuki-gutter'] === '24px', `实际：${root['--yuki-gutter']}`);

const canvas = cssBlock(css, '.editor-styles-wrapper');
check('画布宽度由正文宽度与内边距推出',
  canvas.includes('calc(var(--yuki-content-width) - 2 * var(--yuki-gutter))'), canvas);
check('画布居中', /margin-left:\s*auto/.test(canvas) && /margin-right:\s*auto/.test(canvas), canvas);

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const styleSheetPresent = facts.editor_stylesheets.some((url) => /style\.css/.test(url));

check('get_editor_stylesheets() 含 style.css', styleSheetPresent,
  facts.editor_stylesheets.join(', '));

/* ---------------- 真浏览器：登录后的编辑器 ---------------- */

section('登录后的编辑器画布');

const FIND_FRAME = `(() => {
  const frame = [...document.querySelectorAll('iframe')].find((el) => {
    try { return el.contentDocument && el.contentDocument.querySelector('.editor-styles-wrapper'); }
    catch (e) { return false; }
  });
  return !!frame;
})()`;

let editor = null;
let browserError = '';

try {
  editor = await withBrowser(async (browser) => {
    const tab = await newPage(browser, { colorScheme: 'light' });
    await tab.setViewport(1400, 1000);
    for (const cookie of facts.cookies) {
      await tab.setCookie({ name: cookie.name, value: cookie.value, url: SITE });
    }
    await tab.goto(facts.editor_url);

    const where = await tab.evaluate('location.href');
    if (/wp-login\.php/.test(where)) {
      throw new Error(`登录态没被接受，被带到了 ${where}`);
    }

    await tab.waitFor(FIND_FRAME, 45000);

    const measured = await tab.evaluate(`(() => {
      const frame = [...document.querySelectorAll('iframe')].find((el) => {
        try { return el.contentDocument && el.contentDocument.querySelector('.editor-styles-wrapper'); }
        catch (e) { return false; }
      });
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      const wrapper = doc.querySelector('.editor-styles-wrapper');
      const para = doc.querySelector('p');
      const quote = doc.querySelector('blockquote');
      const pre = doc.querySelector('pre');
      const img = doc.querySelector('figure img');
      const caption = doc.querySelector('figcaption');
      const cs = (el) => (el ? win.getComputedStyle(el) : null);
      const box = (el) => (el ? el.getBoundingClientRect() : null);

      return {
        links: [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href),
        themePrimary: cs(wrapper) ? cs(wrapper).getPropertyValue('--yuki-primary').trim() : null,
        wrapperWidth: box(wrapper) ? box(wrapper).width : null,
        wrapperFont: cs(wrapper) ? cs(wrapper).fontFamily : null,
        wrapperSize: cs(wrapper) ? cs(wrapper).fontSize : null,
        wrapperLine: cs(wrapper) ? cs(wrapper).lineHeight : null,
        wrapperColor: cs(wrapper) ? cs(wrapper).color : null,
        paraSize: cs(para) ? cs(para).fontSize : null,
        paraLine: cs(para) ? cs(para).lineHeight : null,
        quoteBorder: cs(quote) ? cs(quote).borderLeftColor : null,
        quoteBg: cs(quote) ? cs(quote).backgroundColor : null,
        preBg: cs(pre) ? cs(pre).backgroundColor : null,
        preRadius: cs(pre) ? cs(pre).borderRadius : null,
        imgRadius: cs(img) ? cs(img).borderRadius : null,
        captionSize: cs(caption) ? cs(caption).fontSize : null,
        captionColor: cs(caption) ? cs(caption).color : null,
      };
    })()`);

    await tab.close();
    return measured;
  });
} catch (error) {
  browserError = error.message;
} finally {
  // 不论成败都销毁本次登录会话，不在后台的会话列表里留垃圾。
  if (facts.session_token) {
    php([FIXTURES, WP_ROOT, '--cleanup', facts.session_token]);
  }
}

const ink2 = hexToRgb(root['--yuki-ink-2']);
const primary = hexToRgb(root['--yuki-primary']);
const mutedBg = hexToRgb(root['--yuki-muted']);
const mutedFg = hexToRgb(root['--yuki-muted-foreground']);
const card = hexToRgb(root['--yuki-card']);

if (editor) {
  // 核心把主题编辑器样式内联进画布，不一定以 <link> 出现；能读到主题的 token
  // 就证明 style.css 的内容已经送达，这比认某一种标签形状更接近要验的事。
  check('编辑器画布里能读到主题的 token（style.css 已送达）',
    (editor.themePrimary || '').toUpperCase() === root['--yuki-primary'].toUpperCase(),
    `${editor.themePrimary ?? '未读到'} vs ${root['--yuki-primary']}`);
  check('画布宽度是 720px', editor.wrapperWidth !== null && Math.abs(editor.wrapperWidth - 720) <= 1,
    `${editor.wrapperWidth}px`);
  check('字体栈是主题的那一套', /Inter/.test(editor.wrapperFont || ''), editor.wrapperFont);
  check('画布字号 16px', editor.wrapperSize === '16px', editor.wrapperSize);
  check('画布行高 28px', editor.wrapperLine === '28px', editor.wrapperLine);
  check('画布正文颜色是 --yuki-ink-2（浅色）', editor.wrapperColor === ink2,
    `${editor.wrapperColor} vs ${ink2}`);
  check('段落字号与画布一致', editor.paraSize === '16px', editor.paraSize);
  check('段落行高与画布一致', editor.paraLine === '28px', editor.paraLine);
  check('引用左边是主色', editor.quoteBorder === primary, `${editor.quoteBorder} vs ${primary}`);
  check('引用底色是 --yuki-muted', editor.quoteBg === mutedBg, `${editor.quoteBg} vs ${mutedBg}`);
  check('代码块底色是 --yuki-card', editor.preBg === card, `${editor.preBg} vs ${card}`);
  check('代码块圆角 16px', editor.preRadius === '16px', editor.preRadius);
  check('图片圆角 16px', editor.imgRadius === '16px', editor.imgRadius);
  check('图注字号 13px', editor.captionSize === '13px', editor.captionSize);
  check('图注颜色是 --yuki-muted-foreground', editor.captionColor === mutedFg,
    `${editor.captionColor} vs ${mutedFg}`);
} else {
  // 工单约定的退路：登录自动化不成立时，至少用探针证明样式表被登记，并留下原因。
  note(`登录后的编辑器页面没能验完：${browserError}`);
  note('按工单约定退到 PHP 探针 + 人工目检；本脚本记录了退路原因。');
  check('退路：get_editor_stylesheets() 含 style.css', styleSheetPresent,
    facts.editor_stylesheets.join(', '));
}

report();
