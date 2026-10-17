<?php
/**
 * 工单 01（前台发说说）的造数：管理员与订阅者的登录会话、说说归档地址。
 *
 * 用法:
 *   php shuoshuo-composer-fixtures.php <wordpress目录>
 *   php shuoshuo-composer-fixtures.php <wordpress目录> --cleanup <admin_token> <sub_token>
 *   php shuoshuo-composer-fixtures.php <wordpress目录> --stats <marker>
 *
 * 登录 cookie 的做法与编辑器样式那件相同：先建真实会话，再用同一个 token 签
 * AUTH_COOKIE 与 LOGGED_IN_COOKIE。验完由验收脚本调 --cleanup 销毁会话、删测试用户与测试说说。
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php shuoshuo-composer-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! $admins ) {
	fwrite( STDERR, "找不到管理员账号，造数没法继续。\n" );
	exit( 3 );
}
$admin_id = (int) $admins[0]->ID;

/* ---------- 清理：会话、测试用户、测试说说 ---------- */
if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$sub      = get_user_by( 'login', 'yuki-composer-sub' );
	$targets  = array( $admin_id );
	if ( $sub ) {
		$targets[] = (int) $sub->ID;
	}

	foreach ( array_slice( $argv, 3, 2 ) as $token ) {
		if ( $token ) {
			foreach ( $targets as $user_id ) {
				WP_Session_Tokens::get_instance( $user_id )->destroy( $token );
			}
		}
	}

	if ( $sub ) {
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $sub->ID );
	}

	foreach ( get_posts( array(
		'post_type'   => 'post',
		'numberposts' => -1,
		'post_status' => 'any',
		's'           => 'YUKI-COMPOSER-',
	) ) as $old ) {
		wp_delete_post( $old->ID, true );
	}

	echo "cleaned\n";
	exit( 0 );
}

/* ---------- 统计：按内容标记找说说 ---------- */
if ( isset( $argv[2] ) && '--stats' === $argv[2] ) {
	$marker = $argv[3] ?? '';
	$posts  = get_posts( array(
		'post_type'   => 'post',
		'numberposts' => -1,
		'post_status' => 'any',
		's'           => $marker,
	) );

	$rows = array_map( static function ( $post ) {
		return array(
			'id'      => $post->ID,
			'status'  => $post->post_status,
			'author'  => (int) $post->post_author,
			'cats'    => wp_get_post_categories( $post->ID ),
			'content' => $post->post_content,
		);
	}, $posts );

	echo 'YUKI-STATS: ' . wp_json_encode( $rows ) . "\n";
	exit( 0 );
}

wp_set_current_user( $admin_id );

/* ---------- 1. 清掉上一轮测试说说 ---------- */
foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-COMPOSER-',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 2. 订阅者用户（没有 publish_posts）---------- */
$sub = get_user_by( 'login', 'yuki-composer-sub' );
if ( ! $sub ) {
	$sub_id = wp_insert_user( array(
		'user_login' => 'yuki-composer-sub',
		'user_pass'  => wp_generate_password( 24 ),
		'user_email' => 'yuki-composer-sub@example.test',
		'role'       => 'subscriber',
	) );
} else {
	$sub_id = (int) $sub->ID;
}
if ( is_wp_error( $sub_id ) ) {
	fwrite( STDERR, "创建订阅者失败：{$sub_id->get_error_message()}\n" );
	exit( 4 );
}

/* ---------- 3. 两枚真实登录会话 ---------- */
function yuki_composer_session( $user_id ) {
	$expiration = time() + HOUR_IN_SECONDS;
	$token      = WP_Session_Tokens::get_instance( $user_id )->create( $expiration );

	return array(
		'token'   => $token,
		'cookies' => array(
			array(
				'name'  => AUTH_COOKIE,
				'value' => wp_generate_auth_cookie( $user_id, $expiration, 'auth', $token ),
			),
			array(
				'name'  => LOGGED_IN_COOKIE,
				'value' => wp_generate_auth_cookie( $user_id, $expiration, 'logged_in', $token ),
			),
		),
	);
}

$admin_session = yuki_composer_session( $admin_id );
$sub_session   = yuki_composer_session( $sub_id );

/* ---------- 4. 说说归档 ---------- */
$category = (int) get_theme_mod( 'yuki_shuoshuo_category', 0 );
$term     = $category ? get_term( $category ) : null;
$url      = ( $term && ! is_wp_error( $term ) ) ? get_term_link( $term ) : null;

if ( is_wp_error( $url ) ) {
	$url = null;
}

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'shuoshuo_url'  => $url,
	'post_url'      => admin_url( 'admin-post.php' ),
	'shuoshuo_cat'  => (int) $category,
	'admin_id'      => $admin_id,
	'sub_id'        => (int) $sub_id,
	'admin_token'   => $admin_session['token'],
	'sub_token'     => $sub_session['token'],
	'admin_cookies' => $admin_session['cookies'],
	'sub_cookies'   => $sub_session['cookies'],
) ) . "\n";
