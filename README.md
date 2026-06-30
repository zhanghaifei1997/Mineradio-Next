# Mineradio-Next

![Mineradio 暗场启动页](./docs/assets/readme/cinema-beat-smoke.png)

## 项目介绍

Mineradio-Next 是一款基于 [Mineradio](https://github.com/XxHuberrr/Mineradio) 二次开发的**跨平台桌面沉浸式音乐播放器**，从 Electron 架构全面迁移至 **Tauri v2 + Rust**，在保留原版核心体验的同时，带来更快的启动速度、更低的内存占用和原生跨平台支持（Windows / macOS）。

> **关于原项目**：Mineradio 由 XxHuberrr 设计与打造，采用 GPL-3.0 协议开源。Mineradio-Next 在此基础上进行架构迁移和功能演进，向原作者致以诚挚的敬意和感谢。

---

## 功能特色

### 音乐播放与平台接入

- **网易云音乐**：账号登录（扫码 / Cookie）、搜索、歌单、播客、每日推荐、私人电台
- **QQ 音乐**：搜索、登录态接入、音源补充，与网易云形成双平台体验
- **Open-Meteo 天气电台**：基于当前位置、城市和天气 mood 智能生成播放队列，优先混入每日推荐和私人推荐曲库
- **本地音频解码**：支持 MP3 (mpg123-decoder) 等格式本地播放

### 视觉与沉浸体验

- **7 套视觉预设**：Emily、安魂（骷髅点云）、星河、唱片、星球、滚筒、虚空，覆盖不同音乐氛围
- **WebGL 粒子视觉**：封面粒子系统、点云预设系统（银河、心形、DNA 螺旋、山脉、城市天际线等 10+ 种 3D 点云）
- **电影镜头系统**：基于节奏分析的电影镜头视觉，面向长播客和 DJ 曲目的专属视觉模式
- **歌词舞台**：3D 空间歌词、自定义歌词、歌词位置与角度调节、歌词发光与颜色控制
- **3D 歌单架**：右键唤起，支持静态/动态镜头、歌单队列浏览、详情页、滚动选择音效
- **Wallpaper 银河首页**：未播放状态保持干净星河氛围，播放后无缝切换到播放态视觉
- **SVG 玻璃质感 UI**：播放器控制台采用高品质 SVG 玻璃纹理，精致暗色风格

### 交互与控制

- **首页六宫格**：天气电台、每日推荐、私人电台、继续听、听歌画像、我的歌单
- **全局快捷键**：播放/暂停、上一首/下一首等系统级热键
- **方向键音量调节**：上下方向键每次 ±5% 调节音量
- **视觉控制台**：预设 / 外观 / 歌词 / 动态 / 高级五个分区，4 个用户存档槽位
- **自定义封面上传与裁剪**：支持本地图片作为专辑封面
- **桌面歌词**：独立歌词浮窗，白底可读，支持锁定穿透
- **单实例保护**：重复启动时自动聚焦已运行窗口

### 更新与分发

- **GitHub Releases 自动检测**：应用内检测新版本，支持国内加速镜像下载
- **快速补丁与完整安装包**：双通道更新策略，补丁版本匹配精确到具体版本号
- **下载体验**：显示下载速度、剩余时间、当前线路、digest 校验

---

## 下载

| 平台 | 安装包 | 下载 |
| --- | --- | --- |
| Windows (x64) | NSIS 安装程序 | [Mineradio-Next_1.1.4_x64-setup.exe](https://github.com/zhanghaifei1997/Mineradio-Next/releases/download/v1.1.4/Mineradio-Next_1.1.4_x64-setup.exe) |
| Windows (x64) | MSI 安装包 | [Mineradio-Next_1.1.4_x64_en-US.msi](https://github.com/zhanghaifei1997/Mineradio-Next/releases/download/v1.1.4/Mineradio-Next_1.1.4_x64_en-US.msi) |
| macOS (Apple Silicon) | DMG | [Mineradio-Next_1.1.4_aarch64.dmg](https://github.com/zhanghaifei1997/Mineradio-Next/releases/download/v1.1.4/Mineradio-Next_1.1.4_aarch64.dmg) |

更多版本见 [GitHub Releases](https://github.com/zhanghaifei1997/Mineradio-Next/releases)。

> **安装提示**：只需下载并运行安装包。请勿下载 `Source code`、`.blockmap`、`latest.yml`。
>
> **版本升级**：建议卸载旧版本后再安装新版。

### 下载或安装被拦截怎么办？

小众桌面软件和未签名安装包有时会被浏览器、Windows Defender 或 SmartScreen 拦截。请先确认安装包来自上方 GitHub Release 官方入口，然后：

1. **浏览器拦截**：在浏览器下载列表中找到该文件，点击右侧 `...` → `保留` / `仍要保留` / `显示更多` 后继续保留
2. **SmartScreen 拦截**：弹出蓝色窗口时，点击 `更多信息` → `仍要运行`
3. **杀毒软件拦截**：如杀软明确标记木马或高危，**不要强行运行**，删除后重新从 GitHub Release 下载；若仍然异常，请带截图反馈

---

## 开发运行

### 环境准备

- **Rust**：1.75+（[安装 Rust](https://www.rust-lang.org/tools/install)）
- **Node.js**：18+（[安装 Node.js](https://nodejs.org/)）
- **Tauri CLI**：`cargo install tauri-cli`

### 启动开发模式

```bash
# 安装前端依赖
npm install

# 启动 Tauri 开发模式（自动编译 Rust 后端并启动前端）
cargo tauri dev
```

### 构建安装包

```bash
# 构建 Windows 安装包（NSIS + MSI）
cargo tauri build

# 构建 macOS DMG 安装包
cargo tauri build -- --bundles dmg
```

### 代码检查

```bash
# Rust 后端编译检查
cd src-tauri && cargo check

# Node.js 语法检查（兼容层）
node --check server.js

# Git 跟踪风险残留检查
git diff --check
```

### 项目结构说明

- 前端主逻辑在 `public/index.html`，通过 Tauri WebView 加载
- Rust 后端代码在 `src-tauri/src/`
- Tauri 开发模式下前端改动会自动刷新，Rust 后端改动需要重新编译

---

## 技术架构

```
Mineradio-Next
├── 前端 (HTML / JS / CSS)
│   ├── public/index.html          主 UI、视觉预设、播放控制、粒子系统
│   ├── public/desktop-lyrics.html 桌面歌词浮窗
│   ├── public/wallpaper.html      壁纸模式页面
│   └── public/vendor/             Three.js、GSAP 等本地 vendor 依赖
│
├── Rust 后端 (Tauri v2)
│   ├── commands/                  Tauri IPC 命令（窗口、登录、快捷键、歌词、壁纸等）
│   ├── netease/                   网易云 API Rust 实现（AES/RSA 加密通信）
│   ├── qq/                        QQ 音乐接口 Rust 实现
│   ├── server/                    Actix-web HTTP Server（/api/* 路由）
│   ├── dj_analyzer.rs             节奏 / 音频分析引擎
│   ├── cookie_store.rs            登录 Cookie 本地持久化
│   └── lib.rs / main.rs           Tauri 入口与插件注册
│
├── 桌面集成 (Tauri v2)
│   ├── 单实例保护                  tauri-plugin-single-instance
│   ├── 全局快捷键                  tauri-plugin-global-shortcut
│   ├── 窗口状态管理                tauri-plugin-window-state
│   ├── 系统托盘                    tauri tray-icon
│   └── 文件对话框 / Shell          tauri-plugin-dialog / shell / os / process / fs
│
└── Electron 兼容层 (保留)
    ├── desktop/main.js            Electron 主进程
    └── desktop/preload.js         Electron preload 脚本
```

### 技术栈与实现

| 技术 | 用途 |
| --- | --- |
| **Tauri v2** | 桌面应用框架，替代 Electron，提供窗口管理、IPC、系统托盘、全局快捷键、单实例等 |
| **Rust** | 后端核心语言，实现 API 加密通信、HTTP server、节奏分析、Cookie 管理 |
| **Actix-web** | 内嵌 HTTP Server，提供 `/api/*` 路由，前端通过 HTTP 请求调用后端能力 |
| **AES / RSA / MD5** | 网易云音乐 API 加密通信（eapi/weapi 协议），Rust 原生实现 |
| **reqwest** | Rust HTTP 客户端，替代 axios，支持 Cookie、Stream、Gzip |
| **HTML / JS / CSS** | 前端 UI，通过 Tauri WebView 加载，保留原版前端架构 |
| **Three.js** | WebGL 3D 渲染引擎，驱动粒子视觉、点云系统、3D 歌单架、歌词舞台 |
| **GSAP** | 高性能动画库，用于 UI 过渡、视觉预设切换、镜头运动 |
| **mpg123-decoder** | WebAssembly MP3 解码器，支持本地音频分析 |
| **Open-Meteo API** | 免费天气服务，驱动天气电台的地理位置 + 天气 mood 推荐 |
| **GitHub Releases API** | 版本检测与更新分发，支持国内加速镜像 |

### 后端 HTTP 路由模块

| 路由模块 | 功能 |
| --- | --- |
| `login` | 网易云登录（扫码 / Cookie）、登录状态、退出登录 |
| `qq` | QQ 音乐登录、状态校验、退出、用户歌单 |
| `search` | 歌曲搜索（网易云 / QQ 双平台） |
| `song` | 歌曲详情、播放 URL 获取 |
| `playlist` | 歌单详情、歌单曲目、用户歌单列表 |
| `discover` | 每日推荐、私人电台、新歌发现 |
| `artist` | 歌手详情、歌手歌曲 |
| `lyric` | 歌词获取 |
| `comment` | 歌曲评论 |
| `like` | 喜欢/收藏歌曲 |
| `podcast` | 播客列表、播客详情、播客订阅 |
| `beatmap` | 节奏分析、DJ 模式数据 |
| `weather` | Open-Meteo 天气数据、天气电台队列生成 |
| `update` | GitHub 版本检测、安装包下载 |
| `proxy` | 音频代理、媒体资源代理 |
| `static_files` | 前端静态资源服务 |

---

## 更新机制

Mineradio-Next 通过 GitHub Releases API 检测新版本。当远端版本高于本地版本时，应用内更新入口会展示 Release 内容，支持下载安装包到本机用户数据目录并通过系统打开安装包。下载过程支持国内加速镜像自动切换、digest 校验和断点续传。

## 第三方音乐平台说明

Mineradio-Next **不是**网易云音乐、QQ 音乐或腾讯音乐娱乐集团的官方客户端，也不隶属于任何音乐平台。项目中的第三方平台接入仅用于个人学习、本地客户端体验和用户自有账号的播放辅助。请遵守对应平台的用户协议、版权规则和会员权益规则。

## 用户数据与隐私

登录 Cookie、搜索历史、自定义封面、自定义歌词、节奏分析缓存等数据仅保存在本机用户数据目录或浏览器本地存储中，不会提交到代码仓库。更多说明见 [PRIVACY.md](./PRIVACY.md)。

---

## 致谢

### 原作者

Mineradio 由 **XxHuberrr** 主要设计与打造，是本项目的基础和灵感来源。emily 作为早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此感谢。

同时感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。

### 二次开发

Mineradio-Next 由 **zhanghaifei1997** 维护，主要进行 Tauri v2 + Rust 架构迁移和功能扩展。

## 版权与授权

- Mineradio 原始项目：Copyright (C) 2026 XxHuberrr. GPL-3.0 License.
- Mineradio-Next 二次开发：Copyright (C) 2026 zhanghaifei1997. 同样遵循 GPL-3.0 License.

详见 [LICENSE](./LICENSE) 和 [NOTICE.md](./NOTICE.md)。

Mineradio 名称、MR Logo、界面视觉设计与原创视觉表达归原作者 XxHuberrr 所有；二次开发新增部分归 zhanghaifei1997 所有。第三方依赖和第三方服务分别遵循其各自授权与服务条款。
