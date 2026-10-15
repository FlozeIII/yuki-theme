<?php
/**
 * 工单 03（评论区的层级与样式）的造数：一条四层深的回复链 + 一条独苗顶层评论。
 *
 * 刻意把「讨论设置 → 评论嵌套层数」设成 5（WordPress 默认值），比主题要的上限深：
 * 这样验的是**主题自己**把层级压到两层，而不是碰巧跟着站点设置走。
 *
 * 可重复执行：每次先清掉本验证留下的评论（内容带 YUKI-TEST 的那些）。
 *
 * 用法: php tests/bin/comment-nesting-fixtures.php <wordpress目录>
 *
 * 最后一行打印一个 JSON 对象，给 verify-comment-nesting.mjs 取地址与身份。
 */

// 不要叫 $wp —— WordPress 的环境实例就叫这个名字（见 tests/bin/wp-probe.php 里的说明）。
$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php comment-nesting-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

/* ---------- 1. 讨论设置 ---------- */
update_option( 'thread_comments', 1 );
update_option( 'thread_comments_depth', 5 ); // 站点允许五层，主题只该显示两层
update_option( 'page_comments', 0 );
update_option( 'comment_registration', 0 );
update_option( 'require_name_email', 1 );
update_option( 'comment_moderation', 0 );
update_option( 'comment_previously_approved', 1 );
update_option( 'default_comment_status', 'open' );

/* ---------- 2. 验证用文章 ---------- */
$title   = 'YUKI-TEST 评论层级验证用文章';
$post_id = 0;

foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'publish',
	's'           => 'YUKI-TEST',
) ) as $p ) {
	if ( $title === $p->post_title ) {
		$post_id = $p->ID;
		break;
	}
}

if ( ! $post_id ) {
	$post_id = wp_insert_post( array(
		'post_title'     => $title,
		'post_content'   => '<p>用来看评论嵌套到第几层。</p>',
		'post_status'    => 'publish',
		'post_type'      => 'post',
		'post_author'    => 1,
		'comment_status' => 'open',
		'ping_status'    => 'closed',
	) );
}

foreach ( get_comments( array( 'post_id' => $post_id, 'status' => 'all' ) ) as $c ) {
	if ( false !== strpos( $c->comment_content, 'YUKI-TEST' ) ) {
		wp_delete_comment( $c->comment_ID, true );
	}
}

/* ---------- 3. 一条四层深的链子 ---------- */
// 统一用这个邮箱：它有过已通过的评论，之后同邮箱的提交会直接发布（check_comment() 按
// 「作者名 + 邮箱」认老读者）。以前这里只在内层作用域里出现过，外面那条待审评论引用了
// 一个没定义的同名变量——PHP 警告刷日志，而且那条评论的作者邮箱其实是空的。
$known_email = 'visitor@example.com';

// 作者名各不相同：「回复 @谁」的断言要靠它们认人。
$chain = array(
	array( 'key' => 'L1', 'author' => '顶层甲', 'parent' => 0 ),
	array( 'key' => 'L2', 'author' => '二层乙', 'parent' => 'L1' ),
	array( 'key' => 'L3', 'author' => '三层丙', 'parent' => 'L2' ),
	array( 'key' => 'L4', 'author' => '四层丁', 'parent' => 'L3' ),
);

$ids = array();

foreach ( $chain as $i => $node ) {
	$parent = ( 0 === $node['parent'] ) ? 0 : $ids[ $node['parent'] ];

	$ids[ $node['key'] ] = wp_insert_comment( array(
		'comment_post_ID'      => $post_id,
		'comment_author'       => $node['author'],
		'comment_author_email' => $known_email,
		'comment_content'      => 'YUKI-TEST-NEST-' . $node['key'] . ' ' . $node['author'] . ' 的第 ' . ( $i + 1 ) . ' 层发言。',
		'comment_approved'     => 1,
		'comment_author_IP'    => '127.0.0.1',
		'comment_parent'       => $parent,
		'comment_date'         => gmdate( 'Y-m-d H:i:s', strtotime( "+{$i} minutes" ) ),
		'comment_date_gmt'     => gmdate( 'Y-m-d H:i:s', strtotime( "+{$i} minutes" ) ),
	) );
}

