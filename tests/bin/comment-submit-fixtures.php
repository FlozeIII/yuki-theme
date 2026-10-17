<?php
/**
 * 工单 01（评论提交不刷新）的造数：一篇自己的文章、一位「回头客」、一条待审评论。
 *
 * 断言全在 HTTP 面上（端点回什么、列表页上多出什么、刷新之后还在不在），
 * 夹具只需要准备好靶子：
 *
 *   - 一篇允许评论的**自己的**文章——不借「最新一篇允许评论的文章」，
 *     那篇常常是别的会话的造数文章，它们的收尾会把它删掉，删在我这一轮中间
 *     就会把一堆断言打成「东西不存在」；
 *   - 一条**已经过审**的评论，作者名与邮箱分别是 known_author / known_email：
 *     `comment_previously_approved` 认的是**作者名与邮箱一起对上**
 *     （wp-includes/comment.php:153 那条 SQL），所以拿同一对名字与邮箱提交才会直接公开——
 *     「已公开」那条路要有它才测得出来；
 *   - 一条待审评论：用来验「回复一条还没公开的评论会被如实拒绝」。
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * 用法: php comment-submit-fixtures.php <wordpress目录> <子命令>
 *   state              当前实况：主题、端点地址、文章与评论、cookie 后缀
 *   setup              清掉上一轮，重新造一篇文章与两条评论
 *   blank-post         另造（或复用）一篇**没有评论**的文章，给「列表还不存在」那条路用
 *   make --post= --content= [--author=] [--email=] [--approved=] [--parent=]
 *                      直接塞一条评论（走 wp_insert_comment，不经过任何表单）
 *   status --comment=  那一条评论现在什么状态
 *   by-email --email=  那个邮箱名下所有评论的状态
 *   guard-scope --context=form|rest|xmlrpc|cron
 *                      把蜜罐填上，模拟四条入口各一次，看防垃圾守卫认不认它们——
 *                      评论落不落库就是答案
 *   blocklist --key=词  设上全站的「不允许的关键词」；不给 --key 就还原成默认值（空）
 *   purge              清掉本脚本造过的一切（并还原全站设置）
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会把 WordPress 的全局 $wp 覆盖掉。
$yuki_fx_root = $argv[1] ?? '';
$yuki_fx_cmd  = $argv[2] ?? '';

if ( ! $yuki_fx_root || ! file_exists( $yuki_fx_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php comment-submit-fixtures.php <wordpress目录> <子命令>\n" );
	exit( 2 );
}

require $yuki_fx_root . '/wp-load.php';
unset( $yuki_fx_root );

/** 本脚本造的内容都带这个前缀，清理靠它精确认人。 */
const YUKI_SUBMIT_MARK = 'YUKI-SUBMIT';

/**
 * 造出来的文章刻意排得很旧。
 *
 * 别的会话的夹具会取「最新一篇允许评论的文章」当靶子（wp-probe 的 site-info 就是），
 * 我这篇要是排在最前面，就会把它们的靶子挪走。这里认的是「这篇文章上的评论」，排第几无所谓。
 */
const YUKI_SUBMIT_POST_DATE = '2020-01-02 00:00:00';

/**
 * 「回头客」是谁。
 *
 * 核心认的是**作者名 + 邮箱一起对上**（wp-includes/comment.php:151-158 那条 SQL，
 * `comment_author = %s AND comment_author_email = %s`），只对上邮箱不作数。
 * 所以验收脚本提交时得用同一个名字——这里把它一并交出去。
 */
const YUKI_SUBMIT_KNOWN_AUTHOR = YUKI_SUBMIT_MARK . ' 回头客';
const YUKI_SUBMIT_KNOWN_EMAIL  = 'submit-known@example.test';

/** 待审评论作者的邮箱。 */
const YUKI_SUBMIT_PENDING_EMAIL = 'submit-pending@example.test';

