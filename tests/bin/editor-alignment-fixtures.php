<?php
/**
 * 工单 01（宽度契约与正文呈现类）的造数：一个页面、一篇单篇文章、一条作者本人的评论。
 *
 * 页面里塞进对齐图片、图注、画廊图注与一个宽块；单篇里塞一个宽块，用来证明它在有侧栏的
 * 布局里止于主列。评论由管理员本人发出，`comment_class()` 才会给出 `bypostauthor`（核心
 * 只在「评论作者 == 文章作者」时加这个类）。
 *
 * 不碰全站 sticky_posts：置顶标记的断言只看 CSS 规则与模板是否输出 `post_class()`，
 * 不为一次验收把首页的置顶状态改掉——那是别的会话也会读到的全局设置。
 *
 * 用法: php tests/bin/editor-alignment-fixtures.php <wordpress目录>
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php editor-alignment-fixtures.php <wordpress目录>\n" );
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
wp_set_current_user( $admin_id ); // 带上 unfiltered_html，正文里的 class 不被 KSES 削掉

/* ---------- 1. 清掉上一轮（按标记找，可重复执行）---------- */
foreach ( get_posts( array(
	'post_type'   => array( 'post', 'page' ),
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-ALIGN',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 2. 一张配图 ---------- */
$uploads  = wp_upload_dir();
$img_path = trailingslashit( $uploads['path'] ) . 'yuki-align.png';
$im = imagecreatetruecolor( 640, 400 );
imagefill( $im, 0, 0, imagecolorallocate( $im, 165, 180, 252 ) );
imagestring( $im, 5, 250, 190, 'YUKI ALIGN', imagecolorallocate( $im, 255, 255, 255 ) );
imagepng( $im, $img_path );
imagedestroy( $im );

require_once ABSPATH . 'wp-admin/includes/image.php';
$img_id = wp_insert_attachment( array(
	'post_mime_type' => 'image/png',
	'post_title'     => 'YUKI-ALIGN 配图',
	'post_status'    => 'inherit',
), $img_path );
wp_update_attachment_metadata( $img_id, wp_generate_attachment_metadata( $img_id, $img_path ) );
$img_url = wp_get_attachment_url( $img_id );

$img = '<img src="' . esc_url( $img_url ) . '" width="240" height="150" alt="YUKI-ALIGN 配图">';
$img_with = static function ( $class ) use ( $img ) {
	return str_replace( 'alt=', 'class="' . $class . '" alt=', $img );
};

/* ---------- 3. 页面：对齐、图注、画廊图注、宽块 ---------- */
$page_content = implode( "\n", array(
	'<p>' . $img_with( 'alignleft' ) . ' YUKI-ALIGN-LEFT 这段文字应该绕在左对齐图片的右边，用来确认浮动真的生效。</p>',
	'<p>' . $img_with( 'alignright' ) . ' YUKI-ALIGN-RIGHT 这段文字应该绕在右对齐图片的左边，用来确认浮动真的生效。</p>',
	'<p>' . $img_with( 'aligncenter' ) . '</p>',
	'<div class="wp-caption alignleft">' . $img . '<p class="wp-caption-text">YUKI-ALIGN-CAPTION 图注</p></div>',
	'<div class="gallery"><dl class="gallery-item"><dt class="gallery-icon">' . $img . '</dt><dd class="gallery-caption">YUKI-ALIGN-GALLERY 画廊图注</dd></dl></div>',
	'<figure class="wp-block-image alignwide"><img src="' . esc_url( $img_url ) . '" width="1120" height="700" alt="YUKI-ALIGN-WIDE"><figcaption>YUKI-ALIGN-WIDE 宽块</figcaption></figure>',
	'<p>YUKI-ALIGN-END 收尾段落，用来把浮动清干净。</p>',
) );

$page_id = wp_insert_post( array(
	'post_title'   => 'YUKI-ALIGN 页面',
	'post_content' => $page_content,
	'post_status'  => 'publish',
	'post_type'    => 'page',
	'post_author'  => $admin_id,
) );

/* ---------- 4. 单篇文章：宽块在有侧栏的布局里 ---------- */
$post_id = wp_insert_post( array(
	'post_title'   => 'YUKI-ALIGN 单篇',
	'post_content' => '<p>YUKI-ALIGN-SINGLE 正文。</p>' .
		'<figure class="wp-block-image alignwide"><img src="' . esc_url( $img_url ) . '" width="1120" height="700" alt="YUKI-ALIGN-WIDE-SINGLE"><figcaption>YUKI-ALIGN-WIDE-SINGLE 单篇宽块</figcaption></figure>' .
		'<p>YUKI-ALIGN-SINGLE-END 收尾。</p>',
	'post_status'  => 'publish',
	'post_type'    => 'post',
	'post_author'  => $admin_id,
) );

/* ---------- 5. 作者本人的评论（bypostauthor 只在评论作者 == 文章作者时出现）---------- */
$comment_id = wp_insert_comment( array(
	'comment_post_ID'      => $post_id,
	'comment_author'       => $admins[0]->display_name,
	'comment_author_email' => $admins[0]->user_email,
	'comment_content'      => 'YUKI-ALIGN-COMMENT 作者本人的评论。',
	'comment_approved'     => 1,
	'user_id'              => $admin_id,
) );
clean_comment_cache( $comment_id );

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'page_id'   => $page_id,
	'page_url'  => get_permalink( $page_id ),
	'post_id'   => $post_id,
	'post_url'  => get_permalink( $post_id ),
	'markers'   => array(
		'left'    => 'YUKI-ALIGN-LEFT',
		'right'   => 'YUKI-ALIGN-RIGHT',
		'caption' => 'YUKI-ALIGN-CAPTION',
		'gallery' => 'YUKI-ALIGN-GALLERY',
		'wide'    => 'YUKI-ALIGN-WIDE',
	),
) ) . "\n";
