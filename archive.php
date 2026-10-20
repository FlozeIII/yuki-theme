<?php
/**
 * 归档 — 分类 / 标签 / 作者 / 日期 / 自定义分类法
 *
 * WordPress 模板层级会把以上类型全部兜到 archive.php，
 * 所以不再单独建 category.php / tag.php / date.php / author.php 这些近乎重复的文件。
 *
 * @package Yuki
 */

get_header();

global $wp_query;

$yuki_is_tax = is_category() || is_tag() || is_tax();
$yuki_count  = isset( $wp_query->found_posts ) ? (int) $wp_query->found_posts : 0;
$yuki_updated = get_lastpostdate( 'blog' );
$yuki_updated_label = $yuki_updated ? mysql2date( 'Y.m.d', $yuki_updated ) : '—';

// 说说的承载体分类被配置了、而且现在打开的正是它的归档：只有这一种归档换紧凑版式，
// 别的分类/标签/日期归档一律照旧。承载体没配置或被删时 yuki_shuoshuo_category_id()
// 返回 0，这里自然不生效。
$yuki_shuoshuo_id = function_exists( 'yuki_shuoshuo_category_id' ) ? yuki_shuoshuo_category_id() : 0;
$yuki_is_shuoshuo = $yuki_shuoshuo_id && is_category() && (int) get_queried_object_id() === $yuki_shuoshuo_id;
?>

<section class="yuki-hero yuki-dot-pattern yuki-archive-hero">
	<div class="yuki-container">
		<div class="yuki-cover-meta">
			<span><?php esc_html_e( 'ARCHIVE INDEX', 'yuki' ); ?></span>
			<span><?php esc_html_e( 'UPDATED', 'yuki' ); ?> <?php echo esc_html( $yuki_updated_label ); ?></span>
			<span><?php echo esc_html( sprintf( '%02d ENTRIES', $yuki_count ) ); ?></span>
		</div>
		<p class="yuki-kicker yuki-hero-kicker"><?php esc_html_e( 'RECORDS / BACK MATTER', 'yuki' ); ?></p>
		<h1><?php echo wp_kses_post( get_the_archive_title() ); ?></h1>
		<?php $yuki_desc = get_the_archive_description(); ?>
		<?php if ( $yuki_desc ) : ?>
			<p><?php echo wp_kses_post( $yuki_desc ); ?></p>
		<?php endif; ?>
		<div class="yuki-hero-rule">
			<span><?php esc_html_e( 'FILED UNDER', 'yuki' ); ?></span>
			<span><?php echo esc_html( wp_strip_all_tags( get_the_archive_title() ) ); ?></span>
			<span><?php echo esc_html( sprintf( '%02d ENTRIES', $yuki_count ) ); ?></span>
		</div>
	</div>
</section>

<main class="yuki-container">
	<?php if ( $yuki_is_shuoshuo ) : ?>
		<?php get_template_part( 'template-parts/shuoshuo-composer' ); ?>
	<?php endif; ?>

	<?php if ( have_posts() ) : ?>
		<div class="<?php echo $yuki_is_shuoshuo ? 'yuki-shuoshuo-list' : 'yuki-post-list'; ?>">
			<?php
			while ( have_posts() ) :
				the_post();

				if ( $yuki_is_shuoshuo ) {
					get_template_part( 'template-parts/shuoshuo-item' );
				} else {
					get_template_part( 'template-parts/post-item', null, array( 'show_cat' => ! $yuki_is_tax ) );
				}
			endwhile;
			?>
		</div>

		<nav class="yuki-pagination">
			<?php echo paginate_links( array(
				'prev_text' => '&larr;',
				'next_text' => '&rarr;',
			) ); ?>
		</nav>
	<?php else : ?>
		<div class="yuki-narrow yuki-empty-state">
			<?php get_template_part( 'template-parts/mascot', null, array( 'size' => 'sm' ) ); ?>
			<p><?php esc_html_e( '雪兔翻遍了这一栏，还没有文章。', 'yuki' ); ?></p>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
