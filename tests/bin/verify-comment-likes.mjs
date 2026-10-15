// 工单 06 的验收：评论点赞。
//
// seam 和别处一样只有 HTTP：请求进去、HTML 出来。计数存在哪个元数据键里、访客标识怎么
// 算出来、端点是 REST 还是 admin-ajax，一律不看——看的是「页面上显示几个赞」「端点回什么」
// 「换个访客还认不认得出我点过」。
//
// 「不刷新页面」这条 HTTP 面验不了（不刷新正是它要证明的事），所以那一节用无头 Edge
// 点真的按钮，并用一个页面变量证明中途没有重新加载。
//
// 访客身份是 cookie，所以这里自己管一个 cookie 罐：第一次点赞从 Set-Cookie 里取，
// 之后的请求带上它——「同一个人」和「另一个人」就是这么造出来的。
//
// 用法: node tests/bin/verify-comment-likes.mjs

import { SITE, get, probeScript } from './lib.mjs';
import { check, note, report, section } from './report.mjs';
import { themeCss, tokens, usedTokens, isColor, hexToRgb, contrast } from './theme-css.mjs';
import { launch, newPage } from './browser.mjs';

const FX = 'comment-likes-fixtures.php';
const fx = (...args) => probeScript(FX, ...args);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 探针失败也记成一次断言失败，而不是让整轮验收崩掉。 */
const tryFx = (...args) => {
  try {
    return fx(...args);
  } catch (err) {
    return { error: err.message };
  }
};

/**
 * 页面里每条评论的点赞控件，按评论 id 索引。
 *
 * 认的是 button 标签而不是「页面上出现过 yuki-like 这几个字」：脚本的 handle 也叫
 * yuki-comment-likes，按字符串数会把 <script> 也算进去。
 */
function likeButtons(html) {
  const out = {};

  for (const m of html.matchAll(/<button[^>]*class="yuki-like[^"]*"[^>]*>[\s\S]*?<\/button>/g)) {
    const tag = m[0].match(/^<button[^>]*>/)[0];
    const id = (tag.match(/data-comment-id="(\d+)"/) || [])[1];
    if (!id) continue;

    const count = (m[0].match(/<span class="yuki-like-count">([^<]*)<\/span>/) || [])[1] || '';

    out[id] = {
      tag: tag.replace(/\s+/g, ' '),
      liked: /aria-pressed="true"/.test(tag),
      count: Number(count.replace(/[^0-9]/g, '')),
      html: m[0],
    };
  }

  return out;
}

/** 点赞端点的调用。cookie 为空就不带——那就是「另一位访客」。 */
async function like(endpoint, commentId, liked, cookie = '') {
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ comment_id: commentId, liked }),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 不是 JSON 就留着 null，断言那边会看出来 */
  }

  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];

  return {
    status: response.status,
    text,
    json,
    // 只取 `名字=值`，后面的 Path/HttpOnly 那些用不着
    visitor: (setCookies.find((c) => c.startsWith('yuki_visitor=')) || '').split(';')[0],
  };
}

/** 点赞 / 取消，并把状态收成一句好读的明细。 */
const describe = (result) => `HTTP ${result.status} ${result.text.slice(0, 80)}`;

/** 拿页面，顺带把点赞控件解出来。 */
async function pageWith(postUrl, cookie = '') {
  const response = await get(postUrl, cookie ? { headers: { cookie } } : {});
  return { ...response, likes: likeButtons(response.body) };
}

/** 在页面里轮询一个表达式，直到它满足条件（浏览器里的异步动作要用）。 */
async function waitFor(page, expression, done, tries = 40) {
  let last = null;

  for (let i = 0; i < tries; i++) {
    last = await page.evaluate(expression);
    if (done(last)) return last;
    await sleep(100);
  }

  return last;
}

/** 轮询一个「去问服务器」的取数函数，直到它满足条件。 */
async function waitForServer(probe, done, tries = 30) {
  let last = null;

  for (let i = 0; i < tries; i++) {
    last = await probe();
    if (done(last)) return last;
    await sleep(100);
  }

  return last;
}

/** style.css 里选择器提到某段文字的那些规则。 */
function rulesMentioning(css, needle) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].includes(needle))
    .map((m) => `${m[1].trim()} {${m[2].trim()}}`);
}

