<?php
/**
 * 文章详情页 — 主内容 + 侧边栏 + 备案号页脚
 *
 * @package Yuki
 */

get_header();
?>

<main class="yuki-container">
	<?php
	while ( have_posts() ) :
		the_post();
		$cats = get_the_category();
		?>
		<article <?php post_class(); ?>>

			<div class="yuki-filebar" aria-hidden="true">
				<span><?php esc_html_e( 'DOCUMENT', 'yuki' ); ?> / <?php echo esc_html( sprintf( '%04d', get_the_ID() ) ); ?></span>
				<span><?php esc_html_e( 'SECTOR', 'yuki' ); ?> / <?php echo esc_html( $cats ? $cats[0]->name : '—' ); ?></span>
				<span><?php esc_html_e( 'STATUS / RELEASED', 'yuki' ); ?></span>
			</div>

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
					<p><?php echo esc_html( get_the_excerpt() ); ?></p>
				<?php endif; ?>
			</header>

			<div class="yuki-single-layout">
				<div class="yuki-article-main">
					<?php if ( has_post_thumbnail() ) : ?>
						<figure class="yuki-article-featured yuki-soft-frame">
							<?php the_post_thumbnail( 'large' ); ?>
							<figcaption class="yuki-frame-label">
								<span><?php esc_html_e( 'EVIDENCE', 'yuki' ); ?></span>
								<span><?php esc_html_e( 'PLATE 01', 'yuki' ); ?></span>
							</figcaption>
						</figure>
					<?php endif; ?>

					<div class="yuki-toc-slot" data-yuki-toc></div>

					<div class="yuki-prose">
						<?php the_content(); ?>
						<?php
						/*
						 * 用分页标记（`<!--nextpage-->`）切开的文章，读者得能走到下一页。
						 * 用核心默认的包裹与文案，它落在 `.yuki-prose` 里，排版跟着正文走
						 * （另配样式要动共享的 `style.css`，不在这一件里）。
						 * 没有分页标记的文章，核心自己什么都不输出，不会多出空的翻页区。
						 */
						wp_link_pages();
						?>
					</div>

					<?php if ( get_the_tag_list() ) : ?>
						<div class="yuki-tags"><?php echo get_the_tag_list( '', '' ); ?></div>
					<?php endif; ?>

					<?php if ( function_exists( 'yuki_series_nav' ) ) : ?>
						<?php yuki_series_nav(); ?>
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

					<?php get_template_part( 'template-parts/related-posts' ); ?>

					<?php comments_template(); ?>
				</div>

				<?php get_sidebar(); ?>
			</div>
		</article>
	<?php endwhile; ?>
</main>

<?php
get_footer();
