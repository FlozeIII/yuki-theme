<?php
/**
 * 工单 02（评论防垃圾）的造数：一篇文章、一套讨论设置、一位「回头客」。
 *
 * 可重复执行：每次先把上一轮验证留下的评论清掉（内容带 YUKI-TEST 的那个）。
 * 每一轮都重造，所以断言只认内容、不认编号——本地环境可能同时开着别的会话。
 *
 * 用法: php tests/bin/comment-spam-fixtures.php <wordpress目录>
 *
 * 最后一行打印一个 JSON 对象，给 verify-comment-spam.mjs 取地址与身份。
 */

// 不要叫 $wp —— WordPress 的环境实例就叫这个名字（见 tests/bin/wp-probe.php 里的说明）。
$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php comment-spam-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

/* ---------- 1. 讨论设置 ---------- */
// 用 WordPress 新装的默认值：不逐条人工审、老读者的评论直接放行。
// 验收要靠它把「该发布」和「该待审」两种正常结果分开。
update_option( 'comment_registration', 0 );
update_option( 'require_name_email', 1 );
update_option( 'comment_moderation', 0 );
update_option( 'comment_previously_approved', 1 );
update_option( 'close_comments_for_old_posts', 0 );
update_option( 'default_comment_status', 'open' );

/* ---------- 2. 验证用文章 ---------- */
$title   = 'YUKI-TEST 评论验证用文章';
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
		'post_content'   => '<p>用来验证评论增强的文章。</p>',
		'post_status'    => 'publish',
		'post_type'      => 'post',
		'post_author'    => 1,
		'comment_status' => 'open',
		'ping_status'    => 'closed',
	) );
}

// 先把文章上的评论清空，免得上一轮的标记混进这一轮的判断
foreach ( get_comments( array( 'post_id' => $post_id, 'status' => 'all' ) ) as $c ) {
	if ( false !== strpos( $c->comment_content, 'YUKI-TEST' ) ) {
		wp_delete_comment( $c->comment_ID, true );
	}
}

/* ---------- 3. 一位「回头客」 ---------- */
// comment_previously_approved 认的是邮箱：这个邮箱有过审核通过的评论，
// 之后同一邮箱的评论就直接发布，而不是进待审队列。
$known_email  = 'visitor@example.com';
$known_author = '回头客';

$approved = get_comments( array(
	'post_id'      => $post_id,
	'author_email' => $known_email,
	'status'       => 'approve',
	'count'        => true,
) );

if ( ! $approved ) {
	wp_insert_comment( array(
		'comment_post_ID'      => $post_id,
		'comment_author'       => $known_author,
		'comment_author_email' => $known_email,
		'comment_content'      => 'YUKI-TEST 这位访客之前留过一条已经通过的评论。',
		'comment_approved'     => 1,
		'comment_author_IP'    => '127.0.0.1',
	) );
}

echo '主题     : ' . wp_get_theme()->get( 'Name' ) . "\n";
echo '文章     : ' . get_permalink( $post_id ) . "\n";

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'site'          => home_url( '/' ),
	'post_id'       => (int) $post_id,
	'post_url'      => get_permalink( $post_id ),
	'comments_feed' => get_permalink( $post_id ) . 'feed/',
	'known_author'  => $known_author,
	'known_email'   => $known_email,
) ) . "\n";
