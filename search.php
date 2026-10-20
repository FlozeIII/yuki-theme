<?php
/**
 * 搜索结果
 *
 * @package Yuki
 */

get_header();

global $wp_query;

$yuki_count = isset( $wp_query->found_posts ) ? (int) $wp_query->found_posts : 0;
?>

<section class="yuki-hero yuki-dot-pattern yuki-archive-hero">
	<div class="yuki-container">
		<div class="yuki-cover-meta">
			<span><?php esc_html_e( 'SEARCH INDEX', 'yuki' ); ?></span>
			<span><?php esc_html_e( 'QUERY', 'yuki' ); ?> / <?php echo esc_html( get_search_query() ); ?></span>
			<span><?php echo esc_html( sprintf( '%02d ENTRIES', $yuki_count ) ); ?></span>
		</div>
		<p class="yuki-kicker yuki-hero-kicker"><?php esc_html_e( 'RECORDS / SEARCH', 'yuki' ); ?></p>
		<h1><?php
			/* translators: %s: 搜索关键词 */
			printf( esc_html__( '搜索「%s」', 'yuki' ), esc_html( get_search_query() ) );
		?></h1>
		<p><?php
			/* translators: %d: 结果数量 */
			printf( esc_html__( '共找到 %d 篇文章', 'yuki' ), (int) $wp_query->found_posts );
		?></p>
		<div class="yuki-hero-rule">
			<span><?php esc_html_e( 'MATCHING FILES', 'yuki' ); ?></span>
			<span><?php echo esc_html( get_search_query() ); ?></span>
			<span><?php echo esc_html( sprintf( '%02d ENTRIES', $yuki_count ) ); ?></span>
		</div>
	</div>
</section>

<main class="yuki-container">
	<?php if ( have_posts() ) : ?>
		<div class="yuki-post-list">
			<?php
			while ( have_posts() ) :
				the_post();
				get_template_part( 'template-parts/post-item' );
			endwhile;
			?>
		</div>

		<nav class="yuki-pagination">
			<?php echo paginate_links( array(
				'prev_text' => '&larr;',
				'next_text' => '&rarr;',
			) ); ?>
		</nav>
	<?php else : ?>
		<div class="yuki-narrow yuki-empty-state">
			<?php get_template_part( 'template-parts/mascot', null, array( 'size' => 'sm' ) ); ?>
			<p style="margin-bottom:24px;"><?php esc_html_e( '雪兔竖起耳朵听了半天，没有找到匹配的文章。换个关键词试试。', 'yuki' ); ?></p>
			<?php get_search_form(); ?>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
