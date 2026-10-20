/**
 * 站点模块：标签墙的渐进增强。
 *
 * 没有脚本时 details 保持 open，完整列表可见；
 * 超过阈值时只收起长列表，分类与数量仍由 PHP 输出。
 */
( function () {
	'use strict';

	var walls = document.querySelectorAll( '[data-yuki-tag-wall]' );

	Array.prototype.forEach.call( walls, function ( wall ) {
		var list = wall.querySelector( '.yuki-tag-wall-list' );
		var limit = parseInt( wall.getAttribute( 'data-collapse-at' ), 10 );

		if ( ! list || ! limit || limit < 1 ) {
			return;
		}

		if ( list.children.length > limit ) {
			wall.removeAttribute( 'open' );
		}
	} );
}() );
