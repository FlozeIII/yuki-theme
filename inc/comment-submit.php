<?php
/**
 * 评论增强 · 提交不刷新
 *
 * 访客在评论表单里点提交，页面不动、结果就地出现。做法是**渐进增强**：
 *
 *   - 表单的 action 照旧指着 WordPress 原生的入口（wp-comments-post.php），
 *     没有脚本时那条路完全照旧；
 *   - 脚本能跑的时候，它把**表单自己那些字段**交给这里这个公开端点，端点内部调用
 *     核心的 wp_handle_comment_submission()——两条路因此压到同一个函数上，
 *     「同一条评论、同一个待审状态、同一封通知邮件」是构造出来的，而不是两处代码
 *     各自记得做对每一件事。
 *
 * 由 functions.php 显式 require 进来。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ---------------------------------------------
 * 评论增强 · 提交不刷新
 *
 * 两块：端点本身（连同把结果渲染回一段 HTML），以及脚本的加载与它要的那点配置。
 * 页面上那几句话（待审提示、评论计数）的渲染只有一份，在 functions.php 里，
 * 列表与端点共用——这里不另写一份。
 * --------------------------------------------- */

/**
 * 端点：`POST /wp-json/yuki/v1/comment-submit`。
 *
 * **收的是表单编码的正文**，字段与原生入口交上去的一模一样，所以这里读 `$_POST`：
 * 那正是 PHP 按表单编码解出来的东西，`wp-comments-post.php` 喂给核心的是它，
 * 而防垃圾守卫读的（蜜罐、令牌）也是它。用 JSON 发过来的东西这里读不到——`$_POST` 会是空的，
 * 于是核心在「这篇文章不存在」那一关就拒了（`comment_id_not_found`），**根本走不到防垃圾
 * 那一步**。也就是说这个端点的契约只有一条：表单编码的这笔提交。
 *
 * 端点**公开、不校 nonce**，和评论表单同一个理由：WordPress 自己的评论表单也不带
 * nonce（wp-comments-post.php 不校），而开着页面缓存的站上，硬加一个只会让访客莫名
 * 其妙地失败。说清楚这道门挡不住什么：它挡的是手滑与刷新，挡不住刻意绕。
 *
 * @param WP_REST_Request $request 请求；字段全在 $_POST 里，这个对象上没有东西要读。
 * @return WP_REST_Response|WP_Error
 */
function yuki_comment_submit_endpoint( $request ) {
	unset( $request );

	// 先亮明身份（见 functions.php 里 yuki_comment_is_form_post() 的说明）：守卫本来
	// 放过所有 REST 请求，不声明的话端点上填了蜜罐也照收，防垃圾就等于没做。
	yuki_comment_form_post_declare();

	$result = wp_handle_comment_submission( wp_unslash( $_POST ) );

	if ( is_wp_error( $result ) ) {
		return yuki_comment_submit_error( $result );
	}

	/*
	 * 核心那个函数**不碰 cookie**：那是原生入口在成功后另做的一件事。
	 * 漏了它，「待审评论对本人可见」会在脚本这条路上悄悄失效——访客刷新之后看不到
	 * 自己那条，于是以为没发出去，再发一遍。
	 *
	 * 次序与原生的入口一致：先在非错误的结果上发 cookie，再往后走。
	 */
	do_action( 'set_comment_cookies', $result, wp_get_current_user(), isset( $_POST['wp-comment-cookies-consent'] ) );

	/*
	 * 还有一种「不是错误、但也不该当成功」的结果：**核心自己把这条评论判成垃圾了**。
	 *
	 * 命中站点的「不允许的关键词」时，核心把审批状态设成 `trash`（EMPTY_TRASH_DAYS 有值
	 * 时）或者 `spam`——`pre_comment_approved` 收到的就是一个字符串，**不是 WP_Error**
	 * （wp-includes/comment.php:1384-1392），所以上面那道 `is_wp_error` 拦不住它，
	 * 核心照样把评论对象还回来。
	 *
	 * 这条不能当成功画出来：垃圾与回收站里的评论不在列表的查询范围内，画上去会是一条
	 * 「看着发出去了、刷新就没了」的评论，而评论计数那句还不认它（计数只数已公开的）。
	 * 原生那条路此时是跳到一个不显示它的页面——访客白跳一趟，写的东西也没了。
	 * 端点这里如实说「没收下」，脚本就把表单退回去，写的东西还留在手里。
	 *
	 * 话留空：理由与守卫那两种判定一样，对着机器人说什么都是白送情报。
	 */
	$verdict = (string) $result->comment_approved;

	if ( '1' !== $verdict && '0' !== $verdict ) {
		return yuki_comment_submit_error( new WP_Error( 'yuki_comment_rejected' ) );
	}

	$post_id = (int) $result->comment_post_ID;
	// 待审提示是给访客看的（与列表那边同一条规则），所以这里认提交时用的那个邮箱，
	// 而不是这一笔请求带着的 cookie——新访客的第一笔提交还没有 cookie 可读。
	$notice_email = is_user_logged_in() ? '' : strtolower( (string) $result->comment_author_email );

	return rest_ensure_response( array(
		'id'       => (int) $result->comment_ID,
		'approved' => '1' === (string) $result->comment_approved,
		'html'     => yuki_comment_render_one( $result ),
		'heading'  => yuki_comment_count_heading_html( $post_id ),
		'notice'   => yuki_comment_pending_notice_html( yuki_comment_pending_count( $post_id, $notice_email ) ),
	) );
}

