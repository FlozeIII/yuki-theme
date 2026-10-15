<?php
/**
 * 评论增强 · 点赞
 *
 * 访客给一条评论点赞，再点一次取消。由 functions.php 显式 require 进来。
 *
 * @package Yuki
 */

if ( ! defined( "ABSPATH" ) ) {
	exit;
}

/* ---------------------------------------------
 * 评论增强 · 点赞
 *
 * 访客给一条评论点赞，再点一次取消。计数与「谁点过」都存成**评论元数据**，
 * 访客身份靠站点自己发的一个 cookie——没有账号，也不把 IP 存库。尺度是 spec 定下的：
 * 挡得住手滑和刷新，挡不住刻意清 cookie，对个人博客够用。
 *
 * 写走一个 REST 端点，页面不刷新；**初始状态由服务端渲染**。这样禁用 JS 时计数照样
 * 在页面上（不该因为没脚本就缺一块），也不必为了显示一个数字再问一次服务器。
 *
 * 这一节里有两族函数，按**它们作用在什么上**命名：`yuki_visitor_*` 管「这位访客是谁」
 * （cookie 本身跟点赞无关，将来别的功能也可以认同一个人），`yuki_comment_like_*` 管
 * 「某条评论上的赞」。混用一个前缀会让「谁是访客」和「赞怎么算」读起来像一件事。
 * --------------------------------------------- */

/**
 * 访客标识的 cookie 名。
 *
 * @return string
 */
function yuki_visitor_cookie_name() {
	return 'yuki_visitor';
}

/**
 * 存「谁点过赞」的评论元数据键。
 *
 * @return string
 */
function yuki_comment_likers_meta_key() {
	return '_yuki_comment_likers';
}

/**
 * 把 cookie 里的原值换成存库用的访客标识。
 *
 * 存的是**哈希**不是 cookie 原值：那个字符串本身就是凭证，谁拿到谁就能冒充这位访客，
 * 库被看到时不该连它一起交出去。这里只需要判等，不需要还原。
 *
 * @param mixed $token cookie 里的原值。
 * @return string 空串表示没有可用的标识。
 */
function yuki_visitor_id( $token ) {
	if ( ! is_string( $token ) || ! preg_match( '/^[a-f0-9]{32}$/', $token ) ) {
		return '';
	}

	return hash_hmac( 'sha256', $token, wp_salt( 'auth' ) );
}

/**
 * 当前请求带来的访客标识；没有（或格式不对）返回空串——**不在这里签发**。
 *
 * 渲染页面时读它只为了显示「我点过哪些」。一个从没点过赞的访客不该因为看一眼页面
 * 就被塞一个 cookie，页面缓存也不该因为他有 cookie 而失效；签发只发生在真正点赞时。
 *
 * @return string
 */
function yuki_visitor_current() {
	$name = yuki_visitor_cookie_name();

	if ( ! isset( $_COOKIE[ $name ] ) ) {
		return '';
	}

	return yuki_visitor_id( wp_unslash( $_COOKIE[ $name ] ) );
}

/**
 * 当前访客的标识；还没有就签发一个。
 *
 * 只在写入路径上调。cookie 是 httpOnly 的——脚本不需要读它（状态由服务端渲染），
 * 那就别让它够得着。
 *
 * @return string
 */
function yuki_visitor_ensure() {
	$visitor = yuki_visitor_current();

	if ( '' !== $visitor ) {
		return $visitor;
	}

	$token = bin2hex( random_bytes( 16 ) );

	setcookie(
		yuki_visitor_cookie_name(),
		$token,
		array(
			// 五年：这是「同一位访客」的记号，不该比浏览器自己的历史还短命
			'expires'  => time() + 5 * YEAR_IN_SECONDS,
			'path'     => COOKIEPATH ? COOKIEPATH : '/',
			'domain'   => COOKIE_DOMAIN,
			'secure'   => is_ssl(),
			'httponly' => true,
			'samesite' => 'Lax',
		)
	);

	return yuki_visitor_id( $token );
}

/**
 * 点过这条评论的访客标识（哈希）。
 *
 * **计数就是这份名单的长度**，不另存一个数字：两个字段总有一天会不一致，而不一致的
 * 时候页面上会出现「显示 3 个赞、可你自己已经在名单里」这种自相矛盾的说法。
 *
 * @param int $comment_id 评论 id。
 * @return array<int,string>
 */
function yuki_comment_likers( $comment_id ) {
	$likers = get_comment_meta( (int) $comment_id, yuki_comment_likers_meta_key(), true );

	return is_array( $likers ) ? array_values( array_filter( $likers, 'is_string' ) ) : array();
}

/**
 * 这条评论有几个赞。
 *
 * @param int $comment_id 评论 id。
 * @return int
 */
function yuki_comment_like_count( $comment_id ) {
	return count( yuki_comment_likers( $comment_id ) );
}

/**
 * 这位访客点过这条评论没有。
 *
 * @param int    $comment_id 评论 id。
 * @param string $visitor    访客标识。
 * @return bool
 */
