// 工单 03 的验收：评论区的层级与样式。
//
// 层级那几条走 HTTP：请求进去、HTML 出来，断言的是**渲染出来的层级**（li 上的 depth-N
// 与 children 容器的嵌套），不是某个函数返回了什么。
//
// 样式那几条只能静态读 style.css，因为「有没有硬编码色值」「深色下读不读得清」在 HTML 里
// 看不出来——浏览器算完之后的颜色得真浏览器才算得准。这里退一步断言契约：评论区只用
// token（色值只准出现在 token 定义块里），用到的颜色 token 深浅两套都定义过，且正文那对
// 「字色 / 背景」在两种模式下都够对比度。
//
// 用法: node tests/bin/verify-comment-nesting.mjs
// 前置：本地站已在跑；造数脚本自己会建一条四层深的回复链。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, WP_ROOT, get, php, postForm, tagAttrs } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, measure } from './browser.mjs';
import { themeCss, cssBlock, tokens, usedTokens, isColor, hexToRgb, contrast } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'comment-nesting-fixtures.php');
const RUN = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}
const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const { post_url: POST_URL, ids: IDS, authors: AUTHORS } = facts;

const page = await get(POST_URL);

/* ---------------- 解析 ---------------- */

/** 每条评论的 li：id、class（里面有 depth-N）、以及它自己那一段 HTML。 */
function parseComments(html) {
  const items = [];
  const re = /<li id="comment-(\d+)" class="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    items.push({ id: Number(m[1]), cls: m[2], at: m.index });
  }
  for (let i = 0; i < items.length; i++) {
    // 这条评论自己那一段：li 开到它自己的 </article> 为止。子回复的 <li> 排在这个 </article>
    // 之后，所以这一段正好是「元信息 + 正文 + 回复链接」，不含子回复；而截到页面末尾会把
    // 表单里的 cancel-comment-reply-link 之类一并卷进来，断言就会误报。
    const close = html.indexOf('</article>', items[i].at);
    const next = i + 1 < items.length ? items[i + 1].at : html.length;
    const end = close > 0 && close < next ? close + '</article>'.length : next;
    items[i].html = html.slice(items[i].at, end);
    items[i].depth = Number(/depth-(\d+)/.exec(items[i].cls)?.[1] ?? 0);
  }
  return items;
}

const comments = parseComments(page.body);
const byId = (id) => comments.find((c) => c.id === id);

/* ---------------- style.css ---------------- */

const css = themeCss();

const rootTokens = tokens(css);
const darkTokens = tokens(css, '.dark');

// 评论区那一段：从「评论」这条分节标题起，到下一个分节标题为止
const sectionStart = css.indexOf('评论\n   ============================================');
const nextSection = css.indexOf('/* ============================================', sectionStart);
const commentCss = sectionStart < 0 ? '' : css.slice(sectionStart, nextSection < 0 ? css.length : nextSection);
// 提交按钮的规则共用一处，也算评论区的一部分
const buttonCss = cssBlock( css, '.yuki-btn');
const commentStyles = commentCss + '\n' + buttonCss;

/* ================= 1. 层级压在两层 ================= */

section('层级压在两层');

check('文章页能打开', page.status === 200, `status=${page.status}`);
check('找到了造出来的评论', comments.length >= 5, `解析到 ${comments.length} 条`);

check('顶层评论渲染在 depth-1',
  [IDS.L1, IDS.LONE].every((id) => byId(id)?.depth === 1),
  [IDS.L1, IDS.LONE].map((id) => `#${id}=depth-${byId(id)?.depth}`).join(' '));

check('第二层回复渲染在 depth-2',
  [IDS.L2, IDS.L3, IDS.L4].every((id) => byId(id)?.depth === 2),
  [IDS.L2, IDS.L3, IDS.L4].map((id) => `#${id}=depth-${byId(id)?.depth}`).join(' '));

const deepest = Math.max(...comments.map((c) => c.depth));
check('没有任何评论比第二层更深', deepest <= 2, `最深 depth-${deepest}`);