/* ================= 0. 前提 ================= */

section('前提');

const setup = tryFx('setup');
check('造数成功（三条已过审 + 一条待审）', !setup.error && (setup.comments || []).length === 3, setup.error || `评论 ${JSON.stringify(setup.comments)}`);

if (setup.error || (setup.comments || []).length < 3) {
  note('造数失败，后面的断言没有意义，就此打住');
  report();
}

const postUrl = setup.post_url;
const endpoint = setup.endpoint;
const [A, B, C] = setup.comments;
const pendingId = (setup.pending || [])[0];

check('拿到文章与端点地址', Boolean(postUrl) && Boolean(endpoint), `${postUrl} / ${endpoint}`);

const first = await pageWith(postUrl);

check('文章页正常返回', first.status === 200, `实际 ${first.status}`);
check('三条评论都在页面上', [A, B, C].every((id) => first.body.includes(`id="comment-${id}"`)), `找到 ${[A, B, C].filter((id) => first.body.includes(`id="comment-${id}"`)).length}/3 条`);
check('每条评论都带一个点赞控件', [A, B, C].every((id) => first.likes[id]), `找到 ${Object.keys(first.likes).length} 个控件`);
check('起手三条的计数都是 0', [A, B, C].every((id) => first.likes[id] && first.likes[id].count === 0), [A, B, C].map((id) => first.likes[id]?.count).join('/'));

/*
 * 端点地址得由页面交给浏览器。这条不只是核对一个字符串：脚本拿不到地址就点不动，
 * 而「地址从哪来」正是固定链接设置会改变的东西，所以它由 PHP 算、不能写死在脚本里。
 */
const pageConfig = (first.body.match(/var yukiCommentLikes = (\{[^;]*\});/) || [])[1];
let configured = '';
try {
  configured = JSON.parse(pageConfig || '{}').endpoint || '';
} catch {
  /* 解析不了就当空，下面的断言会说清楚 */
}
check('页面把端点地址交给了脚本', configured === endpoint, `配置里是 ${configured || '(没有)'}，主题注册的是 ${endpoint}`);

/* ---- 待审评论上没有点赞入口 ---- */

/*
 * 待审评论只有它的作者本人看得到（核心的评论 cookie），所以要带那个 cookie 才看得见它，
 * 也才验得到「即使看得见，它上面也没有点赞入口」。
 */
const cookieHash = setup.cookie_hash || '';
let pendingBody = '';

if (cookieHash && pendingId) {
  const pendingPage = await get(postUrl, {
    headers: { cookie: `comment_author_email_${cookieHash}=${encodeURIComponent('likes-pending@example.test')}; comment_author_${cookieHash}=${encodeURIComponent('YUKI-LIKES 待审者')}` },
  });
  pendingBody = pendingPage.body;
}

/*
 * 两条**分开**断言，不合成一条：一条验「待审评论看得到」，一条验「它上面没有点赞控件」。
 * 合成一条的话，「看得到」那半坏了会以「没有控件」的名义红，看的人得去猜是哪边的问题。
 */
const pendingSeen = pendingBody.includes(`id="comment-${pendingId}"`);
const pendingLikeButtons = pendingId in likeButtons(pendingBody) ? 1 : 0;

check('带作者 cookie 时看得到那条待审评论', pendingSeen, pendingId ? `待审评论 ${pendingId}` : '(造数没有待审评论)');
check('待审评论上没有点赞控件', pendingLikeButtons === 0, `待审评论可见=${pendingSeen}，上面找到 ${pendingLikeButtons} 个控件`);

/* ================= 1. 点赞 ================= */

section('点赞');

const likeA = await like(endpoint, A, true);
check('点赞返回 200', likeA.status === 200, describe(likeA));
check('点赞后计数加一', likeA.json && likeA.json.count === 1, JSON.stringify(likeA.json));
check('响应里说自己是已点赞', likeA.json && likeA.json.liked === true, JSON.stringify(likeA.json));
check('点赞给了这位访客一个标识（cookie）', likeA.visitor.startsWith('yuki_visitor='), likeA.visitor || '(没有 Set-Cookie)');

const cookieA = likeA.visitor;

const afterLikeA = await pageWith(postUrl, cookieA);
const afterLikeANoCookie = await pageWith(postUrl);

