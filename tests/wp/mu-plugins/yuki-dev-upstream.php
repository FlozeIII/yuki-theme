<?php
/**
 * Plugin Name: Yuki 开发环境 · 一言上游转投
 * Description: 本地验证环境的设施：把发往一言上游的请求转投到本地 stub，并放行回环地址与 stub 的端口。这是本地环境的东西，不是主题的一部分——主题里不该出现任何为测试而存在的开关。
 *
 * 装法见 tests/README.md（由 tests/bin/harness.mjs 复制进 wp-content/mu-plugins/）。
 *
 * 为什么要在这一层转投，而不是给主题留一个「上游地址」的选项：主题一旦为了测试长出
 * 一个开关，这个开关就跟着发给每一个使用者了。用核心的 pre_http_request 拦，
 * 主题那一侧完全无感，也不必知道自己被测试。
 *
 * @package Yuki\DevHarness
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** 本地 stub 的基地址。默认 127.0.0.1:8099，可用 YUKI_DEV_STUB 覆盖。 */
function yuki_dev_stub_base() {
	if ( defined( 'YUKI_DEV_STUB' ) ) {
		return rtrim( (string) YUKI_DEV_STUB, '/' );
	}

	$env = getenv( 'YUKI_DEV_STUB' );
	if ( is_string( $env ) && '' !== $env ) {
		return rtrim( $env, '/' );
	}

	return 'http://127.0.0.1:8099';
}

/**
 * 会被转投到 stub 的上游主机。
 * 默认命中一言常用的两个域名；主题最终用哪个由工单 09 决定，届时用
 * YUKI_DEV_UPSTREAM_HOSTS（逗号分隔）改这里即可，不必动主题。
 */
function yuki_dev_upstream_hosts() {
	$list = 'v1.hitokoto.cn,hitokoto.cn';

	if ( defined( 'YUKI_DEV_UPSTREAM_HOSTS' ) ) {
		$list = (string) YUKI_DEV_UPSTREAM_HOSTS;
	} else {
		$env = getenv( 'YUKI_DEV_UPSTREAM_HOSTS' );
		if ( is_string( $env ) && '' !== $env ) {
			$list = $env;
		}
	}

	$hosts = array();
	foreach ( explode( ',', $list ) as $host ) {
		$host = strtolower( trim( $host ) );
		if ( '' !== $host ) {
			$hosts[] = $host;
		}
	}

	return $hosts;
}

/*
 * stub 跑在 127.0.0.1 上，而回环地址和 80/443/8080 之外的端口默认都会被
 * wp_http_validate_url() 判为不安全 —— 上面那两个过滤器就是把这两条豁免补上，
 * 否则请求还没出 WordPress 就被拦下来了。
 */
add_filter(
	'http_request_host_is_external',
	function ( $external, $host ) {
		$stub_host = strtolower( (string) wp_parse_url( yuki_dev_stub_base(), PHP_URL_HOST ) );

		if ( '' !== $stub_host && strtolower( (string) $host ) === $stub_host ) {
			return true;
		}

		return $external;
	},
	10,
	2
);

add_filter(
	'http_allowed_safe_ports',
	function ( $ports ) {
		$port = (int) wp_parse_url( yuki_dev_stub_base(), PHP_URL_PORT );

		if ( $port > 0 && ! in_array( $port, $ports, true ) ) {
			$ports[] = $port;
		}

		return $ports;
	}
);

/*
 * 转投本身。pre_http_request 是 WordPress 自己的 HTTP 拦截面，用它意味着这段逻辑
 * 对主题完全透明：主题照常 wp_remote_get() 上游，只是请求落到了 stub 上，
 * 而传输层是真的走了一遍（所以「把 stub 停掉」就等于真的不可达，而不是假装失败）。
 *
 * 转投用 wp_remote_request() 重新发一次，会再次进到这个过滤器里 ——
 * 静态变量就是防止它自己转投自己。
 */
add_filter(
	'pre_http_request',
	function ( $preempt, $args, $url ) {
		static $redirecting = false;

		if ( $redirecting ) {
			return $preempt;
		}

		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		if ( ! in_array( $host, yuki_dev_upstream_hosts(), true ) ) {
			return $preempt;
		}

		$path  = (string) wp_parse_url( $url, PHP_URL_PATH );
		$query = (string) wp_parse_url( $url, PHP_URL_QUERY );

		$target = yuki_dev_stub_base() . ( '' === $path ? '/' : $path );
		if ( '' !== $query ) {
			$target .= '?' . $query;
		}

		$redirecting = true;
		try {
			$response = wp_remote_request( $target, $args );
		} finally {
			$redirecting = false;
		}

		return $response;
	},
	10,
	3
);
