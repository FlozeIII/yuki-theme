<?php
/**
 * Yuki Theme functions
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ---------------------------------------------
 * 主题基础设置
 * --------------------------------------------- */
function yuki_setup() {
	load_theme_textdomain( 'yuki' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'custom-logo', array( 'height' => 48, 'width' => 160, 'flex-height' => true, 'flex-width' => true ) );

	register_nav_menus( array(
		'primary' => __( '主导航', 'yuki' ),
	) );

	add_image_size( 'yuki-thumb', 224, 168, true );
}
add_action( 'after_setup_theme', 'yuki_setup' );

/* ---------------------------------------------
 * 资源加载
 * --------------------------------------------- */
function yuki_assets() {
	wp_enqueue_style( 'yuki-style', get_stylesheet_uri(), array(), '1.0.0' );

	wp_enqueue_script( 'yuki-theme-toggle', get_template_directory_uri() . '/assets/js/theme-toggle.js', array(), '1.0.0', true );
}
add_action( 'wp_enqueue_scripts', 'yuki_assets' );

/**
 * 头部早期主题初始化（避免深色模式闪烁）
 */
function yuki_early_theme_script() {
	?>
	<script>
	(function () {
		try { var t = localStorage.getItem('theme'); } catch (e) { var t = null; }
		var dark = t === 'dark' || (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', dark);
		document.documentElement.classList.toggle('light', !dark);
	})();
	</script>
	<?php
}
add_action( 'wp_head', 'yuki_early_theme_script', 1 );

/* ---------------------------------------------
 * 侧边栏
 * --------------------------------------------- */
function yuki_widgets_init() {
	register_sidebar( array(
		'name'          => __( '文章侧边栏', 'yuki' ),
		'id'            => 'sidebar-single',
		'before_widget' => '<div id="%1$s" class="yuki-widget widget %2$s">',
		'after_widget'  => '</div>',
		'before_title'  => '<h3>',
		'after_title'   => '</h3>',
	) );
}
add_action( 'widgets_init', 'yuki_widgets_init' );

/* ---------------------------------------------
 * 自定义izer：备案号设置
 * --------------------------------------------- */
function yuki_customize_register( $wp_customize ) {
	$wp_customize->add_section( 'yuki_footer', array(
		'title'    => __( 'Yuki 页脚设置', 'yuki' ),
		'priority' => 160,
	) );

	$wp_customize->add_setting( 'yuki_icp_number', array(
		'default'           => '',
		'sanitize_callback' => 'sanitize_text_field',
	) );

	$wp_customize->add_control( 'yuki_icp_number', array(
		'label'       => __( 'ICP 备案号', 'yuki' ),
		'description' => __( '例如：京ICP备2026XXXXXX号，显示在页脚备案区', 'yuki' ),
		'section'     => 'yuki_footer',
		'type'        => 'text',
	) );

	$wp_customize->add_setting( 'yuki_gongan_number', array(
		'default'           => '',
		'sanitize_callback' => 'sanitize_text_field',
	) );

	$wp_customize->add_control( 'yuki_gongan_number', array(
		'label'       => __( '公安备案号', 'yuki' ),
		'description' => __( '例如：京公网安备 110XXXXXXXXX号（可选）', 'yuki' ),
		'section'     => 'yuki_footer',
		'type'        => 'text',
	) );
}
add_action( 'customize_register', 'yuki_customize_register' );

/* ---------------------------------------------
 * 摘要与阅读时间
 * --------------------------------------------- */
function yuki_excerpt_length() {
	return 32;
}
add_filter( 'excerpt_length', 'yuki_excerpt_length' );

function yuki_excerpt_more() {
	return '…';
}
add_filter( 'excerpt_more', 'yuki_excerpt_more' );

function yuki_reading_time( $post_id = null ) {
	$post_id = $post_id ? $post_id : get_the_ID();
	$content = wp_strip_all_tags( get_post_field( 'post_content', $post_id ) );

	// 中文（含日韩文字）按字符数计，其余按词数计
	$cjk_pattern = '/\p{Han}|\p{Hiragana}|\p{Katakana}|\p{Hangul}/u';
	$cjk         = (int) preg_match_all( $cjk_pattern, $content );
	$words       = str_word_count( preg_replace( $cjk_pattern, ' ', $content ) );

	// 中文约 300 字/分钟，英文约 200 词/分钟
	$minutes = max( 1, (int) ceil( $cjk / 300 + $words / 200 ) );

	/* translators: %d: 预计阅读分钟数 */
	return sprintf( __( '%d 分钟阅读', 'yuki' ), $minutes );
}

/* ---------------------------------------------
 * 评论表单样式类
 * --------------------------------------------- */
function yuki_comment_form_defaults( $defaults ) {
	$defaults['class_submit'] = 'yuki-btn';
	return $defaults;
}
add_filter( 'comment_form_defaults', 'yuki_comment_form_defaults' );
