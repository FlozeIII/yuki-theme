<?php
/**
 * 工单 03（季节点缀色）的探针：月份映射与当前季节的期望颜色。
 *
 * 用法:
 *   php season-fixtures.php <wordpress目录> --months   输出 1–12 月的类名
 *   php season-fixtures.php <wordpress目录>            输出当前季节与期望色
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php season-fixtures.php <wordpress目录> [--months]\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

if ( isset( $argv[2] ) && '--months' === $argv[2] ) {
	$months = array();
	for ( $month = 1; $month <= 12; $month++ ) {
		$months[ $month ] = yuki_season_slug( $month );
	}

	echo 'YUKI-MONTHS: ' . wp_json_encode( $months ) . "\n";
	exit( 0 );
}

$colors = array(
	'season-spring' => '#F2A6C2',
	'season-summer' => '#7CC7E8',
	'season-autumn' => '#E8A33D',
	'season-winter' => '#A5B4FC',
);

$current = yuki_season_slug();

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'home_url' => home_url( '/' ),
	'current'  => $current,
	'hex'      => $colors[ $current ],
) ) . "\n";
