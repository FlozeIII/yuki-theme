// 工单 03 的验收：体检报出来的两处真缺陷。
//
//   其一：文章用分页标记切开时，读者够得着第二页吗。
//   其二：评论删除确认页的标题，是不是仍然只有一处来源、内容还对。
//
// 两处都从**渲染出来的页面**上看，不看模板里有没有那行函数：
// 分页靠页面上的链接真的走一趟（第一页 → 第二页 → 回第一页），
// 标题靠数页面里 <title> 的个数、并拿它跟同一个页面上的一级标题对。
//
// 唯一一处静态读文件的是最后那节：Theme Check 认的「硬编码 <title>」是全主题逐文件的
// 字符串扫描，这里照同一把尺子扫一遍——那里本来就是一条文本规则，用行为断言盖不住。
// 扫之前去掉内联 <svg>：svg 里也有 <title>，那是图标自带的无障碍名字，官方的检查同样先剥掉。
//
// 用法: node tests/bin/verify-theme-check-defects.mjs

import fs from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, SITE, get, linksIn, markMails, probe, probeScript, readMails, submitComment, tagAttrs } from './lib.mjs';
import { check, note, report, section } from './report.mjs';

const FX = 'theme-check-defects-fixtures.php';
const fx = (...args) => probeScript(FX, ...args);

const tryFx = (...args) => {
  try {
    return fx(...args);
  } catch (err) {
    return { error: err.message };
  }
};

const tryProbe = (...args) => {
  try {
    return probe(...args);
  } catch (err) {
    return { error: err.message };
  }
};

const RUN = Date.now();

/**
 * 地址为空、连不上或超时，都给一个明确的失败壳，别让整轮验收连堆栈一起结束——
 * 那样后面的断言一条都打不出来，收尾的清理也不会跑（共用环境里，留一堆测试内容下去更糟）。
 */
const fetchUrl = async (url) => {
  if (!url) return { status: 0, body: '' };
  try {
    return await get(url);
  } catch (err) {
    return { status: 0, body: '', error: err.message };
  }
};

/** 页面里所有 <a> 的 href。 */
function anchors(html) {
  return [...String(html).matchAll(/<a\b[^>]*>/gi)].map((m) => tagAttrs(m[0]));
}

/**
 * 把 HTML 属性里的实体还原成能直接请求的地址。
 *
 * esc_url() 会把查询串里的 `&` 写成 `&#038;`；属性再被编码一层时就成了 `&amp;#038;`。
 * 不还原的话，纯静态固定链接（`?p=123&amp;page=2`）那种地址会被当成一个不存在的查询参数请求，
 * 于是拿回来的还是第一页——红的会是「第二页没渲染出来」，而问题在这个测试自己。
 * 本机是 /%postname%/，没有 `&`，所以这条平时不显形。
 */
function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** 分页链接：核心那套 wp_link_pages 给出的锚点带 post-page-numbers 这个类。 */
const pagerHrefs = (html) =>
  anchors(html)
    .filter((a) => (a.class || '').includes('post-page-numbers'))
    .map((a) => decodeEntities(a.href || ''));

/** 页面里 <title> 的个数与内容。 */
function titles(html) {
  const found = [...String(html).matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => m[1].trim());
  return { count: found.length, first: found[0] || '' };
}

/** 页面里一级标题的内容（去掉标签与实体空格）。 */
function h1Of(html) {
  const m = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
}

/** 数一段文本在页面里出现了几次。分成页之后，「第二页只有第二页那段」靠它验。 */
const timesIn = (html, text) => (text ? String(html).split(text).length - 1 : 0);

/* ================= 0. 前提 ================= */

section('前提');

/*
 * 这份本地环境是同一个工作树上几个会话共用的（见 AGENTS.md「并行会话」）。
 * 别的会话验收时会把主题临时换掉，那一刻这里量到的页面就不是本主题渲染的——
 * 表现是一堆看着莫名其妙的红（分页链接没了、评论提交变成 200）。
 * 所以先把前提写成断言：确认现在跑的是本主题，红的时候一眼能看出是环境串了。
 */
