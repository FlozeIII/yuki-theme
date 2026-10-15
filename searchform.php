<?php
/**
 * 搜索表单 — 由 get_search_form() 调用
 *
 * @package Yuki
 */
?>
<form role="search" method="get" class="yuki-search-form" action="<?php echo esc_url( home_url( '/' ) ); ?>">
	<label>
		<span class="screen-reader-text"><?php esc_html_e( '搜索：', 'yuki' ); ?></span>
		<input type="search" class="yuki-search-field" name="s" value="<?php echo esc_attr( get_search_query() ); ?>" placeholder="<?php echo esc_attr_x( '搜索文章…', 'placeholder', 'yuki' ); ?>">
	</label>
	<button type="submit" class="yuki-btn"><?php esc_html_e( '搜索', 'yuki' ); ?></button>
</form>
