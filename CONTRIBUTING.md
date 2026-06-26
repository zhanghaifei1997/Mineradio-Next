# 贡献指南

感谢您对 Mineradio Next 项目的关注！我们欢迎各种形式的贡献，包括但不限于：

- 🐛 提交 Bug 报告
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复或新功能
- 🎨 UI/UX 改进建议

## 代码规范

### 语言与框架

- 使用 TypeScript 编写代码
- 使用 Vue 3 Composition API
- 使用 Pinia 进行状态管理

### 代码风格

项目使用 ESLint 和 Prettier 来统一代码风格：

```bash
# 检查代码规范
pnpm lint:check

# 自动修复
pnpm lint

# 格式化代码
pnpm format
```

### 命名规范

- **组件**: PascalCase（如 `PlayerBar.vue`）
- **组合式函数**: camelCase，以 `use` 开头（如 `useLyrics.ts`）
- **Store**: camelCase，以 `store` 结尾（如 `playQueue.ts`）
- **工具函数**: camelCase
- **常量**: UPPER_SNAKE_CASE
- **类型/接口**: PascalCase

### Git 提交规范

请遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Type 类型：**

- `feat` - 新功能
- `fix` - 修复 Bug
- `docs` - 文档更新
- `style` - 代码风格调整（不影响功能）
- `refactor` - 重构
- `perf` - 性能优化
- `test` - 测试相关
- `ci` - CI/CD 相关
- `chore` - 构建工具或辅助工具的变动

**示例：**

```
feat(player): 添加播放速度调节功能

- 支持 0.5x - 2x 倍速播放
- 添加速度调节 UI 控件
- 持久化用户设置

Closes #123
```

## 开发流程

### 1. Fork 并克隆仓库

```bash
# Fork 本仓库后，克隆您的 fork
git clone https://github.com/your-username/Mineradio-Next.git
cd Mineradio-Next
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 创建功能分支

```bash
git checkout -b feature/your-feature-name
```

### 4. 开发与测试

```bash
# 启动开发模式
pnpm electron:dev

# 运行单元测试
pnpm test

# 运行类型检查
pnpm typecheck
```

### 5. 确保所有检查通过

提交 PR 前，请确保以下命令都能成功运行：

```bash
# 类型检查
pnpm typecheck

# 代码检查
pnpm lint:check

# 单元测试
pnpm test

# 构建测试
pnpm build:only
```

### 6. 提交更改

```bash
git add .
git commit -m "feat: 描述您的更改"
git push origin feature/your-feature-name
```

### 7. 发起 Pull Request

在 GitHub 上发起 Pull Request，并提供：

- 清晰的标题和描述
- 相关的 Issue 编号
- 截图或演示（如适用）
- 任何需要注意的事项

## 单元测试

为核心模块添加单元测试是非常棒的贡献！

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 查看覆盖率
pnpm test:coverage
```

### 测试规范

- 测试文件命名：`*.test.ts` 或 `*.spec.ts`
- 测试文件与源代码放在同一目录
- 使用 describe 组织测试用例
- 测试用例描述应清晰明确
- 覆盖正常场景和边界情况

## Issue 指南

### 提交 Bug 报告

提交 Bug 时，请包含以下信息：

- **操作系统**: Windows / macOS / Linux 及版本
- **Mineradio 版本**: 版本号或 commit hash
- **复现步骤**: 详细描述如何复现问题
- **预期行为**: 您期望的行为是什么
- **实际行为**: 实际发生了什么
- **截图/录屏**: 如有，请附上

### 提交功能建议

提交功能建议时，请说明：

- 功能描述
- 使用场景
- 预期效果
- 相关参考（如有）

## 行为准则

参与本项目时，请遵守以下准则：

- 尊重不同的观点和经验
- 友善且耐心地沟通
- 专注于对社区最有益的事情
- 接纳建设性的批评

## 获得帮助

如果您有任何问题或需要帮助，可以：

- 查看 [README.md](./README.md) 中的文档
- 搜索已有的 Issues 和 PR
- 提交新的 Issue

---

再次感谢您的贡献！🎉