const siteInfo = tryProbe('site-info');
check('站点现在跑的是本主题', siteInfo.stylesheet === 'yuki', `当前主题 ${siteInfo.stylesheet || siteInfo.error}`);

/* ================= 1. 造数 ================= */

section('造数');

const paginatedPost = tryFx('ensure', '--kind=post', '--paginated=1', `--run=${RUN}`);
check(
  '造出一篇用分页标记切开的文章',
  paginatedPost.id > 0 && paginatedPost.has_pagebreak === true,
  `id=${paginatedPost.id} 分页标记=${paginatedPost.has_pagebreak} ${paginatedPost.error || ''}`,
);

const plainPost = tryFx('ensure', '--kind=post', '--paginated=0', `--run=${RUN}`);
check(
  '造出一篇没有分页标记的文章',
  plainPost.id > 0 && plainPost.has_pagebreak === false,
  `id=${plainPost.id} 分页标记=${plainPost.has_pagebreak} ${plainPost.error || ''}`,
);

const paginatedPage = tryFx('ensure', '--kind=page', '--paginated=1', `--run=${RUN}`);
check(
  '造出一个用分页标记切开的静态页面',
  paginatedPage.id > 0 && paginatedPage.has_pagebreak === true,
  `id=${paginatedPage.id} ${paginatedPage.error || ''}`,
);

const plainPage = tryFx('ensure', '--kind=page', '--paginated=0', `--run=${RUN}`);
check('造出一个没有分页标记的静态页面', plainPage.id > 0 && plainPage.has_pagebreak === false, `id=${plainPage.id}`);

// 这一轮造出来的那几篇，收尾时按 id 精确清理。
const createdIds = [paginatedPost, plainPost, paginatedPage, plainPage].map((p) => p.id).filter((id) => Number(id) > 0);
check('造出来的内容都报回了 id（收尾要按它精确清理）', createdIds.length === 4, `拿到 ${createdIds.length} 个 id`);

// 两页各自那段正文，从造数脚本回报的正文里切出来——不在这边把文案再抄一遍，
// 抄一遍就成了一份会跟造数漂掉的副本。
const partsOf = (post) => String(post.content || '').split('<!--nextpage-->').map((s) => s.trim());
const postParts = partsOf(paginatedPost);
const pageParts = partsOf(paginatedPage);

/* ================= 2. 分页文章：第二页够得着 ================= */

section('分页文章的第二页');

const postFirst = await fetchUrl(paginatedPost.url);
check('文章第一页打得开', postFirst.status === 200, `实际 ${postFirst.status}`);
check(
  '第一页上只有第一页那段正文',
  timesIn(postFirst.body, postParts[0]) === 1 && timesIn(postFirst.body, postParts[1]) === 0,
  `第一页那段出现 ${timesIn(postFirst.body, postParts[0])} 次，第二页那段 ${timesIn(postFirst.body, postParts[1])} 次`,
);

const postPager = pagerHrefs(postFirst.body);
check('第一页上有指向后续页的链接', postPager.length >= 1, `找到 ${postPager.length} 个分页链接`);

const postSecond = await fetchUrl(postPager[0]);
check('那个链接点得进去', postSecond.status === 200, `${postPager[0] || '(没有链接)'} 返回 ${postSecond.status}`);
check(
  '点进去看到的是第二页那段正文',
  timesIn(postSecond.body, postParts[1]) === 1 && timesIn(postSecond.body, postParts[0]) === 0,
  `第二页那段出现 ${timesIn(postSecond.body, postParts[1])} 次，第一页那段 ${timesIn(postSecond.body, postParts[0])} 次`,
);

