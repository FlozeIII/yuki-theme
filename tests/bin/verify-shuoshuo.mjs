// 工单 04 的验收：说说的承载体配置与主列表排除。
//
// seam 和别处一样只有 HTTP：请求进去、HTML 出来。承载体是哪几个分类、配置存在哪里、
// 排除是怎么实现的，一律不看——只看页面上到底有没有那些文章。
//
// 这个工单验的核心是一条**行为性的**性质：配置跟着分类走，不跟着它的名字或 slug 走。
// 所以测试里会真的给分类改名换 slug，再看排除还灵不灵——存 slug 的实现会在这里露馅。
//
// 用法: node tests/bin/verify-shuoshuo.mjs

import { SITE, get, probeScript } from './lib.mjs';
import { check, note, report, section } from './report.mjs';

const FX = 'shuoshuo-fixtures.php';
const fx = (...args) => probeScript(FX, ...args);

/** 探针失败也记成一次断言失败，而不是让整轮验收崩掉。 */
const tryFx = (...args) => {
  try {
    return fx(...args);
  } catch (err) {
    return { error: err.message };
  }
};

/** 这些标题在页面里出现了几个。用标题判断「文章在不在列表上」。 */
const appear = (html, titles) => titles.filter((t) => html.includes(t));

/**
 * 一条「某个页面上出现了几条这样的标题」的断言。
 *
 * 计数只算一次、断言与明细共用同一个值。分头各算一遍的话，两处一旦算的不是同一份输入
 * （比如明细里手滑写了另一个变量），断言红着而明细说「出现 0 条」，人会先怀疑眼睛。
 */
function checkTitles(name, text, titles, predicate, detail) {
  const n = appear(text, titles).length;
  check(name, predicate(n), detail ? detail(n) : `出现 ${n} 条`);
}

/**
 * 取一个地址。地址为空（上一步没拿到，比如分类没解析出来）时返回一个明确的失败壳，
 * 而不是把空串丢给 fetch——那样会抛 Invalid URL，整轮验收以堆栈结束，
 * 前面累积的断言一条都打不出来，看到的现象是「脚本崩了」而不是「哪条不成立」。
 */
const fetchUrl = async (url) => (url ? get(url) : { status: 0, body: '' });

/**
 * 主列表的前两页，合起来看。
 *
 * 断言尽量落在「两页合起来」上而不是只看第一页：12 条说说 + 12 条正式文章，
 * 不排除时它们必然出现在前两页里，所以「前两页里有没有」不受排版与其它会话发帖的
 * 先后影响。只看第一页的话，一旦有更晚的帖子把它们挤到第二页，断言就会因为
 * 排序而不是因为排除而绿——那种假绿我踩过一次（造数顺序发反了）。
 */
async function mainList() {
  const first = await get(`${SITE}/`);
  const second = await get(`${SITE}/?paged=2`);

  return { first, second, text: `${first.body}\n${second.body}` };
}

/* ================= 0. 前提 ================= */

section('前提');

const pre = tryFx('state');
check('站点跑在 yuki 主题上', pre.theme === 'yuki', `实际 ${pre.theme || JSON.stringify(pre)}`);

const setup = tryFx('setup');
check('造数成功', !setup.error && setup.carrier_id > 0, setup.error || JSON.stringify(setup).slice(0, 160));

if (setup.error || !setup.carrier_id) {
  note('造数失败，后面的断言没有意义，就此打住');
  report();
}

const carrierId = setup.carrier_id;
const shuoshuo = setup.shuoshuo;
const normal = setup.normal;

/* ================= 1. 配置存的是分类标识 ================= */

section('配置');

check('配置指向承载体分类', setup.mod === carrierId, `mod=${setup.mod} carrier_id=${carrierId}`);
check('配置里存的是数字标识，不是名字', Number.isInteger(setup.mod) && setup.mod > 0, `mod=${JSON.stringify(setup.mod)}`);

/* ---- 自定义器里真的能选 ---- */

