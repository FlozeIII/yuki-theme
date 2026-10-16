// 本地验证环境的公共辅助：HTTP 请求、邮件捕获文件的读取、上游 stub 的起停与控制。
// 供 verify-harness.mjs 与后续各工单的验收脚本共用。
//
// 路径约定（都可用环境变量覆盖）：
//   YUKI_WP_ROOT   WordPress 目录，默认 C:/Users/Floze/wp-dev/wordpress
//   YUKI_DEV_VAR   捕获文件与 stub 状态目录，默认 WordPress 目录的同级 var/
//   YUKI_PHP       PHP 可执行文件
//   YUKI_SITE      本地站点地址，默认 http://localhost:8080
//   YUKI_STUB_PORT 上游 stub 的端口，默认 8099
//
// 所有路径都在仓库之外——仓库里只有基建的代码，捕获文件不进版本库。

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export const TESTS_DIR = path.resolve(import.meta.dirname, '..');
export const REPO_ROOT = path.resolve(TESTS_DIR, '..');

export const WP_ROOT = process.env.YUKI_WP_ROOT || 'C:/Users/Floze/wp-dev/wordpress';
export const DEV_ROOT = path.dirname(WP_ROOT);
export const VAR_DIR = process.env.YUKI_DEV_VAR || path.join(DEV_ROOT, 'var');
export const PHP = process.env.YUKI_PHP || path.join(DEV_ROOT, 'tools', 'php', 'php.exe');
export const SITE = (process.env.YUKI_SITE || 'http://localhost:8080').replace(/\/+$/, '');
export const STUB_PORT = Number(process.env.YUKI_STUB_PORT || 8099);
export const STUB_BASE = `http://127.0.0.1:${STUB_PORT}`;

export const MAIL_LOG = path.join(VAR_DIR, 'mail.log');
export const UPSTREAM_DIR = path.join(VAR_DIR, 'upstream');
export const HITS_LOG = path.join(UPSTREAM_DIR, 'hits.log');
export const MODE_FILE = path.join(UPSTREAM_DIR, 'mode');
export const BODY_FILE = path.join(UPSTREAM_DIR, 'body.txt');

/* ---------- 进程 ---------- */

/** 跑一个命令并把它当成「应该成功」的，返回 stdout（已 trim）。 */
export function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

/** 跑 PHP CLI。 */
export function php(args, opts = {}) {
  return run(PHP, args, opts);
}

/**
 * 跑一个需要 WordPress 引导的脚本（tests/bin/ 下的 .php），返回它打印的最后一个 JSON 对象。
 *
 * 约定一律是 `<脚本> <wordpress目录> <子命令> [--键=值 …]`，最后一行是 JSON。
 * 探针成功但输出不是 JSON 时抛错——那说明 WordPress 自己先打印了东西。
 */
export function probeScript(script, ...args) {
  const res = php([path.join(TESTS_DIR, 'bin', script), WP_ROOT, ...args]);
  const lastLine = (res.stdout || '').trim().split('\n').filter(Boolean).pop() || '';

  if (res.status !== 0) {
    // 脚本失败时往往已经打印了 {error: …} 那一行，把原因带出来。
    // 只看 stderr 会得到「退出码 2：」后面什么都没有，等于没说。
    const reason = (res.stderr || '').trim() || lastLine || '(没有任何输出)';
    throw new Error(`${script} ${args[0] ?? ''} 失败（退出码 ${res.status}）：${reason}`);
  }

  try {
    return JSON.parse(lastLine);
  } catch {
    throw new Error(`${script} ${args[0] ?? ''} 的输出不是 JSON：${JSON.stringify(res.stdout)}`);
  }
}

/** 跑通用的 WordPress 探针。 */
export function probe(...args) {
  return probeScript('wp-probe.php', ...args);
}

/* ---------- HTTP ---------- */