function yuki_comment_is_liked_by( $comment_id, $visitor ) {
	return '' !== $visitor && in_array( $visitor, yuki_comment_likers( $comment_id ), true );
}

/**
 * 点赞 / 取消，返回落定之后的计数与状态。
 *
 * 幂等：点过的再点不加一，没点过的取消不减一。双击、网络重试、两个标签页各点一次，
 * 都不该让那个数字失真。
 *
 * 读-改-写这份名单，并发下理论上会丢掉一次（两个人同一瞬间点同一条，可能只记上一人）。
 * 这里不为此上锁：丢掉的是「一个人重复点被算成两次」之外最轻的那种错，而这是个人博客的
 * 点赞数，不是账。
 *
 * @param int    $comment_id 评论 id。
 * @param string $visitor    访客标识。
 * @param bool   $liked      true 点赞，false 取消。
 * @return array{count:int,liked:bool}
 */
function yuki_comment_set_like( $comment_id, $visitor, $liked ) {
	$comment_id = (int) $comment_id;
	$liked      = (bool) $liked;
	$likers     = yuki_comment_likers( $comment_id );
	$has        = in_array( $visitor, $likers, true );

	if ( $liked === $has ) {
		return array(
			'count' => count( $likers ),
			'liked' => $liked,
		);
	}

	if ( $liked ) {
		$likers[] = $visitor;
	} else {
		$likers = array_values( array_diff( $likers, array( $visitor ) ) );
	}

	$key = yuki_comment_likers_meta_key();

	if ( array() === $likers ) {
		// 一个赞都不剩就把这行删掉，别在库里留一份空数组
		delete_comment_meta( $comment_id, $key );
	} else {
		update_comment_meta( $comment_id, $key, $likers );
	}

	return array(
		'count' => count( $likers ),
		'liked' => $liked,
	);
}

/**
 * 点赞端点：`POST /wp-json/yuki/v1/comment-like`，body 是 `{"comment_id":12,"liked":true}`。
 *
 * **公开端点，不校 nonce。** 和评论表单同一个理由：WordPress 自己的评论表单也不带
 * nonce（`wp-comments-post.php` 不校），而开着页面缓存的站上，硬加一个只会让访客
 * 莫名其妙地失败。
 *
 * 说清楚这道门挡不住什么：不带 cookie 的请求每次都会拿到一个新身份，所以**能把计数
 * 刷上去**——这不是「最多切换一个赞」。挡它该靠评论审核与站点层面的限流，而不是一个
 * nonce：访客身份本来就是自己发的一枚 cookie（spec 明说挡得住手滑与刷新、挡不住刻意
 * 清 cookie，这个尺度对个人博客够用），加 nonce 只会让正常访客在缓存站点上莫名失败，
 * 换不来这个数字的可信度。
 *
 * @param WP_REST_Request $request 请求。
 * @return WP_REST_Response|WP_Error
 */
function yuki_comment_like_endpoint( WP_REST_Request $request ) {
	$comment = get_comment( (int) $request['comment_id'] );

	// 只认已经公开的评论：待审、垃圾、回收站里的不该被点赞，
	// 也别让外面能拿这个端点探出某条评论存不存在
	if ( ! $comment instanceof WP_Comment || '1' !== (string) $comment->comment_approved ) {
		return new WP_Error(
			'yuki_comment_like_target',
			__( '这条评论不能点赞。', 'yuki' ),
			array( 'status' => 404 )
		);
	}

	// 这里的 liked 不必再转一道：参数声明成 boolean，核心已经校验过（'yes' 这种会在
	// 进这个回调之前就 400），而 yuki_comment_set_like() 自己会落成真正的布尔
	$result = yuki_comment_set_like(
		$comment->comment_ID,
		yuki_visitor_ensure(),
		$request['liked']
	);

	return rest_ensure_response( $result );
}

/**
 * 注册点赞端点。
 */
function yuki_comment_like_route() {
	register_rest_route(
		'yuki/v1',
		'/comment-like',
		array(
			'methods'             => 'POST',
			'callback'            => 'yuki_comment_like_endpoint',
			// 公开：访客没有账号可登，这个请求本来就是谁都能发的
			'permission_callback' => '__return_true',
			'args'                => array(
				'comment_id' => array(
					'required'          => true,
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
				),
				'liked'      => array(
					'required' => true,
					'type'     => 'boolean',
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'yuki_comment_like_route' );

/**
 * 点赞脚本。
 *
 * 只在会渲染评论列表的地方加载。它是**增强**不是页面本身：禁用 JS 时计数照样在页面上，
 * 只是点不动。
 */
function yuki_comment_like_script() {
	if ( ! is_singular() ) {
		return;
	}

	wp_enqueue_script(
		'yuki-comment-likes',
		get_template_directory_uri() . '/assets/js/comment-likes.js',
		array(),
		'1.0.0',
		true
	);

	// 端点地址由 PHP 算给脚本，而不是在 JS 里拼：固定链接设置不同，REST 的地址形状也不同
	wp_localize_script(
		'yuki-comment-likes',
		'yukiCommentLikes',
		array( 'endpoint' => rest_url( 'yuki/v1/comment-like' ) )
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_comment_like_script' );
