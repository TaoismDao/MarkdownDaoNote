# GitHub Actions 故障排除

## ❌ 常见错误及解决方案

### 1. "Package webkit2gtk-4.0 was not found" (Linux) ⭐ Ubuntu 24.04+

**完整错误信息**：
```
Package webkit2gtk-4.0 was not found in the pkg-config search path.
Package 'webkit2gtk-4.0', required by 'virtual:world', not found
```

**错误原因**：
- Ubuntu 24.04+ 使用 `webkit2gtk-4.1`，而 Wails 期望 `webkit2gtk-4.0`
- GitHub Actions 的 `ubuntu-latest` 现在是 Ubuntu 24.04

**解决方案**：
在安装依赖后创建符号链接：

```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libgtk-3-dev \
      libwebkit2gtk-4.1-dev \
      pkg-config \
      build-essential

- name: Create webkit2gtk symlink
  run: |
    sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
                /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
```

**验证修复**：
```bash
pkg-config --modversion webkit2gtk-4.0
# 应该输出版本号，例如: 2.46.5
```

**详细说明**：参见 [LINUX_BUILD_FIX.md](LINUX_BUILD_FIX.md)

---

### 2. "pattern frontend/dist/*: no matching files found" ⭐ 最常见

**完整错误信息**：
```
Error: assets_embed.go:9:12: pattern frontend/dist/*: no matching files found
```

**错误原因**：
- **主要原因**：前端代码没有被构建，`frontend/dist/` 目录不存在
- 次要原因：Wails CLI 未在 PATH 中

**解决方案**：
在运行 `wails build` 之前必须先构建前端：

```yaml
- name: Install frontend dependencies
  working-directory: frontend
  run: npm ci

- name: Build frontend  # 👈 关键步骤
  working-directory: frontend
  run: npm run build

- name: Build application
  run: wails build
```

**为什么需要这个**：
Wails 使用 `//go:embed` 指令将前端文件嵌入到 Go 二进制文件中：
```go
//go:embed frontend/dist/*
var assets embed.FS
```

如果 `frontend/dist/` 不存在，Go 编译器会报错。

**验证修复**：
查看构建日志，应该能看到：
```
Building frontend...
Frontend build completed!
total 24
drwxr-xr-x  assets
-rw-r--r--  index.html
```

### 3. "Process completed with exit code 1"

**可能原因**：
1. Wails 命令未找到（见问题 1）
2. 前端依赖安装失败
3. 编译错误

**调试步骤**：

1. **检查 Wails 安装**：
   ```yaml
   - name: Verify Wails installation
     run: |
       which wails
       wails version
   ```

2. **检查前端依赖**：
   ```yaml
   - name: Verify frontend dependencies
     working-directory: frontend
     run: |
       echo "Node version: $(node --version)"
       echo "NPM version: $(npm --version)"
       ls -la node_modules/ | head -20
   ```

3. **启用详细构建日志**：
   ```yaml
   - name: Build application
     run: wails build -v 2  # -v 2 启用详细日志
   ```

### 4. macOS DMG 创建失败

**错误信息**：
```
create-dmg: command not found
```

**解决方案**：
DMG 创建步骤已设置为可选，不会导致整个构建失败：

```yaml
- name: Create DMG (optional)
  run: |
    brew install create-dmg
    create-dmg ... || {
      echo "⚠️  DMG creation failed, but app is still available"
    }
```

**替代方案**：
即使 DMG 创建失败，ZIP 包仍然可用。

### 5. Windows 构建失败

**常见问题**：
- PATH 设置语法不同

**解决方案**：
Windows 使用 PowerShell 语法：

```yaml
- name: Add Go bin to PATH
  run: echo "$(go env GOPATH)/bin" | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
  shell: pwsh
```

### 6. 前端依赖缓存问题

**错误信息**：
```
npm ERR! code EINTEGRITY
```

**解决方案**：
使用 `npm ci` 而不是 `npm install`：

