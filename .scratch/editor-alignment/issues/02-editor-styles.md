# 02: 编辑器里看到的就是前台的正文

**What to build:** 让区块编辑器直接使用主题的 `style.css`，并把正文规则的作用域扩展到编辑器画布。
作者写字时的字体栈、字号、行高、正文颜色、引用、代码块、图片圆角、图注，与单篇文章前台一致。

**接入方式。** `add_theme_support( 'editor-styles' )` 与 `add_editor_style( 'style.css' )`；
正文规则的选择器改成 `:is(.yuki-prose, .editor-styles-wrapper)`（或等价写法）。**不新建编辑器样式表，
不引入构建步骤。**

**画布宽度。** 编辑器画布约束为正文文字宽约 720px 并居中。`page.php` 里会放宽到 1120px 的宽块，
在编辑器里按 720px 预览——这是已知差异，写进本工单，不要为它再叠一层编辑器专用布局。

**深色。** 编辑器只用浅色 token。深色是访客浏览器里的开关，编辑器读不到；不为编辑器另做深色。

**验收。** 用无头浏览器登录开发环境，打开文章编辑器，断言编辑器画布里确实加载了 `style.css`，并量出
画布宽度与字体栈。**登录自动化不成立时**，退到「PHP 探针（`get_editor_stylesheets()` 含 `style.css`）
+ 人工截图」，并在本工单里写明用了哪条路。静态断言证不了「样式声明了但编辑器没加载」，所以不能只做静态。

**Blocked by:** 01

**Status:** ready-for-agent

实现与验收已完成（起点 `c494961`）。

- [x] 编辑器画布确实加载了主题的 `style.css`
- [x] 编辑器的字体栈、字号、行高、正文颜色与前台一致
- [x] 引用、代码块、图片圆角、图注在编辑器里与前台一致
- [x] 编辑器画布宽度约 720px，换行位置与单篇前台接近
- [x] 编辑器只使用浅色 token，`.dark` 规则没有进入画布
- [x] 没有新增编辑器专用样式表，也没有引入构建步骤
- [x] 编辑器验收由登录后的浏览器断言钉住；若退到探针 + 截图，工单里写明原因与所用路径
- [x] 「页面宽块在编辑器按正文列预览」的差异已记录

## Comments

### 接入方式

- `yuki_setup()` 增加 `add_theme_support( 'editor-styles' )` 与 `add_editor_style( 'style.css' )`。
- 正文规则的选择器统一改成 `:is(.yuki-prose, .editor-styles-wrapper)`：前台正文与编辑器画布
  命中同一组规则，没有第二份样式表，也没有构建步骤。
- 新增 `--yuki-gutter: 24px`，它同时供容器的左右内边距与画布宽度使用：

  ```css
  .editor-styles-wrapper {
    max-width: calc(var(--yuki-content-width) - 2 * var(--yuki-gutter)); /* 720px */
    margin-left: auto;
    margin-right: auto;
  }
  ```

  `DESIGN.md` 的「布局」一节加了这一行。画布宽度不是新写的魔法数，而是从字号契约推出来的。

### 验收怎么登录的

`wp_generate_auth_cookie()` 单独生成的 cookie **不能**用于登录：WordPress 4.0+ 会拿 token 去
`WP_Session_Tokens` 里核对（`wp-includes/pluggable.php:888`），而随手生成的 token 没有登记。
所以造数改为：

1. `WP_Session_Tokens::get_instance($admin_id)->create($expiration)` 建一个真实会话，拿到 token；
2. 用同一个 token 生成两枚 cookie——`AUTH_COOKIE`（非 SSL 的 wp-admin 认这枚）与
   `LOGGED_IN_COOKIE`（登录态）；
3. 浏览器通过 CDP `Network.setCookie` 种上，打开文章的编辑页；
4. 验收结束调用 `--cleanup <token>` 销毁本次会话，不在后台的会话列表里留垃圾。

`browser.mjs` 为此加了 `setCookie()` 与 `waitFor()`。它不在 `AGENTS.md` 的共享清单上（清单里只有
`tests/bin/lib.mjs`），所以不需要挂占位。

### 测到了什么

`tests/bin/verify-editor-styles.mjs`，**23/23**。登录后的编辑器 iframe 里实测：

| 项 | 实测 |
| --- | --- |
| 画布里的主题 token | `--yuki-primary: #A5B4FC` 可读（`get_editor_stylesheets()` 也含 `style.css`） |
| 画布宽度 | 720px |
| 字体栈 | `Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, …` |
| 字号 / 行高 / 颜色 | 16px / 28px / `rgb(92, 92, 109)`（`--yuki-ink-2` 浅色） |
| 引用 | 左边框 `rgb(165, 180, 252)`，底色 `rgb(243, 240, 234)` |
| 代码块 | 底色 `rgb(255, 255, 255)`（`--yuki-card`），圆角 16px |
| 图片 | 圆角 16px |
| 图注 | 13px，`rgb(124, 124, 138)`（`--yuki-muted-foreground`） |

**一处断言更正**：核心把主题编辑器样式**内联**进画布，iframe 里的 `<link rel="stylesheet">` 只有核心
那批文件，没有 `style.css`。所以断言改成「画布里能读到 `--yuki-primary`」——它证明的是同一件事
（style.css 的内容送达了），但不依赖某一种标签形状。

**退路没有用上**：登录自动化成立，走的是浏览器断言那条路。脚本仍保留探针 + 报告的退路。

### 回归

- `verify-editor-alignment` 58/58（作用域别名改了选择器，01 的验收同步通过）。
- 说说版式 43/43、点赞 63/63、嵌套 53/53、防垃圾 34/34、截图 15/15。

### 已知边界

- 编辑器画布按 **720px** 预览；`page.php` 里放宽到 1120px 的宽块在编辑器里按 720px 显示。
  这是刻意的，不另叠编辑器专用布局。
- 编辑器只有浅色：`.dark` 是访客浏览器里的开关，编辑器 iframe 读不到。画布正文颜色
  `rgb(92, 92, 109)` 是浅色 `--yuki-ink-2`，不是深色的 `rgb(200, 200, 208)`。
- 造数会留下一个 `YUKI-EDITOR` 草稿（下次运行先删）；登录会话每次销毁。
