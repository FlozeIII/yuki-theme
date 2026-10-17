<?php
/**
 * 文章末尾的关联文章：最多三篇，标题 + 日期，不带缩略图。
 *
 * 没有关联时整段不输出——极简线内不制造空区块。
 *
 * @package Yuki
 */

$yuki_related = yuki_related_posts( get_the_ID(), 3 );

if ( ! $yuki_related ) {
	return;
}
?>
<nav class="yuki-related" aria-label="<?php esc_attr_e( '相关文章', 'yuki' ); ?>">
	<h2 class="yuki-related-title"><?php esc_html_e( '相关文章', 'yuki' ); ?></h2>
	<ul class="yuki-related-list">
		<?php foreach ( $yuki_related as $yuki_related_post ) : ?>
			<li class="yuki-related-item">
				<a href="<?php echo esc_url( get_permalink( $yuki_related_post ) ); ?>">
					<span class="yuki-related-item-title"><?php echo esc_html( get_the_title( $yuki_related_post ) ); ?></span>
					<time datetime="<?php echo esc_attr( get_the_date( 'c', $yuki_related_post ) ); ?>"><?php echo esc_html( get_the_date( '', $yuki_related_post ) ); ?></time>
				</a>
			</li>
		<?php endforeach; ?>
	</ul>
</nav>
