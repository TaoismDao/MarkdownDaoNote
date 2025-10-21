# GitHub Actions 工作流对比

## 文件对比

### 1. `build.yml` - 完整构建和发布

**触发条件**:
```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  workflow_dispatch:
```

**包含的构建**:
- ✅ macOS (Universal)
- ✅ Linux (包括 DEB 包)
- ✅ Windows
- ✅ 创建 GitHub Release（当有 tag 时）

**特点**:
- 全平台构建
- 自动发布
- 每次推送都会运行所有平台
- 构建时间较长（需要等待 3 个平台）

---

### 2. `build-macos-only.yml` - macOS 专用构建

**触发条件**:
```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'        # 忽略 Markdown 文件
      - 'docs/**'      # 忽略文档目录
  pull_request:
    branches: [main]
  workflow_dispatch:
```

**包含的构建**:
- ✅ macOS (Universal) 仅此一个平台

**特点**:
- 仅构建 macOS
- **忽略文档变更**（更新文档不会触发构建）
- 包含额外的调试步骤：
  - Verify Wails installation
  - Verify frontend dependencies
  - Verify build output
- 生成 DMG 和 ZIP 两种格式
- 构建速度快（只有一个平台）
- **不创建 Release**

---

## 重复的部分

两个工作流中的 macOS 构建步骤几乎相同：
1. ✅ Checkout 代码
2. ✅ Setup Go 和 Node.js
3. ✅ 安装 Wails
4. ✅ 构建前端
5. ✅ 准备图标
6. ✅ 构建 macOS App
7. ✅ 创建 DMG

---

## 是否应该删除 `build-macos-only.yml`？

### 方案 A：删除 ❌ (不推荐)

**优点**:
- 简化维护
- 避免重复配置

**缺点**:
- ❌ 每次更新文档也会触发完整构建（浪费 CI 资源）
- ❌ 无法快速测试 macOS 构建（需要等待其他平台）
- ❌ 失去详细的调试输出

### 方案 B：保留两者 ✅ (当前状态)

**优点**:
- ✅ 文档变更不会触发构建
- ✅ 可以独立测试 macOS 构建
- ✅ 有额外的调试信息

**缺点**:
- 需要维护两个文件
- 可能同时运行（重复消耗 CI 分钟数）

### 方案 C：合并优化 ⭐ (推荐)

**建议**: 将 `build-macos-only.yml` 的优点合并到 `build.yml` 中，然后删除前者。

---

## 推荐方案：优化 `build.yml`

### 改进 1: 添加 paths-ignore

```yaml
on:
  push:
    branches:
      - main
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.github/**.md'  # 忽略 GitHub 文档
  tags:
    - 'v*'  # tag 推送仍然触发（用于发布）
```

### 改进 2: 添加调试步骤到 macOS job

在 `build.yml` 的 macOS 构建中添加验证步骤（已完成）。

### 改进 3: 添加条件发布

```yaml
- name: Create Release
  if: startsWith(github.ref, 'refs/tags/v')  # 只在打 tag 时创建发布
```

---

## 最终建议

### ✅ 推荐做法

1. **优化 `build.yml`**: 添加 `paths-ignore` 配置
2. **删除 `build-macos-only.yml`**: 功能已被主工作流覆盖
3. **保留调试特性**: 确保主工作流也有足够的调试信息

### 实施步骤

1. 更新 `build.yml` 添加 `paths-ignore`
2. 确认调试步骤已在 `build.yml` 中
3. 测试一次完整构建
4. 删除 `build-macos-only.yml`

---

## 特殊情况保留

如果您经常需要**快速测试 macOS 构建**而不想等待其他平台，可以：

### 选项 1: 保留但重命名

将 `build-macos-only.yml` 改为**手动触发**：

```yaml
name: Test macOS Build (Manual)

on:
  workflow_dispatch:  # 仅手动触发
```

这样它不会自动运行，但需要时可以手动触发。

### 选项 2: 完全删除

依赖主工作流 `build.yml` 的 `workflow_dispatch` 手动触发。

---

## 总结

| 方案 | 维护成本 | CI 效率 | 推荐度 |
|------|---------|---------|--------|
| 保留两者 | 高 | 中 | ⭐⭐ |
| 删除 macos-only | 低 | 低（没有 paths-ignore）| ⭐⭐ |
| **优化 build.yml 后删除** | **低** | **高** | **⭐⭐⭐⭐⭐** |
| 改为手动触发 | 中 | 高 | ⭐⭐⭐⭐ |

**最佳实践**: 优化主工作流后删除 macOS-only 工作流。

