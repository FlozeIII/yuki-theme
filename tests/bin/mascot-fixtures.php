<?php
/**
 * 工单 01（雪兔与微文案）的造数：一个空分类、一个必然 404 的地址、一个无结果的搜索。
 *
 * 不改全站设置；空分类只建一次，可重复执行。
 *
 * 用法: php tests/bin/mascot-fixtures.php <wordpress目录>
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php mascot-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! $admins ) {
	fwrite( STDERR, "找不到管理员账号，造数没法继续。\n" );
	exit( 3 );
}
wp_set_current_user( (int) $admins[0]->ID );

/* ---------- 空分类 ---------- */
$slug = 'yuki-test-mascot-empty';
$term = get_term_by( 'slug', $slug, 'category' );

if ( ! $term ) {
	$term = wp_insert_term( '雪兔空状态（验证用）', 'category', array( 'slug' => $slug ) );
}

if ( is_wp_error( $term ) ) {
	fwrite( STDERR, "创建空分类失败：{$term->get_error_message()}\n" );
	exit( 4 );
}

$term_id  = (int) ( is_array( $term ) ? $term['term_id'] : $term->term_id );
$term_url = get_term_link( $term_id );

if ( is_wp_error( $term_url ) ) {
	fwrite( STDERR, "空分类没有归档地址。\n" );
	exit( 5 );
}

$run = time();

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url'          => home_url( '/' ),
	'empty_archive_url' => $term_url,
	'empty_search_url'  => add_query_arg( 's', 'YUKI-MASCOT-NOTHING-' . $run, home_url( '/' ) ),
	'not_found_url'     => home_url( '/yuki-mascot-404-' . $run . '/' ),
	'copy'              => array(
		'not_found' => '雪兔在雪地里找了半天',
		'archive'   => '雪兔翻遍了这一栏',
		'search'    => '雪兔竖起耳朵听了半天',
		'home'      => '雪兔把院子扫干净了',
	),
) ) . "\n";
