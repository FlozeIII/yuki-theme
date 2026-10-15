<?php
/**
 * 工单 06 的造数：评论点赞。
 *
 * 点赞的断言全在 HTTP 面上（页面上显示几个赞、端点回什么、刷新之后还在不在），
 * 所以夹具只需要准备好**可以被点赞的评论**：一篇自己的文章、三条已过审的评论、
 * 一条待审的（用来验「待审的不给点赞入口、端点也不收」）。
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * 用法: php comment-likes-fixtures.php <wordpress目录> <子命令>
 *   state   当前实况：主题、可用的文章与评论、点赞端点的地址
 *   setup   清掉上批造数，重新造一篇文章与四条评论（三条已过审、一条待审）
 *   purge   清掉本脚本造过的内容
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会把 WordPress 的全局 $wp 覆盖掉。
$yuki_fx_root = $argv[1] ?? '';
$yuki_fx_cmd  = $argv[2] ?? '';

if ( ! $yuki_fx_root || ! file_exists( $yuki_fx_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php comment-likes-fixtures.php <wordpress目录> <子命令>\n" );
	exit( 2 );
}

require $yuki_fx_root . '/wp-load.php';
unset( $yuki_fx_root );

/** 本脚本造的内容都带这个前缀，purge 靠它精确清理。 */
const YUKI_LIKES_MARK = 'YUKI-LIKES';

/**
 * 造出来的文章刻意排得很旧。
 *
 * 别的会话的夹具会取「最新一篇允许评论的文章」当靶子（wp-probe 的 site-info 就是），
 * 我这篇要是排在最前面，就会把它们的靶子挪走。验收认的是「页面上有没有那个控件」，
 * 文章排第几无所谓。
 */
const YUKI_LIKES_POST_DATE = '2020-01-01 00:00:00';

function yuki_fx_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

/** 本脚本造的所有文章。 */
function yuki_fx_posts() {
	return get_posts(
		array(
			'post_type'   => 'post',
			'post_status' => 'any',
			'numberposts' => -1,
			'fields'      => 'ids',
			's'           => YUKI_LIKES_MARK,
		)
	);
}

/** 清掉本脚本造过的一切。 */
function yuki_fx_purge() {
	$comments = 0;

	foreach ( yuki_fx_posts() as $post_id ) {
		// 评论跟着文章一起删（force 掉回收站）
		foreach ( get_comments( array( 'post_id' => $post_id, 'status' => 'any', 'fields' => 'ids' ) ) as $comment_id ) {
			wp_delete_comment( (int) $comment_id, true );
			$comments++;
		}
		wp_delete_post( $post_id, true );
	}

	return array(
		'posts'    => count( yuki_fx_posts() ),
		'comments' => $comments,
	);
}

/** 一篇文章 + 三条已过审 + 一条待审。 */
function yuki_fx_build() {
	$post_id = wp_insert_post(
		array(
			'post_title'     => YUKI_LIKES_MARK . ' 点赞验收用文章',
			'post_content'   => '<p>点赞验收用的文章。</p>',
			'post_status'    => 'publish',
			'post_type'      => 'post',
			'comment_status' => 'open',
			'post_date'      => YUKI_LIKES_POST_DATE,
			'post_date_gmt'  => YUKI_LIKES_POST_DATE,
		)
	);

	if ( is_wp_error( $post_id ) || ! $post_id ) {
		return null;
	}

	$approved = array();

	for ( $i = 1; $i <= 3; $i++ ) {
		$comment_id = wp_insert_comment(
			array(
				'comment_post_ID'      => $post_id,
				'comment_author'       => sprintf( '%s 访客 %d', YUKI_LIKES_MARK, $i ),
				'comment_author_email' => sprintf( 'likes%d@example.test', $i ),
				'comment_content'      => sprintf( '%s 第 %d 条评论。', YUKI_LIKES_MARK, $i ),
				'comment_approved'     => 1,
				'comment_date'         => gmdate( 'Y-m-d H:i:s', strtotime( YUKI_LIKES_POST_DATE . ' +' . $i . ' minutes' ) ),
				'comment_date_gmt'     => gmdate( 'Y-m-d H:i:s', strtotime( YUKI_LIKES_POST_DATE . ' +' . $i . ' minutes' ) ),
			)
		);

		if ( $comment_id ) {
			$approved[] = (int) $comment_id;
		}
	}

	$pending_id = wp_insert_comment(
		array(
			'comment_post_ID'      => $post_id,
			'comment_author'       => YUKI_LIKES_MARK . ' 待审者',
			'comment_author_email' => 'likes-pending@example.test',
			'comment_content'      => YUKI_LIKES_MARK . ' 一条还没过审的评论。',
			'comment_approved'     => 0,
			'comment_date'         => gmdate( 'Y-m-d H:i:s', strtotime( YUKI_LIKES_POST_DATE . ' +10 minutes' ) ),
			'comment_date_gmt'     => gmdate( 'Y-m-d H:i:s', strtotime( YUKI_LIKES_POST_DATE . ' +10 minutes' ) ),
		)
	);

	return array(
		'post_id'    => (int) $post_id,
		'comments'   => $approved,
		'pending_id' => (int) $pending_id,
	);
}

function yuki_fx_state() {
	$posts = yuki_fx_posts();

	return array(
		'theme'    => get_stylesheet(),
		// 核心读评论者 cookie 时用的是带 COOKIEHASH 的名字（comment_author_email_<hash>），
		// 验收要「以那条待审评论作者的身份」打开页面，就得知道这个后缀
		'cookie_hash' => COOKIEHASH,
		// 端点地址由主题注册、由核心的 rest_url() 拼出来，形状随固定链接设置变，
		// 所以由 PHP 算给验收脚本，而不是在脚本里写死一个 /wp-json/...
		'endpoint' => rest_url( 'yuki/v1/comment-like' ),
		'post_id'  => $posts ? (int) $posts[0] : 0,
		'post_url' => $posts ? get_permalink( (int) $posts[0] ) : '',
		'comments' => $posts
			? array_map( 'intval', get_comments( array( 'post_id' => (int) $posts[0], 'status' => 'approve', 'fields' => 'ids' ) ) )
			: array(),
		'pending'  => $posts
			? array_map( 'intval', get_comments( array( 'post_id' => (int) $posts[0], 'status' => 'hold', 'fields' => 'ids' ) ) )
			: array(),
	);
}

switch ( $yuki_fx_cmd ) {
	case 'state':
		yuki_fx_emit( yuki_fx_state() );
		break;

	case 'setup':
		$purged = yuki_fx_purge();
		$built  = yuki_fx_build();

		if ( ! $built || count( $built['comments'] ) < 3 ) {
			yuki_fx_emit( array( 'error' => '造数失败：文章或评论没建全', 'built' => $built ) );
			exit( 2 );
		}

		$state           = yuki_fx_state();
		$state['purged'] = $purged;
		yuki_fx_emit( $state );
		break;

	case 'purge':
		yuki_fx_emit( yuki_fx_purge() );
		break;

	default:
		yuki_fx_emit( array( 'error' => '未知子命令: ' . $yuki_fx_cmd ) );
		exit( 2 );
}
