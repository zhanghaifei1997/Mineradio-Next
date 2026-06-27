# Mineradio 新旧项目界面差异对比分析报告

## ✅ P0 核心优化：全部替换为老项目原版 SVG 图标（已完成）

## ✅ P1 优化：音质选择 pill 样式 + 播放按钮 SVG 滤镜增强（已完成）

### 音质选择恢复 pill 样式
- **QualitySelector.vue 完全重构**：从圆形 emoji 按钮 → 老项目 pill 药丸形按钮
- pill 样式：`border-radius: 13px`、`min-width: 56px`、`padding: 0 11px`、`font-weight: 800`
- popover 弹层：`border-radius: 14px`、`backdrop-filter: blur(24px) saturate(1.25)`、Grid 布局
- 音质选项：5级（标准/HQ/SQ/高清臻音/超清母带），SVIP锁定+灰色提示
- short label 显示：标/HQ/SQ/臻/母（与老项目一致）
- active 状态：`rgba(157,184,207,.16)` + inset highlight（与老项目一致）

### 播放按钮 SVG 滤镜增强
- **动态位移贴图生成**：`generateControlGlassDisplacementMap()` 函数，为三个 SVG 滤镜注入 data URI 位移贴图
  - control-glass: 1120×82, radius=40
  - search-box: 520×58, radius=22
  - search-pill: 200×24, radius=12
- **特性检测升级**：`checkSvgBackdropFilter()` 增加 Safari/Firefox 排除逻辑
- **色差偏移动态调节**：`updateGlassChromaticOffset()` + fx store 集成，VisualConsole 可实时调整
- `.player-bar.visible` 已有 SVG 滤镜应用（`url(#mineradio-control-glass-filter)`）
- `.play-btn` SVG 滤镜模式下使用 `blur(24px)`（与老项目一致）

## ✅ P2 优化：首页面板马赛克布局 + color-mix + 唱片纹路（已完成）

### 唱片纹路修复
- `.home-disc::before` 恢复老项目原版：`inset: 34%` + `background: linear-gradient(145deg, ...)` + `box-shadow`
- `.disc-ring` 恢复老项目外圈细纹：`inset: 10%` + asymmetric border colors
- `.card-cover-mini.placeholder::before` 添加唱片纹路：`repeating-radial-gradient` + `conic-gradient` + inset black ring

### tone 配色组（与老项目 data-home-tone 一致）
- `.card-weather`: `--tone-a: #00f5d4; --home-accent: #00f5d4` (青色)
- `.card-daily`: `--tone-a: #9db8cf; --home-accent: #9db8cf` (灰蓝)
- `.card-fm`: `--tone-a: #f8f4ee; --home-accent: #f8f4ee` (暖白)
- `.card-continue`: `--tone-a: #7ad7c2; --home-accent: #7ad7c2` (薄荷)
- `.card-profile`: `--tone-a: #2442ff; --home-accent: #2442ff` (蓝)
- `.card-artists`: `--tone-a: #f4d28a; --home-accent: #f4d28a` (香槟金)

## ✅ P3 优化：上传按钮 + 用户胶囊 + 搜索面板样式对齐（已完成）

### 用户胶囊样式对齐
- `.user-capsule__hide-btn` 恢复老项目 pill 形状：18×28px、`border-radius: 999px`、`border: 1px solid`、初始 `opacity: 0` + hover reveal
- `.user-capsule` 基础样式：`font-weight: 650`、`letter-spacing: .08em`、`backdrop-filter: blur(20px)`、`box-shadow` + inset highlight
- hover 状态：`color: #fff2bd` + gold glow + `transform: translateY(-1px)`
- `.vip-tag` 金色渐变 + `.vip-tag--svip` 青色渐变（与老项目一致）

### 搜索面板样式对齐
- 添加来源区分 hover 色：`.result-item.netease-source:hover` (红色调) + `.qq-source:hover` (绿色调)
- 添加来源标签 `.tag-source` 样式：pill 形状、netease 红色/qq 绿色配色（与老项目一致）

### 上传按钮
- IconUpload.vue 已使用老项目原版 SVG
- CoverUploader.vue 样式基本对齐，`main.css` 已有 `control-glass-svg-ok` 滤镜支持
## ✅ Phase 1: 欢迎页（VisualGuide）对比与同步（已完成）

### 老项目 vs 新项目差异分析

**老项目 VisualGuide 是精巧的交互式导览系统：**
- 高亮目标 UI 元素（ring 聚光灯 + gradient scrim）
- 动态定位：根据目标元素的 boundingRect 自动计算 ring 和 card 位置
- 6 步内容：Welcome → Play → Control → Account → Visual → Guide
- 每步有 kicker（"01 / Welcome"）、title、body 文字
- 准备步骤会 peek/reveal 相关面板（搜索 peek、底部栏 reveal 等）