check('页面上评论 1 的计数变成 1', afterLikeA.likes[A]?.count === 1, `页面上是 ${afterLikeA.likes[A]?.count}`);
check('页面上这位访客看到的是「已点赞」', afterLikeA.likes[A]?.liked === true, afterLikeA.likes[A]?.tag);
check('不带 cookie 的访客也看得到那个 1', afterLikeANoCookie.likes[A]?.count === 1, `页面上是 ${afterLikeANoCookie.likes[A]?.count}`);
check('不带 cookie 的访客状态是「未点赞」', afterLikeANoCookie.likes[A]?.liked === false, afterLikeANoCookie.likes[A]?.tag);
check(
  '点赞一条不影响别的评论',
  afterLikeANoCookie.likes[B]?.count === 0 && afterLikeANoCookie.likes[C]?.count === 0,
  `评论 2/3 分别是 ${afterLikeANoCookie.likes[B]?.count}/${afterLikeANoCookie.likes[C]?.count}`,
);

/* ================= 2. 同一访客只计一次 ================= */

section('同一访客');

const again1 = await like(endpoint, A, true, cookieA);
check('同一位访客再点一次，计数不动', again1.json && again1.json.count === 1, JSON.stringify(again1.json));

await like(endpoint, A, true, cookieA);
const again3 = await like(endpoint, A, true, cookieA);
check('连点三次也只算一个赞', again3.json && again3.json.count === 1, JSON.stringify(again3.json));

const pageAgain = await pageWith(postUrl, cookieA);
check('页面上仍然只有一个赞', pageAgain.likes[A]?.count === 1, `页面上是 ${pageAgain.likes[A]?.count}`);

/* ================= 3. 另一位访客 ================= */

section('另一位访客');

const likeB = await like(endpoint, A, true, '');
check('另一位访客的第一次点赞也拿到标识', likeB.status === 200 && likeB.visitor.startsWith('yuki_visitor='), `${describe(likeB)} ${likeB.visitor}`);
check('另一位访客点同一条，计数加到 2', likeB.json && likeB.json.count === 2, JSON.stringify(likeB.json));

const cookieB = likeB.visitor;
const pageB = await pageWith(postUrl, cookieB);
const pageA2 = await pageWith(postUrl, cookieA);

check('B 看到的是已点赞', pageB.likes[A]?.liked === true, pageB.likes[A]?.tag);
check('A 看到的也是已点赞', pageA2.likes[A]?.liked === true, pageA2.likes[A]?.tag);
check('两位访客看到同一个计数', pageA2.likes[A]?.count === 2 && pageB.likes[A]?.count === 2, `A 看到 ${pageA2.likes[A]?.count}，B 看到 ${pageB.likes[A]?.count}`);

/* ---- 取消只减自己那一份 ---- */

const unlikeA = await like(endpoint, A, false, cookieA);
check('A 取消之后计数减到 1（B 的那一份还在）', unlikeA.json && unlikeA.json.count === 1, JSON.stringify(unlikeA.json));

const pageAfterUnlikeA = await pageWith(postUrl, cookieA);
check('A 的页面上状态回到未点赞', pageAfterUnlikeA.likes[A]?.liked === false, pageAfterUnlikeA.likes[A]?.tag);
check('A 的页面上计数是 1', pageAfterUnlikeA.likes[A]?.count === 1, `页面上是 ${pageAfterUnlikeA.likes[A]?.count}`);

const unlikeA2 = await like(endpoint, A, false, cookieA);
check('没点过的时候取消，计数不动', unlikeA2.json && unlikeA2.json.count === 1, JSON.stringify(unlikeA2.json));

const unlikeB = await like(endpoint, A, false, cookieB);
check('B 取消之后计数归零', unlikeB.json && unlikeB.json.count === 0, JSON.stringify(unlikeB.json));

const backToZero = await pageWith(postUrl, cookieA);
check('页面上计数回到 0', backToZero.likes[A]?.count === 0, `页面上是 ${backToZero.likes[A]?.count}`);

/* ================= 4. 刷新与重新访问不失真 ================= */

section('刷新与重新访问');

await like(endpoint, A, true, cookieA);
await like(endpoint, A, true, cookieB);

