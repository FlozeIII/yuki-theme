<?php
/**
 * Title: 双栏简报
 * Slug: yuki/archive-brief
 * Categories: yuki-archive
 * Description: 并排放两段短内容，手机上自动堆叠。
 * Keywords: columns, brief, 双栏, 简报
 * Viewport Width: 820
 */
?>
<!-- wp:columns {"className":"yuki-brief"} -->
<div class="wp-block-columns yuki-brief"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph {"className":"yuki-brief-label"} -->
<p class="yuki-brief-label">BRIEF / A</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">左边这一栏</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>适合放背景、条件或并列说明。两栏不必等长，但尽量保持同一层级的语气。</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph {"className":"yuki-brief-label"} -->
<p class="yuki-brief-label">BRIEF / B</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">右边这一栏</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>窄屏会自动堆叠；如果内容超过两栏，复制一组并继续保持相同的标签语法。</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