// 一条独立的顶层评论：压平不能把别人的回复也挪到它底下，也不能改动顶层顺序
$ids['LONE'] = wp_insert_comment( array(
	'comment_post_ID'      => $post_id,
	'comment_author'       => '独苗己',
	'comment_author_email' => 'solo@example.com',
	'comment_content'      => 'YUKI-TEST-NEST-LONE 一条没有回复的顶层评论。',
	'comment_approved'     => 1,
	'comment_author_IP'    => '127.0.0.1',
	'comment_date'         => gmdate( 'Y-m-d H:i:s', strtotime( '+10 minutes' ) ),
	'comment_date_gmt'     => gmdate( 'Y-m-d H:i:s', strtotime( '+10 minutes' ) ),
) );

// （这里原来还有一条匿名访客的待审评论，只为一条早先放弃的「预览链接」验法而建：
//   预览那条路要 ?unapproved=&moderation-hash= 才成立，而待审的渲染分支已经由下面
//   管理员那条覆盖了——同一个分支验两遍没有意义，删掉，别留死数据。）

// 管理员自己的一条待审评论：核心会把「当前用户自己的未过审评论」放进列表，
// 所以用管理员身份打开文章页能看到它——这段用来验主题自己渲染评论时对待审那条的处理
// （提示语、正文剥标签、不给回复链接），也就是核心 filter_comment_text 那套行为的等价物。
$admin = get_userdata( 1 );
$ids['ADMINPEND'] = wp_insert_comment( array(
	'comment_post_ID'      => $post_id,
	'comment_author'       => $admin ? $admin->display_name : 'admin',
	'comment_author_email' => $admin ? $admin->user_email : '',
	'comment_content'      => '<b>YUKI-TEST-NEST-ADMINPEND</b> 管理员自己的一条待审评论。',
	'comment_approved'     => 0,
	'user_id'              => 1,
	'comment_author_IP'    => '127.0.0.1',
	'comment_date'         => gmdate( 'Y-m-d H:i:s', strtotime( '+13 minutes' ) ),
	'comment_date_gmt'     => gmdate( 'Y-m-d H:i:s', strtotime( '+13 minutes' ) ),
) );

// 一条 pingback：主题自己渲染每条评论之后，非 comment 类型也得照旧出得来
$ids['PING'] = wp_insert_comment( array(
	'comment_post_ID'   => $post_id,
	'comment_author'    => '别的博客',
	'comment_author_url' => 'https://example.org/a-post',
	'comment_content'   => 'YUKI-TEST-NEST-PING 一条 pingback。',
	'comment_approved'  => 1,
	'comment_type'      => 'pingback',
	'comment_author_IP' => '127.0.0.1',
	'comment_date'      => gmdate( 'Y-m-d H:i:s', strtotime( '+11 minutes' ) ),
	'comment_date_gmt'  => gmdate( 'Y-m-d H:i:s', strtotime( '+11 minutes' ) ),
) );

echo '主题     : ' . wp_get_theme()->get( 'Name' ) . "\n";
echo '文章     : ' . get_permalink( $post_id ) . "\n";
echo '层数设置 : ' . get_option( 'thread_comments_depth' ) . "\n";

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'site'          => home_url( '/' ),
	'post_id'       => (int) $post_id,
	'post_url'      => get_permalink( $post_id ),
	'ids'           => $ids,
	'ping_author'   => '别的博客',
	'known_email'   => $known_email,
	// 评论 cookie 的名字里要带这个哈希，验证脚本拿它模拟「作者本人」
	'authors'       => array(
		'L1'   => '顶层甲',
		'L2'   => '二层乙',
		'L3'   => '三层丙',
		'L4'   => '四层丁',
		'LONE' => '独苗己',
	),
) ) . "\n";
