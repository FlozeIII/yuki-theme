<?php
/**
 * 评论列表与表单
 *
 * @package Yuki
 */

if ( post_password_required() ) {
	return;
}
?>

<section class="yuki-comments">
	<?php if ( have_comments() ) : ?>
		<h3><?php
			$count = get_comments_number();
			/* translators: %s: comment count */
			printf( esc_html__( '评论（%s）', 'yuki' ), esc_html( number_format_i18n( $count ) ) );
		?></h3>

		<ul class="yuki-comment-list">
			<?php
			wp_list_comments( array(
				'style'       => 'ul',
				'avatar_size' => 40,
			) );
			?>
		</ul>

		<?php the_comments_navigation(); ?>
	<?php endif; ?>

	<?php
	comment_form( array(
		'title_reply'   => __( '发表评论', 'yuki' ),
		'label_submit'  => __( '提交评论', 'yuki' ),
		'comment_field' => '<p class="comment-form-comment"><textarea id="comment" name="comment" rows="5" placeholder="' . esc_attr__( '写下你的想法…', 'yuki' ) . '"></textarea></p>',
	) );
	?>
</section>
