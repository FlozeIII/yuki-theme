// 工单 02 的验收：评论防垃圾（蜜罐 + 带签名的提交时间戳）。
//
// 只走 HTTP 这一层：请求进去、HTML 出来。每次用在带时间戳的标记文本提交，
// 再去看这些标记出现在哪些地方——
//   - 被挡下的提交：文章页上没有、评论 feed 里没有、待审与垃圾队列里也没有
//   - 正常提交：该发布的当场可见，该待审的进待审队列
//
// 用法: node tests/bin/verify-comment-spam.mjs
// 前置：本地站已在跑，且已装过基建（node tests/bin/harness.mjs install）——
//       其中关掉评论频率限制的那条是这套断言的前提，见下面「拦截」一段。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, WP_ROOT, get, php, postForm, tagAttrs } from './lib.mjs';
import { check, section, report } from './report.mjs';

const ADMIN = { user: 'admin', pass: 'admin123' };
const COMMENT_URL = `${SITE}/wp-comments-post.php`;
const FIXTURES = path.join(import.meta.dirname, 'comment-spam-fixtures.php');

const RUN = Date.now().toString(36);
const mark = (kind) => `YUKI-TEST-${kind}-${RUN}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


/* ---------------- HTTP ---------------- */

/** 会话 cookie。后台队列那几段要带着登录态请求。 */
class Jar {
  constructor() { this.cookies = new Map(); }
  store(res) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  get headers() { return this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}; }
}

// postForm() 是整体替换 headers 的（不是合并），所以带 cookie 的那几次要把 content-type 一起带上，
// 否则 PHP 解不出 $_POST，登录和提交都会静默失败。
const FORM_HEADERS = { 'content-type': 'application/x-www-form-urlencoded' };

/**
 * 提交一次评论表单。
 *
 * 被挡下时核心走 wp-comments-post.php 的 `exit;` 分支：既没有跳转，也没有正文。**有一个例外**：
 * 提交太快那一种（工单 03 之后）要给一句能照做的话，所以它是「有正文、没跳转」。
 * 429 另有一层含义——内核自己的评论频率限制抢在前面——那说明基建没装好。
 */
const submit = (fields, jar = null) => postForm(
  COMMENT_URL,
  fields,
  jar ? { headers: { ...FORM_HEADERS, ...jar.headers } } : {},
);

const blockedNow = (res) => {
  if (res.status === 429) {
    return { ok: false, why: '429 = 内核的评论频率限制，先跑 node tests/bin/harness.mjs install' };
  }
  return { ok: !res.location && res.body.trim() === '', why: `status=${res.status} location=${res.location || '（无）'} 正文 ${res.body.trim().length} 字节` };
};

/* ---------------- 表单解析 ---------------- */

/** 属性取值。解析交给 lib.mjs 的 tagAttrs——单引号、双引号、不带引号都认，别各养一份。 */
const attr = (tag, name) => tagAttrs(tag)[name] ?? '';

// comment_form() 自己的字段就这些，多出来的才是主题加的
const CORE_FIELDS = new Set([
  'author', 'email', 'url', 'comment',
  'wp-comment-cookies-consent', 'comment_post_ID', 'comment_parent', 'submit',
]);

function parseForm(html) {
  const formTag = html.match(/<form\b[^>]*commentform[^>]*>/i);
  if (!formTag) return null;

  const start = formTag.index;
  const region = html.slice(start, html.indexOf('</form>', start));
  const inputs = [...region.matchAll(/<input\b[^>]*>/gi)].map((m) => ({ tag: m[0], at: m.index }));

  const isCore = (tag) => CORE_FIELDS.has(attr(tag, 'name')) || attr(tag, 'name').startsWith('_');

  // 访客看不见也点不到的那个输入框：不是隐藏域（机器人只填看得见的），
  // 也不是 WordPress 自己的字段——就是主题加的蜜罐
  const traps = inputs.filter(({ tag }) => 'hidden' !== attr(tag, 'type') && !isCore(tag));
  // 令牌：主题加的那个隐藏域
  const tokens = inputs.filter(({ tag }) => 'hidden' === attr(tag, 'type') && !isCore(tag));

  // 蜜罐的外层容器：输入框前面最近的那个 p/div 开标签
  const trapWrapper = traps.length
    ? [...region.slice(0, traps[0].at).matchAll(/<(?:p|div)\b[^>]*>/gi)].pop()?.[0] ?? ''
    : '';

  return { region, traps, tokens, trapWrapper };
}

const tokenOf = (form) => attr(form.tokens[0]?.tag ?? '', 'value');
const trapField = (form) => attr(form.traps[0]?.tag ?? '', 'name');
const tokenField = (form) => attr(form.tokens[0]?.tag ?? '', 'name');

/* ---------------- 主流程 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}
const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const { post_url: POST_URL, post_id: postId, comments_feed: FEED_URL } = facts;

/* ================= 1. 表单 ================= */

const tokenIssuedAt = Date.now();
const page = await get(POST_URL);
const form = parseForm(page.body);

section('表单里那两样');
check('文章页有评论表单', !!form);
if (!form) report();

check('有一个访客看不见的输入框', form.traps.length === 1, `找到 ${form.traps.length} 个`);
check('有一个隐藏的令牌字段', form.tokens.length === 1, `找到 ${form.tokens.length} 个`);

const trapTag = form.traps[0]?.tag ?? '';
const trapName = trapField(form);

check('蜜罐所在容器 aria-hidden', /aria-hidden="true"/i.test(form.trapWrapper), form.trapWrapper || '（没找到外层容器）');
check('蜜罐不可键盘到达（tabindex=-1）', attr(trapTag, 'tabindex') === '-1', trapTag);
check('蜜罐不参与自动填充（autocomplete=off）', attr(trapTag, 'autocomplete') === 'off', trapTag);
check('蜜罐不是会被代填的类型',
  !['email', 'url', 'tel', 'password', 'number'].includes(attr(trapTag, 'type')), attr(trapTag, 'type'));
check('蜜罐字段名不含自动填充词汇',
  !/name|nick|mail|url|site|phone|tel|address|company|org|user|pass|search/i.test(trapName), trapName);
check('蜜罐没有被浏览器当成必填项', !/\brequired\b/i.test(trapTag));
check('蜜罐没有 placeholder 去引机器人填', !attr(trapTag, 'placeholder'), attr(trapTag, 'placeholder'));
check('令牌走隐藏域，访客碰不到', form.tokens.length === 1 && 'hidden' === attr(form.tokens[0].tag, 'type'));

{
  // 蜜罐得真的看不见：样式在主题的 style.css 里
  const css = fs.readFileSync(path.join(REPO_ROOT, 'style.css'), 'utf8');
  const cls = attr(form.trapWrapper, 'class').split(/\s+/).filter(Boolean)[0] || '';
  const rule = cls ? new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`, 'i').exec(css)?.[1]?.trim() ?? '' : '';
  check('蜜罐在样式表里被移出可视区域',
    /position:\s*absolute/i.test(rule) && /left:\s*-\d|display:\s*none|visibility:\s*hidden/i.test(rule),
    cls ? `.${cls} { ${rule.replace(/\s+/g, ' ')} }` : '（没找到外层 class）');
}

