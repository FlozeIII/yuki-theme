<?php
/**
 * 首页 / 博客列表 — 纵向文章陈列
 *
 * @package Yuki
 */

get_header();
?>

<section class="yuki-hero yuki-dot-pattern">
	<div class="yuki-hero-petals" aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
		<span></span>
		<span></span>
		<span></span>
		<span></span>
	</div>
	<div class="yuki-narrow">
		<div class="yuki-hero-title-row">
			<h1><?php bloginfo( 'name' ); ?></h1>
			<?php get_template_part( 'template-parts/mascot', null, array( 'size' => 'lg', 'class' => 'yuki-hero-mascot' ) ); ?>
		</div>
		<p><?php bloginfo( 'description' ); ?></p>
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
			<p><?php esc_html_e( '雪兔把院子扫干净了——还没有文章，去后台发布第一篇吧。', 'yuki' ); ?></p>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
