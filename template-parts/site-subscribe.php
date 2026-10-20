<?php
/**
 * 侧栏订阅卡。沿用页脚 #newsletter 的占位表单行为，不接第三方服务。
 *
 * @package Yuki
 */

$yuki_subscribe_id = 'yuki-sidebar-subscribe-email';
?>
<section class="yuki-widget yuki-subscribe-card" aria-labelledby="yuki-sidebar-subscribe-title">
	<p class="yuki-kicker"><?php esc_html_e( 'ARCHIVE UPLINK', 'yuki' ); ?></p>
	<h3 id="yuki-sidebar-subscribe-title"><?php esc_html_e( '订阅更新', 'yuki' ); ?></h3>
	<p><?php esc_html_e( '每周一封邮件，分享新文章与灵感碎片。随时取消。', 'yuki' ); ?></p>
	<form onsubmit="return false;">
		<label class="screen-reader-text" for="<?php echo esc_attr( $yuki_subscribe_id ); ?>"><?php esc_html_e( '邮箱地址', 'yuki' ); ?></label>
		<input
			id="<?php echo esc_attr( $yuki_subscribe_id ); ?>"
			type="email"
			placeholder="<?php esc_attr_e( '你的邮箱地址', 'yuki' ); ?>"
			autocomplete="email"
			required
		>
		<button type="submit" class="yuki-btn"><?php esc_html_e( '订阅', 'yuki' ); ?></button>
	</form>
</section>
