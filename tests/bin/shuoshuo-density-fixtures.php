<?php
/**
 * 工单 08（说说归档的紧凑呈现）的造数：一个承载说说用的分类、几条短说说、一条正式文章。
 *
 * 刻意给**每一条说说都挂上缩略图**、给正式文章也挂一张：紧凑版式要做的正是「不套用大缩略图那套」，
 * 有缩略图才验得出它确实没被用上。
 *
 * 注意：它会把「承载说说的分类」这个 theme mod 指向本脚本建的分类——那是全站设置，
 * 和另一个会话的造数会互相盖。所以验证脚本会回读归档页标题，确认读到的是**这个**分类，
 * 不是就当「共享状态被别处改了」报出来，而不是报成版式不对。
 *
 * 用法: php tests/bin/shuoshuo-density-fixtures.php <wordpress目录>
 */

// 不要叫 $wp —— WordPress 的环境实例就叫这个名字。
$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php shuoshuo-density-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

/* ---------- 1. 承载说说的分类（名与 slug 都带标记，免得和别的会话建的撞上）---------- */
$slug = 'yuki-test-density-shuoshuo';
$term = get_term_by( 'slug', $slug, 'category' );

if ( ! $term ) {
	$term = wp_insert_term( '碎念（验证用）', 'category', array( 'slug' => $slug ) );
}

$term_id = (int) ( is_array( $term ) ? $term['term_id'] : $term->term_id );
set_theme_mod( 'yuki_shuoshuo_category', $term_id );

/* ---------- 2. 另外两个分类：一个放正式文章，一个只当反面对照 ---------- */
$posts_cat = get_term_by( 'slug', 'yuki-test-density-posts', 'category' );
if ( ! $posts_cat ) {
	$posts_cat = wp_insert_term( '正式文章（验证用）', 'category', array( 'slug' => 'yuki-test-density-posts' ) );
}
$posts_cat_id = (int) ( is_array( $posts_cat ) ? $posts_cat['term_id'] : $posts_cat->term_id );

/* ---------- 3. 清掉上一轮（按标记找，可重复执行）---------- */
foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-DENSITY',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
}

/* ---------- 4. 一张缩略图，挂到每条说说和那篇正式文章上 ---------- */
$uploads  = wp_upload_dir();
$img_path = trailingslashit( $uploads['path'] ) . 'yuki-density-thumb.png';
$im = imagecreatetruecolor( 600, 400 );
imagefill( $im, 0, 0, imagecolorallocate( $im, 165, 180, 252 ) );
imagestring( $im, 5, 200, 190, 'YUKI DENSITY', imagecolorallocate( $im, 255, 255, 255 ) );
imagepng( $im, $img_path );
imagedestroy( $im );

require_once ABSPATH . 'wp-admin/includes/image.php';
$thumb_id = wp_insert_attachment( array(
	'post_mime_type' => 'image/png',
	'post_title'     => 'YUKI-DENSITY 配图',
	'post_status'    => 'inherit',
), $img_path );
wp_update_attachment_metadata( $thumb_id, wp_generate_attachment_metadata( $thumb_id, $img_path ) );

/* ---------- 5. 三条短说说 ---------- */
$shuoshuo = array(
	array( 'text' => '今天把窗台上的绿萝挪到了有光的地方。', 'date' => '-3 hours' ),
	array( 'text' => '读到一句话：慢即是快。记一下。', 'date' => '-2 hours' ),
	array( 'text' => '雨停了，出去走了一圈。', 'date' => '-1 hour' ),
);

$items = array();

foreach ( $shuoshuo as $i => $one ) {
	$content = $one['text'] . ' YUKI-DENSITY-SHORT-' . $i;

	$post_id = wp_insert_post( array(
		'post_title'    => 'YUKI-DENSITY 说说 ' . ( $i + 1 ),
		'post_content'  => '<p>' . $content . '</p>',
		'post_status'   => 'publish',
		'post_type'     => 'post',
		'post_author'   => 1,
		'post_category' => array( $term_id ),
		'post_date'     => gmdate( 'Y-m-d H:i:s', strtotime( $one['date'] ) ),
		'post_date_gmt' => gmdate( 'Y-m-d H:i:s', strtotime( $one['date'] ) ),
	) );

	set_post_thumbnail( $post_id, $thumb_id );

	$items[] = array(
		'id'       => $post_id,
		'title'    => get_the_title( $post_id ),
		'has_title' => true,
		'marker'   => 'YUKI-DENSITY-SHORT-' . $i,
		'text'     => $content,
		'permalink' => get_permalink( $post_id ),
	);
}

