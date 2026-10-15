/**
 * Yuki — 居中搜索浮层
 * 点头部放大镜展开，点遮罩、按 Esc、或再点一次放大镜关闭。
 * 关闭后把焦点还给触发按钮。
 */
(function () {
	'use strict';

	var overlay = document.getElementById('yuki-search-overlay');
	var trigger = document.getElementById('search-toggle');

	// 头部或 footer 被改掉时静默退出，不要让整页脚本报错
	if (!overlay || !trigger) {
		return;
	}

	var input = overlay.querySelector('input[type="search"]');
	var lastFocused = null;

	function isOpen() {
		return overlay.classList.contains('is-open');
	}

	function open() {
		lastFocused = document.activeElement;
		overlay.classList.add('is-open');
		trigger.setAttribute('aria-expanded', 'true');
		document.body.classList.add('yuki-search-locked');
		// 等一帧再聚焦，避免展开动画和页面滚动打架
		window.requestAnimationFrame(function () {
			if (input) {
				input.focus();
			}
		});
	}

	function close() {
		overlay.classList.remove('is-open');
		trigger.setAttribute('aria-expanded', 'false');
		document.body.classList.remove('yuki-search-locked');

		// 打开前记下的落点不一定是有效目标：程序化触发、以及部分浏览器
		// 的鼠标点击，都不会让按钮获得焦点，此时 activeElement 是 body。
		// 那种情况下退回触发按钮，否则焦点会丢在整个文档上。
		var target = lastFocused && lastFocused !== document.body && 'function' === typeof lastFocused.focus
			? lastFocused
			: trigger;
		target.focus();
	}

	trigger.addEventListener('click', function () {
		if (isOpen()) {
			close();
		} else {
			open();
		}
	});

	// 只认遮罩本身，点对话框内部不关
	overlay.addEventListener('click', function (event) {
		if (event.target.hasAttribute('data-search-close')) {
			close();
		}
	});

	document.addEventListener('keydown', function (event) {
		if (event.key === 'Escape' && isOpen()) {
			close();
		}
	});
})();
