<?php
/**
 * 工单 04 的造数与状态操作：说说的承载体分类。
 *
 * 这个工单验的是「配置 + 排除」，光有固定数据不够——还得能**在测试中途改状态**：
 * 改配置、删分类、给分类改名换 slug、重新触发一次主题激活。这些都必须先把
 * WordPress 引导起来，所以单独放这里，由 verify-shuoshuo.mjs 逐个调用。
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * 用法: php shuoshuo-fixtures.php <wordpress目录> <子命令> [--键=值 ...]
 *   state            当前配置、承载体分类的实况、验证分类
 *   setup            建好承载体分类与标记内容（可重复执行，先清掉上批同标记的）
 *   set --id=<n>     把承载体改成分类 <n>（0 = 未配置）
 *   delete-carrier   删掉当前承载体分类，模拟「用户把它删了」
 *   rename --name=<s> [--slug=<s>]   给当前承载体分类改名、换 slug
 *   activate         真的切走再切回主题，触发一次 after_switch_theme
 *   teardown         删掉本脚本造的标记内容
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会把 WordPress 的全局 $wp 覆盖掉。
$yuki_fx_root = $argv[1] ?? '';
$yuki_fx_cmd  = $argv[2] ?? '';

if ( ! $yuki_fx_root || ! file_exists( $yuki_fx_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php shuoshuo-fixtures.php <wordpress目录> <子命令> [--键=值 ...]\n" );
	exit( 2 );
}

require $yuki_fx_root . '/wp-load.php';
unset( $yuki_fx_root );

/** 本脚本造的所有内容的标题前缀，teardown 靠它精确清理。 */
const YUKI_FX_MARK = 'YUKI-SHUOSHUO';

const YUKI_FX_CARRIER_SLUG = 'shuoshuo';
const YUKI_FX_VERIFY_SLUG  = 'yuki-verify';

/**
 * 每轮各造多少条。
 *
 * 按站点实际的「每页文章数」算，而不是写死 12：写死的话，站点的每页条数一旦被调大，
 * 或者别处留下的文章把页数撑开，第二页就可能是空的——断言会为跟排除无关的原因变红。
 * 取两页多一点，保证两件事同时成立：不排除时说说占满第一页；排除之后仍有第二页可翻。
 *
 * @return array{shuoshuo:int,normal:int}
 */
function yuki_fx_counts() {
	$per_page = max( 1, (int) get_option( 'posts_per_page', 10 ) );
	// 比一页多几条就够：不排除时能填满第一页，排除之后仍剩得下第二页
	$each     = $per_page + 4;

	return array(
		'shuoshuo' => $each,
		'normal'   => $each,
	);
}

function yuki_fx_args( $argv ) {
	$args = array();
	foreach ( array_slice( $argv, 3 ) as $arg ) {
		if ( preg_match( '/^--([a-z-]+)=(.*)$/s', $arg, $m ) ) {
			$args[ $m[1] ] = $m[2];
		}
	}
	return $args;
}

function yuki_fx_emit( $data ) {
	echo wp_json_encode( $data ), "\n";
}

/**
 * 当前承载体分类的 term 对象；没配、或配的那个已经被删，都返回 null。
 *
 * 问主题「说说归哪个分类」而不是自己把 theme mod 当整数解一次：配置里存的到底是
 * 标识还是 slug 是**主题的实现细节**，造数脚本替它假定一种，就等于把那一节测验
 * 变成了对这份假定的测验——主题真按 slug 存时，脚本会连分类都找不到，
 * 测试在门口就崩了，改名那条断言根本没机会跑。
 */
function yuki_fx_carrier_term() {
	$id = function_exists( 'yuki_shuoshuo_category_id' ) ? (int) yuki_shuoshuo_category_id() : 0;

	if ( $id <= 0 ) {
		return null;
	}

	$term = get_term( $id, 'category' );

	return ( $term instanceof WP_Term ) ? $term : null;
}

/** 承载体分类（不存在则创建）的 term_id 与它的归档地址。 */
function yuki_fx_ensure_carrier() {
	$term = get_term_by( 'slug', YUKI_FX_CARRIER_SLUG, 'category' );
	if ( ! $term ) {
		$created = wp_insert_term( '说说', 'category', array( 'slug' => YUKI_FX_CARRIER_SLUG ) );
		if ( is_wp_error( $created ) ) {
			return null;
		}
		$term = get_term( (int) $created['term_id'], 'category' );
	}

	return $term instanceof WP_Term ? $term : null;
}

/** 正式文章用的分类，用来验「其他分类归档不受影响」。 */
function yuki_fx_ensure_verify_cat() {
	$term = get_term_by( 'slug', YUKI_FX_VERIFY_SLUG, 'category' );
	if ( ! $term ) {
		$created = wp_insert_term( '验证分类', 'category', array( 'slug' => YUKI_FX_VERIFY_SLUG ) );
		if ( is_wp_error( $created ) ) {
			return null;
		}
		$term = get_term( (int) $created['term_id'], 'category' );
	}

	return $term instanceof WP_Term ? $term : null;
}

