# MarkdownDaoNote

> 跨平台 Markdown 桌面客户端，基于 Go 1.22 + Wails 2 与 Editor.md 组合打造，主打本地文件工作流、实时预览与多标签笔记体验。

[TOC]
## 产品概览

MarkdownDaoNote 聚焦于为开发者与知识工作者提供轻量却完整的 Markdown 写作体验。应用通过 Wails 将 Go 后端与基于 Vite 的前端整合成原生窗口程序，提供文件树浏览、多标签编辑、主题切换以及设置持久化等能力，适合在 macOS、Windows、Linux 上构建私有知识库或快速记录工作笔记。

### 核心特性

- **Editor.md 实时预览体验**：内置 Editor.md，默认启用分屏预览、代码高亮与目录侧栏，可根据主题偏好自定义编辑器、预览与工具栏主题。
- **多标签管理**：同一窗口内管理多个文档标签，支持右键关闭当前、关闭其它及关闭右侧标签，提升多文档切换效率。
- **本地文件工作流**：内置文件/文件夹选择器、树状浏览、按需创建/重命名/删除文件夹与 Markdown 文件，前后端通过 Wails 事件保持状态同步。
- **单实例与系统集成**：通过 Unix Socket/临时目录实现单实例守护，并将通过操作系统文件关联启动的路径传递给已运行窗口。
- **设置与日志持久化**：用户主题、自动保存、字号等配置保存在 OS 配置目录；运行日志写入与可执行文件同目录，便于排查问题。
- **自定义消息提示与菜单**：前端重写消息弹窗与菜单栏交互，结合 Wails 原生菜单实现「文件/主题/帮助」多级菜单与快捷键支持。

## 架构设计

MarkdownDaoNote 采用「Go 后端 + 前端 SPA」的典型 Wails 架构，后端负责文件系统访问、系统对话框与应用生命周期，前端负责渲染与富交互逻辑。

### 技术栈

- **后端**：Go 1.22、Wails 2.10，使用标准库访问文件系统并通过 `runtime.Events*` 与前端通信。
- **前端**：Vite + TypeScript + Editor.md，使用 mitt 作为事件总线，Tailwind Utility 类构建界面，Wails 自动生成的 `wailsjs` 绑定负责调用 Go 方法。
- **打包**：Wails 打包为原生应用，支持在 `build/` 目录下的图标资源与脚本生成平台安装包。

### 模块结构

| Module | Key Files | Responsibilities |
| --- | --- | --- |
| App Entry | `main.go`, `assets_embed.go` | Initialize logging, handle startup parameters, register Wails lifecycle hooks and provide embedded frontend resources |
| Backend Bindings | `internal/app/*.go` | Build menus, handle file/folder operations, save documents, theme broadcasting, single instance daemon and event sending |
| Persistence Services | `internal/services/files.go`, `internal/services/settings.go` | Encapsulate file system CRUD, atomic settings saving, provide default values |
| Frontend Logic | `frontend/src/components/EditorApp.ts` | Initialize UI skeleton, load Editor.md resources, manage tabs/file tree/status bar, listen to Wails events |
| Frontend API | `frontend/src/services/api.ts` | Encapsulate async calls and type declarations with Go bindings, manage default settings |
| Build Config | `wails.json`, `frontend/vite.config.ts`, `scripts/*.sh` | Define build output, frontend packaging commands, development helper scripts |

### 事件和数据流

1. **App Startup**: `main.go` parses the first Markdown path passed by Shell, instantiates `app.App`, and runs the Wails application.
2. **Single Instance Detection**: `app.App.Startup` calls `SingleInstanceManager`, if an existing instance is detected, sends the path through Socket and exits.
3. **Frontend Preparation**: `EditorApp.bootstrap` loads resources, renders UI, and sends `editor:ready` to backend when Editor.md onload, triggering backend to push files to be opened.
4. **Bidirectional Events**: File/folder dialogs, save requests, theme switching, etc., are all broadcast through `runtime.EventsEmit` and `EventsOn`, achieving frontend-backend state synchronization.

## 关键目录

```text
.
├── main.go                     # Wails entry point and window configuration
├── assets_embed.go             # Embedded built frontend static resources
├── internal/
│   ├── app/                    # App bindings, menus, file tree, storage logic
│   ├── services/               # File and settings services
│   └── models/                  # Shared model definitions
├── frontend/
│   ├── src/components/         # EditorApp and UI interaction code
│   ├── src/services/           # API wrappers for backend interaction
│   └── vite.config.ts          # Frontend build configuration
├── scripts/                    # Development and packaging helper scripts
├── build/                      # Platform icons and packaging placeholders
└── wails.json                  # Wails project configuration
```

## 快速开始

### 1. 环境要求

- Go 1.22+
- Node.js 18+ / pnpm/npm
- Wails CLI：`go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### 2. 安装依赖

```bash
go mod tidy
cd frontend && npm install
```

### 3. 启动开发环境

- 常规环境：`wails dev`
- WSL 等 `/tmp` 被挂载为 `noexec` 的环境：使用 `./scripts/wails-dev.sh` 以定制 `TMPDIR`（`scripts/wails-dev.sh:5-13`）。

前端与后端代码改动会由 Wails 自动热更新；如需仅构建前端资源可运行 `npm run build -- --watch`。

## 构建与发布

```bash
# 生成前端静态资源
cd frontend && npm run build

# 回到仓库根目录，生成最终桌面应用
wails build
```

- 构建产物默认输出在 `build/bin/`，可结合 `scripts/package.sh`、`scripts/installer.nsi` 针对不同平台进一步封装安装包。

## 贡献指南

1. Fork & 创建特性分支 (`git checkout -b feature/your-feature`)。
2. 与后端/前端交互保持接口同步，必要时更新 `frontend/src/services/api.ts` 的类型定义。
3. 提交前运行 `npm run build` 与 `wails build` 验证打包是否通过。
4. 发起 Pull Request，并在描述中说明改动对前端事件或设置文件格式的影响。

欢迎补充单元测试、改进多语言支持或增强快捷键映射。

## 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

### 许可证条款

- ✅ **商业使用**：允许在商业项目中使用
- ✅ **修改**：允许修改源代码
- ✅ **分发**：允许重新分发
- ✅ **私人使用**：允许私人使用
- ✅ **专利使用**：允许专利使用

### 使用要求

- 📋 **保留版权声明**：必须在所有副本中保留版权声明和许可证声明
- 📋 **包含许可证**：分发时必须包含完整的 MIT License 文本

### 免责声明

本软件按"原样"提供，不提供任何形式的保证。作者不对使用本软件造成的任何损害承担责任。

---

**Copyright (c) 2025 MarkdownDaoNote Team**
