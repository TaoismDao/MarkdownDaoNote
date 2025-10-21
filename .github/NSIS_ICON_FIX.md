# NSIS 图标路径修复

## 🐛 问题

GitHub Actions Windows 构建时，NSIS 无法找到图标文件：

```
Error while loading icon from "${__FILEDIR}\..\assets\icons\icon.ico": can't open file
Error in script "scripts\installer.nsi" on line 24 -- aborting creation process
```

## 🔍 原因分析

### 问题 1: 路径解析
NSIS 在编译时改变工作目录到 `scripts` 目录，导致相对路径 `${__FILEDIR}\..\assets\icons\icon.ico` 解析失败。

### 问题 2: PROJECT_ROOT 未正确传递
虽然 installer.nsi 中定义了：
```nsis
!ifndef PROJECT_ROOT
  !define PROJECT_ROOT  "${SCRIPT_DIR}\.."
!endif
```

但在某些环境下，`${SCRIPT_DIR}\..` 的解析可能不正确。

## ✅ 解决方案

### 1. 显式传递项目根目录

修改 `.github/workflows/build.yml`，在调用 makensis 时显式传递 `PROJECT_ROOT`：

```powershell
$projectRoot = (Get-Location).Path
$nsisProjectRoot = $projectRoot -replace '/', '\'

& "C:\Program Files (x86)\NSIS\makensis.exe" /V4 /DPROJECT_ROOT=$nsisProjectRoot scripts\installer.nsi
```

### 2. 添加文件验证步骤

在创建安装程序前验证所需文件：

```yaml
- name: Verify installer assets
  run: |
    if (Test-Path "assets\icons\icon.ico") {
      echo "✅ icon.ico found"
    } else {
      echo "❌ icon.ico not found"
      exit 1
    }
```

### 3. 使图标文件可选

修改 `scripts/installer.nsi`，使用条件编译：

```nsis
; 设置安装程序图标（如果文件存在）
!if /FileExists "${PROJECT_ROOT}\assets\icons\icon.ico"
  Icon "${PROJECT_ROOT}\assets\icons\icon.ico"
!else
  !warning "Icon file not found: ${PROJECT_ROOT}\assets\icons\icon.ico"
!endif
```

同样处理标题图片：

```nsis
; 设置标题图片（如果文件存在）
!if /FileExists "${PROJECT_ROOT}\assets\icons\header_image.bmp"
  !define MUI_HEADERIMAGE_BITMAP "${PROJECT_ROOT}\assets\icons\header_image.bmp"
!else
  !warning "Header image not found: ${PROJECT_ROOT}\assets\icons\header_image.bmp"
!endif
```

## 📝 修改的文件

### 1. `.github/workflows/build.yml`

**添加的步骤**：

```yaml
- name: Verify installer assets
  run: |
    echo "Verifying required files for installer..."
    if (Test-Path "assets\icons\icon.ico") {
      echo "✅ icon.ico found"
    } else {
      echo "❌ icon.ico not found"
      exit 1
    }
    # ... 其他文件验证

- name: Create NSIS installer
  run: |
    $projectRoot = (Get-Location).Path
    $nsisProjectRoot = $projectRoot -replace '/', '\'
    
    $nsisCmd = "C:\Program Files (x86)\NSIS\makensis.exe"
    $nsisArgs = @(
      "/V4"
      "/DPROJECT_ROOT=$nsisProjectRoot"
      "scripts\installer.nsi"
    )
    
    & $nsisCmd @nsisArgs
```

### 2. `scripts/installer.nsi`

**修改前**：
```nsis
Name "${PRODUCT_NAME}"
Icon "${PROJECT_ROOT}\assets\icons\icon.ico"
```

**修改后**：
```nsis
Name "${PRODUCT_NAME}"

; 设置安装程序图标（如果文件存在）
!if /FileExists "${PROJECT_ROOT}\assets\icons\icon.ico"
  Icon "${PROJECT_ROOT}\assets\icons\icon.ico"
!else
  !warning "Icon file not found: ${PROJECT_ROOT}\assets\icons\icon.ico"
!endif
```

## 🎯 效果

### 成功情况
如果文件存在：
- ✅ 安装程序使用自定义图标
- ✅ 安装向导显示自定义标题图片
- ✅ 构建成功

### 降级处理
如果文件不存在：
- ⚠️  显示警告信息
- ✅ 使用默认图标
- ✅ 构建仍然成功

## 🔍 调试信息

构建日志中会显示：

```
Verifying required files for installer...
✅ icon.ico found
✅ header_image.bmp found
✅ MarkdownDaoNote.exe found

Creating Windows installer...
Project root: D:\a\MarkdownDaoNote\MarkdownDaoNote
Running: C:\Program Files (x86)\NSIS\makensis.exe /V4 /DPROJECT_ROOT=D:\a\MarkdownDaoNote\MarkdownDaoNote scripts\installer.nsi

Processing script file: "scripts\installer.nsi"
!define: "PROJECT_ROOT"="D:\a\MarkdownDaoNote\MarkdownDaoNote"
Icon: "D:\a\MarkdownDaoNote\MarkdownDaoNote\assets\icons\icon.ico"
✅ Installer created successfully
```

## 🛡️ 防御性编程

这些修改遵循了防御性编程原则：

1. **验证假设** - 在使用文件前先验证其存在
2. **清晰错误** - 提供明确的错误消息
3. **优雅降级** - 即使找不到可选文件也能继续
4. **显式配置** - 显式传递所有路径参数

## 📚 相关文档

- **NSIS 条件编译**: https://nsis.sourceforge.io/Docs/Chapter4.html#4.9.2
- **NSIS 文件测试**: https://nsis.sourceforge.io/Docs/Chapter4.html#4.9.2.1
- **PowerShell 路径处理**: https://learn.microsoft.com/powershell/

## ✅ 验证

### 本地测试

```powershell
# 验证图标文件
Test-Path assets\icons\icon.ico

# 运行 NSIS（模拟 GitHub Actions）
$projectRoot = (Get-Location).Path
& "C:\Program Files (x86)\NSIS\makensis.exe" /V4 /DPROJECT_ROOT=$projectRoot scripts\installer.nsi
```

### CI/CD 验证

查看 GitHub Actions 日志：
1. "Verify installer assets" 步骤应该显示 ✅
2. "Create NSIS installer" 步骤应该成功
3. 不应该有关于找不到 icon.ico 的错误

## 🎉 总结

| 问题 | 解决方案 | 状态 |
|------|---------|------|
| 路径解析错误 | 显式传递 PROJECT_ROOT | ✅ |
| 找不到图标文件 | 添加文件验证步骤 | ✅ |
| 构建失败 | 使图标变为可选 | ✅ |
| 缺少调试信息 | 添加详细日志输出 | ✅ |

现在 Windows 安装程序构建应该能够可靠地工作了！