/**
 * 默认请求超时。
 *
 * 本地请求都是毫秒级的，所以这个值只是兜底。它必须存在，因为 stub 有一个 `hang` 模式
 * （接住请求什么都不回，用来模拟上游超时）——谁把它留在 hang 上，没有超时的请求就会
 * 一直等下去，看起来像自己的代码死了。有了它，那种情况会变成一条清清楚楚的失败。
 */
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * 把 headers 和 cookie 合成 fetch 用的 headers。
 *
 * cookie 单独给一个参数，而不是让调用方自己塞进 headers：塞的话会**整体顶掉**默认的
 * content-type，于是 PHP 解不出 $_POST，登录/带身份的提交**静默失败**——拿到的是匿名页面，
 * 然后所有断言都以「东西不存在」的形式红，查起来离真相很远。
 *
 * @param {object} headers 额外请求头。
 * @param {string} cookie  Cookie 头的内容。
 */
function mergeHeaders(headers = {}, cookie = '') {
  const merged = { ...headers };
  if (cookie) {
    merged.cookie = cookie;
  }
  return merged;
}

/** GET 一个地址，返回 { status, body, headers }。网络不可达或超时都会抛错。 */
export async function get(url, options = {}) {
  const { cookie = '', headers, ...rest } = options;
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    ...rest,
    headers: mergeHeaders(headers, cookie),
  });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers, setCookies: res.headers.getSetCookie() };
}

/** 取地址可达性与状态码；不可达、或者挂住不应答，都返回 0 而不是抛错。 */
export async function statusOf(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return res.status;
  } catch {
    return 0;
  }
}

/** 按表单方式 POST，返回 { status, body, headers, location, setCookies }。 */
export async function postForm(url, fields, options = {}) {
  const { cookie = '', headers, ...rest } = options;
  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    ...rest,
    // content-type 放在展开**之后**：这是 postForm，契约就是表单编码，调用方给的 headers
    // 盖不掉它（cookie 走单独的参数加进来，更不该碰它）。放在展开之前的话，谁传一个
    // headers 就把 content-type 顶掉了，PHP 解不出 $_POST，提交静默变成匿名页面。
    headers: {
      ...mergeHeaders(headers, cookie),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields).toString(),
  });
  const body = await res.text();
  return {
    status: res.status,
    body,
    headers: res.headers,
    location: res.headers.get('location') || '',
    setCookies: res.headers.getSetCookie(),
  };
}

/**
 * 把响应里的 Set-Cookie 合成一个可以直接回传的 Cookie 头。
 * 只取 `名字=值` 那一段——属性（Path/HttpOnly/Expires）不该出现在请求里。
 */
