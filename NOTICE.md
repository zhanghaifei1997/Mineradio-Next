# NOTICE

Mineradio-Next 是基于 [Mineradio](https://github.com/XxHuberrr/Mineradio) 的二次开发版本。

## Original Project

Mineradio 原项目由 **XxHuberrr** 设计与打造，采用 GPL-3.0 协议开源。原仓库地址：[https://github.com/XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)。

原作者创造了 Mineradio 的产品表达、界面视觉设计、粒子视觉体验、3D 歌单架交互、电影镜头系统以及整体音乐播放器的核心体验。Mineradio-Next 在此优秀基础上进行 Tauri v2 + Rust 架构迁移和功能演进，向原作者 XxHuberrr 致以诚挚的敬意和感谢。

## Secondary Development

Mineradio-Next 二次开发由 **zhanghaifei1997** 维护，仓库地址：[https://github.com/zhanghaifei1997/Mineradio-Next](https://github.com/zhanghaifei1997/Mineradio-Next)。

主要二次开发内容包括：

- 从 Electron 迁移至 Tauri v2 + Rust 架构
- Rust 重写网易云 API 后端和 HTTP server
- 新增 macOS 跨平台支持
- 新增点云预设系统
- WebGL 粒子视觉升级

本项目遵循原项目 GPL-3.0 协议，详见 [LICENSE](./LICENSE)。

## Third-party Libraries

- Tauri v2
- Electron（兼容层保留）
- Three.js
- GSAP
- music-tempo
- NeteaseCloudMusicApi
- mpg123-decoder
- Actix-web（Rust HTTP server）

## Third-party Services

Mineradio-Next 可能与网易云音乐、QQ 音乐等第三方音乐服务进行用户自有账号相关的本地客户端交互。

Mineradio-Next 不是任何音乐平台的官方客户端，也不隶属于网易云音乐、QQ 音乐或腾讯音乐娱乐集团。请用户自行遵守对应平台的服务协议、版权规则和会员权益规则。

## Original Design Attribution

Mineradio 名称、MR Logo、界面视觉设计、启动动画方向、粒子视觉体验和电影镜头系统的产品表达属于原作者 XxHuberrr 的原创设计。

emily 作为 Mineradio 早期视觉底层想法与 `emily` 视觉预设改进方向的共创者和灵感来源之一，特此致谢。

感谢小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦在早期体验、测试反馈和发布准备中的帮助。
