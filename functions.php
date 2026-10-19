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
	add_theme_support( 'align-wide' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'style.css' );
	add_theme_support( 'custom-logo', array( 'height' => 48, 'width' => 160, 'flex-height' => true, 'flex-width' => true ) );
	// 不设 default-color：设了之后核心会在没选背景时也输出浅色底，覆盖深色模式。
	add_theme_support( 'custom-background' );
	add_theme_support( 'custom-header', array(
		'width'       => 1600,
		'height'      => 500,
		'flex-height' => true,
		'flex-width'  => true,
		'header-text' => false,
	) );

	register_nav_menus( array(
		'primary' => __( '主导航', 'yuki' ),
	) );

	add_image_size( 'yuki-thumb', 224, 168, true );
}
add_action( 'after_setup_theme', 'yuki_setup' );

/* ---------------------------------------------
 * 资源加载
 * --------------------------------------------- */

/**
 * 静态资源的版本号。
 *
 * 跟着 style.css 的 Version 走：发版时只改一处。所有 enqueue —— 包括 inc/ 里的评论脚本 ——
 * 都必须走这里。曾经有两处写死 '1.0.0'，发版后主资源刷新了、它们仍然是旧的，
 * 老访客会拿旧 JS 打新端点。
 *
 * @return string
 */
function yuki_asset_version() {
	return (string) wp_get_theme()->get( 'Version' );
}

