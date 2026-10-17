<?php
/**
 * 工单 02（页头图）的造数：临时设一张 1600×700 的页头图，验完恢复原 theme mod。
 *
 * 用法:
 *   php header-image-fixtures.php <wordpress目录>            设页头图
 *   php header-image-fixtures.php <wordpress目录> --cleanup  恢复原值、删测试图
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php header-image-fixtures.php <wordpress目录> [--cleanup]\n" );
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

if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$original = get_transient( 'yuki_header_image_test_original' );

	if ( is_array( $original ) ) {
		if ( ! empty( $original['image'] ) ) {
			set_theme_mod( 'header_image', $original['image'] );
		} else {
			remove_theme_mod( 'header_image' );
		}

		if ( null === $original['data'] ) {
			remove_theme_mod( 'header_image_data' );
		} else {
			set_theme_mod( 'header_image_data', $original['data'] );
		}

		if ( ! empty( $original['attachment'] ) && get_post( $original['attachment'] ) ) {
			wp_delete_attachment( $original['attachment'], true );
		}

		delete_transient( 'yuki_header_image_test_original' );
	}

	echo "cleaned\n";
	exit( 0 );
}

/* ---------- 清掉上一轮残留 ---------- */
foreach ( get_posts( array(
	'post_type'   => 'attachment',
	'post_status' => 'inherit',
	'numberposts' => -1,
	's'           => 'YUKI-HEADER-TEST',
) ) as $old ) {
	wp_delete_attachment( $old->ID, true );
}

/* ---------- 造图 ---------- */
$uploads  = wp_upload_dir();
$img_path = trailingslashit( $uploads['path'] ) . 'yuki-header-test.png';
$im = imagecreatetruecolor( 1600, 700 );
imagefill( $im, 0, 0, imagecolorallocate( $im, 99, 102, 241 ) );
imagestring( $im, 5, 680, 340, 'YUKI HEADER TEST', imagecolorallocate( $im, 255, 255, 255 ) );
imagepng( $im, $img_path );
imagedestroy( $im );

require_once ABSPATH . 'wp-admin/includes/image.php';
$attachment = wp_insert_attachment( array(
	'post_mime_type' => 'image/png',
	'post_title'     => 'YUKI-HEADER-TEST',
	'post_status'    => 'inherit',
), $img_path );
wp_update_attachment_metadata( $attachment, wp_generate_attachment_metadata( $attachment, $img_path ) );

$image_url = wp_get_attachment_url( $attachment );

/* ---------- 保存原值、设测试值 ---------- */
$original = array(
	'image'      => get_theme_mod( 'header_image', '' ),
	'data'       => get_theme_mod( 'header_image_data', null ),
	'attachment' => (int) $attachment,
);
set_transient( 'yuki_header_image_test_original', $original, HOUR_IN_SECONDS );

set_theme_mod( 'header_image', $image_url );
set_theme_mod( 'header_image_data', array(
	'attachment_id' => (int) $attachment,
	'url'           => $image_url,
	'thumbnail_url' => $image_url,
	'width'         => 1600,
	'height'        => 700,
	'alt'           => '',
) );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url'      => home_url( '/' ),
	'image_url'     => $image_url,
	'attachment_id' => (int) $attachment,
	'width'         => 1600,
	'height'        => 700,
) ) . "\n";
