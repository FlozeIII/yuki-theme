<?php
/**
 * 工单 05 的造数与状态操作：待审评论对本人可见。
 *
 * 整条流程都能走 HTTP，这里只做两件 HTTP 做不到的事：**批准一条评论**（后台动作，要登录），
 * 以及**按邮箱数一下还有几条在待审**（给断言一个独立的旁证）。
 *
 * 用法: php comment-pending-fixtures.php <wordpress目录> <子命令> [--键=值 ...]
 *   approve --comment=<id>   把那一条改成已通过
 *   pending --email=<邮箱>   那个邮箱在这篇/这些文章下还有几条待审
 *   status  --comment=<id>   那一条的审批状态
 *   purge                    删掉本脚本标记过的测试评论
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会覆盖 WordPress 的全局 $wp。
$yuki_pend_root = $argv[1] ?? '';
$yuki_pend_cmd  = $argv[2] ?? '';

if ( ! $yuki_pend_root || ! file_exists( $yuki_pend_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php comment-pending-fixtures.php <wordpress目录> <子命令> [--键=值 ...]\n" );
	exit( 2 );
}

require $yuki_pend_root . '/wp-load.php';
unset( $yuki_pend_root );

/** 测试评论正文里的标记，清理时按它找。 */
const YUKI_PEND_MARK = 'YUKI-PENDING-TEST';

function yuki_pend_args( $argv ) {
	$args = array();
	foreach ( array_slice( $argv, 3 ) as $arg ) {
		if ( preg_match( '/^--([a-z-]+)=(.*)$/s', $arg, $m ) ) {
			$args[ $m[1] ] = $m[2];
		}
	}
	return $args;
}

function yuki_pend_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

/** 某个邮箱还有哪几条在等审核。 */
function yuki_pend_ids( $email ) {
	if ( '' === $email ) {
		return array();
	}

	return array_map(
		'intval',
		(array) get_comments(
			array(
				'author_email' => $email,
				'status'       => 'hold',
				'fields'       => 'ids',
				// 显式 0（不限条数）：默认只取一页，条数一多就数不准
				'number'       => 0,
			)
		)
	);
}

$yuki_pend_args = yuki_pend_args( $argv );

