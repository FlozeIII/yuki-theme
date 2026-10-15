<?php
/**
 * 评论增强 · 访客删掉自己写错的评论
 *
 * 访客提交评论后收到一封带链接的邮件；打开链接先看到确认页，确认之后那条评论被删掉。
 * 全程不需要注册或登录——链接发到他自己填的那个邮箱，拿得到链接就说明他控制着那个邮箱。
 *
 * **为什么先确认再删**：邮件客户端和聊天软件会预取正文里的链接。直接删的话，用户还没
 * 打开邮件，评论就已经没了。
 *
 * 令牌一次性、会过期、与那条评论一一绑定（见 yuki_comment_delete_verify）。
 *
 * @package Yuki
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** 令牌摘要存在哪个评论元数据键上。存摘要不存令牌本身：库被看到也不等于链接能用。 */
function yuki_comment_delete_hash_key() {
	return 'yuki_comment_delete_hash';
}

/** 过期时刻存在哪个评论元数据键上。 */
function yuki_comment_delete_expires_key() {
	return 'yuki_comment_delete_expires';
}

/** 链接有效期。 */
function yuki_comment_delete_ttl() {
	return WEEK_IN_SECONDS;
}

/**
 * 把令牌摘要成一段定长字符串。
 *
 * 走核心的 wp_hash()，不自己拼 hash_hmac + wp_salt：那两件事核心已经有一套约定
 * （哪个 scheme 用哪个 salt、算法要受支持），自己拼一份，日后核心改了约定这边不会跟着动。
 *
 * 令牌本身是 32 位随机字符，不需要慢哈希——挡的是「库被翻出来」而不是离线爆破低熵口令。
 *
 * @param string $token 原始令牌。
 * @return string
 */
function yuki_comment_delete_digest( $token ) {
	return wp_hash( 'yuki-comment-delete|' . $token, 'nonce', 'sha256' );
}

/**
 * 给一条评论签发删除令牌，返回**原始令牌**（摘要留在库里）。
 *
 * @param int $comment_id 评论 ID。
 * @return string
 */
function yuki_comment_delete_issue( $comment_id ) {
	// 只用字母数字：令牌要进 URL、进邮件正文，带符号会多出好几层转义
	$token = wp_generate_password( 32, false, false );

	update_comment_meta( $comment_id, yuki_comment_delete_hash_key(), yuki_comment_delete_digest( $token ) );
	update_comment_meta( $comment_id, yuki_comment_delete_expires_key(), time() + yuki_comment_delete_ttl() );

	return $token;
}

/**
 * 令牌可不可信。
 *
 * 四道关缺一不可：评论还在、签发过令牌、没过期、摘要对得上。
 * 摘要存在**那条评论自己**的元数据上，所以甲的令牌拿去用乙的 id 一定对不上——
 * 「令牌与评论一一绑定」是这么来的，不是靠额外比对 id。
 *
 * @param int    $comment_id 评论 ID。
 * @param string $token      表单或链接里带上来的令牌。
 * @return bool
 */
function yuki_comment_delete_verify( $comment_id, $token ) {
	$comment_id = (int) $comment_id;

	if ( $comment_id <= 0 || ! is_string( $token ) || '' === $token ) {
		return false;
	}

	if ( ! get_comment( $comment_id ) instanceof WP_Comment ) {
		return false;
	}

	$stored = (string) get_comment_meta( $comment_id, yuki_comment_delete_hash_key(), true );
	if ( '' === $stored ) {
		return false;
	}

	$expires = (int) get_comment_meta( $comment_id, yuki_comment_delete_expires_key(), true );
	if ( $expires <= 0 || time() > $expires ) {
		return false;
	}

	return hash_equals( $stored, yuki_comment_delete_digest( $token ) );
}

/**
 * 删除链接。
 *
 * @param int    $comment_id 评论 ID。
 * @param string $token      原始令牌。
 * @return string
 */
function yuki_comment_delete_url( $comment_id, $token ) {
	return add_query_arg(
		array(
			'yuki_delete' => (int) $comment_id,
			'token'       => $token,
		),
		home_url( '/' )
	);
}

/**
 * 评论提交成功后，把删除链接发到评论者填的那个邮箱。
 *
 * 不管审批状态都发：评论在等他审核，他也该能自己撤回去。
 *
 * 挂 comment_post 而不是 comment_form 之后那类位置：前者只在真的入库之后才触发，
 * 被防垃圾挡下的提交不会走到这里，也就不会白发一封邮件。
 *
 * @param int $comment_id 评论 ID。
 */
