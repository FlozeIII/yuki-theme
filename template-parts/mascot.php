<?php
/**
 * 看板角色：默认雪兔，可在自定义器换成自己的角色图。
 *
 * 现在是一张白底证件照卡：图片负责角色，底部季节色条负责跟随季节。
 * 整张卡是装饰性的，语义由旁边的文字承担，所以对读屏软件隐藏。
 * 参数：
 *
 *   size  'sm'（空状态，64px）或 'lg'（hero / 404，112px）
 *   class 额外的类名（单个）
 *
 * @package Yuki
 */

$yuki_enabled = function_exists( 'yuki_mascot_is_enabled' ) ? yuki_mascot_is_enabled() : true;

if ( ! $yuki_enabled ) {
	return;
}

$yuki_size  = isset( $args['size'] ) && in_array( $args['size'], array( 'sm', 'lg' ), true )
	? $args['size']
	: 'sm';
$yuki_extra = isset( $args['class'] ) ? sanitize_html_class( $args['class'] ) : '';
$yuki_class = 'yuki-mascot yuki-mascot--photo yuki-mascot--' . $yuki_size . ( $yuki_extra ? ' ' . $yuki_extra : '' );
$yuki_image = function_exists( 'yuki_mascot_image_url' )
	? yuki_mascot_image_url()
	: get_theme_file_uri( 'assets/images/mascot-yuki.png' );
?>
<span class="<?php echo esc_attr( $yuki_class ); ?>" aria-hidden="true">
	<img class="yuki-mascot-photo" alt=""
		src="<?php echo esc_url( $yuki_image ); ?>"
		width="512" height="512" decoding="async" draggable="false">
	<svg class="yuki-mascot-season"
		xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 4" preserveAspectRatio="none"
		aria-hidden="true" focusable="false">
		<rect width="12" height="4" fill="var(--yuki-season)"/>
	</svg>
</span>