/*
 * 前面那些断言里的配置都是**造数脚本直接写进去的**，所以它们证明不了「自定义器里
 * 能选」。这一节补的就是那一格：把 customize_register 跑一遍，看 setting / control
 * 在不在、下拉里有没有承载体分类。
 *
 * 验的是注册而不是界面渲染——渲染要登录 cookie，而「能不能选」的实质是
 * 选项里有没有那个分类。
 */
const cz = tryFx('customizer');
check('自定义器里注册了承载体设置', cz.has_setting === true, JSON.stringify(cz).slice(0, 160));
check('承载体是一个下拉控件', cz.has_control === true && cz.type === 'select', `control=${cz.has_control} type=${cz.type}`);
check('下拉里有「不使用」这一项', Array.isArray(cz.choices) && cz.choices.includes(0), JSON.stringify(cz.choices));
check(
  '下拉里能选到当前承载体分类',
  Array.isArray(cz.choices) && cz.choices.includes(carrierId),
  `承载体 ${carrierId}，下拉选项 ${JSON.stringify(cz.choices)}`,
);

/* ================= 2. 主列表排除 ================= */

section('主列表');

const list = await mainList();
const firstShuo = appear(list.first.body, shuoshuo).length;
const allShuo = appear(list.text, shuoshuo).length;
const allNormal = appear(list.text, normal).length;

check('首页正常返回', list.first.status === 200, `实际 ${list.first.status}`);
check('第二页正常返回', list.second.status === 200, `实际 ${list.second.status}`);
check('首页不含说说', firstShuo === 0, `首页出现 ${firstShuo} 条`);
check('主列表前两页都不含说说', allShuo === 0, `前两页共出现 ${allShuo} 条`);
check('主列表仍有正式文章', allNormal > 0, `前两页共 ${allNormal} 条`);

const secondNormal = appear(list.second.body, normal).length;
check(
  '第二页是第一页之外的内容',
  list.second.body !== list.first.body && secondNormal > 0,
  `第二页正式文章 ${secondNormal} 条`,
);

/* ---- 置顶的说说 ---- */

/*
 * 单独一段，因为它走的是另一条代码路径：负的 cat 参数挡不住置顶文章——
 * WP_Query 处理置顶时只认 post__not_in，会把没被排除掉的置顶文章重新查一遍
 * 再插到列表最前面。不专门验一下，这条缺口不会在别处露出来。
 */
const stuck = tryFx('stick');
check('已把一篇说说置顶', !stuck.error && stuck.is_stuck === true, stuck.error || JSON.stringify(stuck).slice(0, 120));

if (stuck.is_stuck) {
  const stuckList = await mainList();
  const stuckTitleShown = stuckList.text.includes(stuck.title);
  check(
    '置顶的说说也不出现在主列表',
    !stuckTitleShown,
    `「${stuck.title}」${stuckTitleShown ? '出现在了' : '没有出现在'}主列表`,
  );
  check(
    '置顶之后主列表仍然不含任何说说',
    appear(stuckList.text, shuoshuo).length === 0,
    `前两页共出现 ${appear(stuckList.text, shuoshuo).length} 条`,
  );

  const stuckArchive = await fetchUrl(setup.carrier_url);
  check(
    '置顶的说说在自己的归档里照常列出',
    stuckArchive.status === 200 && stuckArchive.body.includes(stuck.title),
    `状态 ${stuckArchive.status}`,
  );

  const unstuck = tryFx('unstick');
  check('取消置顶', unstuck.is_stuck === false, JSON.stringify(unstuck).slice(0, 120));
}

/* ================= 3. 承载体自己的归档照常列出 ================= */

section('承载体归档');

const carrierArchive = await fetchUrl(setup.carrier_url);
check('承载体归档正常返回', carrierArchive.status === 200, `实际 ${carrierArchive.status}`);
check(
  '承载体归档列得出说说',
  appear(carrierArchive.body, shuoshuo).length > 0,
  `${setup.carrier_url} 上 ${appear(carrierArchive.body, shuoshuo).length} 条`,
);

/* ================= 4. 其他归档不受影响 ================= */

