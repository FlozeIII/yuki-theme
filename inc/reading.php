<?php
/**
 * 单篇阅读辅助：系列归类、自动目录与阅读进度。
 *
 * 目录和进度由 assets/js/reading.js 在浏览器里生成；系列由这里注册的
 * yuki_series 分类提供，只在文章有系列、且系列里不止一篇时输出。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 注册文章系列分类。
 *
 * 不生成前台系列归档，只在编辑器里给作者归类用；读者通过单篇里的
 * 系列导航在文章之间移动。
 *
 * @return void
 */
function yuki_register_series_taxonomy() {
	register_taxonomy(
		'yuki_series',
		'post',
		array(
			'labels'            => array(
				'name'          => __( '系列', 'yuki' ),
				'singular_name' => __( '系列', 'yuki' ),
				'menu_name'     => __( '系列', 'yuki' ),
				'all_items'     => __( '所有系列', 'yuki' ),
				'edit_item'     => __( '编辑系列', 'yuki' ),
				'view_item'     => __( '查看系列', 'yuki' ),
				'update_item'   => __( '更新系列', 'yuki' ),
				'add_new_item'  => __( '新建系列', 'yuki' ),
				'new_item_name' => __( '系列名称', 'yuki' ),
				'search_items'  => __( '搜索系列', 'yuki' ),
				'not_found'     => __( '没有系列', 'yuki' ),
			),
			'public'            => false,
			'publicly_queryable' => false,
			'show_ui'           => true,
			'show_in_rest'      => true,
			'show_admin_column' => true,
			'hierarchical'      => false,
			'rewrite'           => false,
			'query_var'         => false,
		)
	);
}
add_action( 'init', 'yuki_register_series_taxonomy', 8 );

/**
 * 单篇加载目录与进度脚本。
 *
 * @return void
 */
function yuki_reading_assets() {
	if ( ! is_singular( 'post' ) ) {
		return;
	}

	wp_enqueue_script(
		'yuki-reading',
		get_template_directory_uri() . '/assets/js/reading.js',
		array(),
		yuki_asset_version(),
		true
	);
	wp_localize_script(
		'yuki-reading',
		'yukiReading',
		array(
			'tocLabel'      => __( '目录', 'yuki' ),
			'progressLabel' => __( '阅读进度', 'yuki' ),
		)
	);
}
add_action( 'wp_enqueue_scripts', 'yuki_reading_assets', 21 );

/**
 * 取当前文章的系列与其中文章。
 *
 * 只返回第一篇系列分类；没有系列、系列里只有当前这一篇时返回 null。
 *
 * @return array|null
 */
function yuki_get_series() {
	if ( ! is_singular( 'post' ) ) {
		return null;
	}

	$terms = get_the_terms( get_the_ID(), 'yuki_series' );
	if ( empty( $terms ) || is_wp_error( $terms ) ) {
		return null;
	}

	$term  = $terms[0];
	$posts = get_posts(
		array(
			'post_type'      => 'post',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => array(
				'date' => 'ASC',
				'ID'   => 'ASC',
			),
			'tax_query'      => array(
				array(
					'taxonomy' => 'yuki_series',
					'field'    => 'term_id',
					'terms'    => $term->term_id,
				),
			),
		)
	);

	if ( count( $posts ) < 2 ) {
		return null;
	}

	return array(
		'term'  => $term,
		'posts' => $posts,
	);
}

/**
 * 输出单篇底部的系列导航。
 *
 * @return void
 */
function yuki_series_nav() {
	$series = yuki_get_series();
	if ( ! $series ) {
		return;
	}

	$term  = $series['term'];
	$posts = $series['posts'];

	/* translators: %s: series name. */
	$label = sprintf( __( '系列：%s', 'yuki' ), $term->name );
	?>
	<nav class="yuki-series" aria-label="<?php echo esc_attr( $label ); ?>">
		<p class="yuki-series-label"><span><?php esc_html_e( 'SERIES', 'yuki' ); ?></span><span><?php echo esc_html( $term->name ); ?></span></p>
		<ol class="yuki-series-list">
			<?php foreach ( $posts as $index => $series_post ) : ?>
				<?php $is_current = ( (int) $series_post->ID === (int) get_the_ID() ); ?>
				<li<?php echo $is_current ? ' class="is-current"' : ''; ?>>
					<?php if ( $is_current ) : ?>
						<span class="yuki-series-index" aria-hidden="true"><?php echo esc_html( sprintf( '%02d', $index + 1 ) ); ?></span>
						<span class="yuki-series-title" aria-current="page"><?php echo esc_html( get_the_title( $series_post ) ); ?></span>
					<?php else : ?>
						<span class="yuki-series-index" aria-hidden="true"><?php echo esc_html( sprintf( '%02d', $index + 1 ) ); ?></span>
						<a class="yuki-series-title" href="<?php echo esc_url( get_permalink( $series_post ) ); ?>"><?php echo esc_html( get_the_title( $series_post ) ); ?></a>
					<?php endif; ?>
				</li>
			<?php endforeach; ?>
		</ol>
	</nav>
	<?php
}
