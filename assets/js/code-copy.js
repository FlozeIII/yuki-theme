/**
 * Yuki — 代码块复制
 *
 * 给正文与说说里的每个非空代码块加一枚右上角按钮：点一下把代码原文写进剪贴板。
 * 成功后按钮短暂变「已复制」，失败变「复制失败」，并让读屏器播报结果。
 *
 * 这是增强：禁用 JS 时服务端不输出按钮或包装容器，代码块保持原样。
 *
 * 为什么外包一层 `.yuki-code-block`：按钮要相对代码块定位，而 `pre` 自己
 * `overflow-x: auto`，把按钮放进去会跟着代码一起横向滚走。外层容器只负责定位，
 * 代码块原有的对齐类会从 `pre` 转移过来，宽度规则继续作用在整体上。
 */
(function () {
	'use strict';

	var config = window.yukiCodeCopy || {};
	var SCOPES = '.yuki-prose pre, .yuki-shuoshuo-body pre';
	var ALIGN = /^align(?:wide|full|left|right|center)$/;
	var RESET_MS = 2000;

	var copyLabel = config.copyLabel || '复制代码';
	var copiedLabel = config.copiedLabel || '已复制';
	var failedLabel = config.failedLabel || '复制失败';

	if (!document.querySelector || !document.createElement) {
		return;
	}

	var live = null;
	var timers = new WeakMap();

	/** 视觉隐藏的播报区；整页一个，第一次用到时才建。 */
	function announce(message) {
		if (!live) {
			live = document.createElement('span');
			live.className = 'screen-reader-text';
			live.setAttribute('role', 'status');
			live.setAttribute('aria-live', 'polite');
			live.setAttribute('data-yuki-code-live', '');
			document.body.appendChild(live);
		}

		// 先清空再写，连续两次相同结果也能重新播报。
		live.textContent = '';
		window.setTimeout(function () {
			live.textContent = message;
		}, 20);
	}

	/** 老浏览器/非安全上下文的回退：临时 textarea + execCommand。 */
	function legacyCopy(text) {
		var area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.setAttribute('aria-hidden', 'true');
		area.tabIndex = -1;
		area.style.position = 'fixed';
		area.style.top = '0';
		area.style.left = '-9999px';
		area.style.fontSize = '16px';
		document.body.appendChild(area);

		var copied = false;

		try {
			area.focus();
			area.select();
			area.setSelectionRange(0, area.value.length);
			copied = document.execCommand('copy');
		} catch (error) {
			copied = false;
		}

		document.body.removeChild(area);
		return copied;
	}

	/** 返回 Promise<boolean>；失败不抛，交给调用方统一显示结果。 */
	function copyText(text) {
		if (navigator.clipboard && window.isSecureContext &&
			'function' === typeof navigator.clipboard.writeText) {
			try {
				return navigator.clipboard.writeText(text).then(function () {
					return true;
				}, function () {
					return legacyCopy(text);
				});
			} catch (error) {
				return Promise.resolve(legacyCopy(text));
			}
		}

		return Promise.resolve(legacyCopy(text));
	}

	/** 把按钮短暂改成结果文字；同一枚按钮的旧计时器先清掉。 */
	function flash(button, message, ok) {
		var previous = timers.get(button);

		if (previous) {
			window.clearTimeout(previous);
		}

		button.textContent = message;
		button.classList.toggle('is-copied', ok);
		button.classList.toggle('is-failed', !ok);
		announce(message);

		var timer = window.setTimeout(function () {
			button.textContent = copyLabel;
			button.classList.remove('is-copied', 'is-failed');
			timers.delete(button);
		}, RESET_MS);

		timers.set(button, timer);
	}

	function onCopy(button, text) {
		if (button.getAttribute('aria-busy') === 'true') {
			return;
		}

		button.setAttribute('aria-busy', 'true');

		copyText(text).then(function (ok) {
			button.removeAttribute('aria-busy');
			flash(button, ok ? copiedLabel : failedLabel, ok);
		});
	}

	function build(pre) {
		var text = (pre.querySelector('code') || pre).textContent;

		if (!text || !text.trim()) {
			return;
		}

		var wrapper = document.createElement('div');
		wrapper.className = 'yuki-code-block';

		// 对齐是代码块整体的属性；留在 pre 上会让外层容器按满宽、内层 pre 再缩一次。
		Array.prototype.slice.call(pre.classList).forEach(function (name) {
			if (ALIGN.test(name)) {
				wrapper.classList.add(name);
				pre.classList.remove(name);
			}
		});

		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'yuki-code-copy';
		button.textContent = copyLabel;
		button.setAttribute('aria-label', copyLabel);
		button.addEventListener('click', function () {
			onCopy(button, text);
		});

		pre.parentNode.insertBefore(wrapper, pre);
		wrapper.appendChild(button);
		wrapper.appendChild(pre);
	}

	function init() {
		var blocks = document.querySelectorAll(SCOPES);

		Array.prototype.forEach.call(blocks, function (pre) {
			// 脚本被重复加载，或页面里已经有别的包装时，不叠第二层。
			if (pre.closest('.yuki-code-block')) {
				return;
			}

			build(pre);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
