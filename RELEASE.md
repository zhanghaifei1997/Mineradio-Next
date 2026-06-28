# 发布流程

## Mineradio-Next 发布说明

Mineradio-Next 基于 [Mineradio](https://github.com/XxHuberrr/Mineradio) 二次开发，从 Electron 迁移至 Tauri v2 + Rust 架构。发布流程与原项目类似，但构建方式不同。

GitHub 仓库：`https://github.com/zhanghaifei1997/Mineradio-Next`

## 发布前检查

- 确认 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 版本号正确。
- 确认 `.cookie`、`.qq-cookie`、`node_modules/`、`target/`、旧 `dist/` 没有进入 git。
- 运行 Rust 编译检查：`cd src-tauri; cargo check`。
- 运行前端语法检查：`node --check server.js`。
- 运行 Git 跟踪风险残留检查，确认没有跟踪可执行/脚本残留。
- 从当前源码执行 `cargo tauri build` 生成安装包。
- 生成并记录新安装包 SHA256。

## GitHub Release

Release tag：

```text
v1.1.1
```

Release 标题：

```text
Mineradio-Next v1.1.1
```

建议上传资产：

- Windows / macOS 安装包
- SHA256SUMS.txt

## 更新检测

应用会请求 GitHub Releases latest 检测新版本。

本地验证更新链路时，可以用临时 manifest：

```json
{
  "latestVersion": "1.1.1-test",
  "release": {
    "name": "Mineradio-Next v1.1.1-test",
    "downloadUrl": "http://127.0.0.1:3144/Mineradio-Next-1.1.1-Setup.exe",
    "notes": ["本地在线更新链路测试"]
  }
}
```