section('其他归档');

const verifyArchive = await fetchUrl(setup.verify_url);
check('别的分类归档正常返回', verifyArchive.status === 200, `实际 ${verifyArchive.status}`);
checkTitles('别的分类归档列得出正式文章', verifyArchive.body, normal, (n) => n > 0);

if (setup.tag_url) {
  const tagArchive = await fetchUrl(setup.tag_url);
  check('标签归档正常返回', tagArchive.status === 200, `实际 ${tagArchive.status}`);
  checkTitles('标签归档列得出文章', tagArchive.body, normal, (n) => n > 0);
} else {
  check('拿得到标签归档地址', false, '造数没有返回 tag_url');
}

const dateArchive = await fetchUrl(setup.date_url);
check('日期归档正常返回', dateArchive.status === 200, `实际 ${dateArchive.status}`);

/* ================= 5. 未配置时一切照旧 ================= */

section('未配置');

const unset = tryFx('set', '--id=0');
check('能取消配置', unset.mod === 0, `mod=${unset.mod}`);

const unsetList = await mainList();
check('未配置时首页不报错', unsetList.first.status === 200, `实际 ${unsetList.first.status}`);
check('未配置时主列表不空白', appear(unsetList.text, normal).length + appear(unsetList.text, shuoshuo).length > 0, `前两页共 ${appear(unsetList.text, normal).length + appear(unsetList.text, shuoshuo).length} 条`);
// 说说是最后发的，不排除时就该重新出现在主列表上——「未配置」确实退回了改动前的行为
check(
  '未配置时说说重新出现在主列表',
  appear(unsetList.text, shuoshuo).length > 0,
  `前两页出现 ${appear(unsetList.text, shuoshuo).length} 条`,
);

const restored = tryFx('set', `--id=${carrierId}`);
check('配置能恢复', restored.mod === carrierId, `mod=${restored.mod}`);

/* ================= 6. 承载体被删之后安静降级 ================= */

section('承载体被删除');

const deleted = tryFx('delete-carrier');
check('分类删除成功', deleted.ok === true, JSON.stringify(deleted).slice(0, 120));

const delList = await mainList();
check('分类被删后首页不报错', delList.first.status === 200, `实际 ${delList.first.status}`);
check('分类被删后主列表不空白', appear(delList.text, normal).length + appear(delList.text, shuoshuo).length > 0, `前两页共 ${appear(delList.text, normal).length + appear(delList.text, shuoshuo).length} 条`);
check(
  '分类被删后退回「未配置」',
  appear(delList.text, shuoshuo).length > 0,
  `前两页出现 ${appear(delList.text, shuoshuo).length} 条（删了承载体就该重新可见）`,
);

/* ================= 7. 主题激活时补建默认分类 ================= */

section('主题激活');

// 上一步已经把分类删了、配置也还指着一个不存在的 id：这正是激活该补建的处境
const armed = tryFx('activate');
check('主题切换已登记', !armed.error && armed.pending === true, armed.error || JSON.stringify(armed).slice(0, 120));

/*
 * after_switch_theme 不是在 switch_theme() 里触发的，而是在**下一次页面加载**时由
 * check_theme_switched() 触发（挂在 init 上）。所以这里必须真发一次请求。
 * 在同一进程里等着是等不到的——我第一版就是这么写的，它永远不触发。
 */
const wake = await get(`${SITE}/`);
check('触发那次请求正常返回', wake.status === 200, `实际 ${wake.status}`);

const activated = tryFx('state');
check('激活后承载体分类存在', activated.carrier_exists === true, JSON.stringify({ id: activated.carrier_id, slug: activated.carrier_slug }).slice(0, 120));
check('激活后默认 slug 是对的', activated.carrier_slug === 'shuoshuo', `实际 ${activated.carrier_slug}`);
check('激活后配置指向新建的分类', activated.mod === activated.carrier_id && activated.carrier_id > 0, `mod=${activated.mod} id=${activated.carrier_id}`);

