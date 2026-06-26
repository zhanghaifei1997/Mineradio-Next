# Mineradio v2 模块化重构迁移指南

## 项目结构

```
Mineradio-Next/
├── src/                           # 前端源码 (Vue 3 + TypeScript)
│   ├── components/                # UI 组件
│   │   ├── player/               # 播放控制组件
│   │   ├── visual/               # 视觉效果组件
│   │   ├── search/               # 搜索组件
│   │   ├── playlist/             # 歌单组件
│   │   ├── lyrics/               # 歌词组件
│   │   ├── settings/             # 设置组件
│   │   └── common/               # 通用组件
│   ├── modules/                   # 业务模块
│   │   ├── player/               # 播放内核
│   │   ├── lyrics/               # 歌词引擎
│   │   ├── visual/               # 视觉引擎 (Three.js)
│   │   ├── playlist/             # 歌单管理
│   │   ├── providers/            # 音乐源 Provider
│   │   │   ├── MusicProvider.ts  # 抽象基类
│   │   │   ├── NeteaseProvider.ts
│   │   │   ├── QQMusicProvider.ts
│   │   │   └── index.ts          # ProviderManager
│   │   ├── search/               # 搜索服务
│   │   └── settings/             # 设置管理
│   ├── stores/                    # Pinia 状态管理
│   │   ├── player.ts
│   │   ├── playQueue.ts
│   │   ├── fx.ts
│   │   └── user.ts
│   ├── styles/                    # 全局样式
│   │   └── main.css
│   ├── types/                     # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/                     # 工具函数
│   │   └── index.ts
│   ├── assets/                    # 静态资源
│   ├── App.vue
│   └── main.ts
├── server/                        # 后端服务 (模块化)
│   ├── index.js                   # 入口
│   ├── routes/                    # 路由
│   │   ├── netease.js
│   │   ├── qqmusic.js
│   │   └── update.js
│   ├── middleware/                # 中间件
│   │   └── auth.js
│   └── utils/                     # 工具
│       ├── http.js
│       └── logger.js
├── electron/                      # Electron 主进程
│   ├── main.js
│   ├── preload.js
│   ├── overlay-preload.js
│   └── server.js
├── public/                        # 静态文件
├── index.html                     # Vite 入口
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 核心架构设计

### 1. 音乐源 Provider 模式

所有音乐源统一实现 `MusicProvider` 抽象类，新增音乐源只需实现接口。

**已实现：**
- ✅ 网易云音乐 (`NeteaseProvider`)
- ✅ QQ 音乐 (`QQMusicProvider`)

**扩展方式：**

```typescript
import { MusicProvider } from '@/modules/providers/MusicProvider'

export class KugouProvider extends MusicProvider {
  readonly id = 'kugou'
  readonly name = '酷狗音乐'
  readonly color = '#2d8cf0'
  
  // 实现所有抽象方法...
}

