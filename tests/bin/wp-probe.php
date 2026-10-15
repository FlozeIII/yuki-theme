<?php
/**
 * 需要在 WordPress 引导起来之后才能做的事，供验收脚本调用。
 *
 * 它的用处是「在主题之外发起真实的 WordPress 行为」：一言还没做出来的时候要验上游转投，
 * 或者要验邮件捕获跟主题没关系的时候，都得绕开主题来敲 WordPress 本身。
 *
 * 用法: php wp-probe.php <wordpress目录> <子命令> [参数]
 *   site-info             站点地址、当前主题、可评论的文章及其地址、评论通知开关
 *   comment --post=<id> [--content=<文本>] [--theme=<slug>]
 *                         造一条评论。走的是 wp_new_comment()，**不经过评论表单**，
 *                         所以主题自己的表单校验（蜜罐、令牌）跟这条路无关。
 *                         --theme 只换选项，不卸掉当前进程里已加载的主题代码，
 *                         要验「换主题」请在独立进程里用 switch-theme。
 *   switch-theme <slug>   切换启用中的主题
 *   http-get <url>        用 wp_remote_get() 真发一次请求
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * @package Yuki\DevHarness
 */

// 这个变量绝不能叫 $wp —— require 是在本文件的全局作用域里执行的，WordPress 自己的
// 全局 $wp 会被这个字符串覆盖，然后 WP 类上直接致命错误。fixtures.php 里踩过一次。
$yuki_probe_root = $argv[1] ?? '';
$yuki_probe_cmd  = $argv[2] ?? '';

if ( ! $yuki_probe_root || ! file_exists( $yuki_probe_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php wp-probe.php <wordpress目录> <子命令> [参数]\n" );
	exit( 2 );
}

require $yuki_probe_root . '/wp-load.php';
unset( $yuki_probe_root );

/** 把 --键=值 形式的参数读成一个数组。 */
function yuki_probe_args( $argv ) {
	$args = array();
	foreach ( array_slice( $argv, 3 ) as $arg ) {
		if ( preg_match( '/^--([a-z-]+)=(.*)$/s', $arg, $m ) ) {
			$args[ $m[1] ] = $m[2];
		}
	}
	return $args;
}

function yuki_probe_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

$yuki_probe_args = yuki_probe_args( $argv );

switch ( $yuki_probe_cmd ) {
	case 'site-info':
		$post = null;
		$published = get_posts(
			array(
				'post_type'   => 'post',
				'post_status' => 'publish',
				'numberposts' => 20,
			)
		);
		foreach ( $published as $candidate ) {
			if ( 'open' === $candidate->comment_status ) {
				$post = $candidate;
				break;
			}
		}

		yuki_probe_emit(
			array(
				'siteurl'           => get_option( 'siteurl' ),
				'home'              => home_url( '/' ),
				'stylesheet'        => get_stylesheet(),
				'admin_email'       => get_option( 'admin_email' ),
				'comments_notify'   => (int) get_option( 'comments_notify' ),
				'moderation_notify' => (int) get_option( 'moderation_notify' ),
				'post_id'           => $post ? (int) $post->ID : 0,
				'post_title'        => $post ? $post->post_title : '',
				'post_url'          => $post ? get_permalink( $post ) : '',
			)
		);
		break;

	case 'switch-theme':
		/*
		 * 单独一个子命令、单独一个进程：要验「主题未启用时基建照样工作」，
		 * 必须在**另一个进程**里做后续动作。switch_theme() 只换选项，
		 * 不会把已经加载进来的旧主题 functions.php 卸掉——在同一个进程里接着
		 * wp_new_comment()，旧主题的钩子还挂着，验的就不是「未启用」。
		 */
		$slug = (string) ( array_slice( $argv, 3 )[0] ?? '' );

		if ( '' === $slug || ! wp_get_theme( $slug )->exists() ) {
			yuki_probe_emit( array( 'error' => '主题不存在: ' . $slug ) );
			exit( 2 );
		}

		switch_theme( $slug );
		yuki_probe_emit( array( 'stylesheet' => get_stylesheet() ) );
		break;

	case 'comment':
		$post_id = (int) ( $yuki_probe_args['post'] ?? 0 );
		$theme   = (string) ( $yuki_probe_args['theme'] ?? '' );
		$content = (string) ( $yuki_probe_args['content'] ?? ( 'YUKI-TEST 探针评论 ' . gmdate( 'c' ) ) );

		$theme_before = get_stylesheet();
		if ( '' !== $theme && $theme !== $theme_before ) {
			switch_theme( $theme );
		}

		try {
			// 第二个参数 true：不去 wp_die，出问题就返回 WP_Error。
			// 走的仍然是完整管线——审核、入库、通知邮件都在。
			$comment_id = wp_new_comment(
				array(
					'comment_post_ID'      => $post_id,
					'comment_content'      => $content,
					'comment_author'       => 'YUKI-TEST 探针',
					'comment_author_email' => 'yuki-probe@example.test',
					'comment_author_url'   => '',
					'comment_author_IP'    => '198.51.100.7',
					'comment_agent'        => 'yuki-harness',
					'comment_type'         => 'comment',
					'comment_parent'       => 0,
				),
				true
			);
		} finally {
			if ( '' !== $theme && $theme !== $theme_before ) {
				switch_theme( $theme_before );
			}
		}

		$comment = is_wp_error( $comment_id ) ? null : get_comment( $comment_id );

		yuki_probe_emit(
			array(
				'comment_id'   => $comment ? (int) $comment->comment_ID : 0,
				'approved'     => $comment ? (int) $comment->comment_approved : 0,
				'theme_before' => $theme_before,
				'theme_after'  => get_stylesheet(),
				'is_error'     => is_wp_error( $comment_id ),
				// 失败时把内核给的原因带出来——没有这个的话，「没入库」就得靠猜
				'error'        => is_wp_error( $comment_id )
					? $comment_id->get_error_code() . ': ' . $comment_id->get_error_message()
					: '',
			)
		);
		break;

	case 'http-get':
		$url      = (string) ( array_slice( $argv, 3 )[0] ?? '' );
		$response = wp_remote_get( $url, array( 'timeout' => 3 ) );

		if ( is_wp_error( $response ) ) {
			yuki_probe_emit( array( 'error' => $response->get_error_message() ) );
			break;
		}

		yuki_probe_emit(
			array(
				'status' => (int) wp_remote_retrieve_response_code( $response ),
				'body'   => (string) wp_remote_retrieve_body( $response ),
			)
		);
		break;

	default:
		yuki_probe_emit( array( 'error' => '未知子命令: ' . $yuki_probe_cmd ) );
		exit( 2 );
}
