# Build Resources

此目录存放 electron-builder 构建所需的资源文件。

## 需要的文件

- `icon.ico` - Windows 应用图标 (256x256, 多尺寸)
- `icon.png` - macOS/Linux 应用图标 (512x512)
- `installer.nsh` - NSIS 安装脚本自定义
- `installerHeader.bmp` - 安装程序头部图 (150x57)
- `installerSidebar.bmp` - 安装程序侧边栏图 (164x314)
- `after-pack.js` - 打包后钩子脚本

## 图标生成建议

使用 `electron-icon-builder` 或在线工具从一张 1024x1024 PNG 生成各平台图标：

```bash
npx electron-icon-builder --input=./icon.png --output=./build --flatten
```

## 当前状态

图标文件暂未提供，构建时会使用 Electron 默认图标。