const childrenLists = (page.body.match(/class="children"/g) || []).length;
check('children 容器只有一层（不再往深处套）', childrenLists === 1, `出现 ${childrenLists} 次`);

const order = [IDS.L1, IDS.L2, IDS.L3, IDS.L4, IDS.LONE].map((id) => comments.findIndex((c) => c.id === id));
check('顺序没被打乱：顶层在前、压平的三条跟在二层后面、独苗顶层仍在最后',
  order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order.join(' < '));

check('被压平的是最深的两次回复（L3/L4），不是顶层',
  byId(IDS.L3)?.depth === 2 && byId(IDS.L4)?.depth === 2 && byId(IDS.L1)?.depth === 1);

/* ================= 2. 不靠缩进也知道谁在回复谁 ================= */

section('不靠缩进也知道谁在回复谁');

const indicator = (id) => /回复\s*@\s*([^\s<]+)/.exec(byId(id)?.html ?? '')?.[1] ?? '';

check('二层回复标出它回的是顶层甲', indicator(IDS.L2) === AUTHORS.L1, `实际「${indicator(IDS.L2)}」`);
check('被压平的三层回复标出它回的是二层乙', indicator(IDS.L3) === AUTHORS.L2, `实际「${indicator(IDS.L3)}」`);
check('被压平的四层回复标出它回的是三层丙', indicator(IDS.L4) === AUTHORS.L3, `实际「${indicator(IDS.L4)}」`);
check('顶层评论不标「回复 @」', indicator(IDS.L1) === '' && indicator(IDS.LONE) === '');

/* ================= 3. 回复这条路没被堵死 ================= */

section('回复这条路没被堵死');

check('第二层的评论上仍有回复链接', /comment-reply-link/.test(byId(IDS.L2)?.html ?? ''));

// 主题自己渲染每条评论之后，pingback 这类非 comment 类型也得照旧出得来（核心默认不短印）
check('pingback 照旧渲染出来，作者与正文都在',
  (byId(IDS.PING)?.html ?? '').includes(facts.ping_author) &&
  (byId(IDS.PING)?.html ?? '').includes('YUKI-TEST-NEST-PING'),
  byId(IDS.PING) ? `depth-${byId(IDS.PING).depth}` : '（没找到这条评论）');
check('页面上没有 PHP 报错漏出来', !/Fatal error|Warning:|Notice:/i.test(page.body));