// 注册
providerManager.register(new KugouProvider())
```

### 2. 状态管理 (Pinia)

- `player` - 播放器状态
- `playQueue` - 播放队列
- `fx` - 视觉效果设置
- `user` - 用户登录状态

### 3. 组件分层

```
App.vue
├── VisualCanvas.vue       # Canvas/WebGL 视觉层 (最底层)
├── PlaylistShelf.vue      # 歌单展示
├── SearchPanel.vue        # 搜索面板
├── SettingsPanel.vue      # 设置面板
└── PlayerBar.vue          # 底部播放栏 (最顶层)
```

## 迁移进度

### ✅ 已完成

- [x] Vite + Vue 3 + TypeScript 项目骨架
- [x] 音乐源 Provider 抽象层（网易云 + QQ 音乐）
- [x] Pinia 状态管理 (player / playQueue / fx)
- [x] 基础 UI 组件骨架
  - [x] PlayerBar 播放控制栏
  - [x] VisualCanvas 粒子视觉
  - [x] SearchPanel 搜索面板
  - [x] PlaylistShelf 歌单展示
  - [x] SettingsPanel 设置面板
- [x] 后端 server.js 模块化
  - [x] 网易云 API 路由
  - [x] QQ 音乐 API 路由
  - [x] 更新路由
  - [x] HTTP 工具 & 日志
- [x] Electron 主进程模块化
- [x] 全局样式 & CSS 变量

### ✅ 已完成迁移

**视觉模块（高优先级）：**
- [x] Three.js 3D 粒子系统 (`src/modules/visual/`)
- [x] 7 种视觉预设 (emily/skull/galaxy/vinyl/planet/cylinder/void)
- [x] 3D 歌单架 (`src/modules/shelf/`)
- [x] 自由相机模式 (`src/modules/visual/CameraSystem.ts`)
- [x] 节拍检测与相机同步 (`src/modules/visual/BeatSync.ts`)
- [x] 实时 Beat Engine (`src/modules/audio/BeatDetector.ts`)
- [x] Cinema Dynamics (`src/modules/audio/AudioAnalyzer.ts`)

**音频模块（高优先级）：**
- [x] Web Audio API 实时频谱分析
- [x] BPM / 节拍检测算法
- [x] 低频/中频/高频能量计算
- [x] 节拍事件生成
- [x] Beat map 预分析
- [x] mpg123 解码集成 (`src/modules/audio/mpg123Decoder.ts`)
- [x] DJ 模式节拍增强

**歌词模块（高优先级）：**
- [x] 歌词舞台 (全屏歌词) (`src/components/lyrics/StageLyrics.vue`)
- [x] 逐字/逐行歌词渲染 (`src/modules/lyrics/LyricRenderer.ts`)
- [x] 卡拉 OK 效果 (`src/components/lyrics/LyricLine.vue`)
- [x] 桌面歌词窗口 (`src/components/lyrics/DesktopLyrics.vue`)
- [x] 歌词翻译显示
- [x] 字体发光/阴影效果
- [x] 歌词排版布局系统

**3D 歌单架（高优先级）：**
- [x] 3D 旋转唱片/封面墙
- [x] 歌单卡片 3D 弧形排列
- [x] 鼠标悬停交互
- [x] 滚轮缩放浏览
- [x] 点击展开歌单详情
- [x] 与相机系统联动

**用户系统（中优先级）：**
- [x] 用户登录/登出 (`src/stores/user.ts`)
- [x] 二维码登录 + 浏览器登录
- [x] 我喜欢的音乐
- [x] 每日推荐
- [x] 用户歌单列表
- [x] 用户胶囊组件
- [x] 双音乐源账号管理

**DJ 模式（中优先级）：**
- [x] DJ 模式引擎 (`src/modules/dj/DjModeEngine.ts`)
- [x] 播客/电台管理 (`src/modules/dj/PodcastManager.ts`)
- [x] 电台推荐与分类
- [x] 节目详情与主播信息
- [x] DJ 模式视觉增强
- [x] 节目过渡效果

**性能管理（中优先级）：**
- [x] 性能分级（eco/balanced/high/ultra）
- [x] 动态 DPR 调整（像素预算）
- [x] 后台模式优化
- [x] 封面图缓存管理（LRU）
- [x] Beat map 缓存
- [x] 景深图缓存
- [x] 运行时性能监控
- [x] 缓存自动修剪
- [x] 长任务观察者

**后端 API（中优先级）：**
- [x] 网易云完整 API（50+ 端点）
- [x] QQ 音乐 API
- [x] 用户登录相关
- [x] 歌单管理
- [x] 搜索/推荐
- [x] 电台播客
- [x] 代理服务
- [x] 本地文件服务

**Electron 桌面功能（低优先级）：**
- [x] 系统托盘
- [x] 全局快捷键
- [x] 桌面歌词窗口
- [x] 登录窗口
- [x] 单实例锁定
- [x] IPC 通信完善
- [x] 壁纸模式框架
- [x] 多平台构建配置

### ⚠️ 需进一步完善/验证的功能

以下功能框架已搭建，但需要更多调优和真实环境验证：

- [ ] Skull 预设的真实模型点云（当前用程序生成形状）
- [ ] WorkerW 桌面歌词注入（Windows 专属 Win32 API）
- [ ] 锁屏歌词
- [ ] 通知栏歌词
- [ ] 自动增量补丁更新
- [ ] 本地音乐扫描与管理
- [ ] 音量归一化
- [ ] 音频淡入淡出
- [ ] 更精细的电影动力学曲目画像

## 迁移策略

### 策略：渐进式迁移，边迁移边验证

1. **搭好骨架** ✅ 已完成
2. **核心通路跑通**
   - 搜索 → 播放 → 歌词 → 视觉
   - 每完成一个模块就验证可以运行
3. **逐步丰富功能**
   - 按优先级从高到低迁移
   - 每迁移一个功能就做一次提交
4. **最后优化**
   - 性能调优
   - 代码质量提升
   - 类型补全

## 开发命令

```bash
# 安装依赖
npm install

# 前端开发模式 (浏览器)
npm run dev

# Electron 开发模式
npm run electron:dev

# 后端服务开发
npm run server:dev

# 类型检查
npm run typecheck

# 构建前端
npm run build

# 构建 Electron 安装包
npm run electron:build
```

## 新增音乐源流程

1. 在 `src/modules/providers/` 创建 `XxxProvider.ts`
2. 继承 `MusicProvider` 抽象类
3. 实现所有抽象方法
4. 在 `providers/index.ts` 的 `ProviderManager.constructor` 中注册
5. 在 `server/routes/` 创建对应后端路由
6. 在 `server/index.js` 中挂载路由

## 多平台规划

### 桌面端 (Electron → Tauri 2.0)
- Windows ✅
- macOS ✅
- Linux ✅

### 移动端 (Tauri Mobile 或 Capacitor)
- Android ⏳
- iOS ⏳

### 鸿蒙
- 待 Tauri/Capacitor 支持，或 ArkTS 原生开发

---

**注意**：此文件是迁移工作文档，随着迁移进度持续更新。
