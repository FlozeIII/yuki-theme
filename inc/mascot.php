<?php
/**
 * 自定义吉祥物。
 *
 * 默认是一张白底证件照卡；站长可以在自定义器里换图、改名、隐藏。
 * 设置只影响装饰性的角色卡，不影响作者头像或文章内容。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 默认值集中放在这里，模板与自定义器共用。
 *
 * @return array
 */
function yuki_mascot_defaults() {
	return array(
		'enabled' => true,
		'image'   => '',
		'name'    => __( '雪兔', 'yuki' ),
		'role'    => __( '本站看板角色', 'yuki' ),
	);
}

/**
 * 是否显示吉祥物。
 *
 * @return bool
 */
function yuki_mascot_is_enabled() {
	return (bool) get_theme_mod( 'yuki_mascot_enabled', true );
}

/**
 * 当前吉祥物图片；空值回退主题自带的雪兔。
 *
 * @return string
 */
function yuki_mascot_image_url() {
	$image = trim( (string) get_theme_mod( 'yuki_mascot_image', '' ) );

	if ( '' !== $image ) {
		return esc_url_raw( $image );
	}

	return get_theme_file_uri( 'assets/images/mascot-yuki.png' );
}

/**
 * 自定义图片是否已设置。
 *
 * @return bool
 */
function yuki_mascot_has_custom_image() {
	return '' !== trim( (string) get_theme_mod( 'yuki_mascot_image', '' ) );
}

/**
 * 角色卡名称；空值回退默认。
 *
 * @return string
 */
function yuki_mascot_name() {
	$name = trim( (string) get_theme_mod( 'yuki_mascot_name', __( '雪兔', 'yuki' ) ) );

	return '' !== $name ? $name : __( '雪兔', 'yuki' );
}

/**
 * 角色卡身份；空值回退默认。
 *
 * @return string
 */
function yuki_mascot_role() {
	$role = trim( (string) get_theme_mod( 'yuki_mascot_role', __( '本站看板角色', 'yuki' ) ) );

	return '' !== $role ? $role : __( '本站看板角色', 'yuki' );
}

/**
 * 来源：自定义图片时说「自定义」，默认图仍说「雪 / 线稿」。
 *
 * @return string
 */
function yuki_mascot_origin() {
	return yuki_mascot_has_custom_image()
		? __( '自定义', 'yuki' )
		: __( '雪 / 线稿', 'yuki' );
}

/**
 * 自定义器：Yuki 吉祥物。
 *
 * @param WP_Customize_Manager $wp_customize 自定义器实例。
 * @return void
 */
function yuki_mascot_customize_register( $wp_customize ) {
	$defaults = yuki_mascot_defaults();

	$wp_customize->add_section( 'yuki_mascot', array(
		'title'       => __( 'Yuki 吉祥物', 'yuki' ),
		'description' => __( '角色卡上的看板角色；留空即使用默认雪兔。', 'yuki' ),
		'priority'    => 153,
	) );

	$wp_customize->add_setting( 'yuki_mascot_enabled', array(
		'default'           => $defaults['enabled'],
		'sanitize_callback' => 'yuki_mascot_sanitize_checkbox',
	) );

	$wp_customize->add_control( 'yuki_mascot_enabled', array(
		'label'       => __( '显示吉祥物', 'yuki' ),
		'description' => __( '关闭后首页角色卡、404 与空状态的吉祥物一起隐藏。', 'yuki' ),
		'section'     => 'yuki_mascot',
		'type'        => 'checkbox',
	) );

	$wp_customize->add_setting( 'yuki_mascot_image', array(
		'default'           => $defaults['image'],
		'sanitize_callback' => 'esc_url_raw',
	) );

	$wp_customize->add_control( new WP_Customize_Image_Control( $wp_customize, 'yuki_mascot_image', array(
		'label'       => __( '吉祥物图片', 'yuki' ),
		'description' => __( '建议上传 512×512 的方形图；留空使用默认雪兔。', 'yuki' ),
		'section'     => 'yuki_mascot',
		'mime_type'   => 'image',
	) ) );

	$wp_customize->add_setting( 'yuki_mascot_name', array(
		'default'           => $defaults['name'],
		'sanitize_callback' => 'sanitize_text_field',
	) );

	$wp_customize->add_control( 'yuki_mascot_name', array(
		'label'       => __( '吉祥物名称', 'yuki' ),
		'description' => __( '显示在角色卡 DESIGNATION 一栏。', 'yuki' ),
		'section'     => 'yuki_mascot',
		'type'        => 'text',
	) );

	$wp_customize->add_setting( 'yuki_mascot_role', array(
		'default'           => $defaults['role'],
		'sanitize_callback' => 'sanitize_text_field',
	) );

	$wp_customize->add_control( 'yuki_mascot_role', array(
		'label'       => __( '吉祥物身份', 'yuki' ),
		'description' => __( '显示在角色卡 CLASS 一栏。', 'yuki' ),
		'section'     => 'yuki_mascot',
		'type'        => 'text',
	) );
}
add_action( 'customize_register', 'yuki_mascot_customize_register' );

/**
 * 复选框只认布尔值。
 *
 * @param mixed $checked 自定义器传上来的值。
 * @return bool
 */
function yuki_mascot_sanitize_checkbox( $checked ) {
	return (bool) $checked;
}
