<?php
/**
 * 页脚链接组：有菜单时按菜单输出，没有菜单时给三列兜底。
 *
 * @package Yuki
 */

$yuki_has_footer_menu = has_nav_menu( 'footer' );
$yuki_category_list   = $yuki_has_footer_menu ? '' : wp_list_categories( array(
	'title_li' => '',
	'number'   => 4,
	'orderby'  => 'count',
	'order'    => 'DESC',
	'echo'     => false,
) );
$yuki_group_count     = $yuki_has_footer_menu ? 1 : ( $yuki_category_list ? 3 : 2 );
?>
<nav class="yuki-footer-links yuki-footer-links--<?php echo esc_attr( (string) $yuki_group_count ); ?>" aria-label="<?php esc_attr_e( '页脚链接', 'yuki' ); ?>">
	<?php if ( $yuki_has_footer_menu ) : ?>
		<div class="yuki-footer-group yuki-footer-group--menu">
			<p class="yuki-footer-label"><?php esc_html_e( 'MENU', 'yuki' ); ?></p>
			<?php
			wp_nav_menu( array(
				'theme_location' => 'footer',
				'container'      => false,
				'menu_class'     => 'yuki-footer-menu',
				'fallback_cb'    => false,
				'depth'          => 1,
			) );
			?>
		</div>
	<?php else : ?>
		<div class="yuki-footer-group">
			<p class="yuki-footer-label"><?php esc_html_e( '站点', 'yuki' ); ?></p>
			<ul>
				<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( '首页', 'yuki' ); ?></a></li>
				<li><a href="<?php echo esc_url( home_url( '/?s=' ) ); ?>"><?php esc_html_e( '搜索', 'yuki' ); ?></a></li>
				<li><a href="#newsletter"><?php esc_html_e( '订阅', 'yuki' ); ?></a></li>
			</ul>
		</div>

		<?php if ( $yuki_category_list ) : ?>
			<div class="yuki-footer-group">
				<p class="yuki-footer-label"><?php esc_html_e( '索引', 'yuki' ); ?></p>
				<ul>
					<?php echo $yuki_category_list; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core list markup. ?>
				</ul>
			</div>
		<?php endif; ?>

		<div class="yuki-footer-group">
			<p class="yuki-footer-label"><?php esc_html_e( '关于', 'yuki' ); ?></p>
			<ul>
				<li><a href="<?php echo esc_url( get_feed_link() ); ?>"><?php esc_html_e( 'RSS', 'yuki' ); ?></a></li>
				<li><a href="<?php echo esc_url( wp_login_url() ); ?>"><?php esc_html_e( '登录', 'yuki' ); ?></a></li>
			</ul>
		</div>
	<?php endif; ?>
</nav>
