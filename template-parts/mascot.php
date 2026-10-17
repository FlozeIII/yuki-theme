<?php
/**
 * 雪兔：主题的二次元点缀。
 *
 * 装饰性 SVG，语义由旁边的文字承担，所以对读屏软件隐藏。参数：
 *
 *   size  'sm'（空状态，64px）或 'lg'（hero / 404，112px）
 *   class 额外的类名（单个）
 *
 * @package Yuki
 */

$yuki_size  = isset( $args['size'] ) && in_array( $args['size'], array( 'sm', 'lg' ), true )
	? $args['size']
	: 'sm';
$yuki_class = isset( $args['class'] ) ? ' ' . sanitize_html_class( $args['class'] ) : '';
?>
<svg class="yuki-mascot yuki-mascot--<?php echo esc_attr( $yuki_size ); ?><?php echo esc_attr( $yuki_class ); ?>"
	xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"
	aria-hidden="true" focusable="false">
	<!-- 影子 -->
	<ellipse cx="60" cy="112" rx="30" ry="3" fill="#2D2D35" opacity=".08"/>

	<!-- 身体 -->
	<ellipse cx="60" cy="94" rx="29" ry="20" fill="#FFFFFF" stroke="var(--yuki-border)" stroke-width="2"/>
	<!-- 尾巴 -->
	<circle cx="88" cy="104" r="5" fill="#FFFFFF" stroke="var(--yuki-border)" stroke-width="2"/>

	<!-- 耳朵 -->
	<g stroke="var(--yuki-border)" stroke-width="2">
		<ellipse cx="47" cy="28" rx="8" ry="20" transform="rotate(-10 47 28)" fill="#FFFFFF"/>
		<ellipse cx="73" cy="28" rx="8" ry="20" transform="rotate(10 73 28)" fill="#FFFFFF"/>
	</g>
	<ellipse cx="47" cy="28" rx="3.4" ry="12" transform="rotate(-10 47 28)" fill="var(--yuki-season)" opacity=".32"/>
	<ellipse cx="73" cy="28" rx="3.4" ry="12" transform="rotate(10 73 28)" fill="var(--yuki-season)" opacity=".32"/>

	<!-- 头 -->
	<circle cx="60" cy="60" r="25" fill="#FFFFFF" stroke="var(--yuki-border)" stroke-width="2"/>

	<!-- 围巾 -->
	<path d="M38 76 Q60 85 82 76 L80 84 Q60 93 40 84 Z" fill="var(--yuki-season)"/>
	<path d="M78 82 L88 100 Q84 104 80 102 L72 86 Z" fill="var(--yuki-season)"/>

	<!-- 脸 -->
	<circle cx="51" cy="58" r="3.2" fill="#2D2D35"/>
	<circle cx="69" cy="58" r="3.2" fill="#2D2D35"/>
	<circle cx="43" cy="65" r="4" fill="var(--yuki-season)" opacity=".22"/>
	<circle cx="77" cy="65" r="4" fill="var(--yuki-season)" opacity=".22"/>
	<path d="M57 65 Q60 63 63 65 Q60 69 57 65 Z" fill="#2D2D35"/>
	<path d="M56 70 Q60 74 64 70" fill="none" stroke="#2D2D35" stroke-width="2" stroke-linecap="round"/>

	<!-- 围巾上的雪花 -->
	<g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round">
		<path d="M60 79v5"/>
		<path d="M57.5 80.5l5 2.5"/>
		<path d="M62.5 80.5l-5 2.5"/>
	</g>
</svg>