const backHrefs = pagerHrefs(postSecond.body);
const backToFirst = backHrefs.some((href) => href && href.split('#')[0].replace(/\/$/, '') === String(paginatedPost.url).replace(/\/$/, ''));
check('第二页上能回到第一页', backToFirst, `第二页上的分页链接 ${JSON.stringify(backHrefs)}`);

/* ================= 3. 没有分页标记的文章 ================= */

section('没有分页标记的文章');

// 普通文章整篇就一段正文，拿它当基线用。
const plainText = String(plainPost.content || '').trim();

const plainBody = await fetchUrl(plainPost.url);
// 先确认这一页真的渲染了正文，否则「没有翻页区」在页面是空的时候也成立——那是假绿。
check(
  '普通文章打得开而且有正文',
  plainBody.status === 200 && timesIn(plainBody.body, plainText) === 1,
  `实际 ${plainBody.status}，正文出现 ${timesIn(plainBody.body, plainText)} 次`,
);

check(
  '普通文章没有多出一块翻页区',
  pagerHrefs(plainBody.body).length === 0 && !/post-nav-links/.test(plainBody.body),
  `分页链接 ${pagerHrefs(plainBody.body).length} 个，post-nav-links ${/post-nav-links/.test(plainBody.body)}`,
);

/* ================= 4. 静态页面 ================= */

section('静态页面的第二页');

const pageFirst = await fetchUrl(paginatedPage.url);
check('静态页面第一页打得开', pageFirst.status === 200, `实际 ${pageFirst.status}`);

const pagePager = pagerHrefs(pageFirst.body);
check('静态页面上也有指向后续页的链接', pagePager.length >= 1, `找到 ${pagePager.length} 个分页链接`);

const pageSecond = await fetchUrl(pagePager[0]);
check(
  '静态页面的第二页点得进去而且只有第二页那段',
  pageSecond.status === 200 && timesIn(pageSecond.body, pageParts[1]) === 1 && timesIn(pageSecond.body, pageParts[0]) === 0,
  `${pagePager[0] || '(没有链接)'} 返回 ${pageSecond.status}`,
);

const plainPageBody = await fetchUrl(plainPage.url);
check(
  '没有分页标记的静态页面没有翻页区',
  plainPageBody.status === 200 && pagerHrefs(plainPageBody.body).length === 0 && !/post-nav-links/.test(plainPageBody.body),
  `实际 ${plainPageBody.status}，分页链接 ${pagerHrefs(plainPageBody.body).length} 个`,
);

/* ================= 5. 确认页的标题 ================= */

section('删除确认页的标题');

/*
 * 走真实的一条评论：提交 → 从捕获的邮件里取出删除链接 → 打开。
 * 令牌怎么签发不看，这里要的只是「一个真的确认页」。
 */
const mark = markMails();
const submitted = await submitComment(paginatedPost.url, {
  comment: `YUKI-PAGEBREAK-TEST 评论 ${RUN}`,
  author: `YUKI-PAGEBREAK-TEST 访客 ${RUN}`,
  email: `yuki-pagebreak-${RUN}@example.test`,
});

const deleteLink = readMails(mark)
  .flatMap((mail) => linksIn(mail.body))
  .find((url) => url.includes('yuki_delete='));

check('提交评论之后拿到了删除链接', Boolean(deleteLink), `提交返回 ${submitted.status}`);
check('提交本身是被接受的', submitted.status === 302, `实际 ${submitted.status} -> ${submitted.location}`);

const confirm = await fetchUrl(deleteLink);
check('删除链接打开的是确认页', confirm.status === 200 && /yuki-delete-confirm/.test(confirm.body), `实际 ${confirm.status}`);

const confirmTitle = titles(confirm.body);
const confirmH1 = h1Of(confirm.body);
check('确认页里只有一个 <title>', confirmTitle.count === 1, `数到 ${confirmTitle.count} 个`);
check('确认页的标题不是空的', confirmTitle.first.length > 0, `标题是 ${JSON.stringify(confirmTitle.first)}`);
check(
  '确认页的标题跟页面上的一级标题一致',
  confirmTitle.first === confirmH1,
  `标题 ${JSON.stringify(confirmTitle.first)}，一级标题 ${JSON.stringify(confirmH1)}`,
);