// 上一步删分类时旧说说被挪去了别处，新建的这个承载体是空的。重新造一批，
// 才能验「这个新建的承载体是不是真的在挡」——不然断言会绿在一个空分类上。
const reSetup = tryFx('setup');
check('激活后重新造数', !reSetup.error && reSetup.mod === activated.carrier_id, reSetup.error || `mod=${reSetup.mod}`);

const actList = await mainList();
check(
  '激活补建的承载体真的在排除',
  actList.first.status === 200 && appear(actList.text, shuoshuo).length === 0,
  `状态 ${actList.first.status}，前两页说说 ${appear(actList.text, shuoshuo).length} 条`,
);
const actArchive = await fetchUrl(reSetup.carrier_url);
check(
  '激活补建的承载体归档列得出说说',
  actArchive.status === 200 && appear(actArchive.body, shuoshuo).length > 0,
  `状态 ${actArchive.status}，${appear(actArchive.body, shuoshuo).length} 条`,
);

/* ================= 8. 改名换 slug 之后配置仍然有效 ================= */

section('改名与换 slug');

/*
 * 这一节**故意排在激活之后**：此刻配置是主题自己写进去的（激活补建分类那一步），
 * 不是造数脚本塞进去的一个 id。
 *
 * 这个顺序是有讲究的。造数脚本永远写 int id，所以「改个名字会不会失效」在那种配置下
 * 不可能失败——断言是空的，怎么改都绿。只有配置由主题自己写入，这一节才真的在问
 * 「你存的是标识，还是名字/slug」。
 */
const activeId = reSetup.carrier_id;

// slug 取每次不同的值：写死一个的话，某一轮在改名中途失败（比如被别的变异打断）
// 会把那个 slug 留在库里，下一轮再改到同一个 slug 就撞「已被别的分类占用」，
// 于是验的东西变成夹具的遗留状态，而不是主题的行为。
const tempSlug = `yuki-suipian-${Date.now()}`;

const renamed = tryFx('rename', '--name=碎片', `--slug=${tempSlug}`);
check('分类改名换 slug 成功', !renamed.error, renamed.error || '');
check('配置原地不动', renamed.mod === activeId, `改名后 mod=${renamed.mod}，原本 ${activeId}`);
check('分类名与 slug 确实变了', renamed.carrier_name === '碎片' && renamed.carrier_slug === tempSlug, `${renamed.carrier_name} / ${renamed.carrier_slug}`);

// 「存分类标识而不是 slug」的判据：存 slug 的实现到这里就失效了，说说会重新冒出来
const afterRename = await mainList();
check(
  '改名换 slug 之后主列表仍然排除',
  appear(afterRename.text, shuoshuo).length === 0,
  `前两页出现 ${appear(afterRename.text, shuoshuo).length} 条`,
);
const afterRenameArchive = await fetchUrl(renamed.carrier_url);
check(
  '改名换 slug 之后承载体归档照常',
  afterRenameArchive.status === 200 && appear(afterRenameArchive.body, shuoshuo).length > 0,
  `状态 ${afterRenameArchive.status}，${appear(afterRenameArchive.body, shuoshuo).length} 条`,
);

const renamedBack = tryFx('rename', '--name=说说', '--slug=shuoshuo');
// 明细里带上 error：这条一旦失败，光看 mod=undefined 完全不知道是为什么
check(
  '改回原名，配置依旧不动',
  renamedBack.mod === activeId,
  `mod=${renamedBack.mod}${renamedBack.error ? ` 失败原因 ${renamedBack.error}` : ''}`,
);

/* ================= 收尾 ================= */

// 必须在 report() 之前做完：report() 会直接 exit
const finalState = tryFx('state');
note(`承载体分类 ${finalState.carrier_name || '(无)'} / ${finalState.carrier_slug || '(无)'}，mod=${finalState.mod}`);
const torn = tryFx('teardown');
note(`清理标记内容 ${torn.removed ?? '?'} 篇`);

const site = await get(`${SITE}/`);
note(`首页 ${SITE}/ 状态 ${site.status}`);

report();
