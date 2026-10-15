# Yuki 设计规范

新会话/新工具迭代本主题时，遵循以下 Token，保持风格一致。

## 色彩

| Token | 浅色 | 深色 |
| --- | --- | --- |
| 主色 --yuki-primary | #A5B4FC | #A5B4FC |
| 主色 hover --yuki-primary-600 | #818CF8 | #818CF8 |
| 主色深 --yuki-primary-700 | #6366F1 | #6366F1 |
| 背景 --yuki-background | #FDFBF7（暖白） | #18181F |
| 前景 --yuki-foreground | #2D2D35 | #F3F0EA |
| 卡片 --yuki-card | #FFFFFF | #22222B |
| 弱化面 --yuki-muted | #F3F0EA | #2A2A35 |
| 边框 --yuki-border | #E8E5DF | #3A3A47 |

- 主色调象征「雪与暮色」，正文永远用 --yuki-ink-2 (#5C5C6D)，保持低对比柔和感。
- 深色模式不是纯黑，是带堇紫倾向的 #18181F。

## 圆角 / 阴影

- 卡片 16px、输入 8px、按钮与徽章 pill (999px)。
- 阴影极轻（alpha ≤ 0.12），hover 才上浮 translateY(-1px ~ -2px)。

## 组件签名

- **主题开关**：60×30 pill，左侧太阳/右侧月亮灰提示图标，24px 圆形滑块，0.35s cubic-bezier(0.45,0,0.2,1) 滑动；滑块内图标浅色=太阳(橙 #E8A33D)、深色=月亮(紫 #6366F1)。
- **文章列表**：单列纵向，项间 1px 分隔线，左 112×84 缩略图。
- **二次元点缀**：.yuki-dot-pattern 圆点纹理背景、.yuki-soft-frame 柔和卡片框，克制使用。

## 字体

- 正文 15–16px / line-height 1.7；标题 clamp(28px, 3.5vw, 40px)。
- 字体栈："Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui。
