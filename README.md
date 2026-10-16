# Yuki — 极简 × 二次元 WordPress 主题

暖白底色 + 柔和堇紫主色的极简博客主题，带浅色/深色模式滑动开关、纵向文章列表、文章页侧边栏与备案号占位。

## 安装

1. 将发行包 `yuki.zip` 上传到 WordPress 后台 → 外观 → 主题 → 安装主题 → 上传主题；也可解压到 `wp-content/themes/`，得到 `yuki/` 目录。
2. WordPress 后台 → 外观 → 主题 → 启用 **Yuki**。
3. 外观 → 菜单：创建菜单并指定到「主导航」位置。
4. 外观 → 自定义 → **Yuki 页脚设置**：填写 ICP 备案号 / 公安备案号（留空则显示占位）。
5. 外观 → 自定义 → **Yuki 头像设置**：Gravatar 在境内访问不了，国内主机请改选 Cravatar 或自填镜像地址。

## 从源码打包

需要 Node.js 22.2+ 和 Git，无需 WP-CLI 或安装 npm 依赖。在仓库内运行：

```bash
node tests/bin/package-theme.mjs
```

默认输出 `.scratch/release-prep/yuki.zip`，也可指定输出文件：

```bash
node tests/bin/package-theme.mjs /path/to/yuki.zip
```

打包读取 **HEAD 中的主题文件与 `.distignore`**，排除开发、验证与协作文档，解开后顶层只有 `yuki/`。先提交要发布的改动；未提交修改和未跟踪文件不会进入包。命令会打印采用的提交号。

`.distignore` 是唯一的排除清单，只支持从主题根目录起算的字面路径（目录可带末尾 `/`）、空行与 `#` 注释；通配、取反和转义语法会报错停下。

包内容的验收也可直接用 Node 运行，不需要 WordPress 或 WP-CLI：

```bash
node tests/bin/verify-package.mjs
```

## 重拍首页截图

顶层的 `screenshot.png` 是主题在「外观 → 主题」里的那张脸：真实渲染出来的首页，浅色形态，1200×900（官方要求是「不大于 1200×900」且 4:3）。它随仓库提交，正常发布不需要重拍；要换一张时先让本地站跑起来，再按顺序跑：

```bash
# 这台机器上没有系统级的 php，用便携版的全路径（见 tests/README.md 的环境变量表）
"C:/Users/Floze/wp-dev/tools/php/php.exe" tests/bin/screenshot-fixtures.php "C:/Users/Floze/wp-dev/wordpress"
node tests/bin/make-screenshot.mjs
```

第一条往本地站放进 6 篇标题与缩略图都像正常博客的演示文章，并**置顶**占住首页第一屏——这个本地站同时开着别的会话，它们的造数文章日期更新，不置顶就会插到演示文章中间（见脚本头）。演示文章都带 `_yuki_screenshot_demo` 标记，重跑会先撤掉上一轮，可反复执行。

截图走无头浏览器（CDP），在**设好视口之后**产出，不是 `--screenshot --window-size` 那类先按更宽布局渲染再裁剪的老办法。拍之前它先确认首页模板在、文章够数、视口里的缩略图都加载完了，任一不成立就报错停下、不覆盖已有的图；拍完会把第一屏的标题打出来。

```bash
node tests/bin/verify-screenshot.mjs
```

## 结构

```
yuki-theme/
├── screenshot.png         后台「外观 → 主题」里的主题预览图（1200×900，浅色首页）
├── style.css              主题头 + 全部设计 Token 与样式
├── functions.php          主题设置、资源加载、自定义器（备案号 / 头像源）
├── header.php             导航 + 搜索入口 + 主题滑动开关
├── footer.php             订阅区 + 页脚 + 备案区 + 搜索浮层
├── index.php              首页（纵向单列文章列表）
├── single.php             文章详情（正文 + 侧边栏两栏）
├── page.php               静态页面（单栏）
├── archive.php            归档：分类 / 标签 / 作者 / 日期 / 自定义分类法
├── search.php             搜索结果
├── searchform.php         搜索表单
├── 404.php                未找到
├── sidebar.php            作者/一言/分类/标签云/热门文章
├── comments.php           评论列表与表单
├── template-parts/
│   └── post-item.php      列表项（首页 / 归档 / 搜索共用）
└── assets/js/
    ├── theme-toggle.js    浅色 / 深色开关
    └── search-overlay.js  居中搜索浮层
```

## 特性

- 浅色/深色切换：头部滑动开关，偏好记忆在 localStorage，跟随系统偏好初始化（头部内联脚本防闪烁）。
- 纵向文章列表：首页单列陈列，左小缩略图 + 标题/摘要/日期/分类。
- 文章页：8:4 两栏，侧边栏含作者卡、一言、分类统计、标签云、热门文章；移动端自动堆叠。
- 侧边栏可配：在「外观 → 小工具 → 文章侧边栏」放入任意小工具即接管，一个都不放则用上面那套内置默认。
- 一言：侧边栏露出一句随机的话，取自 [hitokoto.cn](https://hitokoto.cn/)。**由服务端取回并缓存一小时**，访客的浏览器不直接请求第三方，上游也不会被高频敲打；上游超时、报错或返回无法解析的内容时，显示主题自带的一句兜底，页面不会缺一块、也不会被拖慢。不想用它，往侧边栏放一个自己的小工具即可（见上一条）。
- 搜索：头部放大镜展开居中浮层，背景模糊，Esc / 点遮罩 / 再点按钮关闭。
- 备案号：自定义器填写后自动链接到工信部/公安备案查询站点。
- 头像镜像：Gravatar 在境内不可达，可在自定义器里一键切到 Cravatar 或自填镜像。
- 国际化：文案统一走 `yuki` 文本域，`languages/yuki.pot` 可直接交给译者。
  翻译文件放 `wp-content/languages/themes/yuki-{locale}.l10n.php`（或 `.mo`）。
- 无构建步骤，开箱即用。**唯一的外部依赖是一言**：只有它需要联网（服务端取回、缓存一小时），连不上时用主题自带的句子顶上，页面照常完整——它是「不自足功能」，降级是它的一部分而不是出事时才想起来的补丁。
