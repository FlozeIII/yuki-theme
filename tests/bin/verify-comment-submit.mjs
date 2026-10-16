// 工单 01 的验收：提交之后页面不动，我那条评论就地出现。
//
// seam 只有那一个：**HTTP**。端点上收的是表单字段、回话是 JSON；无 JS 那条路照旧走
// wp-comments-post.php。另有两处 HTTP 够不着，用仓库**既有的**观察点补：
//
//   - 无头浏览器：只有它看得见「页面没有重新加载」，而那是这一件的全部卖点；
//   - 邮件捕获：两条路吐出的东西里包含同一封通知邮件。
//
// 「别的入口不受影响」也在 HTTP 之外，用 fixtures 的 guard-scope 子命令在一个独立进程里
// 模拟「一次非 REST 的 POST」与「一次 REST 调用」，看防垃圾守卫认不认它们。
//
// 用法: node tests/bin/verify-comment-submit.mjs

import { get, markMails, probe, probeScript, readMails, submitComment } from './lib.mjs';
import { check, note, report, section } from './report.mjs';
import { launch, newPage } from './browser.mjs';

const FX = 'comment-submit-fixtures.php';
const fx = (...args) => probeScript(FX, ...args);

const tryFx = (...args) => {
  try {
    return fx(...args);
  } catch (err) {
    return { error: err.message };
  }
};

const MARK = 'YUKI-SUBMIT';
const RUN = Date.now();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ================= 小工具 ================= */

/**
 * 像浏览器一样提交（取真实表单、等够判定窗口），但**改投端点**。
 *
 * 字段那一套完全交给 lib 的 submitComment 去读：两边各读一遍表单迟早会读歪，
 * 而读歪之后看起来仍然像「提交成功了」。
 */
async function viaEndpoint(postUrl, endpoint, options = {}) {
  try {
    const res = await submitComment(postUrl, { ...options, target: endpoint });
    let json = null;
    try {
      json = JSON.parse(res.body);
    } catch {
      json = null;
    }
    return { ...res, json };
  } catch (err) {
    return { status: 0, body: '', error: err.message, json: null };
  }
}

/**
 * 从跳转地址里把落定那条评论的 id 认出来。
 *
 * 两种形状都要认：勾了「记住我的信息」时核心跳的是评论锚点（`#comment-123`），
 * 没勾时才另外挂上 `unapproved=123`（那套只在 10 分钟内有效）。
 */
