// 无头 Edge 的量一量：验收里那些「看着对不对」的东西——配色、窄屏下的宽度——
// 在 HTML 里看不出来，算完之后的颜色与盒子只有浏览器知道。
//
// 不引第三方库：Node 自带 WebSocket，Edge 自带 CDP。用 `--remote-debugging-port=0`
// 让系统挑端口，免得和别的会话（或者我们自己的另一次截图）撞上。
//
// 用法：
//   import { launch, newPage } from './browser.mjs';
//   const browser = await launch();
//   const page = await newPage( browser, { colorScheme: 'dark' } );
//   await page.setViewport( 1200, 900 );
//   await page.goto( url );
//   const bg = await page.evaluate( `getComputedStyle(document.body).backgroundColor` );
//   await page.close(); await browser.close();
//
// 环境变量 YUKI_EDGE 可以换浏览器可执行文件。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EDGE = process.env.YUKI_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 起一个无头浏览器。用完记得 close()，临时 profile 会一起删掉。 */
export async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yuki-edge-'));
  const child = spawn(EDGE, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  // 端口由系统挑，写在 DevToolsActivePort 里（第一行是端口，第二行是浏览器路径）
  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 120 && !port; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) {
      port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]) || 0;
    }
  }

  if (!port) {
    child.kill();
    throw new Error(`无头浏览器没起来，没等到 DevToolsActivePort：${EDGE}`);
  }

  return {
    port,
    async close() {
      child.kill();
      await sleep(200);
      fs.rmSync(profile, { recursive: true, force: true });
    },
  };
}

/**
 * 开一个页面。
 *
 * colorScheme 走 CDP 的 prefers-color-scheme，主题的内联脚本就是拿它决定深浅色的——
 * 所以这条路验的是**主题真实的那条分支**，而不是给页面塞个 class 假装深色。
 *
 * @param {object} browser launch() 的返回值。
 * @param {object} options { colorScheme: 'light' | 'dark' }
 * @return {Promise<object>} { setViewport, goto, evaluate, close }
 */
export async function newPage(browser, { colorScheme = 'light' } = {}) {
  const res = await fetch(`http://127.0.0.1:${browser.port}/json/new?about:blank`, { method: 'PUT' });
  if (!res.ok) {
    throw new Error(`开页面失败：HTTP ${res.status}`);
  }

  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const waiters = new Map();
  let nextId = 0;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);

    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}（${msg.method}）`));
      else resolve(msg.result);
      return;
    }

    if (msg.method && waiters.has(msg.method)) {
      waiters.get(msg.method)(msg.params);
      waiters.delete(msg.method);
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP 连接失败')), { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const once = (method) => new Promise((resolve) => waiters.set(method, resolve));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: colorScheme }],
  });

  return {
    /** 视口尺寸。要在 goto 之前设，媒体查询才会按这个宽度算。 */
    async setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: false,
      });
    },

    async goto(url) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url });
      await loaded;
    },

    /** 在页面里跑一段表达式，返回它的值；页面里抛错就当失败抛出来。 */
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });

      if (result.exceptionDetails) {
        throw new Error(`页面里执行出错：${result.exceptionDetails.text} ${result.result?.description || ''}`);
      }

      return result.result.value;
    },

    async close() {
      ws.close();
    },
  };
}