**新版项目之前是简单居中模态弹窗：**
- 6 步泛化内容 + emoji 图标 + dot 进度条
- 固定居中位置，无目标高亮
- 无 peek/reveal 面板交互

### 完成的修复
- **完全重写 VisualGuide.vue**，恢复老项目的交互式导览系统：
  - `visual-guide-scrim`：gradient scrim（linear-gradient + radial-gradient with --gx/--gy CSS 变量）
  - `visual-guide-ring`：高亮聚光灯（border + box-shadow + inner border + scan line 动画）
  - `visual-guide-card`：定位描述卡片（kicker + title + body + hint + progress + actions）
  - 动态定位逻辑：`getTargetRect()` + `positionStep()` 根据 target 元素自动定位
  - 6 步内容完全匹配老项目原版文字
  - peek/reveal 事件：`peek-search`、`peek-fx`、`reveal-bottom` 等
  - `body.visual-guide-active` CSS class 效果
- **MainView.vue 新增事件处理**：
  - `peekSearchForGuide()`、`peekFxForGuide()`、`revealBottomForGuide()`
  - `maybeAutoStartGuide()` 自动启动逻辑
- **main.css 新增 `visual-guide-active` 样式**：引导期间隐藏特定 UI 元素

## ✅ Phase 2-3: 主页面容器 + 工具栏对比（已完成分析）

### 老项目 vs 新项目结构对比

**老项目架构（全屏叠加层）：**
- `#custom-bg` + `#album-bg` → 背景氛围层
- `#canvas-container` → Three.js 3D 舞台
- `#idle-guide-canvas` → 空闲粒子引导
- `#splash` → 启动页（已完善）
- `#hint` → 中心提示文字
- `#search-area` → 搜索区（peek 模式）
- `#empty-home` → 首页面板
- `#top-right` → 仅 Home + 登录 + hide-btn（极简3元素）
- `#fx-fab` + `#fx-panel` → 视觉控制台
- `#playlist-panel` → 歌单面板
- `#bottom-bar` → 底部控制栏
- `#thumb-wrap` → 左下角小封面
- `#drop-overlay` → 拖拽上传遮罩
- `#toast` → Toast 通知
- `#visual-guide` → 交互式导览

**新项目架构（Vue 组件化）：**
- CustomBgVideo → ✅ 对应 #custom-bg
- VisualCanvas → ✅ 对应 #canvas-container + #album-bg
- IdleGuide → ✅ Canvas粒子动画（240粒子+3D透视+拖尾+引力交互，已完全重写）
- SplashScreen.vue → ✅ 完善实现（WebGL + 2D fallback 粒子系统）
- CentralHint → ✅ 对应 #hint
- SearchPanel → ✅ 对应 #search-area
- HomePanel → ✅ 对应 #empty-home
- top-toolbar → ✅ 但比老项目更多按钮（新增功能）
- VisualConsole → ✅ 对应 #fx-panel
- PlayerBar → ✅ 对应 #bottom-bar
- UserCapsule → ✅ 对应 #user-btn
- DropOverlay → ✅ 对应 #drop-overlay
- Toast → ✅ 对应 #toast
- VisualGuide → ✅ 已修复为老项目交互式版本

### 关键交互逻辑对比结论

| 功能 | 实现状态 | 差异说明 |
|------|----------|----------|
| setPeek/peek | ✅ 已实现（改进） | usePanelPeek.ts 更模块化 |
| DIY模式切换 | ✅ 已实现（等价） | fx.layoutMode 状态管理 |
| Bottom bar 显示/隐藏 | ✅ 已实现（改进） | 可配置延迟时间 |
| 用户胶囊自动隐藏 | ✅ 已实现（等价） | 完全一致 |
| Fx FAB 自动隐藏 | ✅ 已实现（等价） | 完全一致 |
| 沉浸模式 | ✅ 已实现（增强） | 增加 ImmersivePlayer 组件 |
| 歌单钉住 | ✅ 已实现（等价） | queuePinned vs playlistPanelPinned |
| 鼠标自动隐藏 | ✅ 已实现（等价） | 2.5s 延迟 |

### 老项目有而新项目缺失的功能

1. **✅ `#thumb-wrap`** — 左下角小封面缩略图（已实现 ThumbWrap.vue，播放时左下角显示封面+标题+歌手）
2. **✅ `#upload-actions` + `#upload-tip`** — 搜索框旁上传按钮和提示气泡（已实现 UploadActions.vue，含老项目原版样式+tip 气泡+localStorage 记忆）
3. **✅ `#idle-guide-canvas`** — 空闲状态 Canvas 粒子动画（已完全重写 IdleGuide.vue，240粒子+3D透视+拖尾+引力交互）

### 老项目极简风格 vs 新项目增强功能