function commentIdFrom(location) {
  const m = String(location).match(/(?:#comment-|unapproved=)(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** 走原生那条路（表单自己声明的 action）。 */
async function viaNative(postUrl, options = {}) {
  try {
    const res = await submitComment(postUrl, options);
    return { ...res, commentId: commentIdFrom(res.location) };
  } catch (err) {
    return { status: 0, body: '', error: err.message, location: '', setCookies: [] };
  }
}

/** 端点回话里那句「落定了没有」的摘要，失败时最有用。 */
const describe = (res) =>
  res.error || `HTTP ${res.status} ${String(res.body).slice(0, 120)}`;

/** 从 `评论（3）` 这种人话里把数字取出来。 */
const numberOf = (text) => {
  const m = String(text ?? '').match(/[0-9][0-9,]*/);
  return m ? Number(m[0].replace(/,/g, '')) : NaN;
};

/** 列表页上服务端渲染的那句「评论（N）」里的 N。 */
function headingNumberOf(html) {
  const m = String(html ?? '').match(/<h3 class="yuki-comment-count">([^<]*)</);
  return numberOf(m ? m[1] : '');
}

/**
 * 从一段 HTML 里把「那句话」中的数字取出来。
 *
 * **必须先剥标签再数**：`numberOf` 取的是第一段数字，而 `<h3 class="yuki-comment-count">`
 * 里就有一个 3——直接往标记上套，`评论（2）` 会被读成 3。踩过一次，而且它连
 * **失败信息**都一起带歪了（失败信息与判断用的是同一个表达式），看着像服务端算错了。
 */
const htmlNumberOf = (html) => numberOf(String(html ?? '').replace(/<[^>]*>/g, ''));

/**
 * 此刻服务端渲染出来的评论计数。
 *
 * 「加了一 / 没有变」都以**紧挨着提交之前**读到的那一份为基准：数的是同一件事
 * 两次渲染之间的差，而不是拿造数时的条数去加——这样才对得起这一件真正要保证的东西
 * （就地画出来的那一份与重新载入后的那一份说的是同一件事）。
 */
async function serverHeading() {
  return headingNumberOf((await get(postUrl)).body);
}

/** 那一刻这篇文章上有几条评论是公开的——旁证，用来判断计数有没有走样。 */
const approvedCountNow = () => tryFx('by-email', '--email=nobody@example.test').all.filter((r) => r.approved === '1').length;

/**
 * 某条 cookie 到底下发了没有。
 *
 * **「清掉」也是一种 Set-Cookie**：没勾「记住我的信息」时核心会把评论者 cookie 的
 * 值设成空格、过期时间设到过去。只按名字去找，会把这种清掉的动作也认成「下发了」。
 */
function issuedCookie(setCookies, name) {
  return (setCookies || []).some((raw) => {
    const text = String(raw);

    if (!text.startsWith(`${name}=`)) {
      return false;
    }

    const value = text.slice(name.length + 1).split(';')[0].trim();

    return value !== '' && value !== '%20' && value !== '+';
  });
}

/* ================= 0. 前提 ================= */

section('前提');

const setup = tryFx('setup');

check(
  '造数成功（一篇自己的文章 + 一条过审 + 一条待审）',
  !setup.error && setup.post_url && setup.pending_id > 0,
  setup.error || JSON.stringify(setup).slice(0, 200),
);

if (setup.error || !setup.post_url) {
  note('造数失败，后面的断言没有意义，就此打住');
  report();
}

const postUrl = setup.post_url;
const endpoint = setup.endpoint;
const knownEmail = setup.known_email;
const pendingId = setup.pending_id;
const cookieHash = setup.cookie_hash;

const page0 = await get(postUrl);
check('文章页打得开', page0.status === 200, `实际 ${page0.status}`);
check('页面上有评论表单', /id=["']commentform["']/.test(page0.body), '找不到 #commentform');
check(
  '端点地址是主题注册的那条',
  /\/yuki\/v1\/comment-submit$/.test(endpoint),
  endpoint,
);

// 列表页上那句「评论（N）」由服务端渲染。后面几处「计数加了一 / 没有变」都以它为基准，
// 而不是拿造数时的条数去加——本地环境里同时有别的东西在动这篇文章之外的评论，
// 只有「同一页面上前后相差多少」才是这一件真正该负责的事。
const headingStart = headingNumberOf(page0.body);
check(
  '列表页上有服务端渲染的评论计数',
  Number.isFinite(headingStart),
  '页面上找不到 .yuki-comment-count',
);

/* ================= 1. 端点上的一笔正常提交（已公开） ================= */

section('端点上的一笔正常提交');

// 「回头客」这位访客在本站有过一条过审评论，comment_previously_approved 会直接放行，
// 所以这条会公开——另一条路（进待审队列）在下一节。
// 注意作者名要跟着一起对上：核心那条 SQL 比的是**作者名 + 邮箱**。
const okMailMark = markMails();

const headingBefore = await serverHeading();
const approvedCountBefore = approvedCountNow();

const approved = await viaEndpoint(postUrl, endpoint, {
  comment: `${MARK} 端点提交 已公开 ${RUN}`,
  author: setup.known_author,
  email: knownEmail,
  consent: true,
});

check('端点收下了这笔提交', approved.status === 200, describe(approved));
check('回话是 JSON', approved.json !== null, `正文：${String(approved.body).slice(0, 120)}`);
check(
  '回话里说这条是已公开的',
  approved.json?.approved === true,
  JSON.stringify(approved.json && { id: approved.json.id, approved: approved.json.approved }),
);

const okId = approved.json?.id || 0;
check('回话里带着落定的评论标识', okId > 0, `id=${okId}`);

const okRow = tryFx('status', `--comment=${okId}`);
check(
  '库里那条确实是已公开的',
  okRow.found === true && okRow.approved === '1',
  JSON.stringify(okRow).slice(0, 160),
);
check(
  '它落在这篇验收文章上（不是别处）',
  okRow.post === setup.post_id,
  `落在 ${okRow.post}，本该落在 ${setup.post_id}`,
);

check(
  '回话里那一段 HTML 就是列表里那一条',
  typeof approved.json?.html === 'string'
    && approved.json.html.includes(`id="comment-${okId}"`)
    && approved.json.html.includes(`${MARK} 端点提交 已公开 ${RUN}`),
  `html 长度 ${String(approved.json?.html || '').length}`,
);
check(
  'HTML 走的是列表那个模板（该有的印记都在）',
  /id="div-comment-/.test(approved.json?.html || '')
    && /class="[^"]*comment-body/.test(approved.json?.html || '')
    && /depth-1/.test(approved.json?.html || ''),
  String(approved.json?.html || '').slice(0, 160),
);
check(
  '已公开的那条不带待审标记',
  !/comment-awaiting-moderation/.test(approved.json?.html || ''),
  '带上「等待审核」了',
);

// 提交那一刻发出的评论者 cookie，就是「同一身份再次访问」的凭证
check(
  '端点补发了评论者 cookie（原生入口在成功后另做的那一件）',
  issuedCookie(approved.setCookies, `comment_author_email_${cookieHash}`),
  `Set-Cookie：${approved.setCookies.map((c) => String(c).split(';')[0]).join(' | ') || '(一条都没有)'}`,
);

// 评论计数只在评论**真的公开**时才变
check(
  '已公开的那条让计数加了一',
  htmlNumberOf(approved.json?.heading) === headingBefore + 1,
  `提交前页面上是 ${headingBefore}（这篇文章当时有 ${approvedCountBefore} 条公开的），`
    + `回话里成了 ${htmlNumberOf(approved.json?.heading)}（现在有 ${approvedCountNow()} 条公开的）`,
);

const okMails = readMails(okMailMark).filter((m) => m.body.includes(`${MARK} 端点提交 已公开 ${RUN}`));
check(
  '端点这条路也发了通知邮件（与原生那条路同一套钩子）',
  okMails.length > 0,
  `捕获到 ${okMails.length} 封`,
);

/* ================= 2. 端点上的一笔待审提交 ================= */

section('端点上的一笔待审提交');

const freshEmail = `submit-fresh-${RUN}@example.test`;
const freshBody = `${MARK} 待审 正文 ${RUN}`;

const headingBeforeHeld = await serverHeading();

const held = await viaEndpoint(postUrl, endpoint, {
  comment: freshBody,
  author: `${MARK} 新访客`,
  email: freshEmail,
  consent: true,
});

check('端点收下了这笔提交', held.status === 200, describe(held));
check('回话里说这条还在待审', held.json?.approved === false, JSON.stringify(held.json?.approved));

const heldId = held.json?.id || 0;
check('回话里带着落定的评论标识', heldId > 0, `id=${heldId}`);

const heldRow = tryFx('status', `--comment=${heldId}`);
check(
  '库里那条确实在待审队列里',
  heldRow.found === true && heldRow.approved === '0',
  JSON.stringify(heldRow).slice(0, 160),
);

check(
  '待审的那段 HTML 带着「等待审核」的标记',
  /comment-awaiting-moderation/.test(held.json?.html || ''),
  String(held.json?.html || '').slice(0, 160),
);
check(
  '回话里的待审提示数到了一条',
  /yuki-pending-notice/.test(held.json?.notice || '') && htmlNumberOf(held.json?.notice) === 1,
  `提示：${String(held.json?.notice || '').slice(0, 120) || '(空)'}`,
);
check(
  '待审的那条不改变评论计数',
  htmlNumberOf(held.json?.heading) === headingBeforeHeld,
  `提交前页面上是 ${headingBeforeHeld}，回话里成了 ${htmlNumberOf(held.json?.heading)}`,
);

// 待审评论对本人可见：拿提交那一刻发出的 cookie 再去问一次
const heldCookie = held.setCookies.map((c) => String(c).split(';')[0]).join('; ');
check(
  '待审这条也发了评论者 cookie',
  issuedCookie(held.setCookies, `comment_author_email_${cookieHash}`),
  `Set-Cookie：${held.setCookies.map((c) => String(c).split(';')[0]).join(' | ') || '(一条都没有)'}`,
);

const mine = await get(postUrl, { cookie: heldCookie });
check('带同一身份再访问正常', mine.status === 200, `实际 ${mine.status}`);
check('本人看得见自己那条待审评论', mine.body.includes(freshBody), '页面上没有它');
check(
  '本人看得见那句待审提示',
  /yuki-pending-notice/.test(mine.body),
  '页面上找不到待审提示',
);

const stranger = await get(postUrl);
check('不带身份就看不见那条待审评论', !stranger.body.includes(freshBody), '被陌生人看见了');
check('不带身份也没有待审提示', !/yuki-pending-notice/.test(stranger.body), '陌生人看到了待审提示');

// 旁证：那个邮箱名下确实有一条待审
const freshByEmail = tryFx('by-email', `--email=${freshEmail}`);
check(
  '旁证：那个邮箱名下正好一条待审',
  freshByEmail.count === 1 && freshByEmail.mine[0].approved === '0',
  JSON.stringify(freshByEmail).slice(0, 200),
);

/* ================= 3. 端点上被挡下的三种提交 ================= */

section('端点上被挡下的提交');

const botEmail = `submit-bot-${RUN}@example.test`;
const botBody = `${MARK} 机器人 正文 ${RUN}`;

// 蜜罐：确定性的机器人信号
const trap = await viaEndpoint(postUrl, endpoint, {
  comment: botBody,
  author: `${MARK} 机器人`,
  email: botEmail,
  consent: true,
  extraFields: { yuki_comment_note: 'i-am-a-robot' },
});
check('填了蜜罐被端点挡下', trap.status >= 400, describe(trap));
// 先说清「回话确实解析得开」再判有没有话：否则回话不是 JSON 时，下面那条会因为
// `undefined` 被当成「没有话」而**白白通过**——它在验的东西正好是「什么也不说」。
check('回话解析得开', !!trap.json && typeof trap.json === 'object', `正文：${String(trap.body).slice(0, 120)}`);
check('挡下时没有可辨认的一句话', !trap.json?.message, `回话：${JSON.stringify(trap.json).slice(0, 120)}`);

// 太快：只在怀疑，但这一件里的判定与今天一致（把话说得更细是下一件工单的事）
const tooFast = await viaEndpoint(postUrl, endpoint, {
  comment: botBody,
  author: `${MARK} 手快`,
  email: botEmail,
  consent: true,
  settleMs: 0,
});
check('提交太快被端点挡下', tooFast.status >= 400, describe(tooFast));

// 缺令牌：表单协议没带全
const noToken = await viaEndpoint(postUrl, endpoint, {
  comment: botBody,
  author: `${MARK} 无令牌`,
  email: botEmail,
  consent: true,
  extraFields: { yuki_comment_token: '' },
});
check('没带令牌被端点挡下', noToken.status >= 400, describe(noToken));

const botLanded = tryFx('by-email', `--email=${botEmail}`);
check(
  '三种被挡下的提交一条都没入库',
  botLanded.count === 0,
  `居然落了 ${botLanded.count} 条：${JSON.stringify(botLanded.mine).slice(0, 160)}`,
);

const botPage = await get(postUrl);
check('页面上也没留下任何一条', !botPage.body.includes(botBody), '垃圾内容出现在页面上了');

/*
 * 另一类「不行」：核心自己的校验。它给的消息是**要给人看的**，端点得原样带出来
 * ——不然脚本这条路上，这类提示会静静地消失（没脚本那条路会拿 wp_die 把话印出来）。
 * 空正文是最省事的一种：核心在 `wp_handle_comment_submission()` 里、进
 * `wp_new_comment()` 之前就拒了，所以连防垃圾那道门都还没走到。
 */
const empty = await viaEndpoint(postUrl, endpoint, {
  comment: '',
  author: `${MARK} 空正文`,
  email: `submit-empty-${RUN}@example.test`,
  consent: true,
  settleMs: 0,
});
check('空正文被端点挡下', empty.status >= 400, describe(empty));
check(
  '核心那句话原样带出来了（且没有标签）',
  typeof empty.json?.message === 'string' && empty.json.message.length > 0 && !/</.test(empty.json.message),
  `回话：${JSON.stringify(empty.json).slice(0, 160)}`,
);

/* ================= 4. 核心自己判成垃圾的那一条 ================= */

section('核心判成垃圾的提交');

/*
 * 命中站点「不允许的关键词」时，**核心自己**把审批状态设成 trash/spam，而且**不给
 * WP_Error**（wp-includes/comment.php:1384-1392）——`wp_handle_comment_submission()`
 * 会照常把评论对象还回来。端点要是照「不是错误就是成功」处理，就会把一条**垃圾评论**
 * 画进列表里：它没有待审标记（模板只认 '0'），计数那句又不认它（计数只数已公开的），
 * 于是访客看到一条「看着发出去了、刷新就没了」的评论。
 *
 * 关键词是全站选项，所以用本工单独有的标记词，并且马上还原。
 */
const BLOCK_WORD = `${MARK}-BLOCKLIST-${RUN}`;

const blocked = tryFx('blocklist', `--key=${BLOCK_WORD}`);
check('关键词设上了', blocked.now === BLOCK_WORD, JSON.stringify(blocked).slice(0, 160));

const blockedBody = `${MARK} 命中关键词 ${BLOCK_WORD}`;
const blockedEmail = `submit-blocked-${RUN}@example.test`;

const blockedRes = await viaEndpoint(postUrl, endpoint, {
  comment: blockedBody,
  author: `${MARK} 命中者`,
  email: blockedEmail,
  consent: true,
});

check('核心判成垃圾的那一条没被当成成功', blockedRes.status >= 400, describe(blockedRes));
check(
  '也没有可辨认的一句话',
  !!blockedRes.json && !blockedRes.json.message,
  `回话：${JSON.stringify(blockedRes.json).slice(0, 140)}`,
);

// 还原（这是全站设置，不留痕）
const restored = tryFx('blocklist');
check('关键词还原了', restored.now === '', `现在是 ${JSON.stringify(restored.now)}`);
check(
  '说明上一轮之前它确实是空的（即还原到了 WordPress 的默认值，不是别的什么）',
  restored.previous === BLOCK_WORD,
  `还原前是 ${JSON.stringify(restored.previous).slice(0, 80)}`,
);

const blockedRow = tryFx('by-email', `--email=${blockedEmail}`);
check(
  '核心确实把那条收下了，而且是判成垃圾（trash 或 spam），不是走普通的待审',
  blockedRow.count === 1 && ['trash', 'spam'].includes(blockedRow.mine[0] && blockedRow.mine[0].approved),
  JSON.stringify(blockedRow.mine).slice(0, 200),
);

const blockedPage = await get(postUrl);
check(
  '页面上看不到它（与刷新之后一致）',
  !blockedPage.body.includes(blockedBody),
  '垃圾评论出现在页面上了',
);

/* ================= 5. 回复一条还没公开的评论 ================= */


section('回复还没公开的评论');

// 核心自己就会拒掉「回复一条还没公开的评论」（403），端点上照它的判断回话即可。
// 关键是**不为了给出更友好的错误而多说一句**——多说一句就把端点变成了探查
// 「某条评论存不存在」的手段。所以要验的是：回复一条待审的、与回复一条压根不存在的，
// 回话**一模一样**。
const replyToHeld = await viaEndpoint(postUrl, endpoint, {
  comment: `${MARK} 回复待审 ${RUN}`,
  author: `${MARK} 回复者`,
  email: `submit-reply-${RUN}@example.test`,
  consent: true,
  extraFields: { comment_parent: String(pendingId) },
});

const replyToMissing = await viaEndpoint(postUrl, endpoint, {
  comment: `${MARK} 回复不存在 ${RUN}`,
  author: `${MARK} 回复者`,
  email: `submit-reply-${RUN}@example.test`,
  consent: true,
  extraFields: { comment_parent: '99999999' },
});

check('回复一条待审评论被拒', replyToHeld.status >= 400, describe(replyToHeld));
check('回复一条不存在的评论也被拒', replyToMissing.status >= 400, describe(replyToMissing));
check(
  '两种回话一模一样，看不出那条评论存不存在',
  replyToHeld.status === replyToMissing.status
    && JSON.stringify(replyToHeld.json) === JSON.stringify(replyToMissing.json),
  `待审：${replyToHeld.status} ${JSON.stringify(replyToHeld.json).slice(0, 100)} / 不存在：${replyToMissing.status} ${JSON.stringify(replyToMissing.json).slice(0, 100)}`,
);

/* ================= 6. 两条路吐出同一个结果 ================= */

section('两条路吐出同一个结果');

// 同一个形状、两个都没过的新邮箱：两条路都该把它送进待审队列，并发同一封通知邮件。
const cmpA = `submit-cmp-a-${RUN}@example.test`;
const cmpB = `submit-cmp-b-${RUN}@example.test`;
const cmpBodyA = `${MARK} 对照 端点 ${RUN}`;
const cmpBodyB = `${MARK} 对照 表单 ${RUN}`;

const cmpMailMark = markMails();

const cmpEndpoint = await viaEndpoint(postUrl, endpoint, {
  comment: cmpBodyA,
  author: `${MARK} 对照`,
  email: cmpA,
  consent: false,
});
const cmpNative = await viaNative(postUrl, {
  comment: cmpBodyB,
  author: `${MARK} 对照`,
  email: cmpB,
  consent: false,
});

check('端点那条成功', cmpEndpoint.status === 200, describe(cmpEndpoint));
check('原生那条成功并跳转', cmpNative.status === 302, cmpNative.error || `实际 ${cmpNative.status}`);

const cmpRowA = tryFx('status', `--comment=${cmpEndpoint.json?.id || 0}`);
const cmpRowB = tryFx('status', `--comment=${cmpNative.commentId || 0}`);

check(
  '两条路给出同一个待审状态',
  cmpRowA.found === true && cmpRowB.found === true && cmpRowA.approved === cmpRowB.approved,
  `端点 ${JSON.stringify(cmpRowA.approved)} / 表单 ${JSON.stringify(cmpRowB.approved)}`,
);

const mails = readMails(cmpMailMark);
const mailForA = mails.filter((m) => m.body.includes(cmpBodyA));
const mailForB = mails.filter((m) => m.body.includes(cmpBodyB));

check('端点那条发了通知邮件', mailForA.length > 0, `捕获到 ${mailForA.length} 封`);
check(
  '两条路的通知邮件收件人一致',
  mailForA.length > 0 && mailForB.length > 0 && mailForA[0].to === mailForB[0].to,
  `端点 ${mailForA[0]?.to || '(无)'} / 表单 ${mailForB[0]?.to || '(无)'}`,
);

// 没勾「记住我的信息」时核心会把 cookie 清掉——两条路都该清，不然「同一个结果」就不成立
check(
  '没勾「记住我」时两条路都不下发身份 cookie',
  !issuedCookie(cmpEndpoint.setCookies, `comment_author_email_${cookieHash}`)
    && !issuedCookie(cmpNative.setCookies, `comment_author_email_${cookieHash}`),
  `端点：${cmpEndpoint.setCookies.map((c) => String(c).split(';')[0]).join(' | ') || '(无)'}`
    + ` ／ 表单：${cmpNative.setCookies.map((c) => String(c).split(';')[0]).join(' | ') || '(无)'}`,
);

/* ================= 7. 无 JS 那条路照旧 ================= */

section('无 JS 那条路');

/*
 * 「禁用 JS」在这套基建里没有真开一个关掉脚本的浏览器去验（browser.mjs 只暴露视口、
 * 求值与截图，关脚本要另加一条 CDP 命令）。拆成它真正可能坏的两半：
 *   1. 这条路现在还会不会发评论（下面四条判定）；
 *   2. 这条路有没有被脚本那一套污染（表单还是不是原来那个表单、还去不去原来的地方）。
 *
 * 四种判定只断言**外部看得见的结果**：评论落没落库、页面有没有变成错误页。
 * 刻意**不**钉住「被挡下时正文是一片空白」——那正是下一件工单要改的地方，
 * 钉在这里会让下一件工单得反过来删这条断言。
 */
const nativeOkEmail = `submit-native-${RUN}@example.test`;
const nativeOkBody = `${MARK} 无脚本 正常 ${RUN}`;

const nativeOk = await viaNative(postUrl, {
  comment: nativeOkBody,
  author: `${MARK} 无脚本`,
  email: nativeOkEmail,
  consent: true,
});
check('没脚本时正常提交照旧成功', nativeOk.status === 302, nativeOk.error || `实际 ${nativeOk.status}`);
check(
  '那条真的入库了',
  tryFx('status', `--comment=${nativeOk.commentId}`).approved === '0',
  `id=${nativeOk.commentId}`,
);

const nativeTrap = await viaNative(postUrl, {
  comment: `${MARK} 无脚本 蜜罐 ${RUN}`,
  author: `${MARK} 无脚本`,
  email: nativeOkEmail,
  consent: true,
  extraFields: { yuki_comment_note: 'i-am-a-robot' },
});
check('没脚本时填了蜜罐发不出去', nativeTrap.status !== 302, `实际 ${nativeTrap.status}`);

const nativeFast = await viaNative(postUrl, {
  comment: `${MARK} 无脚本 太快 ${RUN}`,
  author: `${MARK} 无脚本`,
  email: nativeOkEmail,
  consent: true,
  settleMs: 0,
});
check('没脚本时提交太快发不出去', nativeFast.status !== 302, `实际 ${nativeFast.status}`);

const nativeNoToken = await viaNative(postUrl, {
  comment: `${MARK} 无脚本 缺令牌 ${RUN}`,
  author: `${MARK} 无脚本`,
  email: nativeOkEmail,
  consent: true,
  extraFields: { yuki_comment_token: '' },
});
check('没脚本时缺令牌发不出去', nativeNoToken.status !== 302, `实际 ${nativeNoToken.status}`);

check(
  '三种被挡下的一条都没入库',
  tryFx('by-email', `--email=${nativeOkEmail}`).count === 1,
  `那个邮箱名下 ${tryFx('by-email', `--email=${nativeOkEmail}`).count} 条（应只有那条正常的）`,
);

// 表单本身没被动过：还是去原生那个入口，字段还是那些
const formTag = (page0.body.match(/<form[^>]*id=["']commentform["'][^>]*>/i) || [''])[0];
check(
  '表单照旧提交到 WordPress 原生的入口',
  /wp-comments-post\.php/.test(formTag),
  formTag.slice(0, 160),
);
check(
  '蜜罐与令牌照旧在表单里',
  /name=["']yuki_comment_note["']/.test(page0.body)
    && /name=["']yuki_comment_token["']/.test(page0.body),
  '表单协议字段不见了',
);

/* ================= 8. 别的入口不受影响 ================= */

section('别的入口');

/*
 * 防垃圾守卫只该管「评论表单交上来的那一笔」。别的入口（REST、XML-RPC、定时任务、
 * 导入脚本）手上不该有蜜罐与令牌，按机器人处理只会把别处正常入库的评论静默吞掉。
 *
 * 四次探针各自把蜜罐填上，唯一差别是这次进程顶着哪个入口的身份。评论落不落库就是答案。
 */
const asFormPost = tryFx('guard-scope', '--context=form');

check(
  '表单那笔提交：守卫照旧挡下（REST 那条豁免没有把这条路让开）',
  asFormPost.landed === false,
  JSON.stringify(asFormPost).slice(0, 160),
);

for (const context of ['rest', 'xmlrpc', 'cron']) {
  const probeResult = tryFx('guard-scope', `--context=${context}`);

  check(
    `别的入口（${context}）：守卫照旧不管它，评论照常入库`,
    probeResult.landed === true,
    JSON.stringify(probeResult).slice(0, 200),
  );
}

// 命令行/导入脚本那条路（wp_new_comment，手上没有表单协议）
const imported = probe('comment', `--post=${setup.post_id}`, `--content=${MARK} 导入脚本进来的 ${RUN}`);
check(
  '导入脚本那条路照常入库',
  imported.comment_id > 0 && !imported.is_error,
  JSON.stringify(imported).slice(0, 160),
);

/* ================= 9. 真浏览器：页面不动，评论就地出现 ================= */

section('真浏览器');

/** 提交按钮禁用着没有——只好在请求真的在飞的时候问。 */
const disabledExpr = `(document.getElementById('submit') || document.querySelector('#commentform [type="submit"]')).disabled`;

/**
 * 开一个文章页，并确认表单真的在。
 *
 * 本地这个 PHP 内置服务器一次只处理一个请求，同一台机器上还开着别的会话在打它，
 * 排队久了会顶到超时——那样打开的是一张残缺的页面，后面每条断言都会以
 * 「东西不存在」的形式红，查起来离真相很远。所以这里当场问一句，并重试一次。
 */
async function openPost(browser, where = postUrl) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await newPage(browser);
    await page.goto(where);

    const there = await page.evaluate(`!!document.getElementById('commentform')`);

    if (there) {
      return page;
    }

    const stuckAt = await page.evaluate(`location.href`);
    await page.close();

    if (attempt === 2) {
      throw new Error(`文章页上没有 #commentform（停在 ${stuckAt}）`);
    }
  }

  throw new Error('开不出文章页');
}

/**
 * 往表单里填好、等够判定窗口、点提交。
 *
 * 判定窗口是「提交时刻 − 页面渲染时刻」不足 3 秒算机器人，所以要等；
 * 不等的话这一轮验的就成了「太快被挡下」。
 */
async function fillAndSubmit(page, { body, email, author = `${MARK} 浏览器访客`, consent = true, honeypot = '' }) {
  await page.evaluate(`(function () {
    var form = document.getElementById('commentform');
    form.querySelector('textarea[name="comment"]').value = ${JSON.stringify(body)};
    var a = form.querySelector('input[name="author"]');
    if (a) a.value = ${JSON.stringify(author)};
    var e = form.querySelector('input[name="email"]');
    if (e) e.value = ${JSON.stringify(email)};
    var c = form.querySelector('input[name="wp-comment-cookies-consent"]');
    if (c) c.checked = ${consent ? 'true' : 'false'};
    var trap = form.querySelector('input[name="yuki_comment_note"]');
    if (trap) trap.value = ${JSON.stringify(honeypot)};
  })()`);

  await sleep(3400);

  // 记号在同一页上：它还在，就说明中途没有重新加载
  await page.evaluate(`window.__yukiStillHere = 'yes';`);
  await page.evaluate(`(function () {
    var form = document.getElementById('commentform');
    if (form.requestSubmit) { form.requestSubmit(); } else { form.querySelector('[type="submit"]').click(); }
  })()`);
}

/** 轮询一个页面表达式，直到它满足条件。 */
async function waitFor(page, expression, done, tries = 60) {
  let last = null;

  for (let i = 0; i < tries; i++) {
    last = await page.evaluate(expression);
    if (done(last)) return last;
    await sleep(100);
  }

  return last;
}

// 浏览器只起一次，起不来就记一条 FAIL —— 但**报告照样要出得来**：前面那些 HTTP 断言
// 一条都不该因为无头 Edge 没起来而闷在肚子里（先前的写法把 launch() 放在 try 外面，
// 它一抛就只剩一段堆栈）。里面的几段各自再兜一次，某一段坏了不影响后面几段。
let browser = null;

try {
  browser = await launch();

  /* ---- 9a. 待审那条：就地出现、页面没动、提示跟着加一 ---- */

  try {
    const page = await openPost(browser);

    check(
      '脚本挂上了，端点地址也交到页面上了',
      await page.evaluate(`typeof window.yukiCommentSubmit === 'object' && !!window.yukiCommentSubmit.endpoint`),
      await page.evaluate(`JSON.stringify(window.yukiCommentSubmit || null)`),
    );

    const headingBefore = numberOf(await page.evaluate(
      `document.querySelector('.yuki-comment-count') ? document.querySelector('.yuki-comment-count').textContent : ''`,
    ));
    const noticeBefore = await page.evaluate(
      `document.querySelector('.yuki-pending-notice') ? document.querySelector('.yuki-pending-notice').textContent : ''`,
    );

    const browserBody = `${MARK} 浏览器 待审 ${RUN}`;
    const browserEmail = `submit-browser-${RUN}@example.test`;

    await fillAndSubmit(page, { body: browserBody, email: browserEmail });

    const appeared = await waitFor(
      page,
      `document.body.textContent.includes(${JSON.stringify(browserBody)})`,
      (seen) => seen === true,
    );

    const state = await page.evaluate(`(function () {
      var li = document.querySelector('.yuki-comment-list > li:last-child');
      var form = document.getElementById('commentform');
      var notice = document.querySelector('.yuki-pending-notice');
      var heading = document.querySelector('.yuki-comment-count');
      return {
        lastId: li ? li.id : '',
        pending: !!(li && li.querySelector('.comment-awaiting-moderation')),
        replyTo: !!(li && li.querySelector('.yuki-comment-reply-to')),
        textarea: form.querySelector('textarea[name="comment"]').value,
        author: (form.querySelector('input[name="author"]') || {}).value || '',
        email: (form.querySelector('input[name="email"]') || {}).value || '',
        notice: notice ? notice.textContent : '',
        heading: heading ? heading.textContent : '',
        noticeCount: document.querySelectorAll('.yuki-pending-notice').length,
        stillHere: window.__yukiStillHere,
      };
    })()`);

    check('新评论就地出现在页面上', appeared === true, '等了 6 秒也没出现');
    check(
      '全程没有重新加载页面',
      state.stillHere === 'yes',
      '页面上那枚记号不见了——说明整页重载过',
    );
    check('插进去的是那一条评论', /^comment-\d+$/.test(state.lastId), `最后一条：${state.lastId}`);
    check('它带着「等待审核」的标记', state.pending === true, JSON.stringify(state).slice(0, 200));
    check('待审提示出现了，且只有一条', state.noticeCount === 1 && !!state.notice, `提示数 ${state.noticeCount}，原文：${state.notice}`);
    check('提示的计数加到了 1', numberOf(state.notice) === 1, `提示原文：${state.notice}`);
    check(
      '评论计数**没有**因为一条待审评论而变',
      numberOf(state.heading) === headingBefore,
      `之前 ${headingBefore}，之后 ${numberOf(state.heading)}`,
    );
    check('提交成功后输入框清空了', state.textarea === '', `输入框里还剩 ${JSON.stringify(state.textarea)}`);
    check('作者名留着', state.author === `${MARK} 浏览器访客`, `作者名成了 ${JSON.stringify(state.author)}`);
    check('邮箱留着', state.email === browserEmail, `邮箱成了 ${JSON.stringify(state.email)}`);
    check(
      '顶层评论不带「回复 @谁」',
      state.replyTo === false,
      '凭空多了一句「回复 @谁」',
    );

    // 刷新一下：核心认的是提交那一刻发出的 cookie，因此看到的东西该和在页面上就地
    // 画出来的一致——提示的原话尤其如此（两边只有服务端一份）。
    await page.goto(postUrl);
    const afterReload = await page.evaluate(`(function () {
      var notice = document.querySelector('.yuki-pending-notice');
      return { notice: notice ? notice.textContent.trim() : '', seen: document.body.textContent.includes(${JSON.stringify(browserBody)}) };
    })()`);

    check('刷新之后本人还看得见自己那条', afterReload.seen === true, '刷新之后就没了');
    check(
      '刷新之后那句提示与就地画出来的一字不差',
      afterReload.notice === state.notice.trim(),
      `就地：${JSON.stringify(state.notice.trim())} / 刷新后：${JSON.stringify(afterReload.notice)}`,
    );

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（无头 Edge）', false, err.message);
  }

  /* ---- 9b. 已公开那条：计数加一 ---- */

  try {
    const page = await openPost(browser);

    const headingBefore = numberOf(await page.evaluate(
      `document.querySelector('.yuki-comment-count') ? document.querySelector('.yuki-comment-count').textContent : ''`,
    ));

    const bodyA = `${MARK} 浏览器 已公开 ${RUN}`;
    await fillAndSubmit(page, { body: bodyA, email: knownEmail, author: setup.known_author });

    const appeared = await waitFor(
      page,
      `document.body.textContent.includes(${JSON.stringify(bodyA)})`,
      (seen) => seen === true,
    );
    check('已公开的新评论也就地出现', appeared === true, '等了 6 秒也没出现');

    const after = await page.evaluate(`(function () {
      var li = document.querySelector('.yuki-comment-list > li:last-child');
      var heading = document.querySelector('.yuki-comment-count');
      return {
        pending: !!(li && li.querySelector('.comment-awaiting-moderation')),
        heading: heading ? heading.textContent : '',
        stillHere: window.__yukiStillHere,
      };
    })()`);

    check('它不带待审标记', after.pending === false, '已公开的那条却带着「等待审核」');
    check('页面同样没有重新加载', after.stillHere === 'yes', '记号不见了');
    check(
      '评论计数加了 1',
      numberOf(after.heading) === headingBefore + 1,
      `之前 ${headingBefore}，之后 ${numberOf(after.heading)}`,
    );

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（第二趟：已公开）', false, err.message);
  }

  /* ---- 9c. 请求在路上时按钮点不动 ---- */

  try {
    const page = await openPost(browser);

    // 页面里把 fetch 拖慢一点：不然「按钮禁用」这段窗口太短，根本问不到
    await page.evaluate(`(function () {
      var real = window.fetch;
      window.fetch = function () {
        var args = arguments;
        return new Promise(function (r) { setTimeout(r, 1200); }).then(function () { return real.apply(window, args); });
      };
    })()`);

    const slowBody = `${MARK} 浏览器 慢一点 ${RUN}`;
    await fillAndSubmit(page, { body: slowBody, email: knownEmail });

    await sleep(400);
    check('请求还在路上时提交按钮点不动', (await page.evaluate(disabledExpr)) === true, '按钮还能点');

    const landed = await waitFor(
      page,
      `document.body.textContent.includes(${JSON.stringify(slowBody)})`,
      (seen) => seen === true,
    );
    check('那笔提交还是落定了', landed === true, '等不到');
    check('落定之后按钮又点得动了', (await page.evaluate(disabledExpr)) === false, '按钮一直禁用着');

    // 8c 顺带：网络出问题时表单退回提交前的样子，写的内容不丢
    await page.evaluate(`window.yukiCommentSubmit.endpoint = 'http://127.0.0.1:9/yuki-dead';`);
    const keepBody = `${MARK} 浏览器 网络断了 ${RUN}`;
    await page.evaluate(`(function () {
      document.getElementById('commentform').querySelector('textarea[name="comment"]').value = ${JSON.stringify(keepBody)};
    })()`);
    await sleep(3400);
    await page.evaluate(`window.__yukiStillHere = 'yes';`);
    await page.evaluate(`(function () {
      var form = document.getElementById('commentform');
      if (form.requestSubmit) { form.requestSubmit(); } else { form.querySelector('[type="submit"]').click(); }
    })()`);

    const reEnabled = await waitFor(page, disabledExpr, (disabled) => disabled === false, 40);
    check('网络出问题时按钮退回可用', reEnabled === false, '按钮一直禁用着');
    check(
      '网络出问题时我写的东西没丢',
      (await page.evaluate(`document.getElementById('commentform').querySelector('textarea[name="comment"]').value`)) === keepBody,
      '输入框被清空了',
    );
    check(
      '那条没有出现在页面上',
      (await page.evaluate(`document.body.textContent.includes(${JSON.stringify(keepBody)})`)) === false,
      '没提交成功却显示出来了',
    );
    check('页面依然没有重新加载', (await page.evaluate(`window.__yukiStillHere`)) === 'yes', '记号不见了');

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（第三趟：提交中和出错时）', false, err.message);
  }

  /* ---- 9d. 填了蜜罐时静默退回 ---- */

  try {
    const page = await openPost(browser);

    const trapBody = `${MARK} 浏览器 蜜罐 ${RUN}`;
    await fillAndSubmit(page, { body: trapBody, email: knownEmail, honeypot: 'i-am-a-robot' });

    // 服务端一句不说，页面上就不该多出任何一句话，只把表单退回去
    await sleep(1500);

    const afterTrap = await page.evaluate(`(function () {
      return {
        text: document.getElementById('commentform').querySelector('textarea[name="comment"]').value,
        shown: document.body.textContent.includes(${JSON.stringify(trapBody)}),
        stillHere: window.__yukiStillHere,
        disabled: ${disabledExpr},
      };
    })()`);

    check('被当成机器人时不显示那句话', afterTrap.shown === false, '居然显示出来了');
    check('我写的内容留着', afterTrap.text === trapBody, `输入框里是 ${JSON.stringify(afterTrap.text)}`);
    check('按钮退回可用', afterTrap.disabled === false, '按钮还禁用着');
    check('页面依然没有重新加载', afterTrap.stillHere === 'yes', '记号不见了');

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（第四趟：蜜罐）', false, err.message);
  }

  /* ---- 9e. 服务端说了话，就把它放到页面上 ---- */

  try {
    const page = await openPost(browser);

    // 空正文：核心会拒掉并给一句给人看的话。脚本这条路上不能把它吞掉
    await fillAndSubmit(page, { body: '', email: knownEmail, author: setup.known_author });

    const shown = await waitFor(
      page,
      `(function () { var e = document.querySelector('.yuki-comment-error'); return e ? e.textContent : ''; })()`,
      (text) => !!text,
      40,
    );

    check('服务端说了话，页面上就有一句', !!shown, '等了 4 秒也没有那句话');

    const state = await page.evaluate(`(function () {
      var e = document.querySelector('.yuki-comment-error');
      return {
        text: e ? e.textContent : '',
        count: document.querySelectorAll('.yuki-comment-error').length,
        disabled: ${disabledExpr},
        stillHere: window.__yukiStillHere,
      };
    })()`);

    check('那句话就是服务端给的那句（不是脚本自己编的）', /请|必须|文字|Error/.test(state.text), `页面上写着：${JSON.stringify(state.text)}`);
    check('只放一句，不叠着放', state.count === 1, `页面上有 ${state.count} 句`);
    check('出错时按钮退回可用', state.disabled === false, '按钮还禁用着');
    check('页面没有重新加载', state.stillHere === 'yes', '记号不见了');

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（第五趟：服务端说的话）', false, err.message);
  }

  /* ---- 9f. 这篇文章还没有评论：列表与计数一起补上 ---- */

  try {
    const blank = tryFx('blank-post');

    check(
      '造得出一篇没有评论的文章',
      blank.post_url && blank.comments === 0,
      JSON.stringify(blank).slice(0, 160),
    );

    const page = await openPost(browser, blank.post_url);

    const before = await page.evaluate(`(function () {
      return {
        form: !!document.getElementById('commentform'),
        list: !!document.querySelector('.yuki-comment-list'),
        heading: !!document.querySelector('.yuki-comment-count'),
      };
    })()`);

    check(
      '还没人评论时，页面上确实没有列表、也没有那句计数',
      before.form === true && before.list === false && before.heading === false,
      JSON.stringify(before),
    );

    const blankBody = `${MARK} 空白文章的头一条 ${RUN}`;
    await fillAndSubmit(page, { body: blankBody, email: knownEmail, author: setup.known_author });

    const after = await waitFor(
      page,
      `(function () {
        var list = document.querySelector('.yuki-comment-list');
        var li = list ? list.lastElementChild : null;
        var heading = document.querySelector('.yuki-comment-count');
        return {
          seen: document.body.textContent.includes(${JSON.stringify(blankBody)}),
          listClass: list ? list.className : '',
          lastId: li ? li.id : '',
          heading: heading ? heading.textContent : '',
          headingRightBeforeList: !!(heading && list && heading.nextElementSibling === list),
          stillHere: window.__yukiStillHere,
        };
      })()`,
      (state) => state.seen === true,
    );

    check('那一条就地出现了', after.seen === true, '等了 6 秒也没出现');
    check('列表是脚本补出来的', after.listClass === 'yuki-comment-list', `列表的类：${JSON.stringify(after.listClass)}`);
    check('它就是列表里那一条', /^comment-\d+$/.test(after.lastId), `最后一条：${after.lastId}`);
    check(
      '计数那句也补出来了，而且排在列表前面（与没脚本时的次序一致）',
      after.headingRightBeforeList === true,
      JSON.stringify(after).slice(0, 220),
    );
    check('计数是 1', numberOf(after.heading) === 1, `页面上写着：${JSON.stringify(after.heading)}`);
    check('页面没有重新加载', after.stillHere === 'yes', '记号不见了');

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（空白文章那一趟）', false, err.message);
  }

  /* ---- 9g. 核心自己判成垃圾的那一条，页面上不画出来 ---- */

  try {
    const page = await openPost(browser);

    const listBefore = await page.evaluate(`document.querySelectorAll('.yuki-comment-list > li').length`);

    // 页面已经开好了，再设关键词：页面本身与它无关，省得把「改了全站设置」和「页面渲染」搅在一起
    const armed = tryFx('blocklist', `--key=${BLOCK_WORD}`);
    check('关键词设上了', armed.now === BLOCK_WORD, JSON.stringify(armed).slice(0, 140));

    const blockedBody = `${MARK} 浏览器 命中关键词 ${BLOCK_WORD}`;
    await fillAndSubmit(page, { body: blockedBody, email: `submit-browser-blocked-${RUN}@example.test` });

    const reEnabled = await waitFor(page, disabledExpr, (disabled) => disabled === false, 40);
    await sleep(400);

    const after = await page.evaluate(`(function () {
      return {
        shown: document.body.textContent.includes(${JSON.stringify(blockedBody)}),
        text: document.getElementById('commentform').querySelector('textarea[name="comment"]').value,
        said: !!document.querySelector('.yuki-comment-error'),
        items: document.querySelectorAll('.yuki-comment-list > li').length,
        stillHere: window.__yukiStillHere,
      };
    })()`);

    check('按钮退回可用', reEnabled === false, '按钮一直禁用着');
    check('页面上没有画出一条「看着发出去了」的评论', after.shown === false, '居然画出来了');
    check('列表里没有多出来', after.items === listBefore, `之前 ${listBefore} 条，之后 ${after.items} 条`);
    check('一句提示也不给（与守卫那两种判定一样：什么也不说）', after.said === false, '多出了一句话');
    check('我写的内容留着', after.text === blockedBody, `输入框里是 ${JSON.stringify(after.text)}`);
    check('页面没有重新加载', after.stillHere === 'yes', '记号不见了');

    await page.close();
  } catch (err) {
    check('浏览器里跑到底（核心判垃圾那一趟）', false, err.message);
  } finally {
    // 全站设置：无论上面走到哪一步都要还原
    const restored = tryFx('blocklist');
    check('关键词还原了', restored.now === '', `现在是 ${JSON.stringify(restored.now)}`);
  }

} catch (err) {
  check('无头浏览器起得来', false, err.message);
} finally {
  if (browser) {
    await browser.close();
  }
}

/* ================= 收尾 ================= */

const purged = tryFx('purge');
note(`清理 ${purged.comments ?? '?'} 条评论、${purged.posts ?? '?'} 篇文章`);
note(`本轮标记 ${MARK}，run=${RUN}`);

report();
