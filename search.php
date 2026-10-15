<?php
/**
 * 搜索结果
 *
 * @package Yuki
 */

get_header();

global $wp_query;
?>

<section class="yuki-hero yuki-dot-pattern">
	<div class="yuki-narrow">
		<h1><?php
			/* translators: %s: 搜索关键词 */
			printf( esc_html__( '搜索「%s」', 'yuki' ), esc_html( get_search_query() ) );
		?></h1>
		<p><?php
			/* translators: %d: 结果数量 */
			printf( esc_html__( '共找到 %d 篇文章', 'yuki' ), (int) $wp_query->found_posts );
		?></p>
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
		<div class="yuki-narrow" style="padding:80px 0;text-align:center;color:var(--yuki-muted-foreground);">
			<p style="margin-bottom:24px;"><?php esc_html_e( '没有找到匹配的文章，换个关键词试试。', 'yuki' ); ?></p>
			<?php get_search_form(); ?>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
