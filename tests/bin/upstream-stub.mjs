#!/usr/bin/env node
// 一言上游的本地 stub。
//
// 控制面刻意放在**文件**上而不是 HTTP 上：测试要能在 stub 整个死掉之后照样读得到
// 命中次数、照样改得了状态，而这在「通过 stub 自己控制 stub」时是做不到的。
//
//   <var>/upstream/mode      ok | 500 | garbage（默认 ok）
//   <var>/upstream/body.txt  mode=ok 时返回的正文
//   <var>/upstream/hits.log  每个上游请求追加一行：<ISO 时间> <方法> <路径>
//
// 起:  node tests/bin/upstream-stub.mjs --port=8099 --var=<目录>
// 停:  杀掉进程即可——端口不再监听，连接被拒，「上游不可达」才是真的不可达。
//
// 除 /__mode 与 /__hits 外，任何路径都算一次上游请求：一言具体打哪个路径由工单 09 决定，
// 这里不该抢先把它定下来。

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=')];
  }),
);

const port = Number(args.get('port') || 8099);
const varDir = args.get('var') || path.resolve(process.cwd(), 'var');
const dir = path.join(varDir, 'upstream');

const MODE = path.join(dir, 'mode');
const BODY = path.join(dir, 'body.txt');
const HITS = path.join(dir, 'hits.log');

fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(MODE)) fs.writeFileSync(MODE, 'ok\n');
if (!fs.existsSync(BODY)) fs.writeFileSync(BODY, '<p>stub 的默认正文</p>');
if (!fs.existsSync(HITS)) fs.writeFileSync(HITS, '');

const read = (file, fallback = '') => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
};

const mode = () => read(MODE, 'ok').trim() || 'ok';

// 长得像 JSON 才不算「无法解析」——故障态要能被一眼认出来是垃圾
const GARBAGE = '<html><body>不是 JSON，也不像一言，什么都没有</body></html>';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const plain = (status, text) => {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(text);
  };

  if (url.pathname === '/__mode') return plain(200, mode());
  if (url.pathname === '/__hits') return plain(200, String(read(HITS).split('\n').filter(Boolean).length));

  // 其余一律算上游请求
  fs.appendFileSync(HITS, `${new Date().toISOString()} ${req.method} ${req.url}\n`);

  const current = mode();
  if (current === '500') return plain(500, 'stub: 上游故障');

  if (current === 'garbage') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(GARBAGE);
  }

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(read(BODY));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // 并发会话很容易撞到这里：端口被另一个会话的 stub 占着。说清楚，别让它看起来像启动超时。
    console.error(`stub 起不来：端口 ${port} 已被占用（多半是另一个会话的 stub 在跑）`);
  } else {
    console.error(`stub 起不来：${err.message}`);
  }
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`stub 监听 http://127.0.0.1:${port}（状态目录 ${dir}）`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
