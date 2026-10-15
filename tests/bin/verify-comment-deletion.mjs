// 工单 07 的验收：访客删除自己的评论。
//
// seam 只有 HTTP：提交评论 → 从邮件里取出链接 → 打开链接 → 确认 → 回文章页看结果。
// 令牌怎么签发、存在哪、怎么校验，一律不看。
//
// 全程用一个**不带任何 cookie、未登录**的客户端（lib.mjs 的 get/postForm 都不带凭据），
// 所以「全程不要求注册或登录」不是靠断言声明出来的，是这条流程本身证明的。
//
// 页面用三个**正向**标记区分状态，这一点是有意的：
//   yuki-delete-confirm   确认页
//   yuki-delete-invalid   链接无效 / 过期 / 已用过
//   yuki-delete-done      删除完成
// 只断言「页面上没有『确认删除』字样」是**假绿**——页面根本没渲染出来时它照样成立。
// 第一版就是这么写的，红的时候一堆「无效」断言其实是「页面是空的」，什么也没验到。
//
// 用法: node tests/bin/verify-comment-deletion.mjs

import { SITE, get, linksIn, markMails, postForm, probe, probeScript, readMails, submitComment } from './lib.mjs';
import { check, note, report, section } from './report.mjs';

const FX = 'comment-deletion-fixtures.php';
const fx = (...args) => probeScript(FX, ...args);

const tryFx = (...args) => {
  try {
    return fx(...args);
  } catch (err) {
    return { error: err.message };
  }
};

/** 测试评论的正文标记，清理时按它找。 */
const MARK = 'YUKI-DELETE-TEST';
const RUN = Date.now();

/**
 * 取一个地址 / 往一个地址提交。地址为空时（上一步没拿到）给个明确的失败壳，
 * 而不是把空串丢给 fetch——那样会抛 Invalid URL，整轮验收连堆栈一起结束，
 * 前面累积的断言一条都打不出来。
 */
const fetchUrl = async (url) => (url ? get(url) : { status: 0, body: '' });
const postUrlSafe = async (url, fields) => (url ? postForm(url, fields) : { status: 0, body: '' });

/**
 * 这一页是什么状态。只认正向标记：
 * 页面没渲染出来、渲染成别的东西、或者标记没了，都会落到 'other'，于是断言红。
 */
function pageState(res) {
  if (!res || res.status !== 200) return `http-${(res && res.status) ?? '无响应'}`;
  if (/yuki-delete-done/.test(res.body)) return 'done';
  if (/yuki-delete-confirm/.test(res.body)) return 'confirm';
  if (/yuki-delete-invalid/.test(res.body)) return 'invalid';
  return 'other';
}

/** 从邮件正文里挑出删除链接：复用 lib.mjs 的取链接，再按参数名筛一层。 */
const deleteLinksIn = (text) => linksIn(text).filter((url) => url.includes('yuki_delete='));

/** 取链接里的一个查询参数。 */
function paramOf(url, key) {
  try {
    return new URL(url).searchParams.get(key) || '';
  } catch {
    return '';
  }
}

/** 从邮箱里挑一封发给这位访客、正文里带删除链接的信。 */
const deletionMailFor = (mails, mark) => mails.find((m) => m.body.includes(mark) && deleteLinksIn(m.body).length > 0) || null;

/**
 * 走一次完整提交：发评论、从捕获的邮件里取出删除链接。
 * 每条评论用**各自不同的**作者名，这样「删除后作者名也从页面上消失」才验得了，
 * 也才不会被别的测试评论干扰。
 */
async function submitOne(postUrl, label, ascii) {
  // 作者名与正文必须是**两个不同的字符串**。写成一样的话，「正文没了」与「作者名没了」
  // 就是同一次计数的两个名字，后者不提供任何额外信息——而「删除后不留可见的空壳」
  // 要的恰恰是「正文没了、作者名也还在吗」这件独立的事。
  const author = `${MARK} 作者 ${label} ${RUN}`;
  // 邮箱的本地部分只能用 ASCII：is_email() 会拒掉带中文的地址，那样测试就不是在验主题而是
  // 在验「主题不肯给一个不合法地址发信」——第一版就是栽在这里，红得很有迷惑性。
  const email = `yuki-del-${ascii}-${RUN}@example.test`.toLowerCase();
  const body = `${MARK} 正文 ${label} ${RUN}`;

  const mark = markMails();
  const res = await submitComment(postUrl, { comment: body, author, email });

  const mails = readMails(mark);
  const mail = deletionMailFor(mails, body);
  const link = mail ? deleteLinksIn(mail.body)[0] : '';

  return {
    author,
    body,
    email,
    res,
    mail,
    link,
    commentId: Number(paramOf(link, 'yuki_delete')) || 0,
    token: paramOf(link, 'token'),
  };
}

/** 这条评论在文章页上出现了几次：正文与作者名各数一遍。 */
async function onPostPage(postUrl, { body, author }) {
  const page = await fetchUrl(postUrl);
  return {
    status: page.status,
    bodyHits: page.body.split(body).length - 1,
    authorHits: page.body.split(author).length - 1,
  };
}

