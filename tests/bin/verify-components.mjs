// 工单 01 的验收：文章内档案组件。
//
// 三层：
//   1. 静态：pattern 文件、分类注册、前后台样式接入、CSS 选择器、无新增 JS；
//   2. PHP/HTTP：pattern 注册表、分类、编辑器样式，拼出的页面真的渲染；
//   3. 无头 Edge：浅色/深色、1440/640、双栏堆叠、表格溢出、图片加载。
//
// 用法: node tests/bin/verify-components.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, WP_ROOT, get, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { withBrowser, newPage } from './browser.mjs';

const FIXTURES = path.join(import.meta.dirname, 'components-fixtures.php');
const PATTERN_DIR = path.join(REPO_ROOT, 'patterns');
const PATTERNS = [
	['yuki/archive-note', 'archive-note.php', '.yuki-note'],
	['yuki/archive-spec', 'archive-spec.php', '.yuki-spec-table'],
	['yuki/archive-timeline', 'archive-timeline.php', '.yuki-timeline'],
	['yuki/archive-evidence', 'archive-evidence.php', '.yuki-evidence'],
	['yuki/archive-brief', 'archive-brief.php', '.yuki-brief'],
];
const CSS_PATH = path.join(REPO_ROOT, 'assets/css/components.css');
const INC_PATH = path.join(REPO_ROOT, 'inc/components.php');
const IMAGE_PATH = path.join(REPO_ROOT, 'assets/images/component-evidence.svg');

/* ---------------- 静态 ---------------- */

section('pattern 与加载声明');

const css = fs.readFileSync(CSS_PATH, 'utf8');
const inc = fs.readFileSync(INC_PATH, 'utf8');
const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');