const reloads = [];
for (let i = 0; i < 3; i++) {
  reloads.push(await pageWith(postUrl, cookieA));
}
check('连刷三次页面，计数一直一样', reloads.every((r) => r.likes[A]?.count === 2), reloads.map((r) => r.likes[A]?.count).join('/'));
check('连刷三次页面，「我点过」的状态一直一样', reloads.every((r) => r.likes[A]?.liked === true), reloads.map((r) => (r.likes[A]?.liked ? '已赞' : '未赞')).join('/'));

const byB = await pageWith(postUrl, cookieB);
check('换一位访客看，计数还是 2', byB.likes[A]?.count === 2, `B 看到 ${byB.likes[A]?.count}`);

const endpointSays = await like(endpoint, A, true, cookieA);
check('端点与页面说的是同一个数字', endpointSays.json && endpointSays.json.count === 2, JSON.stringify(endpointSays.json));

await like(endpoint, A, false, cookieA);
await like(endpoint, A, false, cookieB);

/* ================= 5. 端点的边界 ================= */

section('端点边界');

const missing = await like(endpoint, 99999999, true);
check('不存在的评论：404', missing.status === 404, describe(missing));

const notBoolean = await like(endpoint, A, 'yes');
check('liked 不是布尔：400', notBoolean.status === 400, describe(notBoolean));

const noComment = await fetch(endpoint, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ liked: true }),
});
const noCommentText = await noComment.text();
check('缺少 comment_id：400', noComment.status === 400, `HTTP ${noComment.status} ${noCommentText.slice(0, 80)}`);

const pendingLike = await like(endpoint, pendingId, true);
check('待审评论点不了：404', pendingLike.status === 404, describe(pendingLike));

const stillZero = await pageWith(postUrl, cookieA);
check('被拒的请求都没改动计数', stillZero.likes[A]?.count === 0, `页面上是 ${stillZero.likes[A]?.count}`);

/* ================= 6. 不刷新页面（真浏览器） ================= */

section('不刷新页面');

const countExpr = (id) => `document.querySelector('.yuki-like[data-comment-id="${id}"] .yuki-like-count').textContent`;

let browser = null;
try {
  browser = await launch();
  const page = await newPage(browser);
  await page.goto(postUrl);

  const controlCount = await page.evaluate(`document.querySelectorAll('.yuki-like[data-comment-id]').length`);
  const pressed = () => page.evaluate(`document.querySelector('.yuki-like[data-comment-id="${C}"]').getAttribute('aria-pressed')`);

  check('浏览器里看到了点赞控件', controlCount === 3, `找到 ${controlCount} 个`);

  const before = await page.evaluate(countExpr(C));
  check('点之前计数是 0', before.replace(/[^0-9]/g, '') === '0', `页面上是 ${before}`);

  // 在同一页上放一个标记：它还在，就说明中途没有重新加载
  await page.evaluate(`window.__yukiStillHere = 'yes'`);
  await page.evaluate(`document.querySelector('.yuki-like[data-comment-id="${C}"]').click()`);

  const after = await waitFor(page, countExpr(C), (text) => text.replace(/[^0-9]/g, '') === '1');
  check('点一下计数就加一', after.replace(/[^0-9]/g, '') === '1', `页面上是 ${after}`);

  const stillHere = await page.evaluate(`window.__yukiStillHere`);
  check('全程没有重新加载页面', stillHere === 'yes', `页面上的标记：${stillHere}`);

  /*
   * 等这一下真的落到服务器上再往下走。
   *
   * 页面上那个数字是**先按预期画出来**的（点下去到服务器回话之间不该毫无反应），
   * 所以「看到 1」不等于「服务器收下了」。这里从不带 cookie 的角度去问：公开的计数
   * 变成 1 了，才说明那一下真的提交了——顺带也证明计数不是只活在浏览器里。
   */
  const landed = await waitForServer(async () => (await pageWith(postUrl)).likes[C]?.count, (n) => n === 1);
  check('那一下真的写到了服务器（换一位访客也看得到）', landed === 1, `服务器上还是 ${landed}`);

  // 重新加载：计数与状态都该从服务端拿回来（勾选项「刷新后状态仍然正确」）
  await page.goto(postUrl);
  const reloaded = await page.evaluate(countExpr(C));
  const pressedAfterReload = await pressed();

  check('刷新之后计数还在', reloaded.replace(/[^0-9]/g, '') === '1', `页面上是 ${reloaded}`);
  check('刷新之后仍是「已点赞」', pressedAfterReload === 'true', `刷新之后 aria-pressed=${pressedAfterReload}`);

  // 再点一次取消，并把这一条恢复原样，别把造数留下的赞继续攒着
  await page.evaluate(`document.querySelector('.yuki-like[data-comment-id="${C}"]').click()`);
  const undone = await waitFor(page, countExpr(C), (text) => text.replace(/[^0-9]/g, '') === '0');
  check('再点一次就取消，计数减回去', undone.replace(/[^0-9]/g, '') === '0', `页面上是 ${undone}`);

  const clearedOnServer = await waitForServer(async () => (await pageWith(postUrl)).likes[C]?.count, (n) => n === 0);
  check('取消也落到了服务器上', clearedOnServer === 0, `服务器上还是 ${clearedOnServer}`);

  await page.close();
} catch (err) {
  check('浏览器里点得动（无头 Edge 跑到底）', false, err.message);
} finally {
  if (browser) await browser.close();
}

