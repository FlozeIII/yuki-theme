// 工单 01 的验收：本地测试基建（邮件捕获 + 上游 stub）。
//
// 这里断言的对象是**基建本身**能不能用，不是主题的行为——所以它不随主题改动而变。
// 验收的六条来自工单，逐条对在下面各段的注释里。
//
// 用法: node tests/bin/verify-harness.mjs

import fs from 'node:fs';
import path from 'node:path';
import {
  MAIL_LOG,
  MODE_FILE,
  REPO_ROOT,
  SITE,
  STUB_BASE,
  TESTS_DIR,
  WP_ROOT,
  get,
  markMails,
  probe,
  readMails,
  run,
  startStub,
  statusOf,
  stopStub,
  stubHitCount,
  stubHits,
  stubSetBody,
  stubSetMode,
  submitComment,
} from './lib.mjs';

const out = [];
const check = (name, ok, detail = '') => out.push({ name, ok: !!ok, detail });
const section = (title) => out.push({ section: title });

/** 探针失败（比如 PHP 还没装好）时也记成一次断言失败，而不是让整轮验收崩掉。 */
const tryProbe = (...args) => {
  try {
    return probe(...args);
  } catch (err) {
    return { error: err.message };
  }
};

/* ================= 1. 基建可以安装进本地环境 ================= */

const install = run(process.execPath, [path.join(TESTS_DIR, 'bin', 'harness.mjs'), 'install', WP_ROOT]);
const muDir = path.join(WP_ROOT, 'wp-content', 'mu-plugins');
check(
  '基建安装成功',
  install.status === 0,
  install.status === 0 ? '' : `退出码 ${install.status}：${(install.stderr || '').trim().split('\n').pop()}`,
);
check(
  '邮件捕获的 mu-plugin 已就位',
  fs.existsSync(path.join(muDir, 'yuki-dev-mailbox.php')),
  muDir,
);
check(
  '上游转发的 mu-plugin 已就位',
  fs.existsSync(path.join(muDir, 'yuki-dev-upstream.php')),
  muDir,
);

/* ================= 2. 上游 stub ================= */

section('上游 stub');

