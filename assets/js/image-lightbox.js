/**
 * Yuki — 正文图片灯箱
 *
 * 只接管正文与说说里的图片：点（或聚焦后 Enter/Space）打开深色遮罩，显示页面里能提供的
 * 最大可用图与图注。Esc、点遮罩、点关闭按钮都能关；关闭后焦点回到触发图。
 *
 * 这是增强：禁用 JS 时图片保持原样，服务端不输出任何遮罩标记。
 *
 * 与搜索浮层同一套骨架（IIFE、无依赖、Esc + 焦点陷阱 + 滚动锁），但不共享代码——
 * 两个浮层的打开方式与内容不同，强行抽公共层只会多一层间接。
 */
(function () {
	'use strict';

	var config = window.yukiImageLightbox || {};
	var SCOPES = '.yuki-prose, .yuki-shuoshuo-body';
	var IMAGE_URL = /\.(jpe?g|png|gif|webp|avif|svg|bmp)(?:[?#].*)?$/i;
	var KEY_ENTER = 'Enter';
	var KEY_SPACE = ' ';
	var KEY_SPACE_LEGACY = 'Spacebar';

	if (!document.querySelector || !document.addEventListener) {
		return;
	}

	// 页面上没有正文容器（首页列表、归档、搜索结果）时什么都不做。
	if (!document.querySelector(SCOPES)) {
		return;
	}

	var overlay = null;
	var overlayImage = null;
	var overlayCaption = null;
	var closeButton = null;
	var lastFocused = null;

	function label(name, fallback) {
		return (config && config[name]) || fallback;
	}

	function isImageUrl(url) {
		return IMAGE_URL.test(String(url || ''));
	}

	/** srcset 里描述符最大的那一条；w 比 x 更有信息量。 */
	function largestSource(img) {
		var srcset = img.getAttribute('srcset');

		if (!srcset) {
			return '';
		}

		var best = '';
		var bestScore = -1;

		srcset.split(',').forEach(function (part) {
			var bits = part.trim().split(/\s+/);
			var url = bits[0] || '';
			var descriptor = bits[1] || '';

			if (!url) {
				return;
			}

			var score = parseFloat(descriptor) || 0;
			var weight = /w$/i.test(descriptor) ? 2 : (/x$/i.test(descriptor) ? 1 : 0);
			var weighted = score + weight * 1000000;

			if (weighted > bestScore) {
				bestScore = weighted;
				best = url;
			}
		});

		return best;
	}

	/** 图注：figure 的 figcaption → 传统/画廊图注 → alt。 */
	function captionFor(img) {
		var holder = img.closest('figure, .wp-caption, .gallery-item');
		var caption = holder
			? holder.querySelector('figcaption, .wp-caption-text, .gallery-caption')
			: null;

		if (caption) {
			return caption.textContent.trim();
		}

		return (img.getAttribute('alt') || '').trim();
	}

	/**
	 * 这张图该开哪张大图，以及点击要不要被接管。
	 *
	 * 链接到图片文件 → 用 href；
	 * 链接带 rel=attachment → 用 srcset 最大候选；
	 * 链接到别处 → 不接管，让它照常导航。
	 */
	function sourceFor(img) {
		var link = img.closest('a');
		var href = link ? link.getAttribute('href') : '';

		if (link && isImageUrl(href)) {
			return { src: href, intercept: true };
		}

		if (link && /(^|\s)attachment(\s|$)/.test(link.getAttribute('rel') || '')) {
			return {
				src: largestSource(img) || img.currentSrc || img.src,
				intercept: true,
			};
		}

		if (link) {
			return { src: '', intercept: false };
		}

		return {
			src: largestSource(img) || img.currentSrc || img.src,
			intercept: true,
		};
	}

	function buildOverlay() {
		overlay = document.createElement('div');
		overlay.className = 'yuki-lightbox';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', label('dialogLabel', '图片查看'));

		var backdrop = document.createElement('div');
		backdrop.className = 'yuki-lightbox-backdrop';
		backdrop.setAttribute('data-lightbox-close', '');

		var figure = document.createElement('figure');
		figure.className = 'yuki-lightbox-figure';

		overlayImage = document.createElement('img');
		overlayImage.className = 'yuki-lightbox-image';
		overlayImage.addEventListener('error', function () {
			var fallback = overlayImage.getAttribute('data-fallback');
			if (fallback && overlayImage.getAttribute('src') !== fallback) {
				overlayImage.setAttribute('src', fallback);
			}
		});

		overlayCaption = document.createElement('figcaption');
		overlayCaption.className = 'yuki-lightbox-caption';

		figure.appendChild(overlayImage);
		figure.appendChild(overlayCaption);

		closeButton = document.createElement('button');
		closeButton.type = 'button';
		closeButton.className = 'yuki-lightbox-close';
		closeButton.setAttribute('data-lightbox-close', '');
		closeButton.setAttribute('aria-label', label('closeLabel', '关闭'));
		closeButton.textContent = '×';

		overlay.appendChild(backdrop);
		overlay.appendChild(figure);
		overlay.appendChild(closeButton);

		// 只认遮罩与关闭按钮；点图片本身不关。
		overlay.addEventListener('click', function (event) {
			if (event.target.closest('[data-lightbox-close]')) {
				close();
			}
		});

		document.body.appendChild(overlay);
	}

	function open(img, source) {
		if (!overlay) {
			buildOverlay();
		}

		lastFocused = img.closest('a') || img;

		overlayImage.setAttribute('src', source);
		overlayImage.setAttribute('data-fallback', img.currentSrc || img.src || '');
		overlayImage.setAttribute('alt', img.getAttribute('alt') || '');

		var caption = captionFor(img);
		overlayCaption.textContent = caption;
		overlayCaption.hidden = !caption;

		document.body.classList.add('yuki-lightbox-locked');
		overlay.classList.add('is-open');

		window.requestAnimationFrame(function () {
			closeButton.focus();
		});
	}

	function close() {
		if (!overlay) {
			return;
		}

		overlay.classList.remove('is-open');
		document.body.classList.remove('yuki-lightbox-locked');

		var target = lastFocused;
		if (target && 'function' === typeof target.focus) {
			target.focus();
		}
	}

	function trapFocus(event) {
		var items = overlay.querySelectorAll(
			'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

	/** 从点击/键盘的目标找回那张正文图；链接里的图也算。 */
	function triggerFor(event) {
		var target = event.target.closest ? event.target.closest('img, a') : null;

		if (!target || target.closest('.yuki-lightbox')) {
			return null;
		}

		if (!target.closest(SCOPES)) {
			return null;
		}

		if ('IMG' === target.tagName) {
			return target;
		}

		var img = target.querySelector('img');
		return img && img.closest(SCOPES) ? img : null;
	}

	// 裸图补上键盘入口；已经在链接里的图沿用链接本身。
	Array.prototype.forEach.call(document.querySelectorAll(SCOPES.split(',').map(function (scope) {
		return scope.trim() + ' img';
	}).join(', ')), function (img) {
		img.classList.add('yuki-lightbox-trigger');

		if (img.closest('a') || img.hasAttribute('tabindex')) {
			return;
		}

		var alt = (img.getAttribute('alt') || '').trim();
		var template = label('openLabel', '查看大图：%s');

		img.setAttribute('tabindex', '0');
		img.setAttribute('role', 'button');
		img.setAttribute(
			'aria-label',
			alt ? template.replace('%s', alt) : label('openLabelPlain', '查看大图')
		);
	});

	document.addEventListener('click', function (event) {
		var img = triggerFor(event);

		if (!img) {
			return;
		}

		var source = sourceFor(img);

		if (!source.intercept) {
			return;
		}

		event.preventDefault();
		open(img, source.src);
	});

	// 裸图的 Enter/Space；链接里的图交给链接自己的 click。
	document.addEventListener('keydown', function (event) {
		if (KEY_ENTER !== event.key && KEY_SPACE !== event.key && KEY_SPACE_LEGACY !== event.key) {
			return;
		}

		var img = triggerFor(event);

		if (!img || img.closest('a') || event.target !== img) {
			return;
		}

		event.preventDefault();
		open(img, sourceFor(img).src);
	});

	document.addEventListener('keydown', function (event) {
		if (!overlay || !overlay.classList.contains('is-open')) {
			return;
		}

		if ('Escape' === event.key) {
			close();
		} else if ('Tab' === event.key) {
			trapFocus(event);
		}
	});
})();