{
  // 面向访客的输出里都不该有它：整页只有表单里那一个 input 用它这个名字
  const trapInputs = (text) => trapName
    ? [...text.matchAll(/<input\b[^>]*>/gi)].filter((m) => attr(m[0], 'name') === trapName).length
    : -1;
  const inForm = trapInputs(form.region);
  const total = trapInputs(page.body);
  check('蜜罐只出现在表单里，评论列表里没有', inForm === 1 && total === 1, `表单内 ${inForm} 个 / 全页 ${total} 个`);
}

const token0 = tokenOf(form);
check('页面渲染时签发了令牌', token0.length > 0, token0);

/* ================= 2. 被挡下的提交 ================= */

// 都要带上那个「回头客」的身份：他本来是该被放行的，
// 这样「没产生评论」就只可能是因为被挡下，而不是因为别的原因。
const asKnown = { author: facts.known_author, email: facts.known_email };
const submitAs = (form, { trap, token, omitToken, marker, ...rest }) => {
  const data = {
    comment_post_ID: String(postId),
    url: 'https://example.com',
    [trapField(form)]: trap,
    comment: marker,
    ...asKnown,
    ...rest,
  };
  if (!omitToken) data[tokenField(form)] = token;
  return data;
};

const blocked = [];

section('判定发生在入库之前');
{
  // 页面刚渲染出来就提交。此刻令牌本身是有效签名、蜜罐也是空的，
  /*
   * 能拦住这一次的只有判定窗口——不是别的什么顺便挡住了。
   *
   * 工单 03 之后这一条**不再是一片空白**：太快被挡下时要回一句能照做的话（那正是那一件
   * 的目的，付代价的可能是手快的人）。所以这里改验「没有产生评论 + 说了一句话」。
   * 与内核那条频率限制撞在同一个 429 上，靠正文分得开：内核说的是「Slow down」，
   * 主题这条说的是「再点一次」。
   */
  const marker = mark('FAST');
  const res = await submit(submitAs(form, { trap: '', token: token0, marker }));
  blocked.push(marker);
  check(
    '瞬间提交：没有产生评论，并且回了一句能照做的话',
    !res.location && /再|重试/.test(res.body),
    `status=${res.status} location=${res.location || '（无）'} 正文：${JSON.stringify(res.body.trim().slice(0, 140))}`,
  );
}
{
  // 没签出令牌时也走完这条路，让断言自己去红，而不是把脚本崩掉
  const [issued, sig] = (token0 || '1|2').split('|');
  // 把提交时刻换成两分钟前、签名原样留着：这样「太新」那条判定不会恰好帮我挡住，
  // 只有签名校验拦得住——免得签名坏了这条断言还绿着
  const aged = String(Number(issued) - 120);
  for (const [name, token] of [
    ['时刻被换过、签名对不上', `${aged}|${sig}`],
    ['凭空伪造的值', `1750000000|${'0'.repeat(64)}`],
  ]) {
    const marker = mark(name === '凭空伪造的值' ? 'FORGED' : 'TAMPER');
    const res = await submit(submitAs(form, { trap: '', token, marker }));
    const verdict = blockedNow(res);
    blocked.push(marker);
    check(`${name}：判为无效`, verdict.ok, verdict.why);
  }
  {
    const marker = mark('NOTOKEN');
    const res = await submit(submitAs(form, { trap: '', token: '', marker, omitToken: true }));
    const verdict = blockedNow(res);
    blocked.push(marker);
    check('根本没带令牌：判为无效', verdict.ok, verdict.why);
  }
}

