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
		// 第一条顺手当「回头客」：这个邮箱有过通过的评论，之后同邮箱的提交会直接发布
		'comment_author_email' => 'visitor@example.com',
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
	'known_email'   => 'visitor@example.com',
	'authors'       => array(
		'L1'   => '顶层甲',
		'L2'   => '二层乙',
		'L3'   => '三层丙',
		'L4'   => '四层丁',
		'LONE' => '独苗己',
	),
) ) . "\n";
