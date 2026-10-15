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
	 * 数的是**页面上已经查出来的**那些评论里、还在等审核的几条，而不是另查一次库：
	 * 这样提示与列表永远说的是同一件事，不会出现「提示说有一条、列表里却没有」。
	 *
	 * 「哪些待审评论能被这位访客看见」由核心决定——comments_template() 会把
	 * wp_get_unapproved_comment_author_email() 的结果塞进 include_unapproved，
	 * 而那个函数在没有跳转参数时会退回读评论者 cookie（wp-includes/comment.php:2108）。
	 * 所以「带同一身份再次访问还看得见自己那条」是核心本来就有的行为，主题不必自己造。
	 *
	 * 措辞上只说「在等审核」，不承诺已经公开：提交时它确实还没公开。
	 */
	$yuki_pending_mine  = 0;
	$yuki_viewer_email  = is_user_logged_in() ? '' : strtolower( (string) wp_get_unapproved_comment_author_email() );

	if ( '' !== $yuki_viewer_email && ! empty( $wp_query->comments ) ) {
		foreach ( $wp_query->comments as $yuki_seen ) {
			if ( '0' === (string) $yuki_seen->comment_approved
				&& strtolower( (string) $yuki_seen->comment_author_email ) === $yuki_viewer_email ) {
				$yuki_pending_mine++;
			}
		}
	}
	?>

	<?php if ( $yuki_pending_mine > 0 ) : ?>
		<p class="yuki-pending-notice">
			<?php
			printf(
				/* translators: %s: 等待审核的评论条数（已按本地习惯分组，例如 1,234） */
				esc_html( __( '你有 %s 条评论正在等待审核，通过之后才会公开显示。', 'yuki' ) ),
				esc_html( number_format_i18n( $yuki_pending_mine ) )
			);
			?>
		</p>
	<?php endif; ?>

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
				// 自己渲染每条评论：层级压平之后还要标出「回复 @谁」，核心的印记里没有这个位置
				'callback'    => 'yuki_comment_template',
			) );
			?>
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