/* ================= 3. 正常提交 ================= */

// 判定窗口只认「提交时刻 − 页面渲染时刻」的差，所以同一个令牌等过了窗口再提交即可
await sleep(Math.max(0, tokenIssuedAt + 3300 - Date.now()));

{
  // 蜜罐这条必须等令牌过了窗口再提交：刚签发的令牌会被判定窗口先挡下，
  // 那样即使蜜罐校验整个坏掉，断言照样是绿的——绿在了窗口上，不是蜜罐上。
  const marker = mark('HONEY');
  const res = await submit(submitAs(form, { trap: 'http://spam.example/', token: token0, marker }));
  const verdict = blockedNow(res);
  blocked.push(marker);
  check('填了蜜罐：没有产生评论', verdict.ok, verdict.why);
}

section('正常填写的照旧');
// 密码管理器把整个表单填满：姓名 / 邮箱 / 网址 / 正文都有值，蜜罐照样是空的
const normalMarker = mark('NORMAL');
const normalRes = await submit(submitAs(form, { trap: '', token: token0, marker: normalMarker }));
check('老读者（邮箱有过通过的评论）：提交被接受', /#comment-\d+/.test(normalRes.location), `status=${normalRes.status} location=${normalRes.location || '（无）'}`);
check('该发布的直接发布，跳转里没有待审参数', !/unapproved=/.test(normalRes.location), normalRes.location);

const pendingMarker = mark('PENDING');
const pendingRes = await submit(submitAs(form, { trap: '', token: token0, marker: pendingMarker, email: `nobody-${RUN}@example.com`, author: '新访客' }));
check('新访客：提交被接受且提示待审', /unapproved=\d+/.test(pendingRes.location), `status=${pendingRes.status} location=${pendingRes.location || '（无）'}`);

/* ================= 4. 站点上看得见什么 ================= */

section('站点上看不出被挡下的提交');
const pageAfter = (await get(POST_URL)).body;
const feed = (await get(FEED_URL)).body;

const leaked = (text) => blocked.filter((m) => text.includes(m)).join(', ');
check('被挡下的提交不在文章页上', blocked.every((m) => !pageAfter.includes(m)), leaked(pageAfter));
check('被挡下的提交不在评论 feed 里', blocked.every((m) => !feed.includes(m)), leaked(feed));
check('评论 feed 里没有蜜罐字段', !feed.includes(trapName), trapName);
check('已通过的评论出现在文章页', pageAfter.includes(normalMarker));
check('已通过的评论出现在评论 feed', feed.includes(normalMarker));
check('待审评论对访客不可见', !pageAfter.includes(pendingMarker) && !feed.includes(pendingMarker));

/* ================= 5. 后台队列 ================= */

section('也没有落进任何队列');
const jar = new Jar();
jar.store(await get(`${SITE}/wp-login.php`));
jar.store(await postForm(`${SITE}/wp-login.php`, {
  log: ADMIN.user, pwd: ADMIN.pass, 'wp-submit': 'Log In', redirect_to: `${SITE}/wp-admin/`, testcookie: '1',
}, { headers: { ...FORM_HEADERS, ...jar.headers } }));

const queues = {};
for (const status of ['moderated', 'spam', 'all']) {
  const res = await get(`${SITE}/wp-admin/edit-comments.php?comment_status=${status}`, { headers: jar.headers });
  queues[status] = res;
}
check('能登录后台（否则下面的队列断言不算数）',
  queues.moderated.status === 200 && !/wp-login\.php/.test(queues.moderated.headers.get('location') || ''),
  `status=${queues.moderated.status}`);

for (const [status, res] of Object.entries(queues)) {
  check(`被挡下的提交不在「${status}」列表里`, blocked.every((m) => !res.body.includes(m)), leaked(res.body));
}
check('该待审的在待审队列里', queues.moderated.body.includes(pendingMarker));
check('该发布的在评论列表里（已通过）', queues.all.body.includes(normalMarker));

report();
