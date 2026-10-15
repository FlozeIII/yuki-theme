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

		if ( $depth > 2 && $top_id !== $id ) {
			yuki_comment_set_reply_target( $id, (int) $comment->comment_parent );

			$flattened                 = clone $comment;
			$flattened->comment_parent = (string) $top_id;
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

/* ---------------------------------------------
 * 独立的功能模块
 *
 * 逐个显式 require，而不是 glob 扫 inc/ 目录：加载了哪些文件一眼看得见，
 * 加一个文件也要有人手动写一行——不会因为往目录里放了点什么就悄悄多出一堆行为。
 * --------------------------------------------- */
require_once get_template_directory() . '/inc/comment-deletion.php';
