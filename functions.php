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
 * 只设下限不设上界：站点可能开着页面缓存，访客拿到的令牌是缓存那次渲染签的，
 * 签发时间早于他真正打开页面的时间，加上界会把缓存命中的访客全拦掉。
 * 代价是同一个令牌可以反复用——它挡的是「随手填一个值」和「页面刚出来就提交」，
 * 一个肯自己取页面、肯等三秒的脚本本来就挡不住，那种交给审核队列和黑名单。
 *
 * @return string 形如 1750000000|a1b2… 的令牌。
 */
function yuki_comment_token() {
	$issued = time();

	return $issued . '|' . yuki_comment_token_sign( $issued );
}

/**
 * 令牌是否可信：格式对、签名对，而且已经放过判定窗口。
 *
 * @param mixed $token 表单提交上来的令牌。
 * @return bool
 */
function yuki_comment_token_is_valid( $token ) {
	if ( ! is_string( $token ) ) {
		return false;
	}

	$parts = explode( '|', $token );
	if ( 2 !== count( $parts ) || ! ctype_digit( $parts[0] ) ) {
		return false;
	}

	if ( ! hash_equals( yuki_comment_token_sign( $parts[0] ), $parts[1] ) ) {
		return false;
	}

	// 从表单渲染到提交短于 3 秒的，视作机器人
	return ( time() - (int) $parts[0] ) >= 3;
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
 * 判定并挡在入库之前：填了蜜罐、令牌不对、或者页面刚渲染出来就提交的，一律按垃圾处理。
 *
 * 只判定「访客在评论表单里交上来的」那一种：蜜罐和令牌是一套表单协议，
 * 没渲染过评论表单的调用路径（REST、XML-RPC、定时任务、命令行、导入脚本）手上
 * 不该有令牌，也谈不上遵守它——按机器人处理只会把别处正常入库的评论静默吞掉。
 * 这些路径上核心自己的审核、黑名单与频率限制照旧生效。
 *
 * 这里不校 nonce：WordPress 的评论表单本来就不带 nonce（wp-comments-post.php 不校），
 * 硬加一个会让所有访客提交失败。取到的值一律先 wp_unslash，再按格式校验。
 *
 * @param int|string $approved 原本的审批状态。
 * @return int|string|WP_Error 判定为机器人时返回不带 data 的 WP_Error。
 */
function yuki_comment_guard( $approved ) {
	$is_form_post = 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' )
		&& ! defined( 'XMLRPC_REQUEST' )
		&& ! defined( 'REST_REQUEST' )
		&& ! wp_doing_cron();

	if ( ! $is_form_post || is_user_logged_in() ) {
		return $approved;
	}

	// 表单永远只会交上一个字符串；交来数组或别的东西本身就说明不是正常访客
	$trap = $_POST[ yuki_comment_trap_field() ] ?? '';
	if ( ! is_string( $trap ) || '' !== trim( wp_unslash( $trap ) ) ) {
		return new WP_Error( 'yuki_comment_spam' );
	}

	$token = isset( $_POST[ yuki_comment_token_field() ] ) ? wp_unslash( $_POST[ yuki_comment_token_field() ] ) : '';
	if ( ! yuki_comment_token_is_valid( $token ) ) {
		return new WP_Error( 'yuki_comment_spam' );
	}

	return $approved;
}
add_filter( 'pre_comment_approved', 'yuki_comment_guard' );
