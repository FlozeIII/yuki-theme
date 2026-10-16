#!/usr/bin/env node
// 工单 02：给主题产一张顶层 screenshot.png——**首页 · 浅色**，1200×900（4:3）。
//
//   node tests/bin/make-screenshot.mjs [输出.png]
//
// 是**真实渲染**出来的页面，不是拼的营销图：走 browser.mjs 那只看页面的眼睛（CDP），
// 设好视口之后再截。**不要**退回 `msedge --screenshot --window-size=…` 那类老办法——
// 它按更宽的默认布局渲染再裁剪，出来的图会像横向溢出（文件头写着那次教训）。
//
// 浅色是主题的默认形态（深色是变体），拿变体当门面会让第一印象与装上之后的默认对不上。
// 配色走 CDP 的 prefers-color-scheme，与 measure() 量深浅色时用的是同一条分支；临时 profile
// 里没有 localStorage，所以「跟系统走」这条默认路径就是它真正会走的那条。
//
// 拍摄条件由**产图前**守住（这条命令是产图的那一端，产图前先确认拍的是有内容的首页）：
// 首页模板在、文章够数、视口里的缩略图都加载完了。任一不成立就报错停下、**不**产出新图——
// 悄悄产一张空白卡片发出去，比报错难查得多。
//
// 前置：本地站已在跑（YUKI_SITE，默认 http://localhost:8080），环境里有几篇带缩略图的文章。

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { REPO_ROOT, SITE } from './lib.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { VIEWPORT, MIN_POSTS, READ_FIRST_SCREEN } from './homepage.mjs';

const OUTPUT = path.resolve(process.argv[2] || path.join(REPO_ROOT, 'screenshot.png'));

if (process.argv.length > 3) {
  console.error('用法: node tests/bin/make-screenshot.mjs [输出.png]');
  process.exit(2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const png = await withBrowser(async (browser) => {
    const page = await newPage(browser, { colorScheme: 'light' });

    try {
      await page.setViewport(VIEWPORT.width, VIEWPORT.height);
      await page.goto(`${SITE}/`);

      // 等视口里的图都画出来再截，免得截到还没填上的空框。最多等 5 秒；
      // 超时就照截，下面那条守卫会把「还差几张」报出来。要等的是哪几张由
      // homepage.mjs 那个表达式说——这里不另写一份「算不算在视口里」的几何。
      const deadline = Date.now() + 5000;
      let seen = await page.evaluate(READ_FIRST_SCREEN);

      while (seen.loadedInView && Date.now() < deadline) {
        await sleep(100);
        seen = await page.evaluate(READ_FIRST_SCREEN);
      }

      if (!seen.hero) {
        throw new Error(`打开的地址不是首页模板（没有 .yuki-hero.yuki-dot-pattern 那一块）：${SITE}/`);
      }
      if (seen.posts < MIN_POSTS) {
        throw new Error(`首页只有 ${seen.posts} 篇文章，少于 ${MIN_POSTS} 篇——先往本地环境里放几篇带缩略图的文章。`);
      }
      if (!seen.thumbsInView) {
        throw new Error('视口里没有任何带缩略图的文章，截出来会是一屏没有图的列表。');
      }
      if (seen.loadedInView) {
        throw new Error(`视口里还有 ${seen.loadedInView} 张图没加载出来，等超时了才截的——先查那几张图。`);
      }
      // 浅色是主题默认形态；这里要是拍成了深色，说明「跟系统走」那条分支没按预期走。
      if (seen.htmlClass.split(/\s+/).includes('dark')) {
        throw new Error(`页面落在深色形态上了（html class="${seen.htmlClass}"），这张该拍浅色。`);
      }

      console.log(`拍摄条件  首页在，${seen.posts} 篇文章（视口内带缩略图 ${seen.thumbsInView} 张，缩略图共 ${seen.thumbs} 张）`);
      console.log(`形态      light（html class="${seen.htmlClass}"，body 底色 ${seen.bodyBg}）`);
      // 第一屏摆了哪几篇——图里是什么，这里就说出来，别让人对着产物猜。
      console.log(`第一屏    ${seen.screen.join(' / ')}`);

      return await page.screenshot();
    } finally {
      await page.close();
    }
  });

  // 先写临时文件再换：写一半被打断也不会毁掉已有的那张图。
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const staging = `${OUTPUT}.tmp-${randomUUID()}`;
  fs.writeFileSync(staging, png);
  fs.renameSync(staging, OUTPUT);

  console.log(`主题截图：${OUTPUT}\n尺寸：${VIEWPORT.width}×${VIEWPORT.height}（${(png.length / 1024).toFixed(0)} KB）`);
} catch (error) {
  console.error(`截图失败：${error.message}`);
  process.exit(1);
}