/** 删掉本脚本造过的所有文章。 */
function yuki_fx_purge() {
	$old = get_posts(
		array(
			'post_type'   => 'post',
			'post_status' => 'any',
			'numberposts' => -1,
			'fields'      => 'ids',
			's'           => YUKI_FX_MARK,
		)
	);
	foreach ( $old as $id ) {
		// 顺手取消置顶：删掉文章不会把它从 sticky_posts 选项里摘干净，
		// 留着的 id 会指向不存在的文章，影响后面的置顶判断
		unstick_post( $id );
		wp_delete_post( $id, true );
	}

	return count( $old );
}

function yuki_fx_state() {
	$term = yuki_fx_carrier_term();

	return array(
		'theme'          => get_stylesheet(),
		// 存进 theme mod 的**原始值，不做类型转换**。验「存的是分类标识而不是 slug」
		// 看的就是它：是标识就该一直是同一个整数，改分类名、换 slug 都动不了它。
		// 这里要是先 (int) 一下，slug 也会被压成 0，断言反而看不出区别。
		'mod'            => get_theme_mod( 'yuki_shuoshuo_category', 0 ),
		'carrier_exists' => (bool) $term,
		'carrier_id'     => $term ? (int) $term->term_id : 0,
		'carrier_name'   => $term ? $term->name : '',
		'carrier_slug'   => $term ? $term->slug : '',
		'carrier_url'    => $term ? get_category_link( $term->term_id ) : '',
	);
}

$yuki_fx_args = yuki_fx_args( $argv );

