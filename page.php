<?php
/**
 * 静态页面 — 单栏正文
 *
 * 页面没有分类/标签/上下篇，也不挂载以文章为中心的侧边栏，
 * 因此走单栏窄容器，与文章页正文列同宽。
 *
 * @package Yuki
 */

get_header();
?>

<main class="yuki-narrow" style="padding-top:56px;padding-bottom:72px;">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<article <?php post_class(); ?>>

			<header class="yuki-article-header">
				<h1><?php the_title(); ?></h1>
				<?php if ( has_excerpt() ) : ?>
					<p style="font-size:17px;color:var(--yuki-muted-foreground);margin:0;"><?php echo esc_html( get_the_excerpt() ); ?></p>
				<?php endif; ?>
			</header>

			<?php if ( has_post_thumbnail() ) : ?>
				<figure class="yuki-article-featured yuki-soft-frame">
					<?php the_post_thumbnail( 'large' ); ?>
				</figure>
			<?php endif; ?>

			<div class="yuki-prose">
				<?php the_content(); ?>
				<?php
				// 静态页面的正文同样可以用分页标记切开，同一处缺陷在这儿也一样存在。
				// 理由与取舍见 single.php 那一处。
				wp_link_pages();
				?>
			</div>

			<?php comments_template(); ?>
		</article>
	<?php endwhile; ?>
</main>

<?php
get_footer();
