# MarkdownDaoNote

[[English]](README.md)  
[[中文]](README.zh_cn.md)

> Cross-platform Markdown desktop client built with Go 1.22 + Wails 2 and Editor.md, focusing on local file workflows, real-time preview, and multi-tab note-taking experience.

[TOC]
## Product Overview

MarkdownDaoNote is designed to provide developers and knowledge workers with a lightweight yet complete Markdown writing experience. The application integrates Go backend with Vite-based frontend through Wails into a native window program, offering file tree browsing, multi-tab editing, theme switching, and settings persistence, suitable for building private knowledge bases or quick work notes on macOS, Windows, and Linux.

### Core Features

- **Editor.md Real-time Preview Experience**: Built-in Editor.md with default split-screen preview, syntax highlighting, and table of contents sidebar, customizable editor, preview, and toolbar themes.
- **Multi-tab Management**: Manage multiple document tabs within the same window, supporting right-click to close current, close others, and close tabs to the right, improving multi-document switching efficiency.
- **Local File Workflow**: Built-in file/folder selectors, tree browsing, on-demand creation/renaming/deletion of folders and Markdown files, with frontend-backend state synchronization through Wails events.
- **Single Instance & System Integration**: Implements single instance daemon through Unix Socket/temporary directories, and forwards paths launched through OS file associations to the already running window.
- **Settings & Log Persistence**: User themes, auto-save, font size, and other configurations saved in OS config directory; runtime logs written to the same directory as the executable for easy troubleshooting.
- **Custom Message Dialogs & Menus**: Frontend overrides message popups and menu bar interactions, combined with Wails native menus to implement "File/Theme/Help" multi-level menus and shortcut key support.

## Architecture Design

MarkdownDaoNote adopts the typical Wails architecture of "Go backend + frontend SPA", where the backend handles file system access, system dialogs, and application lifecycle, while the frontend handles rendering and rich interaction logic.

### Tech Stack

- **Backend**: Go 1.22, Wails 2.10, using standard library for file system access and communicating with frontend through `runtime.Events*`.
- **Frontend**: Vite + TypeScript + Editor.md, using mitt as event bus, Tailwind Utility classes for UI construction, Wails auto-generated `wailsjs` bindings for calling Go methods.
- **Packaging**: Wails packages as native applications, supporting icon resources and scripts in `build/` directory for platform-specific installers.

### Module Structure

| Module | Key Files | Responsibilities |
| --- | --- | --- |
| App Entry | `main.go`, `assets_embed.go` | Initialize logging, handle startup parameters, register Wails lifecycle hooks and provide embedded frontend resources |
| Backend Bindings | `internal/app/*.go` | Build menus, handle file/folder operations, save documents, theme broadcasting, single instance daemon and event sending |
| Persistence Services | `internal/services/files.go`, `internal/services/settings.go` | Encapsulate file system CRUD, atomic settings saving, provide default values |
| Frontend Logic | `frontend/src/components/EditorApp.ts` | Initialize UI skeleton, load Editor.md resources, manage tabs/file tree/status bar, listen to Wails events |
| Frontend API | `frontend/src/services/api.ts` | Encapsulate async calls and type declarations with Go bindings, manage default settings |
| Build Config | `wails.json`, `frontend/vite.config.ts`, `scripts/*.sh` | Define build output, frontend packaging commands, development helper scripts |

### Events & Data Flow

1. **App Startup**: `main.go` parses the first Markdown path passed by Shell, instantiates `app.App`, and runs the Wails application.
2. **Single Instance Detection**: `app.App.Startup` calls `SingleInstanceManager`, if an existing instance is detected, sends the path through Socket and exits.
3. **Frontend Preparation**: `EditorApp.bootstrap` loads resources, renders UI, and sends `editor:ready` to backend when Editor.md onload, triggering backend to push files to be opened.
4. **Bidirectional Events**: File/folder dialogs, save requests, theme switching, etc., are all broadcast through `runtime.EventsEmit` and `EventsOn`, achieving frontend-backend state synchronization.

## Key Directories

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

## Quick Start

### 1. Environment Requirements

- Go 1.22+
- Node.js 18+ / pnpm/npm
- Wails CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### 2. Install Dependencies

```bash
go mod tidy
cd frontend && npm install
```

### 3. Start Development Environment

- Regular environment: `wails dev`
- WSL and other environments where `/tmp` is mounted as `noexec`: use `./scripts/wails-dev.sh` to customize `TMPDIR`.

Frontend and backend code changes will be automatically hot-reloaded by Wails; if you only need to build frontend resources, run `npm run build -- --watch`.

## Build & Release

```bash
# Generate frontend static resources
cd frontend && npm run build

# Return to repository root, generate final desktop application
wails build
```

- Build artifacts are output to `build/bin/` by default, can be combined with `scripts/package.sh`, `scripts/installer.nsi` for further packaging installers on different platforms.

## Configuration & Data Persistence

- **User Settings**: Saved in `${UserConfigDir}/markdownpad/settings.json`, containing theme, auto-save, font size, and other parameters.
- **Log Output**: Runtime logs written to `MarkdownDaoNote.log` in the same directory as the executable for easy problem identification.
- **Temporary Files**: Development mode uses `.tmp/wails` as temporary directory to avoid permission issues.

## Common Issues

- **Second Launch Not Working**: If the app doesn't respond to file parameters from the second instance, check if the single instance Socket is writable; you can delete `${TMPDIR}/MarkdownDaoNote.sock` (Windows: `%TEMP%\MarkdownDaoNote.sock`) and retry.
- **Frontend Resources Missing**: Ensure `npm run build` has been executed, or let Wails automatically build in development mode. Backend will fallback to disk `frontend/dist` when resources are missing.
- **Save Dialog Not Appearing**: Confirm that a file has been opened/created in the menu; the `Save` command will force a "Save As" dialog when there's no active file.

## Contributing

1. Fork & create feature branch (`git checkout -b feature/your-feature`).
2. Keep frontend/backend interaction interfaces synchronized, update type definitions in `frontend/src/services/api.ts` when necessary.
3. Run `npm run build` and `wails build` before committing to verify packaging passes.
4. Create Pull Request and describe the impact of changes on frontend events or settings file format in the description.

Welcome to add unit tests, improve multi-language support, or enhance shortcut key mappings.

## License

This project is licensed under the [MIT License](LICENSE).

### License Terms

- ✅ **Commercial Use**: Allowed for use in commercial projects
- ✅ **Modification**: Allowed to modify source code
- ✅ **Distribution**: Allowed to redistribute
- ✅ **Private Use**: Allowed for private use
- ✅ **Patent Use**: Allowed for patent use

### Usage Requirements

- 📋 **Retain Copyright Notice**: Must retain copyright notice and license statement in all copies
- 📋 **Include License**: Must include complete MIT License text when distributing

### Disclaimer

This software is provided "as is" without any form of warranty. The authors are not liable for any damages caused by using this software.

---

**Copyright (c) 2025 MarkdownDaoNote Team**
