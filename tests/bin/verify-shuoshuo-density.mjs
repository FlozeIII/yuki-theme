// 工单 08 的验收：说说归档的紧凑呈现。
//
// 只走 HTTP 加一次真浏览器测量：
//   - 版式是「哪一套」看 HTML（条目用了哪个 class、有没有缩略图、标题元素在不在）
//   - 「紧凑」与「不显得空旷」让浏览器量：每一条的高度、以及高度里有多少说不清来路的空处
//   - 深浅两色与窄屏同样在真浏览器里量，跟工单 03 那套一样
//
// 用法: node tests/bin/verify-shuoshuo-density.mjs
// 前置：本地站已在跑。造数会把「承载说说的分类」这个全站 theme mod 指向自己的分类，
// 所以第一个断言先回读归档页标题——不是这个分类就报「共享状态被别处改了」，
// 而不是让后面的版式断言以莫名其妙的方式红。

import path from 'node:path';
import { SITE, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, measure } from './browser.mjs';
import { themeCss, tokens, hexToRgb, contrast } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'shuoshuo-density-fixtures.php');

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}
const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const { shuoshuo_archive: SHUOSHUO, posts_archive: POSTS, tag_archive: TAG, date_archive: DATE } = facts;

const css = themeCss();
const rootTokens = tokens(css);
const darkTokens = tokens(css, '.dark');

const EXPECTED_ITEMS = facts.items.length + 1; // 带标题的几条，加上那条没标题的

/* ---------------- 解析 ---------------- */

/** 把列表区里每一条的印记切出来（按 <article ...> 分段）。 */
function itemsOf(html, className) {
  const out = [];
  const re = new RegExp(`<article class="[^"]*${className}[^"]*"[\\s\\S]*?</article>`, 'g');
  for (const m of html.matchAll(re)) out.push(m[0]);
  return out;
}

/* ================= 1. 说说归档：紧凑那套 ================= */

const archive = await get(SHUOSHUO);
const archiveBody = archive.body;

section('说说归档用紧凑版式');

check('归档页能打开', archive.status === 200, `status=${archive.status}`);
check('打开的是本脚本那个说说分类的归档（共享的 theme mod 没被别处改掉）',
  archiveBody.includes(facts.shuoshuo_name),
  archiveBody.includes(facts.shuoshuo_name) ? '' : `页面上找不到「${facts.shuoshuo_name}」——多半是别的会话把那个 theme mod 改到自己的分类了`);

const compact = itemsOf(archiveBody, 'yuki-shuoshuo-item');
const titled = facts.items.filter((item) => item.has_title);

check('条目用的是紧凑版式的类', compact.length === EXPECTED_ITEMS, `找到 ${compact.length} 条，应有 ${EXPECTED_ITEMS} 条`);
check('没有套用首页文章列表那套（yuki-post-item）', !archiveBody.includes('class="yuki-post-item"'));

check('每条短说说的全文都在（不是只剩一句摘要）',
  facts.items.every((item) => compact.some((html) => html.includes(item.marker))) &&
  compact.some((html) => html.includes(facts.untitled.marker)),
  [...facts.items, facts.untitled].map((i) => i.marker).join(', '));
check('短内容没有以省略号收尾（说明不是摘出来的）',
  !compact.some((html) => /…<\/p>|\.\.\.<\/p>/.test(html)));

check('条目不套用大缩略图（造数给每条都挂了图，这里一个都不该出现）',
  !compact.some((html) => /<img\b/.test(html)),
  `${compact.filter((h) => /<img\b/.test(h)).length} 条里有图`);

check('条目仍然可点：每条都有自己的链接',
  [...facts.items, facts.untitled].every((item) => compact.some((html) => html.includes(item.permalink))));
check('有标题的条目照常列出标题（工单 04 的「归档列得出说说」也是按标题找的）',
  titled.every((item) => compact.some((html) => html.includes(item.title))),
  titled.map((i) => i.title).join(', '));

