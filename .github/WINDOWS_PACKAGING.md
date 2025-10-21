# Windows 打包配置

## 📦 打包方式

Windows 平台使用 **NSIS (Nullsoft Scriptable Install System)** 创建安装程序。

## 🔧 配置文件

### `scripts/installer.nsi`

完整的 NSIS 安装脚本，包含：

#### 基本信息
```nsis
!define PRODUCT_NAME "MarkdownDao Note"
!define APP_NAME        "MarkdownDaoNote"
!define COMPANY_NAME    "Taoism Dao"
!define APP_VERSION     "1.0.1"
```

#### 安装功能

1. **主程序安装** (必选)
   - 复制可执行文件到 `Program Files`
   - 创建开始菜单快捷方式
   - 创建桌面快捷方式
   - 自动检测并安装 WebView2 Runtime
   - 写入卸载信息到注册表

2. **文件关联** (可选)
   - 关联 `.md` 文件
   - 关联 `.markdown` 文件
   - 设置自定义图标

3. **右键菜单** (可选)
   - 为所有文件添加"Open with MarkdownDaoNote"菜单项

#### WebView2 Runtime

安装程序会自动：
1. 检测系统是否已安装 WebView2 Runtime
2. 如果未安装，自动下载并安装（在线安装器）
3. 使用 Microsoft 官方下载链接

## 🚀 构建流程

### GitHub Actions 自动构建

`.github/workflows/build.yml` 中的 Windows 构建步骤：

```yaml
- name: Build application
  run: wails build -v 2

- name: Verify build output
  run: |
    ls build/bin/
    if (Test-Path "build/bin/MarkdownDaoNote.exe") {
      echo "✅ Executable created successfully"
    }

- name: Install NSIS
  run: choco install nsis -y

- name: Create NSIS installer
  run: |
    & "C:\Program Files (x86)\NSIS\makensis.exe" /V4 scripts\installer.nsi
    echo "✅ Installer created"

- name: Upload Windows artifacts
  uses: actions/upload-artifact@v4
  with:
    path: |
      build/bin/MarkdownDaoNote.exe
      build/bin/MarkdownDaoNote-*-installer.exe
```

### 本地构建

#### 前提条件

1. **安装 NSIS**
   - 下载: https://nsis.sourceforge.io/Download
   - 或使用 Chocolatey: `choco install nsis`

2. **已构建的应用**
   ```bash
   wails build
   ```

#### 构建安装程序

```bash
# 使用 NSIS 编译安装脚本
makensis /V4 scripts\installer.nsi

# 或者使用绝对路径
"C:\Program Files (x86)\NSIS\makensis.exe" /V4 scripts\installer.nsi
```

## 📋 输出文件

构建完成后，在 `build/bin/` 目录下会生成：

```
build/bin/
├── MarkdownDaoNote.exe                      # 可执行文件（绿色版）
└── MarkdownDaoNote-1.0.1-installer.exe      # NSIS 安装程序
```

## 🎯 发布内容

### Artifacts (每次构建)

- `MarkdownDaoNote.exe` - 独立可执行文件
- `MarkdownDaoNote-1.0.1-installer.exe` - 完整安装程序

### GitHub Release (打 tag 时)

自动上传到 Release：
- `MarkdownDaoNote-windows.exe` - 重命名的可执行文件
- `MarkdownDaoNote-1.0.1-installer.exe` - 安装程序

## 📁 所需文件

NSIS 脚本依赖以下文件：

```
project/
├── build/bin/MarkdownDaoNote.exe    # 由 Wails 构建
├── assets/icons/
│   ├── icon.ico                      # 应用图标
│   └── header_image.bmp              # 安装程序标题图片
└── scripts/installer.nsi             # NSIS 脚本
```

## 🔍 安装程序特性

### 用户体验

- ✅ 中文界面（简体中文）
- ✅ 自定义安装目录
- ✅ 可选组件安装
- ✅ 自动 WebView2 安装
- ✅ 创建快捷方式
- ✅ 完整卸载支持

### 文件关联

安装后，`.md` 和 `.markdown` 文件会：
- 显示 MarkdownDaoNote 图标
- 双击自动用 MarkdownDaoNote 打开
- 可以通过右键菜单"打开方式"选择

### 右键菜单

为任何文件添加"Open with MarkdownDaoNote"选项，方便快速打开。

## 🛠️ 自定义配置

### 修改版本号

编辑 `scripts/installer.nsi` 第 8 行：

```nsis
!define APP_VERSION     "1.0.1"  # 修改这里
```

### 修改公司名称

编辑第 7 行：

```nsis
!define COMPANY_NAME    "Taoism Dao"  # 修改这里
```

### 修改安装目录

编辑第 18 行：

```nsis
!define INSTALL_DIR     "$PROGRAMFILES\${APP_NAME}"  # 默认在 Program Files
```

### 禁用文件关联

注释掉 `installer.nsi` 中的 `SEC_ASSOC` 部分（第 97-112 行）

### 禁用右键菜单

注释掉 `installer.nsi` 中的 `SEC_CONTEXT` 部分（第 114-119 行）

## 🐛 常见问题

### 1. NSIS 找不到

**错误**: `makensis: command not found`

**解决**:
```bash
# 使用 Chocolatey 安装
choco install nsis -y

# 或下载安装
# https://nsis.sourceforge.io/Download
```

### 2. 找不到 icon.ico

**错误**: `Can't open: assets\icons\icon.ico`

**解决**: 确保在项目根目录运行 makensis

### 3. 安装程序无法运行

**原因**: 可能缺少 WebView2 Runtime

**解决**: 安装程序会自动下载安装，或手动下载：
https://developer.microsoft.com/microsoft-edge/webview2/

## 📊 构建结果验证

### 检查生成的文件

```bash
# 列出所有 exe 文件
ls build/bin/*.exe

# 应该看到两个文件:
# MarkdownDaoNote.exe
# MarkdownDaoNote-1.0.1-installer.exe
```

### 测试安装程序

1. 双击 `MarkdownDaoNote-1.0.1-installer.exe`
2. 按照向导完成安装
3. 检查开始菜单和桌面快捷方式
4. 尝试打开 `.md` 文件
5. 测试卸载功能

## 📚 相关文档

- **NSIS 官方文档**: https://nsis.sourceforge.io/Docs/
- **Wails 打包指南**: https://wails.io/docs/guides/packaging
- **WebView2 文档**: https://learn.microsoft.com/microsoft-edge/webview2/

## ✨ 总结

| 特性 | 状态 |
|------|------|
| 自动构建 | ✅ |
| NSIS 安装程序 | ✅ |
| 文件关联 | ✅ |
| 右键菜单 | ✅ |
| WebView2 自动安装 | ✅ |
| 卸载支持 | ✅ |
| GitHub Release | ✅ |

Windows 打包已完全配置！🎉

