import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  WP_ROOT,
  get,
  php,
} from './lib.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { check, note, report, section } from './report.mjs';

const FIXTURES = join(REPO_ROOT, 'tests', 'bin', 'reading-fixtures.php');
const readingPhp = readFileSync(join(REPO_ROOT, 'inc', 'reading.php'), 'utf8');
const readingJs = readFileSync(join(REPO_ROOT, 'assets', 'js', 'reading.js'), 'utf8');
const singlePhp = readFileSync(join(REPO_ROOT, 'single.php'), 'utf8');
const functionsPhp = readFileSync(join(REPO_ROOT, 'functions.php'), 'utf8');
const componentsCss = readFileSync(join(REPO_ROOT, 'assets', 'css', 'components.css'), 'utf8');

section('静态');
check('reading.php 存在并被显式 require', functionsPhp.includes("require_once get_template_directory() . '/inc/reading.php';"));
check('系列分类只在 post 上注册', readingPhp.includes("register_taxonomy") && readingPhp.includes("'post'"));
check('目录脚本只在单篇入队', readingPhp.includes('is_singular') && readingPhp.includes("'yuki-reading'"));
check('文案通过 wp_localize_script 注入', readingPhp.includes('wp_localize_script') && readingPhp.includes("'tocLabel'") && readingPhp.includes("'progressLabel'"));
check('single.php 有目录挂载点和系列调用', singlePhp.includes('data-yuki-toc') && singlePhp.includes('yuki_series_nav'));
check('reading.js 是无依赖 IIFE', /^\s*\( function \(\) \{/m.test(readingJs) && !/\b(?:import|require)\s*\(/.test(readingJs));
check('reading.js 不收外部资源', !/https?:\/\//.test(readingJs));
check('只从 h2/h3 生成目录', readingJs.includes("querySelectorAll( 'h2, h3' )"));
check('目录有当前项语义', readingJs.includes("aria-current"));
check('进度条有 progressbar 语义', readingJs.includes("'progressbar'") && readingJs.includes('aria-valuenow'));
check('reduced motion 在 JS 与 CSS 都处理', readingJs.includes('prefers-reduced-motion') && componentsCss.includes('prefers-reduced-motion'));
check('目录与系列样式存在', ['.yuki-toc', '.yuki-series', '.yuki-series-list', '.yuki-toc-list'].every((s) => componentsCss.includes(s)));
check('640px 目录可滚动且不横向溢出', componentsCss.includes('max-height: 50vh') && componentsCss.includes('overflow: auto'));

const fixture = php([FIXTURES, WP_ROOT]);
const match = fixture.stdout.match(/YUKI-JSON: ({.*})/);
check('fixtures 输出 JSON', Boolean(match), fixture.stdout.slice(-300));
const data = match ? JSON.parse(match[1]) : {};

const page = await get(data.page_url);
const standalone = await get(data.standalone_url);
check('系列文章返回 200', page.status === 200, page.status);
check('无头文章返回 200', standalone.status === 200, standalone.status);
check('单篇输出目录空槽', page.body.includes('data-yuki-toc'));
check('单篇加载阅读脚本', page.body.includes('/assets/js/reading.js'));
check('注入目录与进度文案', page.body.includes('yukiReading') && page.body.includes('progressLabel') && page.body.includes('tocLabel'));
check('服务端不预生成目录', !page.body.includes('<nav class="yuki-toc"'));
check('系列导航有三篇且当前项不是链接', (page.body.match(/class="yuki-series-title"/g) || []).length === 3 && page.body.includes('aria-current="page"'));
check('无系列的单篇不输出系列容器', !standalone.body.includes('<nav class="yuki-series"'));
check('系列导航在上下篇之前', page.body.indexOf('class="yuki-series"') < page.body.indexOf('class="yuki-post-nav"'));

await withBrowser(async (browser) => {
  const wide = await newPage(browser, { colorScheme: 'light' });
  await wide.setViewport(1440, 900);
  await wide.goto(data.page_url);
  await wide.waitFor("document.querySelectorAll('.yuki-toc-list a').length === 3");

  const initial = await wide.evaluate(`(() => {
    const toc = document.querySelector('.yuki-toc');
    const bar = document.querySelector('.yuki-reading-progress-bar');
    return {
      open: toc.open,
      levels: [...document.querySelectorAll('.yuki-toc-list li')].map((li) => li.className),
      current: document.querySelector('.yuki-toc-list a[aria-current]')?.textContent,
      progress: document.querySelector('.yuki-reading-progress').getAttribute('aria-valuenow'),
      transition: getComputedStyle(bar).transitionDuration,
    };
  })()`);
  check('桌面目录默认展开', initial.open === true);
  check('目录只渲染两个 h2 和一个 h3', initial.levels.filter((v) => v === 'is-level-2').length === 2 && initial.levels.includes('is-level-3'));
  check('首屏标记当前小节', initial.current === '第一节 · 起点', initial.current);
  check('进度条从 0 开始', initial.progress === '0', initial.progress);
  check('进度条有过渡', initial.transition !== '0s', initial.transition);

  await wide.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
  await wide.waitFor("Number(document.querySelector('.yuki-reading-progress').getAttribute('aria-valuenow')) >= 95");
  const bottom = await wide.evaluate("document.querySelector('.yuki-reading-progress').getAttribute('aria-valuenow')");
  check('滚到底部进度接近 100', Number(bottom) >= 95, bottom);

  await wide.evaluate("document.querySelectorAll('.yuki-toc-list a')[2].click()");
  await wide.waitFor("location.hash === '#section-3'");
  const clicked = await wide.evaluate(`({
    hash: location.hash,
    current: document.querySelector('.yuki-toc-list a[aria-current]')?.textContent,
    focused: document.activeElement.tagName + ':' + document.activeElement.id,
    open: document.querySelector('.yuki-toc').open,
  })`);
  check('点击更新 hash', clicked.hash === '#section-3', clicked.hash);
  check('点击后目录当前项跟随', clicked.current === '第二节 · 结论', clicked.current);
  check('点击后焦点落到标题', clicked.focused === 'H2:section-3', clicked.focused);
  check('桌面点击后目录保持展开', clicked.open === true);

  const narrow = await newPage(browser, { colorScheme: 'light' });
  await narrow.setViewport(390, 844);
  await narrow.goto(data.page_url);
  await narrow.waitFor("document.querySelectorAll('.yuki-toc-list a').length === 3");
  const mobile = await narrow.evaluate(`({
    open: document.querySelector('.yuki-toc').open,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  })`);
  check('640px 目录默认折叠', mobile.open === false);
  check('640px 无横向溢出', mobile.overflow === false);

  const noToc = await newPage(browser, { colorScheme: 'light' });
  await noToc.setViewport(1440, 900);
  await noToc.goto(data.standalone_url);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const standaloneState = await noToc.evaluate(`({
    toc: Boolean(document.querySelector('.yuki-toc')),
    series: Boolean(document.querySelector('.yuki-series')),
    progress: Boolean(document.querySelector('.yuki-reading-progress')),
  })`);
  check('无标题文章不生成空目录', standaloneState.toc === false);
  check('无系列文章不生成空系列容器', standaloneState.series === false);
  check('无标题文章仍有阅读进度', standaloneState.progress === true);

  const reduced = await newPage(browser, { reducedMotion: true });
  await reduced.setViewport(1440, 900);
  await reduced.goto(data.page_url);
  await reduced.waitFor("document.querySelectorAll('.yuki-toc-list a').length === 3");
  const reducedState = await reduced.evaluate("getComputedStyle(document.querySelector('.yuki-reading-progress-bar')).transitionDuration");
  check('reduced motion 下进度无过渡', reducedState === '0s', reducedState);

  await wide.close();
  await narrow.close();
  await noToc.close();
  await reduced.close();
});

note('fixtures 在脚本结束前用 --cleanup 清理。');
php([FIXTURES, WP_ROOT, '--cleanup']);
report();
