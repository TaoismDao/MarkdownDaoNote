# GitHub Release 权限问题修复

## 🐛 问题

GitHub Actions 尝试创建 Release 时失败，错误信息：

```
⚠️ GitHub release failed with status: 403
undefined
retrying... (2 retries remaining)
...
❌ Too many retries. Aborting...
Error: Too many retries.
```

## 🔍 问题原因

**HTTP 403 错误** = 权限拒绝 (Forbidden)

### 根本原因

GitHub Actions 的默认 `GITHUB_TOKEN` **没有足够的权限**来创建 Release。

从 2023 年开始，GitHub 对 Actions 的权限模型进行了更改：
- **旧行为**: 默认拥有读写权限
- **新行为**: 默认只有读权限（更安全）
- **需要**: 显式声明所需权限

## ✅ 解决方案

在 workflow 文件顶部添加 `permissions` 配置：

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

# 权限配置：允许创建 Release
permissions:
  contents: write  # 允许写入仓库内容（创建 Release）

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    # ...
```

## 📝 修改位置

**文件**: `.github/workflows/build.yml`

**位置**: 在 `on:` 触发条件之后，`jobs:` 之前

**修改前**:
```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:  # ← 直接开始 jobs
  release:
    # ...
```

**修改后**:
```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

# 权限配置：允许创建 Release
permissions:
  contents: write  # ← 添加这个

jobs:
  release:
    # ...
```

## 🔐 权限说明

### `contents: write` 允许的操作

- ✅ 创建 GitHub Release
- ✅ 上传 Release 资源文件
- ✅ 编辑 Release 描述
- ✅ 删除 Release
- ✅ 创建/修改/删除 tags
- ✅ 推送代码（如果需要）

### 其他可用权限

```yaml
permissions:
  contents: write       # 仓库内容（Release、Tags、代码）
  issues: write         # Issues
  pull-requests: write  # Pull Requests
  discussions: write    # Discussions
  packages: write       # GitHub Packages
  id-token: write       # OIDC token
```

### 最小权限原则

如果只需要创建 Release，只授予 `contents: write` 即可：

```yaml
permissions:
  contents: write  # 仅此即可创建 Release
```

## 🎯 验证修复

### 1. 推送修改

```bash
git add .github/workflows/build.yml
git commit -m "fix: 添加 GitHub Release 创建权限"
git push origin main
```

### 2. 重新触发 Release

#### 方式 A: 删除并重新创建 tag

```bash
# 删除远程 tag
git push --delete origin v1.0.1

# 删除本地 tag
git tag -d v1.0.1

# 重新创建 tag
git tag v1.0.1

# 推送 tag
git push origin v1.0.1
```

#### 方式 B: 创建新版本

```bash
# 创建新的版本 tag
git tag v1.0.2
git push origin v1.0.2
```

#### 方式 C: 手动触发（如果启用了 workflow_dispatch）

在 GitHub Actions 页面点击 "Run workflow"

### 3. 查看结果

访问 GitHub Actions 页面，查看 "Create Release" job：

**成功的标志**:
```
👩‍🏭 Creating new GitHub release for tag v1.0.1...
✅ Published release v1.0.1
```

然后在仓库的 Releases 页面应该能看到新创建的 Release。

## 🛡️ 安全性说明

### 这样安全吗？

✅ **是的，这是安全的**

- `permissions` 配置只影响**这个 workflow**
- 不影响仓库的其他设置
- 不影响其他 workflows
- GitHub Actions 的 token 在 workflow 执行完后自动失效

### 最佳实践

1. **最小权限原则**: 只授予必需的权限
   ```yaml
   permissions:
     contents: write  # 只授予 contents 写权限
   ```

2. **作业级权限**（更细粒度）:
   ```yaml
   jobs:
     release:
       permissions:
         contents: write  # 只给这个 job 权限
       runs-on: ubuntu-latest
   ```

3. **读权限可以省略**:
   ```yaml
   permissions:
     contents: write  # 自动包含读权限
   ```

## 📊 权限模型变更历史

| 时间 | GitHub Actions 默认权限 |
|------|------------------------|
| 2021年以前 | 读写权限（宽松） |
| 2021-2022 | 过渡期，可配置默认权限 |
| 2023年+ | **只读权限（严格）** ← 当前 |

## 🔗 相关问题

### 其他可能遇到 403 的场景

1. **推送代码**: 需要 `contents: write`
2. **创建 Pull Request**: 需要 `pull-requests: write`
3. **发布 Package**: 需要 `packages: write`
4. **关闭 Issue**: 需要 `issues: write`

### 仓库设置

除了 workflow 配置，还需要确保：

**Settings → Actions → General → Workflow permissions**

应该设置为：
- ✅ "Read and write permissions" (推荐)
- 或 "Read repository contents and packages permissions" + workflow 级 permissions 配置

## 📚 参考文档

- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
- [Workflow syntax for permissions](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions)
- [softprops/action-gh-release](https://github.com/softprops/action-gh-release)

## ✅ 验证清单

- [ ] 添加 `permissions: contents: write` 到 workflow
- [ ] 推送修改到 GitHub
- [ ] 删除旧 tag（如果需要）
- [ ] 重新创建 tag 或创建新版本
- [ ] 查看 Actions 运行日志
- [ ] 确认 Release 创建成功
- [ ] 检查 Release 页面是否有新 Release
- [ ] 验证所有构建产物已上传

## 🎉 总结

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| HTTP 403 错误 | 权限不足 | 添加 `permissions: contents: write` |
| Release 创建失败 | GITHUB_TOKEN 默认只读 | 显式授权写权限 |
| 重试全部失败 | 权限问题不会自动恢复 | 修改配置后重新运行 |

**关键修改**: 1 行代码
```yaml
permissions:
  contents: write
```

现在 Release 创建应该可以成功了！🚀

