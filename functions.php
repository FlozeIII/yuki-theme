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
	wp_enqueue_script( 'yuki-search-overlay', get_template_directory_uri() . '/assets/js/search-overlay.js', array(), '1.0.0', true );
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
		'description'   => __( '放任意小工具即接管侧边栏；一个都不放则使用主题内置的默认小工具（作者简介、分类、标签云、热门文章）。', 'yuki' ),
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

	/* ---- 头像源 ---- */

	$wp_customize->add_section( 'yuki_avatar', array(
		'title'    => __( 'Yuki 头像设置', 'yuki' ),
		'priority' => 155,
	) );

	$wp_customize->add_setting( 'yuki_avatar_source', array(
		'default'           => 'gravatar',
		'sanitize_callback' => 'sanitize_key',
	) );

	$wp_customize->add_control( 'yuki_avatar_source', array(
		'label'       => __( '头像来源', 'yuki' ),
		'description' => __( 'Gravatar 在境内访问不了，国内主机建议选 Cravatar 或自填镜像。', 'yuki' ),
		'section'     => 'yuki_avatar',
		'type'        => 'select',
		'choices'     => array(
			'gravatar' => __( 'Gravatar（默认，境内不可用）', 'yuki' ),
			'cravatar' => __( 'Cravatar（境内镜像）', 'yuki' ),
			'custom'   => __( '自定义镜像', 'yuki' ),
		),
	) );

	$wp_customize->add_setting( 'yuki_avatar_custom_url', array(
		'default'           => '',
		'sanitize_callback' => 'esc_url_raw',
	) );

	$wp_customize->add_control( 'yuki_avatar_custom_url', array(
		'label'       => __( '自定义镜像地址', 'yuki' ),
		'description' => __( '镜像站点地址，例如 https://mirror.example.cn，会拼成 地址/avatar/哈希；直接粘贴含 /avatar/ 的完整前缀也可以。仅在上一项选「自定义镜像」时生效。', 'yuki' ),
		'section'     => 'yuki_avatar',
		'type'        => 'url',
	) );
}
add_action( 'customize_register', 'yuki_customize_register' );

/* ---------------------------------------------
 * 头像源
 *
 * Gravatar 的 secure.gravatar.com 在国内既连不上、也慢，而主机在境内时
 * 服务端同样连不上，所以站内代理没有意义——直接把域名换成境内可达的镜像。
 * 过滤 get_avatar_url 即可覆盖 get_avatar() 与 get_avatar_data() 的全部调用。
 * --------------------------------------------- */

/**
 * 当前配置的镜像前缀。返回空字符串表示不改写，走 WordPress 原本的 Gravatar 地址。
 *
 * @return string 形如 https://cravatar.cn/avatar/ 的前缀。
 */
function yuki_avatar_mirror_base() {
	switch ( get_theme_mod( 'yuki_avatar_source', 'gravatar' ) ) {
		case 'cravatar':
			return 'https://cravatar.cn/avatar/';

		case 'custom':
			$custom = trim( (string) get_theme_mod( 'yuki_avatar_custom_url', '' ) );
			if ( '' === $custom ) {
				return '';
			}
			$custom = trailingslashit( $custom );
			// 只填域名时补上 /avatar/；已经带了就别重复拼成 /avatar/avatar/
			if ( ! preg_match( '#/avatar/$#i', $custom ) ) {
				$custom .= 'avatar/';
			}
			return $custom;

		default:
			return '';
	}
}

/**
 * 把 Gravatar 域名改写成镜像域名，hash 与查询参数原样保留。
 *
 * @param string $url          get_avatar_url() 产出的地址。
 * @param mixed  $id_or_email  用户标识，本函数用不到。
 * @param array  $args         头像参数，本函数用不到。
 * @return string
 */
function yuki_avatar_url( $url, $id_or_email, $args ) {
	$base = yuki_avatar_mirror_base();

	if ( '' === $base ) {
		return $url;
	}

	// 原地址形如：
	//   https://secure.gravatar.com/avatar/<hash>?s=96&d=mm&r=g
	//   https://0.gravatar.com/avatar/<hash>
	// 只换 host + /avatar/ 这一段。
	$rewritten = preg_replace(
		'#^https?://(?:[a-z0-9-]+\.)*gravatar\.com/avatar/#i',
		$base,
		$url
	);

	return $rewritten ? $rewritten : $url;
}
add_filter( 'get_avatar_url', 'yuki_avatar_url', 10, 3 );

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
