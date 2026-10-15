<?php
/**
 * 首页 / 博客列表 — 纵向文章陈列
 *
 * @package Yuki
 */

get_header();
?>

<section class="yuki-hero yuki-dot-pattern">
	<div class="yuki-narrow">
		<h1><?php bloginfo( 'name' ); ?></h1>
		<p><?php bloginfo( 'description' ); ?></p>
	</div>
</section>

<main class="yuki-container">
	<?php if ( have_posts() ) : ?>
		<div class="yuki-post-list">
			<?php
			while ( have_posts() ) :
				the_post();
				$cats = get_the_category();
				?>
				<article class="yuki-post-item">
					<?php if ( has_post_thumbnail() ) : ?>
						<a class="yuki-post-thumb" href="<?php the_permalink(); ?>">
							<?php the_post_thumbnail( 'yuki-thumb' ); ?>
						</a>
					<?php endif; ?>
					<div class="yuki-post-body">
						<div class="yuki-post-meta">
							<?php if ( $cats ) : ?>
								<a class="yuki-cat-badge" href="<?php echo esc_url( get_category_link( $cats[0] ) ); ?>"><?php echo esc_html( $cats[0]->name ); ?></a>
							<?php endif; ?>
							<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
						</div>
						<h2 class="yuki-post-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
						<p class="yuki-post-excerpt"><?php echo esc_html( get_the_excerpt() ); ?></p>
					</div>
				</article>
			<?php endwhile; ?>
		</div>

		<nav class="yuki-pagination">
			<?php echo paginate_links( array(
				'prev_text' => '&larr;',
				'next_text' => '&rarr;',
			) ); ?>
		</nav>
	<?php else : ?>
		<div class="yuki-narrow" style="padding:80px 0;text-align:center;color:var(--yuki-muted-foreground);">
			<p><?php esc_html_e( '还没有文章，去后台发布第一篇吧。', 'yuki' ); ?></p>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
