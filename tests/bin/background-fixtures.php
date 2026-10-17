<?php
/**
 * 工单（背景图 + 蒙层）的造数：临时设一张背景图与 60 的蒙层强度，验完恢复原值。
 *
 * 用法:
 *   php background-fixtures.php <wordpress目录>            设背景图 + 蒙层 60
 *   php background-fixtures.php <wordpress目录> --cleanup  恢复原 theme mod、删测试图
 *   php background-fixtures.php <wordpress目录> --sanitize 验蒙层取值夹取
 *
 * theme mod 是全站状态：脚本把原值存进一个 transient，清理时原样还回去。
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php background-fixtures.php <wordpress目录> [--cleanup|--sanitize]\n" );
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

if ( isset( $argv[2] ) && '--sanitize' === $argv[2] ) {
	$values = array( -10, 0, 60, 100, 150, '75' );
	$out    = array();
	foreach ( $values as $value ) {
		$out[ (string) $value ] = yuki_sanitize_background_scrim( $value );
	}
	echo 'YUKI-SANITIZE: ' . wp_json_encode( $out ) . "\n";
	exit( 0 );
}

if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$original = get_transient( 'yuki_bg_test_original' );

	if ( is_array( $original ) ) {
		if ( ! empty( $original['image'] ) ) {
			set_theme_mod( 'background_image', $original['image'] );
		} else {
			remove_theme_mod( 'background_image' );
		}

		if ( null === $original['scrim'] ) {
			remove_theme_mod( 'yuki_background_scrim' );
		} else {
			set_theme_mod( 'yuki_background_scrim', $original['scrim'] );
		}

		if ( ! empty( $original['attachment'] ) && get_post( $original['attachment'] ) ) {
			wp_delete_attachment( $original['attachment'], true );
		}

		delete_transient( 'yuki_bg_test_original' );
	}

	echo "cleaned\n";
	exit( 0 );
}

/* ---------- 清掉上一轮可能残留的测试图 ---------- */
foreach ( get_posts( array(
	'post_type'   => 'attachment',
	'post_status' => 'inherit',
	'numberposts' => -1,
	's'           => 'YUKI-BACKGROUND-TEST',
) ) as $old ) {
	wp_delete_attachment( $old->ID, true );
}

/* ---------- 造一张测试背景图 ---------- */
$uploads  = wp_upload_dir();
$img_path = trailingslashit( $uploads['path'] ) . 'yuki-background-test.png';
$im = imagecreatetruecolor( 640, 400 );
imagefill( $im, 0, 0, imagecolorallocate( $im, 51, 102, 153 ) );
imagestring( $im, 5, 220, 190, 'YUKI BACKGROUND TEST', imagecolorallocate( $im, 255, 255, 255 ) );
imagepng( $im, $img_path );
imagedestroy( $im );

require_once ABSPATH . 'wp-admin/includes/image.php';
$attachment = wp_insert_attachment( array(
	'post_mime_type' => 'image/png',
	'post_title'     => 'YUKI-BACKGROUND-TEST',
	'post_status'    => 'inherit',
), $img_path );
wp_update_attachment_metadata( $attachment, wp_generate_attachment_metadata( $attachment, $img_path ) );

$image_url = wp_get_attachment_url( $attachment );

/* ---------- 保存原值，设测试值 ---------- */
$original = array(
	'image'      => get_theme_mod( 'background_image', '' ),
	'scrim'      => get_theme_mod( 'yuki_background_scrim', null ),
	'attachment' => (int) $attachment,
);
set_transient( 'yuki_bg_test_original', $original, HOUR_IN_SECONDS );

set_theme_mod( 'background_image', $image_url );
set_theme_mod( 'yuki_background_scrim', 60 );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url'         => home_url( '/' ),
	'image_url'        => $image_url,
	'attachment_id'    => (int) $attachment,
	'scrim'            => 60,
	'expected_opacity' => '0.6',
) ) . "\n";
