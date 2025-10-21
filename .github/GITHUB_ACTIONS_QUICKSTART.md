# GitHub Actions 快速入门

## 🎯 目标

使用 GitHub Actions 自动构建 macOS、Linux 和 Windows 版本的 MarkdownDaoNote。

## 📋 准备工作

### 1. 确保文件已提交

```bash
# 添加 workflow 文件
git add .github/workflows/

# 提交更改
git commit -m "Add GitHub Actions workflows"

# 推送到 GitHub
git push origin main
```

### 2. 检查 GitHub 仓库设置

1. 访问仓库的 **Settings** → **Actions** → **General**
2. 确保 "Allow all actions and reusable workflows" 已启用
3. 确保 "Read and write permissions" 已启用（用于创建 Release）

## 🚀 开始构建

### 方式 1: 自动构建（推荐）

**推送代码即可触发构建：**

```bash
git push origin main
```

→ GitHub Actions 会自动构建所有平台

### 方式 2: 手动触发

1. 访问 GitHub 仓库
2. 点击 **Actions** 标签页
3. 选择 **Build and Release** 或 **Build macOS App**
4. 点击 **Run workflow** 按钮
5. 选择分支（通常是 `main`）
6. 点击绿色的 **Run workflow** 按钮

### 方式 3: 创建 Release

**通过标签自动发布：**

```bash
# 创建标签
git tag v1.0.1

# 推送标签
git push origin v1.0.1
```

→ 自动构建并创建 GitHub Release

## 📥 下载构建产物

### 从 Actions 下载

1. 访问 **Actions** 页面
2. 点击最新的成功构建（绿色 ✓）
3. 滚动到页面底部的 **Artifacts** 部分
4. 下载你需要的平台：
   - **macOS**: `MarkdownDaoNote-macos-app`, `MarkdownDaoNote-macos-dmg`, `MarkdownDaoNote-macos-zip`
   - **Linux**: `MarkdownDaoNote-linux`
   - **Windows**: `MarkdownDaoNote-windows`

### 从 Releases 下载

如果你推送了标签（如 `v1.0.1`）：

1. 访问仓库的 **Releases** 页面
2. 找到对应版本
3. 下载 **Assets** 部分的文件

## 🎨 可用的 Workflows

### 1. Build and Release（完整版）
- **文件**: `.github/workflows/build.yml`
- **功能**: 构建 macOS、Linux、Windows 三个平台
- **输出**: App、DEB 包、DMG、ZIP、EXE

### 2. Build macOS App（简化版）
- **文件**: `.github/workflows/build-macos-only.yml`
- **功能**: 仅构建 macOS Universal App
- **输出**: App Bundle、DMG、ZIP

## 📊 查看构建状态

### 在仓库主页添加徽章

编辑 `README.md`，添加：

```markdown
[![Build Status](https://github.com/TaoismDao/MarkdownDaoNote/actions/workflows/build.yml/badge.svg)](https://github.com/TaoismDao/MarkdownDaoNote/actions)
```

### 监控构建

- 绿色 ✓ = 构建成功
- 红色 ✗ = 构建失败
- 黄色 ⏱ = 正在构建

点击可以查看详细日志。

## ⚡ 高级用法

### 仅构建特定平台

编辑 `.github/workflows/build.yml`，注释掉不需要的 job：

```yaml
jobs:
  build-macos:
    # ... (保留)
  
  # build-linux:    # 注释掉
  #   # ...
  
  # build-windows:  # 注释掉
  #   # ...
```

### 更改构建触发条件

```yaml
on:
  push:
    branches:
      - main
      - develop  # 添加其他分支
    tags:
      - 'v*'
```

### 禁用自动构建

如果只想手动触发，使用：

```yaml
on:
  workflow_dispatch:  # 仅手动触发
```

## 🐛 常见问题

### Q: Actions 没有运行？

**A**: 检查：
1. Workflow 文件是否在 `.github/workflows/` 目录
2. YAML 格式是否正确（使用在线 YAML 验证器）
3. GitHub Actions 是否在仓库设置中启用

### Q: 构建失败怎么办？

**A**: 
1. 点击失败的构建
2. 查看红色 ✗ 的步骤
3. 展开查看详细错误日志
4. 根据错误信息修复问题

### Q: 如何加速构建？

**A**:
1. 使用缓存（已在 workflow 中配置）
2. 减少构建平台数量
3. 使用 self-hosted runner（需要自己的服务器）

### Q: 构建产物保留多久？

**A**: 默认保留 30 天，可以在 workflow 中修改：

```yaml
- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    retention-days: 90  # 修改这里
```

## 📝 下一步

- ✅ 推送代码触发第一次构建
- ✅ 查看构建日志
- ✅ 下载并测试构建产物
- ✅ 创建第一个 Release（使用标签）
- ⭐ 为 macOS 添加代码签名（可选）
- ⭐ 添加自动化测试（可选）

## 🔗 更多信息

查看 `.github/workflows/README.md` 了解详细配置说明。

