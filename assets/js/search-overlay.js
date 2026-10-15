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

	// 注意：展开后遮罩（z-index:100、铺满视口）会盖住整个头部，鼠标点在放大镜
	// 上时命中的其实是遮罩，走的是下面那条 backdrop 分支。所以 isOpen() 分支
	// 实际只有键盘（Tab + Enter）能走到。两条路径结果一样，都关闭，不加特殊处理。
	trigger.addEventListener('click', function () {
		if (isOpen()) {
			close();
		} else {
			open();
		}
	});

	// 只认遮罩和关闭按钮，点对话框内部不关。用 closest 是为了让点击落在
	// 它们内部的子元素上（比如按钮里的 svg）也算数。
	overlay.addEventListener('click', function (event) {
		if (event.target.closest('[data-search-close]')) {
			close();
		}
	});

	// Tab 必须锁在对话框内，否则 aria-modal="true" 就是在撒谎：它向读屏软件
	// 承诺外部内容不可达，而实际上焦点会跑到模糊的背景里去。
	function trapFocus(event) {
		var items = overlay.querySelectorAll(
			'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		if (!items.length) {
			return;
		}
		var first = items[0];
		var last = items[items.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	document.addEventListener('keydown', function (event) {
		if (!isOpen()) {
			return;
		}
		if (event.key === 'Escape') {
			close();
		} else if (event.key === 'Tab') {
			trapFocus(event);
		}
	});
})();