function yuki_comment_delete_notify( $comment_id ) {
	$comment = get_comment( $comment_id );

	if ( ! $comment instanceof WP_Comment || 'comment' !== $comment->comment_type ) {
		return;
	}

	/*
	 * 垃圾评论不发信。
	 *
	 * 核心黑名单拦下的评论会以 'spam' 入库，而 comment_post 对它们**照样触发**
	 * （见 wp-includes/comment.php 里这个动作的文档：「'spam' if spam」）。
	 * 给垃圾评论者的邮箱发一封带有效删除令牌的信，既是噪音，也等于回执告诉他
	 * 「这个地址能收信、而且我们看了」。
	 *
	 * 上面那句「被防垃圾挡下的提交不会白发邮件」说的是本主题自己的守卫
	 * （工单 02 那套，它在入库之前就把提交挡掉了）；核心黑名单是另一条路，要在这里拦。
	 */
	if ( in_array( (string) $comment->comment_approved, array( 'spam', 'trash' ), true ) ) {
		return;
	}

	$email = trim( (string) $comment->comment_author_email );
	if ( '' === $email || ! is_email( $email ) ) {
		return;
	}

	$url  = yuki_comment_delete_url( $comment_id, yuki_comment_delete_issue( $comment_id ) );
	$post = get_post( $comment->comment_post_ID );

	$subject = sprintf(
		/* translators: %s: 站点名 */
		__( '[%s] 需要的话，你可以删掉自己那条评论', 'yuki' ),
		wp_specialchars_decode( (string) get_option( 'blogname' ), ENT_QUOTES )
	);

	$body = array(
		sprintf(
			/* translators: %s: 文章标题 */
			__( '你在《%s》下留了一条评论：', 'yuki' ),
			$post instanceof WP_Post ? $post->post_title : ''
		),
		'',
		$comment->comment_content,
		'',
		__( '如果写错了想删掉，打开下面这个链接，确认之后就会删除。链接只能用一次，过期后失效。', 'yuki' ),
		$url,
		'',
		__( '这封邮件是因为有人在站点评论时填了这个邮箱。不是你，忽略即可。', 'yuki' ),
	);

	wp_mail( $email, $subject, implode( "\n", $body ) );
}
add_action( 'comment_post', 'yuki_comment_delete_notify' );

/**
 * 真的把那一条删掉。
 *
 * 先撤令牌再删：万一删除过程中出岔子，也不能留下一个还能用的链接。
 * 用彻底删除而不是「退回待审」——退回待审会在后台留一条他自己看不见、却又要人处理的记录，
 * 而他要的是「删掉」。子评论由 wp_delete_comment 自己上提一级，不会跟着消失，也不会
 * 留下指向空评论的空壳（wp-includes/comment.php:1589）。
 *
 * @param int $comment_id 评论 ID。
 */
function yuki_comment_delete_perform( $comment_id ) {
	delete_comment_meta( $comment_id, yuki_comment_delete_hash_key() );
	delete_comment_meta( $comment_id, yuki_comment_delete_expires_key() );

	wp_delete_comment( (int) $comment_id, true );
}

/**
 * 渲染确认页 / 完成页 / 无效页。
 *
 * 三种状态各带一个**正向标记**（`yuki-delete-confirm` / `-done` / `-invalid`）。
 * 没有标记的页面是「没渲染出来」，不是「无效」——验收脚本靠这个区分，
 * 否则「页面上没有确认字样」在页面压根是空的时候也成立，就成了假绿。
 *
 * 状态码一律 200：这是给访客看的页面，不是在报错。链接失效的访客需要一句人话，
 * 而不是一个 410。
 *
 * 页面自带一小段样式，不加载主题样式表：这是个工具页，没有文章上下文，
 * 把页头页脚整套主题外壳拉进来反而奇怪。深色模式跟着系统走。
 *
 * @param string $state      三种状态之一。
 * @param int    $comment_id 评论 ID。
 * @param string $token      原始令牌，确认页要回填进表单。
 */
