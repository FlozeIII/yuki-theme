<?php
/**
 * 站点模块：数据条、标签墙、作者卡、订阅卡、页脚链接组。
 *
 * 页面结构交给 template-parts，样式与渐进增强各自独立；
 * 不改正文宽度与外壳策略。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 注册页脚菜单位。菜单为空时由 site-footer-links 输出兜底分组。
 *
 * @return void
 */
function yuki_site_modules_setup() {
	register_nav_menus( array(
		'footer' => __( '页脚链接组', 'yuki' ),
	) );
}
add_action( 'after_setup_theme', 'yuki_site_modules_setup', 20 );

/**
 * 前台加载站点模块样式与标签墙脚本。
 *
 * @return void
 */
function yuki_site_modules_assets() {
	$version = yuki_asset_version();

	wp_enqueue_style(
		'yuki-site-modules',
		get_template_directory_uri() . '/assets/css/site-modules.css',
		array( 'yuki-components' ),
		$version
	);

	wp_enqueue_script(
		'yuki-site-modules',
		get_template_directory_uri() . '/assets/js/site-modules.js',
		array(),
		$version,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_site_modules_assets', 21 );