function yuki_assets() {
	$version = yuki_asset_version();

	wp_enqueue_style( 'yuki-style', get_stylesheet_uri(), array(), $version );

	$scrim = yuki_sanitize_background_scrim( (int) get_theme_mod( 'yuki_background_scrim', 80 ) );
	wp_add_inline_style( 'yuki-style', ':root{--yuki-bg-scrim:' . ( $scrim / 100 ) . ';}' );

	$accent = get_theme_mod( 'yuki_accent', '' );
	$accent = $accent ? sanitize_hex_color( $accent ) : '';

	if ( $accent ) {
		wp_add_inline_style(
			'yuki-style',
			':root,.dark{'
			. '--yuki-primary:' . $accent . ';'
			. '--yuki-primary-600:color-mix(in srgb, ' . $accent . ' 82%, #000);'
			. '--yuki-primary-700:color-mix(in srgb, ' . $accent . ' 64%, #000);'
			. '--yuki-primary-foreground:' . yuki_accent_foreground( $accent ) . ';'
			. '--yuki-ring:' . $accent . ';'
			. '}'
		);
	}

	$font_style  = (string) get_theme_mod( 'yuki_font_style', 'sans' );
	$font_stacks = array(
		'serif'   => '"Noto Serif SC", "Songti SC", "SimSun", Georgia, "Times New Roman", serif',
		'rounded' => '"Yuanti SC", "YouYuan", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
	);

	if ( isset( $font_stacks[ $font_style ] ) ) {
		wp_add_inline_style( 'yuki-style', ':root{--yuki-font-sans:' . $font_stacks[ $font_style ] . ';}' );
	}

	wp_enqueue_script( 'yuki-theme-toggle', get_template_directory_uri() . '/assets/js/theme-toggle.js', array(), $version, true );
	wp_enqueue_script( 'yuki-search-overlay', get_template_directory_uri() . '/assets/js/search-overlay.js', array(), $version, true );
	wp_enqueue_script( 'yuki-image-lightbox', get_template_directory_uri() . '/assets/js/image-lightbox.js', array(), $version, true );
	wp_enqueue_script( 'yuki-code-copy', get_template_directory_uri() . '/assets/js/code-copy.js', array(), $version, true );

	wp_localize_script( 'yuki-image-lightbox', 'yukiImageLightbox', array(
		'closeLabel'     => __( '关闭', 'yuki' ),
		'dialogLabel'    => __( '图片查看', 'yuki' ),
		'openLabel'      => __( '查看大图：%s', 'yuki' ),
		'openLabelPlain' => __( '查看大图', 'yuki' ),
	) );

	wp_localize_script( 'yuki-code-copy', 'yukiCodeCopy', array(
		'copyLabel'   => __( '复制代码', 'yuki' ),
		'copiedLabel' => __( '已复制', 'yuki' ),
		'failedLabel' => __( '复制失败', 'yuki' ),
	) );
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
 * 季节点缀色
 * --------------------------------------------- */
/**
 * 按站点时区的月份返回 season-* 类。3–5 春、6–8 夏、9–11 秋、其余冬。
 *
 * @param int $month 1–12；0 表示取当前月份。
 * @return string
 */
function yuki_season_slug( $month = 0 ) {
	$month = $month ? (int) $month : (int) wp_date( 'n' );

	if ( $month >= 3 && $month <= 5 ) {
		return 'season-spring';
	}
	if ( $month >= 6 && $month <= 8 ) {
		return 'season-summer';
	}
	if ( $month >= 9 && $month <= 11 ) {
		return 'season-autumn';
	}

	return 'season-winter';
}

/**
 * 给 body 加一个 season-* 类，供 CSS 只染装饰元素。
 *
 * @param string[] $classes body 类名。
 * @return string[]
 */
function yuki_season_body_class( $classes ) {
	$classes[] = yuki_season_slug();

	return $classes;
}
add_filter( 'body_class', 'yuki_season_body_class' );

/**
 * 有背景图时给 body 加一个类，供蒙层使用。只设背景色时不加，避免把用户选的颜色冲淡。
 *
 * @param string[] $classes body 类名。
 * @return string[]
 */
function yuki_background_body_class( $classes ) {
	if ( get_background_image() ) {
		$classes[] = 'yuki-has-background-image';
	}

	return $classes;
}
add_filter( 'body_class', 'yuki_background_body_class' );

/* ---------------------------------------------
 * 侧边栏
 * --------------------------------------------- */
function yuki_widgets_init() {
	register_sidebar( array(
		'name'          => __( '文章侧边栏', 'yuki' ),
		'id'            => 'sidebar-single',
		'description'   => __( '放任意小工具即接管侧边栏；一个都不放则使用主题内置的默认小工具（作者简介、一言、分类、标签云、热门文章）。', 'yuki' ),
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

	/* ---- 说说 ---- */

	$wp_customize->add_section( 'yuki_shuoshuo', array(
		'title'    => __( 'Yuki 说说设置', 'yuki' ),
		'priority' => 150,
	) );

	$wp_customize->add_setting( 'yuki_shuoshuo_category', array(
		'default'           => 0,
		'sanitize_callback' => 'absint',
	) );

	$wp_customize->add_control( 'yuki_shuoshuo_category', array(
		'label'       => __( '承载说说的分类', 'yuki' ),
		'description' => __( '这个分类里的文章不出现在首页与博客列表，只保留它自己的归档页。选「不使用」则整项功能不生效。', 'yuki' ),
		'section'     => 'yuki_shuoshuo',
		'type'        => 'select',
		'choices'     => yuki_shuoshuo_category_choices(),
	) );

	/* ---- 背景蒙层（挂在核心的「背景图像」一节里） ---- */

	$wp_customize->add_setting( 'yuki_background_scrim', array(
		'default'           => 80,
		'sanitize_callback' => 'yuki_sanitize_background_scrim',
	) );

	$wp_customize->add_control( 'yuki_background_scrim', array(
		'label'       => __( '背景蒙层强度', 'yuki' ),
		'description' => __( '只在设置了背景图时生效；0 最清楚，100 最淡。', 'yuki' ),
		'section'     => 'background_image',
		'type'        => 'range',
		'input_attrs' => array( 'min' => 0, 'max' => 100, 'step' => 5 ),
	) );

	/* ---- 强调色（挂在核心的「颜色」一节里） ---- */

	$wp_customize->add_setting( 'yuki_accent', array(
		'default'           => '#A5B4FC',
		'sanitize_callback' => 'sanitize_hex_color',
	) );

	$wp_customize->add_control( new WP_Customize_Color_Control( $wp_customize, 'yuki_accent', array(
		'label'       => __( '强调色', 'yuki' ),
		'description' => __( '用于链接、按钮、主题开关与选中态；留空使用主题默认的堇紫。', 'yuki' ),
		'section'     => 'colors',
	) ) );

	/* ---- 字体风格 ---- */

	$wp_customize->add_section( 'yuki_typography', array(
		'title'    => __( 'Yuki 字体设置', 'yuki' ),
		'priority' => 154,
	) );

	$wp_customize->add_setting( 'yuki_font_style', array(
		'default'           => 'sans',
		'sanitize_callback' => 'yuki_sanitize_font_style',
	) );

	$wp_customize->add_control( 'yuki_font_style', array(
		'label'       => __( '字体风格', 'yuki' ),
		'description' => __( '正文与标题一起换；代码块仍用等宽字体。', 'yuki' ),
		'section'     => 'yuki_typography',
		'type'        => 'select',
		'choices'     => array(
			'sans'    => __( '无衬线（默认）', 'yuki' ),
			'serif'   => __( '衬线（宋体 / Georgia）', 'yuki' ),
			'rounded' => __( '圆体（幼圆 / 圆体）', 'yuki' ),
		),
	) );
}

/**
 * 背景蒙层强度：整数，夹在 0–100。
 *
 * @param mixed $value 自定义器传上来的值。
 * @return int
 */
function yuki_sanitize_background_scrim( $value ) {
	return max( 0, min( 100, (int) $value ) );
}

/**
 * 字体风格只认三档；其余一律回到无衬线。
 *
 * @param mixed $value 自定义器传上来的值。
 * @return string
 */
function yuki_sanitize_font_style( $value ) {
	return in_array( $value, array( 'sans', 'serif', 'rounded' ), true ) ? $value : 'sans';
}

/**
 * 按强调色的亮度选前景色：浅底配深墨，深底配暖白。
 *
 * @param string $hex 形如 #A5B4FC 的颜色。
 * @return string
 */
function yuki_accent_foreground( $hex ) {
	$hex = ltrim( (string) $hex, '#' );

	if ( 3 === strlen( $hex ) ) {
		$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
	}

	if ( 6 !== strlen( $hex ) ) {
		return '#0F0F14';
	}

	$r    = hexdec( substr( $hex, 0, 2 ) ) / 255;
	$g    = hexdec( substr( $hex, 2, 2 ) ) / 255;
	$b    = hexdec( substr( $hex, 4, 2 ) ) / 255;
	$luma = 0.299 * $r + 0.587 * $g + 0.114 * $b;

	return $luma > 0.6 ? '#0F0F14' : '#F3F0EA';
}

/**
 * 自定义器里那个下拉的选项：分类标识 => 名字。
 *
 * 值是 term_id 而不是 slug——站主改名或换 slug 之后配置必须继续有效（见 ADR 0001）。
 *
 * @return array<int,string>
 */
function yuki_shuoshuo_category_choices() {
	$choices = array( 0 => __( '不使用（关闭说说）', 'yuki' ) );

	$terms = get_terms( array(
		'taxonomy'   => 'category',
		'hide_empty' => false,
	) );

	if ( is_wp_error( $terms ) ) {
		return $choices;
	}

	foreach ( $terms as $term ) {
		$choices[ (int) $term->term_id ] = $term->name;
	}

	return $choices;
}
add_action( 'customize_register', 'yuki_customize_register', 20 );

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

			// 只取 scheme/host/port/path 重新拼，不能用 trailingslashit()：
			// 地址带 query string 时它会把 '/' 拼到 '?' 之后，下面的 /avatar/
			// 判断随之失效，拼出 .../avatar?token=abc/avatar/ 这种废地址。
			// 代价是 query / fragment 会被丢掉——镜像地址必须把哈希拼成路径段，
			// 本来也没有地方安放它们。
			$parts = wp_parse_url( $custom );
			if ( ! is_array( $parts ) || empty( $parts['host'] ) ) {
				return '';
			}

			$path = isset( $parts['path'] ) ? rtrim( $parts['path'], '/' ) : '';
			// 只填域名时补上 /avatar/；已经带了就别重复拼成 /avatar/avatar/
			if ( ! preg_match( '#/avatar$#i', $path ) ) {
				$path .= '/avatar';
			}

			return ( isset( $parts['scheme'] ) ? $parts['scheme'] : 'https' ) . '://'
				. $parts['host']
				. ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' )
				. $path . '/';

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
	// 用 callback 而不是把 $base 直接当替换串：替换串里的 $1 / \1 会被
	// preg_replace 当成反向引用吃掉，地址含 $ 的自定义镜像就会拼出废地址。
	$rewritten = preg_replace_callback(
		'#^https?://(?:[a-z0-9-]+\.)*gravatar\.com/avatar/#i',
		static function () use ( $base ) {
			return $base;
		},
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

	// 正文含非法 UTF-8 时，带 /u 的正则会整体失败：preg_match_all 返回 false、
	// preg_replace 返回 null，两个计数都归零，文章又被算成「1 分钟」。先清洗再数。
	if ( ! mb_check_encoding( $content, 'UTF-8' ) ) {
		$content = mb_convert_encoding( $content, 'UTF-8', 'UTF-8' );
	}

	// 中文（含日韩文字）按字符数计，其余按词数计
	$cjk_pattern = '/\p{Han}|\p{Hiragana}|\p{Katakana}|\p{Hangul}/u';
	$cjk         = (int) preg_match_all( $cjk_pattern, $content );
	$stripped    = preg_replace( $cjk_pattern, ' ', $content );
	$words       = is_string( $stripped ) ? str_word_count( $stripped ) : 0;

	// 中文约 300 字/分钟，英文约 200 词/分钟
	$minutes = max( 1, (int) ceil( $cjk / 300 + $words / 200 ) );

	/* translators: %d: 预计阅读分钟数 */
	return sprintf( __( '%d 分钟阅读', 'yuki' ), $minutes );
}

/* ---------------------------------------------
 * 说说
 *
 * 一篇说说就是一篇普通文章，归入一个由自定义器指定的分类；它不进首页与博客列表，
 * 但保留自己的归档页。为什么不用自定义文章类型，见 docs/adr/0001。
 *
 * 配置存的是**分类标识**而不是名字或 slug：站主改名、换 slug 之后配置得继续有效。
 * 分类被删掉、或者压根没配，整项功能安静地不生效——不报错，也不在页面上留空白。
 * --------------------------------------------- */

/**
 * 当前承载说说的分类标识。没配、或者配的那个分类已经不在了，都返回 0。
 *
 * 让「分类被删了」和「从来没配过」走同一条路：调用方只需要判断 0，
 * 不必各自去处理一个已经不存在的 term。
 *
 * @return int
 */
function yuki_shuoshuo_category_id() {
	$term_id = (int) get_theme_mod( 'yuki_shuoshuo_category', 0 );

	if ( $term_id <= 0 ) {
		return 0;
	}

	$term = get_term( $term_id, 'category' );

	if ( ! $term instanceof WP_Term ) {
		return 0;
	}

	return $term_id;
}

/**
 * 把说说挡在主列表之外。
 *
 * 只动主查询，而且只在博客列表上：说说自己的分类归档要照常列出它们，
 * 标签、日期、别家分类的归档也不该受影响。
 *
 * 用负的 cat 参数去排除，而不是取出来再过滤——这样分页与总数才是对的
 * （第一页补满、总页数相应少一页），翻页时也不会读到一页全是空白。
 *
 * @param WP_Query $query 当前查询。
 */
function yuki_shuoshuo_exclude_from_main_list( $query ) {
	if ( is_admin() || ! $query->is_main_query() || ! $query->is_home() ) {
		return;
	}

	$term_id = yuki_shuoshuo_category_id();

	if ( ! $term_id ) {
		return;
	}

	$query->set( 'cat', '-' . $term_id );
}
add_action( 'pre_get_posts', 'yuki_shuoshuo_exclude_from_main_list' );

/**
 * 兜住置顶文章绕过排除的那个缺口。
 *
 * 负的 cat 参数靠的是 category__not_in，而 WP_Query 处理置顶文章时**只认 post__not_in**
 * （class-wp-query.php:3604）；剩下没被排除掉的置顶文章会被重新查一遍
 * （get_posts( array( 'post__in' => $sticky_posts ) )，那里一个分类条件都没有），
 * 再插到列表最前面。结果就是：一篇被置顶的说说照样出现在首页顶上。
 *
 * 所以在结果出来之后再兜一道。这里**不会**在页面上留空位——那篇文章本来就被主查询
 * 排除了，是置顶逻辑把它又加了回来；去掉它只是把条数恢复成应有的样子。
 *
 * @param array    $posts 查询结果。
 * @param WP_Query $query 当前查询。
 * @return array
 */
function yuki_shuoshuo_drop_from_main_list( $posts, $query ) {
	if ( is_admin() || ! $query instanceof WP_Query || ! $query->is_main_query() || ! $query->is_home() ) {
		return $posts;
	}

	$term_id = yuki_shuoshuo_category_id();

	if ( ! $term_id || ! is_array( $posts ) ) {
		return $posts;
	}

	$kept = array();

	foreach ( $posts as $post ) {
		if ( $post instanceof WP_Post && has_category( $term_id, $post ) ) {
			continue;
		}
		$kept[] = $post;
	}

	return $kept;
}
add_filter( 'the_posts', 'yuki_shuoshuo_drop_from_main_list', 10, 2 );

/**
 * 主题启用时，给说说挑一个承载体。
 *
 * 已经配好而且那个分类还在，就什么都不做——不能每次启用都盖掉站主的选择。
 * 否则退回「未配置」：按默认 slug 找，找不到就建一个。
 *
 * 硬编码的只有这个默认 slug，而且只在「没有可用配置」时用一次；此后一切以配置为准，
 * 所以站主改名、换 slug、删掉重建都不会把功能弄坏。
 */
function yuki_shuoshuo_activate() {
	if ( yuki_shuoshuo_category_id() ) {
		return;
	}

	$term = get_term_by( 'slug', 'shuoshuo', 'category' );

	if ( $term instanceof WP_Term ) {
		$term_id = (int) $term->term_id;
	} else {
		$created = wp_insert_term(
			__( '说说', 'yuki' ),
			'category',
			array(
				'slug'        => 'shuoshuo',
				'description' => __( '短碎片内容。这个分类里的文章不出现在首页与博客列表，只在自己的归档里。', 'yuki' ),
			)
		);

		if ( is_wp_error( $created ) ) {
			return;
		}

		$term_id = (int) $created['term_id'];
	}

	set_theme_mod( 'yuki_shuoshuo_category', $term_id );
}
add_action( 'after_switch_theme', 'yuki_shuoshuo_activate' );

/* ---------------------------------------------
 * 一言
 *
 * 站点上露出一句随机的话。取回在**服务端**做：访客的浏览器不碰第三方，
 * 上游也只会被敲一次（结果缓存一小时）。
 *
 * 这是本主题唯一的**不自足功能**（见 CONTEXT.md）——离开上游就没内容，
 * 所以兜底是必要条件而不是加分项：超时、非 2xx、返回的东西解析不出来，
 * 一律退回主题自带的句子，页面上不会缺一块。
 * --------------------------------------------- */

/**
 * 现在要显示的那句话。先看缓存，没有就取一次。
 *
 * 缓存一小时。**取回失败时把兜底句也缓存起来**（短一些，5 分钟）：不缓存的话，
 * 上游每挂一次、访客每打开一个页面都要等一遍超时——「上游挂了页面也没明显变慢」
 * 就成了空话。冷却期比成功时短得多，为的是上游恢复之后站点能自己回来。
 *
 * @return array{text:string,source:string}
 */
function yuki_hitokoto() {
	$cached = get_transient( 'yuki_hitokoto' );

	if ( is_array( $cached ) && isset( $cached['text'] ) && '' !== $cached['text'] ) {
		return $cached;
	}

	$quote = yuki_hitokoto_fetch();

	if ( '' === $quote['text'] ) {
		$quote = yuki_hitokoto_fallback();
		set_transient( 'yuki_hitokoto', $quote, 5 * MINUTE_IN_SECONDS );

		return $quote;
	}

	set_transient( 'yuki_hitokoto', $quote, HOUR_IN_SECONDS );

	return $quote;
}

/**
 * 向上游要一句。
 *
 * 失败一律返回空 text，不抛错、也不返回 WP_Error：调用方只需要回答「拿到了没有」，
 * 多一种失败形态就多一处要处理的分支，而它们在页面上是同一件事。
 *
 * 超时 2 秒。这一段在页面渲染路径上，不能按 WordPress 默认的 5 秒算——那个数值是
 * 给「后台去取个东西」定的，不是给「访客在等这一页」定的。
 *
 * @return array{text:string,source:string}
 */
function yuki_hitokoto_fetch() {
	$empty = array(
		'text'   => '',
		'source' => '',
	);

	$response = wp_remote_get(
		'https://v1.hitokoto.cn/?encode=json&charset=utf-8',
		array( 'timeout' => 2 )
	);

	if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
		return $empty;
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( ! is_array( $data ) || ! isset( $data['hitokoto'] ) || ! is_string( $data['hitokoto'] ) ) {
		return $empty;
	}

	$text = yuki_hitokoto_clean( $data['hitokoto'] );

	if ( '' === $text ) {
		return $empty;
	}

	return array(
		'text'   => $text,
		// 出处是一言的惯例（各站都带着显示），有就带上；没有就只显示句子
		'source' => isset( $data['from'] ) && is_string( $data['from'] ) ? yuki_hitokoto_clean( $data['from'] ) : '',
	);
}

/**
 * 把上游给的字符串收拾成能显示的一行：控制字符换成空格、掐掉两端空白。
 *
 * **刻意不在这里剥标签。** 转义是输出那一端的事（`sidebar.php` 里的 `esc_html`）。
 * 在入口先剥一道的话，输出处的转义就再也没有东西可验了——两边都做，
 * 事后也分不清起作用的是哪一边。
 *
 * @param string $raw 上游给的原文。
 * @return string
 */
function yuki_hitokoto_clean( $raw ) {
	// 上游理应是 UTF-8（json_decode 不认别的），但带 /u 的正则在非法字节上
	// 会整体返回 null，那就退回原串，别把整句话弄丢
	$text = preg_replace( '/[\x00-\x1F\x7F]+/u', ' ', $raw );

	return trim( is_string( $text ) ? $text : $raw );
}

/**
 * 主题自带的那几句，上游不可用时随机取一句。
 *
 * **不依赖网络**，随主题一起发出去——spec 里「自带兜底」那条就落在这里。
 *
 * 句子是自己写的：现成的一言多半有版权归属，而这段代码要跟着主题分发出去。
 *
 * @return array{text:string,source:string}
 */
function yuki_hitokoto_fallback() {
	$lines = array(
		__( '雪落得很轻，像是怕吵醒这个下午。', 'yuki' ),
		__( '暮色四合的时候，连风都放慢了脚步。', 'yuki' ),
		__( '世界很大，今天先走到这里。', 'yuki' ),
		__( '把心事折成纸飞机，交给明天的风。', 'yuki' ),
		__( '月光落在窗台上，像一句没写完的诗。', 'yuki' ),
		__( '路过人间，顺便看了看花开。', 'yuki' ),
		__( '安静下来，连呼吸都像在念一首诗。', 'yuki' ),
	);

	return array(
		'text'   => $lines[ array_rand( $lines ) ],
		'source' => '',
	);
}

/* ---------------------------------------------
 * 评论表单样式类
 * --------------------------------------------- */
function yuki_comment_form_defaults( $defaults ) {
	$defaults['class_submit'] = 'yuki-btn';
	return $defaults;
}
add_filter( 'comment_form_defaults', 'yuki_comment_form_defaults' );

/* ---------------------------------------------
 * 评论增强 · 防垃圾
 *
 * 表单里放两样对访客无感的东西：一个蜜罐字段、一个带本站签名的提交时间戳。
 * 判定发生在评论入库之前——pre_comment_approved 返回 WP_Error 会让
 * wp_new_comment() 就此短路（wp-includes/comment.php 里 wp_check_comment_data()
 * 的文档写明了这一点），而 wp-comments-post.php 对不带 data 的 WP_Error
 * 走 `exit;` 分支：不入库，也不回任何内容。
 * --------------------------------------------- */

/**
 * 蜜罐字段名。刻意不带 name / email / url 这类自动填充词汇，免得被密码管理器顺手填上。
 *
 * @return string
 */
function yuki_comment_trap_field() {
	return 'yuki_comment_note';
}

/**
 * 时间戳令牌字段名。
 *
 * @return string
 */
function yuki_comment_token_field() {
	return 'yuki_comment_token';
}

/**
 * 给提交时刻签名。
 *
 * 用站点 salt 签名，别的站签不出、也就伪造不了。
 *
 * @param int|string $issued 提交时刻（Unix 时间戳）。
 * @return string|false
 */
function yuki_comment_token_sign( $issued ) {
	return hash_hmac( 'sha256', 'yuki-comment|' . $issued, wp_salt( 'nonce' ) );
}

/**
 * 签发令牌：提交时刻 + 签名。
 *
 * 下限 3 秒：挡「页面刚出来就提交」。
 * 上界一周：站点可能开着页面缓存，访客拿到的令牌是缓存那次渲染签的，签发时间早于
 * 他真正打开页面的时间——所以上界不能小，否则会把缓存命中的访客全拦掉。但也不能
 * 没有：没有上界时，抓到一个令牌就能**永久**重放，只受核心 comment_flood 的 15 秒
 * 间隔约束。一周对任何现实的缓存 TTL 都绰绰有余，又让被抓走的令牌会自己过期。
 *
 * @return string 形如 1750000000|a1b2… 的令牌。
 */
function yuki_comment_token() {
	$issued = time();

	return $issued . '|' . yuki_comment_token_sign( $issued );
}

/**
 * 令牌的判定，分三档。
 *
 * 这三档不是一回事，挡下之后该说的话也不一样：
 *
 *   - `missing`  格式不对、签名对不上、或者压根没带——**这不是一笔本表单交上来的提交**。
 *                与填了蜜罐同一类：确定性的信号，什么也不用说。
 *   - `too_fast` 令牌是真的（签名对得上，确实是本站在页面里签的），只是**页面刚渲染出来
 *                就提交了**。这只是个怀疑，而付代价的可能是手快的人：他粘好一段话、两秒内
 *                就点了提交。对这一种要说一句话，而且那句话得能照做。
 *   - `ok`       两样都过。
 *
 * 签名对得上才是关键分界：它证明这一笔确实是从本站渲染的表单里出来的。签不出一个
 * 以假乱真的令牌，所以「签名不对」只能是伪装或者手编的。
 *
 * @param mixed $token 表单提交上来的令牌。
 * @return string 'missing' | 'too_fast' | 'ok'
 */
function yuki_comment_token_verdict( $token ) {
	if ( ! is_string( $token ) ) {
		return 'missing';
	}

	$parts = explode( '|', $token );
	if ( 2 !== count( $parts ) || ! ctype_digit( $parts[0] ) ) {
		return 'missing';
	}

	if ( ! hash_equals( yuki_comment_token_sign( $parts[0] ), $parts[1] ) ) {
		return 'missing';
	}

	// 签是真的，再看时间窗：太旧与太快都不是正常访客
	$age = time() - (int) $parts[0];

	// 太旧、或时间戳在未来（时钟回拨）：与「签名不对」同类，确定性的机器人信号
	if ( $age < 0 || $age > WEEK_IN_SECONDS ) {
		return 'missing';
	}

	// 页面渲染到提交短于 3 秒：签是真的，只是太快
	return $age >= 3 ? 'ok' : 'too_fast';
}

/**
 * 表单里的蜜罐与令牌。
 *
 * 挂在 comment_form 上，而不是 comment_form_after_fields：后者要等字段循环跑到最后一个
 * 字段才触发，插件把 fields 清空时它就不触发了，那种站上所有访客都会因为「没带令牌」被拦掉。
 */
function yuki_comment_form_fields() {
	?>
	<p class="yuki-comment-trap" aria-hidden="true">
		<label for="<?php echo esc_attr( yuki_comment_trap_field() ); ?>"><?php esc_html_e( '这一栏请保持空白', 'yuki' ); ?></label>
		<input type="text" name="<?php echo esc_attr( yuki_comment_trap_field() ); ?>" id="<?php echo esc_attr( yuki_comment_trap_field() ); ?>" value="" tabindex="-1" autocomplete="off" />
	</p>
	<input type="hidden" name="<?php echo esc_attr( yuki_comment_token_field() ); ?>" value="<?php echo esc_attr( yuki_comment_token() ); ?>" />
	<?php
}
add_action( 'comment_form', 'yuki_comment_form_fields' );

/**
 * 判定并挡在入库之前。
 *
 * 挡下有两种说法，**不能混成一个出口**：
 *
 *   - **确定性的机器人信号**（填了蜜罐、令牌不是本站签的、压根没带）：静默丢弃，
 *     什么也不告诉它。错误里既不带话也不带 data——原生入口那边看到不带 data 的
 *     WP_Error 就走 `exit;`，回的是一片空白（wp-comments-post.php）。
 *   - **只是怀疑：提交得太快**。付代价的可能是手快的人（粘好一段话、两秒内点了提交），
 *     所以给一句能照做的话。它带着状态码，于是原生入口会走 `wp_die` 把这句话显示出来，
 *     而不是一片空白；端点那边把它当普通错误回话，脚本把话放到页面上。
 *
 * 两种都发生在**入库之前**：垃圾不落库，也不进待审队列。
 *
 * 只判定「访客在评论表单里交上来的」那一种——这个范围由 yuki_comment_is_form_post()
 * 划，端点（inc/comment-submit.php）那条路也在里面。蜜罐和令牌是一套表单协议，
 * 没渲染过评论表单的调用路径手上不该有它，也谈不上遵守它——按机器人处理只会把别处
 * 正常入库的评论静默吞掉。这些路径上核心自己的审核、黑名单与频率限制照旧生效。
 *
 * 这里不校 nonce：WordPress 的评论表单本来就不带 nonce（wp-comments-post.php 不校），
 * 硬加一个会让所有访客提交失败。取到的值一律先 wp_unslash，再按格式校验。
 *
 * @param int|string $approved 原本的审批状态。
 * @return int|string|WP_Error 判定为机器人时返回不带 data 的 WP_Error；太快时返回带状态码与一句话的。
 */
function yuki_comment_guard( $approved ) {
	if ( ! yuki_comment_is_form_post() || is_user_logged_in() ) {
		return $approved;
	}

	// 表单永远只会交上一个字符串；交来数组或别的东西本身就说明不是正常访客
	$trap = $_POST[ yuki_comment_trap_field() ] ?? '';
	if ( ! is_string( $trap ) || '' !== trim( wp_unslash( $trap ) ) ) {
		return new WP_Error( 'yuki_comment_spam' );
	}

	$token   = isset( $_POST[ yuki_comment_token_field() ] ) ? wp_unslash( $_POST[ yuki_comment_token_field() ] ) : '';
	$verdict = yuki_comment_token_verdict( $token );

	/*
	 * 令牌是真的，只是页面刚渲染出来就提交了。
	 *
	 * 第三个参数是**整数状态码**，不是数组：原生入口那边 `wp-comments-post.php` 读的是
	 * `(int) $comment->get_error_data()`，给数组会被它用成 1。核心自己那几条也这么传
	 * （`new WP_Error( 'comment_flood', …, 429 )`、`new WP_Error( 'comment_closed', …, 403 )`）。
	 *
	 * 状态码用 429 而不是 403：403 是「不许」，而这里只是「太快」——核心自己的
	 * 频率判定（`comment_flood`）用的也是 429。
	 *
	 * 文案的尺度：说得清「再点一次」，但**不透露那个窗口**——告诉人「等三秒」等于把
	 * 规则抄给写脚本的人看。
	 */
	if ( 'too_fast' === $verdict ) {
		return new WP_Error(
			'yuki_comment_too_fast',
			__( '提交得有点快，这条没能收下——再点一次提交就好。', 'yuki' ),
			429
		);
	}

	/*
	 * 剩下的**只有 `ok` 才放行**。这里刻意不写「`missing` 就挡、其余放行」：那样将来
	 * 多出第四档时，没人改这里，它就会悄悄放行——这道门是该**失败时关着**的那一种。
	 */
	if ( 'ok' !== $verdict ) {
		return new WP_Error( 'yuki_comment_spam' );
	}

	return $approved;
}
add_filter( 'pre_comment_approved', 'yuki_comment_guard' );

/**
 * 这次请求是不是「访客在评论表单里交上来的那一笔」。
 *
 * 原生入口是一次非 REST 的 POST；端点（inc/comment-submit.php）是**同一笔提交**，
 * 只是走了 REST 那道门，所以它进处理前会先亮明身份。
 *
 * 为什么非要有这枚标记：守卫本来放过所有 REST 请求（别的 REST 调用手上不该有蜜罐与
 * 令牌），而端点的回调里 REST_REQUEST **是定义着的**（wp-includes/rest-api.php:478，
 * rest_api_loaded() 定义完就往下分发）——不亮明身份，端点上填了蜜罐也照收，
 * 防垃圾在端点上就等于没有。
 *
 * @return bool
 */
function yuki_comment_is_form_post() {
	if ( yuki_comment_form_post_flag() ) {
		return true;
	}

	/*
	 * 再要求 comment_post_ID：评论表单一定带它（核心的 wp-comments-post.php 就靠它找文章），
	 * 而别的插件在 POST 里自己调 wp_new_comment() 时通常没有。少了这一条，那些调用会被
	 * 当成「没带蜜罐与令牌」的机器人提交，静默吞掉。
	 *
	 * 只管这个兜底分支：端点那条路在上面 yuki_comment_form_post_flag() 就短路返回了。
	 */
	return 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' )
		&& isset( $_POST['comment_post_ID'] )
		&& ! defined( 'XMLRPC_REQUEST' )
		&& ! defined( 'REST_REQUEST' )
		&& ! wp_doing_cron();
}

/**
 * 端点进处理前调一次：声明「这一笔就是评论表单的那笔提交」。
 */
function yuki_comment_form_post_declare() {
	yuki_comment_form_post_flag( true );
}

/**
 * 那枚标记本身。传 $set 即改写，不传就是读。
 *
 * 静态，只活在这一次请求里——它描述的就是「这次请求现在在干什么」。
 *
 * @param bool|null $set 要设成的值；null 表示只读。
 * @return bool
 */
function yuki_comment_form_post_flag( $set = null ) {
	static $declared = false;

	if ( null !== $set ) {
		$declared = (bool) $set;
	}

	return $declared;
}

/* ---------------------------------------------
 * 评论增强 · 层级与呈现
 *
 * 回复最多显示两层：更深的回复不继续缩进，而是压到第二层，并标出它真正回的是谁（见
 * template-parts/comment.php）。数据库里的父子关系一个字节都不动——压的只是显示用的那份数组。
 * --------------------------------------------- */

/**
 * 取「这条评论真正回的是谁」那张映射（按引用）。压平时往里写，渲染时从里读。
 *
 * 函数静态，只活在这一次请求里——它本来就是一次渲染的中间产物，没必要落库或跨请求。
 *
 * @return array 评论 id => 真父评论 id。
 */
function &yuki_comment_reply_targets() {
	static $targets = array();

	return $targets;
}

/**
 * 记下：这条评论（显示层级里被压平的那条）真正回的是哪条。
 *
 * @param int $comment_id  评论 id。
 * @param int $real_parent 它真正的父评论 id。
 */
function yuki_comment_set_reply_target( $comment_id, $real_parent ) {
	$targets = &yuki_comment_reply_targets();

	$targets[ (int) $comment_id ] = (int) $real_parent;
}

/**
 * 读出：这条评论真正回的是哪条。没记过（没被压平）返回 0。
 *
 * @param int $comment_id 评论 id。
 * @return int
 */
function yuki_comment_get_reply_target( $comment_id ) {
	$targets = yuki_comment_reply_targets();

	return isset( $targets[ (int) $comment_id ] ) ? $targets[ (int) $comment_id ] : 0;
}

/**
 * 把深于两层的回复压到第二层。
 *
 * 核心自己也有「到顶平铺」：`Walker_Comment::display_element()` 在到达 max_depth 时，会把那个元素的
 * 子回复就地铺在当前层（不让它们被甩到列表末尾）。所以把 max_depth 设成 2 同样能得到「一层 children、
 * 全部 depth-2」。可它同时也把这个 2 交给了 `comment_reply_link()`——第二层的评论因此没有回复入口，
 * 讨论到第二层就断了。
 *
 * 这里换一种做法：不动 max_depth（站点设置的五层照旧），只改**显示用的那棵树**。深于两层的评论
 * 改挂到它的顶层祖先下，于是渲染在第二层；第二层仍能回复，新回复同样铺在第二层，靠「回复 @谁」
 * 标出它真正回的那条。顺序也保住了——按时间排，而不是按父评论分组。
 *
 * 改的是 clone，不是缓存里的那个对象：WP_Comment 是全局评论缓存里的实例，就地改 comment_parent
 * 会连累同一次请求里别的消费者（小工具、feed、另一个 wp_list_comments）。
 *
 * 父评论不在本页时（父评论被删、或列表被别的东西截断）不动它，交给核心照原样处理，与改动前一致。
 *
 * @param mixed $comments 当前页的评论。
 * @return mixed 压平之后的评论。
 */
function yuki_comment_flatten( $comments ) {
	if ( ! is_array( $comments ) || ! get_option( 'thread_comments' ) ) {
		return $comments;
	}

	$by_id = array();
	foreach ( $comments as $comment ) {
		$by_id[ (int) $comment->comment_ID ] = $comment;
	}

	$out = array();

	foreach ( $comments as $comment ) {
		$id      = (int) $comment->comment_ID;
		$depth   = 1;
		$top_id  = $id;
		$current = $comment;
		$seen    = array( $id => true );

		// 往上数到自己那一层的顶层祖先为止。$seen 兜住坏数据里的自环与互环。
		while ( $current->comment_parent
			&& isset( $by_id[ (int) $current->comment_parent ] )
			&& ! isset( $seen[ (int) $current->comment_parent ] ) ) {
			$parent_id          = (int) $current->comment_parent;
			$seen[ $parent_id ] = true;
			$current            = $by_id[ $parent_id ];
			$top_id             = $parent_id;
			$depth++;
		}

		$true_parent    = (int) $comment->comment_parent;
		$display_parent = yuki_comment_display_parent( $depth, $top_id, $true_parent );

		// 该挂到别处去：记下它真正回的是谁，再把它挂到该去的地方
		if ( $display_parent !== $true_parent ) {
			yuki_comment_set_reply_target( $id, $true_parent );

			$flattened                 = clone $comment;
			$flattened->comment_parent = (string) $display_parent;
			$out[]                     = $flattened;
			continue;
		}

		$out[] = $comment;
	}

	return $out;
}
add_filter( 'comments_array', 'yuki_comment_flatten' );

/**
 * 这条评论（按显示层级）回的是谁的名字。顶层评论返回空串。
 *
 * @param WP_Comment $comment 评论。
 * @return string
 */
function yuki_comment_reply_to( $comment ) {
	$parent_id = yuki_comment_get_reply_target( (int) $comment->comment_ID );

	if ( ! $parent_id ) {
		$parent_id = (int) $comment->comment_parent;
	}

	if ( ! $parent_id ) {
		return '';
	}

	$parent = get_comment( $parent_id );

	return $parent ? $parent->comment_author : '';
}

/**
 * wp_list_comments() 的 callback：渲染单条评论。
 *
 * 印记在 template-parts/comment.php 里，那里同时写着几处不能改的 id 与类。
 *
 * @param WP_Comment $comment 评论。
 * @param array      $args    wp_list_comments() 的参数。
 * @param int        $depth   层级（顶层是 1）。
 */
function yuki_comment_template( $comment, $args, $depth ) {
	get_template_part( 'template-parts/comment', null, array(
		'comment'   => $comment,
		'list_args' => $args,
		'depth'     => $depth,
	) );
}

/**
 * 评论列表的渲染参数。
 *
 * 列表（comments.php）与端点各取一次，但只有**一份定义**。两边各写一套的话，
 * 新插进去的那一条与列表里其它评论迟早会长得不一样，而单独看哪一边都正常。
 *
 * @return array
 */
function yuki_comment_list_args() {
	return array(
		'style'       => 'ul',
		'avatar_size' => 40,
		// 自己渲染每条评论：层级压平之后还要标出「回复 @谁」，核心的印记里没有这个位置
		'callback'    => 'yuki_comment_template',
		// 回复的层数上限。列表走 wp_list_comments() 时这一步由它自己填；端点那边不走它
		// （只渲染一条，见 inc/comment-submit.php），所以这里写明白——两边必须同值，
		// 否则「这条还能不能回」在两条路上会不一样。
		'max_depth'   => get_option( 'thread_comments' ) ? (int) get_option( 'thread_comments_depth' ) : -1,
	);
}

/**
 * 一条评论在**显示层级**里挂在谁下面。
 *
 * 「深于两层的回复压到第二层」这条规则就写在这一处，两个调用点都从这儿取：
 *   - 列表渲染：那份压平（yuki_comment_flatten()），它按**当前这一页**的评论算出来的
 *     层级喂进来；
 *   - 端点：新交上来的那条回复该挂到谁下面（它手上只有数据库那一支，没有「页」）。
 *
 * @param int $depth       它真实的层级（顶层是 1）。
 * @param int $top_id      它那一支的顶层祖先。
 * @param int $true_parent 它真正回的那条。
 * @return int 显示时的父评论 id；0 表示显示在最外面那一层。
 */
function yuki_comment_display_parent( $depth, $top_id, $true_parent ) {
	if ( $depth > 2 ) {
		return (int) $top_id;
	}

	return (int) $true_parent;
}

/**
 * 这位访客在这篇文章上有几条评论还在等审核。
 *
 * 「哪些待审评论能被这位访客看见」由核心决定——comments_template() 会把
 * wp_get_unapproved_comment_author_email() 的结果塞进 include_unapproved，
 * 而那个函数在没有跳转参数时会退回读评论者 cookie
 * （wp-includes/comment.php:2112-2114，那一步取的是 wp_get_current_commenter()）。
 * 这里数的是同一批人里还没通过的那几条，提示与列表因此说的是同一件事。
 *
 * 数的是**整篇文章**上的条数，不是某一页上的：列表分页时提示会说到「总共有几条」，
 * 它不承诺这些评论都在这一屏上。
 *
 * 代价是每次渲染文章页、并且这位访客带着评论者 cookie 时，多一次查询。只有带身份的
 * 访客才走得到这里，而且查的是这篇文章上「还没通过」的那几条——绝大多数页面上是空的。
 *
 * @param int    $post_id 文章 id。
 * @param string $email   访客身份；空串表示没有身份，没有身份就一条也不属于他。
 * @return int
 */
function yuki_comment_pending_count( $post_id, $email ) {
	$email   = strtolower( (string) $email );
	$post_id = (int) $post_id;

	if ( '' === $email || ! $post_id ) {
		return 0;
	}

	// 取回来在 PHP 里比，不用 get_comments 的 author_email 参数：那是一次 SQL 相等比较，
	// 而本地的 SQLite 上它区分大小写，邮箱大小写差一点就数不出来了。
	$pending = get_comments( array(
		'post_id' => $post_id,
		'status'  => 'hold',
	) );

	$count = 0;

	foreach ( $pending as $comment ) {
		if ( strtolower( (string) $comment->comment_author_email ) === $email ) {
			$count++;
		}
	}

	return $count;
}

/**
 * 当前这位访客的身份（评论者 cookie，或者一次性跳转参数里那个邮箱）。
 *
 * 登录用户返回空串：提示是给访客看的，而核心对他们另有一套——include_unapproved
 * 里放的是用户 id，不按邮箱认（comments_template() 里那两行）。
 *
 * @return string
 */
function yuki_comment_viewer_email() {
	if ( is_user_logged_in() ) {
		return '';
	}

	return strtolower( (string) wp_get_unapproved_comment_author_email() );
}

/**
 * 列表上方那句待审提示。条数为 0 时返回空串——页面上就不该出现这句话。
 *
 * 列表与端点共用这一份：端点插完一条待审评论之后要就地把这句话换掉，两边各写一句的话，
 * 措辞迟早会不一样，而两边看起来都对。
 *
 * @param int $count 这位访客的待审条数。
 * @return string
 */
function yuki_comment_pending_notice_html( $count ) {
	$count = (int) $count;

	if ( $count <= 0 ) {
		return '';
	}

	$text = sprintf(
		/* translators: %s: 等待审核的评论条数（已按本地习惯分组，例如 1,234） */
		__( '你有 %s 条评论正在等待审核，通过之后才会公开显示。', 'yuki' ),
		number_format_i18n( $count )
	);

	return '<p class="yuki-pending-notice">' . esc_html( $text ) . '</p>';
}

/**
 * 评论列表的标题（「评论（3）」）。
 *
 * 数的是**已经公开**的条数（核心的 comment_count），待审的不算——与没脚本那条路
 * 渲染出来的完全一致。那枚类名是给脚本认的：提交成功之后就地换成服务端算好的这一份，
 * 免得出现「标题说 0 条、列表里却有一条」这种自相矛盾。
 *
 * @param int $post_id 文章 id。
 * @return string
 */
function yuki_comment_count_heading_html( $post_id ) {
	$text = sprintf(
		/* translators: %s: comment count */
		__( '评论（%s）', 'yuki' ),
		number_format_i18n( get_comments_number( $post_id ) )
	);

	return '<h3 class="yuki-comment-count">' . esc_html( $text ) . '</h3>';
}

/* ---------------------------------------------
 * 独立的功能模块
 *
 * 逐个显式 require，而不是 glob 扫 inc/ 目录：加载了哪些文件一眼看得见，
 * 加一个文件也要有人手动写一行——不会因为往目录里放了点什么就悄悄多出一堆行为。
 * --------------------------------------------- */
require_once get_template_directory() . '/inc/comment-deletion.php';
require_once get_template_directory() . '/inc/comment-likes.php';
require_once get_template_directory() . '/inc/comment-submit.php';
require_once get_template_directory() . '/inc/related-posts.php';
require_once get_template_directory() . '/inc/shuoshuo-composer.php';
