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
	<?php
	/*
	 * 待审提示。
	 *
	 * 数的是这位访客自己还没通过的那几条：判断在 yuki_comment_pending_count() 里，
	 * 那句话本身在 yuki_comment_pending_notice_html() 里。两者由列表与端点共用——
	 * 端点提交完要在页面上把这句话就地换掉，两边各写一份的话，措辞迟早会不一样，
	 * 而两边看起来都对。
	 *
	 * 措辞上只说「在等审核」，不承诺已经公开：提交时它确实还没公开。
	 */
	$yuki_pending_notice = yuki_comment_pending_notice_html(
		yuki_comment_pending_count( get_the_ID(), yuki_comment_viewer_email() )
	);

	echo $yuki_pending_notice; // phpcs:ignore WordPress.Security.EscapeOutput -- 上面那个函数返回的就是转义好的 HTML
	?>

	<?php if ( have_comments() ) : ?>
		<?php
		$yuki_count_heading = yuki_comment_count_heading_html( get_the_ID() );

		echo $yuki_count_heading; // phpcs:ignore WordPress.Security.EscapeOutput -- 上面那个函数返回的就是转义好的 HTML
		?>

		<ul class="yuki-comment-list">
			<?php wp_list_comments( yuki_comment_list_args() ); ?>
		</ul>

		<?php the_comments_navigation(); ?>
	<?php endif; ?>

	<?php
	comment_form( array(
		'title_reply'   => __( '发表评论', 'yuki' ),
		'label_submit'  => __( '提交评论', 'yuki' ),
		// 表单的类要与 style.css 里那几条输入框规则对上，否则它们一直是空转
		'class_form'    => 'yuki-comment-form',
		'comment_field' => '<p class="comment-form-comment"><textarea id="comment" name="comment" rows="5" placeholder="' . esc_attr__( '写下你的想法…', 'yuki' ) . '"></textarea></p>',
	) );
	?>
</section>
