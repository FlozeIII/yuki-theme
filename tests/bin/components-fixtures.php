<?php
/**
 * 组件验收造数：把五个 pattern 的内容拼成一页，交给 WordPress 真正渲染。
 *
 * 用法:
 *   php tests/bin/components-fixtures.php <wordpress目录>
 *   php tests/bin/components-fixtures.php <wordpress目录> --cleanup
 */

$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php components-fixtures.php <wordpress目录> [--cleanup]\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

/**
 * 按标记删除旧页面，可重复执行。
 *
 * @return int 删除数量。
 */
function yuki_components_cleanup() {
	$deleted = 0;
	foreach ( get_posts( array(
		'post_type'   => 'page',
		'numberposts' => -1,
		'post_status' => 'any',
		's'           => 'YUKI-COMPONENTS',
	) ) as $old ) {
		wp_delete_post( $old->ID, true );
		$deleted++;
	}
	return $deleted;
}

if ( isset( $argv[2] ) && '--cleanup' === $argv[2] ) {
	$deleted = yuki_components_cleanup();
	echo 'YUKI-JSON: ' . wp_json_encode( array( 'cleaned' => $deleted ) ) . "\n";
	exit( 0 );
}

$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! $admins ) {
	fwrite( STDERR, "找不到管理员账号，造数没法继续。\n" );
	exit( 3 );
}

wp_set_current_user( (int) $admins[0]->ID );
yuki_components_cleanup();

/*
 * 主题 pattern 会按主题版本缓存；开发时版本号故意不动，所以这里清一次缓存，
 * 让新增的 patterns/ 文件在当前请求里重新登记。正式发版时 Version 变化会自然失效。
 */
wp_get_theme()->delete_pattern_cache();
if ( function_exists( '_register_theme_block_patterns' ) ) {
	_register_theme_block_patterns();
}

$slugs = array(
	'yuki/archive-note',
	'yuki/archive-spec',
	'yuki/archive-timeline',
	'yuki/archive-evidence',
	'yuki/archive-brief',
);

$registry = WP_Block_Patterns_Registry::get_instance();
$patterns = array();
$content  = '';

foreach ( $slugs as $slug ) {
	$pattern = $registry->get_registered( $slug );
	if ( ! $pattern ) {
		continue;
	}
	$patterns[ $slug ] = array(
		'title'  => $pattern['title'],
		'blocks' => count( parse_blocks( $pattern['content'] ) ),
	);
	$content .= "\n" . $pattern['content'] . "\n";
}

$page_id = wp_insert_post( array(
	'post_title'   => 'YUKI-COMPONENTS 组件验收',
	'post_content' => $content,
	'post_status'  => 'publish',
	'post_type'    => 'page',
	'post_author'  => (int) $admins[0]->ID,
	'post_name'    => 'yuki-components-verify',
) );

if ( is_wp_error( $page_id ) ) {
	fwrite( STDERR, '页面创建失败：' . $page_id->get_error_message() . "\n" );
	exit( 4 );
}

echo 'YUKI-JSON: ' . wp_json_encode( array(
	'page_id'            => $page_id,
	'url'                => get_permalink( $page_id ),
	'patterns'           => $patterns,
	'pattern_categories' => array_map(
		static function ( $category ) {
			return $category['name'];
		},
		WP_Block_Pattern_Categories_Registry::get_instance()->get_all_registered()
	),
	'editor_stylesheets' => get_editor_stylesheets(),
	'html'               => get_post_field( 'post_content', $page_id ),
) ) . "\n";
