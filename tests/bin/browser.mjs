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
//   const png = await page.screenshot();     // 量完之后同样能把它截下来（工单 02）
//   await page.close(); await browser.close();
//
// 环境变量 YUKI_EDGE 可以换浏览器可执行文件。
//
// **量窄屏别用 `msedge --screenshot --window-size=375,1400` 那种老办法。** 它按更宽的默认布局
// 渲染再裁剪图片，看着像「页面横向溢出、文字被切」——本仓库真的踩过一次：据此报了一条「375px 整站
// 溢出」的疑点，用 measure() 一量，文档 360 < 视口 375、越界元素 0 个，纯属截图方法的错觉。
// 要量宽度、颜色、盒模型，都走这里（CDP 的 Emulation.setDeviceMetricsOverride 才是真视口）。

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
 * 起一个浏览器、跑一段回调、无论成败都关掉。
 *
 * @param {Function} fn 收到 browse 对象（launch() 的返回值）。
 */
export async function withBrowser(fn) {
  const browser = await launch();

  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

/**
 * 开一个页面、设好视口与配色、打开地址、跑一段表达式量个数，然后关掉。
 *
 * 各工单的视觉断言差的只是「量什么」，起页面这一套是一样的——这段之前在每个脚本里
 * 各写了一遍，抽到这里。要在一个页面里量多处，或者要跨页面比较，直接用 newPage()。
 *
 * @param {object} browser   launch() 的返回值。
 * @param {string} url       打开的地址。
 * @param {object} options   { colorScheme, width, height, expression }
 * @return {Promise<*>} expression 的值。
 */
export async function measure(browser, url, { colorScheme = 'light', width = 1200, height = 900, expression } = {}) {
  const page = await newPage(browser, { colorScheme });

  try {
    await page.setViewport(width, height);
    await page.goto(url);
    return await page.evaluate(expression);
  } finally {
    await page.close();
  }
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

    /**
     * 把当前视口截成一张图，返回它的字节。
     *
     * 必须**在 setViewport() 与 goto() 之后**调用：视口定下布局、页面画完，才有得截。
     * 只截视口那么大（captureBeyondViewport: false），不是整页长图——官方的主题截图要的就是一屏。
     *
     * 不要退回 `msedge --screenshot --window-size=…` 那类老办法：它按更宽的默认布局渲染再裁剪，
     * 出来的图会像横向溢出（见文件头那段）。这里走的是 CDP，跟 measure() 用的是同一个视口。
     *
     * @param {object} options { format: 'png' | 'jpeg' }
     * @return {Promise<Buffer>} 图片字节。
     */
    async screenshot({ format = 'png' } = {}) {
      const { data } = await send('Page.captureScreenshot', { format, captureBeyondViewport: false });
      if (!data) throw new Error('截图没有返回数据');
      return Buffer.from(data, 'base64');
    },

    async close() {
      ws.close();
    },
  };
}
