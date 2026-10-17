// 工单 01 的验收：前台发说说。
//
// 走 HTTP + 真实登录 cookie：匿名、管理员、订阅者三种身份；空正文、坏 nonce、
// 成功发布、失败保留草稿。表单是普通的 admin-post.php POST，不需要新观察点。
//
// 用法: node tests/bin/verify-shuoshuo-composer.mjs
// 前置：本地站已在跑。

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, WP_ROOT, get, postForm, php } from './lib.mjs';
import { check, section, note, report } from './report.mjs';
import { themeCss, tokens, usedTokens } from './theme-css.mjs';

const FIXTURES = path.join(import.meta.dirname, 'shuoshuo-composer-fixtures.php');
const RUN = Date.now();

function cookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function fieldValue(body, name) {
  const re = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i');
  return re.exec(body)?.[1] ?? '';
}

function stats(marker) {
  const out = php([FIXTURES, WP_ROOT, '--stats', marker]);
  const json = /YUKI-STATS: (\[.*\])/.exec(out.stdout)?.[1];
  return json ? JSON.parse(json) : [];
}

/* ---------------- 静态 ---------------- */

section('文件、表单与样式');

check('处理器存在', fs.existsSync(path.join(REPO_ROOT, 'inc', 'shuoshuo-composer.php')));
check('表单片段存在', fs.existsSync(path.join(REPO_ROOT, 'template-parts', 'shuoshuo-composer.php')));

const archive = fs.readFileSync(path.join(REPO_ROOT, 'archive.php'), 'utf8');
check('说说归档调用写作框',
  /get_template_part\(\s*'template-parts\/shuoshuo-composer'\s*\)/.test(archive));