```yaml
- name: Install frontend dependencies
  working-directory: frontend
  run: npm ci  # 使用 ci 而不是 install
```

如果仍然失败，清除缓存并重试：
1. 访问仓库 Settings → Actions → Caches
2. 删除所有缓存
3. 重新运行 workflow

### 7. 构建超时

**错误信息**：
```
The job running on runner ... has exceeded the maximum execution time of 360 minutes.
```

**解决方案**：

1. **分离平台构建**：使用单独的 workflow
2. **优化缓存**：确保 Go 和 npm 缓存启用
3. **减少构建步骤**：移除不必要的验证步骤

### 8. 上传 Artifacts 失败

**错误信息**：
```
Unable to find any artifacts for the associated workflow
```

**检查清单**：
1. 确保构建成功完成
2. 检查文件路径是否正确
3. 确认 `build/bin/` 目录存在

**调试**：
```yaml
- name: Debug build output
  run: |
    echo "Build directory contents:"
    find build -type f
```

## 🔍 调试技巧

### 查看详细日志

在 GitHub Actions 界面：
1. 点击失败的步骤
2. 展开查看完整输出
3. 搜索 "error" 或 "failed" 关键词

### 本地复现

在本地模拟 CI 环境：

```bash
# macOS
wails build -platform darwin/universal -v 2

# Linux
wails build -platform linux/amd64 -v 2

# Windows
wails build -platform windows/amd64 -v 2
```

### 启用 Debug 模式

在 workflow 中添加：

```yaml
- name: Enable debug logging
  run: |
    echo "ACTIONS_STEP_DEBUG=true" >> $GITHUB_ENV
    echo "ACTIONS_RUNNER_DEBUG=true" >> $GITHUB_ENV
```

### 检查构建产物

```yaml
- name: List build artifacts
  if: always()  # 即使构建失败也运行
  run: |
    echo "=== Build directory ==="
    ls -lhR build/ || echo "No build directory"
    echo "=== Frontend dist ==="
    ls -lh frontend/dist/ || echo "No dist directory"
```

## 📝 提交 Issue 时的信息清单

如果遇到无法解决的问题，提交 Issue 时请包含：

1. **错误信息**：完整的错误日志
2. **Workflow 文件**：相关的 `.yml` 文件内容
3. **运行链接**：GitHub Actions 运行的 URL
4. **本地测试**：本地构建是否成功
5. **环境信息**：
   - Go 版本
   - Node 版本
   - Wails 版本
   - 操作系统

## 🔄 最新修复（2024-10-21）

### 修复的问题
✅ **关键修复**：添加了前端构建步骤（`npm run build`）
✅ 修复了 "pattern frontend/dist/*: no matching files found" 错误
✅ 为所有平台添加了 Go bin PATH 配置
✅ 添加了详细的构建日志（-v 2）
✅ 添加了 Wails 安装验证步骤（macOS）

### 更新的文件
- `.github/workflows/build.yml` - 所有平台（macOS, Linux, Windows）
- `.github/workflows/build-macos-only.yml` - 仅 macOS
- `.github/TROUBLESHOOTING.md` - 故障排除文档
- `.github/FIX_SUMMARY.md` - 修复摘要

### 测试验证
推送代码后，构建应该能成功完成。查看 Actions 页面确认所有步骤都是绿色 ✓。

### 构建流程顺序
```
1. Checkout 代码
2. 安装 Go 和 Node.js
3. 安装 Wails CLI
4. 添加 Go bin 到 PATH
5. 安装前端依赖 (npm ci)
6. 🔑 构建前端 (npm run build)  ← 新增的关键步骤
7. 构建应用程序 (wails build)
8. 上传构建产物
```

## 📞 获取帮助

- [Wails 文档](https://wails.io/docs/guides/troubleshooting)
- [GitHub Actions 文档](https://docs.github.com/en/actions/learn-github-actions/understanding-github-actions)
- [项目 Issues](https://github.com/TaoismDao/MarkdownDaoNote/issues)

