// 工单 01：只观察打包命令的退出码与 ZIP 产物，不依赖 WordPress 或 WP-CLI。
// 用法：node tests/bin/verify-package.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { crc32, inflateRawSync } from 'node:zlib';
import { check, report, section } from './report.mjs';

const repo = path.resolve(import.meta.dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yuki-package-'));

// 按 ZIP 的中央目录读取产物；写包交给 Git，验收不复用生产脚本的排除逻辑。
function readZip(file) {
  const zip = fs.readFileSync(file);
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65557) && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < Math.max(0, zip.length - 65557)) throw new Error('找不到 ZIP 中央目录');
  const entries = new Map();
  const count = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('无效的 ZIP 目录项');
    const method = zip.readUInt16LE(cursor + 10);
    const size = zip.readUInt32LE(cursor + 20);
    const nameSize = zip.readUInt16LE(cursor + 28);
    const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameSize);
    const local = zip.readUInt32LE(cursor + 42);
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error('无效的 ZIP 文件头');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const compressed = zip.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`不支持的 ZIP 压缩方式：${method}`);
    const content = method === 0 ? compressed : inflateRawSync(compressed);
    if (content.length !== zip.readUInt32LE(cursor + 24) || crc32(content) !== zip.readUInt32LE(cursor + 16)) {
      throw new Error(`ZIP 内容校验失败：${name}`);
    }
    if (entries.has(name)) throw new Error(`ZIP 路径重复：${name}`);
    entries.set(name, content);
    cursor += 46 + nameSize + zip.readUInt16LE(cursor + 30) + zip.readUInt16LE(cursor + 32);
  }
  return entries;
}

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout;
}

