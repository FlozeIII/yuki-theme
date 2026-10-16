<?php
/**
 * 工单 02（首页截图）的造数：往本地站**放进几篇像样子的演示文章**，让截图拍出来是一支博客，
 * 而不是一屏「YUKI-TEST …」的验证数据。
 *
 * 只加东西（外加把这批文章置顶），**不动全站设置**：
 *   - 6 篇文章（publish，日期按顺序排在**最新**，并且**置顶**——见下）
 *   - 3 个分类（名字是正常中文分类名，slug 带 yuki-screenshot-demo- 前缀）
 *   - 6 张缩略图（uploads 里，文件名带 yuki-screenshot-demo- 前缀）
 * **不动**任何 theme mod、站点名、描述、每页文章数——本地环境是所有会话共用的，
 * 另外几个工单的造数会把 `yuki_shuoshuo_category` 指向它们自己的分类，别去踩。
 * 唯一落到 option 表的是 `sticky_posts`（置顶就是这么存的）——它记的是「哪几篇文章置顶」，
 * 逐篇的状态；删除文章不会自动摘干净，所以下面清理时一并 `unstick_post`。
 *
 * **为什么要置顶**：光按日期排是不够的。这个本地站同时开着别的会话，它们各自的造数会
 * 往首页塞「YUKI-…-TEST」这种文章，日期还更新——那些会插进演示文章中间，拍出来的第一屏
 * 就又成了验证数据（实测踩到过：另一件工单的分页测试文章挤到了第二位）。置顶以后，
 * WP 会把它们整体挪到首页列表最前面，别的东西进不来。
 * 代价是这批演示文章会一直占着首页第一屏，直到重跑本脚本（会先 unstick 再删）——
 * 这是为了「重拍一次就得到能交出去的图」付的。要撤掉就再跑一次本脚本、或按下面的标记清。
 *
 * 每篇文章与每张封面附件都带 `_yuki_screenshot_demo` 这个 meta。要清掉这批演示数据，按它找即可；
 * 重跑本脚本也会先取消置顶、按标记删掉上一轮（含附件），所以**可以反复执行**。
 *
 * 重拍前按下面的顺序跑一遍（先造数、再截图，两步之间越快越好）：
 *
 *   php tests/bin/screenshot-fixtures.php <wordpress目录>
 *   node tests/bin/make-screenshot.mjs
 *
 * 用法: php tests/bin/screenshot-fixtures.php <wordpress目录>
 */

// 不要叫 $wp —— WordPress 的环境实例就叫这个名字。
$wp_root = $argv[1] ?? '';
if ( ! $wp_root || ! file_exists( $wp_root . '/wp-load.php' ) ) {
	fwrite( STDERR, "用法: php screenshot-fixtures.php <wordpress目录>\n" );
	exit( 2 );
}

require $wp_root . '/wp-load.php';
unset( $wp_root );

require_once ABSPATH . 'wp-admin/includes/image.php';

const YUKI_DEMO_META = '_yuki_screenshot_demo';

/* ---------- 1. 先清掉上一轮（按标记找，可重复执行）---------- */

$removed = 0;

// 文章按标记 meta 找。删文章不会把它从 sticky_posts 选项里摘干净，留着的 id 会指向
// 不存在的文章，所以先 unstick 再删。
foreach ( get_posts( array(
	'post_type'   => 'post',
	'numberposts' => -1,
	'post_status' => 'any',
	'meta_key'    => YUKI_DEMO_META,
) ) as $old ) {
	unstick_post( $old->ID );
	wp_delete_post( $old->ID, true );
	$removed++;
}

// 封面附件另外按**文件名前缀**找，不按标记：删文章不会顺手删掉挂在它上面的附件，
// 而按前缀找能连「加标记之前那几轮」建下的附件一起兜住——只认标记的话，早期那批
// 会一直留在媒体库里（它们和这一轮的封面指向同一批文件，不清就是一堆重复条目）。
$strays = get_posts( array(
	'post_type'   => 'attachment',
	'numberposts' => -1,
	'post_status' => 'any',
	'fields'      => 'ids',
	'meta_query'  => array(
		array(
			'key'     => '_wp_attached_file',
			'value'   => 'yuki-screenshot-demo-',
			'compare' => 'LIKE',
		),
	),
) );

foreach ( $strays as $old_id ) {
	wp_delete_post( $old_id, true );
	$removed++;
}

/* ---------- 2. 分类 ---------- */

/**
 * 按 slug 取或建一个分类。名字就是访客看见的那个，slug 带前缀，方便一次搜出来。
 *
 * 建不出来就**当场停**：`wp_insert_term()` 在「同名的分类已经存在（只是 slug 不同）」这类
 * 情况下返回 WP_Error，硬把它的 term_id 读成 0 的话，文章会静默地掉进「未分类」，
 * 拍出来的图看着没问题、分类徽章却不对。宁可报错。
 */
