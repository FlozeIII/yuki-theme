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
 * 收下了就回 200 与这几样（脚本照着它把结果画出来）：
 *
 * ```
 * {
 *   id:       落定的评论 id
 *   parent:   它该挂在谁下面（**显示层级**上的父评论 id，0 表示最外面那一层）
 *   approved: 已公开还是还在待审
 *   html:     那一条的 HTML，与列表里其它评论出自同一个模板
 *   heading:  列表上方那句「评论（N）」
 *   notice:   列表上方那句待审提示；这位访客没有待审评论时是空串
 * }
 * ```
 *
 * 收不下就回 4xx 与 `{ code, message }`；message 为空表示「服务端什么也不说」，
 * 脚本只把表单退回去（见 yuki_comment_submit_error()）。
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

	/*
	 * 这条该挂在谁下面、算第几层，**服务端说了算**。
	 *
	 * 脚本不做第二遍判断：「深于两层的回复压到第二层」这条规则只在一处写着
	 * （functions.php 的 yuki_comment_display_parent()），各判一遍迟早会判岔，
	 * 而判岔的时候两边看起来都对。
	 */
	$place = yuki_comment_place( $result, (string) $result->comment_author_email );

	/*
	 * 还有一种「收了但永远显示不出来」的结果：**它那一支在页面上会被整支丢掉**。
	 *
	 * 开了嵌套讨论时，comments_template() 在把评论交给 walker 之前会按「最外面那一层 +
	 * 各自的子孙」重建一次树（comment-template.php:1461 把 hierarchical 设成 threaded，
	 * 1561-1576 那一节做重建，子评论是另外查的）。所以一条评论只要有一个祖先不在同一次
	 * 可见集合里——待审且不是本人的、或者进了回收站——它那一支就整个不在列表里。
	 *
	 * 这种回复是能提交上来的（父评论已公开，核心那道「不能回待审评论」拦不住），但它
	 * **永远不会出现在页面上**：原生那条路此时跳到一个不显示它的地址上去，访客白跳一趟。
	 * 处理办法与上面那条被核心判成垃圾的一样：如实说「没收下」，脚本把表单退回去，
	 * 写的东西还在手里。
	 */
	if ( $place['cut'] ) {
		return yuki_comment_submit_error( new WP_Error( 'yuki_comment_rejected' ) );
	}

	return rest_ensure_response( array(
		'id'       => (int) $result->comment_ID,
		'parent'   => $place['parent'],
		'approved' => '1' === (string) $result->comment_approved,
		'html'     => yuki_comment_render_one( $result, $place['depth'] ),
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
 * @param int        $depth   它在显示层级里的层数（顶层是 1）——见 yuki_comment_place()。
 * @return string
 */
function yuki_comment_render_one( $comment, $depth = 1 ) {
	$args = yuki_comment_list_args();

	$as_author = static function () use ( $comment ) {
		return array(
			'comment_author'       => $comment->comment_author,
			'comment_author_email' => $comment->comment_author_email,
			'comment_author_url'   => $comment->comment_author_url,
		);
	};

	add_filter( 'wp_get_current_commenter', $as_author );

	/*
	 * 直接调 walker 的那一步，而不是 wp_list_comments()。
	 *
	 * 理由只有一条，但它足够硬：**「它挂在第几层」在这里得是入口参数**。`depth` 只有在走
	 * 一整个列表时才推得出来，而这一条该在第几层，服务端已经算好了（见 yuki_comment_place()）。
	 *
	 * 交给 `wp_list_comments()` 会怎样：它先按 `comment_parent` 把元素分成两摞
	 * （class-wp-walker.php:221-227），父评论不在数组里的那条落进 `$children_elements`；
	 * 那一摞最后会走「孤儿」那条路被画出来（同文件 399-406，进去时是 `$depth = 0`）。
	 * 所以**画是画得出**，只是印成最外面那一层——回复会变成 `depth-1`，缩进与「回复 @谁」
	 * 都对不上。（这里先前被我写成「什么也不画」，是错的；照那句看代码的人会以为可以换回去。）
	 *
	 * `start_el()` 收到之后会**先自增**再写进全局 `$comment_depth`
	 * （class-walker-comment.php:177-178），而 `comment_class()` 读的就是那个全局
	 * （comment-template.php:577）——所以上面传 `$depth - 1`。
	 */
	$walker   = new Walker_Comment();
	$output   = '';
	$children = array();

	$walker->display_element( $comment, $children, (int) $args['max_depth'], max( 0, (int) $depth - 1 ), array( $args ), $output );

	remove_filter( 'wp_get_current_commenter', $as_author );

	return trim( (string) $output );
}

/**
 * 这一条会不会出现在列表页上（就这位访客而言）。
 *
 * 与 `comments_template()` 取评论的那一套对齐：已公开的都在；没公开的只有**本人的**那份
 * 在（核心靠 `include_unapproved` 做这件事）；垃圾与回收站里的都不在。
 *
 * @param WP_Comment $comment      评论。
 * @param string     $viewer_email 这次提交的人。
 * @return bool
 */
function yuki_comment_visible_on_page( $comment, $viewer_email ) {
	if ( '1' === (string) $comment->comment_approved ) {
		return true;
	}

	// 垃圾与回收站里的：谁也不在页面上看见
	if ( '0' !== (string) $comment->comment_approved ) {
		return false;
	}

	if ( (int) $comment->user_id > 0 && (int) $comment->user_id === get_current_user_id() ) {
		return true;
	}

	return '' !== $viewer_email
		&& strtolower( (string) $comment->comment_author_email ) === strtolower( $viewer_email );
}

/**
 * 一条评论在**真实层级**里的深度（顶层是 1）与它那一支的顶层祖先 id。
 *
 * 走数据库那一支，但**只在「这位访客在页面上看得见的那些」里走**。
 *
 * 这一条不是洁癖：列表那边压平时手上只有当前这一页查出来的评论（`comments_array` 给什么
 * 就压什么），一条评论的父评论要是没在那次查询里——待审且不是本人的、在回收站里的、
 * 或者分页分到别页去了——压平就在那儿停住，把它当成最外面那一层。这里必须停在同一处：
 * 走过头会算出一个页面根本不会用的层级，新回复于是被挂到刷新之后又不在那儿的位置上。
 * 这一件实际踩过（一条已公开的回复，它的父评论还在待审）。
 *
 * 坏数据里的自环与互环用 $seen 兜住（那也算「断了」）。
 *
 * `cut` 是「走到一半走不下去了」：还有父评论，但那位访客在页面上看不见它（或者是条坏数据）。
 * 这件事得单独报出来——那意味着这条评论**永远不会出现在页面上**，见下方的说明。
 *
 * @param int    $comment_id   评论 id。
 * @param string $viewer_email 这次提交的人，用来判断「待审的这条是不是他自己的」。
 * @return array{depth:int,top:int,cut:bool}
 */
function yuki_comment_true_ancestry( $comment_id, $viewer_email = '' ) {
	$id    = (int) $comment_id;
	$depth = 1;
	$top   = $id;
	$cut   = false;
	$seen  = array( $id => true );

	$current = get_comment( $id );

	while ( $current instanceof WP_Comment && $current->comment_parent ) {
		$parent_id = (int) $current->comment_parent;

		if ( isset( $seen[ $parent_id ] ) ) {
			$cut = true;
			break;
		}

		$parent = get_comment( $parent_id );

		if ( ! $parent instanceof WP_Comment || ! yuki_comment_visible_on_page( $parent, $viewer_email ) ) {
			$cut = true;
			break;
		}

		$seen[ $parent_id ] = true;
		$current            = $parent;
		$top                = $parent_id;
		$depth++;
	}

	return array(
		'depth' => $depth,
		'top'   => $top,
		'cut'   => $cut,
	);
}

/**
 * 刚落定的这条评论在**显示层级**里该挂到谁下面、算第几层。
 *
 * 判断交给 yuki_comment_display_parent()——「深于两层压到第二层」那条规则与列表压平共用
 * 一份；这里只负责把它需要的三个数（真实层级、顶层祖先、真正回的那条）数出来。
 *
 * @param WP_Comment $comment      刚落定的评论。
 * @param string     $viewer_email 这次提交的人；判断「待审的祖先他自己看不看得见」要用。
 * @return array{parent:int,depth:int,cut:bool} parent 是显示时的父评论 id（0 表示最外面那一层）；
 *                                              cut 为真表示这条评论页面根本不会显示（见端点里的处理）。
 */
function yuki_comment_place( $comment, $viewer_email = '' ) {
	$top_only = array(
		'parent' => 0,
		'depth'  => 1,
		'cut'    => false,
	);

	// 没开嵌套讨论：列表那边一律平铺（max_depth 是 -1），这里也得跟着平铺，
	// 不然就地画出来的那一条会比刷新之后的层级深一层。
	if ( ! get_option( 'thread_comments' ) ) {
		return $top_only;
	}

	$parent = (int) $comment->comment_parent;

	if ( ! $parent ) {
		return $top_only;
	}

	$ancestry = yuki_comment_true_ancestry( $parent, $viewer_email );

	return array(
		// 新评论的真实层级 = 它回的那条的真实层级 + 1
		'parent' => yuki_comment_display_parent( $ancestry['depth'] + 1, $ancestry['top'], $parent ),
		// 显示层级最多两层：挂上去的那条总在最外面那一层，所以新评论总在第二层
		'depth'  => 2,
		'cut'    => $ancestry['cut'],
	);
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

	/*
	 * 依赖里带上核心的 `comment-reply`。
	 *
	 * 主题原来没有排它：回复入口是 html5 形状的锚点（带 data-*、没有 onclick），而核心只让
	 * **区块**与 theme-compat 去排这个脚本——经典主题不排。于是点「回复」以前是整页跳到
	 * `?replytocom=N`，由核心在服务端把表单的父评论填好（那条路现在仍然通：锚点的 href 没动，
	 * 没脚本时照旧）。
	 *
	 * 这一件非带上它不可：**表单得先搬到被回复的那条下面**，「提交完再回到原位」才说得通。
	 */
	wp_enqueue_script(
		'yuki-comment-submit',
		get_template_directory_uri() . '/assets/js/comment-submit.js',
		array( 'comment-reply' ),
		yuki_asset_version(),
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
