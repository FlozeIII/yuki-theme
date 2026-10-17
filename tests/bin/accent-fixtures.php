<?php
/**
 * 工单 03（强调色）的造数：临时把强调色设成 #E85D75，验完恢复原 theme mod。
 *
 * 用法:
 *   php accent-fixtures.php <wordpress目录>              设强调色 #E85D75
 *   php accent-fixtures.php <wordpress目录> --cleanup    恢复原值
 *   php accent-fixtures.php <wordpress目录> --foreground 验前景色选择
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php accent-fixtures.php <wordpress目录> [--cleanup|--foreground]\n" );
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

if ( isset( $argv[2] ) && '--foreground' === $argv[2] ) {
	$colors = array( '#A5B4FC', '#E85D75', '#000000', '#FFFFFF' );
	$out    = array();
	foreach ( $colors as $color ) {
		$out[ $color ] = yuki_accent_foreground( $color );
	}
	echo 'YUKI-FOREGROUND: ' . wp_json_encode( $out ) . "\n";
	exit( 0 );
}

if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$original = get_transient( 'yuki_accent_test_original' );

	if ( is_array( $original ) ) {
		if ( '' === $original['accent'] ) {
			remove_theme_mod( 'yuki_accent' );
		} else {
			set_theme_mod( 'yuki_accent', $original['accent'] );
		}
		delete_transient( 'yuki_accent_test_original' );
	}

	echo "cleaned\n";
	exit( 0 );
}

$accent = '#E85D75';

set_transient( 'yuki_accent_test_original', array(
	'accent' => get_theme_mod( 'yuki_accent', '' ),
), HOUR_IN_SECONDS );

set_theme_mod( 'yuki_accent', $accent );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url'   => home_url( '/' ),
	'accent'     => $accent,
	'foreground' => yuki_accent_foreground( $accent ),
) ) . "\n";
