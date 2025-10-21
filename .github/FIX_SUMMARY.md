# 🔧 修复说明

## 问题描述

GitHub Actions 构建失败，错误信息：
```
Build macOS Universal App
Process completed with exit code 1.
Build macOS Universal App
pattern frontend/dist/*: no matching files found
```

## 根本原因

`wails` 命令未在系统 PATH 中，导致构建命令无法执行。

## 修复内容

### 1. 添加 PATH 配置

**macOS 和 Linux:**
```yaml
- name: Add Go bin to PATH
  run: echo "$(go env GOPATH)/bin" >> $GITHUB_PATH
```

**Windows:**
```yaml
- name: Add Go bin to PATH
  run: echo "$(go env GOPATH)/bin" | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
  shell: pwsh
```

### 2. 添加验证步骤（仅 macOS）

```yaml
- name: Verify Wails installation
  run: |
    which wails
    wails version
```

### 3. 启用详细日志

所有构建命令添加 `-v 2` 参数：
```yaml
run: wails build -platform darwin/universal -v 2
```

## 修改的文件

- ✅ `.github/workflows/build.yml`
- ✅ `.github/workflows/build-macos-only.yml`
- ✅ `.github/TROUBLESHOOTING.md` (新增)

## 验证步骤

1. 提交并推送修改：
   ```bash
   git add .github/
   git commit -m "Fix: Add Go bin to PATH in GitHub Actions workflows"
   git push origin main
   ```

2. 访问 GitHub Actions 页面查看构建状态

3. 确认所有步骤显示绿色 ✓

## 预期结果

构建成功后，在 Artifacts 部分应该能看到：
- ✅ `MarkdownDaoNote-macos-app` (.app)
- ✅ `MarkdownDaoNote-macos-dmg` (.dmg)
- ✅ `MarkdownDaoNote-macos-zip` (.zip)
- ✅ `MarkdownDaoNote-linux` (binary + .deb)
- ✅ `MarkdownDaoNote-windows` (.exe)

## 如果仍然失败

查看 `.github/TROUBLESHOOTING.md` 获取详细的调试指南。

