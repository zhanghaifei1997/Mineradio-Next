# Mineradio Next

> 沉浸式音乐播放器 - 模块化重构版

![GitHub license](https://img.shields.io/badge/license-GPL--3.0-blue.svg)
![Node version](https://img.shields.io/badge/node-%3E%3D20-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-%5E5.0-blue.svg)
![Vue](https://img.shields.io/badge/vue-%5E3.4-brightgreen.svg)

## 项目介绍

Mineradio Next 是一款基于 Electron + Vue 3 构建的沉浸式桌面音乐播放器，采用模块化架构设计，提供丰富的音乐可视化效果和桌面歌词体验。

## 功能特性

### 🎵 核心功能
- **多音乐源支持** - 网易云音乐、QQ 音乐、本地音乐
- **沉浸式可视化** - 基于 Three.js 的 3D 音乐可视化
- **桌面歌词** - 支持逐字歌词、自定义样式、透明度调节
- **节拍检测** - 实时 BPM 检测与音乐节拍同步
- **播放队列管理** - 支持多种播放模式、拖拽排序、历史记录
- **本地音乐库** - 扫描本地音乐文件，自动匹配元数据

### 🎨 可视化效果
- 多种预设可视化效果（Emily、Skull、Galaxy、Vinyl、Planet 等）
- 节拍同步的粒子系统
- 实时频谱分析
- 3D 唱片架展示

### 🛠️ 技术特性
- 模块化架构设计
- Pinia 状态管理
- TypeScript 类型安全
- Vite 快速构建
- 完整的单元测试

## 技术栈

### 前端框架
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 下一代前端构建工具
- **Pinia** - Vue 官方状态管理库

### 桌面端
- **Electron** - 跨平台桌面应用框架
- **electron-builder** - 应用打包与发布工具

### 可视化与音频
- **Three.js** - 3D 图形库
- **GSAP** - 高性能动画库
- **Web Audio API** - 音频分析与处理
- **mpg123-decoder** - 高性能 MP3 解码器

### 开发工具
- **Vitest** - Vite 原生测试框架
- **ESLint** - 代码检查工具
- **Prettier** - 代码格式化工具

## 快速开始

### 环境要求
- Node.js >= 20.0.0
- pnpm >= 9.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 仅前端开发
pnpm dev

# Electron 开发模式（推荐）
pnpm electron:dev
```

### 构建

```bash
# 构建前端
pnpm build

# 构建当前平台安装包
pnpm electron:build

# 构建 Windows 安装包
pnpm electron:build:win

# 构建 macOS 安装包
pnpm electron:build:mac

# 构建 Linux 安装包
pnpm electron:build:linux
```

## 开发指南

### 项目结构

```
Mineradio-Next/
├── build/              # 构建配置和资源
├── electron/           # Electron 主进程代码
├── server/             # 本地服务器（API 代理）
├── src/                # 前端源码
│   ├── components/     # Vue 组件
│   ├── composables/    # 组合式函数
│   ├── modules/        # 核心模块
│   │   ├── audio/      # 音频分析与处理
│   │   ├── lyrics/     # 歌词引擎
│   │   ├── providers/  # 音乐源 Provider
│   │   ├── visual/     # 可视化引擎
│   │   └── ...         # 其他模块
│   ├── stores/         # Pinia 状态管理
│   ├── types/          # TypeScript 类型定义
│   ├── utils/          # 工具函数
│   └── styles/         # 全局样式
├── .github/workflows/  # GitHub Actions 工作流
└── ...                 # 配置文件
```

### 核心模块

- **LyricEngine** - 歌词解析与渲染引擎
  - LRC 格式解析
  - YRC 逐字歌词解析
  - 自定义歌词支持
  - 时间轴计算

- **BeatDetector** - 节拍检测引擎
  - 实时 BPM 计算
  - 能量频段分析
  - 节拍事件触发

- **MusicProvider** - 音乐源基类
  - 统一的音乐源接口
  - 搜索、详情、歌词等 API
  - 批量 URL 获取

- **playQueue Store** - 播放队列管理
  - 顺序/循环/单曲/随机播放
  - 历史记录
  - 拖拽排序

### 代码规范

```bash
# 代码检查
pnpm lint:check

# 自动修复
pnpm lint

# 代码格式化
pnpm format

# 类型检查
pnpm typecheck
```

### 单元测试

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

## 构建说明

### GitHub Actions CI/CD

项目配置了完整的 CI/CD 流水线：

- **build.yml** - 主工作流
  - 触发条件：push 到 master/main/dev、PR、tag 推送
  - 代码检查、类型检查、单元测试
  - 前端构建
  - 构建产物上传

- **release.yml** - 发布工作流
  - 触发条件：tag 推送（v* 格式）
  - 三平台构建（Windows/macOS/Linux）
  - 自动生成更新日志
  - 上传到 GitHub Releases

### 手动构建

```bash
# 安装依赖
pnpm install

# 运行测试
pnpm test

# 构建前端
pnpm build

# 打包 Electron 应用
pnpm electron:build
```

## 贡献指南

我们欢迎任何形式的贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解详细的贡献流程。

### 提交问题

- 使用 GitHub Issues 提交 Bug 或功能请求
- 请尽可能提供详细的复现步骤和环境信息

### 提交代码

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 开源协议

本项目基于 [GPL-3.0](LICENSE) 协议开源。

---

<p align="center">Made with ❤️ by Mineradio Team</p>