/**
 * 一小段讨论：甲在最外面，乙回甲，丙回乙。
 *
 * 「回复落在被回复的那条下面」有三种情形，靠这三条才测得全：
 *   - 回甲（它就在最外面）→ 新回复挂在甲下面；
 *   - 回乙（它在第二层）→ 新回复的**真实**层级到了第三层，显示上被压到甲下面；
 *   - 回丙（它自己就是被压到第二层的那条）→ 同理，还是挂到甲下面。
 * 后两种必须标出「回复 @乙」「回复 @丙」——缩进说明不了它在回谁。
 *
 * 日期写死：列表按 comment_date_gmt 排，同秒插入的话先后就没有保证了。
 */
const YUKI_SUBMIT_THREAD = array(
	'a' => array( 'author' => YUKI_SUBMIT_MARK . ' 甲', 'email' => 'submit-thread-a@example.test', 'date' => '2020-01-02 00:03:00' ),
	'b' => array( 'author' => YUKI_SUBMIT_MARK . ' 乙', 'email' => 'submit-thread-b@example.test', 'date' => '2020-01-02 00:04:00' ),
	'c' => array( 'author' => YUKI_SUBMIT_MARK . ' 丙', 'email' => 'submit-thread-c@example.test', 'date' => '2020-01-02 00:05:00' ),
);

function yuki_fx_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

/** 把 --键=值 形式的参数读成一个数组。 */
function yuki_fx_args( $argv ) {
	$args = array();

	foreach ( array_slice( $argv, 3 ) as $arg ) {
		if ( preg_match( '/^--([a-z-]+)=(.*)$/s', $arg, $m ) ) {
			$args[ $m[1] ] = $m[2];
		}
	}

	return $args;
}

/** 本脚本造的所有文章（按标记认，不用「最新一篇」）。 */
function yuki_fx_all_post_ids() {
	return array_map(
		static fn( $post ) => (int) $post->ID,
		get_posts( array(
			'post_type'   => 'post',
			'post_status' => 'any',
			'numberposts' => -1,
			's'           => YUKI_SUBMIT_MARK,
		) )
	);
}

/** 本脚本造的那篇文章（按标题认）。 */
function yuki_fx_post_id() {
	$title = YUKI_SUBMIT_MARK . ' 评论提交验收用文章';

	foreach ( yuki_fx_all_post_ids() as $post_id ) {
		if ( $title === get_post_field( 'post_title', $post_id ) ) {
			return (int) $post_id;
		}
	}

	return 0;
}

/** 清掉这篇文章上带标记的评论。 */
function yuki_fx_clear_comments( $post_id ) {
	$removed = 0;

	foreach ( get_comments( array( 'post_id' => $post_id, 'status' => 'any' ) ) as $comment ) {
		if ( false !== strpos( $comment->comment_content, YUKI_SUBMIT_MARK ) ) {
			wp_delete_comment( (int) $comment->comment_ID, true );
			$removed++;
		}
	}

	return $removed;
}

/** 造那条过审评论 + 那条待审评论。 */
function yuki_fx_seed_comments( $post_id ) {
	$known = wp_insert_comment( array(
		'comment_post_ID'      => $post_id,
		'comment_author'       => YUKI_SUBMIT_KNOWN_AUTHOR,
		'comment_author_email' => YUKI_SUBMIT_KNOWN_EMAIL,
		'comment_content'      => YUKI_SUBMIT_MARK . ' 这位访客之前留过一条已经通过的评论。',
		'comment_approved'     => 1,
		'comment_author_IP'    => '127.0.0.1',
		'comment_date'         => '2020-01-02 00:01:00',
		'comment_date_gmt'     => '2020-01-02 00:01:00',
	) );

	$pending = wp_insert_comment( array(
		'comment_post_ID'      => $post_id,
		'comment_author'       => YUKI_SUBMIT_MARK . ' 待审者',
		'comment_author_email' => YUKI_SUBMIT_PENDING_EMAIL,
		'comment_content'      => YUKI_SUBMIT_MARK . ' 一条还没过审的评论。',
		'comment_approved'     => 0,
		'comment_author_IP'    => '127.0.0.1',
		'comment_date'         => '2020-01-02 00:02:00',
		'comment_date_gmt'     => '2020-01-02 00:02:00',
	) );

	return array(
		'known_id'   => (int) $known,
		'pending_id' => (int) $pending,
		'thread'     => yuki_fx_seed_thread( $post_id ),
	);
}

