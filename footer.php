<?php
/**
 * Footer template
 *
 * @package Yuki
 */

$icp    = get_theme_mod( 'yuki_icp_number', '' );
$gongan = get_theme_mod( 'yuki_gongan_number', '' );
?>

<section id="newsletter" class="yuki-newsletter">
	<div class="yuki-narrow">
		<div class="yuki-newsletter-copy">
			<p class="yuki-kicker"><?php esc_html_e( 'ARCHIVE UPLINK', 'yuki' ); ?></p>
			<h2><?php esc_html_e( '订阅更新', 'yuki' ); ?></h2>
			<p><?php esc_html_e( '每周一封邮件，分享新文章与灵感碎片。随时取消。', 'yuki' ); ?></p>
		</div>
		<!-- 可替换为任意订阅服务（Mailchimp / Follow.it 等）的嵌入表单 -->
		<form onsubmit="return false;">
			<input type="email" placeholder="<?php esc_attr_e( '你的邮箱地址', 'yuki' ); ?>" aria-label="<?php esc_attr_e( '邮箱地址', 'yuki' ); ?>" required>
			<button type="submit" class="yuki-btn"><?php esc_html_e( '订阅', 'yuki' ); ?></button>
		</form>
	</div>
</section>

<footer class="yuki-footer">
	<div class="yuki-container">
		<?php get_template_part( 'template-parts/site-footer-links' ); ?>
		<div class="yuki-footer-top">
			<div>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?></div>
		</div>

		<div class="yuki-icp">
			<?php if ( $icp ) : ?>
				<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $icp ); ?></a>
			<?php else : ?>
				<!-- 备案号占位：在「外观 → 自定义 → Yuki 页脚设置」中填写 ICP 备案号 -->
				<span>ICP 备案号占位</span>
			<?php endif; ?>
			<?php if ( $gongan ) : ?>
				&nbsp;/&nbsp;
				<a href="https://beian.mps.gov.cn/" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $gongan ); ?></a>
			<?php endif; ?>
		</div>
	</div>
</footer>

<!-- 搜索浮层：放 </footer> 之后，避免受 header 层叠上下文影响 -->
<div class="yuki-search-overlay" id="yuki-search-overlay">
	<div class="yuki-search-backdrop" data-search-close></div>
	<div class="yuki-search-dialog" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e( '搜索', 'yuki' ); ?>">
		<button type="button" class="yuki-search-close" data-search-close aria-label="<?php esc_attr_e( '关闭', 'yuki' ); ?>">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
		</button>
		<?php get_search_form(); ?>
	</div>
</div>

<?php wp_footer(); ?>
</body>
</html>