check('组件模块已显式 require', /require_once get_template_directory\(\) \. '\/inc\/components\.php'/.test(functions));
check('注册了 yuki-archive pattern 分类', /register_block_pattern_category\(\s*'yuki-archive'/.test(inc));
check('前台样式依赖 style.css', /wp_enqueue_style\([\s\S]*?'yuki-style'/.test(inc));
check('编辑器也加载 components.css', /add_editor_style\(\s*'assets\/css\/components\.css'\s*\)/.test(inc));
check('没有新增组件 JS', !fs.existsSync(path.join(REPO_ROOT, 'assets/js/components.js')));

for (const [slug, file, selector] of PATTERNS) {
	const filePath = path.join(PATTERN_DIR, file);
	check(`pattern 文件存在：${file}`, fs.existsSync(filePath));
	if (fs.existsSync(filePath)) {
		const source = fs.readFileSync(filePath, 'utf8');
		check(`${slug} 的 Slug 头正确`, new RegExp(`Slug:\\s*${slug.replace('/', '\\/')}`).test(source));
		check(`${slug} 归入 yuki-archive`, /Categories:\s*yuki-archive/.test(source));
		check(`${slug} 没有外部 URL`, !/https?:\/\//.test(source));
	}
	check(`CSS 有 ${selector}`, css.includes(selector));
}

check('占位图是内置 SVG', fs.existsSync(IMAGE_PATH) && fs.readFileSync(IMAGE_PATH, 'utf8').includes('<svg'));
check('CSS 使用 --yuki-comp-red 而不是写死新色', css.includes('--yuki-comp-red'));
check('CSS 有 640px 双栏堆叠', /@media \(max-width: 640px\)[\s\S]*?\.yuki-brief \.wp-block-column/.test(css));

/* ---------------- 造数与 HTTP ---------------- */

section('WordPress 注册表与前台页面');

const fixture = php([FIXTURES, WP_ROOT]);
if (fixture.status !== 0) {
	console.error(`造数失败（退出码 ${fixture.status}）：\n${fixture.stderr || fixture.stdout}`);
	process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixture.stdout)[1]);
const registered = Object.keys(facts.patterns || {});

for (const [slug] of PATTERNS) {
	check(`已注册 ${slug}`, registered.includes(slug));
}
check('pattern 分类在注册表里', (facts.pattern_categories || []).includes('yuki-archive'),
	(facts.pattern_categories || []).join(', '));
check('编辑器样式包含 components.css',
	(facts.editor_stylesheets || []).some((url) => /assets\/css\/components\.css/.test(url)),
	(facts.editor_stylesheets || []).join(', '));

const page = await get(facts.url);
check('fixture 页面返回 200', page.status === 200, String(page.status));
check('页面加载组件 CSS', /yuki-components-css/.test(page.body));
check('注记已渲染', /class="[^"]*yuki-note/.test(page.body));
check('规格表已渲染', /class="[^"]*yuki-spec-table/.test(page.body));
check('时间线已渲染', /class="[^"]*yuki-timeline/.test(page.body));
check('证据图卡已渲染', /class="[^"]*yuki-evidence/.test(page.body));
check('双栏简报已渲染', /class="[^"]*yuki-brief/.test(page.body));
check('证据占位图可请求', (await get(page.body.match(/src="([^"]*component-evidence\.svg)"/)?.[1] || `${SITE}/`)).status === 200);

/* ---------------- 真浏览器 ---------------- */

section('浅色 1440');

let browserError = '';
let light = null;
let dark = null;
let narrow = null;

try {
	await withBrowser(async (browser) => {
		const tab = await newPage(browser, { colorScheme: 'light' });
		await tab.setViewport(1440, 1000);
		await tab.goto(facts.url);
		await tab.waitFor("document.querySelector('.yuki-evidence img')?.complete", 15000);
		light = await tab.evaluate(`(() => {
			const q = (s) => document.querySelector(s);
			const box = (s) => { const el = q(s); return el ? el.getBoundingClientRect() : null; };
			const note = q('.yuki-note');
			const noteStyle = getComputedStyle(note);
			const labelStyle = getComputedStyle(q('.yuki-note-label'));
			const table = q('.yuki-spec-table');
			const timelineItems = [...document.querySelectorAll('.yuki-timeline-item')];
			const item = timelineItems[0];
			const before = item ? getComputedStyle(item, '::before') : null;
			const image = q('.yuki-evidence img');
			const first = box('.yuki-brief .wp-block-column:first-child');
			const second = box('.yuki-brief .wp-block-column:last-child');
			return {
				noteBg: noteStyle.backgroundColor,
				noteBorder: noteStyle.borderLeftWidth,
				noteBorderColor: noteStyle.borderLeftColor,
				noteLabel: labelStyle.color,
				noteWidth: note ? note.getBoundingClientRect().width : null,
				tableOverflow: table ? getComputedStyle(table).overflowX : null,
				tableWidth: table ? table.getBoundingClientRect().width : null,
				timelineCount: timelineItems.length,
				timelineMark: before ? before.width : null,
				imageLoaded: !!(image && image.complete && image.naturalWidth > 0),
				briefFirst: first ? { left: first.left, right: first.right } : null,
				briefSecond: second ? { left: second.left, right: second.right } : null,
			};
		})()`);

		await tab.setViewport(640, 1000);
		await new Promise((resolve) => setTimeout(resolve, 200));
		narrow = await tab.evaluate(`(() => {
			const q = (s) => document.querySelector(s);
			const box = (s) => { const el = q(s); return el ? el.getBoundingClientRect() : null; };
			const first = box('.yuki-brief .wp-block-column:first-child');
			const second = box('.yuki-brief .wp-block-column:last-child');
			return {
				scrollWidth: document.documentElement.scrollWidth,
				clientWidth: document.documentElement.clientWidth,
				flexDirection: getComputedStyle(q('.yuki-brief')).flexDirection,
				first: first ? { top: first.top, bottom: first.bottom } : null,
				second: second ? { top: second.top } : null,
				tableOverflow: getComputedStyle(q('.yuki-spec-table')).overflowX,
			};
		})()`);
		await tab.close();

		const darkTab = await newPage(browser, { colorScheme: 'dark' });
		await darkTab.setViewport(1440, 1000);
		await darkTab.goto(facts.url);
		await darkTab.waitFor("document.querySelector('.yuki-evidence img')?.complete", 15000);
		dark = await darkTab.evaluate(`(() => {
			const note = document.querySelector('.yuki-note');
			const label = document.querySelector('.yuki-note-label');
			return {
				noteBg: getComputedStyle(note).backgroundColor,
				noteColor: getComputedStyle(note).color,
				labelColor: getComputedStyle(label).color,
				bodyBg: getComputedStyle(document.body).backgroundColor,
			};
		})()`);
		await darkTab.close();
	});
} catch (error) {
	browserError = error.message;
} finally {
	php([FIXTURES, WP_ROOT, '--cleanup']);
}

check('无头浏览器跑到底', !browserError, browserError);
if (light) {
	check('注记有可见底色', light.noteBg !== 'rgba(0, 0, 0, 0)', light.noteBg);
	check('注记左边线为 3px', light.noteBorder === '3px', light.noteBorder);
	check('注记标签是红墨色', /rgb\(169, 74, 37\)/.test(light.noteLabel), light.noteLabel);
	check('注记不超出正文列', light.noteWidth !== null && light.noteWidth <= 760, String(light.noteWidth));
	check('规格表可横向滚动', light.tableOverflow === 'auto', light.tableOverflow);
	check('时间线有三个节点', light.timelineCount === 3, String(light.timelineCount));
	check('时间线节点有方块', light.timelineMark === '9px', light.timelineMark);
	check('证据图已加载', light.imageLoaded);
	check('双栏并排', !!light.briefFirst && !!light.briefSecond && light.briefSecond.left >= light.briefFirst.right - 1,
		JSON.stringify(light.briefSecond));
}

if (narrow) {
	check('640px 无横向溢出', narrow.scrollWidth <= narrow.clientWidth + 1,
		`${narrow.scrollWidth} / ${narrow.clientWidth}`);
	check('640px 双栏堆叠', !!narrow.first && !!narrow.second && narrow.second.top >= narrow.first.bottom - 1,
		JSON.stringify(narrow.second));
	check('640px 表格仍可滚动', narrow.tableOverflow === 'auto', narrow.tableOverflow);
}

if (dark) {
	check('深色下注记有表面', dark.noteBg !== 'rgba(0, 0, 0, 0)', dark.noteBg);
	check('深色下标签换成浅红', /rgb\(228, 119, 106\)/.test(dark.labelColor), dark.labelColor);
	check('深色下正文可读', dark.noteColor !== dark.bodyBg, `${dark.noteColor} / ${dark.bodyBg}`);
}

report();
