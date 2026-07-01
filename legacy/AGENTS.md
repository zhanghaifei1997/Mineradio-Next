# Mineradio-Next Project Rules

## Project Identity

Mineradio-Next 是基于 [Mineradio](https://github.com/XxHuberrr/Mineradio)（原作者 XxHuberrr）的二次开发版本，从 Electron 迁移至 **Tauri v2 + Rust** 架构的跨平台桌面音乐播放器。核心体验包括搜索、播放、歌单、歌词、3D 歌单架、粒子视觉预设、DIY 视觉控制台和 GitHub 自动更新。

- 当前工作区：`e:\Mineradio-Next`
- GitHub 仓库：`https://github.com/zhanghaifei1997/Mineradio-Next`
- 原项目：`https://github.com/XxHuberrr/Mineradio`（Electron 版，作者 XxHuberrr）
- 当前源码版本：`v1.1.1`
- 技术栈：Tauri v2 + Rust 后端 + Actix-web HTTP server + 前端 HTML/JS/CSS

## Repository Layout

```text
Mineradio-Next/
├─ public/                  # 前端资源
│  ├─ index.html            # 主 UI、CSS、歌词、粒子、3D 歌单架、视觉控制台
│  ├─ vendor/               # 本地 vendor 依赖
│  └─ assets/               # 点云等静态资源
├─ desktop/                 # Electron 兼容层（main.js, preload.js）
├─ build/                   # 打包资源和 installer 脚本
├─ docs/                    # 项目记忆、设计偏好、长期约束
├─ src-tauri/               # Tauri + Rust 后端
│  ├─ src/
│  │  ├─ commands/          # Tauri IPC 命令
│  │  ├─ netease/           # 网易云 API Rust 实现
│  │  ├─ server/            # Actix-web HTTP server 路由
│  │  ├─ lib.rs             # Tauri 插件注册入口
│  │  └─ main.rs            # 应用入口
│  ├─ Cargo.toml            # Rust 依赖
│  └─ tauri.conf.json       # Tauri 配置
├─ server.js                # Node.js 本地 API（Electron 兼容保留）
├─ dj-analyzer.js           # 节奏/音频分析
├─ package.json             # 前端依赖和构建脚本
└─ CHANGELOG.md             # 更新说明
```

## Commands

```powershell
# Tauri 开发模式
cargo tauri dev

# Tauri 构建
cargo tauri build

# Rust 后端检查
cd src-tauri; cargo check

# Node.js 语法检查（兼容层）
node --check server.js
```

前端主逻辑在 `public/index.html`。Tauri 开发模式下改动前端资源后会自动刷新。Rust 后端改动需要重新编译。

改动后至少做：

```powershell
git diff --check
cd src-tauri; cargo check
node --check server.js
```

## Release Workflow

发布新版本时：

1. 更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 版本号。
2. 更新 `CHANGELOG.md` 顶部中文说明。
3. 运行 Rust 编译检查和前端语法检查。
4. 执行 `cargo tauri build`。
5. 上传 GitHub Release 资产。

GitHub CLI / `gh auth` / Release 上传需要代理时，优先使用可用本机代理 `127.0.0.1:10808`。

## Origin & License

Mineradio-Next 是基于 XxHuberrr 的 Mineradio 项目的二次开发。原项目采用 GPL-3.0 协议，本二次开发版本同样遵循 GPL-3.0。详见 [LICENSE](./LICENSE)。

原作者致谢：XxHuberrr 创造了 Mineradio 的产品表达、视觉设计和核心交互体验，Mineradio-Next 在此基础上进行架构迁移和功能演进。

## User Preferences

- 交流语言：中文。
- 用户偏好：少废话，直接做，修完验证，能发布就一起发布。
- UI 审美：精致、暗色、高级、流畅，拒绝廉价渐变、过度透明、错位、闪烁和卡顿。
- 视觉质量定义：质感、丝滑度、帧数稳定同时成立；性能优化不能牺牲既有质感。
- 玻璃质感：当前播放器 SVG 玻璃质感是黄金版本，详见 `docs/GLASS_SVG_TEXTURE.md`。

## Memory Protocol

当用户说"保留""这个做得很好""我喜欢""记住这个""保存一下""以后别忘了"或同类表达时：

1. 判断用户认可的是代码、视觉效果、交互流程、发布流程还是工作习惯。
2. 将结论追加到 `docs/PROJECT_MEMORY.md` 的对应区块。
3. 如果是玻璃 SVG、粒子预设、3D 歌单架等脆弱视觉实现，同时更新对应专项文档。
4. 记录日期、涉及文件、关键参数、不要再改坏的边界。
5. 如果本轮有代码提交，把记忆文档一起提交；如果只是记忆整理，单独提交也可以。

## Guardrails

- 不要随意重写 `public/index.html` 的大块视觉系统；先定位已有函数和状态。
- 不要动电影视觉系统，除非用户明确点名。
- 不要恢复旧的侧边栏闪烁、控制台播放暂停失效、3D 歌单架强制切回星河等问题。
- 不要把搜索结果、左侧歌单、3D 歌单架的性能优化做成一次性渲染全部内容。
- 不要把用户认可的玻璃质感改成普通毛玻璃或廉价透明面板。
