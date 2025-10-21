# 应用图标配置说明

本文档说明了 MarkdownDaoNote 在各个平台上的图标配置。

## 图标文件位置

所有图标文件存储在 `assets/icons/` 目录中：

```
assets/icons/
├── icon.ico          # Windows 图标（源文件）
├── icon.png          # 主图标 PNG 格式（512x512 或更大）
├── icon.icns         # macOS 图标（从 icon.png 生成）
├── icon-16x16.png    # Linux 图标（多种尺寸）
├── icon-32x32.png
├── icon-48x48.png
├── icon-128x128.png
└── icon-256x256.png
```

## 各平台图标配置

### 1. Windows (.ico)

- **文件**: `assets/icons/icon.ico`
- **配置**: `wails.json` → `windows.icon`
- **格式**: ICO 格式，包含多种尺寸（16x16, 32x32, 48x48, 256x256）
- **使用**: Wails 构建时自动嵌入到可执行文件中

```json
{
  "windows": {
    "icon": "assets/icons/icon.ico"
  }
}
```

### 2. macOS (.icns)

- **文件**: `assets/icons/icon.icns`
- **配置**: `wails.json` → `darwin.icon`
- **格式**: ICNS 格式，包含多种尺寸和分辨率
- **生成**: 通过 `packaging/prepare-macos-icon.sh` 脚本从 `icon.png` 自动生成
- **使用**: 
  - Wails 构建时嵌入到 .app 包中
  - DMG 安装包的卷图标

#### macOS 图标生成流程

```bash
# 手动生成
make prepare-macos-icon

# 或直接运行脚本
./packaging/prepare-macos-icon.sh
```

**脚本功能**:
1. 从 `icon.png` 生成所需的各种尺寸（16x16, 32x32, 128x128, 256x256, 512x512，含 @2x 版本）
2. 使用 `iconutil`（macOS）或 `png2icns`（Linux）生成 .icns 文件
3. 支持从 `icon.ico` 自动转换到 `icon.png`（需要 ImageMagick）

**依赖工具**:
- macOS: `iconutil` (系统自带), `sips` (系统自带)
- Linux: `imagemagick`, `icnsutils` (可选)

```json
{
  "darwin": {
    "icon": "assets/icons/icon.icns"
  }
}
```

### 3. Linux (.png)

- **文件**: 多个 PNG 文件（不同尺寸）
- **配置**: 
  - `wails.json` → `linux.icon`: 主图标
  - `nfpm.yaml` → `contents`: DEB 包中的图标安装位置
- **格式**: PNG 格式，多种尺寸
- **生成**: 通过 `packaging/prepare-icons.sh` 脚本从 `icon.ico` 生成
- **使用**: 
  - Wails 构建时的应用图标
  - DEB 包安装到系统图标目录

#### Linux 图标生成流程

```bash
# 手动生成
make prepare-icons

# 或直接运行脚本
./packaging/prepare-icons.sh
```

**脚本功能**:
1. 从 `icon.ico` 提取并转换为不同尺寸的 PNG
2. 生成符合 Linux 桌面规范的图标尺寸

**DEB 包图标安装位置**:
```yaml
contents:
  - src: ./assets/icons/icon.png
    dst: /usr/share/pixmaps/markdowndaonote.png
  
  - src: ./assets/icons/icon-16x16.png
    dst: /usr/share/icons/hicolor/16x16/apps/markdowndaonote.png
  
  # ... 其他尺寸
```

```json
{
  "linux": {
    "icon": "assets/icons/icon.png"
  }
}
```

## GitHub Actions 自动化

### macOS 构建工作流

```yaml
- name: Prepare macOS icon
  run: |
    chmod +x packaging/prepare-macos-icon.sh
    ./packaging/prepare-macos-icon.sh || echo "⚠️  Icon preparation failed, continuing..."

- name: Build Universal macOS App
  run: wails build -platform darwin/universal -v 2

- name: Create DMG installer
  run: |
    if [ -f "assets/icons/icon.icns" ]; then
      VOLICON_PARAM="--volicon assets/icons/icon.icns"
    else
      VOLICON_PARAM=""
    fi
    
    create-dmg \
      --volname "MarkdownDaoNote" \
      $VOLICON_PARAM \
      ...
```

### Linux 构建工作流

```yaml
- name: Prepare icons
  run: |
    chmod +x packaging/prepare-icons.sh
    ./packaging/prepare-icons.sh

- name: Build DEB package
  run: |
    mkdir -p build/packages
    nfpm package --packager deb --target build/packages/
```

## 本地构建

### 完整构建（包含图标）

```bash
# macOS
make prepare-macos-icon
make build

# Linux
make prepare-icons
make deb

# Windows
# 直接使用 icon.ico，无需额外准备
make build
```

## 图标规范

### 推荐尺寸

- **源图标**: 至少 512x512 PNG（建议 1024x1024）
- **Windows ICO**: 16, 32, 48, 256 像素
- **macOS ICNS**: 16, 32, 128, 256, 512 像素（含 @2x 版本）
- **Linux PNG**: 16, 32, 48, 128, 256 像素

### 设计建议

1. 使用正方形设计
2. 确保在小尺寸下仍然清晰可辨
3. 使用透明背景（PNG）
4. 避免过于复杂的细节
5. 考虑深色和浅色主题的显示效果

## 故障排除

### macOS 图标无法生成

**问题**: `iconutil: command not found`

**解决方案**: 
- macOS 上 `iconutil` 应该已预装
- 确保使用 macOS 系统构建（不是 Linux）
- 在 Linux 上，安装 `icnsutils`: `sudo apt-get install icnsutils`

### Linux 图标模糊

**问题**: 图标在某些尺寸下显示模糊

**解决方案**:
1. 确保源图标足够大（至少 512x512）
2. 重新运行 `./packaging/prepare-icons.sh`
3. 检查生成的 PNG 文件质量

### Windows 图标未显示

**问题**: 编译后的 .exe 文件没有图标

**解决方案**:
1. 检查 `wails.json` 中的 `windows.icon` 路径
2. 确保 `icon.ico` 文件存在且格式正确
3. 清理并重新构建: `wails build -clean`

## 相关文件

- `wails.json`: Wails 构建配置（所有平台图标路径）
- `nfpm.yaml`: Linux DEB 包配置（图标安装位置）
- `packaging/prepare-icons.sh`: Linux 图标生成脚本
- `packaging/prepare-macos-icon.sh`: macOS 图标生成脚本
- `.github/workflows/build.yml`: 主构建工作流
- `.github/workflows/build-macos-only.yml`: macOS 专用构建工作流

## 更新图标

如果需要更新应用图标：

1. 替换 `assets/icons/icon.ico`（Windows 源文件）
2. 或者替换 `assets/icons/icon.png`（macOS/Linux 源文件）
3. 运行图标生成脚本:
   ```bash
   # Linux 图标
   ./packaging/prepare-icons.sh
   
   # macOS 图标
   ./packaging/prepare-macos-icon.sh
   ```
4. 重新构建应用

## 总结

| 平台 | 图标文件 | 配置位置 | 生成脚本 |
|------|---------|---------|----------|
| Windows | `icon.ico` | `wails.json` → `windows.icon` | 无（手动准备） |
| macOS | `icon.icns` | `wails.json` → `darwin.icon` | `prepare-macos-icon.sh` |
| Linux | `icon-*.png` | `wails.json` → `linux.icon` + `nfpm.yaml` | `prepare-icons.sh` |

所有平台的图标都已正确配置，构建时会自动应用。

