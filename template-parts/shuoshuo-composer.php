<?php
/**
 * 说说归档顶部的写作框：只有能直接发布的人才看得到。
 *
 * @package Yuki
 */

if ( ! current_user_can( 'publish_posts' ) ) {
	return;
}

$yuki_error = isset( $_GET['yuki_shuoshuo_error'] )
	? sanitize_key( wp_unslash( $_GET['yuki_shuoshuo_error'] ) )
	: '';

$yuki_messages = array(
	'empty'       => __( '说点什么再发布。', 'yuki' ),
	'nonce'       => __( '页面过期了，刷新后再试。', 'yuki' ),
	'failed'      => __( '发布失败，请再试一次。', 'yuki' ),
	'no_category' => __( '说说分类还没有配置。', 'yuki' ),
	'capability'  => __( '你没有发布说说的权限。', 'yuki' ),
);

$yuki_message = isset( $yuki_messages[ $yuki_error ] ) ? $yuki_messages[ $yuki_error ] : '';
$yuki_posted  = isset( $_GET['yuki_shuoshuo_posted'] )
	&& '1' === sanitize_text_field( wp_unslash( $_GET['yuki_shuoshuo_posted'] ) );
$yuki_draft   = function_exists( 'yuki_shuoshuo_composer_take_draft' )
	? yuki_shuoshuo_composer_take_draft()
	: '';
?>
<section class="yuki-shuoshuo-composer" aria-label="<?php esc_attr_e( '发一条说说', 'yuki' ); ?>">
	<?php if ( $yuki_posted ) : ?>
		<p class="yuki-shuoshuo-composer-message" role="status"><?php esc_html_e( '说说已发布。', 'yuki' ); ?></p>
	<?php endif; ?>

	<?php if ( $yuki_message ) : ?>
		<p class="yuki-shuoshuo-composer-message is-error" role="alert"><?php echo esc_html( $yuki_message ); ?></p>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="yuki_shuoshuo_publish">
		<?php wp_nonce_field( 'yuki_shuoshuo_publish', 'yuki_shuoshuo_nonce' ); ?>

		<label class="screen-reader-text" for="yuki-shuoshuo-content"><?php esc_html_e( '说点什么…', 'yuki' ); ?></label>
		<textarea id="yuki-shuoshuo-content" name="content" rows="3" required placeholder="<?php esc_attr_e( '说点什么…', 'yuki' ); ?>"><?php echo esc_textarea( $yuki_draft ); ?></textarea>

		<div class="yuki-shuoshuo-composer-actions">
			<button type="submit" class="yuki-btn"><?php esc_html_e( '发布说说', 'yuki' ); ?></button>
		</div>
	</form>
</section>