function commit(cwd) {
  git(cwd, '-c', 'core.autocrlf=false', 'add', '--', '.');
  git(cwd, '-c', 'user.name=Yuki package test', '-c', 'user.email=package@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'package fixture');
}

try {
  const output = path.join(temp, 'yuki.zip');
  const result = spawnSync(process.execPath, [path.join(repo, 'tests/bin/package-theme.mjs'), output], {
    encoding: 'utf8',
  });
  section('可安装的包');
  check('一条 Node 命令成功出包', result.status === 0, result.stderr.trim());
  check('命令产出 ZIP 文件', fs.existsSync(output));
  if (fs.existsSync(output)) {
    const entries = readZip(output);
    const names = [...entries.keys()];
    check('顶层只有 yuki/ 一个目录', names.length > 0 && names.every((name) => name.startsWith('yuki/')));
    check('ZIP 路径没有反斜杠或越级路径', names.every((name) => !name.includes('\\') && !name.split('/').includes('..')));
    for (const file of ['style.css', 'index.php', 'comments.php', 'LICENSE', 'README.md',
      'screenshot.png', 'inc/comment-likes.php', 'assets/js/comment-likes.js', 'languages/yuki.pot']) {
      check(`包里有 ${file}`, entries.has(`yuki/${file}`));
    }
    for (const file of ['tests', 'docs', '.scratch', '.git', '.gitignore', '.distignore', '.editorconfig',
      'AGENTS.md', 'CONTEXT.md', 'DESIGN.md']) {
      check(`包里没有 ${file}`, !names.some((name) => name === `yuki/${file}` || name.startsWith(`yuki/${file}/`)));
    }
    check('样式表仍声明主题名 Yuki', /Theme Name: Yuki\r?\n/.test(entries.get('yuki/style.css')?.toString() || ''));
    check('包内文件均可解压且 CRC 正确', entries.size > 0, `${entries.size} 个目录或文件`);

    // 工单 04：官方列的头部字段逐项看**包里那一份**。工作区里少一个字段看不出后果，
    // 使用者装上以后才看得出来；所以这里读的是产物，不是工作区（换行按提交中的字节来）。
    section('包里 style.css 的头部');
    const css = (entries.get('yuki/style.css')?.toString() || '').replace(/\r\n/g, '\n');
    const header = /\/\*([\s\S]*?)\*\//.exec(css)?.[1] ?? '';
    const field = (name) => new RegExp(`^${name}:\\s*(.*)$`, 'm').exec(header)?.[1]?.trim() ?? '';
    for (const name of ['Theme Name', 'Author', 'Description', 'Version', 'Requires at least',
      'Tested up to', 'Requires PHP', 'License', 'License URI', 'Text Domain']) {
      check(`头部有 ${name}`, field(name) !== '', `读到「${field(name)}」`);
    }
    check('Tested up to 只写数字，不写成 WP 7.1', /^\d+(\.\d+)*$/.test(field('Tested up to')),
      `读到「${field('Tested up to')}」`);
  }

  section('不支持的排除语法');
  const fixture = path.join(temp, 'fixture');
  fs.mkdirSync(path.join(fixture, 'tests/bin'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'tests/bin/package-theme.mjs'), path.join(fixture, 'tests/bin/package-theme.mjs'));
  fs.writeFileSync(path.join(fixture, '.distignore'), 'tests/\n.distignore\n*.map\n');
  fs.writeFileSync(path.join(fixture, 'index.php'), '<?php // fixture\n');
  git(fixture, 'init', '--quiet');
  git(fixture, 'config', 'core.autocrlf', 'true');
  commit(fixture);
  const invalid = spawnSync(process.execPath, [path.join(fixture, 'tests/bin/package-theme.mjs'), path.join(temp, 'invalid.zip')], {
    encoding: 'utf8',
  });
  check('通配语法不能静默忽略', invalid.status !== 0, invalid.stderr.trim());
  check('语法错误时不产出 ZIP', !fs.existsSync(path.join(temp, 'invalid.zip')));
  check('错误指出清单文件与行号', invalid.stderr.includes('.distignore:3'));
  for (const syntax of ['!private.txt', 'file?.txt', '[ab].txt', 'docs\\private.txt', '../private.txt', '/private.txt']) {
    fs.writeFileSync(path.join(fixture, '.distignore'), `tests/\n.distignore\n${syntax}\n`);
    commit(fixture);
    const rejected = spawnSync(process.execPath, [path.join(fixture, 'tests/bin/package-theme.mjs'), path.join(temp, 'invalid.zip')], {
      encoding: 'utf8',
    });
    check(`拒绝不支持的路径 ${syntax}`, rejected.status !== 0 && rejected.stderr.includes('.distignore:3'));
  }
  fs.writeFileSync(path.join(fixture, '.distignore'), '\n# leading blank\ntests/\n.distignore\n!private.txt\n');
  commit(fixture);
  const lineNumber = spawnSync(process.execPath, [path.join(fixture, 'tests/bin/package-theme.mjs'), path.join(temp, 'invalid.zip')], {
    encoding: 'utf8',
  });
  check('清单开头有空行时仍报告正确行号', lineNumber.status !== 0 && lineNumber.stderr.includes('.distignore:5'), lineNumber.stderr.trim());

  section('排除清单与提交快照');
  // 故意使用主题清单里没有的路径，抓住硬编码排除清单；中文/空格验证 ZIP 文件名。
  fs.mkdirSync(path.join(fixture, 'private'), { recursive: true });
  fs.mkdirSync(path.join(fixture, '目录'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'private/secret.txt'), 'not for release');
  fs.writeFileSync(path.join(fixture, 'private.txt'), 'not for release either');
  fs.writeFileSync(path.join(fixture, '目录/雪 空格.txt'), 'Yuki 雪\n');
  fs.writeFileSync(path.join(fixture, 'metadata.txt'), 'snapshot $Format:%H$\n');
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  fs.writeFileSync(path.join(fixture, 'screenshot.png'), png);
  fs.writeFileSync(path.join(fixture, '.distignore'), '# one list\r\n\r\ntests/\r\n.distignore\r\nprivate/\r\nprivate.txt\r\n');
  commit(fixture);
  // Git 的本地/外部 attributes 也不能成为第二份排除清单或改写正文。
  fs.writeFileSync(path.join(fixture, '.git/info/attributes'), 'index.php export-ignore\nmetadata.txt export-subst\n');
  const attributes = path.join(fixture, '.git/external-attributes');
  fs.writeFileSync(attributes, 'screenshot.png export-ignore\n');
  git(fixture, 'config', 'core.attributesFile', attributes);
  fs.writeFileSync(path.join(fixture, 'index.php'), '<?php // uncommitted edit\n');
  fs.writeFileSync(path.join(fixture, 'untracked.txt'), 'another session');
  // 这份无效清单未提交，不能与 HEAD 的主题文件混用。
  fs.writeFileSync(path.join(fixture, '.distignore'), '*.php\n');
  const fixtureScript = path.join(fixture, 'tests/bin/package-theme.mjs');
  const snapshot = spawnSync(process.execPath, [fixtureScript], { cwd: os.tmpdir(), encoding: 'utf8' });
  const defaultOutput = path.join(fixture, '.scratch/release-prep/yuki.zip');
  check('从其他目录运行仍能按默认路径出包', snapshot.status === 0 && fs.existsSync(defaultOutput), snapshot.stderr.trim());
  if (fs.existsSync(defaultOutput)) {
    const entries = readZip(defaultOutput);
    check('新加的目录排除规则生效', !entries.has('yuki/private/secret.txt'));
    check('新加的文件排除规则生效', !entries.has('yuki/private.txt'));
    check('保留中文与空格文件名及正文', entries.get('yuki/目录/雪 空格.txt')?.toString() === 'Yuki 雪\n');
    check('二进制截图原样入包', entries.get('yuki/screenshot.png')?.equals(png));
    check('未提交修改不会混进主题包', entries.get('yuki/index.php')?.toString() === '<?php // fixture\n');
    check('Git attributes 不会改写已提交正文', entries.get('yuki/metadata.txt')?.toString() === 'snapshot $Format:%H$\n');
    check('未跟踪文件不会混进主题包', !entries.has('yuki/untracked.txt'));
    check('包里的文件集合与清单预期相符', [...entries.keys()].filter((name) => !name.endsWith('/')).sort().join('\n') ===
      ['yuki/index.php', 'yuki/metadata.txt', 'yuki/screenshot.png', 'yuki/目录/雪 空格.txt'].sort().join('\n'));
  }

  const preserved = path.join(temp, 'preserved.zip');
  fs.writeFileSync(preserved, 'previous good package');
  commit(fixture);
  const failed = spawnSync(process.execPath, [fixtureScript, preserved], { encoding: 'utf8' });
  check('报错不会毁掉已有包', failed.status !== 0 && fs.readFileSync(preserved, 'utf8') === 'previous good package');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
report();
