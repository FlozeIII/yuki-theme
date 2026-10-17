<?php
/**
 * 前台发说说：处理器。
 *
 * 表单 POST 到 admin-post.php；只有有 publish_posts 的登录用户能提交。新说说仍然是一条
 * 普通 post，落在配置好的说说分类里。失败时把正文放进一个 5 分钟的 per-user transient，
 * 重定向回表单后还能看到，不用重打。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 重定向目标：说说归档；分类没配置时退回首页。永远不接收外部地址。
 *
 * @return string
 */
function yuki_shuoshuo_composer_target() {
	$category = function_exists( 'yuki_shuoshuo_category_id' )
		? (int) yuki_shuoshuo_category_id()
		: 0;

	if ( $category ) {
		$link = get_term_link( $category );
		if ( ! is_wp_error( $link ) ) {
			return $link;
		}
	}

	return home_url( '/' );
}

/**
 * 带错误码回到归档。非空正文先存一份草稿，表单渲染时会取出来。
 *
 * @param string $code 失败码。
 */
function yuki_shuoshuo_composer_fail( $code ) {
	if ( isset( $_POST['content'] ) ) {
		$draft = trim( wp_unslash( $_POST['content'] ) );
		if ( '' !== $draft ) {
			set_transient(
				'yuki_shuoshuo_draft_' . get_current_user_id(),
				$draft,
				5 * MINUTE_IN_SECONDS
			);
		}
	}

	wp_safe_redirect( add_query_arg( 'yuki_shuoshuo_error', $code, yuki_shuoshuo_composer_target() ) );
	exit;
}

/**
 * 表单渲染时取走草稿；取过就删，避免下次误填。
 *
 * @return string
 */
function yuki_shuoshuo_composer_take_draft() {
	$key   = 'yuki_shuoshuo_draft_' . get_current_user_id();
	$draft = get_transient( $key );

	if ( false === $draft ) {
		return '';
	}

	delete_transient( $key );

	return (string) $draft;
}

/**
 * admin-post.php 的处理入口。
 */
function yuki_shuoshuo_composer_handle() {
	if ( ! current_user_can( 'publish_posts' ) ) {
		yuki_shuoshuo_composer_fail( 'capability' );
	}

	$category = function_exists( 'yuki_shuoshuo_category_id' )
		? (int) yuki_shuoshuo_category_id()
		: 0;

	if ( ! $category ) {
		yuki_shuoshuo_composer_fail( 'no_category' );
	}

	$nonce = isset( $_POST['yuki_shuoshuo_nonce'] )
		? sanitize_text_field( wp_unslash( $_POST['yuki_shuoshuo_nonce'] ) )
		: '';

	if ( ! wp_verify_nonce( $nonce, 'yuki_shuoshuo_publish' ) ) {
		yuki_shuoshuo_composer_fail( 'nonce' );
	}

	$content = isset( $_POST['content'] ) ? trim( wp_unslash( $_POST['content'] ) ) : '';

	if ( '' === $content ) {
		yuki_shuoshuo_composer_fail( 'empty' );
	}

	$post_id = wp_insert_post(
		array(
			'post_title'    => '',
			'post_content'  => wp_kses_post( $content ),
			'post_status'   => 'publish',
			'post_type'     => 'post',
			'post_author'   => get_current_user_id(),
			'post_category' => array( $category ),
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		yuki_shuoshuo_composer_fail( 'failed' );
	}

	wp_safe_redirect( add_query_arg( 'yuki_shuoshuo_posted', '1', yuki_shuoshuo_composer_target() ) );
	exit;
}
add_action( 'admin_post_yuki_shuoshuo_publish', 'yuki_shuoshuo_composer_handle' );
