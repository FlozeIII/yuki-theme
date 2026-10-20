<?php
/**
 * 站点数据条：文章数、分类数、最近更新时间。
 *
 * @package Yuki
 */

$yuki_stats = function_exists( 'yuki_production_stats' )
	? yuki_production_stats()
	: array(
		'episodes'   => 0,
		'categories' => 0,
		'updated'    => '—',
	);

$yuki_class = isset( $args['class'] ) ? $args['class'] : '';
?>
<dl class="yuki-cover-specs yuki-stats-bar <?php echo esc_attr( $yuki_class ); ?>" data-yuki-stats>
	<div>
		<dt><?php esc_html_e( 'RECORDS', 'yuki' ); ?></dt>
		<dd><?php echo esc_html( sprintf( '%02d', (int) $yuki_stats['episodes'] ) ); ?></dd>
	</div>
	<div>
		<dt><?php esc_html_e( 'SECTORS', 'yuki' ); ?></dt>
		<dd><?php echo esc_html( sprintf( '%02d', (int) $yuki_stats['categories'] ) ); ?></dd>
	</div>
	<div>
		<dt><?php esc_html_e( 'UPDATED', 'yuki' ); ?></dt>
		<dd><?php echo esc_html( $yuki_stats['updated'] ); ?></dd>
	</div>
</dl>
