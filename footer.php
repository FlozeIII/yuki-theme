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
		<h2 style="margin:0 0 8px;font-size:26px;font-weight:700;"><?php esc_html_e( '订阅更新', 'yuki' ); ?></h2>
		<p style="margin:0;color:var(--yuki-muted-foreground);"><?php esc_html_e( '每周一封邮件，分享新文章与灵感碎片。随时取消。', 'yuki' ); ?></p>
		<!-- 可替换为任意订阅服务（Mailchimp / Follow.it 等）的嵌入表单 -->
		<form onsubmit="return false;">
			<input type="email" placeholder="<?php esc_attr_e( '你的邮箱地址', 'yuki' ); ?>">
			<button type="submit" class="yuki-btn"><?php esc_html_e( '订阅', 'yuki' ); ?></button>
		</form>
	</div>
</section>

<footer class="yuki-footer">
	<div class="yuki-container">
		<div class="yuki-footer-top">
			<div>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?></div>
			<div class="links">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( '首页', 'yuki' ); ?></a>
				<a href="#newsletter"><?php esc_html_e( '订阅', 'yuki' ); ?></a>
			</div>
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

<?php wp_footer(); ?>
</body>
</html>