function yuki_comment_delete_render( $state, $comment_id = 0, $token = '' ) {
	$titles = array(
		'confirm' => __( '删除这条评论？', 'yuki' ),
		'done'    => __( '评论已删除', 'yuki' ),
		'invalid' => __( '这个链接已经无效了', 'yuki' ),
	);

	$state = isset( $titles[ $state ] ) ? $state : 'invalid';

	status_header( 200 );

	?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title><?php echo esc_html( $titles[ $state ] ); ?></title>
<style>
	:root { color-scheme: light dark; }
	body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fafafa; color: #1a1a1a;
		font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
	.yuki-delete { width: min(30rem, calc(100% - 3rem)); padding: 2rem; background: #fff; border-radius: .75rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, .08); text-align: center; }
	.yuki-delete h1 { margin: 0 0 .75rem; font-size: 1.25rem; }
	.yuki-delete p { margin: 0 0 1rem; line-height: 1.7; color: #555; }
	.yuki-delete blockquote { margin: 0 0 1.25rem; padding: .75rem 1rem; text-align: left; border-left: 3px solid #ddd;
		background: #f6f6f6; color: #444; border-radius: .25rem; word-break: break-word; }
	.yuki-delete button { padding: .6rem 1.4rem; font: inherit; color: #fff; background: #c0392b;
		border: 0; border-radius: .5rem; cursor: pointer; }
	.yuki-delete a { color: #777; font-size: .9rem; }
	@media (prefers-color-scheme: dark) {
		body { background: #16181d; color: #e8e8e8; }
		.yuki-delete { background: #1f2229; box-shadow: none; }
		.yuki-delete p, .yuki-delete a { color: #9aa0aa; }
		.yuki-delete blockquote { background: #262a32; border-color: #3a3f49; color: #c8ccd2; }
	}
</style>
</head>
<body>
	<div class="yuki-delete yuki-delete-<?php echo esc_attr( $state ); ?>">
		<h1><?php echo esc_html( $titles[ $state ] ); ?></h1>

		<?php if ( 'confirm' === $state ) : ?>
			<?php
			$comment = get_comment( $comment_id );
			if ( $comment instanceof WP_Comment ) :
				?>
				<blockquote><?php echo esc_html( wp_trim_words( $comment->comment_content, 60, '…' ) ); ?></blockquote>
			<?php endif; ?>

			<p><?php esc_html_e( '删除之后无法恢复。', 'yuki' ); ?></p>

			<form method="post" action="<?php echo esc_url( yuki_comment_delete_url( $comment_id, $token ) ); ?>">
				<input type="hidden" name="yuki_delete" value="<?php echo esc_attr( (string) $comment_id ); ?>" />
				<input type="hidden" name="token" value="<?php echo esc_attr( $token ); ?>" />
				<button type="submit" name="yuki_delete_confirm" value="1"><?php esc_html_e( '确认删除', 'yuki' ); ?></button>
			</form>

		<?php elseif ( 'done' === $state ) : ?>
			<p><?php esc_html_e( '那条评论已经不在了。', 'yuki' ); ?></p>
		<?php else : ?>
			<p><?php esc_html_e( '它可能已经用过一次，或者已经过期了。想删的话，重新发一条评论即可拿到新链接。', 'yuki' ); ?></p>
		<?php endif; ?>

		<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( '回到站点首页', 'yuki' ); ?></a></p>
	</div>
</body>
</html>
	<?php
	exit;
}

/**
 * 处理删除链接。
 *
 * 确认那一步走 POST、从 POST 里读令牌，打开链接那一步走 GET、从 GET 里读——
 * 两边分开读是刻意的，不给「拿 GET 上的令牌去满足 POST」留口子。
 *
 * 也正因为确认是 POST：邮件客户端预取的是一个 GET，它只会看到确认页，删不掉东西。
 */
function yuki_comment_delete_handle_request() {
	if ( ! isset( $_GET['yuki_delete'] ) && ! isset( $_POST['yuki_delete'] ) ) {
		return; // 跟删除无关的请求，交回给主题正常渲染
	}

	$is_post = 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' );
	$input   = $is_post ? $_POST : $_GET;

	$comment_id = isset( $input['yuki_delete'] ) ? (int) $input['yuki_delete'] : 0;
	$token      = isset( $input['token'] ) && is_string( $input['token'] ) ? wp_unslash( $input['token'] ) : '';

	if ( ! yuki_comment_delete_verify( $comment_id, $token ) ) {
		yuki_comment_delete_render( 'invalid', $comment_id );
	}

	if ( $is_post && isset( $input['yuki_delete_confirm'] ) ) {
		yuki_comment_delete_perform( $comment_id );
		yuki_comment_delete_render( 'done', $comment_id );
	}

	yuki_comment_delete_render( 'confirm', $comment_id, $token );
}
add_action( 'template_redirect', 'yuki_comment_delete_handle_request' );