/* ================= 7. 禁用 JS ================= */

section('禁用 JS');

/*
 * 「禁用 JS 时页面不报错、不缺一块」在这套基建里没有真开一个关掉脚本的浏览器去验
 * （browser.mjs 只暴露视口与求值，关脚本要另加一条 CDP 命令）。所以拆成它真正可能坏的两半：
 *
 * 1. **内容**：计数是服务端写进 HTML 的，不带任何 cookie 的普通请求拿到的就是那份 HTML ——
 *    没脚本的浏览器看到的东西就是它。
 * 2. **可见性**：没有哪条规则把控件藏起来。这一条不能靠「按名字挑规则」在样式表里验：
 *    `.yuki-comment-actions { display: none }` 会把整块藏掉，而那条规则里没有 `.yuki-like`。
 *    所以放到真浏览器里读**计算后**的样式（见下一节的量测）。
 *
 * 「不报错」那半：脚本不跑就不会抛错，要防的是页面**依赖**脚本才成立——那正是第 1 条在管的。
 */
const noJs = await get(postUrl);
const noJsLikes = likeButtons(noJs.body);
const noJsMissing = [A, B, C].filter((id) => !noJsLikes[id] || !/^[0-9]+$/.test(String(noJsLikes[id].count)));

check('不用脚本也看得到三条评论的计数（就是 HTML 里的文本）', noJsMissing.length === 0, noJsMissing.length ? `缺 ${noJsMissing.join(', ')}` : [A, B, C].map((id) => `${id}=${noJsLikes[id].count}`).join(' '));
check(
  '控件本身也在 HTML 里（心 + 计数 + 读屏器念的名字）',
  /yuki-like-heart[\s\S]*?yuki-like-count[\s\S]*?yuki-sr-only/.test(noJs.body) && noJs.body.includes('</html>'),
  `心的位置 ${noJs.body.indexOf('yuki-like-heart')}，名字的位置 ${noJs.body.indexOf('yuki-sr-only')}，页面${noJs.body.includes('</html>') ? '完整' : '没有收尾'}`,
);

/* ================= 8. 样式：token、深色、窄屏 ================= */

section('样式');

const css = themeCss();
const likeCss = rulesMentioning(css, '.yuki-like').join('\n');
const rootTokens = tokens(css);
const darkTokens = tokens(css, '.dark');

/*
 * 色值字面量。命名色那几条后面跟的是 `(?![\w-])` 而不是 `\b`：
 * `\b` 在 `white-space: nowrap` 的 `white` 后面同样成立（`-` 也是边界），
 * 于是一条排版规则会被判成「硬编码了颜色」——这种假红在工单 03 那边真的出现过一次。
 */
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)|\b(?:white|black|red|blue|green|gray|grey|orange|yellow)(?![\w-])/;

check('样式里有点赞控件的规则', likeCss.length > 0, `找到 ${likeCss.length} 字符`);
check(
  '控件的样式只写 token，不写死色值',
  !COLOR_LITERAL.test(likeCss),
  (likeCss.match(COLOR_LITERAL) || []).join(' ') || '没有硬编码色值',
);

const likeTokens = usedTokens(likeCss);
const likeColorTokens = likeTokens.filter((t) => isColor(rootTokens[t] ?? ''));

