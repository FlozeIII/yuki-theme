/**
 * Yuki — 浅色/深色主题滑动开关
 * 偏好存入 localStorage；沙箱环境（预览 iframe）下静默降级。
 */
(function () {
	'use strict';

	var root = document.documentElement;

	function getStoredTheme() {
		try {
			return localStorage.getItem('theme');
		} catch (e) {
			return null;
		}
	}

	function setStoredTheme(theme) {
		try {
			localStorage.setItem('theme', theme);
		} catch (e) {
			/* 沙箱环境可能禁用存储，忽略 */
		}
	}

	function toggleTheme() {
		var isDark = root.classList.contains('dark');
		root.classList.toggle('dark', !isDark);
		root.classList.toggle('light', isDark);
		setStoredTheme(isDark ? 'light' : 'dark');
	}

	function bind() {
		var btn = document.getElementById('theme-toggle');
		if (btn) {
			btn.addEventListener('click', toggleTheme);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bind);
	} else {
		bind();
	}
})();
