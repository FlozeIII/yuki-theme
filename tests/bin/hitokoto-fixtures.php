<?php
/**
 * 工单 09 的造数与状态操作：一言。
 *
 * 一言的状态几乎全在缓存里——「上游被敲了几次」由 stub 数得出来，「哪一句在缓存里、
 * 什么时候到期」只有 WordPress 自己知道。所以要验「一小时内不重复取回」「超过一小时
 * 会重新取回」，就得能**从外面看见并摆布那份缓存**：读它的值、读它的到期时间、
 * 把到期时间挪到过去（不真等一小时）、在需要的时候清掉它。
 *
 * 侧边栏那条也一样：默认小工具与自定义小工具是「有自定义的就接管、一个都没有才回退」，
 * 要验「放一个就接管」，就得真的往那个侧边栏里放一个。
 *
 * 每个子命令最后一行打印一个 JSON 对象，验收脚本只读这一行。
 *
 * 用法: php hitokoto-fixtures.php <wordpress目录> <子命令> [--键=值 ...]
 *   state              主题、一言缓存的实况、侧边栏里的小工具、可用的文章地址
 *   clear              清掉一言的缓存（返回清掉之前那一份）
 *   age --seconds=<n>  把缓存的到期时间挪到 n 秒前，模拟「时间过去了」（默认 1 秒）
 *   fallback --samples=<n>   采样主题自带的兜底句，返回去重后的集合（默认 300 次）
 *   widgets --mode=on|off|restore  放一个自定义小工具接管 / 清空回退内置 / 还原原样
 *   teardown           还原侧边栏，数据恢复原样
 *
 * @package Yuki\DevHarness
 */

// 不能叫 $wp —— require 在本文件的全局作用域里执行，会把 WordPress 的全局 $wp 覆盖掉。
$yuki_fx_root = $argv[1] ?? '';
$yuki_fx_cmd  = $argv[2] ?? '';

