<?php
/**
 * 文章页侧边栏
 *
 * @package Yuki
 */

$author_name = get_the_author();
?>
<aside class="yuki-sidebar">

	<div class="yuki-widget">
		<h3><?php esc_html_e( '作者简介', 'yuki' ); ?></h3>
		<div class="yuki-author-card">
			<?php echo get_avatar( get_the_author_meta( 'ID' ), 56 ); ?>
			<div>
				<div class="name"><?php echo esc_html( $author_name ); ?></div>
				<div class="role"><?php echo esc_html( get_the_author_meta( 'description' ) ? __( '作者', 'yuki' ) : __( '独立创作者', 'yuki' ) ); ?></div>
			</div>
		</div>
		<p style="margin:0;font-size:14px;color:var(--yuki-muted-foreground);">
			<?php echo esc_html( wp_trim_words( get_the_author_meta( 'description' ), 40, '…' ) ); ?>
		</p>
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

	<div class="yuki-widget">
		<h3><?php esc_html_e( '标签云', 'yuki' ); ?></h3>
		<?php
		wp_tag_cloud( array(
			'smallest' => 12,
			'largest'  => 12,
			'unit'     => 'px',
			'number'   => 14,
		) );
		?>
	</div>

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

</aside>