function yuki_demo_category( $name, $slug ) {
	$term = get_term_by( 'slug', $slug, 'category' );

	if ( ! $term ) {
		$term = wp_insert_term( $name, 'category', array( 'slug' => $slug ) );
	}

	if ( is_wp_error( $term ) ) {
		fwrite( STDERR, "建分类「{$name}」失败：" . $term->get_error_message() . "\n" );
		exit( 2 );
	}

	return (int) ( is_array( $term ) ? $term['term_id'] : $term->term_id );
}

$categories = array(
	'life'    => yuki_demo_category( '生活随笔', 'yuki-screenshot-demo-life' ),
	'reading' => yuki_demo_category( '读书记录', 'yuki-screenshot-demo-reading' ),
	'notes'   => yuki_demo_category( '前端笔记', 'yuki-screenshot-demo-notes' ),
);

/* ---------- 3. 缩略图：柔和渐变 + 两个半透明的圆 ---------- */

/**
 * 画一张封面图。不用文字——带字的看着就还是占位图。
 *
 * @param string $path  落盘路径。
 * @param array  $from  起始色的 [r, g, b]。
 * @param array  $to    结束色的 [r, g, b]。
 * @param float  $phase 圆的偏移量，让六张各不相同。
 */
function yuki_demo_thumb( $path, array $from, array $to, $phase ) {
	$w = 900;
	$h = 675;
	$im = imagecreatetruecolor( $w, $h );
	imagealphablending( $im, true );

	for ( $y = 0; $y < $h; $y++ ) {
		$t = $y / ( $h - 1 );
		$c = imagecolorallocate(
			$im,
			(int) round( $from[0] + ( $to[0] - $from[0] ) * $t ),
			(int) round( $from[1] + ( $to[1] - $from[1] ) * $t ),
			(int) round( $from[2] + ( $to[2] - $from[2] ) * $t )
		);
		imageline( $im, 0, $y, $w, $y, $c );
	}

	$white = imagecolorallocatealpha( $im, 255, 255, 255, 104 );
	imagefilledellipse( $im, (int) ( $w * ( 0.18 + 0.5 * $phase ) ), (int) ( $h * 0.42 ), 460, 460, $white );
	imagefilledellipse( $im, (int) ( $w * 0.78 ), (int) ( $h * ( 0.68 - 0.3 * $phase ) ), 210, 210, $white );

	imagepng( $im, $path );
	imagedestroy( $im );
}

$uploads = wp_upload_dir();
$palettes = array(
	array( array( 253, 232, 215 ), array( 239, 181, 138 ) ),
	array( array( 199, 210, 254 ), array( 129, 140, 248 ) ),
	array( array( 215, 232, 208 ), array( 143, 179, 154 ) ),
	array( array( 247, 214, 222 ), array( 217, 155, 171 ) ),
	array( array( 227, 213, 245 ), array( 167, 139, 199 ) ),
	array( array( 207, 233, 232 ), array( 127, 181, 179 ) ),
);

$thumbs = array();
foreach ( $palettes as $i => $palette ) {
	$name = 'yuki-screenshot-demo-' . ( $i + 1 ) . '.png';
	$path = trailingslashit( $uploads['path'] ) . $name;

	yuki_demo_thumb( $path, $palette[0], $palette[1], $i / 5 );

	$id = wp_insert_attachment( array(
		'post_mime_type' => 'image/png',
		'post_title'     => '演示封面 ' . ( $i + 1 ),
		'post_status'    => 'inherit',
	), $path );

	wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
	update_post_meta( $id, YUKI_DEMO_META, 1 );
	$thumbs[ $i ] = $id;
}

/* ---------- 4. 六篇演示文章 ---------- */

$now = time();