let stub = null;
try {
  stubSetMode('ok');
  stub = await startStub();
  // 用增量而不是先清空：本地环境可能还开着别的会话，清空会把它们的记录一并抹掉
  const hitsBefore = stubHitCount();

  const READY_BODY = `<p>stub 可控正文 ${Date.now()}</p>`;
  stubSetBody(READY_BODY);

  // 工单：上游 stub 能返回一个可控的响应体
  const first = await get(`${STUB_BASE}/hitokoto`);
  check('stub 应答 200', first.status === 200, `实际 ${first.status}`);
  check('stub 正文与 body.txt 一致', first.body === READY_BODY, `实际 ${JSON.stringify(first.body.slice(0, 60))}`);

  const second = await get(`${STUB_BASE}/hitokoto?encode=json`);
  check('换一条路径也能拿到正文', second.status === 200 && second.body === READY_BODY, `实际 ${second.status}`);

  // 工单：能读出 stub 被请求的次数
  // 用 >= 而不是 ==：同一个 stub 端口可能还有别的会话在敲（见 README），
  // 那样「多了几行」就不再由我们一个人决定。我们要验的是计数可读且会涨，不是独占。
  const delta = stubHitCount() - hitsBefore;
  check('命中次数可读且随请求增加', delta >= 2, `实际新增 ${delta} 行`);
  const lastHit = stubHits().slice(-1)[0] || '';
  check('命中记录带时间与路径', /\d{4}-\d{2}-\d{2}T/.test(lastHit) && lastHit.includes('/hitokoto'), lastHit || '（无记录）');

  // 工单：能切换成 500
  stubSetMode('500');
  const broken = await get(`${STUB_BASE}/hitokoto`);
  check('切成 500 后返回 500', broken.status === 500, `实际 ${broken.status}`);

  // 工单 09 用得到：上游返回无法解析的内容
  stubSetMode('garbage');
  const garbage = await get(`${STUB_BASE}/hitokoto`);
  check(
    '切成 garbage 后返回不可解析的内容',
    garbage.status === 200 && garbage.body !== READY_BODY && !/^\s*[{[]/.test(garbage.body),
    `实际 ${garbage.status} ${JSON.stringify(garbage.body.slice(0, 40))}`,
  );

  stubSetMode('ok');
  check('命中计数在故障态下也记', stubHitCount() - hitsBefore >= 4, `实际新增 ${stubHitCount() - hitsBefore} 行`);

  /* ================= 3. 一言上游可以指向本地 stub ================= */

  section('一言上游指向 stub');

  stubSetMode('ok');
  const REDIRECT_BODY = '<p>走了 stub，不是真的 hitokoto.cn</p>';
  stubSetBody(REDIRECT_BODY);
  const redirectHitsBefore = stubHitCount();

  // 主题还没有一言（工单 09），所以这里用探针直接发一次真实的上游请求：
  // 它要能在「不碰主题一行代码」的前提下落到 stub 上。
  const upstream = tryProbe('http-get', 'https://v1.hitokoto.cn/?encode=json');
  check('上游请求没有报错', !upstream.error, upstream.error || '');
  check('上游请求拿到 stub 的正文', upstream.body === REDIRECT_BODY, JSON.stringify((upstream.body || '').slice(0, 60)));
  // 正文只存在于 stub 的 body.txt 里，拿到它就说明请求确实落到了 stub 上；
  // 这条计数只是旁证，所以容忍并发会话也有可能敲到同一个 stub
  check('stub 确实被命中', stubHitCount() - redirectHitsBefore >= 1, `新增 ${stubHitCount() - redirectHitsBefore} 行`);

  // 工单：能被整个停掉
  await stopStub(stub);
  const dead = await statusOf(`${STUB_BASE}/__mode`);
  check('停掉之后端口不再应答', dead === 0, `实际状态 ${dead}`);

  stubSetMode('ok');
  stubSetBody(REDIRECT_BODY);
  const refused = tryProbe('http-get', 'https://v1.hitokoto.cn/?encode=json');
  check(
    '上游不可达时请求以错误形式返回（不是抛异常）',
    typeof refused.error === 'string' && refused.error !== '',
    JSON.stringify(refused).slice(0, 120),
  );
  stub = null;
} catch (err) {
  check('上游 stub 可用', false, err.message);
} finally {
  if (stub) await stopStub(stub);
}

/* ================= 4. 邮件捕获 ================= */

section('邮件捕获');

let siteInfo = null;
try {
  siteInfo = probe('site-info');
  check('探针能读到站点信息', siteInfo && siteInfo.post_id > 0, JSON.stringify(siteInfo).slice(0, 160));
  check(
    '站点的评论通知是开着的',
    siteInfo && (siteInfo.comments_notify || siteInfo.moderation_notify),
    `comments_notify=${siteInfo?.comments_notify} moderation_notify=${siteInfo?.moderation_notify}`,
  );
} catch (err) {
  check('探针能读到站点信息', false, err.message);
}

if (siteInfo && siteInfo.post_id) {
  // 一个足够长的链接：短链接就算被折行也看不出来，验不出「未被截断」
  const LONG_URL = `${SITE}/yuki-test/${'p'.repeat(90)}/detail?token=${'q'.repeat(60)}`;
  const MARKER = `YUKI-TEST 邮件捕获 ${Date.now()}`;
  const content = `${MARKER}\n带一个长链接：${LONG_URL}`;

  const mark = markMails();
  let posted = { status: 0, location: '', body: '' };
  try {
    // 走真实表单：主题加上防垃圾之后，朴素 POST 会被挡掉（而且挡法跟「忘了带令牌」
    // 长得一样）。取表单、按表单里实际有的字段提交，才是访客走的那条路。
    posted = await submitComment(siteInfo.post_url, { comment: content });
  } catch (err) {
    check('评论提交被接受', false, err.message);
  }
  check(
    '评论提交被接受',
    posted.status === 302 || posted.status === 200,
    `实际 ${posted.status} ${posted.location}`,
  );

  // 只认带本次标记的那封：本地环境可能同时开着别的会话，它们也会往同一个文件里写
  const arrived = readMails(mark);
  const mails = arrived.filter((m) => m.body.includes(MARKER));
  // 工单：提交一条评论后，邮件捕获文件里出现那封通知邮件
  check(
    '捕获文件里出现了这次提交的通知邮件',
    mails.length > 0,
    `期间新增 ${arrived.length} 封，其中 ${mails.length} 封是这次的（${MAIL_LOG}）`,
  );

  const mail = mails[mails.length - 1] || { body: '', subject: '' };
  // 工单：正文可读
  check(
    '正文里能读到这次评论的内容',
    mail.body.includes('长链接') || mail.body.includes(MARKER),
    JSON.stringify(mail.body.slice(0, 120)),
  );
  // 工单：其中的链接完整未被截断
  check('长链接在正文里原样完整', mail.body.includes(LONG_URL), `正文长度 ${mail.body.length}`);
  /*
   * 这里原本还有一条：`linksIn(正文).every(u => !/\s/.test(u))`「邮件里没有链接被折断」。
   * 变异测试证明它**永远不会失败**——linksIn 的正则遇到空白就停，被折行劈开的链接会变成
   * 两个都不含空白的短片段，于是断言恒真。删掉，不留假安全感。
   *
   * 「链接未被截断」这条现在就靠上面那条植入的 196 字符长链接验：它比 PHPMailer 的
   * 78 折行宽度还长，把捕获改成按 78 列折行，这条立刻变红（已验）。
   */

  /* ---- 主题未启用时同样工作 ---- */

  section('邮件捕获与主题无关');

  /*
   * 关键在于「另一个进程」。switch_theme() 只换选项，不卸掉已经加载进来的旧主题
   * functions.php——在同一个进程里接着提交，yuki 的钩子还挂着，验的就不是「未启用」。
   * 所以：先在独立进程里切主题，再用 HTTP 发一次**新请求**（新进程，只加载
   * twentytwentyfive），最后切回来。
   */
  const before = markMails();
  const otherMarker = `YUKI-TEST 换个主题提交 ${Date.now()}`;

  const switched = tryProbe('switch-theme', 'twentytwentyfive');
  check('能切到另一个主题', switched.stylesheet === 'twentytwentyfive', JSON.stringify(switched).slice(0, 120));

  if (switched.stylesheet === 'twentytwentyfive') {
    let other = { status: 0 };
    try {
      other = await submitComment(siteInfo.post_url, { comment: otherMarker });
    } catch (err) {
      check('主题未启用时能提交评论', false, err.message);
    }

    check('主题未启用时评论提交被接受', other.status === 302 || other.status === 200, `实际 ${other.status}`);

    const seen = readMails(before);
    const mine = seen.filter((m) => m.body.includes(otherMarker));
    // 工单：邮件捕获是本地环境的设施，不是主题的一部分
    check(
      '主题未启用时邮件捕获照样工作',
      mine.length > 0,
      `期间新增 ${seen.length} 封，其中 ${mine.length} 封是这次的`,
    );

    const restored = tryProbe('switch-theme', 'yuki');
    check('主题已切回 yuki', restored.stylesheet === 'yuki', JSON.stringify(restored).slice(0, 120));
  }

  // 用 tryProbe：这条一旦抛出来，整轮验收会以堆栈结束，之前累积的断言一条都打不出来
  const back = tryProbe('site-info');
  check('站点已回到 yuki 主题', back.stylesheet === 'yuki', `实际 ${back.stylesheet || JSON.stringify(back)}`);
}

/* ================= 5. 主题里没有为测试而存在的东西 ================= */

section('主题干净');

const FORBIDDEN = [
  'YUKI_DEV',
  'pre_wp_mail',
  'pre_http_request',
  'http_request_host_is_external',
  'http_allowed_safe_ports',
  '127.0.0.1',
  'localhost:8099',
  'wp-dev',
];

const SKIP_DIRS = new Set(['.git', '.scratch', 'docs', 'tests', 'node_modules', 'languages']);
const SCAN_EXT = new Set(['.php', '.js', '.css', '.json']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), files);
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const themeFiles = walk(REPO_ROOT);
const offenders = [];
for (const file of themeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) offenders.push(`${path.relative(REPO_ROOT, file)}: ${needle}`);
  }
}
// 工单：主题代码里没有为测试而存在的分支、开关或钩子
check('主题代码里没有测试专用的痕迹', offenders.length === 0, offenders.join('; '));
check('确实扫到了主题文件', themeFiles.length > 5, `扫了 ${themeFiles.length} 个文件`);

/* ================= 报告 ================= */

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
let failed = 0;
for (const r of out) {
  if (r.section) {
    console.log(`\n== ${r.section} ==`);
    continue;
  }
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${pad(r.name, 34)}${r.detail ? ` <- ${r.detail}` : ''}`);
}

const total = out.filter((r) => !r.section).length;
console.log(`\n${total - failed}/${total} 通过`);
console.log(`捕获文件 ${MAIL_LOG}`);
console.log(`stub 状态 ${path.dirname(MODE_FILE)}`);
process.exit(failed ? 1 : 0);
