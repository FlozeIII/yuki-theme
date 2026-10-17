<?php
/**
 * 工单 02（编辑器里看到的就是前台的正文）的造数：一篇带区块内容的文章、一枚登录 cookie。
 *
 * 登录 cookie 由 WordPress 自己生成（`wp_generate_auth_cookie()`），验收脚本通过 CDP 把它种进
 * 无头浏览器，然后打开文章编辑器——这样验的是真实的登录态，不是给页面塞一个假用户。
 *
 * 用法: php tests/bin/editor-styles-fixtures.php <wordpress目录>
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php editor-styles-fixtures.php <wordpress目录>\n" );
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

/* 验收结束销毁本次会话，不在用户的后台里留一枚一次性 token。 */
if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$token = $argv[3] ?? '';
	if ( $token ) {
		WP_Session_Tokens::get_instance( $admin_id )->destroy( $token );
	}
	echo "cleaned\n";
	exit( 0 );
}

wp_set_current_user( $admin_id );

/* ---------- 1. 清掉上一轮（按标记找，可重复执行）---------- */
foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-EDITOR',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 2. 一张配图 ---------- */
$uploads  = wp_upload_dir();
$img_path = trailingslashit( $uploads['path'] ) . 'yuki-editor.png';
$im = imagecreatetruecolor( 640, 400 );
imagefill( $im, 0, 0, imagecolorallocate( $im, 165, 180, 252 ) );
imagestring( $im, 5, 245, 190, 'YUKI EDITOR', imagecolorallocate( $im, 255, 255, 255 ) );
imagepng( $im, $img_path );
imagedestroy( $im );

require_once ABSPATH . 'wp-admin/includes/image.php';
$img_id = wp_insert_attachment( array(
	'post_mime_type' => 'image/png',
	'post_title'     => 'YUKI-EDITOR 配图',
	'post_status'    => 'inherit',
), $img_path );
wp_update_attachment_metadata( $img_id, wp_generate_attachment_metadata( $img_id, $img_path ) );
$img_url = wp_get_attachment_url( $img_id );

/* ---------- 3. 一篇带区块内容的文章：段落、引用、代码、图片与图注 ---------- */
$content = implode( "\n", array(
	'<!-- wp:paragraph -->',
	'<p>YUKI-EDITOR-PARA 正文段落，用来量字号、行高与颜色。</p>',
	'<!-- /wp:paragraph -->',
	'<!-- wp:quote -->',
	'<blockquote class="wp-block-quote"><p>YUKI-EDITOR-QUOTE 引用。</p></blockquote>',
	'<!-- /wp:quote -->',
	'<!-- wp:code -->',
	'<pre class="wp-block-code"><code>YUKI-EDITOR-CODE</code></pre>',
	'<!-- /wp:code -->',
	'<!-- wp:image -->',
	'<figure class="wp-block-image"><img src="' . esc_url( $img_url ) . '" alt=""/><figcaption class="wp-element-caption">YUKI-EDITOR-CAPTION 图注</figcaption></figure>',
	'<!-- /wp:image -->',
) );

$post_id = wp_insert_post( array(
	'post_title'   => 'YUKI-EDITOR 编辑器验收',
	'post_content' => $content,
	'post_status'  => 'draft',
	'post_type'    => 'post',
	'post_author'  => $admin_id,
) );

/* ---------- 4. 登录会话（真实登录态，不是假用户）----------
 * WordPress 4.0+ 的 token 必须在会话表里登记，wp_validate_auth_cookie() 会去核对
 * （wp-includes/pluggable.php:888）。wp-admin 在没有 SSL 时认 AUTH_COOKIE，登录态另用
 * LOGGED_IN_COOKIE；两枚都种上。 */
$expiration    = time() + HOUR_IN_SECONDS;
$session_token = WP_Session_Tokens::get_instance( $admin_id )->create( $expiration );

$cookies = array(
	array(
		'name'  => AUTH_COOKIE,
		'value' => wp_generate_auth_cookie( $admin_id, $expiration, 'auth', $session_token ),
	),
	array(
		'name'  => LOGGED_IN_COOKIE,
		'value' => wp_generate_auth_cookie( $admin_id, $expiration, 'logged_in', $session_token ),
	),
);

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'post_id'            => $post_id,
	'editor_url'         => admin_url( 'post.php?post=' . $post_id . '&action=edit' ),
	'cookies'            => $cookies,
	'session_token'      => $session_token,
	'editor_stylesheets' => get_editor_stylesheets(),
	'markers'            => array(
		'paragraph' => 'YUKI-EDITOR-PARA',
		'quote'     => 'YUKI-EDITOR-QUOTE',
		'code'      => 'YUKI-EDITOR-CODE',
		'caption'   => 'YUKI-EDITOR-CAPTION',
	),
) ) . "\n";