// 每篇往后挪 5 分钟，第 0 篇最新 → 它就排在首页第一个。
// 只给 post_date（**站点时区的墙上时间**）：post_date_gmt 由 wp_insert_post 自己换算，
// 手工同时给两个反而容易写岔。用 wp_date() 而不是 gmdate(strtotime(current_time()))——
// 后者要靠「WordPress 把 PHP 默认时区钉成 UTC」这一条，两个偏移正好抵消才算得对；
// wp_date() 直接按站点时区格式化，没这层依赖。
// 日期不能在未来：未来的 publish 会被 wp_insert_post 改成定时，那就不出现在首页上了。
// 所以第 0 篇就取「现在」，它比在此之前建的任何文章都新。
$demos = array(
	array(
		'cat'     => 'life',
		'title'   => '窗台上的绿萝',
		'excerpt' => '把它挪到了能晒到下午光的地方。第三天，新叶子展开了。',
		'body'    => '窗台朝西，下午四点以后才有光。绿萝在原先那个角落待了半年，叶子一片比一片小，颜色也发灰——我一直当它是「本来就长这样」。'
			. '搬到有光的那一侧，第三天早上就看见一片卷着的新叶，边缘还带着水汽。'
			. '养植物这件事大概跟写东西一样：不出声的那段时间，不一定是停了，可能只是光不够。',
	),
	array(
		'cat'     => 'notes',
		'title'   => 'CSS 变量做主题色的三条经验',
		'excerpt' => '把颜色收进自定义属性之后，深浅两套皮肤只剩一份结构。',
		'body'    => '第一，只在 :root 与 .dark 两个块里写死颜色，其他地方一律 var() 引用——哪天要换主色，改两行就够了。'
			. '第二，别让组件自己猜颜色，把「底、字、边、弱化」这四个语义名定齐，组件按语义取。'
			. '第三，过渡动画只加在颜色属性上，别用 all——否则窗口一缩放，整页都在闪。',
	),
	array(
		'cat'     => 'reading',
		'title'   => '《夜晚的潜水艇》读后',
		'excerpt' => '一个人可以在自己的房间里，潜到别人看不见的海底去。',
		'body'    => '读完印象最深的不是那些精巧的设定，而是它写「一个人如何为自己造一个世界，并且知道那个世界不必被谁认可」。'
			. '书里的主角把房间当成潜水艇，海图是自己画的，航线也是自己定的。'
			. '合上书之后我在想：写字、写代码、养植物，大概都是同一个动作的变体。',
	),
	array(
		'cat'     => 'life',
		'title'   => '周末的一场雨',
		'excerpt' => '原本要去山里的，雨把计划留在了家里。',
		'body'    => '早上六点半醒来，听见雨打在空调外机上。翻了个身继续睡到十点。'
			. '把攒了一周的碗洗了，煮一壶咖啡，窗玻璃上全是水痕，外面的树被压得很低。'
			. '下午雨停，空气凉得像换了个季节。出门走了四十分钟，鞋边沾了泥。',
	),
	array(
		'cat'     => 'notes',
		'title'   => '把长列表做轻的一点做法',
		'excerpt' => '列表一长，页面就开始喘。先量，再改。',
		'body'    => '先别急着换框架。打开性能面板，看是布局在抖还是图片在排队。'
			. '多数时候是后者：一张张图各占各的尺寸，浏览器排到最后才知道该留多少位置。'
			. '把宽高写进标签，再给视口外的图加 loading="lazy"，一屏的高度就定下来了，滚动也跟着稳。',
	),
	array(
		'cat'     => 'reading',
		'title'   => '重读《小径分岔的花园》',
		'excerpt' => '这回注意到的不是时间，是「选择」这件事的写法。',
		'body'    => '第一次读只记住了「花园」和「迷宫」这两个词。这次读下来，觉得它其实在写一个人如何面对自己没走的那条路。'
			. '所有的可能性同时存在，而叙述者只能报出其中一条——这一点比时间循环更让人坐不住。'
			. '短，可以反复读。',
	),
);

$items = array();

foreach ( $demos as $i => $demo ) {
	$post_id = wp_insert_post( array(
		'post_title'    => $demo['title'],
		'post_content'  => '<p>' . $demo['body'] . '</p>',
		'post_excerpt'  => $demo['excerpt'],
		'post_status'   => 'publish',
		'post_type'     => 'post',
		'post_author'   => 1,
		'post_category' => array( $categories[ $demo['cat'] ] ),
		'post_date'     => wp_date( 'Y-m-d H:i:s', $now - $i * 5 * MINUTE_IN_SECONDS ),
	) );

	update_post_meta( $post_id, YUKI_DEMO_META, 1 );
	set_post_thumbnail( $post_id, $thumbs[ $i ] );
	// 置顶：别的会话的造数日期再新，也只会排在演示文章之后（见文件头那段）。
	stick_post( $post_id );

	$items[] = array(
		'id'        => $post_id,
		'title'     => get_the_title( $post_id ),
		'permalink' => get_permalink( $post_id ),
		'category'  => get_cat_name( $categories[ $demo['cat'] ] ),
	);
}

/* ---------- 5. 说是改了什么 ---------- */

echo "演示文章  : 新建 " . count( $items ) . " 篇（已置顶），清掉上一轮 " . $removed . " 项（文章按标记 meta " . YUKI_DEMO_META . "，封面附件按文件名前缀）\n";
echo "演示分类  : " . implode( '、', array_map(
	static function ( $id ) {
		return get_cat_name( $id ) . '（#' . $id . '）';
	},
	$categories
) ) . "\n";
echo "演示封面  : " . count( $thumbs ) . " 张，落在 " . $uploads['path'] . "\n";
echo "置顶      : sticky_posts 现在有 " . count( (array) get_option( 'sticky_posts' ) ) . " 个 id\n";
echo "全站设置  : theme mod 一处未改；置顶落在 sticky_posts 这个 option 上（逐篇文章的状态，随文章一起清）\n";
echo 'YUKI-JSON: ' . wp_json_encode( array(
	'site'       => home_url( '/' ),
	'items'      => $items,
	'categories' => $categories,
	'thumbs'     => array_values( $thumbs ),
	'removed'    => $removed,
) ) . "\n";