if ( ! $yuki_fx_root || ! file_exists( $yuki_fx_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php hitokoto-fixtures.php <wordpress目录> <子命令> [--键=值 ...]\n" );
	exit( 2 );
}

require $yuki_fx_root . '/wp-load.php';
unset( $yuki_fx_root );

/*
 * 一言缓存的键名。
 *
 * 这是**主题的实现细节**，但 spec 把它定成了接口的一部分：「用一个一小时（1 小时）的
 * transient 缓存结果」。验收要验的就是这份缓存的行为——不认这个键，就问不出
 * 「上游被敲了几次」以外的东西（比如到期时间是不是一小时）。
 */
const YUKI_FX_HITOKOTO_KEY = 'yuki_hitokoto';

/**
 * 接管侧边栏用的那个自定义小工具。
 *
 * 编号取大一点，别撞上站里真在用的小工具；id 由编号拼出来，免得两处各写一个数字、
 * 改了编号只改一半。实例数据按编号存在 `widget_text` 选项里，所以那两处必须一致。
 */
const YUKI_FX_WIDGET_NUMBER = 9871;
const YUKI_FX_WIDGET_ID     = 'text-' . YUKI_FX_WIDGET_NUMBER;
const YUKI_FX_WIDGET_TITLE  = 'YUKI-FX 自定义小工具';
const YUKI_FX_WIDGET_TEXT   = 'YUKI-FX 接管了侧边栏';

/** 原侧边栏配置存在这个选项里，供 restore 还原。 */
const YUKI_FX_SIDEBARS_BACKUP = 'yuki_fx_hitokoto_sidebars_backup';

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
 * 一篇能渲染出侧边栏的文章。
 *
 * 侧边栏只出现在文章详情页（single.php 里 get_sidebar()），所以一言的断言必须落在
 * 一篇真实的文章上。取最新那篇已发布的：造数脚本发给自己的文章也行，
 * 别的会话留下的也行——断言认的是「页面上有没有那句话」，不是哪一篇文章。
 */
function yuki_fx_post_url() {
	$posts = get_posts(
		array(
			'post_type'   => 'post',
			'post_status' => 'publish',
			'numberposts' => 1,
		)
	);

	return $posts ? get_permalink( $posts[0] ) : '';
}

/**
 * 当前侧边栏里放的小工具 id 列表。
 *
 * 读的是顶层的 sidebars_widgets 原值，不是 wp_get_sidebars_widgets()——后者会把
 * 「一个都没放」和「从来没配过」整理成同一副样子，而这一节恰恰要看的就是那点区别。
 */
function yuki_fx_sidebars() {
	$all = get_option( 'sidebars_widgets', array() );

	return isset( $all['sidebar-single'] ) ? array_values( (array) $all['sidebar-single'] ) : array();
}

function yuki_fx_state() {
	$value   = get_option( '_transient_' . YUKI_FX_HITOKOTO_KEY, null );
	$timeout = get_option( '_transient_timeout_' . YUKI_FX_HITOKOTO_KEY, null );

	return array(
		'theme'         => get_stylesheet(),
		'post_url'      => yuki_fx_post_url(),
		'sidebar'       => yuki_fx_sidebars(),
		// 缓存里那一份原值。null 表示没有（或者已经到期被 get_transient 顺手删了）
		'cache'         => $value,
		'cache_text'    => is_array( $value ) && isset( $value['text'] ) ? $value['text'] : '',
		'cache_timeout' => is_null( $timeout ) ? null : (int) $timeout,
		// 距到期还有几秒。负数是已经过期了。没有缓存时是 null
		'cache_left'    => is_null( $timeout ) ? null : ( (int) $timeout - time() ),
		'has_fallback'  => function_exists( 'yuki_hitokoto_fallback' ),
		'has_quote'     => function_exists( 'yuki_hitokoto' ),
	);
}

$yuki_fx_args = yuki_fx_args( $argv );

/**
 * 把侧边栏恢复成动过之前的样子，并清掉接管用的小工具实例数据。
 *
 * `widgets --mode=restore` 与 `teardown` 都要这一套，所以只写一遍：造数脚本留下的东西
 * 必须一件不剩地收干净，而「哪些东西要收」漏掉一处，就会在库里留一份孤零零的小工具实例，
 * 下一轮读到的侧边栏状态也就不是它以为的那个了。
 *
 * @return bool 之前确实存过备份（也就是这一轮真的改过侧边栏）。
 */
function yuki_fx_restore_sidebars() {
	$backup = get_option( YUKI_FX_SIDEBARS_BACKUP, null );

	if ( is_array( $backup ) ) {
		wp_set_sidebars_widgets( $backup );
		delete_option( YUKI_FX_SIDEBARS_BACKUP );
	}

	$texts = get_option( 'widget_text', array() );
	if ( is_array( $texts ) && isset( $texts[ YUKI_FX_WIDGET_NUMBER ] ) ) {
		unset( $texts[ YUKI_FX_WIDGET_NUMBER ] );
		update_option( 'widget_text', $texts );
	}

	return is_array( $backup );
}

switch ( $yuki_fx_cmd ) {
	case 'state':
		yuki_fx_emit( yuki_fx_state() );
		break;

	case 'clear':
		$before = get_option( '_transient_' . YUKI_FX_HITOKOTO_KEY, null );
		delete_transient( YUKI_FX_HITOKOTO_KEY );
		$state            = yuki_fx_state();
		$state['cleared'] = $before;
		yuki_fx_emit( $state );
		break;

	case 'age':
		/*
		 * 把到期时间挪到过去，**不动缓存里的值**。
		 *
		 * 这样模拟的是「一小时真的过去了」：值还在（本该被丢掉的那个），到期时间已过，
		 * 下一次 get_transient() 就会认为它不存在，于是主题重新去取一次。
		 * 真等一小时当然不行，把 TTL 调小则连「一小时」这条断言本身都验不了。
		 */
		$seconds = (int) ( $yuki_fx_args['seconds'] ?? 1 );
		$key     = '_transient_timeout_' . YUKI_FX_HITOKOTO_KEY;
		$had     = null !== get_option( $key, null );

		if ( $had ) {
			update_option( $key, time() - $seconds );
		}

		$state          = yuki_fx_state();
		$state['aged']  = $had;
		$state['unset'] = $seconds;
		yuki_fx_emit( $state );
		break;

	case 'fallback':
		/*
		 * 主题自带的那几句长什么样。
		 *
		 * 采样而不是「请主题把整个列表给我」：兜底句是**随机取一句**的，采样几百次
		 * 就能把整个池子收全，而主题不必为了测试多出一个返回内部数组的接口。
		 */
		if ( ! function_exists( 'yuki_hitokoto_fallback' ) ) {
			yuki_fx_emit( array( 'error' => '主题里没有 yuki_hitokoto_fallback()' ) );
			exit( 2 );
		}

		$samples = max( 1, (int) ( $yuki_fx_args['samples'] ?? 300 ) );
		$seen    = array();
		$with_source = 0;

		for ( $i = 0; $i < $samples; $i++ ) {
			$quote = yuki_hitokoto_fallback();

			if ( ! is_array( $quote ) || ! isset( $quote['text'] ) || '' === $quote['text'] ) {
				yuki_fx_emit( array( 'error' => '兜底句不是「有 text 的数组」' ) );
				exit( 2 );
			}

			$seen[ $quote['text'] ] = true;

			if ( ! empty( $quote['source'] ) ) {
				$with_source++;
			}
		}

		yuki_fx_emit(
			array(
				'samples'     => $samples,
				'lines'       => array_keys( $seen ),
				'with_source' => $with_source,
			)
		);
		break;

	case 'widgets':
		$mode = (string) ( $yuki_fx_args['mode'] ?? '' );

		if ( ! in_array( $mode, array( 'on', 'off', 'restore' ), true ) ) {
			yuki_fx_emit( array( 'error' => 'mode 只能是 on / off / restore' ) );
			exit( 2 );
		}

		$all = get_option( 'sidebars_widgets', array() );

		if ( 'restore' === $mode ) {
			$restored     = yuki_fx_restore_sidebars();
			$state        = yuki_fx_state();
			$state['mode'] = $mode;
			$state['had_backup'] = $restored;
			yuki_fx_emit( $state );
			break;
		}

		// 第一次动之前先把原样的存下来，restore 才有得还原
		if ( null === get_option( YUKI_FX_SIDEBARS_BACKUP, null ) ) {
			update_option( YUKI_FX_SIDEBARS_BACKUP, $all );
		}

		if ( 'on' === $mode ) {
			$texts = get_option( 'widget_text', array() );
			if ( ! is_array( $texts ) ) {
				$texts = array();
			}

			$texts[ YUKI_FX_WIDGET_NUMBER ] = array( 'title' => YUKI_FX_WIDGET_TITLE, 'text' => YUKI_FX_WIDGET_TEXT, 'filter' => false );
			// 不带 _multiwidget 选项的话，核心会按「老式单实例」去读，实例数据取不到
			$texts['_multiwidget'] = 1;
			update_option( 'widget_text', $texts );

			$all['sidebar-single'] = array( YUKI_FX_WIDGET_ID );
		} else {
			$all['sidebar-single'] = array();
		}

		wp_set_sidebars_widgets( $all );

		$state                 = yuki_fx_state();
		$state['mode']         = $mode;
		$state['widget_title'] = YUKI_FX_WIDGET_TITLE;
		$state['widget_text']  = YUKI_FX_WIDGET_TEXT;
		yuki_fx_emit( $state );
		break;

	case 'teardown':
		$restored = yuki_fx_restore_sidebars();

		// 缓存也一并清掉：验收留下的那一份可能正是某个故障态的兜底句，
		// 留着会让下一个会话/下一次验收看到一句跟上游没关系的话
		delete_transient( YUKI_FX_HITOKOTO_KEY );

		$state             = yuki_fx_state();
		$state['restored'] = $restored;
		yuki_fx_emit( $state );
		break;

	default:
		yuki_fx_emit( array( 'error' => '未知子命令: ' . $yuki_fx_cmd ) );
		exit( 2 );
}
