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

$yuki_is_tax = is_category() || is_tag() || is_tax();

// 说说的承载体分类被配置了、而且现在打开的正是它的归档：只有这一种归档换紧凑版式，
// 别的分类/标签/日期归档一律照旧。承载体没配置或被删时 yuki_shuoshuo_category_id()
// 返回 0，这里自然不生效。
$yuki_shuoshuo_id = function_exists( 'yuki_shuoshuo_category_id' ) ? yuki_shuoshuo_category_id() : 0;
$yuki_is_shuoshuo = $yuki_shuoshuo_id && is_category() && (int) get_queried_object_id() === $yuki_shuoshuo_id;
?>

<section class="yuki-hero yuki-dot-pattern">
	<div class="yuki-narrow">
		<h1><?php echo wp_kses_post( get_the_archive_title() ); ?></h1>
		<?php $yuki_desc = get_the_archive_description(); ?>
		<?php if ( $yuki_desc ) : ?>
			<p><?php echo wp_kses_post( $yuki_desc ); ?></p>
		<?php endif; ?>
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
		<div class="yuki-narrow" style="padding:80px 0;text-align:center;color:var(--yuki-muted-foreground);">
			<p><?php esc_html_e( '这个归档下还没有文章。', 'yuki' ); ?></p>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
