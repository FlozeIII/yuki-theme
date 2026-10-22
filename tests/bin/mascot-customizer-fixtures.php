<?php
/**
 * 自定义吉祥物的造数：保存当前设置，切到「自定义」或「隐藏」，可恢复。
 *
 * 用法:
 *   php tests/bin/mascot-customizer-fixtures.php <wordpress目录> custom
 *   php tests/bin/mascot-customizer-fixtures.php <wordpress目录> hidden
 *   php tests/bin/mascot-customizer-fixtures.php <wordpress目录> --cleanup
 *
 * 这是测试数据脚本，只改主题设置，不建文章；不改全站其它选项。
 */

$wp_root = $argv[1] ?? '';
$mode    = $argv[2] ?? 'custom';

if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php mascot-customizer-fixtures.php <wordpress目录> [custom|hidden|--cleanup]\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

$keys = array(
	'yuki_mascot_enabled',
	'yuki_mascot_image',
	'yuki_mascot_name',
	'yuki_mascot_role',
);

/**
 * 读取当前四个设置的值，保留「未设置」与「空值」的区别。
 *
 * @param array $keys 设置名。
 * @return array
 */
function yuki_mascot_test_snapshot( $keys ) {
	$mods   = get_theme_mods();
	$mods   = is_array( $mods ) ? $mods : array();
	$backup = array();

	foreach ( $keys as $key ) {
		$backup[ $key ] = array_key_exists( $key, $mods )
			? array( 'set' => true, 'value' => $mods[ $key ] )
			: array( 'set' => false );
	}

	return $backup;
}

/**
 * 按快照恢复四个设置。
 *
 * @param array $backup 快照。
 * @return void
 */
function yuki_mascot_test_restore( $backup ) {
	foreach ( $backup as $key => $entry ) {
		if ( ! empty( $entry['set'] ) ) {
			set_theme_mod( $key, $entry['value'] );
		} else {
			remove_theme_mod( $key );
		}
	}
}

if ( '--cleanup' === $mode ) {
	$backup = get_option( 'yuki_mascot_test_backup', null );

	if ( is_array( $backup ) ) {
		yuki_mascot_test_restore( $backup );
		delete_option( 'yuki_mascot_test_backup' );
	}

	echo 'YUKI-JSON: ' . wp_json_encode( array( 'cleaned' => true ) ) . "\n";
	exit( 0 );
}

if ( ! in_array( $mode, array( 'custom', 'hidden' ), true ) ) {
	fwrite( STDERR, "未知模式：{$mode}\n" );
	exit( 3 );
}

$existing = get_option( 'yuki_mascot_test_backup', null );

if ( ! is_array( $existing ) ) {
	update_option( 'yuki_mascot_test_backup', yuki_mascot_test_snapshot( $keys ), false );
}

if ( 'custom' === $mode ) {
	$image = add_query_arg( 'yuki-custom', '1', get_theme_file_uri( 'assets/images/mascot-yuki.png' ) );

	set_theme_mod( 'yuki_mascot_enabled', true );
	set_theme_mod( 'yuki_mascot_image', $image );
	set_theme_mod( 'yuki_mascot_name', 'YUKI-CUSTOM-NAME' );
	set_theme_mod( 'yuki_mascot_role', 'YUKI-CUSTOM-ROLE' );
} else {
	set_theme_mod( 'yuki_mascot_enabled', false );
}

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'mode'      => $mode,
	'home_url'  => home_url( '/' ),
	'image_url' => function_exists( 'yuki_mascot_image_url' ) ? yuki_mascot_image_url() : '',
	'name'      => function_exists( 'yuki_mascot_name' ) ? yuki_mascot_name() : '',
	'role'      => function_exists( 'yuki_mascot_role' ) ? yuki_mascot_role() : '',
	'origin'    => function_exists( 'yuki_mascot_origin' ) ? yuki_mascot_origin() : '',
) ) . "\n";