const doConfirm = (link) =>
  postUrlSafe(link, {
    yuki_delete: paramOf(link, 'yuki_delete'),
    token: paramOf(link, 'token'),
    yuki_delete_confirm: '1',
  });

/* ================= 前提 ================= */

section('前提');

const info = probe('site-info');
check('拿得到可评论的文章', info.post_id > 0 && !!info.post_url, JSON.stringify(info).slice(0, 160));

const postUrl = info.post_url;

/* ================= 1. 提交后收到带删除链接的邮件 ================= */

section('邮件里的删除链接');

const a = await submitOne(postUrl, '甲', 'a');
check('评论提交被接受', a.res.status === 302 || a.res.status === 200, `实际 ${a.res.status} ${a.res.location}`);
check('收到了带删除链接的邮件', !!a.link, `该访客的邮件里 ${deleteLinksIn(a.mail ? a.mail.body : '').length} 条删除链接`);
check('链接指向一条具体的评论', a.commentId > 0, `yuki_delete=${paramOf(a.link, 'yuki_delete')}`);
check('链接带令牌', a.token.length >= 16, `令牌长度 ${a.token.length}`);

// 让它真的出现在文章页上，后面「删除之后不再可见」才验得动
const approved = tryFx('approve', `--comment=${a.commentId}`);
check('评论已通过审核', approved.ok === true && approved.approved === 1, JSON.stringify(approved).slice(0, 120));

const beforeOpen = await onPostPage(postUrl, a);
check('删除之前评论可见', beforeOpen.bodyHits > 0 && beforeOpen.authorHits > 0, `正文 ${beforeOpen.bodyHits} 次、作者名 ${beforeOpen.authorHits} 次`);

/* ================= 2. 打开链接是确认页，不是直接删除 ================= */

section('先到确认页');

const confirmPage = await fetchUrl(a.link);
check('删除链接打开正常', confirmPage.status === 200, `实际 ${confirmPage.status}`);
check('不需要登录就能打开', !/wp-login\.php/.test(confirmPage.body), '页面把人往登录页带');
check('看到的是确认页', pageState(confirmPage) === 'confirm', `实际状态 ${pageState(confirmPage)}`);
check('确认页上有可点的确认控件', /yuki_delete_confirm/.test(confirmPage.body), '页面里没有确认用的字段');

// 整件事的要害：邮件客户端和聊天软件会预取链接，预取就删等于用户还没看到邮件评论就没了
const afterOpen = await onPostPage(postUrl, a);
check('只打开链接（预取）不会删掉评论', afterOpen.bodyHits > 0, `正文出现 ${afterOpen.bodyHits} 次`);

/* ================= 3. 确认之后评论被移除 ================= */

section('确认删除');

const confirmed = await doConfirm(a.link);
check('确认之后看到的是完成页', pageState(confirmed) === 'done', `实际状态 ${pageState(confirmed)}`);

const afterDelete = await onPostPage(postUrl, a);
check('确认之后评论不再可见', afterDelete.bodyHits === 0, `正文仍出现 ${afterDelete.bodyHits} 次`);
check('删除后不留可见的空壳', afterDelete.authorHits === 0, `作者名 ${a.author} 仍出现 ${afterDelete.authorHits} 次`);

const gone = tryFx('meta', `--comment=${a.commentId}`);
check('那条评论确实不存在了', gone.exists === false, JSON.stringify(gone).slice(0, 120));

/* ================= 4. 同一条链接第二次用无效 ================= */

section('链接一次性');

/*
 * 这里只验得到「第二次使用无效」，**验不出**「令牌是用过才失效的」——因为成功删除会把
 * 评论一起删掉，第二次失败在「评论不存在」那一关，两件事在这个实现里是同一次观察。
 *
 * 之所以不硬造一个「评论还在、令牌已作废」的状态来验：这个实现里那种状态不存在。
 * `yuki_comment_delete_perform` 先撤令牌再删评论，所以就算删除那一步失败，令牌也已经
 * 作废了（宁可留下一条还在、链接已死，也不留一条能用的链接）。把这条写清楚，
 * 是为了让下一个读的人知道这里的覆盖边界在哪，而不是以为它验了两件事。
 */
const reused = await doConfirm(a.link);
check('第二次使用得到「无效」而不是完成页', pageState(reused) === 'invalid', `实际状态 ${pageState(reused)}`);

/* ================= 5. 一条评论的令牌不能删另一条 ================= */

section('令牌与评论一一绑定');

const b = await submitOne(postUrl, '乙', 'b');
const bApproved = tryFx('approve', `--comment=${b.commentId}`);
check('第二条评论已就绪', bApproved.approved === 1, JSON.stringify(bApproved).slice(0, 120));
check('第二条评论本来就是可见的', (await onPostPage(postUrl, b)).bodyHits > 0, '基线不成立，后面的断言没有意义');

