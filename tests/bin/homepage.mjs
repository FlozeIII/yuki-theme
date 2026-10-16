// 首页第一屏的观察点（工单 02）：产图那条命令与验收那条命令要看的是同一批东西——
// 视口多大、「一篇文章」以哪些类名算、第一屏摆了哪几篇、视口里的缩略图加载完了没有。
//
// **为什么单独一个文件**：这两条命令各写一份的话，主题哪天改了类名或尺寸，就会出现
// 「产图按 A 判、验收按 B 判」——两份都在跑，验的却不是一回事。抽出来的理由与
// theme-css.mjs、report.mjs 相同。要验「首页第一屏」的工单也从此处取。
//
// 用法：
//   import { VIEWPORT, MIN_POSTS, READ_FIRST_SCREEN, measureFirstScreen } from './homepage.mjs';
//   const seen = await page.evaluate( READ_FIRST_SCREEN );   // 手里已经有页面时
//   const seen = await measureFirstScreen( browser );        // 没有页面、量完就完事

import { SITE } from './lib.mjs';
import { measure } from './browser.mjs';

/** 官方的硬线是「不大于 1200×900」与 4:3，主题取上限。 */
export const VIEWPORT = { width: 1200, height: 900 };

/** 首页至少要摆得下「若干篇」——一两篇空荡荡的首页不该拿来当门面。 */
export const MIN_POSTS = 3;

/**
 * 在页面里读第一屏，返回一个普通对象（`page.evaluate` 拿得到的那种）。
 *
 * `screen` 是**视口里**那几篇的标题，用来把「图里摆了哪几篇」原样打出来；
 * `loadedInView` 是视口里还没画出来的图有几张（等图片那段见 make-screenshot.mjs）。
 */
export const READ_FIRST_SCREEN = `(() => {
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  };
  const items = [...document.querySelectorAll('.yuki-post-item')];
  const thumbs = [...document.querySelectorAll('.yuki-post-item .yuki-post-thumb img')];
  const loaded = (img) => img.complete && img.naturalWidth > 0;

  return {
    hero: !!document.querySelector('.yuki-hero.yuki-dot-pattern'),
    posts: items.length,
    thumbs: thumbs.length,
    thumbsInView: thumbs.filter(inView).length,
    loadedInView: [...document.querySelectorAll('img')].filter((img) => inView(img) && !loaded(img)).length,
    screen: items.filter(inView).map((item) => (item.querySelector('.yuki-post-title') || {}).textContent?.trim() || '(无标题)'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlClass: document.documentElement.className,
  };
})()`;

/**
 * 用与拍摄时相同的视口与配色，量一次现在的首页。量完页面就关掉。
 *
 * @param {object} browser launch() 的返回值。
 */
export function measureFirstScreen(browser) {
  return measure(browser, `${SITE}/`, {
    colorScheme: 'light',
    ...VIEWPORT,
    expression: READ_FIRST_SCREEN,
  });
}
