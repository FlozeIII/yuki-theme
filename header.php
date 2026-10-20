<?php
/**
 * Header template
 *
 * @package Yuki
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<?php if ( get_header_image() ) : ?>
	<div class="yuki-header-image">
		<?php the_header_image_tag( array( 'class' => 'yuki-header-image-tag' ) ); ?>
	</div>
<?php endif; ?>

<div class="yuki-production-strip" aria-hidden="true">
	<span><?php esc_html_e( 'YUKI ARCHIVE // SITE-01', 'yuki' ); ?></span>
	<span><?php esc_html_e( 'PERSONAL RECORDS / CLEARANCE 02', 'yuki' ); ?></span>
	<span><?php esc_html_e( 'BUILD', 'yuki' ); ?> <?php echo esc_html( wp_get_theme()->get( 'Version' ) ); ?> / <?php echo esc_html( wp_date( 'Y.m.d' ) ); ?></span>
</div>

<header class="yuki-nav">
	<div class="brand">
		<span class="yuki-brand-mark" aria-hidden="true">Y</span>
		<?php if ( has_custom_logo() ) : ?>
			<?php the_custom_logo(); ?>
		<?php else : ?>
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
		<?php endif; ?>
	</div>

	<nav class="menu" aria-label="<?php esc_attr_e( '主导航', 'yuki' ); ?>">
		<?php
		if ( has_nav_menu( 'primary' ) ) {
			wp_nav_menu( array(
				'theme_location' => 'primary',
				'container'      => false,
				'items_wrap'     => '%3$s',
				'depth'          => 1,
			) );
		} else {
			echo '<a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( '首页', 'yuki' ) . '</a>';
			echo '<a href="#newsletter">' . esc_html__( '订阅', 'yuki' ) . '</a>';
		}
		?>
	</nav>

	<div class="yuki-nav-actions">
		<button type="button" id="search-toggle" class="yuki-search-btn" aria-label="<?php esc_attr_e( '搜索', 'yuki' ); ?>" aria-expanded="false" aria-controls="yuki-search-overlay">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
		</button>

		<button type="button" id="theme-toggle" class="theme-switch" aria-label="<?php esc_attr_e( '切换主题', 'yuki' ); ?>">
			<span class="theme-switch-hint theme-switch-hint-left" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
			</span>
			<span class="theme-switch-hint theme-switch-hint-right" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
			</span>
			<span class="theme-switch-knob" aria-hidden="true">
				<span class="theme-switch-knob-sun">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
				</span>
				<span class="theme-switch-knob-moon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
				</span>
			</span>
		</button>
	</div>
</header>