const jsContract = [
  ['评论容器 id（回复 JS 靠它定位）', `id="comment-${IDS.L2}"`],
  ['评论体 id（回复表单插在它后面）', `id="div-comment-${IDS.L2}"`],
  ['父评论字段', /name=['"]comment_parent['"]/],
  ['表单 id', 'id="commentform"'],
  ['回复区 id', 'id="respond"'],
];
for (const [what, needle] of jsContract) {
  const found = needle instanceof RegExp ? needle.test(page.body) : page.body.includes(needle);
  check(`comment-reply.js 要的：${what}`, found, String(needle));
}

/* ================= 4. 走表单回一条，落到第二层 ================= */

section('新回复也压到第二层');

/** 取 #commentform 里实际有的字段，改掉几个再交回去（表单是访客真正提交的那个）。 */
async function submitReply(targetUrl, { parent, comment, author, email }) {
  const page = await get(targetUrl);
  const form = page.body.match(/<form[^>]*\bid\s*=\s*["']commentform["'][\s\S]*?<\/form>/i)?.[0] ?? '';
  const fields = {};
  for (const m of form.matchAll(/<input\b[^>]*>/gi)) {
    const a = tagAttrs(m[0]);
    const type = (a.type || 'text').toLowerCase();
    if (!a.name || ['submit', 'button', 'reset'].includes(type)) continue;
    if (type === 'checkbox' && !('checked' in a)) continue;
    fields[a.name] = a.value ?? '';
  }
  for (const m of form.matchAll(/<textarea\b[^>]*>/gi)) {
    const a = tagAttrs(m[0]);
    if (a.name) fields[a.name] = '';
  }
  fields.comment = comment;
  if ('author' in fields) fields.author = author;
  if ('email' in fields) fields.email = email;
  fields.comment_parent = String(parent);

  // 防垃圾的时间戳窗口是 3 秒：表单取回来马上交，会被判成机器人
  await sleep(3300);
  return postForm(new URL(tagAttrs(form.match(/<form\b[^>]*>/i)?.[0] ?? '').action || `${SITE}/wp-comments-post.php`, targetUrl).href, fields);
}

const replyMarker = `YUKI-TEST-NEST-NEW-${RUN}`;
const replyRes = await submitReply(POST_URL, {
  parent: IDS.L2,
  comment: `${replyMarker} 回二层乙的一条新回复。`,
  // 作者名要与那位「回头客」一致：check_comment() 是按「作者名 + 邮箱」认老读者的，
  // 只对上邮箱这条回复会进待审队列，而访客身份看不到待审评论
  author: AUTHORS.L1,
  email: facts.known_email,
});
check('回复提交被接受', /#comment-\d+/.test(replyRes.location), `status=${replyRes.status} location=${replyRes.location || '（无）'}`);

const afterBody = (await get(POST_URL)).body;
const afterComments = parseComments(afterBody);
const newReply = afterComments.find((c) => c.html.includes(replyMarker));
check('新回复渲染在第二层，没有继续往下缩进', newReply?.depth === 2, `depth-${newReply?.depth ?? '（没找到）'}`);
check('新回复标出它回的是二层乙', /回复\s*@\s*二层乙/.test(newReply?.html ?? ''));
check('新回复也落在同一层，没有多出一层缩进',
  (afterBody.match(/class="children"/g) || []).length === 1,
  `${(afterBody.match(/class="children"/g) || []).length} 个 children 容器`);

/* ================= 5. 样式只用 token ================= */

section('样式只用 token');

// 命名色后面不能紧跟 - 或字母：`white-space: nowrap` 里的 white 不是颜色。
// 这一条踩过一次——写了 \b 就够，结果 `white-space` 让它误报。
const literals = [...commentStyles.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)|\b(?:white|black|red|blue|green|gray|grey|orange|yellow)(?![\w-])/g)]
  .map((m) => m[0]);
check('评论区里没有硬编码色值', literals.length === 0, literals.join(', '));

const tokensUsed = usedTokens(commentStyles);
const undefinedTokens = tokensUsed.filter((t) => !(t in rootTokens));
check('评论区用到的 token 都在 :root 里定义过', undefinedTokens.length === 0, undefinedTokens.join(', '));

const colorTokens = tokensUsed.filter((t) => isColor(rootTokens[t] ?? ''));
const missingInDark = colorTokens.filter((t) => !(t in darkTokens));
check('用到的颜色 token 在 .dark 里也定义了（否则深色下会是浅色那套值）',
  missingInDark.length === 0, missingInDark.join(', '));

/* ================= 6. 深色下的对比度 ================= */

section('深色下读得清');

const contentColorToken = /color\s*:\s*var\((--[\w-]+)\)/.exec(cssBlock( css, '.yuki-comment-list .comment-content'))?.[1];
const bodyBgToken = /background(?:-color)?\s*:\s*var\((--[\w-]+)\)/.exec(cssBlock( css, '.yuki-comment-list .comment-body'))?.[1];
check('能认出评论正文用的字色与卡片底色', !!contentColorToken && !!bodyBgToken, `${contentColorToken} / ${bodyBgToken}`);

// 认不出 token 就不硬算——上面那条已经红了，这里再崩掉只会让报告看不清
if (contentColorToken && bodyBgToken) {
  for (const [mode, tokens] of [['浅色', rootTokens], ['深色', darkTokens]]) {
    const ratio = contrast(tokens[contentColorToken], tokens[bodyBgToken]);
    check(`${mode}下评论正文对比度 ≥ 4.5`, ratio >= 4.5, `${ratio.toFixed(2)}:1（${tokens[contentColorToken]} on ${tokens[bodyBgToken]}）`);
  }
}

/* ================= 7. 评论表单接上了主题样式 ================= */

section('评论表单接上了主题样式');

const formTag = page.body.match(/<form\b[^>]*commentform[^>]*>/i)?.[0] ?? '';
check('表单带上了主题的类（否则输入框那几条规则落不到实处）',
  /class="[^"]*yuki-comment-form/.test(formTag), formTag.slice(0, 120));
check('输入框规则与表单的类对得上', /\.yuki-comment-form\s+input/.test(css));

/* ================= 8. 窄屏不被缩进挤成一条缝 ================= */

section('窄屏不被缩进挤成一条缝');

const childrenPad = /padding-left\s*:\s*(\d+)px/.exec(cssBlock( css, '.yuki-comment-list .children'))?.[1];
check('二层缩进存在且不大', childrenPad !== undefined && Number(childrenPad) <= 32, `${childrenPad}px`);

/** 取出所有 @media 块。按花括号配对，单行写法和多行写法都认。 */
function mediaBlocks(text) {
  const out = [];
  for (let i = text.indexOf('@media'); i >= 0; i = text.indexOf('@media', i + 1)) {
    const open = text.indexOf('{', i);
    let depth = 0;
    let j = open;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}' && --depth === 0) break;
    }
    out.push({ cond: text.slice(i, open).trim(), body: text.slice(open + 1, j) });
  }
  return out;
}