/** 一小段讨论：甲 → 乙（回甲）→ 丙（回乙），外加一对「父评论还在待审」的。 */
function yuki_fx_seed_thread( $post_id ) {
	$ids    = array();
	$parent = 0;

	foreach ( YUKI_SUBMIT_THREAD as $key => $who ) {
		$ids[ $key ] = (int) wp_insert_comment( array(
			'comment_post_ID'      => $post_id,
			'comment_author'       => $who['author'],
			'comment_author_email' => $who['email'],
			'comment_content'      => sprintf( '%s 第 %s 条。', YUKI_SUBMIT_MARK, strtoupper( $key ) ),
			'comment_approved'     => 1,
			'comment_parent'       => $parent,
			'comment_author_IP'    => '127.0.0.1',
			'comment_date'         => $who['date'],
			'comment_date_gmt'     => $who['date'],
		) );

		$parent = $ids[ $key ];
	}

	/*
	 * 一条**已公开**的回复，它的父评论还在待审——而且待审的不是本人的。
	 *
	 * 这一对是给「两条路算出来的层级必须一致」用的：列表查询按 include_unapproved 取评论，
	 * 陌生访客的那次查询里没有那条待审的父评论，所以这条已公开的回复在页面上被当成最外面
	 * 那一层；端点那边要是顺着数据库一路上溯，就会算出一个页面根本不会用的层级。
	 */
	$held = (int) wp_insert_comment( array(
		'comment_post_ID'      => $post_id,
		'comment_author'       => YUKI_SUBMIT_MARK . ' 待审的父评论',
		'comment_author_email' => 'submit-thread-held@example.test',
		'comment_content'      => YUKI_SUBMIT_MARK . ' 这条还在待审，陌生人看不见它。',
		'comment_approved'     => 0,
		'comment_parent'       => 0,
		'comment_author_IP'    => '127.0.0.1',
		'comment_date'         => '2020-01-02 00:06:00',
		'comment_date_gmt'     => '2020-01-02 00:06:00',
	) );

	$ids['orphan'] = (int) wp_insert_comment( array(
		'comment_post_ID'      => $post_id,
		'comment_author'       => YUKI_SUBMIT_MARK . ' 待审者的回复',
		'comment_author_email' => 'submit-thread-orphan@example.test',
		'comment_content'      => YUKI_SUBMIT_MARK . ' 回上一条，但那条还在待审。',
		'comment_approved'     => 1,
		'comment_parent'       => $held,
		'comment_author_IP'    => '127.0.0.1',
		'comment_date'         => '2020-01-02 00:07:00',
		'comment_date_gmt'     => '2020-01-02 00:07:00',
	) );

	$ids['orphan_parent'] = $held;

	return $ids;
}

/**
 * 讨论设置。
 *
 * 用的是 WordPress 新装的默认值，与 comment-spam-fixtures.php 里那份一致：
 * 不逐条人工审、老读者的评论直接放行。验收要靠它把「该公开」和「该待审」两条路分开。
 * 改动是全站设置，所以刻意设成默认值而不是随便一个值。
 */
function yuki_fx_discussion_defaults() {
	update_option( 'comment_registration', 0 );
	update_option( 'require_name_email', 1 );
	update_option( 'comment_moderation', 0 );
	update_option( 'comment_previously_approved', 1 );
	update_option( 'close_comments_for_old_posts', 0 );
	update_option( 'default_comment_status', 'open' );
	update_option( 'thread_comments', 1 );
}

