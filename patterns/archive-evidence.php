<?php
/**
 * Title: 证据图卡
 * Slug: yuki/archive-evidence
 * Categories: yuki-archive
 * Description: 一张带编号和说明的图片卡，适合放截图、照片或扫描件。
 * Keywords: image, evidence, 图片, 证据
 * Viewport Width: 820
 */
$yuki_evidence_image = get_theme_file_uri( 'assets/images/component-evidence.svg' );
?>
<!-- wp:group {"className":"yuki-evidence","layout":{"type":"constrained"}} -->
<div class="wp-block-group yuki-evidence"><!-- wp:image {"sizeSlug":"large","className":"yuki-evidence-image"} -->
<figure class="wp-block-image size-large yuki-evidence-image"><img src="<?php echo esc_url( $yuki_evidence_image ); ?>" alt="证据占位图"/></figure>
<!-- /wp:image -->

<!-- wp:group {"className":"yuki-evidence-meta","layout":{"type":"flex","justifyContent":"space-between"}} -->
<div class="wp-block-group yuki-evidence-meta"><!-- wp:paragraph {"className":"yuki-evidence-label"} -->
<p class="yuki-evidence-label">EVIDENCE / 01</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>图注：说明这张图为什么在这里，以及它和正文的关系。</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
