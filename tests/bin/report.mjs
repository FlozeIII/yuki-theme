// 验收脚本共用的报告脚手架：check 记一条、section 起一段、report 收敛输出并用退出码表示成败。
//
// 为什么单独一个文件，而不是并进 lib.mjs：lib.mjs 装的是环境管线（HTTP、邮件捕获、上游 stub、
// 表单提交），报告是另一类东西。两个工单各养一份之后第三个眼看就来，形状也不用猜了。
//
// 用法：
//   import { check, section, note, report } from './report.mjs';
//
//   section('表单里那两样');
//   check('有一个访客看不见的输入框', form.traps.length === 1, `找到 ${form.traps.length} 个`);
//
//   note(`捕获文件 ${MAIL_LOG}`);      // 统计之后原样打印的附注
//   report();                          // 全绿退出 0，有红退出 1
//
// 一次进程只该写一份报告：断言记在模块级的数组里，report() 之后进程就退了。

const out = [];
const notes = [];

/**
 * 记一条断言。
 *
 * @param {string} name   这条在验什么，用行为说话，别用函数名。
 * @param {*}      ok     是否成立。非布尔值按真假收敛。
 * @param {string} detail 失败时最有用的那点信息；通过了也跟着打印，方便眼看。
 */
export function check(name, ok, detail = '') {
  out.push({ name, ok: !!ok, detail: String(detail) });
}

/** 起一段标题。 */
export function section(title) {
  out.push({ section: String(title) });
}

/** 统计之后原样打印的一行附注（路径、计数这类）。 */
export function note(line) {
  notes.push(String(line));
}

/** 打印报告。有红就退出 1。 */
export function report() {
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));

  let failed = 0;
  let total = 0;

  for (const r of out) {
    if (r.section) {
      console.log(`\n== ${r.section} ==`);
      continue;
    }
    total++;
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${pad(r.name, 34)}${r.detail ? ` <- ${r.detail}` : ''}`);
  }

  console.log(`\n${total - failed}/${total} 通过`);
  for (const line of notes) {
    console.log(line);
  }

  process.exit(failed ? 1 : 0);
}