{
  // 无标题那条：标题元素必须还在——屏幕阅读器靠标题层级跳读，没有标题元素的条目会被
  // 整个跳过；链接落在标题里的日期上，条目照样可点。
  const html = compact.find((h) => h.includes(facts.untitled.marker)) ?? '';
  check('无标题那条仍然有标题元素', /<h2 class="yuki-shuoshuo-title">/.test(html), html ? '' : '没找到那条');
  check('无标题那条的链接落在标题里的日期上',
    html.includes(facts.untitled.permalink) && /<time\b/.test(html));
  check('评论链接指向 #comments 锚点', compact.some((h) => /href="[^"]*#comments"/.test(h)));
}

{
  // 可评论：条目的链接落到文章页，那里有评论表单
  const one = await get(facts.items[0].permalink);
  check('链接落到文章页且评论表单在', one.status === 200 && /id="commentform"/.test(one.body), `status=${one.status}`);
}

/* ================= 2. 其他归档不受影响 ================= */

section('其他归档照旧');

const others = [
  ['正式文章的分类归档', POSTS],
  ['标签归档', TAG],
  ['日期归档', DATE],
  ['首页文章列表', SITE + '/'],
  ['搜索结果', facts.search_url],
  ['作者归档', facts.author_archive],
];

for (const [label, url] of others) {
  const page = await get(url);
  const items = itemsOf(page.body, 'yuki-post-item');
  check(`${label}仍用文章列表那套`, page.status === 200 && items.length > 0, `status=${page.status}，${items.length} 条`);
  check(`${label}没有被换成紧凑版式`, !page.body.includes('yuki-shuoshuo-item'));
  check(`${label}照旧带缩略图`, items.some((html) => /<img\b/.test(html)));
}

/* ================= 3. 真浏览器里量一量 ================= */

section('真浏览器里量一量');

// 量每一条，不只是第一条；深色下把标题、元信息、分隔线也一起量。
const READ_ITEMS = `(() => {
  const list = document.querySelector('.yuki-shuoshuo-list');
  const items = [...document.querySelectorAll('.yuki-shuoshuo-item')];
  const h = (el) => (el ? el.getBoundingClientRect().height : 0);
  return {
    dark: document.documentElement.classList.contains('dark'),
    page: getComputedStyle(document.body).backgroundColor,
    listWidth: list ? list.getBoundingClientRect().width : 0,
    items: items.map((item) => {
      const body = item.querySelector('.yuki-shuoshuo-body');
      const meta = item.querySelector('.yuki-shuoshuo-meta');
      const title = item.querySelector('.yuki-shuoshuo-title');
      const cs = getComputedStyle(item);
      const box = item.getBoundingClientRect();
      return {
        height: box.height,
        width: box.width,
        pad: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom),
        titleHeight: h(title),
        bodyHeight: h(body),
        metaHeight: h(meta),
        title: title ? getComputedStyle(title).color : '',
        body: body ? getComputedStyle(body).color : '',
        meta: meta ? getComputedStyle(meta).color : '',
        border: cs.borderBottomColor,
        borderStyle: cs.borderBottomStyle,
        text: item.textContent.trim().length,
      };
    }),
  };
})()`;

const READ_FIRST_POST_ITEM = `(() => {
  const item = document.querySelector('.yuki-post-item');
  return item ? { height: item.getBoundingClientRect().height } : null;
})()`;

/** 条目高度里「说不清来路」的那部分：内容与内边距之外还剩多少（行高和外边距的余量）。 */
const slackOf = (item) => item.height - item.pad - item.titleHeight - item.bodyHeight - item.metaHeight;

const seen = await withBrowser(async (browser) => ({
  light: await measure(browser, SHUOSHUO, { colorScheme: 'light', expression: READ_ITEMS }),
  dark: await measure(browser, SHUOSHUO, { colorScheme: 'dark', expression: READ_ITEMS }),
  narrow: await measure(browser, SHUOSHUO, { colorScheme: 'light', width: 375, height: 900, expression: READ_ITEMS }),
  posts: await measure(browser, POSTS, { colorScheme: 'light', expression: READ_FIRST_POST_ITEM }),
}));

const lightItems = seen.light?.items ?? [];
const darkItems = seen.dark?.items ?? [];
const narrowItems = seen.narrow?.items ?? [];

check('量到了每一条说说', lightItems.length === EXPECTED_ITEMS, `量到 ${lightItems.length} 条，应有 ${EXPECTED_ITEMS} 条`);

// 顺带量一下文章列表条目做对照。不当断言：两边文案长度不同，差几十像素说明不了什么，
// 「紧凑」由上面两条（无缩略图 + 高度都说得清来路）承担。
if (seen.posts) {
  note(`对照：文章列表条目 ${Math.round(seen.posts.height)}px，说说条目 ${lightItems.map((i) => Math.round(i.height)).join('/')}px`);
}

check('每一条的高度都说得清来路：内容与内边距之外几乎没有多余空处',
  lightItems.every((item) => slackOf(item) >= -1 && slackOf(item) <= 30),
  lightItems.map((i) => `${i.text} 字余 ${slackOf(i).toFixed(0)}px`).join('，'));

check('正文字色就是 --yuki-ink-2',
  lightItems.length > 0 && lightItems.every((item) => item.body === hexToRgb(rootTokens['--yuki-ink-2'])),
  lightItems[0] ? `实测 ${lightItems[0].body}，token ${rootTokens['--yuki-ink-2']}` : '');
check('标题与元信息用的是主题那两档文字色',
  lightItems.length > 0
  && lightItems.every((item) => item.title === hexToRgb(rootTokens['--yuki-foreground']))
  && lightItems.every((item) => item.meta === hexToRgb(rootTokens['--yuki-muted-foreground'])),
  lightItems[0] ? `标题 ${lightItems[0].title} / 元信息 ${lightItems[0].meta}` : '');
// 最后一条按设计没有下边框（:last-child 去掉），它的 borderBottomColor 是 currentColor，
// 不是 token——只查真有边框的那些
const bordered = lightItems.filter((item) => item.borderStyle !== 'none');
check('项间分隔线用的是 --yuki-border',
  bordered.length > 0 && bordered.every((item) => item.border === hexToRgb(rootTokens['--yuki-border'])),
  `查了 ${bordered.length} 条，实测 ${bordered[0]?.border ?? '（没有带边框的条目）'}`);
check('浅色下按实测颜色算的正文对比度 ≥ 4.5',
  lightItems.length > 0 ? contrast(lightItems[0].body, seen.light.page) >= 4.5 : false,
  lightItems[0] ? `${contrast(lightItems[0].body, seen.light.page).toFixed(2)}:1（${lightItems[0].body} on ${seen.light.page}）` : '');

check('深色模式下主题走的是深色那条分支', seen.dark?.dark === true, `html.dark=${seen.dark?.dark}`);
check('深色下页面底色就是 --yuki-background',
  seen.dark?.page === hexToRgb(darkTokens['--yuki-background']),
  `实测 ${seen.dark?.page}，token ${darkTokens['--yuki-background']}`);
check('深色下正文、标题、元信息、分隔线都是深色那套 token',
  darkItems.length > 0
  && darkItems.every((item) => item.body === hexToRgb(darkTokens['--yuki-ink-2']))
  && darkItems.every((item) => item.title === hexToRgb(darkTokens['--yuki-foreground']))
  && darkItems.every((item) => item.meta === hexToRgb(darkTokens['--yuki-muted-foreground']))
  && darkItems.filter((item) => item.borderStyle !== 'none').every((item) => item.border === hexToRgb(darkTokens['--yuki-border'])),
  darkItems[0] ? `正文 ${darkItems[0].body} / 标题 ${darkItems[0].title} / 元信息 ${darkItems[0].meta} / 分隔线 ${darkItems[0].border}` : '');
check('深色下按实测颜色算的正文对比度 ≥ 4.5',
  darkItems.length > 0 ? contrast(darkItems[0].body, seen.dark.page) >= 4.5 : false,
  darkItems[0] ? `${contrast(darkItems[0].body, seen.dark.page).toFixed(2)}:1（${darkItems[0].body} on ${seen.dark.page}）` : '');

check('375px 下每一条都没有溢出列表',
  narrowItems.length > 0 && narrowItems.every((item) => item.width <= seen.narrow.listWidth + 1),
  narrowItems[0] ? `条目 ${narrowItems[0].width.toFixed(0)}px / 列表 ${seen.narrow.listWidth.toFixed(0)}px` : '没读到');
check('375px 下每一条仍然是紧凑的一小条',
  narrowItems.length > 0 && narrowItems.every((item) => item.height <= 200),
  narrowItems.map((i) => `${Math.round(i.height)}px`).join('/'));

note(`说说归档 ${SHUOSHUO}`);
report();
