<?php
/**
 * 单条评论上的点赞控件。
 *
 * 计数与「我点过没有」都由**服务端**渲染：没有 JS 时页面上照样看得见数字（禁用 JS 不该
 * 让页面缺一块），也不必为了显示一个数字再问一次服务器。assets/js/comment-likes.js 只让它
 * 点得动。
 *
 * 可读的名字由 `aria-pressed`（开关状态）加上里面那枚隐藏文字给出：光有「♥ 3」这种内容，
 * 读屏器念不出这是干什么的。数字不放进可读名字里——它一变名字就跟着变，反而吵。
 *
 * @package Yuki
 *
 * @var array $args {
 *     @type WP_Comment $comment 当前评论。
 * }
 */

$yuki_like_id    = (int) $args['comment']->comment_ID;
$yuki_like_count = yuki_comment_like_count( $yuki_like_id );
$yuki_is_liked   = yuki_comment_is_liked_by( $yuki_like_id, yuki_visitor_current() );
?>
<button type="button" class="yuki-like<?php echo $yuki_is_liked ? ' is-liked' : ''; ?>"
	data-comment-id="<?php echo esc_attr( $yuki_like_id ); ?>"
	aria-pressed="<?php echo $yuki_is_liked ? 'true' : 'false'; ?>">
	<span class="yuki-like-heart" aria-hidden="true">&hearts;</span>
	<?php // 数字原样输出，不做千分位：脚本那边只会把服务端给的值填回去，两边一格式化就不一样了 ?>
	<span class="yuki-like-count"><?php echo esc_html( $yuki_like_count ); ?></span>
	<span class="yuki-sr-only"><?php esc_html_e( '点赞', 'yuki' ); ?></span>
</button>
