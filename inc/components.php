<?php
/**
 * 可复用组件：block pattern 分类、前台样式与编辑器样式。
 *
 * 组件本身只用核心块；视觉全部落在 assets/css/components.css，不注册自定义块。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 注册 pattern 分类。
 *
 * @return void
 */
function yuki_components_register_pattern_category() {
	if ( ! function_exists( 'register_block_pattern_category' ) ) {
		return;
	}

	register_block_pattern_category(
		'yuki-archive',
		array( 'label' => __( 'Yuki 档案组件', 'yuki' ) )
	);
}
add_action( 'init', 'yuki_components_register_pattern_category', 9 );

/**
 * 前台加载组件样式。必须排在 style.css 之后。
 *
 * @return void
 */
function yuki_components_assets() {
	wp_enqueue_style(
		'yuki-components',
		get_template_directory_uri() . '/assets/css/components.css',
		array( 'yuki-style' ),
		yuki_asset_version()
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_components_assets', 20 );

/**
 * 编辑器画布加载同一份组件样式。
 *
 * @return void
 */
function yuki_components_editor_styles() {
	add_editor_style( 'assets/css/components.css' );
}
add_action( 'after_setup_theme', 'yuki_components_editor_styles', 20 );
