/**
 * 单篇阅读辅助：自动目录、阅读进度。
 *
 * 目录只从正文 h2/h3 生成；不足两项时不创建。进度条是固定在视口顶端的
 * 一像素线，只作视觉提示，同时用 progressbar 语义给读屏器。
 */
( function () {
	'use strict';

	var config = window.yukiReading || {};

	function reducedMotion() {
		return window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	}

	function uniqueId( heading, index ) {
		var base = heading.id || 'section-' + ( index + 1 );
		var id = base;
		var n = 2;

		while ( document.getElementById( id ) && document.getElementById( id ) !== heading ) {
			id = base + '-' + n;
			n += 1;
		}

		return id;
	}

	function initProgress() {
		var progress = document.createElement( 'div' );
		var bar = document.createElement( 'span' );
		var frame = 0;

		progress.className = 'yuki-reading-progress';
		progress.setAttribute( 'role', 'progressbar' );
		progress.setAttribute( 'aria-label', config.progressLabel || '阅读进度' );
		progress.setAttribute( 'aria-valuemin', '0' );
		progress.setAttribute( 'aria-valuemax', '100' );
		progress.setAttribute( 'aria-valuenow', '0' );
		bar.className = 'yuki-reading-progress-bar';
		progress.appendChild( bar );
		document.body.insertBefore( progress, document.body.firstChild );

		function update() {
			var root = document.documentElement;
			var max = root.scrollHeight - root.clientHeight;
			var top = window.pageYOffset || root.scrollTop || 0;
			var value = max > 0 ? Math.min( 1, Math.max( 0, top / max ) ) : 0;

			bar.style.transform = 'scaleX(' + value + ')';
			progress.setAttribute( 'aria-valuenow', String( Math.round( value * 100 ) ) );
			frame = 0;
		}

		function requestUpdate() {
			if ( frame ) {
				return;
			}
			frame = window.requestAnimationFrame( update );
		}

		window.addEventListener( 'scroll', requestUpdate, { passive: true } );
		window.addEventListener( 'resize', requestUpdate );
		update();
	}

	function initToc() {
		var slot = document.querySelector( '[data-yuki-toc]' );
		var main = slot ? slot.closest( '.yuki-article-main' ) : null;
		var prose = main ? main.querySelector( '.yuki-prose' ) : null;

		if ( ! slot || ! prose ) {
			return;
		}

		var headings = Array.prototype.slice.call( prose.querySelectorAll( 'h2, h3' ) );
		if ( headings.length < 2 ) {
			return;
		}

		var toc = document.createElement( 'details' );
		var summary = document.createElement( 'summary' );
		var list = document.createElement( 'ol' );
		var links = [];
		var wide = window.matchMedia( '(min-width: 960px)' ).matches;

		toc.className = 'yuki-toc';
		toc.open = wide;
		summary.className = 'yuki-toc-summary';
		summary.textContent = config.tocLabel || '目录';
		list.className = 'yuki-toc-list';

		headings.forEach( function ( heading, index ) {
			var id = uniqueId( heading, index );
			var item = document.createElement( 'li' );
			var link = document.createElement( 'a' );

			heading.id = id;
			item.className = heading.tagName === 'H3' ? 'is-level-3' : 'is-level-2';
			link.href = '#' + id;
			link.textContent = heading.textContent.trim();
			link.setAttribute( 'data-target', id );
			item.appendChild( link );
			list.appendChild( item );
			links.push( link );

			link.addEventListener( 'click', function ( event ) {
				event.preventDefault();
				heading.scrollIntoView( { behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' } );
				heading.setAttribute( 'tabindex', '-1' );
				heading.focus( { preventScroll: true } );

				if ( window.history && window.history.pushState ) {
					window.history.pushState( null, '', '#' + id );
				} else {
					window.location.hash = id;
				}

				if ( window.matchMedia( '(max-width: 959px)' ).matches ) {
					toc.open = false;
				}
			} );
		} );

		toc.appendChild( summary );
		toc.appendChild( list );
		slot.appendChild( toc );

		function setCurrent( heading ) {
			links.forEach( function ( link ) {
				if ( heading && link.getAttribute( 'data-target' ) === heading.id ) {
					link.setAttribute( 'aria-current', 'location' );
				} else {
					link.removeAttribute( 'aria-current' );
				}
			} );
		}

		function updateCurrent() {
			var current = null;

			headings.forEach( function ( heading ) {
				if ( heading.getBoundingClientRect().top <= 120 ) {
					current = heading;
				}
			} );

			setCurrent( current || headings[ 0 ] );
		}

		window.addEventListener( 'scroll', updateCurrent, { passive: true } );
		updateCurrent();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', function () {
			initProgress();
			initToc();
		} );
	} else {
		initProgress();
		initToc();
	}
} )();
