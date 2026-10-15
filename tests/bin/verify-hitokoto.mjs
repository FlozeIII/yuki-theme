// 工单 09 的验收：一言。
//
// seam 和别处一样只有 HTTP：请求进去、HTML 出来。上游打的是哪个域名、缓存放在哪个键里、
// 取回用的是哪套 HTTP API，一律不看——看的是页面上有没有那句话、上游被敲了几次、
// 以及「访客的浏览器有没有伸手去够第三方」。
//
// 「上游被敲了几次」由 tests/bin/upstream-stub.mjs 数（基建，见 tests/README.md）；
// 「缓存里是哪一句、还有多久到期」由 hitokoto-fixtures.php 从 WordPress 那一侧读。
// **不测 WordPress 自己的 transient**——那部分是平台的事；测的是主题有没有用它、
// 有没有按 spec 说的那样一小时。
//
// 浏览器那一条得用无头 Edge：`pre_http_request` 只挡得住 PHP 发出去的请求，
// 「主题把地址写进页面、访客的浏览器自己去取」这种事它看不见，只有真的浏览器知道。
//
// 本地环境是**共享**的（README 里写着）：别的会话可能正在切主题、正在敲同一个 stub。
// 所以开头会等主题切回 yuki，`mode` 用完立刻还原——这两处是并发下最容易互相踩的。
//
// 用法: node tests/bin/verify-hitokoto.mjs

import {
  SITE,
  get,
  probeScript,
  startStub,
  stopStub,
  stubHitCount,
  stubSetBody,
  stubSetMode,
} from './lib.mjs';
import { check, note, report, section } from './report.mjs';
import { launch, newPage } from './browser.mjs';

const FX = 'hitokoto-fixtures.php';
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

/** 上游要返回的那句。encode=json 的一言响应，字段按真实接口的来。 */
const upstreamBody = (text, from = '') =>
  JSON.stringify({ id: 1, uuid: 'x', hitokoto: text, type: 'a', from, from_who: '', creator: '' });

/** 页面里的侧边栏那一段。断言「侧边栏显示了一句话」就得在它里面找。 */
const sidebarOf = (html) => (html.match(/<aside class="yuki-sidebar">[\s\S]*?<\/aside>/) || [''])[0];

/** 池子里有哪些句子正出现在这段 HTML 里。 */
const shownFrom = (pool, html) => pool.filter((line) => html.includes(line));

/** 上游的地址。输出里出现它，就意味着浏览器有可能自己跑去取一趟。 */
const UPSTREAM_HOST = /hitokoto\.cn/i;

/** 计时的那个取页面。返回耗时与响应。 */
async function timedGet(url) {
  const started = Date.now();
  const response = await get(url);
  return { ...response, ms: Date.now() - started };
}

/**
 * 等主题回到 yuki 再往下跑。
 *
 * 工单 01 的验收会**真的把主题切走**（切到 twentytwentyfive 验邮件捕获还灵不灵），
 * 那几秒里我这个站点上跑的是别人的主题，一言一个断言都验不了。等它切回来，
 * 而不是把这段竞争记成主题的失败——本地环境是共享的，这是共享的代价，
 * 不是被测对象的毛病（README 里那条「看到莫名其妙的失败先 git status 一眼」）。
 */
async function waitForTheme(slug, tries = 24) {
  let state = tryFx('state');

  for (let i = 0; i < tries && state.theme !== slug; i++) {
    await sleep(500);
    state = tryFx('state');
  }

  return state;
}

/**
 * 各段的耗时上限。
 *
 * 上限是照着**本地的实测**定的，不是为了宽松：本机一次渲染的空转约 0.4 秒，
 * 所以「上游挂住时 ≤ 3.2 秒」真正在说的是「主题给上游的超时必须明显短于 WordPress
 * 默认的 5 秒」——默认值会让这一条红，而它正是 spec 里「不拖慢页面」那条要防的东西。
 */
const SLOW_MS = 3200;
const FAST_MS = 1500;

let stub = null;

/**
 * 把上游调回 ok。
 *
 * `mode` 是**全局**状态，比别的取值更要紧的是 `hang`：它会让任何敲这个 stub 的请求
 * 一直挂着（包括另一个会话正在跑的验收）。所以每一段用完之后立刻还原、收尾再还原一次，
 * 中途被打断也要还原——SIGINT/SIGTERM 不会走下面的 finally，得单独接。
 */
