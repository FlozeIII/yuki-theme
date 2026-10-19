<?php
/**
 * 404 — 未找到
 *
 * @package Yuki
 */

get_header();
?>

<main class="yuki-container">
	<div class="yuki-404">
		<p class="yuki-kicker"><?php esc_html_e( 'MISSING FRAME', 'yuki' ); ?></p>
		<p class="code">404</p>
		<h1><?php esc_html_e( '这个页面走失了', 'yuki' ); ?></h1>
		<p><?php esc_html_e( '雪兔在雪地里找了半天，也没找到这一页。链接可能已经失效，或者内容被移到了别处。试试搜索：', 'yuki' ); ?></p>
		<?php get_template_part( 'template-parts/mascot', null, array( 'size' => 'lg' ) ); ?>
		<?php get_search_form(); ?>
		<a class="yuki-btn" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( '回到首页', 'yuki' ); ?></a>
	</div>
</main>

<?php
get_footer();
