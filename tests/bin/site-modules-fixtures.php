<?php
/**
 * Site modules fixture: a post with enough tags for the tag wall.
 *
 * Usage: php tests/bin/site-modules-fixtures.php <wp-root> [--cleanup]
 * Prints one YUKI-JSON: {...} line.
 *
 * @package Yuki
 */

$root = isset( $argv[1] ) ? $argv[1] : '';
if ( ! $root || ! file_exists( $root . '/wp-load.php' ) ) {
	fwrite( STDERR, "usage: site-modules-fixtures.php <wp-root> [--cleanup]\n" );
	exit( 1 );
}

require_once $root . '/wp-load.php';

$cleanup = in_array( '--cleanup', $argv, true );
$marker  = 'YUKI-SITE-MODULES';
$prefix  = 'YUKI-SITE-MODULES-TAG-';

$old = get_posts( array(
	'post_type'      => array( 'post', 'page' ),
	'post_status'    => 'any',
	'posts_per_page' => -1,
	'meta_key'       => '_yuki_site_modules_fixture',
	'meta_value'     => '1',
	'fields'         => 'ids',
) );

foreach ( $old as $post_id ) {
	wp_delete_post( $post_id, true );
}

$old_tags = get_terms( array(
	'taxonomy'   => 'post_tag',
	'hide_empty' => false,
	'name__like' => $prefix,
) );
if ( ! is_wp_error( $old_tags ) ) {
	foreach ( $old_tags as $term ) {
		wp_delete_term( $term->term_id, 'post_tag' );
	}
}

if ( $cleanup ) {
	echo 'YUKI-JSON: ' . wp_json_encode( array( 'cleaned' => count( $old ) ) ) . "\n";
	exit( 0 );
}

$admin = get_users( array(
	'role'   => 'administrator',
	'number' => 1,
	'fields' => 'ID',
) );
if ( empty( $admin ) ) {
	fwrite( STDERR, "no administrator\n" );
	exit( 1 );
}

$tag_ids = array();
for ( $i = 1; $i <= 14; $i++ ) {
	$name = sprintf( '%s%02d', $prefix, $i );
	$term = term_exists( $name, 'post_tag' );
	if ( ! $term ) {
		$term = wp_insert_term( $name, 'post_tag' );
	}
	if ( is_wp_error( $term ) ) {
		fwrite( STDERR, $term->get_error_message() . "\n" );
		exit( 1 );
	}
	$tag_ids[] = (int) $term['term_id'];
}

$post_id = wp_insert_post( array(
	'post_title'   => $marker . ' 单篇',
	'post_content' => '<!-- wp:paragraph --><p>站点模块验收用单篇，正文不参与断言。</p><!-- /wp:paragraph -->',
	'post_status'  => 'publish',
	'post_type'    => 'post',
	'post_author'  => (int) $admin[0],
), true );

if ( is_wp_error( $post_id ) ) {
	fwrite( STDERR, $post_id->get_error_message() . "\n" );
	exit( 1 );
}

update_post_meta( $post_id, '_yuki_site_modules_fixture', '1' );
wp_set_post_tags( $post_id, $tag_ids, false );

$stats = function_exists( 'yuki_production_stats' )
	? yuki_production_stats()
	: array( 'episodes' => 0, 'categories' => 0, 'updated' => '—' );

$category = get_category_by_slug( 'uncategorized' );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'post_id'      => (int) $post_id,
	'post_url'     => get_permalink( $post_id ),
	'tag_count'    => count( $tag_ids ),
	'stats'        => $stats,
	'home_url'     => home_url( '/' ),
	'archive_url'  => $category ? get_category_link( $category ) : '',
) ) . "\n";
