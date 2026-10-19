<?php
/**
 * 工单 01（代码块复制）的造数：一个页面、一条说说。
 *
 * 页面里放五种标记：
 *   - 核心代码块（wp-block-code + alignwide），代码含多行、缩进、引号、`<`、`&`
 *   - 行内 code（不该被接管）
 *   - 经典 `<pre><code>`（不是区块也要有按钮）
 *   - 纯空白代码块（不包装、不按钮）
 *
 * 说说的承载分类用站点现有的 `yuki_shuoshuo_category`，**不改这个全站设置**；
 * 没配置时就不造说说，验收脚本按 `shuoshuo_url: null` 跳过那一组。
 *
 * 用法:
 *   php tests/bin/code-copy-fixtures.php <wordpress目录>             造数
 *   php tests/bin/code-copy-fixtures.php <wordpress目录> --cleanup   清掉本工单的页面与说说
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php code-copy-fixtures.php <wordpress目录>\n" );
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
$removed = 0;
foreach ( get_posts( array(
	'post_type'   => array( 'post', 'page' ),
	'numberposts' => -1,
	'post_status' => 'any',
	's'           => 'YUKI-CODE-COPY',
) ) as $old ) {
	wp_delete_post( $old->ID, true );
	$removed++;
}

// 验收脚本跑完会带 --cleanup 再来一次：这条说说落在共享的说说分类里，
// 留着会改到别的工单（例如说说归档的条数）的造数现场。
if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	echo 'YUKI-JSON: ' . wp_json_encode( array( 'cleaned' => $removed ) ) . "\n";
	exit( 0 );
}

/* ---------- 2. 三段代码：多行、缩进、引号、实体 ---------- */
$wide_code = <<<'CODE'
// YUKI-CODE-COPY-WIDE
const message = "Hello, 世界";

function add(a, b) {
	return a + b;
}

if (a < b && b > 0) {
	console.log('<p> & "quoted"');
}
CODE;

$classic_code = <<<'CODE'
-- YUKI-CODE-COPY-CLASSIC
SELECT *
FROM posts
WHERE title LIKE '%Yuki%'
	AND status = 'publish';
CODE;

$shuoshuo_code = <<<'CODE'
// YUKI-CODE-COPY-SHUOSHUO
const yuki = {
	name: '雪兔',
	quote: "晚风 & 雪",
};
CODE;

/* ---------- 3. 页面：宽块、行内 code、经典 pre、空白块 ---------- */
$content = implode( "\n", array(
	'<p>YUKI-CODE-COPY-INTRO 下面四段分别验证四种边界。</p>',
	'<pre class="wp-block-code alignwide"><code>' . esc_html( $wide_code ) . '</code></pre>',
	'<p>YUKI-CODE-COPY-INLINE 行内 <code>inlineOnly()</code> 不该有按钮。</p>',
	'<pre><code>' . esc_html( $classic_code ) . '</code></pre>',
	'<pre class="wp-block-code" data-yuki-empty="1"><code>   ' . "\n\t" . '   </code></pre>',
) );

$page_id = wp_insert_post( array(
	'post_title'   => 'YUKI-CODE-COPY 页面',
	'post_content' => $content,
	'post_status'  => 'publish',
	'post_type'    => 'page',
	'post_author'  => $admin_id,
) );

/* ---------- 4. 说说：用现有的承载分类，不改全站设置 ---------- */
$shuoshuo_id  = 0;
$shuoshuo_url = null;
$shuoshuo_cat = (int) get_theme_mod( 'yuki_shuoshuo_category', 0 );

if ( $shuoshuo_cat && get_term( $shuoshuo_cat ) ) {
	$shuoshuo_id = wp_insert_post( array(
		'post_title'   => 'YUKI-CODE-COPY 说说',
		'post_content' => '<p>YUKI-CODE-COPY-SHUOSHUO-BODY 代码块在说说里也要有按钮。</p>'
			. '<pre class="wp-block-code"><code>' . esc_html( $shuoshuo_code ) . '</code></pre>',
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
	'wide_code'    => $wide_code,
	'classic_code' => $classic_code,
	'shuoshuo_code' => $shuoshuo_code,
	'markers'      => array(
		'wide'     => 'YUKI-CODE-COPY-WIDE',
		'classic'  => 'YUKI-CODE-COPY-CLASSIC',
		'inline'   => 'YUKI-CODE-COPY-INLINE',
		'empty'    => 'YUKI-CODE-COPY-EMPTY',
		'shuoshuo' => 'YUKI-CODE-COPY-SHUOSHUO',
	),
) ) . "\n";
