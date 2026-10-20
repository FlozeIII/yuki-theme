<?php
/**
 * 作者卡：本地头像优先，外部头像地址不回源，改用主题内字母方块。
 *
 * @package Yuki
 */

$yuki_author_id = (int) get_the_author_meta( 'ID' );

if ( ! $yuki_author_id ) {
	return;
}

$yuki_author_name = get_the_author_meta( 'display_name', $yuki_author_id );
$yuki_author_desc = get_the_author_meta( 'description', $yuki_author_id );
$yuki_author_role = $yuki_author_desc ? __( '作者', 'yuki' ) : __( '独立创作者', 'yuki' );

$yuki_avatar_url  = get_avatar_url( $yuki_author_id, array( 'size' => 96 ) );
$yuki_home_host   = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
$yuki_avatar_host = $yuki_avatar_url ? wp_parse_url( $yuki_avatar_url, PHP_URL_HOST ) : '';
$yuki_use_avatar  = $yuki_avatar_url && ( ! $yuki_avatar_host || $yuki_avatar_host === $yuki_home_host );
$yuki_initial     = function_exists( 'mb_substr' ) ? mb_substr( $yuki_author_name, 0, 1 ) : substr( $yuki_author_name, 0, 1 );
?>
<div class="yuki-author-card">
	<?php if ( $yuki_use_avatar ) : ?>
		<img
			class="yuki-author-avatar"
			src="<?php echo esc_url( $yuki_avatar_url ); ?>"
			alt=""
			width="56"
			height="56"
			loading="lazy"
			decoding="async"
		>
	<?php else : ?>
		<span class="yuki-author-mark" aria-hidden="true"><?php echo esc_html( $yuki_initial ); ?></span>
	<?php endif; ?>

	<div class="yuki-author-card-copy">
		<div class="name"><?php echo esc_html( $yuki_author_name ); ?></div>
		<div class="role"><?php echo esc_html( $yuki_author_role ); ?></div>
	</div>
</div>

<?php if ( $yuki_author_desc ) : ?>
	<p class="yuki-author-bio"><?php echo esc_html( wp_trim_words( $yuki_author_desc, 40, '…' ) ); ?></p>
<?php endif; ?>