/**
 * 把核心（或防垃圾守卫）那份错误翻成端点回话。
 *
 * 原则是**照它的判断回话，不多说一句**：核心给了状态码就用它自己的
 * （`comment_closed` 与 `comment_reply_to_unapproved_comment` 都是 403），不到 400 的
 * 一律落成 403——这既包括没给状态的（`comment_id_not_found` 这类，在原生那条路上就是
 * 一片空白），也包括核心那两个**挂在 200 上**的校验错（`require_name_email`、
 * `require_valid_comment`）。原生那条路把它们交给 `wp_die`，于是状态是 200 也照印；
 * 端点不能这么干：回话是给脚本看的，2xx 意味着「收下了」，脚本会拿它当成功。
 * 特别地，**不为了让「回复一条还没公开的评论」更好懂而多说一句**——那样这个端点就成了
 * 探查某条评论存不存在的手段，而核心对「回复一条待审评论」与「回复一条压根不存在的
 * 评论」给的是同一个错误，照它原样回话就够了。
 *
 * 防垃圾守卫那条要另说：它是主题自己的判定，而且**刻意什么也不说**（原生那条路上它就是
 * 一片空白）。所以这里原样保留它那份「没有话」——对着机器人多说一句都是白送情报。
 *
 * 话一律剥掉标签再回：脚本会把它按纯文本放在页面上，核心那几条自带 `<strong>`，
 * 不剥掉的话标签会原样露出来。
 *
 * @param WP_Error $error 核心或守卫给出的错误。
 * @return WP_Error
 */
function yuki_comment_submit_error( WP_Error $error ) {
	$data   = $error->get_error_data();
	$status = (int) ( is_array( $data ) ? ( $data['status'] ?? 0 ) : $data );

	if ( $status < 400 ) {
		$status = 403;
	}

	return new WP_Error(
		$error->get_error_code(),
		'yuki_comment_spam' === $error->get_error_code() ? '' : wp_strip_all_tags( $error->get_error_message() ),
		array( 'status' => $status )
	);
}

/**
 * 把一条评论渲染成列表里的那一段 HTML。
 *
 * 走的是**列表自己那一套**（wp_list_comments + yuki_comment_list_args()），所以它的
 * 印记与列表里其它评论是同一个模板出来的——不另写一份评论 HTML：两处各写一份迟早会漂，
 * 而漂的时候两边看起来都对。
 *
 * 渲染期间把「当前评论者」暂时当成这条评论的作者：原生那条路提交完就跳转，下一次请求
 * 自然带着评论者 cookie，模板因此看得见「这是你自己那条」；端点不跳转，就在这一次请求
 * 里渲染，不把这份身份交给模板的话，措辞与正文过滤都会是给陌生人看的那一版，
 * 而访客一刷新就变了样。
 *
 * @param WP_Comment $comment 刚落定的评论。
 * @return string
 */
function yuki_comment_render_one( $comment ) {
	$as_author = static function () use ( $comment ) {
		return array(
			'comment_author'       => $comment->comment_author,
			'comment_author_email' => $comment->comment_author_email,
			'comment_author_url'   => $comment->comment_author_url,
		);
	};

	add_filter( 'wp_get_current_commenter', $as_author );

	$html = wp_list_comments( yuki_comment_list_args() + array( 'echo' => false ), array( $comment ) );

	remove_filter( 'wp_get_current_commenter', $as_author );

	return (string) $html;
}

/**
 * 注册端点的路由。
 */
function yuki_comment_submit_route() {
	register_rest_route(
		'yuki/v1',
		'/comment-submit',
		array(
			'methods'             => 'POST',
			'callback'            => 'yuki_comment_submit_endpoint',
			// 公开：访客没有账号可登，这个请求本来就是谁都能发的。校验都在核心那个函数
			// 与防垃圾守卫里，不在这条路由的 args 上——这里读的是 $_POST。
			'permission_callback' => '__return_true',
		)
	);
}
add_action( 'rest_api_init', 'yuki_comment_submit_route' );

/**
 * 提交脚本。
 *
 * 只在会渲染评论列表的地方加载。它是**增强**不是页面本身：没有这个脚本，表单照旧
 * 整页提交、照旧发得出评论。
 */
function yuki_comment_submit_script() {
	if ( ! is_singular() ) {
		return;
	}

	wp_enqueue_script(
		'yuki-comment-submit',
		get_template_directory_uri() . '/assets/js/comment-submit.js',
		array(),
		'1.0.0',
		true
	);

	wp_localize_script(
		'yuki-comment-submit',
		'yukiCommentSubmit',
		array(
			// 端点地址由 PHP 算给脚本，而不是在 JS 里拼：固定链接设置不同，REST 的地址形状也不同
			'endpoint' => rest_url( 'yuki/v1/comment-submit' ),
			/*
			 * nonce 只给登录用户带上。端点自己不校 nonce，但**带 cookie 的请求**在核心那边
			 * 要先过一道：核实验不了这枚 nonce 就把这次请求降级成匿名
			 * （wp-includes/rest-api.php 里 rest_cookie_check_errors()：没有 nonce 时
			 * `wp_set_current_user( 0 )` 然后放行，**不是** 403；403 只在 nonce 存在但无效时给）。
			 * 降级成匿名之后，登录用户的评论表单没有姓名与邮箱栏，核心会以「必填项没填」拒掉
			 * ——他明明登录着，却收到一句要填名字的话。带上 nonce 就不会走到那一步。
			 *
			 * 访客那边它是空的：不带 cookie 的请求本来就没什么可降级的，带上只会让页面缓存失效。
			 */
			'nonce'    => is_user_logged_in() ? wp_create_nonce( 'wp_rest' ) : '',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_comment_submit_script' );
