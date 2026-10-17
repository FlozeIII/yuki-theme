<?php
/**
 * 工单 01（关联文章）的造数。
 *
 * 当前文章在分类 A、带标签 T：
 *   - 分类 A 下还有两篇（较新）
 *   - 分类 B 下有两篇带标签 T（较旧）
 * 预期关联：分类 A 的两篇 + 标签 T 的最新一篇，共三篇。
 *
 * 另造：
 *   - 一篇独居分类 C、没有标签的文章（关联应为空，整段不输出）
 *   - 一条说说承载分类下的短说说（不该显示关联）
 *
 * 不改全站 theme mod；说说分类用站点现有的 `yuki_shuoshuo_category`，没有就不造。
 *
 * 用法: php tests/bin/related-posts-fixtures.php <wordpress目录>
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php related-posts-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! $admins ) {
	fwrite( STDERR, "找不到管理员账号，造数没法继续。\n" );
	exit( 3 );
}
$admin_id = (int) $admins[0]->ID;
wp_set_current_user( $admin_id );

/* ---------- 1. 清掉上一轮（按标记找，可重复执行）---------- */
foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-REL-',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 2. 分类与标签 ---------- */
function yuki_rel_term( $taxonomy, $slug, $name ) {
	$term = get_term_by( 'slug', $slug, $taxonomy );
	if ( ! $term ) {
		$term = wp_insert_term( $name, $taxonomy, array( 'slug' => $slug ) );
	}
	return (int) ( is_array( $term ) ? $term['term_id'] : $term->term_id );
}

$cat_a    = yuki_rel_term( 'category', 'yuki-test-related-a', '关联验证 A' );
$cat_b    = yuki_rel_term( 'category', 'yuki-test-related-b', '关联验证 B' );
$cat_c    = yuki_rel_term( 'category', 'yuki-test-related-c', '关联验证 C' );
$tag_t    = yuki_rel_term( 'post_tag', 'yuki-test-related-tag', '关联验证标签' );

$shuoshuo_cat = (int) get_theme_mod( 'yuki_shuoshuo_category', 0 );

/* ---------- 3. 造文章 ---------- */
function yuki_rel_insert( $title, $cat, $tags, $hours_ago, $author ) {
	$date = gmdate( 'Y-m-d H:i:s', strtotime( "-{$hours_ago} hours" ) );
	$id   = wp_insert_post( array(
		'post_title'    => $title,
		'post_content'  => '<p>' . $title . ' 的正文。</p>',
		'post_status'   => 'publish',
		'post_type'     => 'post',
		'post_author'   => $author,
		'post_category' => array( $cat ),
		'post_date'     => $date,
		'post_date_gmt' => $date,
	) );

	if ( $tags ) {
		wp_set_post_tags( $id, $tags );
	}

	return $id;
}

$current = yuki_rel_insert( 'YUKI-REL-CURRENT 当前文章', $cat_a, array( $tag_t ), 0, $admin_id );
$cat1    = yuki_rel_insert( 'YUKI-REL-CAT-1 同分类一', $cat_a, array(), 1, $admin_id );
$cat2    = yuki_rel_insert( 'YUKI-REL-CAT-2 同分类二', $cat_a, array(), 2, $admin_id );
$tag1    = yuki_rel_insert( 'YUKI-REL-TAG-1 同标签一', $cat_b, array( $tag_t ), 3, $admin_id );
$tag2    = yuki_rel_insert( 'YUKI-REL-TAG-2 同标签二', $cat_b, array( $tag_t ), 4, $admin_id );
$empty   = yuki_rel_insert( 'YUKI-REL-EMPTY 没有关联', $cat_c, array(), 5, $admin_id );

$shuoshuo = 0;
if ( $shuoshuo_cat && get_term( $shuoshuo_cat ) ) {
	$shuoshuo = yuki_rel_insert( 'YUKI-REL-SHUOSHUO 一条短说说', $shuoshuo_cat, array(), 6, $admin_id );
}

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'current_url'  => get_permalink( $current ),
	'empty_url'    => get_permalink( $empty ),
	'shuoshuo_url' => $shuoshuo ? get_permalink( $shuoshuo ) : null,
	'expected'     => array(
		'YUKI-REL-CAT-1 同分类一',
		'YUKI-REL-CAT-2 同分类二',
		'YUKI-REL-TAG-1 同标签一',
	),
	'current_title' => 'YUKI-REL-CURRENT 当前文章',
	'not_related'   => array(
		'YUKI-REL-TAG-2 同标签二',
		'YUKI-REL-SHUOSHUO 一条短说说',
	),
	'ids' => array(
		'current'  => $current,
		'cat1'     => $cat1,
		'cat2'     => $cat2,
		'tag1'     => $tag1,
		'tag2'     => $tag2,
		'empty'    => $empty,
		'shuoshuo' => $shuoshuo,
	),
) ) . "\n";
