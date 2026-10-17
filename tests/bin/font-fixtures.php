<?php
/**
 * 工单 04（字体切换）的造数：临时把字体风格设成 serif，验完恢复原 theme mod。
 *
 * 用法:
 *   php font-fixtures.php <wordpress目录>             设 serif
 *   php font-fixtures.php <wordpress目录> --cleanup   恢复原值
 *   php font-fixtures.php <wordpress目录> --sanitize  验三档白名单
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php font-fixtures.php <wordpress目录> [--cleanup|--sanitize]\n" );
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
	$values = array( 'sans', 'serif', 'rounded', 'bogus', '' );
	$out    = array();
	foreach ( $values as $value ) {
		$out[ $value ] = yuki_sanitize_font_style( $value );
	}
	echo 'YUKI-SANITIZE: ' . wp_json_encode( $out ) . "\n";
	exit( 0 );
}

if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$original = get_transient( 'yuki_font_test_original' );

	if ( is_array( $original ) ) {
		if ( 'sans' === $original['style'] ) {
			remove_theme_mod( 'yuki_font_style' );
		} else {
			set_theme_mod( 'yuki_font_style', $original['style'] );
		}
		delete_transient( 'yuki_font_test_original' );
	}

	echo "cleaned\n";
	exit( 0 );
}

set_transient( 'yuki_font_test_original', array(
	'style' => (string) get_theme_mod( 'yuki_font_style', 'sans' ),
), HOUR_IN_SECONDS );

set_theme_mod( 'yuki_font_style', 'serif' );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url' => home_url( '/' ),
	'style'    => 'serif',
	'stack'    => '"Noto Serif SC", "Songti SC", "SimSun", Georgia, "Times New Roman", serif',
) ) . "\n";
