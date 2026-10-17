# 发布 Yuki

面向维护者。发布物是 GitHub release 上那个能直接安装的 `yuki.zip`。路线是**自托管分发**，
不提交 WordPress.org 主题目录（见 ADR 0002）。`docs/` 被 `.distignore` 排除，这份文档不会随包分发。

发布是一串**有序**的动作。任何一步不成立就停下，不要带着「差不多」往下走。

## 1. 确认起点

```bash
git status --short          # 必须为空
git fetch origin
git log --oneline origin/main..HEAD   # 必须为空，要发的改动已经推上去
git rev-parse HEAD          # 记下发布提交
git tag -l                  # 已发布的标签
```

- 发布提交不能夹带别的会话或未完成的改动。工作树不干净就先把它们处理掉。
- 已推送的标签**不移动**。发出去的东西要修，就发新版本。
- 版本号按语义化版本：修 bug 走 patch，新增功能走 minor，破坏兼容走 major。

## 2. 改版本号

只改 `style.css` 头部这一行：

```
Version: 1.1.0
```

不要顺手动其他头部字段。`languages/yuki.pot` 不因版本号变化而需要重生成。

## 3. 提交、打标签、推送

```bash
git add style.css
git commit -m "release: 1.1.0"
git tag -a v1.1.0 -m "Yuki 1.1.0"
git push origin main
git push origin v1.1.0
```

打完标签先核对：**发布提交就是标签指的那个提交。**

```bash
git rev-parse HEAD
git rev-parse 'v1.1.0^{commit}'   # 必须与上一行相同
```

## 4. 从标签出包

```bash
node tests/bin/package-theme.mjs --rev v1.1.0 .scratch/release-prep/yuki.zip
```

- `--rev` 接受标签或提交号，默认 `HEAD`。
- 命令打印**解析后的提交号**，它必须等于第 3 步记下的发布提交。传标签时还会多打一行 `来源：`。
- 标签不存在、拼错或指向的不是提交时，命令报错退出，**不会退回 `HEAD`** 出一个错的包。
- zip 解出来顶层只有一个 `yuki/` 目录；内容清单的唯一来源是 `.distignore`。

## 5. 验收

```bash
node tests/bin/verify-package.mjs
```

这个脚本也按 `HEAD` 出包，所以第 3 步的「HEAD == 标签所指提交」是它的前提。

再逐个跑一遍行为验收（需要本地 WordPress 环境；共享环境的并发规矩见 `tests/README.md`）：

```bash
# POSIX
for script in tests/bin/verify-*.mjs; do node "$script" || break; done

# PowerShell
# Get-ChildItem tests/bin/verify-*.mjs | ForEach-Object { node $_.FullName }
```

全绿再往下走。把每个脚本的通过数记进发布工单。

## 6. 对产物跑 Theme Check

Theme Check 是发布前的一次门，**不进验收脚本**（它依赖本地环境里装的第三方插件，写进验收会让
「谁没装插件谁红」）。**必须对解开的产物跑，不要对工作区跑**：工作区里的 `tests/`、`docs/`、
`.scratch/` 会被逐文件扫到，实测会多出十几条产包里根本不存在的假阳性。

产物要解到一个**临时 WordPress 根**里，并且主题目录名必须是 `yuki`——Theme Check 会拿目录名跟
`Text Domain` 比，解成 `yuki-release/` 之类会多报一条「主题放错目录」。做法：core 用目录 junction
借真实安装，`plugins`、`mu-plugins`、`database` 也 junction，**只有** `wp-content/themes/yuki` 放产物。

```bash
C:/Users/Floze/wp-dev/tools/wp.cmd theme-check run yuki --path="<临时根>" --format=json
```

跑完把临时根删掉；删链接时**不要跟进 junction**（跟进就是删掉真实安装与数据库）。

把四级计数（REQUIRED / WARNING / RECOMMENDED / INFO）和**每一条残留的去向**记进发布工单。
每条都要写「为什么留着」，不能只写「没修」。当前基线见
`.scratch/release-prep/issues/06-final-release-check.md`。

## 7. 写 release notes

从上一个标签开始整理：

```bash
git log --oneline v1.0.0..v1.1.0
git log --format='%h %an %s' v1.0.0..v1.1.0
```

先核作者与改动文件，**别把别的会话的提交混进来**。按「使用者能感知的变化」分组（新增、修复、
行为变化），不要只贴提交列表。安装或升级需要额外动作时写清楚。

## 8. 发 GitHub release

**这是外向动作：先得到站主确认，再执行。**

- 上传第 4 步产出的那份 `yuki.zip`。
- **不要**用 GitHub 自动生成的源码 zip：顶层目录名不对，还带着 `.git`、`tests/`、`docs/`。
- 粘贴第 7 步的 release notes，标题用版本号（如 `Yuki 1.1.0`）。

## 9. 记账

在发布工单里留下：标签、发布提交、zip 路径、`verify-package.mjs` 的通过数、Theme Check 的四级计数
与每条残留的去向、release 链接。共享环境里的日志不要清空，断言认带本次标记的内容。

## 边界

- 不改一言与头像镜像的默认值（ADR 0002）。
- 不写 `readme.txt`，不提交官方主题目录。
- 不为了 Theme Check 的 RECOMMENDED 顺手加功能；发布准备不是功能迭代。
