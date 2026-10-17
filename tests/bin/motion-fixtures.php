<?php
/**
 * 工单 01（动效收敛）的造数：两篇带缩略图的文章、一个标签。
 *
 * 首页用来量列表 hover；其中较新那篇的单页用来量上下篇卡片与关联文章。
 *
 * 用法: php tests/bin/motion-fixtures.php <wordpress目录>
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php motion-fixtures.php <wordpress目录>\n" );
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

/* ---------- 1. 清掉上一轮 ---------- */
foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-MOTION-',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 2. 分类、标签、缩略图 ---------- */
function yuki_motion_term( $taxonomy, $slug, $name ) {
	$term = get_term_by( 'slug', $slug, $taxonomy );
	if ( ! $term ) {
		$term = wp_insert_term( $name, $taxonomy, array( 'slug' => $slug ) );
	}
	return (int) ( is_array( $term ) ? $term['term_id'] : $term->term_id );
}

$cat = yuki_motion_term( 'category', 'yuki-test-motion', '动效验证' );
$tag = yuki_motion_term( 'post_tag', 'yuki-test-motion-tag', '动效验证标签' );

$uploads  = wp_upload_dir();
$img_path = trailingslashit( $uploads['path'] ) . 'yuki-motion.png';
$im = imagecreatetruecolor( 640, 400 );
imagefill( $im, 0, 0, imagecolorallocate( $im, 165, 180, 252 ) );
imagestring( $im, 5, 250, 190, 'YUKI MOTION', imagecolorallocate( $im, 255, 255, 255 ) );
imagepng( $im, $img_path );
imagedestroy( $im );

require_once ABSPATH . 'wp-admin/includes/image.php';
$thumb_id = wp_insert_attachment( array(
	'post_mime_type' => 'image/png',
	'post_title'     => 'YUKI-MOTION 配图',
	'post_status'    => 'inherit',
), $img_path );
wp_update_attachment_metadata( $thumb_id, wp_generate_attachment_metadata( $thumb_id, $img_path ) );

/* ---------- 3. 两篇文章 ---------- */
function yuki_motion_post( $title, $cat, $hours_ago, $author ) {
	$date = gmdate( 'Y-m-d H:i:s', strtotime( "-{$hours_ago} hours" ) );
	return wp_insert_post( array(
		'post_title'    => $title,
		'post_content'  => '<p>' . $title . ' 的正文。</p>',
		'post_status'   => 'publish',
		'post_type'     => 'post',
		'post_author'   => $author,
		'post_category' => array( $cat ),
		'post_date'     => $date,
		'post_date_gmt' => $date,
	) );
}

$a = yuki_motion_post( 'YUKI-MOTION-A 较新', $cat, 0, $admin_id );
$b = yuki_motion_post( 'YUKI-MOTION-B 较旧', $cat, 1, $admin_id );

set_post_thumbnail( $a, $thumb_id );
set_post_thumbnail( $b, $thumb_id );
wp_set_post_tags( $a, array( $tag ) );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url' => home_url( '/' ),
	'post_url' => get_permalink( $a ),
	'titles'   => array(
		'a' => 'YUKI-MOTION-A 较新',
		'b' => 'YUKI-MOTION-B 较旧',
	),
) ) . "\n";
