// 工单 05 的验收：待审评论对本人可见。
//
// seam 只有 HTTP：提交 → 看页面 → 换个身份再看 → 批准 → 再看。
// 「身份」用的是 WordPress 原生的匿名评论 cookie，不是我们自己造的东西。
//
// 两条身份的走法都要验，因为核心对它们的凭证不一样：
//   - 不勾「记住我的信息」→ 核心不下发 cookie，但会在跳转地址里带上 unapproved + hash，
//     那套只在**提交后 10 分钟内**有效；
//   - 勾了 → 核心下发评论者 cookie，之后的访问靠它认人。
//
// **可见性整件事都是核心做的**，主题一行都没加：comments_template() 会把
// wp_get_unapproved_comment_author_email() 的结果塞进 include_unapproved，而那个函数
// 在没有跳转参数时会退回读评论者 cookie（wp-includes/comment.php:2108）。
// 主题补的只有「页面上那句提示」——而且提示数的是**已经在页面上的**那几条待审评论，
// 所以它不可能比列表多显示出什么。
//
// 用法: node tests/bin/verify-comment-pending.mjs

import { cookieHeaderFrom, get, probeScript, submitComment } from './lib.mjs';
import { check, note, report, section } from './report.mjs';

const FX = 'comment-pending-fixtures.php';
const fx = (...args) => probeScript(FX, ...args);

const tryFx = (...args) => {
  try {
    return fx(...args);
  } catch (err) {
    return { error: err.message };
  }
};

const MARK = 'YUKI-PENDING-TEST';
const RUN = Date.now();

const fetchUrl = async (url, options) => (url ? get(url, options) : { status: 0, body: '', setCookies: [] });

/** 这一页上有没有「等待审核」的提示（用正向标记认，不用「没有某某字样」）。 */
const hasPendingNotice = (html) => /yuki-pending-notice/.test(html);

