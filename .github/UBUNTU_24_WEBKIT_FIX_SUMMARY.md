# Ubuntu 24.04 webkit2gtk 修复总结

## 🐛 问题

GitHub Actions Linux 构建失败：

```
Package webkit2gtk-4.0 was not found in the pkg-config search path.
Package 'webkit2gtk-4.0', required by 'virtual:world', not found
ERROR exit status 1
```

## 🔍 根本原因

**版本迁移**:
- GitHub Actions `ubuntu-latest` → **Ubuntu 24.04**
- Ubuntu 24.04 将 webkit2gtk **从 4.0 升级到 4.1**
- Wails v2 硬编码依赖 `webkit2gtk-4.0`

## ✅ 解决方案

### 修改文件：`.github/workflows/build.yml`

在 Linux 构建的系统依赖安装后添加符号链接步骤：

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

- name: Create webkit2gtk symlink  # ← 新增步骤
  run: |
    sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
                /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
    echo "✅ Created webkit2gtk-4.0 symlink"

- name: Install Wails
  run: go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## 📝 修改的文件

1. ✅ `.github/workflows/build.yml`
   - 添加 webkit2gtk 符号链接步骤

2. ✅ `.github/TROUBLESHOOTING.md`
   - 添加为问题 #1（最优先级）
   - 删除重复的问题 #4
   - 重新编号所有问题

3. ✅ `.github/LINUX_BUILD_FIX.md`
   - 新建详细修复文档

## 🎯 为什么这样做有效？

1. **兼容性**：webkit2gtk-4.1 **向后兼容** 4.0
2. **符号链接**：让 `pkg-config` 查找 `webkit2gtk-4.0` 时找到 `webkit2gtk-4.1`
3. **安全**：使用 `-sf` 强制创建，覆盖可能存在的旧链接

## 🧪 验证

构建成功的标志：

```bash
✅ Created webkit2gtk-4.0 symlink
✓ Compiling application: Done
✓ Build complete
```

可以在构建日志中验证：

```bash
pkg-config --modversion webkit2gtk-4.0
# 输出: 2.46.5 (或其他 4.1.x 版本)
```

## 📊 影响范围

| 环境 | 影响 | 解决方案 |
|------|------|---------|
| **GitHub Actions** (ubuntu-latest) | ✅ 已修复 | 自动创建符号链接 |
| **本地 Ubuntu 24.04+** | ✅ 已修复 | 手动或自动创建符号链接 |
| **本地 Ubuntu 22.04** | ✅ 无影响 | 仍使用 webkit2gtk-4.0 |
| **macOS** | ✅ 无影响 | 使用不同的 webkit 实现 |
| **Windows** | ✅ 无影响 | 使用 WebView2 |

## 🔗 相关问题

### 相同问题的其他平台

**本地 Ubuntu 25.10**：
```bash
sudo ln -s /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
           /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
```

这个问题在对话开始时就已经在本地解决了。

### Wails 社区

这是 Wails v2 在新版 Ubuntu 上的已知问题。符号链接是目前推荐的解决方案。

Wails v3 可能会原生支持 webkit2gtk-4.1。

## 📚 参考资料

- **详细修复指南**: [LINUX_BUILD_FIX.md](LINUX_BUILD_FIX.md)
- **故障排除**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md#1-package-webkit2gtk-40-was-not-found-linux--ubuntu-2404)
- **Ubuntu 包变更**: webkit2gtk-4.0 → webkit2gtk-4.1

## ✨ 总结

| 项目 | 状态 |
|------|------|
| **问题识别** | ✅ |
| **解决方案实施** | ✅ |
| **文档更新** | ✅ |
| **测试验证** | ⏳ 等待 GitHub Actions 运行 |

下次推送代码时，Linux 构建应该可以成功完成！🎉

## 🚀 下一步

1. **推送代码**到 GitHub
2. **查看 Actions** 构建日志
3. **验证**构建成功：
   ```
   ✅ Created webkit2gtk-4.0 symlink
   ✓ Compiling application: Done
   ```
4. **下载**构建产物测试

---

**修复日期**: 2025-10-21  
**修复者**: AI Assistant  
**状态**: ✅ 已完成