export function cookieHeaderFrom(setCookies = []) {
  return setCookies
    .map((raw) => String(raw).split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/* ---------- 评论提交 ---------- */

/**
 * 把一个标签的属性读出来。单引号、双引号、不带引号都认。
 * 导出是因为别的验收脚本也要解析表单——各写一份必然会走样（已经发生过一次）。
 */
export function tagAttrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

/**
 * 像浏览器一样提交一条评论：先取回文章页，把 `#commentform` 里**实际存在**的字段
 * 原样回填，等够时间再 POST。
 *
 * 为什么要绕这一圈：主题自己加上防垃圾（蜜罐 + 时间戳令牌）之后，朴素的
 * 「直接 POST 四个字段」会被判成机器人挡掉。而基建**不该**去伪造那个令牌——
 * 那等于让测试绕过被测的那道门，防垃圾就白验了。取真实表单、按真实字段提交，
 * 走的才是访客走的那条路。
 *
 * 等待是必须的：判定窗口是「提交时刻 − 页面渲染时刻」不足 3 秒算机器人，
 * 而「来得太快」被挡下的样子和「忘了带令牌」一模一样，不等等就分不清自己在验什么。
 *
 * @param {string} postUrl  文章地址（表单所在的那个页面）
 * @param {object} options  comment / author / email / url / cookie / consent / extraFields / settleMs / target
 *                          target 给定时改投它（主题自己的端点就是这么验的：**同一份字段**，
 *                          只换投递地址——两边各读一遍表单迟早会读歪，而读歪之后
 *                          看起来仍然像「提交成功了」）。
 */
export async function submitComment(postUrl, { comment, author = 'YUKI-TEST 访客', email = 'yuki-test@example.test', url = '', cookie = '', consent = false, extraFields = {}, settleMs = 3200, target = '' } = {}) {
  const page = await get(postUrl);
  if (page.status !== 200) {
    throw new Error(`取评论表单页失败：${postUrl} 返回 ${page.status}`);
  }

  const form = page.body.match(/<form[^>]*\bid\s*=\s*["']commentform["'][\s\S]*?<\/form>/i);
  if (!form) {
    throw new Error(`页面里找不到 #commentform：${postUrl}`);
  }

  const fields = {};

  for (const m of form[0].matchAll(/<input\b[^>]*>/gi)) {
    const a = tagAttrs(m[0]);
    if (!a.name) continue;

    const type = (a.type || 'text').toLowerCase();
    if (['submit', 'button', 'reset', 'file', 'image'].includes(type)) continue;
    // 复选框/单选框只有勾上的才会被浏览器提交
    if ((type === 'checkbox' || type === 'radio') && !('checked' in a)) continue;

    fields[a.name] = a.value ?? '';
  }

  for (const m of form[0].matchAll(/<textarea\b[^>]*>/gi)) {
    const a = tagAttrs(m[0]);
    if (a.name) fields[a.name] = '';
  }

  if (!fields.comment_post_ID) {
    throw new Error(`#commentform 里没有 comment_post_ID：${postUrl}`);
  }

  for (const [key, value] of Object.entries({ comment, author, email, url })) {
    if (key === 'comment' || key in fields) fields[key] = value;
  }

  // 「记住我的信息」那个勾选框默认不勾（跟真人一样）。勾上时核心才会下发评论者 cookie，
  // 也就是「同一身份再次访问」所依赖的那个身份。
  if (consent) {
    fields['wp-comment-cookies-consent'] = 'yes';
  }

  // 需要往表单里塞额外字段时（比如把蜜罐填上、或者把一个字段改成数组试探守卫），
  // 从这里进去。默认什么都不加——正常访客走的仍然是「表单里有什么就交什么」。
  Object.assign(fields, extraFields);

  // 提交到表单自己声明的 action，而不是我们假定它一定是 wp-comments-post.php：
  // 既然已经费劲去读真实表单了，就没道理把「往哪提交」这一条写死。
  const formTag = form[0].match(/<form\b[^>]*>/i)?.[0] || '';
  const action = tagAttrs(formTag).action;
  const destination = target
    ? new URL(target, postUrl).href
    : (action ? new URL(action, postUrl).href : `${SITE}/wp-comments-post.php`);

  await new Promise((resolve) => setTimeout(resolve, settleMs));

  const response = await postForm(destination, fields, { cookie });

  return { ...response, fields, target: destination, waitedMs: settleMs };
}

/* ---------- 邮件捕获 ---------- */

/**
 * 读出捕获到的邮件。
 *
 * 记录格式由 tests/wp/mu-plugins/yuki-dev-mailbox.php 写入，这里按它解析：
 *   ===== MAIL <ISO 时间> =====
 *   to: ...
 *   subject: ...
 *   headers: ...（可能是多行）
 *   ----- body -----
 *   <正文原样>
 *   ===== END MAIL =====
 *
 * since 是字节偏移。**不要靠清空文件来划界限**：本地环境可能同时开着别的会话，
 * 清空会把它们的捕获一并抹掉。先 markMails() 记下偏移，动作之后从那里读。
 */
export function readMails(since = 0) {
  if (!fs.existsSync(MAIL_LOG)) return [];

  const size = fs.statSync(MAIL_LOG).size;
  if (size <= since) return [];

  const fd = fs.openSync(MAIL_LOG, 'r');
  let raw;
  try {
    // 用 alloc 而不是 allocUnsafe，并且认 readSync 实际读到的字节数：
    // stat 与 read 之间文件被别的进程截短的话，缓冲区尾部就是没写过的内存，
    // 按整个缓冲区长度解码会把这段垃圾拼进正文里。
    const buffer = Buffer.alloc(size - since);
    const { bytesRead } = fs.readSync(fd, buffer, 0, buffer.length, since);
    raw = buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }

  return parseMails(raw);
}

function parseMails(raw) {
  const mails = [];

  for (const chunk of raw.split(/^===== MAIL /m).slice(1)) {
    const nl = chunk.indexOf('\n');
    if (nl === -1) continue;

    const at = chunk.slice(0, nl).replace(/\s*=+\s*$/, '').trim();
    let rest = chunk.slice(nl + 1);
    const end = rest.indexOf('\n===== END MAIL =====');
    if (end !== -1) rest = rest.slice(0, end);

    const sep = rest.indexOf('\n----- body -----\n');
    const head = sep === -1 ? rest : rest.slice(0, sep);
    const body = sep === -1 ? '' : rest.slice(sep + '\n----- body -----\n'.length);

    // 头字段按行读；不以 `名字:` 开头的行算作上一行的续行
    const headers = {};
    let key = null;
    for (const line of head.split('\n')) {
      const kv = /^([a-z][a-z-]*): ?(.*)$/.exec(line);
      if (kv) {
        key = kv[1];
        headers[key] = kv[2];
      } else if (key) {
        headers[key] += `\n${line}`;
      }
    }

    mails.push({ at, headers, to: headers.to || '', subject: headers.subject || '', body });
  }

  return mails;
}

/** 记下当前捕获文件的大小，作为「之后新来的邮件从这里算」的界限。 */
export function markMails() {
  try {
    return fs.statSync(MAIL_LOG).size;
  } catch {
    return 0;
  }
}

/** 取出正文里的全部 http(s) 链接。 */
export function linksIn(text) {
  return (text || '').match(/https?:\/\/[^\s<>"')\]]+/g) || [];
}

/* ---------- 上游 stub ---------- */

export function stubSetMode(mode) {
  fs.mkdirSync(UPSTREAM_DIR, { recursive: true });
  fs.writeFileSync(MODE_FILE, `${mode}\n`);
}

export function stubSetBody(body) {
  fs.mkdirSync(UPSTREAM_DIR, { recursive: true });
  fs.writeFileSync(BODY_FILE, body);
}

export function stubHits() {
  if (!fs.existsSync(HITS_LOG)) return [];
  return fs.readFileSync(HITS_LOG, 'utf8').split('\n').filter(Boolean);
}

/** 命中次数。**不要清空 hits.log 来划界限**——同一个本地环境可能还开着别的会话。 */
export function stubHitCount() {
  return stubHits().length;
}

/** 把 stub 拉起来并等它真的能应答；返回子进程句柄。 */
export async function startStub() {
  const child = spawn(
    process.execPath,
    [path.join(TESTS_DIR, 'bin', 'upstream-stub.mjs'), `--port=${STUB_PORT}`, `--var=${VAR_DIR}`],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString();
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  /*
   * 等的是**我们自己这个子进程**报告「已监听」，不是「这个端口上有人应答」。
   * 两者在并发下不是一回事：另一个会话的 stub 占着同一个端口时，我们的子进程会
   * 因 EADDRINUSE 立刻退出，而端口探测照样拿到 200——探头一问，返回一个已经死了的
   * 子进程，后面 stopStub 又因为 exitCode 非空而无操作，「停掉之后不再应答」就假红。
   */
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) {
      throw new Error(`stub 起来就退了（退出码 ${child.exitCode}）：${stderr.trim() || '(无输出)'}`);
    }
    if (stdout.includes('stub 监听')) return child;
    await new Promise((r) => setTimeout(r, 50));
  }

  child.kill();
  throw new Error(`stub 在 3 秒内没有报告监听：${stderr.trim() || '(无输出)'}`);
}

/** 停掉 stub 并等端口真的关掉，这样「连接被拒」才是真的。 */
export async function stopStub(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))]);

  for (let i = 0; i < 40; i++) {
    if ((await statusOf(`${STUB_BASE}/__mode`)) === 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}