/*
 * 这里必须用一条**还活着**的评论的令牌。
 *
 * 甲那条此时已经被删掉了，拿它的令牌去打乙，失败的原因是「评论不存在」——
 * 于是「令牌与评论一一绑定」这条根本没被验到：就算实现把摘要存成站点级的、
 * 任何一发还没作废的令牌都能删任何一条评论，这个用例照样是绿的。
 *
 * 所以另发一条丁，专门提供一枚仍然有效的令牌。
 */
const d = await submitOne(postUrl, '丁', 'd');
const dApproved = tryFx('approve', `--comment=${d.commentId}`);
check('第四条评论已就绪（提供一枚仍然有效的令牌）', dApproved.approved === 1 && d.token.length > 0, JSON.stringify(dApproved).slice(0, 120));

const crossed = `${SITE}/?yuki_delete=${b.commentId}&token=${encodeURIComponent(d.token)}`;
const crossPage = await fetchUrl(crossed);
check('拿丁的有效令牌打乙：显示无效', pageState(crossPage) === 'invalid', `实际状态 ${pageState(crossPage)}`);

const crossConfirmed = await doConfirm(crossed);
check('拿丁的有效令牌打乙：确认也无效', pageState(crossConfirmed) === 'invalid', `实际状态 ${pageState(crossConfirmed)}`);

const bAfterCross = await onPostPage(postUrl, b);
check('跨评论尝试没有删掉乙', bAfterCross.bodyHits > 0, `正文出现 ${bAfterCross.bodyHits} 次`);
check('丁自己也没被牵连', (await onPostPage(postUrl, d)).bodyHits > 0, '丁被删掉了');

/* ================= 6. 不带有效令牌无法删除 ================= */

section('没有令牌就删不掉');

/*
 * 先确认这条评论还在。不做这一步的话，本节的「无效」断言会在**评论已经不存在**时
 * 静默通过——令牌再烂也过不了「评论还在吗」那一关，于是页面照样是 invalid。
 * 变异测试里就撞见了：上一节把评论删掉之后，这一节的断言全绿，什么也没验到。
 */
const bBaseline = (await onPostPage(postUrl, b)).bodyHits;
check('第三条评论仍是可见的基线', bBaseline > 0, `正文出现 ${bBaseline} 次`);

const forged = `${SITE}/?yuki_delete=${b.commentId}&token=deadbeefdeadbeefdeadbeef`;
const forgedPage = await fetchUrl(forged);
check('凭空编的令牌显示无效', pageState(forgedPage) === 'invalid', `实际状态 ${pageState(forgedPage)}`);

const forgedConfirmed = await doConfirm(forged);
check('伪造令牌确认也无效', pageState(forgedConfirmed) === 'invalid', `实际状态 ${pageState(forgedConfirmed)}`);

const noToken = await fetchUrl(`${SITE}/?yuki_delete=${b.commentId}`);
check('不带令牌显示无效', pageState(noToken) === 'invalid', `实际状态 ${pageState(noToken)}`);

check('以上尝试都没有删掉评论', (await onPostPage(postUrl, b)).bodyHits > 0, '评论被删掉了');

/* ================= 7. 过期的链接无效 ================= */

section('链接会过期');

const expired = tryFx('expire', `--comment=${b.commentId}`);
// had_key 为假说明键名对不上——这条会红，而不是静默地验了个寂寞
check('令牌确实带着过期时间', expired.had_key === true, `那条评论的元数据键 ${JSON.stringify(expired.meta_keys)}`);
check('已把过期时间改到过去', typeof expired.seconds_left === 'number' && expired.seconds_left < 0, `剩余 ${expired.seconds_left} 秒`);

const expiredPage = await fetchUrl(b.link);
check('过期链接显示无效', pageState(expiredPage) === 'invalid', `实际状态 ${pageState(expiredPage)}`);

const expiredConfirmed = await doConfirm(b.link);
check('过期链接确认也无效', pageState(expiredConfirmed) === 'invalid', `实际状态 ${pageState(expiredConfirmed)}`);
check('过期链接删不掉评论', (await onPostPage(postUrl, b)).bodyHits > 0, '评论被删掉了');

/* ================= 8. 没过期的照常可用 ================= */

section('没过期的照常可用');

const c = await submitOne(postUrl, '丙', 'c');
const cApproved = tryFx('approve', `--comment=${c.commentId}`);
check('第三条评论已就绪', cApproved.approved === 1, JSON.stringify(cApproved).slice(0, 120));

const cPage = await fetchUrl(c.link);
check('没过期的链接给出确认页', pageState(cPage) === 'confirm', `实际状态 ${pageState(cPage)}`);

const cConfirmed = await doConfirm(c.link);
const cAfter = await onPostPage(postUrl, c);
check('没过期的链接能删掉', pageState(cConfirmed) === 'done', `实际状态 ${pageState(cConfirmed)}`);
check('第三条评论确实没了', cAfter.bodyHits === 0, `正文出现 ${cAfter.bodyHits} 次`);

/* ================= 收尾 ================= */

const purged = tryFx('purge');
note(`清理测试评论 ${purged.removed ?? '?'} 条，剩余 ${purged.left ?? '?'} 条`);
note(`全程未登录：${SITE} 的删除链接由一个不带任何 cookie 的客户端走通`);

report();
