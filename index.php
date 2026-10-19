<?php
/**
 * 首页 / 博客列表 — 制作资料集的话数索引
 *
 * @package Yuki
 */

get_header();

$yuki_stats = function_exists( 'yuki_production_stats' )
	? yuki_production_stats()
	: array(
		'episodes'   => 0,
		'categories' => 0,
		'updated'    => '—',
		'updated_iso' => '',
	);
?>

<section class="yuki-hero yuki-dot-pattern">
	<div class="yuki-hero-petals" aria-hidden="true">
		<span></span>
		<span></span>
		<span></span>
		<span></span>
		<span></span>
		<span></span>
		<span></span>
	</div>

	<div class="yuki-container">
		<div class="yuki-cover-meta">
			<span><?php esc_html_e( 'FILE 01 / PRODUCTION BIBLE', 'yuki' ); ?></span>
			<span><?php esc_html_e( 'UPDATED', 'yuki' ); ?> <?php echo esc_html( $yuki_stats['updated'] ); ?></span>
			<span><?php esc_html_e( 'STATUS / ACTIVE', 'yuki' ); ?></span>
		</div>

		<div class="yuki-cover-grid">
			<div class="yuki-cover-copy">
				<p class="yuki-kicker"><?php esc_html_e( 'CHARACTER & EPISODE NOTES', 'yuki' ); ?></p>
				<div class="yuki-hero-title-row">
					<h1><?php bloginfo( 'name' ); ?></h1>
				</div>
				<?php if ( get_bloginfo( 'description' ) ) : ?>
					<p class="yuki-cover-desc"><?php bloginfo( 'description' ); ?></p>
				<?php endif; ?>

				<dl class="yuki-cover-specs">
					<div>
						<dt><?php esc_html_e( 'EPISODES', 'yuki' ); ?></dt>
						<dd><?php echo esc_html( sprintf( '%02d', (int) $yuki_stats['episodes'] ) ); ?></dd>
					</div>
					<div>
						<dt><?php esc_html_e( 'CATEGORIES', 'yuki' ); ?></dt>
						<dd><?php echo esc_html( sprintf( '%02d', (int) $yuki_stats['categories'] ) ); ?></dd>
					</div>
					<div>
						<dt><?php esc_html_e( 'UPDATED', 'yuki' ); ?></dt>
						<dd><?php echo esc_html( $yuki_stats['updated'] ); ?></dd>
					</div>
				</dl>
			</div>

			<div class="yuki-character-sheet">
				<div class="yuki-sheet-head">
					<span><?php esc_html_e( 'CHARACTER SHEET', 'yuki' ); ?></span>
					<span><?php esc_html_e( 'FIG. 01', 'yuki' ); ?></span>
				</div>
				<div class="yuki-sheet-figure">
					<?php get_template_part( 'template-parts/mascot', null, array( 'size' => 'lg', 'class' => 'yuki-sheet-mascot' ) ); ?>
				</div>
				<dl class="yuki-sheet-meta">
					<div>
						<dt><?php esc_html_e( 'NAME', 'yuki' ); ?></dt>
						<dd><?php esc_html_e( '雪兔', 'yuki' ); ?></dd>
					</div>
					<div>
						<dt><?php esc_html_e( 'ROLE', 'yuki' ); ?></dt>
						<dd><?php esc_html_e( '本站看板角色', 'yuki' ); ?></dd>
					</div>
					<div>
						<dt><?php esc_html_e( 'HEIGHT', 'yuki' ); ?></dt>
						<dd>120 px</dd>
					</div>
					<div>
						<dt><?php esc_html_e( 'MEDIUM', 'yuki' ); ?></dt>
						<dd><?php esc_html_e( '雪 / 线稿', 'yuki' ); ?></dd>
					</div>
				</dl>
			</div>
		</div>
	</div>
</section>

<main class="yuki-container">
	<?php if ( have_posts() ) : ?>
		<section class="yuki-index" aria-labelledby="yuki-index-title">
			<header class="yuki-index-head">
				<div>
					<p class="yuki-kicker"><?php esc_html_e( 'EPISODE INDEX', 'yuki' ); ?></p>
					<h2 id="yuki-index-title"><?php esc_html_e( '话数索引', 'yuki' ); ?></h2>
				</div>
				<p class="yuki-index-meta">
					<?php
					/* translators: %d: 已发布文章数量 */
					echo esc_html( sprintf( __( '共 %d 话', 'yuki' ), (int) $yuki_stats['episodes'] ) );
					?>
					<br>
					<?php esc_html_e( 'NEWEST FIRST', 'yuki' ); ?>
				</p>
			</header>

			<div class="yuki-post-list">
				<?php
				while ( have_posts() ) :
					the_post();
					get_template_part( 'template-parts/post-item' );
				endwhile;
				?>
			</div>

			<nav class="yuki-pagination">
				<?php echo paginate_links( array(
					'prev_text' => '&larr;',
					'next_text' => '&rarr;',
				) ); ?>
			</nav>
		</section>
	<?php else : ?>
		<div class="yuki-narrow yuki-empty-state">
			<?php get_template_part( 'template-parts/mascot', null, array( 'size' => 'sm' ) ); ?>
			<p><?php esc_html_e( '雪兔把院子扫干净了——还没有文章，去后台发布第一篇吧。', 'yuki' ); ?></p>
		</div>
	<?php endif; ?>
</main>

<?php
get_footer();
