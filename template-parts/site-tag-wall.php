<?php
/**
 * 标签墙：标签密集列表。默认展开，脚本只负责把长列表折叠成 details。
 *
 * @package Yuki
 */

$yuki_tags = get_tags( array(
	'hide_empty' => true,
	'orderby'    => 'count',
	'order'      => 'DESC',
	'number'     => 0,
) );

if ( empty( $yuki_tags ) ) :
	?>
	<p class="yuki-tag-wall-empty"><?php esc_html_e( '暂无标签。', 'yuki' ); ?></p>
	<?php
	return;
endif;

$yuki_tag_count = count( $yuki_tags );
?>
<details class="yuki-tag-wall" data-yuki-tag-wall data-collapse-at="12" open>
	<summary>
		<span class="yuki-tag-wall-kicker"><?php esc_html_e( 'TAG INDEX', 'yuki' ); ?></span>
		<span class="yuki-tag-wall-title"><?php esc_html_e( '标签墙', 'yuki' ); ?></span>
		<span class="yuki-tag-wall-count">
			<?php
			/* translators: %d: 标签数量 */
			echo esc_html( sprintf( _n( '%d 项', '%d 项', $yuki_tag_count, 'yuki' ), $yuki_tag_count ) );
			?>
		</span>
	</summary>
	<ul class="yuki-tag-wall-list">
		<?php foreach ( $yuki_tags as $yuki_tag ) : ?>
			<li>
				<a href="<?php echo esc_url( get_tag_link( $yuki_tag ) ); ?>">
					<span><?php echo esc_html( $yuki_tag->name ); ?></span>
					<span class="yuki-tag-wall-item-count"><?php echo esc_html( (string) $yuki_tag->count ); ?></span>
				</a>
			</li>
		<?php endforeach; ?>
	</ul>
</details>
