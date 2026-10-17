#!/usr/bin/env node
// 从已提交快照打包，避免共享工作树里别的会话的改动进入发布物。
// 用法：node tests/bin/package-theme.mjs [--rev <sha|tag>] [输出.zip]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repo = path.resolve(import.meta.dirname, '../..');

function gitResult(...args) {
  return spawnSync('git', ['-c', 'core.autocrlf=false', ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GIT_ATTR_NOSYSTEM: '1' },
  });
}

function git(...args) {
  const result = gitResult(...args);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git 退出码 ${result.status}`);
  return result.stdout;
}

let staging;
let archiveRepo;
try {
  const usage = '用法：node tests/bin/package-theme.mjs [--rev <sha|tag>] [输出.zip]';
  let outputArg;
  let requestedRev = 'HEAD';
  let revGiven = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--rev') {
      if (revGiven) throw new Error(`--rev 只能给一次。${usage}`);
      const value = args[++index];
      if (value === undefined || value === '' || value.startsWith('-')) {
        throw new Error(`--rev 后面要跟一个提交号或标签。${usage}`);
      }
      requestedRev = value;
      revGiven = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`不认识的选项：${arg}。${usage}`);
    } else if (outputArg !== undefined) {
      throw new Error(`只能给一个输出文件。${usage}`);
    } else {
      outputArg = arg;
    }
  }
  const output = path.resolve(outputArg || path.join(repo, '.scratch/release-prep/yuki.zip'));
  if (path.extname(output).toLowerCase() !== '.zip') throw new Error('输出文件必须以 .zip 结尾');

  // 标签与提交号都先解析成提交，再看后续读清单、出包只认这一个提交。
  // 解析失败必须停下：退回 HEAD 会让「从标签出包」悄悄变成「从 HEAD 出包」。
  const resolved = gitResult('rev-parse', '--verify', '--end-of-options', `${requestedRev}^{commit}`);
  if (resolved.error) throw resolved.error;
  if (resolved.status !== 0 || !resolved.stdout.trim()) {
    throw new Error(`找不到提交或标签：${requestedRev}`);
  }
  const revision = resolved.stdout.trim();
  const exclusions = git('show', `${revision}:.distignore`)
    .split(/\r?\n/)
    .flatMap((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return [];
      const name = line.replace(/\/$/, '');
      // 只实现当前清单需要的根目录相对字面路径，不猜测 gitignore 的通配与取反含义。
      if (['!', '*', '?', '[', ']', '\\', ':'].some((char) => line.includes(char)) ||
          name.split('/').some((part) => !part || part === '.' || part === '..')) {
        throw new Error(`.distignore:${index + 1} 不支持的排除语法：${line}（只支持相对字面路径，目录可带末尾 /）`);
      }
      return [`:(top,exclude,literal)${name}`];
    });

  // archive 会读 .git/info/attributes 和全局 attributes，甚至改写提交中的字节。
  // 用只借用原仓库对象的临时裸仓库隔离本地规则，并覆盖快照里的导出/文本转换属性。
  archiveRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'yuki-archive-'));
  git('init', '--bare', '--quiet', '--template=', archiveRepo);
  const objects = git('rev-parse', '--path-format=absolute', '--git-path', 'objects').trim();
  fs.mkdirSync(path.join(archiveRepo, 'objects/info'), { recursive: true });
  fs.writeFileSync(path.join(archiveRepo, 'objects/info/alternates'), `${objects.replaceAll('\\', '/')}\n`);
  fs.mkdirSync(path.join(archiveRepo, 'info'), { recursive: true });
  fs.writeFileSync(path.join(archiveRepo, 'info/attributes'),
    '* -export-ignore -export-subst -text -ident -filter !eol !working-tree-encoding\n');

  fs.mkdirSync(path.dirname(output), { recursive: true });
  staging = `${output}.tmp-${randomUUID()}`;
  git(`--git-dir=${archiveRepo}`, '-c', `core.attributesFile=${path.join(archiveRepo, 'no-attributes')}`,
    'archive', '--format=zip', '--prefix=yuki/', `--output=${staging}`, revision, '--', '.', ...exclusions);
  fs.renameSync(staging, output);
  console.log(`主题包：${output}\n提交：${revision}${revGiven ? `\n来源：${requestedRev}` : ''}`);
} catch (error) {
  console.error(`打包失败：${error.message}`);
  process.exitCode = 1;
} finally {
  if (staging && fs.existsSync(staging)) fs.unlinkSync(staging);
  if (archiveRepo) fs.rmSync(archiveRepo, { recursive: true, force: true });
}
