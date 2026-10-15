<?php
/**
 * 文章列表项 — 首页 / 归档 / 搜索共用
 *
 * @package Yuki
 *
 * @param array $args {
 *     @type bool $show_cat 是否显示分类徽章，默认 true。
 *                        分类/标签归档下每篇都带同一个徽章，传 false 可去掉。
 * }
 */

$yuki_show_cat = ! isset( $args['show_cat'] ) || $args['show_cat'];
$yuki_cats     = $yuki_show_cat ? get_the_category() : array();
?>
<article class="yuki-post-item">
	<?php if ( has_post_thumbnail() ) : ?>
		<a class="yuki-post-thumb" href="<?php the_permalink(); ?>">
			<?php the_post_thumbnail( 'yuki-thumb' ); ?>
		</a>
	<?php endif; ?>
	<div class="yuki-post-body">
		<div class="yuki-post-meta">
			<?php if ( $yuki_cats ) : ?>
				<a class="yuki-cat-badge" href="<?php echo esc_url( get_category_link( $yuki_cats[0] ) ); ?>"><?php echo esc_html( $yuki_cats[0]->name ); ?></a>
			<?php endif; ?>
			<time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() ); ?></time>
		</div>
		<h2 class="yuki-post-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
		<p class="yuki-post-excerpt"><?php echo esc_html( get_the_excerpt() ); ?></p>
	</div>
</article>