// 找一个窄屏块，里面把二层缩进调小了
const narrow = mediaBlocks(css)
  .filter((b) => /max-width/i.test(b.cond) && /yuki-comment-list\s+\.children/.test(b.body))
  .map((b) => ({ cond: b.cond, pad: /padding-left\s*:\s*(\d+)px/.exec(b.body)?.[1] }))
  .find((b) => b.pad !== undefined);
check('窄屏有单独的媒体查询把二层缩进收窄', narrow !== undefined,
  narrow ? `${narrow.cond} 时 padding-left: ${narrow.pad}px` : '没找到收窄缩进的窄屏媒体查询');
check('窄屏缩进比宽屏更小', narrow !== undefined && Number(narrow.pad) < Number(childrenPad),
  `${childrenPad}px → ${narrow?.pad ?? '（没写）'}px`);

/* ================= 9. 待审那条：核心的两处行为要留住 ================= */

// 主题自己渲染评论之后，核心在 start_el 里挂的两处行为得自己补：待审提示，以及
// 对非作者剥掉正文里的 HTML（下面的临时过滤器）。用管理员身份看自己那条未过审的评论——
// 核心本来就会把它放进列表，所以这条路是真的。
{
  // 登录用的 cookie 罐：这次要带身份请求同一个页面
  const jar = new Map();
  const store = (res) => {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  };
  // lib.mjs 的 get()/postForm() 现在收一个 cookie 参数，别再手工拼头了
  // （手工拼过两次：postForm 以前是整体替换 headers，漏了 content-type 就静默登录失败）
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

  store(await get(`${SITE}/wp-login.php`));
  store(await postForm(`${SITE}/wp-login.php`, {
    log: 'admin', pwd: 'admin123', 'wp-submit': 'Log In', redirect_to: `${SITE}/wp-admin/`, testcookie: '1',
  }, { cookie: cookie() }));

  const asAdmin = (await get(POST_URL, { cookie: cookie() })).body;
  const adminPending = parseComments(asAdmin).find((c) => c.id === IDS.ADMINPEND);

  section('待审那条（管理员看自己未过审的）');
  check('能看到自己那条未过审的评论', adminPending !== undefined);
  check('显示待审提示', /正在等待审核/.test(adminPending?.html ?? ''));
  check('正文里的标签被剥掉，文字还在',
    (adminPending?.html ?? '').includes('YUKI-TEST-NEST-ADMINPEND') && !/<b>YUKI-TEST-NEST-ADMINPEND/.test(adminPending?.html ?? ''),
    adminPending ? '' : '（没找到这条评论）');
  check('待审那条不给回复链接', !/comment-reply-link/.test(adminPending?.html ?? ''));
}