switch ( $yuki_pend_cmd ) {
	case 'approve':
		$comment_id = (int) ( $yuki_pend_args['comment'] ?? 0 );

		if ( ! get_comment( $comment_id ) ) {
			yuki_pend_emit( array( 'error' => '评论不存在: ' . $comment_id ) );
			exit( 2 );
		}

		$ok = wp_set_comment_status( $comment_id, 'approve' );
		// 状态改完把缓存清掉，否则紧接着的页面渲染可能读到旧状态
		clean_comment_cache( $comment_id );
		$after = get_comment( $comment_id );

		yuki_pend_emit(
			array(
				'comment'  => $comment_id,
				'ok'       => (bool) $ok,
				'approved' => $after ? (string) $after->comment_approved : 'missing',
			)
		);
		break;

	case 'post':
		/*
		 * 专门给这个工单造一篇自己的文章，不去借 site-info 那篇「最新一篇允许评论的文章」。
		 *
		 * 那篇常常正是**别的会话的造数文章**，而它们的收尾会把它删掉——删的时机落在
		 * 我这一轮中间的话，我的请求就打到 404 上，一堆断言以「东西不存在」的形式红，
		 * 看起来像我的代码坏了。这种失败我在同一台机器上见过好几次（一次 23/33）。
		 * 用自己建的文章，别人收尾就动不到我。
		 *
		 * 按标题找、找不到才建，所以可以反复跑；标题里刻意不带 `YUKI-TEST` 这类子串，
		 * 免得被谁按关键字搜出来连坐。
		 */
		$title = 'YUKI-PEND-05 待审可见性验证用的文章';

		$found = get_posts(
			array(
				'post_type'   => 'post',
				'post_status' => 'publish',
				'numberposts' => 1,
				'title'       => $title,
			)
		);

		if ( $found ) {
			$post_id = (int) $found[0]->ID;
		} else {
			$post_id = (int) wp_insert_post(
				array(
					'post_title'     => $title,
					'post_content'   => '<p>给工单 05 的验收用。</p>',
					'post_status'    => 'publish',
					'post_type'      => 'post',
					'post_author'    => 1,
					// 评论要开着，否则连评论表单都渲染不出来
					'comment_status' => 'open',
					'ping_status'    => 'closed',
				)
			);
		}

		$post = get_post( $post_id );

		yuki_pend_emit(
			array(
				'id'             => $post_id,
				'url'            => $post_id ? get_permalink( $post_id ) : '',
				'comment_status' => $post instanceof WP_Post ? $post->comment_status : '',
			)
		);
		break;

	case 'pending':
		$email = (string) ( $yuki_pend_args['email'] ?? '' );
		$ids   = yuki_pend_ids( $email );

		// 顺便把那个邮箱的**全部**评论（不分状态）也报出来。
		// 「没找到」有好几种可能：没入库、被审核通过了、被当成垃圾了、或者被谁删了——
		// 只报一句「0 条」的话，接下来只能靠猜。带上状态，失败信息自己就会说话。
		$all = array();
		if ( '' !== $email ) {
			foreach ( (array) get_comments(
				array(
					'author_email' => $email,
					'status'       => 'all',
					'number'       => 0,
				)
			) as $c ) {
				$all[] = array(
					'id'       => (int) $c->comment_ID,
					'status'   => (string) $c->comment_approved,
					'post_id'  => (int) $c->comment_post_ID,
					'approved' => (string) $c->comment_approved,
				);
			}
		}

		yuki_pend_emit(
			array(
				'email' => $email,
				'count' => count( $ids ),
				// 带上 id：勾了「记住我」的提交，跳转地址里**没有** unapproved 参数，
				// 验收脚本拿不到评论 id，只能从这里问
				'ids'   => $ids,
				'all'   => $all,
			)
		);
		break;

	case 'status':
		$comment_id = (int) ( $yuki_pend_args['comment'] ?? 0 );
		$comment    = get_comment( $comment_id );

		yuki_pend_emit(
			array(
				'comment'  => $comment_id,
				'exists'   => (bool) $comment,
				'approved' => $comment ? (string) $comment->comment_approved : '',
			)
		);
		break;

	case 'purge':
		/*
		 * 只清**够老**的测试评论。
		 *
		 * 标记是各个运行共用的，所以「按标记全删」等于：同一时刻另一个会话也在跑同一个
		 * 脚本的话，先收尾的那个会把对方**正在用**的评论一起删掉，对方的断言随即以
		 * 「东西不存在」的形式红——和「借别人那篇文章」是同一类坑。
		 *
		 * 代价是清理滞后：这一轮自己造的评论要等下一轮（或过一会儿）才被收走。
		 * 对本地环境这是划算的——留几条待审评论，比让并发的另一轮凭空变红好。
		 */
		$older_than = (int) ( $yuki_pend_args['older-than'] ?? 120 );
		$cutoff     = gmdate( 'Y-m-d H:i:s', time() - max( 0, $older_than ) );

		$found = get_comments(
			array(
				'search'    => YUKI_PEND_MARK,
				'status'    => 'any',
				'fields'    => 'ids',
				// 显式 0（不限条数）：默认只取一页，残留超过一页就清不干净
				'number'    => 0,
				'date_query' => array(
					array(
						'column' => 'comment_date_gmt',
						'before' => $cutoff,
					),
				),
			)
		);

		$removed = 0;
		foreach ( (array) $found as $comment_id ) {
			wp_delete_comment( (int) $comment_id, true );
			$removed++;
		}

		$left = get_comments(
			array(
				'search' => YUKI_PEND_MARK,
				'status' => 'any',
				'fields' => 'ids',
				'number' => 0,
			)
		);

		yuki_pend_emit(
			array(
				'removed'    => $removed,
				// left 是「标记名下还剩几条」，含本轮刚造的（还没到清理年龄）
				'left'       => count( (array) $left ),
				'cutoff'     => $cutoff,
				'older_than' => $older_than,
			)
		);
		break;

	default:
		yuki_pend_emit( array( 'error' => '未知子命令: ' . $yuki_pend_cmd ) );
		exit( 2 );
}
