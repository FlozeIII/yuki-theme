<?php
/**
 * 说说归档的列表项 — 紧凑版式，不复用文章列表那套（大缩略图 + 摘要）
 *
 * 说说是短内容：一两句话。套用文章列表的版式（左 112×84 缩略图 + 摘要）会让每条都空一大半，
 * 所以这里改成「正文直接铺开 + 一行弱化的元信息」——内容多短，条目就多矮。
 * 缩略图一律不取：说说的重点在文字，不是配图。
 *
 * 正文按**全文**输出，不截摘要：说说的正文本来就短，摘一句反而会把它掏空；
 * 真写了很长的内容，这里就照原样铺开（那是发文的人自己的选择）。
 *
 * @package Yuki
 */

?>
<article class="yuki-shuoshuo-item" id="post-<?php the_ID(); ?>">
	<?php
	// 标题常常是空的（作者就当一句话发）。**不论有没有标题，标题元素都要在**：屏幕阅读器
	// 靠标题层级跳读条目，没有标题元素的那条会被整个跳过。链接也落在这个标题里——
	// 有标题时是标题本身，没标题时是日期，于是每条恰好有一个带名字的链接。
	$yuki_title     = get_the_title();
	$yuki_has_title = '' !== trim( $yuki_title );
	?>
	<h2 class="yuki-shuoshuo-title">
		<a href="<?php the_permalink(); ?>"><?php
			if ( $yuki_has_title ) {
				the_title();
			} else {
				?><time datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() . ' ' . get_the_time() ); ?></time><?php
			}
		?></a>
	</h2>

	<div class="yuki-shuoshuo-body"><?php the_content(); ?></div>

	<?php if ( $yuki_has_title || comments_open() || get_comments_number() ) : ?>
	<footer class="yuki-shuoshuo-meta">
		<?php if ( $yuki_has_title ) : ?>
			<time class="yuki-shuoshuo-time" datetime="<?php echo esc_attr( get_the_date( 'c' ) ); ?>"><?php echo esc_html( get_the_date() . ' ' . get_the_time() ); ?></time>
		<?php endif; ?>
		<?php if ( comments_open() || get_comments_number() ) : ?>
			<a class="yuki-shuoshuo-comments" href="<?php echo esc_url( get_permalink() . '#comments' ); ?>">
				<?php
				$yuki_comment_count = get_comments_number();
				if ( 0 === (int) $yuki_comment_count ) {
					esc_html_e( '说点什么', 'yuki' );
				} else {
					/* translators: %s: 评论条数 */
					printf( esc_html__( '%s 条评论', 'yuki' ), esc_html( number_format_i18n( $yuki_comment_count ) ) );
				}
				?>
			</a>
		<?php endif; ?>
	</footer>
	<?php endif; ?>
</article>