switch ( $yuki_fx_cmd ) {
	case 'state':
		yuki_fx_emit( yuki_fx_state() );
		break;

	case 'setup':
		$removed = yuki_fx_purge();

		$verify = yuki_fx_ensure_verify_cat();
		if ( ! $verify ) {
			yuki_fx_emit( array( 'error' => '验证分类建不出来' ) );
			exit( 2 );
		}

		/*
		 * 承载体是谁：先看**当前配置**，它可能是主题自己写进去的（激活时补建那一步）。
		 * 只有配置不可用的时候，才自己建一个并把配置写上。
		 *
		 * 这一点决定了「改名换 slug」那一节有没有意义：造数脚本永远写 int id，配置要是
		 * 由它写，改名就不可能导致失效，断言怎么改都绿。所以**不覆盖**已有的可用配置。
		 *
		 * 也刻意不在这里重写「怎么从配置找到分类」——那是主题的逻辑，复制一份来用，
		 * 测验的就成了这份复制品。
		 */
		$carrier_id = function_exists( 'yuki_shuoshuo_category_id' ) ? (int) yuki_shuoshuo_category_id() : 0;

		if ( $carrier_id <= 0 ) {
			$carrier = yuki_fx_ensure_carrier();
			if ( ! $carrier ) {
				yuki_fx_emit( array( 'error' => '承载体分类建不出来' ) );
				exit( 2 );
			}
			$carrier_id = (int) $carrier->term_id;
			set_theme_mod( 'yuki_shuoshuo_category', $carrier_id );
		}

		/*
		 * 顺序有讲究：**正式文章先发，说说后发**。
		 *
		 * 主列表按时间倒序，所以后发的说说会占住第一页。这样一来，「首页上有没有说说」
		 * 才真的在验排除——反过来的话，说说本来就被正式文章挤到后面去了，那条断言
		 * 即使排除逻辑整个没写也会绿（这个假绿我踩过一次）。
		 */
		$counts = yuki_fx_counts();

		$normal = array();
		for ( $i = 1; $i <= $counts["normal"]; $i++ ) {
			$title   = sprintf( '%s 正式文章 %02d', YUKI_FX_MARK, $i );
			$post_id = wp_insert_post(
				array(
					'post_title'    => $title,
					'post_content'  => '<p>一篇正式文章。</p>',
					'post_status'   => 'publish',
					'post_type'     => 'post',
					'post_author'   => 1,
					'post_category' => array( (int) $verify->term_id ),
				)
			);
			$normal[] = $title;

			// 第一篇挂上标签，用来验「标签归档不受影响」
			if ( 1 === $i && $post_id && ! is_wp_error( $post_id ) ) {
				wp_set_post_tags( $post_id, array( '验证标签' ) );
			}
		}

		$shuoshuo = array();
		for ( $i = 1; $i <= $counts["shuoshuo"]; $i++ ) {
			$title      = sprintf( '%s 说说 %02d', YUKI_FX_MARK, $i );
			wp_insert_post(
				array(
					'post_title'    => $title,
					'post_content'  => '<p>一句碎片。</p>',
					'post_status'   => 'publish',
					'post_type'     => 'post',
					'post_author'   => 1,
					'post_category' => array( $carrier_id ),
				)
			);
			$shuoshuo[] = $title;
		}

		// 按名字取，不能按 slug：中文名的 slug 是百分号编码过的，跟名字对不上
		$tag = get_term_by( 'name', '验证标签', 'post_tag' );

		$state               = yuki_fx_state();
		$state['purged']     = $removed;
		$state['shuoshuo']   = $shuoshuo;
		$state['normal']     = $normal;
		$state['verify_url'] = get_category_link( $verify->term_id );
		// 归档地址在服务端算：站点的时区与本地时区不一定一样，交给 PHP 才不会差一天
		$state['tag_url']    = ( $tag instanceof WP_Term ) ? get_tag_link( $tag->term_id ) : '';
		// 用 get_month_link 而不是 ?year=&monthnum=：后者会 301 跳到规范地址，
		// 而验收脚本不跟随跳转，看到的就成 301 而不是 200
		$state['date_url']   = get_month_link( current_time( 'Y' ), current_time( 'm' ) );
		yuki_fx_emit( $state );
		break;

	case 'set':
		$id = (int) ( $yuki_fx_args['id'] ?? 0 );
		set_theme_mod( 'yuki_shuoshuo_category', $id );
		yuki_fx_emit( yuki_fx_state() );
		break;

	case 'delete-carrier':
		$term = yuki_fx_carrier_term();
		if ( ! $term ) {
			yuki_fx_emit( array( 'error' => '当前没有承载体分类可删' ) );
			exit( 2 );
		}
		$deleted_id = (int) $term->term_id;
		$result     = wp_delete_term( $deleted_id, 'category' );
		yuki_fx_emit(
			array(
				'deleted_id' => $deleted_id,
				'ok'         => ( true === $result ),
			)
		);
		break;

	case 'rename':
		$term = yuki_fx_carrier_term();
		if ( ! $term ) {
			yuki_fx_emit( array( 'error' => '当前没有承载体分类可改名' ) );
			exit( 2 );
		}
		$fields = array();
		if ( isset( $yuki_fx_args['name'] ) ) {
			$fields['name'] = $yuki_fx_args['name'];
		}
		if ( isset( $yuki_fx_args['slug'] ) ) {
			$fields['slug'] = $yuki_fx_args['slug'];
		}
		$result = wp_update_term( (int) $term->term_id, 'category', $fields );
		if ( is_wp_error( $result ) ) {
			yuki_fx_emit( array( 'error' => $result->get_error_message() ) );
			exit( 2 );
		}
		yuki_fx_emit( yuki_fx_state() );
		break;

	case 'activate':
		/*
		 * 登记一次主题切换。**它不立刻触发 after_switch_theme。**
		 *
		 * switch_theme() 只把「切换过」写进 theme_switched 选项（wp-includes/theme.php:840），
		 * 真正 do_action( 'after_switch_theme' ) 的是下一次页面加载时的 check_theme_switched()
		 * ——它挂在 init 上（default-filters.php:372）。所以本子命令只负责登记，
		 * 触发要由验收脚本紧跟着**真发一次 HTTP 请求**。
		 *
		 * 走这条真实路径，而不是直接 do_action( 'after_switch_theme' )：直接调等于在验
		 * 「我调了它」，验不出它在真实时机上会不会被调、那时配置拿不拿得到。
		 *
		 * 前提是引导时 yuki 就是启用中的主题——这样下一个请求才会加载 yuki 的
		 * functions.php、那个钩子才会挂在它的 init 上。
		 */
		$before = get_stylesheet();
		if ( 'yuki' !== $before ) {
			yuki_fx_emit( array( 'error' => '引导时 yuki 不是启用中的主题，activate 验不了：' . $before ) );
			exit( 2 );
		}

		// 切成「默认主题」而不是写死某个 slug：WP_DEFAULT_THEME 一定存在，
		// 而 twentytwentyfive 要到 WP 6.7 才有，主题声明的最低版本是 6.0。
		switch_theme( WP_DEFAULT_THEME );
		switch_theme( 'yuki' );

		yuki_fx_emit(
			array(
				'stylesheet'     => get_stylesheet(),
				// 非空表示切换已登记，下一次页面加载会触发 after_switch_theme
				'theme_switched' => get_option( 'theme_switched' ),
				'pending'        => (bool) get_option( 'theme_switched' ),
			)
		);
		break;

	case 'customizer':
		/*
		 * 自定义器里的注册情况。
		 *
		 * 验的是**注册**：把 customize_register 动作跑一遍，看那个 setting / control
		 * 在不在、下拉里有没有对应的分类。真正的界面渲染要登录 cookie，
		 * 对这一条验收标准来说不是必需的——「能不能选」的实质是选项里有没有那个分类。
		 */
		require_once ABSPATH . 'wp-includes/class-wp-customize-manager.php';

		$manager = new WP_Customize_Manager();
		do_action( 'customize_register', $manager );

		$setting = $manager->get_setting( 'yuki_shuoshuo_category' );
		$control = $manager->get_control( 'yuki_shuoshuo_category' );

		$choices = array();
		if ( $control && isset( $control->choices ) ) {
			foreach ( array_keys( (array) $control->choices ) as $key ) {
				$choices[] = (int) $key;
			}
		}

		yuki_fx_emit(
			array(
				'has_setting' => (bool) $setting,
				'has_control' => (bool) $control,
				'section'     => $control && isset( $control->section ) ? $control->section : '',
				'type'        => $control && isset( $control->type ) ? $control->type : '',
				// 0 表示「不使用」，其余是各分类的标识
				'choices'     => $choices,
				'sanitizer'   => $setting && isset( $setting->sanitize_callback ) ? $setting->sanitize_callback : '',
			)
		);
		break;

	case 'stick':
	case 'unstick':
		/*
		 * 把最新那篇说说置顶 / 取消置顶。
		 *
		 * 这条验的是一个真实的缺口：负的 cat 参数**挡不住置顶文章**。WP_Query 处理置顶时
		 * 只认 post__not_in（class-wp-query.php:3604），剩下没被排除掉的置顶文章会被
		 * 重新查一遍（get_posts( array( 'post__in' => $sticky_posts ) )，那里没有任何
		 * 分类条件），再插到列表最前面——于是一篇被置顶的说说照样出现在首页顶上。
		 */
		$carrier_id = function_exists( 'yuki_shuoshuo_category_id' ) ? (int) yuki_shuoshuo_category_id() : 0;

		$candidates = get_posts(
			array(
				'post_type'   => 'post',
				'post_status' => 'publish',
				'numberposts' => -1,
				'fields'      => 'ids',
				's'           => YUKI_FX_MARK,
			)
		);

		$target = 0;
		foreach ( $candidates as $candidate_id ) {
			// get_posts 默认按时间倒序，所以第一作者就是最新的那篇说说
			if ( $carrier_id > 0 && has_category( $carrier_id, $candidate_id ) ) {
				$target = (int) $candidate_id;
				break;
			}
		}

		if ( ! $target ) {
			yuki_fx_emit( array( 'error' => '找不到可说说的文章（承载体分类空着？）' ) );
			exit( 2 );
		}

		if ( 'stick' === $yuki_fx_cmd ) {
			stick_post( $target );
		} else {
			unstick_post( $target );
		}

		$sticky = array_map( 'intval', (array) get_option( 'sticky_posts' ) );
		yuki_fx_emit(
			array(
				'target'   => $target,
				'title'    => get_the_title( $target ),
				'is_stuck' => in_array( $target, $sticky, true ),
			)
		);
		break;

	case 'teardown':
		/*
		 * 连「改名那一步留下的分类」一起清掉：某一轮在改名中途失败时，那个临时 slug
		 * 的分类会留在库里越攒越多。验收用的是每次不同的 slug，不会再撞上它，
		 * 但留着是垃圾。
		 *
		 * 按前缀扫而不是按 slug 精确查——临时 slug 带时间戳后缀，精确查找不到。
		 */
		$stray_count = 0;
		$all_terms   = get_terms(
			array(
				'taxonomy'   => 'category',
				'hide_empty' => false,
				'fields'     => 'ids',
			)
		);

		// 当前真正在用的承载体不能删：某一轮万一卡在「已改名、还没改回来」，
		// 它的 slug 也带 yuki-suipian 前缀，但那是活的承载体，删掉就等于把站弄坏。
		$live_id = function_exists( 'yuki_shuoshuo_category_id' ) ? (int) yuki_shuoshuo_category_id() : 0;

		if ( ! is_wp_error( $all_terms ) ) {
			foreach ( $all_terms as $candidate_id ) {
				$candidate = get_term( (int) $candidate_id, 'category' );

				if ( ! $candidate instanceof WP_Term ) {
					continue;
				}
				if ( (int) $candidate->term_id === $live_id ) {
					continue;
				}
				if ( 0 === strpos( $candidate->slug, 'yuki-suipian' ) ) {
					wp_delete_term( (int) $candidate_id, 'category' );
					$stray_count++;
				}
			}
		}

		yuki_fx_emit(
			array(
				'removed' => yuki_fx_purge(),
				'strays'  => $stray_count,
			)
		);
		break;

	default:
		yuki_fx_emit( array( 'error' => '未知子命令: ' . $yuki_fx_cmd ) );
		exit( 2 );
}
