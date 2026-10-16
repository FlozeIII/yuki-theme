<?php
/**
 * 工单 03 的造数：一篇用分页标记切开的文章（外加同样的一份静态页面）。
 *
 * 「第二页够不着」那一处缺陷，只有真的拿一篇带 `<!--nextpage-->` 的内容才验得了——
 * 光看模板里有没有 `wp_link_pages()` 是把实现细节当断言。所以这里造出那篇内容。
 *
 * **每次 ensure 都新造一篇**，不按「同一个身份就地更新」。就地更新会在两个会话同时跑这份验收时
 * 互相改内容：甲拿到的页面是乙刚写进去的那个 RUN，于是甲那些「第一页只有第一页那段」的断言
 * 红得莫名其妙，而功能本身是好的。新造一篇则各读各的。
 *
 * 另外给文章开评论：确认页的标题那一条要一条**能拿到删除链接**的评论，
 * 而评论走 HTTP 提交（见验收脚本），这里只把可以提交的地方准备出来。
 *
 * 用法: php theme-check-defects-fixtures.php <wordpress目录> <子命令> [--键=值 ...]
 *   ensure --kind=<post|page> --paginated=<0|1> [--run=<标记>]
 *                          新造一篇内容，返回它的 id 与地址
 *   purge [--ids=1,2,3]    删掉本脚本造过的内容。给了 ids 就只删这几篇（验收脚本走这条，
 *                          不去动别的会话正在用的那几篇）；不给 id 则清掉全部带标记的，
 *                          留给「上一轮崩在半路」那种残留手工收拾。
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * 只碰自己造的那几篇内容与它们的元数据：**不改任何全站设置**。
 * 文章自己的 `comment_status` 不算全站设置，且只为「能提交一条评论」而开。
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会覆盖 WordPress 的全局 $wp。
$yuki_def_root = $argv[1] ?? '';
$yuki_def_cmd  = $argv[2] ?? '';

if ( ! $yuki_def_root || ! file_exists( $yuki_def_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php theme-check-defects-fixtures.php <wordpress目录> <子命令> [--键=值 ...]\n" );
	exit( 2 );
}

require $yuki_def_root . '/wp-load.php';
unset( $yuki_def_root );

/** 本脚本造的内容都带这个元数据键，清理时按它找。 */
const YUKI_DEF_META = 'yuki_release_defects_fixture';

/** 正文里的标记。断言「第二页只有第二页那段」时按它数出现次数。 */
const YUKI_DEF_MARK = 'YUKI-PAGEBREAK-TEST';

/** WordPress 认的分页标记。 */
const YUKI_DEF_BREAK = '<!--nextpage-->';

function yuki_def_args( $argv ) {
	$args = array();
	foreach ( array_slice( $argv, 3 ) as $arg ) {
		if ( preg_match( '/^--([a-z-]+)=(.*)$/s', $arg, $m ) ) {
			$args[ $m[1] ] = $m[2];
		}
	}
	return $args;
}

function yuki_def_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

/** 正文：第一页一段、分页标记、第二页一段。两段都带标记，方便在页面上按段找。 */
function yuki_def_content( $paginated, $run ) {
	$first  = YUKI_DEF_MARK . ' 第一页正文 ' . $run;
	$second = YUKI_DEF_MARK . ' 第二页正文 ' . $run;

	if ( ! $paginated ) {
		return $first . '。整篇都在一页里，没有分页标记。';
	}

	return $first . "\n\n" . YUKI_DEF_BREAK . "\n\n" . $second;
}

/** 带标记的全部内容。 */
function yuki_def_all() {
	return get_posts(
		array(
			'post_type'   => array( 'post', 'page' ),
			'post_status' => 'any',
			'numberposts' => -1,
			'meta_key'    => YUKI_DEF_META,
		)
	);
}

/** 那篇内容现在的样子——验收脚本靠它判断「造数真的成了」。 */
function yuki_def_report( $post ) {
	if ( ! $post instanceof WP_Post ) {
		return array( 'id' => 0 );
	}

	// permalink 与标题都按页面渲染时真正会用的那套取，不自己拼。
	return array(
		'id'             => (int) $post->ID,
		'kind'           => $post->post_type,
		'url'            => get_permalink( $post ),
		'title'          => get_the_title( $post ),
		'comment_status' => $post->comment_status,
		'has_pagebreak'  => false !== strpos( $post->post_content, YUKI_DEF_BREAK ),
		'content'        => $post->post_content,
	);
}

$yuki_def_args = yuki_def_args( $argv );

switch ( $yuki_def_cmd ) {
	case 'ensure':
		$kind      = (string) ( $yuki_def_args['kind'] ?? 'post' );
		$paginated = ( '1' === (string) ( $yuki_def_args['paginated'] ?? '1' ) );
		$run       = (string) ( $yuki_def_args['run'] ?? gmdate( 'YmdHis' ) );

		if ( ! in_array( $kind, array( 'post', 'page' ), true ) ) {
			yuki_def_emit( array( 'error' => 'kind 只能是 post 或 page: ' . $kind ) );
			exit( 2 );
		}

		$post_id = wp_insert_post(
			array(
				'post_type'    => $kind,
				'post_status'  => 'publish',
				'post_title'   => sprintf(
					'%s %s %s',
					YUKI_DEF_MARK,
					'page' === $kind ? 'page' : 'post',
					( $paginated ? 'paginated' : 'plain' ) . ' ' . $run
				),
				'post_content' => yuki_def_content( $paginated, $run ),
				// 标题里只用 ASCII 与连字符：验收脚本要拿它去跟渲染出来的标题对，
				// 中文标题过一遍 wptexturize / 实体编码之后就对不上了，红的会是测试自己。
				'comment_status' => 'post' === $kind ? 'open' : 'closed',
			),
			true
		);

		if ( is_wp_error( $post_id ) ) {
			yuki_def_emit( array( 'error' => $post_id->get_error_code() . ': ' . $post_id->get_error_message() ) );
			exit( 2 );
		}

		update_post_meta( $post_id, YUKI_DEF_META, $kind . '|' . ( $paginated ? 'paginated' : 'plain' ) . '|' . $run );

		yuki_def_emit( yuki_def_report( get_post( $post_id ) ) );
		break;

	case 'purge':
		$ids = array_filter( array_map( 'intval', explode( ',', (string) ( $yuki_def_args['ids'] ?? '' ) ) ) );

		$removed = 0;
		foreach ( yuki_def_all() as $post ) {
			// 给了 ids 就只删这几篇：同一条环境上可能同时开着别的会话，
			// 按标记大扫除会把它们正在用的那几篇一并删掉，那边就会红得莫名其妙。
			if ( $ids && ! in_array( (int) $post->ID, $ids, true ) ) {
				continue;
			}

			// 第二个参数 true：彻底删掉，不留修订与回收站里的残留。
			wp_delete_post( (int) $post->ID, true );
			$removed++;
		}

		$left = 0;
		foreach ( yuki_def_all() as $post ) {
			$left++;
		}

		yuki_def_emit( array( 'removed' => $removed, 'left' => $left ) );
		break;

	default:
		yuki_def_emit( array( 'error' => '未知子命令: ' . $yuki_def_cmd ) );
		exit( 2 );
}