/*
 * 「用到的 token 都定义过」在**一个 token 都不用**时也是真的（空数组怎么遍历都成立）。
 * 所以先要一条前置断言，说清这块样式确实在用 token——不然上面那条是空转的。
 */
check('控件的样式确实用到了 token', likeTokens.length >= 3 && likeColorTokens.length >= 3, `${likeTokens.length} 个 token，其中颜色 ${likeColorTokens.length} 个`);
check('用到的 token 都在 :root 里定义过', likeTokens.every((t) => t in rootTokens), likeTokens.filter((t) => !(t in rootTokens)).join(', ') || likeTokens.join(', '));
check(
  '用到的颜色 token 在 .dark 里也定义了（否则深色下会用浅色那套值）',
  likeColorTokens.every((t) => t in darkTokens),
  likeColorTokens.join(', ') || '没有用到颜色 token',
);
/* ---- 深色 + 窄屏，用真浏览器量 ---- */

try {
  browser = await launch();
  const page = await newPage(browser, { colorScheme: 'dark' });
  await page.setViewport(375, 800);
  await page.goto(postUrl);

  const measured = await page.evaluate(`(function () {
    var button = document.querySelector('.yuki-like[data-comment-id="${C}"]');
    if (!button) return null;
    var count = button.querySelector('.yuki-like-count');
    var box = button.getBoundingClientRect();
    var style = getComputedStyle(button);
    var boxStyle = getComputedStyle(button.parentElement);
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      fg: getComputedStyle(count).color,
      bg: getComputedStyle(document.querySelector('.yuki-comment-list .comment-body')).backgroundColor,
      // 「会不会被藏起来」要读**算过之后**的值：光在样式表里按名字找 .yuki-like 的规则，
      // 漏得掉 .yuki-comment-actions{display:none} 这种把整块藏掉的写法
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      boxDisplay: boxStyle.display,
      text: count.textContent.trim(),
    };
  })()`);

  check('窄屏（375px）下控件仍在页面上且有尺寸', measured && measured.width > 0 && measured.height > 0, measured ? `${measured.width}×${measured.height}` : '没量到控件');
  check(
    '控件没有被藏起来（算过之后的 display/visibility/opacity 都不是藏着的样子）',
    measured ? measured.display !== 'none' && measured.visibility !== 'hidden' && Number(measured.opacity) > 0 && measured.boxDisplay !== 'none' : false,
    measured ? `display=${measured.display} visibility=${measured.visibility} opacity=${measured.opacity}（外层 display=${measured.boxDisplay}）` : '没量到',
  );
  check('计数以一个数字显示在按钮上', measured ? /^[0-9]+$/.test(measured.text) : false, measured ? `按钮里的文本是 ${JSON.stringify(measured.text)}` : '没量到');
  check(
    '深色下按钮没有溢出视口宽度',
    measured ? measured.width <= 375 : false,
    measured ? `宽 ${measured.width}px（视口 375px）` : '没量到',
  );
  check(
    '深色下计数的对比度够读（≥ 4.5）',
    measured ? contrast(measured.fg, measured.bg) >= 4.5 : false,
    measured ? `${contrast(measured.fg, measured.bg).toFixed(2)}:1（${measured.fg} on ${measured.bg}）` : '没量到颜色',
  );
  check(
    '深色下计数用的是深色那套 --yuki-ink-2，不是浅色那套值',
    measured ? measured.fg === hexToRgb(darkTokens['--yuki-ink-2'] ?? '') : false,
    measured ? `实测 ${measured.fg}，深色 ${darkTokens['--yuki-ink-2']}（${hexToRgb(darkTokens['--yuki-ink-2'] ?? '')}），浅色 ${rootTokens['--yuki-ink-2']}` : '没量到',
  );

  await page.close();
} catch (err) {
  check('深色窄屏下量得动（无头 Edge 跑到底）', false, err.message);
} finally {
  if (browser) await browser.close();
}

/* ================= 收尾 ================= */

const finalState = await pageWith(postUrl);
note(`三条评论的计数：${[A, B, C].map((id) => `${id}=${finalState.likes[id]?.count}`).join(' ')}`);
note(`站点 ${SITE} 首页状态 ${(await get(`${SITE}/`)).status}`);

tryFx('purge');
note('已清掉本轮的造数');

report();
