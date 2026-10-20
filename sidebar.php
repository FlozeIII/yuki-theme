<?php
/**
 * 文章页侧边栏
 *
 * 在「外观 → 小工具」里往「文章侧边栏」放置小工具后接管这里；
 * 一个都没放时回退到下面这套内置默认小工具，保证开箱即用。
 *
 * @package Yuki
 */

?>
<aside class="yuki-sidebar">
	<div class="yuki-sidebar-head" aria-hidden="true">
		<span><?php esc_html_e( 'SYSTEM NOTES', 'yuki' ); ?></span>
		<span><?php esc_html_e( 'ACCESS LOG', 'yuki' ); ?></span>
	</div>
<?php if ( is_active_sidebar( 'sidebar-single' ) ) : ?>

	<?php dynamic_sidebar( 'sidebar-single' ); ?>

<?php else : ?>

	<div class="yuki-widget">
		<h3><?php esc_html_e( '作者简介', 'yuki' ); ?></h3>
		<?php get_template_part( 'template-parts/site-author-card' ); ?>
	</div>

	<div class="yuki-widget">
		<h3><?php esc_html_e( '一言', 'yuki' ); ?></h3>
		<?php
		// 取回与兜底都交给 yuki_hitokoto()，这里只管显示：上游给的东西（兜底句也一样）
		// 一律 esc_html 之后再输出，第三方返回什么都不会变成页面上的标记。
		$yuki_quote = yuki_hitokoto();
		?>
		<blockquote class="yuki-hitokoto">
			<p><?php echo esc_html( $yuki_quote['text'] ); ?></p>
			<?php if ( ! empty( $yuki_quote['source'] ) ) : ?>
				<cite><?php echo esc_html( $yuki_quote['source'] ); ?></cite>
			<?php endif; ?>
		</blockquote>
	</div>

	<div class="yuki-widget">
		<h3><?php esc_html_e( '分类', 'yuki' ); ?></h3>
		<ul>
			<?php
			wp_list_categories( array(
				'title_li'  => '',
				'show_count'=> true,
				'orderby'   => 'count',
				'order'     => 'DESC',
				'number'    => 6,
			) );
			?>
		</ul>
	</div>

	<div class="yuki-widget yuki-widget--tag-wall">
		<?php get_template_part( 'template-parts/site-tag-wall' ); ?>
	</div>

	<?php get_template_part( 'template-parts/site-subscribe' ); ?>

	<div class="yuki-widget">
		<h3><?php esc_html_e( '热门文章', 'yuki' ); ?></h3>
		<ul>
			<?php
			$popular = new WP_Query( array(
				'posts_per_page'      => 4,
				'orderby'             => 'comment_count',
				'ignore_sticky_posts' => true,
			) );
			if ( $popular->have_posts() ) :
				while ( $popular->have_posts() ) :
					$popular->the_post();
					?>
					<li>
						<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
					</li>
					<?php
				endwhile;
				wp_reset_postdata();
			else :
				echo '<li>' . esc_html__( '暂无数据', 'yuki' ) . '</li>';
			endif;
			?>
		</ul>
	</div>

<?php endif; ?>

</aside>
