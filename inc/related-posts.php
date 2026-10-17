<?php
/**
 * 关联文章：同分类优先，不足用同标签补，最多三篇。
 *
 * 只用现有分类/标签，不引入新数据模型，也不做后台配置。规则固定、按日期倒序，
 * 验收才能稳定。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 取一篇关联文章列表。
 *
 * @param int $post_id 当前文章；0 表示使用循环里的当前文章。
 * @param int $limit   最多几篇。
 * @return WP_Post[]
 */
function yuki_related_posts( $post_id = 0, $limit = 3 ) {
	$post_id = $post_id ? (int) $post_id : (int) get_the_ID();
	$limit   = max( 1, (int) $limit );

	if ( ! $post_id || 'post' !== get_post_type( $post_id ) ) {
		return array();
	}

	$shuoshuo_cat = function_exists( 'yuki_shuoshuo_category_id' )
		? (int) yuki_shuoshuo_category_id()
		: 0;

	// 说说本身就是短碎片，不给它挂「延伸阅读」。
	if ( $shuoshuo_cat && has_category( $shuoshuo_cat, $post_id ) ) {
		return array();
	}

	$base = array(
		'post_type'           => 'post',
		'post_status'         => 'publish',
		'numberposts'         => $limit,
		'post__not_in'        => array( $post_id ),
		'ignore_sticky_posts' => true,
		'no_found_rows'       => true,
		'orderby'             => 'date',
		'order'               => 'DESC',
	);

	// 短说说不要混进关联结果。
	if ( $shuoshuo_cat ) {
		$base['category__not_in'] = array( $shuoshuo_cat );
	}

	$found = array();
	$cats  = wp_get_post_categories( $post_id );

	if ( $cats ) {
		$args            = $base;
		$args['category__in'] = $cats;
		$found           = get_posts( $args );
	}

	if ( count( $found ) < $limit ) {
		$tags = wp_get_post_tags( $post_id, array( 'fields' => 'ids' ) );

		if ( $tags ) {
			$args                 = $base;
			$args['numberposts']  = $limit - count( $found );
			$args['post__not_in'] = array_merge( array( $post_id ), wp_list_pluck( $found, 'ID' ) );
			$args['tag__in']      = $tags;

			$found = array_merge( $found, get_posts( $args ) );
		}
	}

	return array_slice( $found, 0, $limit );
}