/* ================= 6. 主题其余页面的标题 ================= */

section('其余页面的标题');

// 站点名从 WordPress 自己的 REST 接口取，不从主题渲染出来的页面上取——
// 从被测的那一页里取一个值来验那一页，等于自己跟自己比。
const siteJson = await fetchUrl(`${SITE}/wp-json/`);
let siteName = '';
try {
  siteName = JSON.parse(siteJson.body).name || '';
} catch {
  siteName = '';
}
check('拿得到站点名（用来对首页标题）', siteName.length > 0, `wp-json 返回 ${siteJson.status}`);

const homeBody = await fetchUrl(`${SITE}/`);
const homeTitle = titles(homeBody.body);
check('首页只有一个 <title>', homeTitle.count === 1, `数到 ${homeTitle.count} 个`);
check('首页标题里还有站点名', homeTitle.first.includes(siteName), `${JSON.stringify(homeTitle.first)} 里找 ${JSON.stringify(siteName)}`);

const postTitleOnPage = titles(postFirst.body);
check('文章页只有一个 <title>', postTitleOnPage.count === 1, `数到 ${postTitleOnPage.count} 个`);
check(
  '文章页标题里还有文章标题',
  postTitleOnPage.first.includes(paginatedPost.title),
  `${JSON.stringify(postTitleOnPage.first)} 里找 ${JSON.stringify(paginatedPost.title)}`,
);

const secondTitle = titles(postSecond.body);
check(
  '分页那几页的标题里带着页码（页码仍由核心产出）',
  secondTitle.count === 1 && secondTitle.first !== postTitleOnPage.first && secondTitle.first.includes('2'),
  `第一页 ${JSON.stringify(postTitleOnPage.first)}，第二页 ${JSON.stringify(secondTitle.first)}`,
);

/* ================= 7. 主题里没有第二处 <title> ================= */

section('主题里 <title> 只有一处来源');

const SKIP_DIRS = new Set(['.git', '.scratch', 'docs', 'tests', 'node_modules', 'languages']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), files);
    } else if (path.extname(entry.name) === '.php') {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const phpFiles = walk(REPO_ROOT);
const offenders = [];

for (const file of phpFiles) {
  // 先剥内联 svg：svg 的 <title> 是图标的无障碍名字，官方的检查同样先剥掉再找。
  const text = fs.readFileSync(file, 'utf8').replace(/<svg[\s\S]*?<\/svg>/gi, '');
  if (text.includes('<title>') || text.includes('</title>')) {
    offenders.push(path.relative(REPO_ROOT, file));
  }
}

check('主题的 PHP 文件里没有硬写的 <title>', offenders.length === 0, offenders.join('; ') || '一个也没有');
check('确实扫到了主题的 PHP 文件', phpFiles.length > 5, `扫了 ${phpFiles.length} 个`);

/* ================= 收尾 ================= */

// 只删这一轮自己造的那几篇：同一个环境上可能同时开着别的会话，
// 按标记大扫除会把它们正在用的那几篇一并删掉（造数脚本里同一条理由）。
const purged = tryFx('purge', `--ids=${createdIds.join(',')}`);
note(`清理这一轮造的 ${purged.removed ?? '?'} 篇，带标记的还剩 ${purged.left ?? '?'} 篇（别人的或上一轮崩在半路留下的）`);
note(`造数与回填都只碰自己那几篇内容与那条评论；没有改任何全站设置`);

// 半路被别人换掉主题的话，上面每一条都可能是拿别的主题量出来的——收尾再确认一次。
const siteAfter = tryProbe('site-info');
check('收尾时站点仍跑着本主题', siteAfter.stylesheet === 'yuki', `当前主题 ${siteAfter.stylesheet || siteAfter.error}`);

report();
