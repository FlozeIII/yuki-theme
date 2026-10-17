<?php
/**
 * 工单 01（图片灯箱）的造数：一个页面、一条说说。
 *
 * 页面里放五种标记：
 *   - 裸图（带 srcset，两档大小）
 *   - 区块图 + figcaption
 *   - 图片链接到媒体文件
 *   - 图片链接到页内锚点（不该被接管）
 *   - 图片链接带 rel=attachment（该被接管，大图走 srcset）
 * 另外挂一张特色图，用来证明它不在触发范围里。
 *
 * 说说的承载分类用站点现有的 `yuki_shuoshuo_category`，**不改这个全站设置**；
 * 没配置时就不造说说，验收脚本按 `shuoshuo_url: null` 跳过那一组。
 *
 * 用法: php tests/bin/image-lightbox-fixtures.php <wordpress目录>
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php image-lightbox-fixtures.php <wordpress目录>\n" );
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
wp_set_current_user( $admin_id );

/* ---------- 1. 清掉上一轮（按标记找，可重复执行）---------- */
foreach ( get_posts( array(
	'post_type'   => array( 'post', 'page' ),
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-LIGHTBOX',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 2. 两张配图：小图与“大图” ---------- */
function yuki_lightbox_image( $file, $width, $height, $label, $color ) {
	$uploads  = wp_upload_dir();
	$img_path = trailingslashit( $uploads['path'] ) . $file;

	$im = imagecreatetruecolor( $width, $height );
	imagefill( $im, 0, 0, imagecolorallocate( $im, $color[0], $color[1], $color[2] ) );
	imagestring( $im, 5, (int) ( $width / 2 - 60 ), (int) ( $height / 2 ), $label, imagecolorallocate( $im, 255, 255, 255 ) );
	imagepng( $im, $img_path );
	imagedestroy( $im );

	require_once ABSPATH . 'wp-admin/includes/image.php';
	$id = wp_insert_attachment( array(
		'post_mime_type' => 'image/png',
		'post_title'     => $label,
		'post_status'    => 'inherit',
	), $img_path );
	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $img_path ) );

	return array( 'id' => $id, 'url' => wp_get_attachment_url( $id ) );
}

$small = yuki_lightbox_image( 'yuki-lightbox-small.png', 320, 200, 'YUKI LIGHTBOX SMALL', array( 165, 180, 252 ) );
$large = yuki_lightbox_image( 'yuki-lightbox-large.png', 1280, 800, 'YUKI LIGHTBOX LARGE', array( 99, 102, 241 ) );

$srcset = $small['url'] . ' 320w, ' . $large['url'] . ' 1280w';

/* ---------- 3. 页面：五种标记 + 特色图 ---------- */
$content = implode( "\n", array(
	'<p><img src="' . esc_url( $small['url'] ) . '" srcset="' . esc_attr( $srcset ) . '" sizes="(max-width: 800px) 100vw, 720px" alt="YUKI-LIGHTBOX-BARE"></p>',
	'<figure class="wp-block-image"><img src="' . esc_url( $small['url'] ) . '" alt="YUKI-LIGHTBOX-FIG-ALT"><figcaption>YUKI-LIGHTBOX-CAPTION</figcaption></figure>',
	'<p><a href="' . esc_url( $large['url'] ) . '"><img src="' . esc_url( $small['url'] ) . '" alt="YUKI-LIGHTBOX-MEDIA"></a></p>',
	'<p><a href="#yuki-lightbox-anchor"><img src="' . esc_url( $small['url'] ) . '" alt="YUKI-LIGHTBOX-ANCHOR"></a></p>',
	'<div id="yuki-lightbox-anchor"></div>',
	'<p><a href="' . esc_url( home_url( '/?attachment_id=999999' ) ) . '" rel="attachment wp-att-999999"><img src="' . esc_url( $small['url'] ) . '" srcset="' . esc_attr( $srcset ) . '" alt="YUKI-LIGHTBOX-ATTACH"></a></p>',
) );

$page_id = wp_insert_post( array(
	'post_title'   => 'YUKI-LIGHTBOX 页面',
	'post_content' => $content,
	'post_status'  => 'publish',
	'post_type'    => 'page',
	'post_author'  => $admin_id,
) );
set_post_thumbnail( $page_id, $large['id'] );

/* ---------- 4. 说说：用现有的承载分类，不改全站设置 ---------- */
$shuoshuo_id  = 0;
$shuoshuo_url = null;
$shuoshuo_cat = (int) get_theme_mod( 'yuki_shuoshuo_category', 0 );

if ( $shuoshuo_cat && get_term( $shuoshuo_cat ) ) {
	$shuoshuo_id = wp_insert_post( array(
		'post_title'   => 'YUKI-LIGHTBOX 说说',
		'post_content' => '<p><img src="' . esc_url( $small['url'] ) . '" srcset="' . esc_attr( $srcset ) . '" alt="YUKI-LIGHTBOX-SHUOSHUO"></p>',
		'post_status'  => 'publish',
		'post_type'    => 'post',
		'post_author'  => $admin_id,
		'post_category' => array( $shuoshuo_cat ),
	) );

	$term = get_term( $shuoshuo_cat );
	$shuoshuo_url = is_wp_error( $term ) ? null : get_term_link( $term );
}

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'page_id'      => $page_id,
	'page_url'     => get_permalink( $page_id ),
	'shuoshuo_id'  => $shuoshuo_id,
	'shuoshuo_url' => $shuoshuo_url,
	'small_url'    => $small['url'],
	'large_url'    => $large['url'],
	'markers'      => array(
		'bare'    => 'YUKI-LIGHTBOX-BARE',
		'figure'  => 'YUKI-LIGHTBOX-FIG-ALT',
		'caption' => 'YUKI-LIGHTBOX-CAPTION',
		'media'   => 'YUKI-LIGHTBOX-MEDIA',
		'anchor'  => 'YUKI-LIGHTBOX-ANCHOR',
		'attach'  => 'YUKI-LIGHTBOX-ATTACH',
		'feat'    => 'YUKI-LIGHTBOX 页面',
		'shuoshuo' => 'YUKI-LIGHTBOX-SHUOSHUO',
	),
) ) . "\n";
