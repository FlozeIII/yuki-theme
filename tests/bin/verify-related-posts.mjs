// 工单 01 的验收：文章末尾的关联文章。
//
// 走 HTTP：条数、顺序、排除项与区块位置都能在 HTML 里数出来。
// 样式做静态断言：只用 token、没有硬编码颜色。
//
// 用法: node tests/bin/verify-related-posts.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { themeCss, tokens, usedTokens } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'related-posts-fixtures.php');

/* ---------------- 静态 ---------------- */

section('文件与样式');

check('查询文件存在', fs.existsSync(path.join(REPO_ROOT, 'inc', 'related-posts.php')));
check('模板片段存在', fs.existsSync(path.join(REPO_ROOT, 'template-parts', 'related-posts.php')));

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
check('functions.php 显式 require 了 related-posts.php',
  /require_once\s+get_template_directory\(\)\s*\.\s*['"]\/inc\/related-posts\.php['"]/.test(functions));

const single = fs.readFileSync(path.join(REPO_ROOT, 'single.php'), 'utf8');
check('single.php 调用了关联模板',
  /get_template_part\(\s*'template-parts\/related-posts'\s*\)/.test(single));

const css = themeCss();
const root = tokens(css);
const dark = tokens(css, '.dark');

const relatedBodies = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].includes('.yuki-related'))
  .map((m) => m[2])
  .join('\n');

check('关联样式存在', relatedBodies.length > 0);
check('样式没有硬编码颜色',
  !/#[0-9a-f]{3,8}\b/i.test(relatedBodies) && !/rgba?\(\s*\d/.test(relatedBodies),
  (relatedBodies.match(/#[0-9a-f]{3,8}\b|rgba?\(\s*\d/gi) ?? []).join(', '));

const missing = usedTokens(relatedBodies).filter((name) => !(name in root) && !(name in dark));
check('样式引用的 token 都已定义', missing.length === 0, missing.join(', '));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);

/* ---------------- HTTP ---------------- */

section('条数、顺序与排除');

const page = await get(facts.current_url);
check('当前文章能打开', page.status === 200, `status=${page.status}`);

const related = /<nav class="yuki-related"[\s\S]*?<\/nav>/.exec(page.body)?.[0] ?? '';
check('有关联区块', related.length > 0);
check('区块有可访问的名字', /aria-label="相关文章"/.test(related));
check('有标题', /<h2 class="yuki-related-title">相关文章<\/h2>/.test(related));

const items = [...related.matchAll(/<li class="yuki-related-item">/g)].length;
check('正好三篇', items === 3, `找到 ${items} 篇`);

const titles = [...related.matchAll(/<span class="yuki-related-item-title">([^<]*)<\/span>/g)]
  .map((m) => m[1]);
check('顺序是：同分类两篇，再同标签补一篇',
  JSON.stringify(titles) === JSON.stringify(facts.expected),
  JSON.stringify(titles));

check('当前文章不在关联里', !related.includes(facts.current_title));
check('超过三篇的候选不在关联里',
  facts.not_related.every((title) => !related.includes(title)),
  facts.not_related.filter((title) => related.includes(title)).join(', '));

const posNav = page.body.indexOf('yuki-post-nav');
const posRelated = page.body.indexOf('yuki-related');
const posComments = page.body.indexOf('yuki-comments');
check('关联在上下篇之后、评论之前',
  posNav >= 0 && posRelated > posNav && posComments > posRelated,
  `post-nav=${posNav} related=${posRelated} comments=${posComments}`);

/* ---------------- 空关联与说说 ---------------- */

section('没有关联时不占位');

const empty = await get(facts.empty_url);
check('没有关联的文章能打开', empty.status === 200, `status=${empty.status}`);
check('没有关联时不输出整段', !empty.body.includes('yuki-related'));

if (facts.shuoshuo_url) {
  const shuoshuo = await get(facts.shuoshuo_url);
  check('说说文章能打开', shuoshuo.status === 200, `status=${shuoshuo.status}`);
  check('说说文章不输出关联', !shuoshuo.body.includes('yuki-related'));
} else {
  note('站点没有配置说说承载分类，跳过说说那一组');
}

report();