/* ---------- 5b. 一条没有标题的说说：标题元素仍在，链接落在日期上 ---------- */
$untitled_id = wp_insert_post( array(
	'post_title'    => '',
	'post_content'  => '<p>没标题也说一句。YUKI-DENSITY-NOTITLE</p>',
	'post_status'   => 'publish',
	'post_type'     => 'post',
	'post_author'   => 1,
	'post_category' => array( $term_id ),
	'post_date'     => gmdate( 'Y-m-d H:i:s', strtotime( '-30 minutes' ) ),
	'post_date_gmt' => gmdate( 'Y-m-d H:i:s', strtotime( '-30 minutes' ) ),
) );
set_post_thumbnail( $untitled_id, $thumb_id );

/* ---------- 6. 一条正式文章（对照：别的归档照旧走大缩略图那套）---------- */
$post_id = wp_insert_post( array(
	'post_title'    => 'YUKI-DENSITY 正式文章',
	'post_content'  => '<p>' . str_repeat( '这是一篇正式文章，正文长得多，列表里该带缩略图与摘要。', 6 ) . '</p>',
	'post_excerpt'  => 'YUKI-DENSITY-POST-EXCERPT 正式文章的摘要。',
	'post_status'   => 'publish',
	'post_type'     => 'post',
	'post_author'   => 1,
	'post_category' => array( $posts_cat_id ),
) );
set_post_thumbnail( $post_id, $thumb_id );

// 顺手清掉早先误建的重复标签（同一名字、不是我们那个 slug、且没有文章）
$stray = get_term_by( 'name', '验证标签', 'post_tag' );
if ( $stray && 'yuki-test-density-tag' !== $stray->slug && 0 === (int) $stray->count ) {
	wp_delete_term( $stray->term_id, 'post_tag' );
}

/* ---------- 7. 一个标签，给标签归档用 ---------- */
$tag = get_term_by( 'slug', 'yuki-test-density-tag', 'post_tag' );
if ( ! $tag ) {
	$tag = wp_insert_term( '验证标签', 'post_tag', array( 'slug' => 'yuki-test-density-tag' ) );
}
// 按 id 挂标签，别按名字：wp_set_object_terms() 会把字符串当 slug 解析，
// 名字里是中文时会另建一个「名字当 slug」的重复标签（同一名字两个 term）
$tag_id = (int) ( is_array( $tag ) ? $tag['term_id'] : ( is_object( $tag ) ? $tag->term_id : 0 ) );
wp_set_post_tags( $post_id, array( $tag_id ) );

echo '说说分类 : ' . $term_id . '（' . get_term_link( $term_id, 'category' ) . "）\n";
echo 'theme mod: yuki_shuoshuo_category = ' . get_theme_mod( 'yuki_shuoshuo_category', 0 ) . "\n";
echo '缩略图   : attachment ' . $thumb_id . "\n";

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'site'              => home_url( '/' ),
	'shuoshuo_term_id'  => $term_id,
	'shuoshuo_name'     => get_term( $term_id, 'category' )->name,
	'shuoshuo_archive'  => get_term_link( $term_id, 'category' ),
	'posts_archive'     => get_term_link( $posts_cat_id, 'category' ),
	'tag_archive'       => get_tag_link( $tag_id ),
	'date_archive'      => get_year_link( gmdate( 'Y' ) ),
	'items'             => $items,
	'untitled'          => array(
		'id'        => $untitled_id,
		'marker'    => 'YUKI-DENSITY-NOTITLE',
		'permalink' => get_permalink( $untitled_id ),
	),
	'author_archive'    => get_author_posts_url( 1 ),
	'search_url'        => home_url( '/?s=YUKI-DENSITY' ),
	'regular_post_tags' => wp_get_post_tags( $post_id, array( 'fields' => 'names' ) ),
	'all_post_tags'     => array_map( fn( $t ) => $t->name . ' (' . $t->slug . ',' . $t->count . ')', get_terms( array( 'taxonomy' => 'post_tag', 'hide_empty' => false ) ) ),
	'regular_post'      => array(
		'id'        => $post_id,
		'permalink' => get_permalink( $post_id ),
		'excerpt'   => 'YUKI-DENSITY-POST-EXCERPT',
	),
) ) . "\n";
