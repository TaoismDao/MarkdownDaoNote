# Linux 构建修复 - webkit2gtk 兼容性

## 问题描述

GitHub Actions 中 Linux 构建失败，错误信息：

```
Package webkit2gtk-4.0 was not found in the pkg-config search path.
Package 'webkit2gtk-4.0', required by 'virtual:world', not found
```

## 问题原因

**版本不匹配**：
- **Wails** 期望: `webkit2gtk-4.0`
- **Ubuntu 24.04** 提供: `webkit2gtk-4.1`

GitHub Actions 的 `ubuntu-latest` runner 现在使用 Ubuntu 24.04，该版本将 `webkit2gtk-4.0` 升级到了 `webkit2gtk-4.1`。

## 解决方案

在安装系统依赖后，创建符号链接将 `webkit2gtk-4.1` 映射到 `webkit2gtk-4.0`：

```yaml
- name: Create webkit2gtk symlink
  run: |
    # Ubuntu 24.04 使用 webkit2gtk-4.1，但 Wails 期望 webkit2gtk-4.0
    sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
                /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
    echo "✅ Created webkit2gtk-4.0 symlink"
```

## 修复位置

**文件**: `.github/workflows/build.yml`

**位置**: Linux 构建 job，安装系统依赖之后，安装 Wails 之前

## 完整的 Linux 依赖安装流程

```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libgtk-3-dev \
      libwebkit2gtk-4.1-dev \
      pkg-config \
      build-essential \
      imagemagick

- name: Create webkit2gtk symlink
  run: |
    sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
                /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
    echo "✅ Created webkit2gtk-4.0 symlink"

- name: Install Wails
  run: go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## 验证

构建成功的标志：

```
✓ Compiling application: Done
✓ Build complete
```

## 相关问题

这个问题也在本地 Ubuntu 25.10 环境中出现过，使用相同的方法解决。

**本地修复命令**：
```bash
sudo ln -s /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
           /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
```

## 为什么需要这个修复？

1. **Ubuntu 版本升级**: 新版 Ubuntu 将 webkit2gtk 从 4.0 升级到 4.1
2. **Wails 硬编码**: Wails v2 在编译时硬编码了对 `webkit2gtk-4.0` 的依赖
3. **向后兼容**: `webkit2gtk-4.1` 与 `4.0` 基本兼容，可以安全使用符号链接

## 长期解决方案

Wails v3 可能会更新这个依赖，或者提供配置选项。在此之前，符号链接是最简单可靠的解决方案。

## 测试环境

- ✅ **GitHub Actions**: `ubuntu-latest` (Ubuntu 24.04)
- ✅ **本地环境**: Ubuntu 25.10
- ✅ **包版本**: `libwebkit2gtk-4.1-dev`

## 状态

✅ **已修复** - 2025-10-21

构建应该可以正常完成。

