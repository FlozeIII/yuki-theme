<?php
/**
 * 工单 07 的造数与状态操作：访客自己删评论。
 *
 * 整条流程（提交 → 邮件里取链接 → 打开确认页 → 确认删除）都能走 HTTP，所以这里的
 * 职责很窄：**把令牌弄过期**——那件事除了等一个星期，没有 HTTP 办法能做到。
 *
 * 用法: php comment-deletion-fixtures.php <wordpress目录> <子命令> [--键=值 ...]
 *   expire --comment=<id>   把那条评论的删除令牌改成已过期
 *   meta --comment=<id>     打印那条评论的令牌元数据现状
 *   approve --comment=<id>  把那条评论改成已通过，好让它真的出现在文章页上
 *   purge                   删掉本脚本标记过的测试评论
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会覆盖 WordPress 的全局 $wp。
$yuki_del_root = $argv[1] ?? '';
$yuki_del_cmd  = $argv[2] ?? '';

if ( ! $yuki_del_root || ! file_exists( $yuki_del_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php comment-deletion-fixtures.php <wordpress目录> <子命令> [--键=值 ...]\n" );
	exit( 2 );
}

require $yuki_del_root . '/wp-load.php';
unset( $yuki_del_root );

/** 测试评论正文里带的标记，清理时按它找。 */
const YUKI_DEL_MARK = 'YUKI-DELETE-TEST';

/**
 * 过期时间存在哪个元数据键上。
 *
 * 这是**刻意**跟主题的实现耦合的：要验「过期链接无效」，除了真等一个星期没有别的办法，
 * 而主题不该为了测试长出一个「把有效期设成一秒」的开关（工单 01 的验收里明确禁止）。
 *
 * 耦合的风险用断言堵住：子命令会回报 `had_key`（改动之前这个键在不在），
 * 验收脚本断言它为真。主题哪天换了键名，这里会写进一个不存在的键，`had_key` 立刻是假、
 * 断言红——响亮地失败，而不是静默地验了个寂寞。
 */
const YUKI_DEL_EXPIRE_KEY = 'yuki_comment_delete_expires';

function yuki_del_args( $argv ) {
	$args = array();
	foreach ( array_slice( $argv, 3 ) as $arg ) {
		if ( preg_match( '/^--([a-z-]+)=(.*)$/s', $arg, $m ) ) {
			$args[ $m[1] ] = $m[2];
		}
	}
	return $args;
}

function yuki_del_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

/** 那条评论的令牌元数据现状。 */
function yuki_del_meta( $comment_id ) {
	$all = get_comment_meta( $comment_id );

	// 只报键名与「是不是时间戳」，不报值——值是哈希，没必要带出来
	$keys = array();
	foreach ( array_keys( (array) $all ) as $key ) {
		$keys[] = $key;
	}

	$expires = get_comment_meta( $comment_id, YUKI_DEL_EXPIRE_KEY, true );

	return array(
		'comment'      => (int) $comment_id,
		'exists'       => (bool) get_comment( $comment_id ),
		'meta_keys'    => $keys,
		'has_key'      => metadata_exists( 'comment', $comment_id, YUKI_DEL_EXPIRE_KEY ),
		'expires'      => is_numeric( $expires ) ? (int) $expires : null,
		'seconds_left' => is_numeric( $expires ) ? ( (int) $expires - time() ) : null,
	);
}

$yuki_del_args = yuki_del_args( $argv );

switch ( $yuki_del_cmd ) {
	case 'meta':
		// 评论不存在**不是错误**，正是要问的那件事：「它还在吗」。
		// 这里要是 exit(2)，验收脚本拿到的是 {error}，`exists === false` 会是 undefined === false
		// ——红得莫名其妙，而实际行为完全正确。
		yuki_del_emit( yuki_del_meta( (int) ( $yuki_del_args['comment'] ?? 0 ) ) );
		break;

	case 'expire':
		$comment_id = (int) ( $yuki_del_args['comment'] ?? 0 );

		if ( ! get_comment( $comment_id ) ) {
			yuki_del_emit( array( 'error' => '评论不存在: ' . $comment_id ) );
			exit( 2 );
		}

		// 先记下改之前的现状，好让验收脚本判断键名有没有对错
		$before = yuki_del_meta( $comment_id );

		update_comment_meta( $comment_id, YUKI_DEL_EXPIRE_KEY, time() - 60 );

		$after             = yuki_del_meta( $comment_id );
		$after['had_key']  = $before['has_key'];
		$after['keys_before'] = $before['meta_keys'];
		yuki_del_emit( $after );
		break;

	case 'approve':
		/*
		 * 未登录访客的第一条评论会被核心扣在待审队列里，文章页上看不见。
		 * 「删除之后不再可见」这条要验得有意义，就得先让它可见——
		 * 否则删除前后都是「看不见」，断言等于没验。
		 */
		$comment_id = (int) ( $yuki_del_args['comment'] ?? 0 );

		if ( ! get_comment( $comment_id ) ) {
			yuki_del_emit( array( 'error' => '评论不存在: ' . $comment_id ) );
			exit( 2 );
		}

		$ok = wp_set_comment_status( $comment_id, 'approve' );
		// 状态改了之后把评论缓存清掉，否则紧接着的页面渲染可能读到旧值
		clean_comment_cache( $comment_id );

		yuki_del_emit(
			array(
				'comment'  => $comment_id,
				'ok'       => (bool) $ok,
				'approved' => get_comment( $comment_id ) ? (int) get_comment( $comment_id )->comment_approved : -1,
			)
		);
		break;

	case 'purge':
		$found = get_comments(
			array(
				'search' => YUKI_DEL_MARK,
				'status' => 'any',
				'fields' => 'ids',
				// 必须显式写 0（不限条数）：get_comments 默认只取一页，
				// 残留超过一页时清理会清不干净，而它还报告「剩 N 条」看着像没事。
				'number' => 0,
			)
		);

		$removed = 0;
		foreach ( (array) $found as $comment_id ) {
			wp_delete_comment( (int) $comment_id, true );
			$removed++;
		}

		yuki_del_emit(
			array(
				'removed' => $removed,
				'left'    => count(
					(array) get_comments(
						array(
							'search' => YUKI_DEL_MARK,
							'status' => 'any',
							'fields' => 'ids',
						)
					)
				),
			)
		);
		break;

	default:
		yuki_del_emit( array( 'error' => '未知子命令: ' . $yuki_del_cmd ) );
		exit( 2 );
}
