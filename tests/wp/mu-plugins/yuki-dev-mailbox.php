<?php
/**
 * Plugin Name: Yuki 开发环境 · 邮件捕获
 * Description: 本地验证环境的设施：把 wp_mail() 的每一封邮件原样写进一个文件，供测试读出正文与其中的链接。这是本地环境的东西，不是主题的一部分——主题换成任何一个都照样工作。
 *
 * 装法见 tests/README.md（由 tests/bin/harness.mjs 复制进 wp-content/mu-plugins/）。
 * 仓库里只有这份代码，捕获文件在仓库之外的 var/ 目录。
 *
 * @package Yuki\DevHarness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 捕获文件与 stub 状态所在的目录。
 * 默认取 WordPress 目录的同级 var/；要挪地方就在 wp-config.php 里定义 YUKI_DEV_VAR。
 */
function yuki_dev_var_dir() {
	if ( defined( 'YUKI_DEV_VAR' ) ) {
		return rtrim( (string) YUKI_DEV_VAR, '/\\' );
	}

	$env = getenv( 'YUKI_DEV_VAR' );
	if ( is_string( $env ) && '' !== $env ) {
		return rtrim( $env, '/\\' );
	}

	return dirname( untrailingslashit( ABSPATH ) ) . '/var';
}

/** 捕获文件的路径。 */
function yuki_dev_mail_log() {
	return yuki_dev_var_dir() . '/mail.log';
}

/**
 * 在 PHPMailer 之前把邮件接管掉。
 *
 * pre_wp_mail 返回非 null 就会短路 wp_mail()，所以本地站不会真的去发信（这台机器上
 * 本来也没有可用的发信方式），而调用方拿到的仍然是「发送成功」——测试要的就是这个：
 * 走完整的调用路径，只是出口落到文件里。
 *
 * 正文按原样写入、不折行。长链接必须完整落在文件里，否则「链接有没有被截断」这件事
 * 就根本验不了。
 */
add_filter(
	'pre_wp_mail',
	function ( $preempt, $atts ) {
		$log = yuki_dev_mail_log();
		$dir = dirname( $log );

		if ( ! is_dir( $dir ) && ! wp_mkdir_p( $dir ) ) {
			// 目录建不出来就交回给 WordPress，别把邮件悄悄吞掉
			return $preempt;
		}

		$to = $atts['to'] ?? '';
		if ( is_array( $to ) ) {
			$to = implode( ', ', $to );
		}

		$headers = '';
		if ( ! empty( $atts['headers'] ) ) {
			$headers = is_array( $atts['headers'] ) ? implode( "\n  ", $atts['headers'] ) : (string) $atts['headers'];
		}

		$message = (string) ( $atts['message'] ?? '' );

		$record  = '===== MAIL ' . gmdate( 'c' ) . " =====\n";
		$record .= 'to: ' . $to . "\n";
		$record .= 'subject: ' . ( $atts['subject'] ?? '' ) . "\n";
		$record .= 'headers: ' . $headers . "\n";
		$record .= "----- body -----\n";
		$record .= $message;
		if ( "\n" !== substr( $record, -1 ) ) {
			$record .= "\n";
		}
		$record .= "===== END MAIL =====\n";

		// 写不进去就别谎报「已发送」——交回给 WordPress 走它原本的路，
		// 让调用方看到真实的失败，而不是一个测试里找不到的空结果。
		if ( false === file_put_contents( $log, $record, FILE_APPEND | LOCK_EX ) ) {
			return $preempt;
		}

		return true;
	},
	10,
	2
);