const functions = fs.readFileSync(path.join(REPO_ROOT, 'functions.php'), 'utf8');
check('functions.php 显式 require 处理器',
  /require_once\s+get_template_directory\(\)\s*\.\s*['"]\/inc\/shuoshuo-composer\.php['"]/.test(functions));

const template = fs.readFileSync(path.join(REPO_ROOT, 'template-parts', 'shuoshuo-composer.php'), 'utf8');
check('表单带 nonce', /wp_nonce_field\(\s*'yuki_shuoshuo_publish'/.test(template));
check('表单提交到 admin-post.php', /admin-post\.php/.test(template));

const css = themeCss();
const root = tokens(css);
const dark = tokens(css, '.dark');
const composerBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].includes('.yuki-shuoshuo-composer'))
  .map((m) => m[2])
  .join('\n');

check('写作框样式存在', composerBlocks.length > 0);
check('写作框样式没有硬编码颜色',
  !/#[0-9a-f]{3,8}\b/i.test(composerBlocks) && !/rgba?\(\s*\d/.test(composerBlocks));
const missing = usedTokens(composerBlocks).filter((name) => !(name in root) && !(name in dark));
check('写作框样式引用的 token 都已定义', missing.length === 0, missing.join(', '));

/* ---------------- 造数 ---------------- */

const fixtures = php([FIXTURES, WP_ROOT]);
if (fixtures.status !== 0) {
  console.error(`造数失败（退出码 ${fixtures.status}）：\n${fixtures.stderr || fixtures.stdout}`);
  process.exit(1);
}

const facts = JSON.parse(/YUKI-JSON: (\{.*\})/.exec(fixtures.stdout)[1]);
const adminCookie = cookieHeader(facts.admin_cookies);
const subCookie = cookieHeader(facts.sub_cookies);
const nonceField = 'yuki_shuoshuo_nonce';
const action = 'yuki_shuoshuo_publish';

section('身份与表单');

try {
  if (!facts.shuoshuo_url) {
    note('站点没有配置说说承载分类，跳过 HTTP 那一组');
    check('说说分类已配置', false, 'yuki_shuoshuo_category = 0');
  } else {
    const anon = await get(facts.shuoshuo_url);
    check('匿名能打开说说归档', anon.status === 200, `status=${anon.status}`);
    check('匿名看不到写作框', !anon.body.includes('yuki-shuoshuo-composer'));

    const adminPage = await get(facts.shuoshuo_url, { cookie: adminCookie });
    check('管理员能看到写作框', adminPage.body.includes('class="yuki-shuoshuo-composer"'));
    check('写作框有 nonce', fieldValue(adminPage.body, nonceField).length > 0);
    check('写作框有正文域与发布按钮',
      adminPage.body.includes('name="content"') && adminPage.body.includes('class="yuki-btn"'));

    const subPage = await get(facts.shuoshuo_url, { cookie: subCookie });
    check('订阅者看不到写作框', !subPage.body.includes('yuki-shuoshuo-composer'));

    const nonce = fieldValue(adminPage.body, nonceField);

    /* 空正文 */
    const emptyMarker = `YUKI-COMPOSER-EMPTY-${RUN}`;
    const empty = await postForm(facts.post_url, {
      action,
      [nonceField]: nonce,
      content: '',
    }, { cookie: adminCookie });
    check('空正文被拒并带错误码',
      empty.status === 302 && empty.location.includes('yuki_shuoshuo_error=empty'),
      `${empty.status} ${empty.location}`);
    check('空正文没有产生说说', stats('YUKI-COMPOSER-').length === 0);

    /* 坏 nonce：拒绝，但正文保留 */
    const draftMarker = `YUKI-COMPOSER-DRAFT-${RUN}`;
    const badNonce = await postForm(facts.post_url, {
      action,
      [nonceField]: 'not-a-real-nonce',
      content: draftMarker,
    }, { cookie: adminCookie });
    check('坏 nonce 被拒并带错误码',
      badNonce.status === 302 && badNonce.location.includes('yuki_shuoshuo_error=nonce'),
      `${badNonce.status} ${badNonce.location}`);
    check('坏 nonce 没有产生说说', stats(draftMarker).length === 0);

    const draftPage = await get(badNonce.location, { cookie: adminCookie });
    check('失败后正文还在表单里', draftPage.body.includes(draftMarker));
    check('失败时显示可照做的错误', draftPage.body.includes('页面过期了，刷新后再试。'));

    /* 正常发布 */
    const successMarker = `YUKI-COMPOSER-OK-${RUN}`;
    const freshNonce = fieldValue(draftPage.body, nonceField);
    const ok = await postForm(facts.post_url, {
      action,
      [nonceField]: freshNonce,
      content: successMarker,
    }, { cookie: adminCookie });
    check('正常发布重定向回归档',
      ok.status === 302 && ok.location.includes('yuki_shuoshuo_posted=1'),
      `${ok.status} ${ok.location}`);

    const created = stats(successMarker);
    check('正好产生一条说说', created.length === 1, `找到 ${created.length} 条`);
    if (created.length === 1) {
      check('状态是已发布', created[0].status === 'publish', created[0].status);
      check('作者是当前管理员', created[0].author === facts.admin_id, `${created[0].author}`);
      check('落在说说分类里', created[0].cats.includes(facts.shuoshuo_cat), JSON.stringify(created[0].cats));
    }

    const after = await get(ok.location, { cookie: adminCookie });
    check('新说说出现在归档里', after.body.includes(successMarker));
    check('归档显示发布成功提示', after.body.includes('说说已发布。'));

    /* 订阅者直接 POST */
    const subMarker = `YUKI-COMPOSER-SUB-${RUN}`;
    const subPost = await postForm(facts.post_url, {
      action,
      [nonceField]: freshNonce,
      content: subMarker,
    }, { cookie: subCookie });
    check('订阅者提交被拒', subPost.location.includes('yuki_shuoshuo_error=capability'),
      `${subPost.status} ${subPost.location}`);
    check('订阅者没有产生说说', stats(subMarker).length === 0);

    /* 匿名直接 POST */
    const anonMarker = `YUKI-COMPOSER-ANON-${RUN}`;
    await postForm(facts.post_url, {
      action,
      [nonceField]: freshNonce,
      content: anonMarker,
    });
    check('匿名直接 POST 没有产生说说', stats(anonMarker).length === 0);
  }
} finally {
  php([FIXTURES, WP_ROOT, '--cleanup', facts.admin_token, facts.sub_token]);
}

report();
