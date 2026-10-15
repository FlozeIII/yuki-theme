#!/usr/bin/env node
// 把测试基建装进本地 WordPress。可反复执行。
//
//   node tests/bin/harness.mjs install [<wordpress目录>]
//
// 装两样东西，都在 WordPress 里、都在主题之外：
//   wp-content/mu-plugins/yuki-dev-*.php   捕获邮件；把一言上游转投到本地 stub
//   <wordpress目录的同级>/var/              捕获文件与 stub 的状态目录
//
// 用**复制**而不是符号链接/目录联接：联接会把「删掉 WordPress 里的那个目录」悄悄
// 变成「删掉仓库里的源文件」，这个陷阱不值得省一次复制。每轮验收都会先跑一遍 install，
// 所以改完 mu-plugin 不会留下旧副本。

import fs from 'node:fs';
import path from 'node:path';
import { TESTS_DIR } from './lib.mjs';

const [command = '', wpArg] = process.argv.slice(2);
const wpRoot = path.resolve(wpArg || process.env.YUKI_WP_ROOT || 'C:/Users/Floze/wp-dev/wordpress');

if (command !== 'install') {
  console.error('用法: node tests/bin/harness.mjs install [<wordpress目录>]');
  process.exit(2);
}

if (!fs.existsSync(path.join(wpRoot, 'wp-load.php'))) {
  console.error(`不是 WordPress 目录（找不到 wp-load.php）：${wpRoot}`);
  process.exit(2);
}

const varDir = process.env.YUKI_DEV_VAR || path.join(path.dirname(wpRoot), 'var');
const upstreamDir = path.join(varDir, 'upstream');

/* ---- mu-plugin ---- */

const sourceDir = path.join(TESTS_DIR, 'wp', 'mu-plugins');
const targetDir = path.join(wpRoot, 'wp-content', 'mu-plugins');
// 记着上一版装过哪些文件。只清**自己装过**的，不去动这个目录里别人的东西——
// 同一份本地环境可能同时开着别的会话，按前缀大扫除会误删它们的文件。
// 点开头的文件不会被 WordPress 当成 mu-plugin 加载。
const manifest = path.join(targetDir, '.yuki-dev-installed');

fs.mkdirSync(targetDir, { recursive: true });

const sources = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.php'));

let previous = [];
try {
  previous = fs.readFileSync(manifest, 'utf8').split('\n').filter(Boolean);
} catch {
  previous = [];
}

// 上一版装过、这一版已经没有了的：清掉，免得已经不存在的文件继续生效
let removed = 0;
for (const stale of previous) {
  if (!sources.includes(stale) && fs.existsSync(path.join(targetDir, stale))) {
    fs.rmSync(path.join(targetDir, stale));
    removed++;
  }
}

// 先写临时文件再 rename：本地环境可能正被另一个会话的请求打着，
// 原地覆盖会让某个请求读到写了一半的 PHP 文件，直接致命错误。
// rename 在同一卷上是原子的，读到的要么是旧的、要么是新的，不会是半截。
for (const file of sources) {
  const target = path.join(targetDir, file);
  const staging = `${target}.tmp-${process.pid}`;
  fs.copyFileSync(path.join(sourceDir, file), staging);
  fs.renameSync(staging, target);
}

fs.writeFileSync(manifest, `${sources.join('\n')}\n`);

/* ---- 捕获文件与 stub 状态目录 ---- */

fs.mkdirSync(upstreamDir, { recursive: true });

const seeds = [
  [path.join(varDir, 'mail.log'), ''],
  [path.join(upstreamDir, 'hits.log'), ''],
  [path.join(upstreamDir, 'mode'), 'ok\n'],
  [path.join(upstreamDir, 'body.txt'), '<p>stub 的默认正文</p>'],
];
const created = [];
for (const [file, content] of seeds) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, content);
    created.push(path.basename(file));
  }
}

console.log(`mu-plugin   ${sources.length} 个 -> ${targetDir}`);
if (removed) console.log(`            清掉 ${removed} 个已废弃的`);
console.log(`状态目录    ${varDir}${created.length ? `（新建 ${created.join(', ')}）` : ''}`);
console.log(`捕获文件    ${path.join(varDir, 'mail.log')}`);