const restoreMode = () => {
  try {
    stubSetMode('ok');
  } catch {
    /* 状态目录不可写就随它去，停 stub 更要紧 */
  }
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    restoreMode();
    if (stub) stub.kill();
    process.exit(130);
  });
}

try {
  stub = await startStub();

  /* ================= 0. 前提 ================= */

  section('前提');

  const pre = await waitForTheme('yuki');
  check('站点跑在 yuki 主题上', pre.theme === 'yuki', `实际 ${pre.theme || JSON.stringify(pre)}`);
  check('主题里有取回的那一环', pre.has_quote === true, `yuki_hitokoto 存在：${pre.has_quote}`);
  check('主题里有兜底的那一环', pre.has_fallback === true, `yuki_hitokoto_fallback 存在：${pre.has_fallback}`);

  const postUrl = pre.post_url;
  check('拿得到一篇会渲染侧边栏的文章', Boolean(postUrl), postUrl || '(没有已发布的文章)');

  if (pre.theme !== 'yuki' || !postUrl) {
    note('主题不是 yuki、或者没有可用的文章，后面的断言没有意义，就此打住');
    report();
  }

  // 兜底句的池子。采样几百次把整个池子收全（随机的，抽少了会漏）
  const pool = tryFx('fallback', '--samples=300').lines || [];
  check('兜底句是一组内置的句子', pool.length >= 2, `采到 ${pool.length} 句：${JSON.stringify(pool).slice(0, 100)}`);
  check(
    '兜底句没有空串',
    pool.length > 0 && pool.every((line) => line.trim().length > 0),
    `${pool.length} 句里有 ${pool.filter((line) => !line.trim().length).length} 句是空白`,
  );

  /* ================= 1. 侧边栏显示一句话 ================= */

  section('侧边栏');

  const MARK = `YUKI-HITOKOTO ${Date.now()} 上游取回的那句`;
  const FROM = 'YUKI-HITOKOTO 出处';

  tryFx('clear');
  stubSetMode('ok');
  stubSetBody(upstreamBody(MARK, FROM));

  const hitsBeforeFirst = stubHitCount();
  const first = await timedGet(postUrl);
  const firstHits = stubHitCount() - hitsBeforeFirst;
  const firstSidebar = sidebarOf(first.body);

  check('文章页正常返回', first.status === 200, `实际 ${first.status}`);
  check('页面里有侧边栏', firstSidebar.length > 0, `侧边栏 ${firstSidebar.length} 字符`);
  check('侧边栏里出现了那句话', firstSidebar.includes(MARK), `那句话在侧边栏里出现 ${firstSidebar.includes(MARK) ? 1 : 0} 次`);
  check('出处跟着一起显示了', firstSidebar.includes(FROM), `出处出现 ${firstSidebar.includes(FROM) ? 1 : 0} 次`);

  /*
   * 「由服务端取回，访客的浏览器不直接请求第三方」有两半。
   *
   * 前半在这里：内容出现在**服务端渲染出来的 HTML** 里，而且上游确实被敲了一次——
   * 页面不是靠浏览器自己去取才有内容的。后半（浏览器那侧）在第 3 节，用真浏览器看。
   */
  check('内容由服务端取回', firstHits >= 1, `上游命中 ${firstHits} 次`);

  /* ================= 2. 缓存一小时 ================= */

  section('缓存');

  const hitsBeforeRepeat = stubHitCount();
  const second = await timedGet(postUrl);
  const repeatHits = stubHitCount() - hitsBeforeRepeat;

  check('一小时内重复访问，上游不再被请求', repeatHits === 0, `第二次访问又命中了 ${repeatHits} 次`);
  check(
    '重复访问看到的是同一句',
    sidebarOf(second.body).includes(MARK),
    `第二次侧边栏里${sidebarOf(second.body).includes(MARK) ? '还是' : '不是'}那一句`,
  );

  const cached = tryFx('state');
  const left = cached.cache_left;
  check('缓存里存着那一句', cached.cache_text === MARK, `缓存里是 ${JSON.stringify(cached.cache_text).slice(0, 80)}`);
  check(
    '缓存的有效期是一小时',
    typeof left === 'number' && left > 3300 && left <= 3600,
    left === null ? '没有到期时间（缓存没写进去？）' : `距到期还剩 ${left} 秒`,
  );

  /*
   * 「超过一小时后会重新取回」：不真等一小时，把到期时间挪到过去，**不动缓存里的值**。
   * 这样模拟的正是「时间到了、那份值该被丢掉了」——把 TTL 调小反而连「一小时」本身都验不了。
   */
  const NEXT = `${MARK} · 换了新的一句`;
  stubSetBody(upstreamBody(NEXT, FROM));
  const aged = tryFx('age', '--seconds=1');
  check('把缓存挪到过期（模拟一小时过去了）', aged.aged === true, `挪动前有缓存：${aged.aged}`);

  const hitsBeforeRefresh = stubHitCount();
  const refreshed = await timedGet(postUrl);
  const refreshHits = stubHitCount() - hitsBeforeRefresh;
  const refreshedSidebar = sidebarOf(refreshed.body);

  check('一小时之后会重新取回', refreshHits >= 1, `上游命中 ${refreshHits} 次`);
  check('重新取回后换成了新的那句', refreshedSidebar.includes(NEXT), `旧的还在：${refreshedSidebar.includes(MARK)}`);

  /* ================= 3. 访客的浏览器不碰第三方 ================= */

  section('浏览器不碰第三方');

  /*
   * 页面里不该出现上游的地址——出现了，就说明有哪一处准备让浏览器自己去取。
   *
   * 认的是**主机名**（hitokoto.cn），不是「hitokoto」这个词：主题自己的类名
   * `yuki-hitokoto` 就带这个词，按词判会红在一个跟上游毫无关系的地方（踩过）。
   */
  check('页面里没有上游的地址', !UPSTREAM_HOST.test(first.body), first.body.match(UPSTREAM_HOST)?.[0] || '没出现');

  let browser = null;
  try {
    browser = await launch();
    const page = await newPage(browser);
    await page.goto(postUrl);
    const requested = await page.evaluate(`performance.getEntriesByType('resource').map((e) => e.name)`);
    const thirdParty = (requested || []).filter((url) => UPSTREAM_HOST.test(url));

    check(
      '浏览器没有向第三方发起请求',
      thirdParty.length === 0,
      thirdParty.length ? thirdParty.join(', ') : `共 ${(requested || []).length} 个请求，没有一个发往第三方`,
    );
  } catch (err) {
    check('浏览器没有向第三方发起请求', false, `无头浏览器没跑起来：${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  /* ================= 4. 转义后才输出 ================= */

  section('转义');

  const INJECT = '<img src=x onerror="alert(1)">YUKI-HITOKOTO 注入';
  const INJECT_FROM = '<script>alert(2)</script>出处';
  stubSetBody(upstreamBody(INJECT, INJECT_FROM));
  tryFx('clear');

  const evil = await timedGet(postUrl);
  const evilSidebar = sidebarOf(evil.body);

  check('恶意的一言照样渲染成文本', evilSidebar.includes('YUKI-HITOKOTO 注入'), `那句话出现 ${evilSidebar.includes('YUKI-HITOKOTO 注入') ? 1 : 0} 次`);
  check('上游给的标记不会被当成 HTML', !evilSidebar.includes('<img src=x'), `未转义的 <img 出现 ${evilSidebar.includes('<img src=x') ? 1 : 0} 次`);
  check('输出里是转义后的形式', evilSidebar.includes('&lt;img'), `&lt;img 出现 ${evilSidebar.includes('&lt;img') ? 1 : 0} 次`);
  check('出处同样被转义', !evilSidebar.includes('<script>alert(2)'), `出处里的 <script> 出现 ${evilSidebar.includes('<script>alert(2)') ? 1 : 0} 次`);

  /*
   * 「没出现未转义的」还要配一条**正向**断言。
   *
   * 只查「原始标记不出现」是验不了转义的：出处根本没输出、或者整段被丢掉，那种写法照样绿。
   * 要正着说出「转义之后的那份确实显示出来了」，这条才算真的在验转义。
   */
  const escapedFrom = '&lt;script&gt;alert(2)&lt;/script&gt;出处';
  check('转义后的出处确实显示了出来', evilSidebar.includes(escapedFrom), `找的是 ${escapedFrom}`);

  /* ================= 5. 上游故障：500、垃圾、不可达 ================= */

  section('上游 500');

  stubSetMode('500');
  tryFx('clear');
  const fail500 = await timedGet(postUrl);
  const shown500 = shownFrom(pool, sidebarOf(fail500.body));

  const fail500Sidebar = sidebarOf(fail500.body);
  const fail500Siblings = ['作者简介', '分类', '标签云', '热门文章'].filter((title) => fail500Sidebar.includes(`<h3>${title}</h3>`));

  check('上游 500 时页面正常返回', fail500.status === 200, `实际 ${fail500.status}`);
  check('上游 500 时显示的是内置兜底句', shown500.length === 1, `兜底句出现 ${shown500.length} 句：${shown500[0] || '(没有)'}`);
  /*
   * 「页面不会缺一块」不能只查 `</html>` 在不在——那是近乎恒真的写法（一言整个消失、
   * 甚至侧边栏空白，它都还是绿的）。这里改成查**侧边栏本身还在、而且另外几个内置小工具
   * 都在**：一言取不回来时，它周围那几块不该跟着一起没了。
   */
  check('兜底之后页面完整收尾', fail500.body.includes('</html>'), `页面${fail500.body.includes('</html>') ? '正常收尾' : '没有收尾'}`);
  check(
    '兜底之后侧边栏其余部分照旧',
    fail500Sidebar.length > 0 && fail500Siblings.length === 4,
    `侧边栏 ${fail500Sidebar.length} 字符，其余内置小工具在 ${fail500Siblings.length}/4 个：${fail500Siblings.join('、') || '(一个都没有)'}`,
  );

  section('上游返回垃圾');

  stubSetMode('garbage');
  tryFx('clear');
  const failGarbage = await timedGet(postUrl);
  const shownGarbage = shownFrom(pool, sidebarOf(failGarbage.body));

  check('上游返回垃圾时页面正常返回', failGarbage.status === 200, `实际 ${failGarbage.status}`);
  check(
    '上游返回垃圾时显示的是内置兜底句',
    shownGarbage.length === 1,
    `兜底句出现 ${shownGarbage.length} 句：${shownGarbage[0] || '(没有)'}${sidebarOf(failGarbage.body).includes('不是 JSON') ? '（垃圾正文被原样显示了）' : ''}`,
  );

  section('上游不可达');

  // 真的停掉：端口不再监听，连接被拒——「不可达」才是真的不可达，而不是假装失败
  await stopStub(stub);
  stub = null;

  restoreMode();
  tryFx('clear');
  const unreachable = await timedGet(postUrl);
  const shownUnreachable = shownFrom(pool, sidebarOf(unreachable.body));

  note(`上游不可达时首次渲染 ${unreachable.ms} 毫秒（上限 ${SLOW_MS}）`);
  check('上游不可达时页面正常返回', unreachable.status === 200, `实际 ${unreachable.status}`);

  /*
   * 「兜底句不依赖网络、随主题一起存在」由两半合起来验，这里是一半：上游断着，
   * 页面上照样有完整的一句——那句话不可能是取回来的，只能是主题自己的。
   * 另一半在前提里：那份池子是从主题自己的函数采出来的，全程没经过网络。
   *
   * 这里刻意**不再**断言「显示的那句在池子里」：`shownFrom()` 本来就只在池子里找，
   * 那样写是恒真的，看着多一条断言，其实什么都没多验。
   */
  check('上游不可达时显示的是内置兜底句', shownUnreachable.length === 1, `兜底句出现 ${shownUnreachable.length} 句：${shownUnreachable[0] || '(没有)'}`);

  /*
   * 「页面渲染没有明显变慢」在两种失败下不是一回事，所以两种都测、并说清楚各自验的是什么：
   * 连接被拒是**立刻**返回的，这条防的是「失败路径上写了什么很慢的东西」；
   * 真正能把页面拖慢的是上游**接住请求却不回**，那一条在第 6 节（`hang`）——
   * 勾选项字面上写的是「不可达」，而它的实质要在超时那一节才验得到。
   */
  check('上游不可达时页面渲染没有明显变慢', unreachable.ms < SLOW_MS, `${unreachable.ms} 毫秒（上限 ${SLOW_MS}）`);

  /* ================= 6. 超时不能拖慢页面 ================= */

  section('上游挂住（超时）');

  /*
   * 本地唯一能造出「超时」的办法是让上游接住请求却永不回应（stub 的 hang）。
   * 把 stub 杀掉得到的是**连接被拒**——那是另一种失败，快到验不出任何东西。
   *
   * 这一节才是「取回失败不能拖慢页面」的实质：**只有它能把页面拖慢**。上一节那条
   * 不可达的耗时断言只是不让失败路径离谱，真正会红在一个 5 秒默认超时上的，在这里。
   */
  stub = await startStub();
  stubSetMode('hang');
  tryFx('clear');

  const hitsBeforeHang = stubHitCount();
  const hung = await timedGet(postUrl);
  const hangHits = stubHitCount() - hitsBeforeHang;
  const shownHung = shownFrom(pool, sidebarOf(hung.body));

  note(`上游挂住时首次渲染 ${hung.ms} 毫秒（上限 ${SLOW_MS}），健康时约 ${first.ms} 毫秒`);
  check(
    '上游挂住时页面仍然完整',
    hung.status === 200 && hung.body.includes('</html>'),
    `状态 ${hung.status}，${hung.body.includes('</html>') ? '完整' : '没有收尾'}`,
  );
  check('上游挂住时显示的是内置兜底句', shownHung.length === 1, `兜底句出现 ${shownHung.length} 句：${shownHung[0] || '(没有)'}`);
  check('上游确实被请求过（不是根本没发出去）', hangHits >= 1, `命中 ${hangHits} 次`);
  check('取回超时不会把页面拖到 WordPress 默认的 5 秒', hung.ms < SLOW_MS, `${hung.ms} 毫秒`);

  // 失败也被缓存住：上游一直挂着的时候，后面每次渲染都不该再去等一遍
  const hitsBeforeHungRepeat = stubHitCount();
  const hungAgain = await timedGet(postUrl);
  const hungRepeatHits = stubHitCount() - hitsBeforeHungRepeat;

  note(`上游挂住时第二次渲染 ${hungAgain.ms} 毫秒（上限 ${FAST_MS}）`);
  check('上游挂着时后续访问不再等它', hungAgain.ms < FAST_MS, `${hungAgain.ms} 毫秒`);
  check('上游挂着时后续访问不再敲它', hungRepeatHits === 0, `又命中了 ${hungRepeatHits} 次`);
  check('后续访问照样有一句话', shownFrom(pool, sidebarOf(hungAgain.body)).length === 1, '第二次没有兜底句');

  /* ================= 7. 放了自定义小工具就接管 ================= */

  section('自定义小工具');

  restoreMode();
  stubSetBody(upstreamBody(MARK, FROM));
  tryFx('clear');

  const taken = tryFx('widgets', '--mode=on');
  check('自定义小工具已放进侧边栏', Array.isArray(taken.sidebar) && taken.sidebar.length === 1, JSON.stringify(taken.sidebar));

  const takenPage = await timedGet(postUrl);
  const takenSidebar = sidebarOf(takenPage.body);
  const widgetText = taken.widget_text || 'YUKI-FX 接管了侧边栏';

  check('侧边栏被自定义小工具接管', takenSidebar.includes(widgetText), `自定义小工具出现 ${takenSidebar.includes(widgetText) ? 1 : 0} 次`);
  check('接管之后一言不再出现', !takenSidebar.includes(MARK), `那句话出现 ${takenSidebar.includes(MARK) ? 1 : 0} 次`);

  const cleared = tryFx('widgets', '--mode=off');
  check('清空之后回退到内置默认', Array.isArray(cleared.sidebar) && cleared.sidebar.length === 0, JSON.stringify(cleared.sidebar));

  tryFx('clear');
  const back = await timedGet(postUrl);
  check('回退之后一言重新出现', sidebarOf(back.body).includes(MARK), `那句话出现 ${sidebarOf(back.body).includes(MARK) ? 1 : 0} 次`);

  /* ================= 收尾 ================= */

  // 必须在 report() 之前做完：report() 会直接 exit
  const torn = tryFx('teardown');
  note(`还原侧边栏${torn.restored ? '完成' : '（没有需要还原的）'}`);
} catch (err) {
  check('验收脚本跑到底', false, `${err.message}`);
} finally {
  restoreMode();
  if (stub) await stopStub(stub);

  try {
    probeScript('hitokoto-fixtures.php', 'teardown');
  } catch {
    /* 收尾失败不该盖住真正的失败 */
  }
}

const site = await get(`${SITE}/`);
note(`首页 ${SITE}/ 状态 ${site.status}`);

report();