老项目右上角 `#top-right` 只有 3 个元素：Home + 登录 + hide-btn。新项目工具栏右侧有 11 个按钮（含新增的天气、推荐、排行等）。这些是**新项目的新增功能**，不需要回退。

---

## ✅ 3个缺失组件实现（已完成）

### #thumb-wrap 左下迷你封面
- 创建 `src/components/player/ThumbWrap.vue`
- fixed 定位 left:24px bottom:24px, 64px 圆角封面+标题+歌手信息
- 可点击标题/歌手打开详情，hover champagne 高亮 (#fff0bf + text-shadow)
- 封面随播放脉动（CSS breathing，老项目用 bass*0.08 缩放）
- 沉浸模式自动隐藏，已集成到 MainView.vue

### #upload-actions + #upload-tip 搜索框旁上传
- 创建 `src/components/search/UploadActions.vue`
- 上传按钮：老项目 IconUpload + 青色边框 (rgba(0,245,212,.24))
- 清除封面按钮：28px mini circle，has-cover champagne 风格
- 上传提示气泡：老项目原版样式（gradient bg + champagne border + arrow + title + close）
- 首次显示 maybeShowUploadTipOnce，6.8秒自动关闭，localStorage 记忆
- 已集成到 MainView.vue app-content

### #idle-guide-canvas Canvas 粒子动画
- 完全重写 `src/components/guide/IdleGuide.vue`
- 240 粒子（环形76% + 游离24%）+ 3D 透视投影
- 4个锚点 + 26帧拖尾系统
- 指针交互：拖拽旋转 + wheel 缩放 + pointer 引力
- 惯性衰减 + 呼吸光晕 + 粒子间连线
- body.idle-guide-on/interactive/dragging CSS 控制
- 沉浸模式和播放中自动隐藏

---

## 剩余优化项目（待后续迭代）

### P1 - 播放按钮特殊样式微调
- 播放按钮 SVG 滤镜增强（需 html.control-glass-svg-ok 检测）
- 音质选择恢复老项目 pill 样式

### P2 - 首页面板布局优化
- 首页卡片恢复马赛克布局（大卡片+小卡片 2×2 grid）
- 首页卡片恢复 color-mix 动态混色装饰
- 旋转唱片恢复完整渐变纹路视觉效果
- HomePanel 中 Emoji 替换为 SVG（✨ → IconStar 等）

### P3 - 其他细节修复
- 上传按钮恢复（带品牌青色强调）
- 用户胶囊样式优化
- 搜索面板样式对齐

---

## 一、技术栈对比

| 维度 | 老项目 (old-Mineradio) | 新项目 (Mineradio-Next) |
|------|------------------------|--------------------------|
| **框架** | 纯原生 HTML/CSS/JS (~1.3MB 单文件 SPA) | Vue 3 + Pinia + Vue Router + TypeScript |
| **构建** | 无构建工具 | Vite 5 |
| **3D** | Three.js r128 (本地 vendor) | Three.js ^0.185 (npm) |
| **动画** | GSAP 3.15 (本地 vendor) | GSAP ^3.15 (npm) |
| **Electron** | 42.x | 42.x |
| **UI 库** | 无（全部自绘 SVG + CSS） | 无（全部自绘，但用了 Emoji 替代） |
| **图标系统** | 内嵌 SVG 图标（精心设计，统一风格） | SVG 图标组件已创建（39个）**但未使用**，UI 全用 Emoji |

---

## 二、界面差异详细对比

### 2.1 🔴 顶部工具栏 (MainView.vue vs #top-right)

| 老项目 | 新项目 | 问题 |
|--------|--------|------|
| SVG `#home-btn` 带品牌青色边框和毛玻璃效果 | Emoji `🏠` | 🏠 在不同 OS 上渲染不一致，无毛玻璃质感 |
| SVG `#upload-btn` 带青色强调 | 无上传按钮 | 功能缺失 |
| SVG `#visual-guide-btn` 带品牌设计 | Emoji `❓` | ❓ 无品牌感 |
| SVG 各种圆形毛玻璃按钮 | Emoji 圆形按钮 | Emoji 无法继承 color/阴影/glow |

**影响**：整个顶部工具栏从"精致毛玻璃控制台"变成了"emoji 快捷面板"，视觉档次严重下降。

### 2.2 🔴 播放栏按钮 (PlayerBar.vue vs #bottom-bar #controls)

| 老项目 | 新项目 | 问题 |
|--------|--------|------|
| SVG `#play-btn` 58px 圆形，内嵌毛玻璃 + SVG 图标 | Emoji `▶/⏸` 在普通按钮中 | 播放按钮失去了标志性毛玻璃圆形设计 |
| SVG `.ctrl-btn` 统一 21px SVG 图标 | Emoji 文字 (⏮⏭🔁📋等) | 所有控件失去了精致 SVG 视觉 |
| SVG `.heart-svg` 带发光阴影 | Emoji `❤️/🤍` | 喜欢按钮失去了发光动画 |
| SVG 各种 transport/modes 按钮 | 全 Emoji | 控件视觉一致性完全丢失 |

**影响**：播放栏是用户最频繁交互的区域，从精致设计变成 Emoji 堆砌，体验差距极大。

### 2.3 🟡 首页面板 (HomePanel.vue vs #empty-home)

| 老项目 | 新项目 | 问题 |
|--------|--------|------|
| `.home-hero` 网格布局（左文字+右旋转唱片） | `.hero-section`（左文字+右旋转唱片） | 结构相似 ✓ |
| `.home-mosaic` 马赛克布局（大小卡片2×2） | `.cards-grid` 标准卡片网格 | 马赛克布局丢失 |
| `.home-tile-row` 5列小卡片 | 无 5 列小卡片行 | 功能缺失 |
| SVG 品牌色 `.home-card` 带 `color-mix` 混色 | Emoji 卡片 (✨📻🌤️📅) | 卡片装饰从精致 SVG 变成 Emoji |
| `.home-disc` 旋转唱片+渐变+纹路 | `.home-disc` 旋转唱片（简化版） | 唱片视觉效果简化 |

### 2.4 🟢 已正确继承的部分

| 功能 | 老项目 | 新项目 | 状态 |
|------|--------|--------|------|
| SVG 玻璃滤镜 | `mineradio-control-glass-filter` | ✓ 保留在 index.html | ✅ 正确 |
| 播放栏布局 | 固定底部居中，50px 圆角 | ✓ 一致 | ✅ 正确 |
| 进度条粒子效果 | thumb-particle 动画 | ✓ 保留 | ✅ 正确 |
| 毛玻璃 CSS 变量 | --glass-* / --saved-* | ✓ 保留在 main.css | ✅ 正确 |
| 三种布局模式 | DIY/Simple/Immersive | ✓ 一致 | ✅ 正确 |
| 面板 Peek 系统 | 搜索/FX/歌单 | ✓ 一致 | ✅ 正确 |
| 控件自动隐藏 | body.controls-auto-hide | ✓ 一致 | ✅ 正确 |
| 品牌配色 | #00F5D4 / #f4d28a / #d95b67 | ✓ 保留 | ✅ 正确 |

---

## 三、SVG 图标组件现状

新项目 `src/components/icons/` 已有 **39 个 SVG 图标组件**：

**已有且可直接使用的：**
- IconPlay, IconPause, IconSkipBack, IconSkipForward ✓
- IconShuffle, IconRepeat, IconRepeat1 ✓
- IconVolume, IconVolumeX ✓
- IconSearch, IconSettings ✓
- IconList, IconListOrdered ✓
- IconMinimize, IconMaximize ✓
- IconMusic, IconMic, IconUser ✓
- IconClock, IconFolder, IconInfo ✓
- IconEqualizer, IconCompact ✓

**缺失需要新建的：**
- IconHome（🏠 替代）
- IconHeart / IconHeartOff（❤️/🤍 替代）
- IconSun（☀️ 替代）
- IconMoon（🌙 替代）
- IconWeather / IconCloudSun（🌤️ 替代）
- IconCalendar（📅 替代）
- IconTrophy（🏆 替代）
- IconPalette / IconBrush（🎨 替代）
- IconMonitor（🖥️ 替代）
- IconEye / IconEyeOff（👁️ 替代）
- IconMobile（📱 替代 → 可用 IconCompact）
- IconQueue / IconPlaylist（📋 替代 → 可用 IconListOrdered）
- IconLyrics（词 替代）
- IconFullscreen（⛶ 替代 → 可用 IconMaximize）
- IconUpload（上传按钮 → 新建）

---

## 四、优化计划（按优先级排序）

### P0 - 替换 Emoji 为 SVG 图标（视觉差距最大）
1. 新建缺失的 12 个 SVG 图标组件
2. MainView.vue 工具栏：所有 Emoji → SVG Icon 组件
3. PlayerBar.vue 控制栏：所有 Emoji → SVG Icon 组件
4. HomePanel.vue 卡片：关键 Emoji → SVG Icon 组件

### P1 - 播放按钮特殊样式修复
5. 播放按钮恢复老项目的 58px 毛玻璃圆形设计 + SVG 图标
6. 喜欢按钮恢复 SVG heart + glow 动画
7. 音质选择恢复 SVG pill 样式

### P2 - 首页面板布局优化
8. 首页卡片恢复马赛克布局
9. 首页卡片恢复 color-mix 动态混色装饰
10. 旋转唱片恢复完整渐变纹路视觉效果

### P3 - 其他细节修复
11. 上传按钮恢复（带品牌青色强调）
12. 用户胶囊样式优化
13. 搜索面板样式对齐