function yuki_fx_state() {
	$post_id = yuki_fx_post_id();

	return array(
		'theme'         => get_stylesheet(),
		// 核心读评论者 cookie 时用的是带 COOKIEHASH 的名字（comment_author_email_<hash>），
		// 验收要「以某位评论者的身份」打开页面就得知道这个后缀
		'cookie_hash'   => COOKIEHASH,
		// 端点地址由主题注册、由核心的 rest_url() 拼出来，形状随固定链接设置变，
		// 所以由 PHP 算给验收脚本，而不是在脚本里写死一个 /wp-json/...
		'endpoint'      => rest_url( 'yuki/v1/comment-submit' ),
		'known_author'  => YUKI_SUBMIT_KNOWN_AUTHOR,
		'known_email'   => YUKI_SUBMIT_KNOWN_EMAIL,
		'pending_email' => YUKI_SUBMIT_PENDING_EMAIL,
		'post_id'       => $post_id,
		'post_url'      => $post_id ? get_permalink( $post_id ) : '',
		'comments'      => $post_id
			? array_map( 'intval', get_comments( array( 'post_id' => $post_id, 'status' => 'approve', 'fields' => 'ids' ) ) )
			: array(),
	);
}

switch ( $yuki_fx_cmd ) {
	case 'state':
		yuki_fx_emit( yuki_fx_state() );
		break;

	case 'setup':
		yuki_fx_discussion_defaults();

		// 上一轮要是死在设了关键词之后，这里先还原掉，别让它影响这一轮
		update_option( 'disallowed_keys', '' );

		$post_id = yuki_fx_post_id();

		if ( ! $post_id ) {
			$post_id = wp_insert_post( array(
				'post_title'     => YUKI_SUBMIT_MARK . ' 评论提交验收用文章',
				'post_content'   => '<p>评论提交验收用的文章。</p>',
				'post_status'    => 'publish',
				'post_type'      => 'post',
				'comment_status' => 'open',
				'ping_status'    => 'closed',
				'post_date'      => YUKI_SUBMIT_POST_DATE,
				'post_date_gmt'  => YUKI_SUBMIT_POST_DATE,
			) );
		}

		if ( is_wp_error( $post_id ) || ! $post_id ) {
			yuki_fx_emit( array( 'error' => '文章没建出来' ) );
			exit( 2 );
		}

		// 上一轮的标记先清干净，否则「这一轮有没有多出一条」就无从谈起
		$removed = yuki_fx_clear_comments( (int) $post_id );
		$seeded  = yuki_fx_seed_comments( (int) $post_id );

		$state                     = yuki_fx_state();
		$state['removed_previous'] = $removed;
		$state['known_id']         = $seeded['known_id'];
		$state['pending_id']       = $seeded['pending_id'];
		$state['thread']           = $seeded['thread'];
		$state['thread_authors']   = array(
			'a' => YUKI_SUBMIT_THREAD['a']['author'],
			'b' => YUKI_SUBMIT_THREAD['b']['author'],
			'c' => YUKI_SUBMIT_THREAD['c']['author'],
		);
		yuki_fx_emit( $state );
		break;

	case 'blank-post':
		/*
		 * 一篇**没有评论**的文章：验「列表还不存在时脚本自己把它补上」那条路。
		 * 与主文章分开——主文章上永远留着造数评论，「列表不存在」根本走不到。
		 */
		$title   = YUKI_SUBMIT_MARK . ' 空白文章';
		$post_id = 0;

		foreach ( yuki_fx_all_post_ids() as $candidate ) {
			if ( $title === get_post_field( 'post_title', $candidate ) ) {
				$post_id = (int) $candidate;
				break;
			}
		}

		if ( ! $post_id ) {
			$post_id = (int) wp_insert_post( array(
				'post_title'     => $title,
				'post_content'   => '<p>还没有人评论过这篇。</p>',
				'post_status'    => 'publish',
				'post_type'      => 'post',
				'comment_status' => 'open',
				'ping_status'    => 'closed',
				'post_date'      => '2020-01-03 00:00:00',
				'post_date_gmt'  => '2020-01-03 00:00:00',
			) );
		}

		// 清干净，包括上一轮留下的
		foreach ( get_comments( array( 'post_id' => $post_id, 'status' => 'any' ) ) as $comment ) {
			wp_delete_comment( (int) $comment->comment_ID, true );
		}

		yuki_fx_emit( array(
			'post_id'  => $post_id,
			'post_url' => $post_id ? get_permalink( $post_id ) : '',
			'comments' => $post_id ? count( get_comments( array( 'post_id' => $post_id, 'status' => 'any' ) ) ) : 0,
		) );
		break;

	case 'make':
		$args    = yuki_fx_args( $argv );
		$post_id = (int) ( $args['post'] ?? yuki_fx_post_id() );

		$comment_id = wp_insert_comment( array(
			'comment_post_ID'      => $post_id,
			'comment_author'       => (string) ( $args['author'] ?? ( YUKI_SUBMIT_MARK . ' 造数' ) ),
			'comment_author_email' => (string) ( $args['email'] ?? 'submit-fx@example.test' ),
			'comment_content'      => (string) ( $args['content'] ?? ( YUKI_SUBMIT_MARK . ' 造数评论' ) ),
			'comment_approved'     => (int) ( $args['approved'] ?? 1 ),
			'comment_parent'       => (int) ( $args['parent'] ?? 0 ),
			'comment_author_IP'    => '127.0.0.1',
		) );

		yuki_fx_emit( array( 'comment_id' => (int) $comment_id ) );
		break;

	case 'status':
		$args    = yuki_fx_args( $argv );
		$comment = get_comment( (int) ( $args['comment'] ?? 0 ) );

		if ( ! $comment ) {
			yuki_fx_emit( array( 'found' => false ) );
			break;
		}

		yuki_fx_emit( array(
			'found'    => true,
			'id'       => (int) $comment->comment_ID,
			'post'     => (int) $comment->comment_post_ID,
			'approved' => (string) $comment->comment_approved,
			'author'   => $comment->comment_author,
			'email'    => $comment->comment_author_email,
			'parent'   => (int) $comment->comment_parent,
			'content'  => $comment->comment_content,
		) );
		break;

	case 'by-email':
		$args  = yuki_fx_args( $argv );
		$email = strtolower( (string) ( $args['email'] ?? '' ) );

		$mine = array();
		$all  = array();

		foreach ( get_comments( array( 'post_id' => yuki_fx_post_id(), 'status' => 'any' ) ) as $comment ) {
			$row = array(
				'id'       => (int) $comment->comment_ID,
				'approved' => (string) $comment->comment_approved,
				'email'    => $comment->comment_author_email,
				'content'  => mb_substr( $comment->comment_content, 0, 40 ),
			);

			$all[] = $row;

			if ( strtolower( (string) $comment->comment_author_email ) === $email ) {
				$mine[] = $row;
			}
		}

		yuki_fx_emit( array(
			'count' => count( $mine ),
			'ids'   => array_map( static fn( $r ) => $r['id'], $mine ),
			'mine'  => $mine,
			'all'   => $all,
		) );
		break;

	case 'guard-scope':
		/*
		 * 防垃圾守卫**管哪条路**，只有在这里看得清。
		 *
		 * 端点上与原生那条路上守卫都该生效；别的入口（REST、XML-RPC、定时任务、导入脚本）
		 * 手上不该有这套表单协议，按机器人处理只会把别处正常入库的评论静默吞掉。
		 * 工单把这几条路都点了名，所以四条都模拟一遍。
		 *
		 *   --context=form     一次非 REST 的 POST，$_POST 里带着表单协议（原生那条路的处境）
		 *   --context=rest     REST_REQUEST 定义了——这正是端点和别的 REST 调用共同看到的
		 *                      处境，两者要靠主题自己的标记分开
		 *   --context=xmlrpc   XMLRPC_REQUEST 定义了
		 *   --context=cron     DOING_CRON 定义了
		 *
		 * 四种都把蜜罐填上：守卫管这条路的话，评论就不该入库。
		 * 那几个常量一个进程只设得了一次，所以每种情形分开跑。
		 */
		$args    = yuki_fx_args( $argv );
		$context = (string) ( $args['context'] ?? 'form' );

		$_SERVER['REQUEST_METHOD'] = 'POST';

		if ( 'rest' === $context && ! defined( 'REST_REQUEST' ) ) {
			define( 'REST_REQUEST', true );
		}

		if ( 'xmlrpc' === $context && ! defined( 'XMLRPC_REQUEST' ) ) {
			define( 'XMLRPC_REQUEST', true );
		}

		if ( 'cron' === $context && ! defined( 'DOING_CRON' ) ) {
			define( 'DOING_CRON', true );
		}

		// 蜜罐填上、令牌不给：正常访客绝不会交出这样的东西
		$_POST = array(
			yuki_comment_trap_field()  => 'i-am-a-robot',
			yuki_comment_token_field() => '',
		);

		// 表单那条路的处境要模拟完整：真实表单一定带 comment_post_ID，
		// 守卫的兜底判定也要求它（否则别的插件在 POST 里调 wp_new_comment() 会被误吞）。
		if ( 'form' === $context ) {
			$_POST['comment_post_ID'] = yuki_fx_post_id();
		}

		$content = YUKI_SUBMIT_MARK . ' 守卫范围探针 ' . $context;

		$result = wp_new_comment(
			array(
				'comment_post_ID'      => yuki_fx_post_id(),
				'comment_author'       => YUKI_SUBMIT_MARK . ' 探针',
				'comment_author_email' => 'submit-guard-probe@example.test',
				'comment_content'      => $content,
				'comment_author_IP'    => '127.0.0.1',
			),
			true
		);

		yuki_fx_emit( array(
			'context' => $context,
			'landed'  => ! is_wp_error( $result ),
			'comment' => is_wp_error( $result ) ? 0 : (int) $result,
			'code'    => is_wp_error( $result ) ? $result->get_error_code() : '',
		) );
		break;

	case 'blocklist':
		/*
		 * 「不允许的关键词」那个**全站选项**。--key=X 设上，什么都不给就还原成
		 * WordPress 的默认值（空）。
		 *
		 * 改全站设置是有代价的，所以这里只用**本工单独有的标记词**（别家绝不会拿它当评论
		 * 内容），而且每一轮开头（setup）与收尾（purge）都还原一次。命中它之后核心会把
		 * 审批状态设成 trash/spam 而不是给一个 WP_Error——这正是端点要单独处理的那种结果。
		 */
		$args     = yuki_fx_args( $argv );
		$previous = (string) get_option( 'disallowed_keys', '' );

		update_option( 'disallowed_keys', array_key_exists( 'key', $args ) ? (string) $args['key'] : '' );

		yuki_fx_emit( array(
			'previous' => $previous,
			'now'      => (string) get_option( 'disallowed_keys', '' ),
		) );
		break;

	case 'purge':
		$comments = 0;

		// 两篇都删（主文章与那篇空白文章），不然空白那篇会一直留在库
		foreach ( yuki_fx_all_post_ids() as $post_id ) {
			$comments += count( get_comments( array( 'post_id' => $post_id, 'status' => 'any' ) ) );
			wp_delete_post( $post_id, true );
		}

		// 收尾也还原一次：全站设置不该带着本工单的痕迹离开
		update_option( 'disallowed_keys', '' );

		yuki_fx_emit( array(
			'posts'    => count( yuki_fx_all_post_ids() ),
			'comments' => $comments,
		) );
		break;

	default:
		yuki_fx_emit( array( 'error' => '未知子命令: ' . $yuki_fx_cmd ) );
		exit( 2 );
}