/* ================= 10. 真浏览器里量一量 ================= */

// 上面两组样式断言读的是 CSS 文本，说的是「契约」；这一段让浏览器真算一遍：
// 深色下评论卡片到底是不是那套值、对比度够不够、窄屏下第二层被缩进挤掉了多少。
// 深浅色走 CDP 的 prefers-color-scheme，走的是主题自己的那条分支，不是塞个 class 假装。

section('真浏览器里量一量');


const READ_NARROW = `(() => {
  const first = document.querySelector('.yuki-comment-list > li > .comment-body');
  const second = document.querySelector('.yuki-comment-list > li > .children > li > .comment-body');
  if (!first || !second) return null;
  return {
    viewport: window.innerWidth,
    first: first.getBoundingClientRect().width,
    second: second.getBoundingClientRect().width,
  };
})()`;

const READ_CARD = `(() => {
  const card = document.querySelector('.yuki-comment-list .comment-body');
  const content = document.querySelector('.yuki-comment-list .comment-content');
  if (!card || !content) return null;
  return {
    dark: document.documentElement.classList.contains('dark'),
    bg: getComputedStyle(card).backgroundColor,
    fg: getComputedStyle(content).color,
  };
})()`;

try {
  const seenByScheme = await withBrowser(async (browser) => ({
    light: await measure(browser, POST_URL, { colorScheme: 'light', expression: READ_CARD }),
    dark: await measure(browser, POST_URL, { colorScheme: 'dark', expression: READ_CARD }),
    narrow: await measure(browser, POST_URL, { colorScheme: 'light', width: 375, height: 900, expression: READ_NARROW }),
  }));

  for (const scheme of ['light', 'dark']) {
    {
      const tokens = scheme === 'dark' ? darkTokens : rootTokens;
      const label = scheme === 'dark' ? '深色' : '浅色';
      const seen = seenByScheme[scheme];

      check(`${label}模式下主题走的是那一条分支`, seen?.dark === (scheme === 'dark'), `html.dark=${seen?.dark}`);
      check(`${label}下评论卡片底色就是 ${tokens['--yuki-card']}`,
        seen?.bg === hexToRgb(tokens['--yuki-card']), `实测 ${seen?.bg}`);
      check(`${label}下评论正文颜色就是 ${tokens['--yuki-ink-2']}`,
        seen?.fg === hexToRgb(tokens['--yuki-ink-2']), `实测 ${seen?.fg}`);
      check(`${label}下按实测颜色算的正文对比度 ≥ 4.5`,
        seen ? contrast(seen.fg, seen.bg) >= 4.5 : false,
        seen ? `${contrast(seen.fg, seen.bg).toFixed(2)}:1（${seen.fg} on ${seen.bg}）` : '没读到卡片');
    }

    const widths = seenByScheme.narrow;

    check('375px 下两层卡片都还在', !!widths, widths ? `视口 ${widths.viewport}` : '没读到卡片');
    check('第二层只比第一层窄一个缩进（不被挤成一条缝）',
      widths ? widths.first - widths.second <= 24 : false,
      widths ? `第一层 ${widths.first.toFixed(0)}px → 第二层 ${widths.second.toFixed(0)}px` : '');
    check('第二层卡片仍有第一层九成以上宽',
      widths ? widths.second >= widths.first * 0.9 : false,
      widths ? `${((widths.second / widths.first) * 100).toFixed(0)}%` : '');
  }
} catch (err) {
  check('能起一个无头浏览器来量', false, err.message);
}

note(`页面 ${POST_URL}`);
note(`style.css 评论区片段 ${commentCss.length} 字符，用到 ${tokensUsed.length} 个 token`);
report();
