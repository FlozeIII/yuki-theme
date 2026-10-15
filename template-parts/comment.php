<?php
/**
 * 单条评论。wp_list_comments() 的 callback，由 yuki_comment_template() 载入。
 *
 * 这份印记是对着核心 Walker_Comment::html5_comment() 写的，几处不能改：
 *
 * - `id="comment-{ID}"` 与 `id="div-comment-{ID}"`：comment-reply.js 靠它们定位
 *   「回复按钮把表单插到哪儿」，插件与锚点链接也认这两个 id。
 * - `comment_class()`：层级类 depth-N、奇数偶数类、parent 都在里面，样式与脚本都靠它。
 * - 末尾不关 `</li>`：那是 Walker 的 end_el 干的，自己关了会多出一个。
 * - 待审评论对非作者要过滤掉正文里的 HTML（核心在 start_el 里挂的 filter_comment_text，
 *   走 callback 这条路时不会挂上），下面的临时过滤器就是补这一条。
 *
 * 有意与核心不同的两处：作者名后面不跟 `&lt;span class="says"&gt;says:&lt;/span&gt;`（中文站里挂个英文
 * says: 更难看，主题别处也没有这种衬词），以及印记里多了一枚「回复 @谁」。
 *
 * @package Yuki
 *
 * @var array $args {
 *     @type WP_Comment $comment   当前评论。
 *     @type array      $list_args wp_list_comments() 的参数。
 *     @type int        $depth     当前层级（顶层是 1）。
 * }
 */

$yuki_comment   = $args['comment'];
$yuki_list_args = $args['list_args'];
$yuki_depth     = (int) $args['depth'];

$yuki_commenter = wp_get_current_commenter();
// 作者本人（带着评论 cookie）看自己的待审评论时，允许它显示成提交时的样子
$yuki_own_view = ! empty( $yuki_commenter['comment_author'] );

if ( $yuki_commenter['comment_author_email'] ) {
	$yuki_pending_note = __( '这条评论正在等待审核。', 'yuki' );
} else {
	$yuki_pending_note = __( '这条评论正在等待审核。这是预览，审核通过后才会公开显示。', 'yuki' );
}

$yuki_reply_to = yuki_comment_reply_to( $yuki_comment );
$yuki_is_pending = ( '0' === $yuki_comment->comment_approved );
?>
<li id="comment-<?php comment_ID(); ?>" <?php comment_class( empty( $yuki_list_args['has_children'] ) ? '' : 'parent', $yuki_comment ); ?>>
	<article id="div-comment-<?php comment_ID(); ?>" class="comment-body">
		<?php if ( $yuki_list_args['short_ping'] && 'comment' !== $yuki_comment->comment_type ) : ?>
			<?php // 短 ping：核心在这条设置下只印一行，这里照办，免得同一个设置出现两套印记 ?>
			<?php
			esc_html_e( 'Pingback：', 'yuki' );
			echo ' ';
			comment_author_link( $yuki_comment );
			edit_comment_link( __( '编辑', 'yuki' ), '<span class="edit-link">', '</span>' );
			?>
		<?php else : ?>
			<footer class="comment-meta">
				<div class="comment-author vcard">
					<?php
					if ( 0 !== (int) $yuki_list_args['avatar_size'] ) {
						echo get_avatar( $yuki_comment, $yuki_list_args['avatar_size'] );
					}

					// 待审评论对外不对非作者暴露作者网址
					$yuki_author = ( $yuki_is_pending && ! $yuki_own_view )
						? get_comment_author( $yuki_comment )
						: get_comment_author_link( $yuki_comment );
					?>
					<b class="fn"><?php echo $yuki_author; // phpcs:ignore WordPress.Security.EscapeOutput -- 上面两个函数各自转义过 ?></b>
				</div><!-- .comment-author -->

				<div class="comment-metadata">
					<a href="<?php echo esc_url( get_comment_link( $yuki_comment, $yuki_list_args ) ); ?>"><time datetime="<?php echo esc_attr( get_comment_time( 'c' ) ); ?>"><?php
						printf(
							/* translators: 1: Comment date, 2: Comment time. */
							esc_html__( '%1$s %2$s', 'yuki' ),
							esc_html( get_comment_date( '', $yuki_comment ) ),
							esc_html( get_comment_time() )
						);
					?></time></a>

					<?php if ( '' !== $yuki_reply_to ) : ?>
						<?php // 层级压平之后，缩进说明不了「这条在回谁」，靠这一句 ?><?php
						printf(
							/* translators: %s: 被回复的评论作者名 */
							'<span class="yuki-comment-reply-to">' . esc_html__( '回复 @%s', 'yuki' ) . '</span>',
							esc_html( $yuki_reply_to )
						);
						?>
					<?php endif; ?>

					<?php edit_comment_link( __( '编辑', 'yuki' ), ' <span class="edit-link">', '</span>' ); ?>
				</div><!-- .comment-metadata -->

				<?php if ( $yuki_is_pending ) : ?>
					<em class="comment-awaiting-moderation"><?php echo esc_html( $yuki_pending_note ); ?></em>
				<?php endif; ?>
			</footer><!-- .comment-meta -->

			<div class="comment-content">
				<?php
				if ( $yuki_is_pending && ! $yuki_own_view ) {
					// 待审评论的正文对非作者只留文字。挂在 comment_text 上、与核心同一优先级（40），
					// 是为了让插件的过滤器按核心的时序跑：核心在 start_el 里挂的就是这一处，
					// 走 callback 时不会挂上，只能自己补。
					$yuki_strip_tags = static function ( $text ) {
						return wp_kses( $text, array() );
					};
					add_filter( 'comment_text', $yuki_strip_tags, 40 );
					comment_text( $yuki_comment );
					remove_filter( 'comment_text', $yuki_strip_tags, 40 );
				} else {
					comment_text( $yuki_comment );
				}
				?>
			</div><!-- .comment-content -->

			<?php
			$yuki_can_reply = ( ! $yuki_is_pending || $yuki_own_view );
			// 待审评论不给点赞入口：它还没公开，给它攒赞没有意义，端点那边也不收
			$yuki_can_like  = ! $yuki_is_pending;
			?>
			<?php if ( $yuki_can_like || $yuki_can_reply ) : ?>
				<div class="yuki-comment-actions">
					<?php if ( $yuki_can_like ) : ?>
						<?php get_template_part( 'template-parts/comment-like', null, array( 'comment' => $yuki_comment ) ); ?>
					<?php endif; ?>

					<?php
					if ( $yuki_can_reply ) {
						comment_reply_link( array_merge(
							$yuki_list_args,
							array(
								'add_below' => 'div-comment',
								'depth'     => $yuki_depth,
								'max_depth' => $yuki_list_args['max_depth'],
								'before'    => '<div class="reply">',
								'after'     => '</div>',
							)
						) );
					}
					?>
				</div><!-- .yuki-comment-actions -->
			<?php endif; ?>
		<?php endif; ?>
	</article><!-- .comment-body -->
