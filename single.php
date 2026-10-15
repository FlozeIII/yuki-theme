<?php
/**
 * 文章详情页 — 主内容 + 侧边栏 + 备案号页脚
 *
 * @package Yuki
 */

get_header();
?>

<main class="yuki-container" style="padding-top:56px;padding-bottom:72px;">
	<?php
	while ( have_posts() ) :
		the_post();
		$cats = get_the_category();
		?>
		<article <?php post_class(); ?>>

			<header class="yuki-article-header">
				<div class="yuki-post-meta">
					<?php if ( $cats ) : ?>
						<a class="yuki-cat-badge" href="<?php echo esc_url( get_category_link( $cats[0] ) ); ?>"><?php echo esc_html( $cats[0]->name ); ?></a>
					<?php endif; ?>
					<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
					<span><?php echo esc_html( yuki_reading_time() ); ?></span>
				</div>
				<h1><?php the_title(); ?></h1>
				<?php if ( has_excerpt() ) : ?>
					<p style="font-size:17px;color:var(--yuki-muted-foreground);margin:0;"><?php echo esc_html( get_the_excerpt() ); ?></p>
				<?php endif; ?>
			</header>

			<div class="yuki-single-layout">
				<div class="yuki-article-main">
					<?php if ( has_post_thumbnail() ) : ?>
						<figure class="yuki-article-featured yuki-soft-frame">
							<?php the_post_thumbnail( 'large' ); ?>
						</figure>
					<?php endif; ?>

					<div class="yuki-prose">
						<?php the_content(); ?>
					</div>

					<?php if ( get_the_tag_list() ) : ?>
						<div class="yuki-tags"><?php echo get_the_tag_list( '', '' ); ?></div>
					<?php endif; ?>

					<nav class="yuki-post-nav">
						<?php
						$prev = get_previous_post();
						$next = get_next_post();
						?>
						<?php if ( $prev ) : ?>
							<a href="<?php echo esc_url( get_permalink( $prev ) ); ?>">
								<div class="label">&larr; <?php esc_html_e( '上一篇', 'yuki' ); ?></div>
								<div class="title"><?php echo esc_html( get_the_title( $prev ) ); ?></div>
							</a>
						<?php endif; ?>
						<?php if ( $next ) : ?>
							<a class="next" href="<?php echo esc_url( get_permalink( $next ) ); ?>">
								<div class="label"><?php esc_html_e( '下一篇', 'yuki' ); ?> &rarr;</div>
								<div class="title"><?php echo esc_html( get_the_title( $next ) ); ?></div>
							</a>
						<?php endif; ?>
					</nav>

					<?php comments_template(); ?>
				</div>

				<?php get_sidebar(); ?>
			</div>
		</article>
	<?php endwhile; ?>
</main>

<?php
get_footer();
