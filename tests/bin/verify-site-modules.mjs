import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPO_ROOT,
  WP_ROOT,
  get,
  php,
} from './lib.mjs';
import { withBrowser, newPage } from './browser.mjs';
import { check, report, section } from './report.mjs';

const FIXTURES = join(REPO_ROOT, 'tests', 'bin', 'site-modules-fixtures.php');
const functionsPhp = readFileSync(join(REPO_ROOT, 'functions.php'), 'utf8');
const modulesPhp = readFileSync(join(REPO_ROOT, 'inc', 'site-modules.php'), 'utf8');
const modulesCss = readFileSync(join(REPO_ROOT, 'assets', 'css', 'site-modules.css'), 'utf8');
const modulesJs = readFileSync(join(REPO_ROOT, 'assets', 'js', 'site-modules.js'), 'utf8');
const sidebarPhp = readFileSync(join(REPO_ROOT, 'sidebar.php'), 'utf8');
const footerPhp = readFileSync(join(REPO_ROOT, 'footer.php'), 'utf8');

section('静态');
check('site-modules.php 存在并被显式 require', functionsPhp.includes("require_once get_template_directory() . '/inc/site-modules.php';"));
check('注册页脚菜单位置', modulesPhp.includes("register_nav_menus") && modulesPhp.includes("'footer'"));
check('站点模块样式与脚本在 style 之后加载', modulesPhp.includes("'yuki-site-modules'") && modulesPhp.includes('yuki_asset_version'));
check('五个模板部件存在', ['site-stats.php', 'site-tag-wall.php', 'site-author-card.php', 'site-subscribe.php', 'site-footer-links.php'].every((file) => existsSync(join(REPO_ROOT, 'template-parts', file))));
check('侧栏调用作者卡、标签墙、订阅卡', sidebarPhp.includes("'template-parts/site-author-card'") && sidebarPhp.includes("'template-parts/site-tag-wall'") && sidebarPhp.includes("'template-parts/site-subscribe'"));
check('页脚调用链接组', footerPhp.includes("'template-parts/site-footer-links'"));
check('标签墙无脚本默认 open', readFileSync(join(REPO_ROOT, 'template-parts', 'site-tag-wall.php'), 'utf8').includes('open>'));
check('标签墙脚本无外部依赖', /^\s*\( function \(\) \{/m.test(modulesJs) && !/\b(?:import|require)\s*\(/.test(modulesJs));
check('标签墙有折叠阈值', modulesJs.includes('data-collapse-at') && modulesCss.includes('.yuki-tag-wall-list'));
check('订阅卡复用邮箱表单', modulesCss.includes('.yuki-subscribe-card form') && readFileSync(join(REPO_ROOT, 'template-parts', 'site-subscribe.php'), 'utf8').includes('onsubmit="return false;"'));
check('作者卡不直接输出 Gravatar', !readFileSync(join(REPO_ROOT, 'template-parts', 'site-author-card.php'), 'utf8').includes('get_avatar('));
check('640px 页脚与标签墙改为单列', modulesCss.includes('@media (max-width: 640px)') && modulesCss.includes('grid-template-columns: minmax(0, 1fr)'));

section('HTTP');
const fixture = php([FIXTURES, WP_ROOT]);
const match = fixture.stdout.match(/YUKI-JSON: ({.*})/);
check('fixtures 输出 JSON', Boolean(match), fixture.stdout.slice(-300));
const data = match ? JSON.parse(match[1]) : {};

const home = await get(data.home_url);
const single = await get(data.post_url);
check('首页返回 200', home.status === 200, home.status);
check('单篇返回 200', single.status === 200, single.status);
check('首页有数据条三项', (home.body.match(/yuki-stats-bar/g) || []).length === 1 && (home.body.match(/<dt>/g) || []).length >= 3);
check('单篇有作者卡与订阅卡', single.body.includes('yuki-author-card') && single.body.includes('yuki-subscribe-card'));
check('单篇有标签墙且默认展开', single.body.includes('data-yuki-tag-wall') && single.body.includes('open>'));
check('标签墙渲染至少 14 个标签', (single.body.match(/class="yuki-tag-wall-list"/g) || []).length === 1 && (single.body.match(/yuki-tag-wall-item-count/g) || []).length >= 14, String((single.body.match(/yuki-tag-wall-item-count/g) || []).length));
check('外部头像地址不回源', !single.body.includes('secure.gravatar.com'));
check('页脚有三组兜底链接', (single.body.match(/class="yuki-footer-group"/g) || []).length === 3);
check('页脚组不是空列表', (single.body.match(/class="yuki-footer-group"/g) || []).length === 3 && single.body.includes('RSS') && single.body.includes('首页'));

section('浏览器');
await withBrowser(async (browser) => {
  const wide = await newPage(browser, { colorScheme: 'light' });
  await wide.setViewport(1440, 900);
  await wide.goto(data.post_url);
  await wide.waitFor("document.querySelector('.yuki-tag-wall')");

  const wideState = await wide.evaluate(`(() => {
    const wall = document.querySelector('.yuki-tag-wall');
    return {
      open: wall.open,
      count: wall.querySelectorAll('.yuki-tag-wall-list > li').length,
      subscribe: Boolean(document.querySelector('.yuki-subscribe-card form')),
      author: Boolean(document.querySelector('.yuki-author-mark')) || Boolean(document.querySelector('.yuki-author-avatar')),
      emailValid: document.querySelector('.yuki-subscribe-card input[type="email"]').checkValidity(),
      footerCols: getComputedStyle(document.querySelector('.yuki-footer-links')).gridTemplateColumns.split(' ').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  })()`);
  check('14 个标签时脚本默认收起', wideState.open === false);
  check('标签墙渲染至少 14 项', wideState.count >= 14, String(wideState.count));
  check('订阅表单可用', wideState.subscribe === true);
  check('空邮箱被原生校验拦住', wideState.emailValid === false);
  check('作者卡使用本地元素', wideState.author === true);
  check('桌面页脚三列', wideState.footerCols === 3, String(wideState.footerCols));
  check('桌面无横向溢出', wideState.overflow === false);

  await wide.evaluate("document.querySelector('.yuki-tag-wall summary').click()");
  await wide.waitFor("document.querySelector('.yuki-tag-wall').open === true");
  check('点击摘要展开标签墙', await wide.evaluate("document.querySelector('.yuki-tag-wall').open === true"));

  const narrow = await newPage(browser, { colorScheme: 'light' });
  await narrow.setViewport(640, 900);
  await narrow.goto(data.post_url);
  await narrow.waitFor("document.querySelector('.yuki-tag-wall')");
  const narrowState = await narrow.evaluate(`(() => {
    const wall = document.querySelector('.yuki-tag-wall');
    return {
      columns: getComputedStyle(wall.querySelector('.yuki-tag-wall-list')).gridTemplateColumns.split(' ').length,
      footerCols: getComputedStyle(document.querySelector('.yuki-footer-links')).gridTemplateColumns.split(' ').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  })()`);
  check('640px 标签墙单列', narrowState.columns === 1, String(narrowState.columns));
  check('640px 页脚单列', narrowState.footerCols === 1, String(narrowState.footerCols));
  check('640px 无横向溢出', narrowState.overflow === false);

  const archive = await get(data.archive_url);
  check('归档页有数据条', archive.status === 200 && archive.body.includes('yuki-archive-stats'), archive.status);
});

php([FIXTURES, WP_ROOT, '--cleanup']);
report();