/** 提示的原话，用来检查它有没有承诺「已经公开」。 */
function noticeText(html) {
  const m = html.match(/<p[^>]*class="[^"]*yuki-pending-notice[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
}

/**
 * 以某个身份提交一条评论。
 * consent 决定核心下不下发评论者 cookie——也就是「同一身份」这件事有没有凭证。
 */
async function submitAs(postUrl, { label, email, consent }) {
  const author = `${MARK} 访客 ${label} ${RUN}`;
  const body = `${MARK} 正文 ${label} ${RUN}`;
  const blank = { status: 0, body: '', location: '', setCookies: [] };

  let res = blank;
  let error = '';

  // 提交这一步要自己兜住异常。它一抛，整轮验收会以堆栈结束、**前面累积的断言一条都打不出来**
  // ——我实际遇到过一次：同一台机器上还有别的会话在打同一个 PHP 内置服务器，
  // 它一次只处理一个请求，排队久了就会顶到请求超时。那种情况该显示成一条 FAIL，
  // 而不是让人以为脚本坏了。
  try {
    res = await submitComment(postUrl, { comment: body, author, email, consent });
  } catch (err) {
    error = err.message;
  }

  return {
    author,
    body,
    email,
    res,
    error,
    location: res.location,
    cookie: cookieHeaderFrom(res.setCookies),
    commentId: Number((res.location.match(/unapproved=(\d+)/) || [])[1]) || 0,
  };
}

/* ================= 前提 ================= */

section('前提');

// 用自己建的文章，不借「最新一篇允许评论的文章」——那篇常常是别的会话的造数文章，
// 而它们的收尾会把它删掉，删在我这一轮中间就会把一堆断言打成「东西不存在」
const own = tryFx('post');
check('拿得到本工单自己的文章', own.id > 0 && own.comment_status === 'open', own.error || JSON.stringify(own).slice(0, 160));

const postUrl = own.url;
const stamp = RUN;

/* ================= 1. 提交之后页面上出现待审提示 ================= */

section('提交后的提示');

// 甲：不勾「记住我的信息」，走核心那套 unapproved + hash 的跳转
const jia = await submitAs(postUrl, { label: '甲', email: `yuki-pend-a-${stamp}@example.test`, consent: false });

check('提交成功并跳转', jia.res.status === 302, jia.error || `实际 ${jia.res.status}`);
check('跳转地址带上了待审标识', jia.commentId > 0, `Location: ${jia.location}`);
check('评论确实进了待审队列', tryFx('status', `--comment=${jia.commentId}`).approved === '0', '状态不是 0');

// 跟着那次跳转访问（此时还没有任何 cookie）
const afterPost = await fetchUrl(jia.location);
check('提交后落地页正常', afterPost.status === 200, `实际 ${afterPost.status}`);
check('提交后页面上有明确的待审提示', hasPendingNotice(afterPost.body), `落地页 HTML 长度 ${afterPost.body.length}`);
check('提交后能看到自己那条评论', afterPost.body.includes(jia.body), '评论正文没出现');

const text = noticeText(afterPost.body);
check('提示说的是「在等审核」', /等待审核|待审核/.test(text), `提示原文：${text}`);
check('提示没有承诺已经公开', !/已发布|已公开|发表成功|已经显示/.test(text), `提示原文：${text}`);

/* ================= 2. 带同一身份再次访问也看得到 ================= */

section('同一身份再次访问');

// 乙：勾上「记住我的信息」，核心会下发评论者 cookie
const yi = await submitAs(postUrl, { label: '乙', email: `yuki-pend-b-${stamp}@example.test`, consent: true });

check('提交成功并跳转', yi.res.status === 302, yi.error || `实际 ${yi.res.status}`);
check('核心下发评论者身份 cookie', yi.cookie.length > 0, `Set-Cookie: ${JSON.stringify(yi.res.setCookies).slice(0, 120)}`);
check('带了「记住我」就不再用跳转参数兜底', !/unapproved=/.test(yi.location), `Location: ${yi.location}`);

// 勾了「记住我」的跳转里没有 unapproved 参数，评论 id 得另外问一声
const bInfo = tryFx('pending', `--email=${yi.email}`);
const bIds = bInfo.ids || [];
yi.commentId = bIds[0] || 0;
// 失败时把那个邮箱名下所有评论的状态一并报出来：「没找到」可能是没入库、被通过了、
// 被当成垃圾了、或者被谁删了，只报一句 0 条接下来只能靠猜
check('问得到那条待审评论的 id', yi.commentId > 0, `待审 ids=${JSON.stringify(bIds)}；该邮箱名下全部评论：${JSON.stringify(bInfo.all)}`);

// 关键一步：**不带任何跳转参数**，只带 cookie，直接访问文章页
const revisit = await fetchUrl(postUrl, { cookie: yi.cookie });
check('再次访问正常', revisit.status === 200, `实际 ${revisit.status}`);
check('带同一身份能看到自己那条待审评论', revisit.body.includes(yi.body), '评论正文没出现');
check('再次访问也有待审提示', hasPendingNotice(revisit.body), '页面上找不到待审提示');

const bPending = tryFx('pending', `--email=${yi.email}`);
check('旁证：那个邮箱确实还有一条在待审', bPending.count === 1, `实际 ${bPending.count} 条`);

/* ================= 3. 别的访客看不到 ================= */

section('别的访客看不到');

// 一个全新的、没有任何 cookie 的客户端
const stranger = await fetchUrl(postUrl);
check('陌生人访问正常', stranger.status === 200, `实际 ${stranger.status}`);
check('陌生人看不到那条待审评论', !stranger.body.includes(yi.body), '待审评论被别人看见了');
check('陌生人看不到待审提示', !hasPendingNotice(stranger.body), '陌生人看到了待审提示');

// 另一个身份（cookie 属于丙，不是乙）
const bing = await submitAs(postUrl, { label: '丙', email: `yuki-pend-c-${stamp}@example.test`, consent: true });
const otherIdentity = await fetchUrl(postUrl, { cookie: bing.cookie });
check('拿着别人的身份看不到乙那条', !otherIdentity.body.includes(yi.body), '换了身份还是看见了');
check('拿着别人的身份只看到自己的提示', hasPendingNotice(otherIdentity.body) && otherIdentity.body.includes(bing.body), '丙看不到自己那条');

/* ================= 4. 批准之后回到正常 ================= */

section('批准之后');

const approved = tryFx('approve', `--comment=${yi.commentId}`);
check('批准成功', approved.approved === '1', JSON.stringify(approved).slice(0, 120));

const afterApprove = await fetchUrl(postUrl, { cookie: yi.cookie });
check('批准后访问正常', afterApprove.status === 200, `实际 ${afterApprove.status}`);

/*
 * 这一条偶尔会红（同一台机器上还有两个会话在跑各自的测试，共用同一个站点）。
 * 失败信息里带上「那条评论现在到底什么状态」与页面上的评论条数，
 * 好判断是「没渲染」还是「被别的什么东西删了」——只写一句「看不到」的话只能靠猜。
 */
const yiAfter = tryFx('pending', `--email=${yi.email}`);
const pageComments = (afterApprove.body.match(/class="comment-body"/g) || []).length;
check(
  '批准后评论照常可见',
  afterApprove.body.includes(yi.body),
  `页面 ${afterApprove.status}，页面上评论 ${pageComments} 条；该邮箱名下：${JSON.stringify(yiAfter.all)}`,
);
check('批准后待审提示消失', !hasPendingNotice(afterApprove.body), '批准了还挂着待审提示');

const bAfterApprove = tryFx('pending', `--email=${yi.email}`);
check('旁证：那个邮箱已经没有待审评论', bAfterApprove.count === 0, `实际 ${bAfterApprove.count} 条`);

/* ================= 5. 被防垃圾挡下的提交不产生待审提示 ================= */

section('垃圾提交');

/*
 * 把蜜罐字段填上：工单 02 的守卫会在**入库之前**把它挡掉，于是既没有评论，
 * 也就没有任何「待审」的状态可言。这里验的是「没有待审提示」，不是「有错误提示」——
 * 后者不是本工单的事。
 *
 * 字段名是从工单 02 的守卫那里来的（`yuki_comment_trap_field()`），这里是**刻意**耦合的：
 * 它哪天改了名字，这个提交就会被当成正常访客放行，于是下面第一条断言立刻变红——
 * 响亮地失败，而不是静默地验了个寂寞。
 */
const spamEmail = `yuki-pend-spam-${stamp}@example.test`;
const spamBody = `${MARK} 垃圾 正文 ${stamp}`;

const trapRes = await submitComment(postUrl, {
  comment: spamBody,
  author: `${MARK} 垃圾 ${stamp}`,
  email: spamEmail,
  consent: true,
  extraFields: { yuki_comment_note: 'i-am-a-robot' },
});

check('填了蜜罐的提交没有被当成正常提交', trapRes.status !== 302, `实际 ${trapRes.status}（302 说明它被放行了）`);

const spamPending = tryFx('pending', `--email=${spamEmail}`);
check('被挡下的提交没有进待审队列', spamPending.count === 0, `实际 ${spamPending.count} 条`);
check('被挡下的提交拿不到删除链接之类的兜底页面', !/<html/i.test(trapRes.body), `正文长度 ${trapRes.body.length}`);

const spamPage = await fetchUrl(postUrl);
check('页面上没有因为垃圾提交多出待审提示', !hasPendingNotice(spamPage.body), '垃圾提交留下了待审痕迹');
check('页面上也找不到垃圾提交的正文', !spamPage.body.includes(spamBody), '垃圾内容出现在页面上了');

/* ================= 6. 全程不要求登录 ================= */

section('不需要登录');

check('以上所有请求都没有被带去登录页', !/wp-login\.php/.test(revisit.body + stranger.body + afterApprove.body), '页面把人往登录页带');
note(`身份只用了 WordPress 原生的评论者 cookie（${yi.cookie ? '已下发' : '未下发'}）与一次性的跳转参数，全程没有账号`);

/* ================= 收尾 ================= */

const purged = tryFx('purge');
note(`清理测试评论 ${purged.removed ?? '?'} 条，剩余 ${purged.left ?? '?'} 条`);

report();
