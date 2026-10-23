<?php
/**
 * 设定资料集视觉层。
 *
 * 这一层只负责把整站切换成「不存在的动画的制作资料集」：纸面、工程网格、生产信息栏、
 * 角色设定与话数索引。它不改变任何内容模型，也不接管既有交互；样式放在独立文件里，
 * 在 style.css 之后加载，旧规则继续作为宽度、颜色和可访问性的稳定契约。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 资料集样式表：依赖 style.css，版本仍跟主题版本走。
 */
function yuki_production_assets() {
	wp_enqueue_style(
		'yuki-production-bible',
		get_template_directory_uri() . '/assets/css/production-bible.css',
		array( 'yuki-style' ),
		yuki_asset_version()
	);

	wp_enqueue_style(
		'yuki-archive-console',
		get_template_directory_uri() . '/assets/css/archive-console.css',
		array( 'yuki-production-bible' ),
		yuki_asset_version()
	);

	wp_enqueue_style(
		'yuki-mascot-card',
		get_template_directory_uri() . '/assets/css/mascot-card.css',
		array( 'yuki-archive-console' ),
		yuki_asset_version()
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_production_assets', 20 );

/**
 * 扁平表面层：最后加载，只保留细边框、小圆角与颜色反馈。
 */
function yuki_flat_assets() {
	wp_enqueue_style(
		'yuki-flat',
		get_template_directory_uri() . '/assets/css/flat.css',
		array( 'yuki-archive-console', 'yuki-components', 'yuki-site-modules', 'yuki-mascot-card' ),
		yuki_asset_version()
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_flat_assets', 30 );

/**
 * 给前台加资料集 body class，方便只在这一层覆盖。
 *
 * @param string[] $classes body 类名。
 * @return string[]
 */
function yuki_production_body_class( $classes ) {
	$classes[] = 'yuki-production-bible';

	return $classes;
}
add_filter( 'body_class', 'yuki_production_body_class' );

/**
 * 首页封面的真实统计：已发布文章数、非空分类数、最近发布日期。
 *
 * 不把「话数」写成固定文案，也不为了让封面好看去查别的数据：新文章发布后首页应当自己变。
 *
 * @return array{episodes:int,categories:int,updated:string,updated_iso:string}
 */
function yuki_production_stats() {
	$counts   = wp_count_posts( 'post' );
	$episodes = isset( $counts->publish ) ? (int) $counts->publish : 0;

	$category_count = wp_count_terms( array(
		'taxonomy'   => 'category',
		'hide_empty' => true,
	) );
	$categories = is_wp_error( $category_count ) ? 0 : (int) $category_count;

	$latest = get_lastpostdate( 'blog' );

	return array(
		'episodes'    => $episodes,
		'categories'  => $categories,
		'updated'     => $latest ? mysql2date( 'Y.m.d', $latest ) : '—',
		'updated_iso' => $latest ? mysql2date( 'c', $latest ) : '',
	);
}
