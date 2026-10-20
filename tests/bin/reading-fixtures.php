<?php
/**
 * 单篇阅读组件 fixtures。
 *
 * 从命令行接收 WordPress 根目录：
 *   php tests/bin/reading-fixtures.php /path/to/wordpress
 *   php tests/bin/reading-fixtures.php /path/to/wordpress --cleanup
 *
 * @package Yuki
 */

$wp_root = isset( $argv[1] ) ? $argv[1] : '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "usage: php reading-fixtures.php <wordpress-root> [--cleanup]\n" );
	exit( 1 );
}

require_once $wp_root . '/wp-load.php';

$cleanup = in_array( '--cleanup', $argv, true );

function yuki_reading_fixture_posts() {
	return get_posts(
		array(
			'post_type'      => 'post',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'meta_key'       => '_yuki_reading_fixture',
			'meta_value'     => '1',
		)
	);
}

function yuki_reading_delete_term() {
	$term = get_term_by( 'slug', 'yuki-reading-series', 'yuki_series' );
	if ( $term && ! is_wp_error( $term ) ) {
		wp_delete_term( $term->term_id, 'yuki_series' );
	}
}

$old_posts = yuki_reading_fixture_posts();
if ( $cleanup ) {
	foreach ( $old_posts as $old_post ) {
		wp_delete_post( $old_post->ID, true );
	}
	yuki_reading_delete_term();
	echo 'YUKI-JSON: ' . wp_json_encode( array( 'cleaned' => count( $old_posts ) ) ) . "\n";
	exit( 0 );
}

foreach ( $old_posts as $old_post ) {
	wp_delete_post( $old_post->ID, true );
}
yuki_reading_delete_term();

$users = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
	)
);
if ( empty( $users ) ) {
	fwrite( STDERR, "no administrator found\n" );
	exit( 1 );
}

$term = wp_insert_term( 'YUKI-READING-系列', 'yuki_series', array( 'slug' => 'yuki-reading-series' ) );
if ( is_wp_error( $term ) ) {
	fwrite( STDERR, $term->get_error_message() . "\n" );
	exit( 1 );
}
$term_id = (int) $term['term_id'];

$series_content = <<<'HTML'
<!-- wp:heading -->
<h2 class="wp-block-heading">第一节 · 起点</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>系列文章的第一段，用来生成目录。</p>
<!-- /wp:paragraph -->
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">小节 · 证据</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>三级标题应该缩进显示。</p>
<!-- /wp:paragraph -->
<!-- wp:heading -->
<h2 class="wp-block-heading">第二节 · 结论</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>第二个二级标题，用来验证目录数量和当前项。</p>
<!-- /wp:paragraph -->
HTML;

$current_content = <<<'HTML'
<!-- wp:paragraph -->
<p>这篇没有标题，目录不应该出现。</p>
<!-- /wp:paragraph -->
HTML;

$post_ids = array();
$dates    = array(
	'2026-09-01 09:00:00',
	'2026-10-01 09:00:00',
	'2026-10-02 09:00:00',
);
$titles   = array(
	'YUKI-READING-SERIES-A',
	'YUKI-READING-SERIES-B',
	'YUKI-READING-SERIES-C',
);

foreach ( $titles as $index => $title ) {
	$content = 1 === $index ? $series_content : $current_content;
	$post_id = wp_insert_post(
		array(
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'post_title'     => $title,
			'post_content'   => $content,
			'post_author'    => (int) $users[0]->ID,
			'post_date'      => $dates[ $index ],
			'post_date_gmt'  => get_gmt_from_date( $dates[ $index ] ),
			'comment_status' => 'closed',
			'ping_status'    => 'closed',
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		fwrite( STDERR, $post_id->get_error_message() . "\n" );
		exit( 1 );
	}

	update_post_meta( $post_id, '_yuki_reading_fixture', '1' );
	wp_set_object_terms( $post_id, array( $term_id ), 'yuki_series' );
	$post_ids[] = $post_id;
}

$standalone_id = wp_insert_post(
	array(
		'post_type'      => 'post',
		'post_status'    => 'publish',
		'post_title'     => 'YUKI-READING-STANDALONE',
		'post_content'   => $current_content,
		'post_author'    => (int) $users[0]->ID,
		'post_date'      => '2026-09-15 09:00:00',
		'post_date_gmt'  => get_gmt_from_date( '2026-09-15 09:00:00' ),
		'comment_status' => 'closed',
		'ping_status'    => 'closed',
	),
	true
);
if ( is_wp_error( $standalone_id ) ) {
	fwrite( STDERR, $standalone_id->get_error_message() . "\n" );
	exit( 1 );
}
update_post_meta( $standalone_id, '_yuki_reading_fixture', '1' );

echo 'YUKI-JSON: ' . wp_json_encode(
	array(
		'page_url'       => get_permalink( $post_ids[1] ),
		'standalone_url' => get_permalink( $standalone_id ),
		'series_name'    => 'YUKI-READING-系列',
		'series_count'   => 3,
		'post_ids'       => $post_ids,
		'standalone_id'  => (int) $standalone_id,
	)
) . "\n";
