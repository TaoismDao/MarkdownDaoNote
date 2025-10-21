# GitHub Actions Workflows

本目录包含了 MarkdownDaoNote 项目的 CI/CD workflow 配置文件。

## 📋 Workflows 说明

### 1. `build.yml` - 多平台构建和发布

**触发条件：**
- 推送到 `main` 分支
- 创建版本标签（如 `v1.0.1`）
- Pull Request 到 `main` 分支
- 手动触发

**构建平台：**
- ✅ macOS (Universal Binary - Intel + Apple Silicon)
- ✅ Linux (x64 + DEB 包)
- ✅ Windows (x64)

**功能：**
- 自动构建所有平台
- 上传构建产物（保留 30 天）
- 创建标签时自动发布 Release

### 2. `build-macos-only.yml` - 仅构建 macOS

**触发条件：**
- 推送到 `main` 分支（忽略 Markdown 文件）
- Pull Request 到 `main` 分支
- 手动触发

**构建输出：**
- `MarkdownDaoNote.app` - 原始 App Bundle
- `MarkdownDaoNote-macos-universal.dmg` - DMG 安装包
- `MarkdownDaoNote-macos-universal.zip` - ZIP 压缩包

## 🚀 使用方法

### 自动构建

1. **推送代码到 main 分支**
   ```bash
   git push origin main
   ```
   → 自动触发构建，生成构建产物

2. **创建 Release**
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
   → 自动构建并创建 GitHub Release

### 手动触发

1. 访问 GitHub 仓库的 **Actions** 标签页
2. 选择要运行的 Workflow
3. 点击 **Run workflow** 按钮
4. 选择分支并点击 **Run workflow**

## 📦 下载构建产物

### 从 Actions 页面下载

1. 访问仓库的 **Actions** 页面
2. 点击最新的成功构建
3. 在 **Artifacts** 部分下载对应的文件：
   - `MarkdownDaoNote-macos` - macOS 应用
   - `MarkdownDaoNote-linux` - Linux 二进制和 DEB 包
   - `MarkdownDaoNote-windows` - Windows 可执行文件

### 从 Releases 下载

当推送标签时，会自动创建 Release：

1. 访问仓库的 **Releases** 页面
2. 下载对应平台的文件

## 🔧 自定义配置

### 修改 Go 版本

编辑 workflow 文件中的 `go-version`:

```yaml
- name: Setup Go
  uses: actions/setup-go@v5
  with:
    go-version: '1.22'  # 修改这里
```

### 修改 Node.js 版本

编辑 workflow 文件中的 `node-version`:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # 修改这里
```

### 修改构建平台

**macOS：**
```yaml
# Intel only
wails build -platform darwin/amd64

# Apple Silicon only
wails build -platform darwin/arm64

# Universal (推荐)
wails build -platform darwin/universal
```

**Linux：**
```yaml
# x64
wails build -platform linux/amd64

# ARM64
wails build -platform linux/arm64
```

**Windows：**
```yaml
# x64
wails build -platform windows/amd64

# ARM64
wails build -platform windows/arm64
```

## 📝 工作流详解

### macOS 构建流程

```
1. Checkout 代码
2. 安装 Go 1.22
3. 安装 Node.js 20
4. 安装 Wails CLI
5. 安装前端依赖 (npm ci)
6. 构建 Universal App
7. 创建 DMG 安装包
8. 创建 ZIP 压缩包
9. 上传构建产物
```

### Linux 构建流程

```
1. Checkout 代码
2. 安装 Go 和 Node.js
3. 安装系统依赖 (GTK3, WebKit2GTK 等)
4. 安装 Wails CLI 和 NFPM
5. 安装前端依赖
6. 构建应用程序
7. 生成图标文件
8. 打包 DEB 包
9. 上传构建产物
```

### Windows 构建流程

```
1. Checkout 代码
2. 安装 Go 和 Node.js
3. 安装 Wails CLI
4. 安装前端依赖
5. 构建应用程序
6. 上传构建产物
```

## 🔐 代码签名（可选）

### macOS 代码签名

要为 macOS app 添加代码签名和公证，需要：

1. **在 GitHub 仓库设置中添加 Secrets：**
   - `APPLE_DEVELOPER_ID`: 你的 Apple Developer ID
   - `APPLE_CERTIFICATE`: Base64 编码的证书
   - `APPLE_CERTIFICATE_PASSWORD`: 证书密码
   - `APPLE_ID`: Apple ID 邮箱
   - `APPLE_TEAM_ID`: Team ID
   - `APPLE_APP_PASSWORD`: App-specific 密码

2. **在 workflow 中添加签名步骤：**

```yaml
- name: Import Certificate
  uses: apple-actions/import-codesign-certs@v2
  with:
    p12-file-base64: ${{ secrets.APPLE_CERTIFICATE }}
    p12-password: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}

- name: Sign App
  run: |
    codesign --force --deep --sign "Developer ID Application: Your Name" \
      build/bin/MarkdownDaoNote.app

- name: Notarize App
  run: |
    xcrun notarytool submit build/bin/MarkdownDaoNote-macos-universal.dmg \
      --apple-id ${{ secrets.APPLE_ID }} \
      --team-id ${{ secrets.APPLE_TEAM_ID }} \
      --password ${{ secrets.APPLE_APP_PASSWORD }} \
      --wait
```

### Windows 代码签名

使用 Azure Code Signing 或其他签名服务。

## 🐛 故障排除

### 问题：macOS 构建失败，找不到 Wails

**解决：** 确保 `GOPATH/bin` 在 PATH 中：

```yaml
- name: Add GOPATH to PATH
  run: echo "$(go env GOPATH)/bin" >> $GITHUB_PATH
```

### 问题：Linux 构建失败，webkit2gtk-4.0 未找到

**解决：** 添加符号链接步骤：

```yaml
- name: Create webkit2gtk symlink
  run: |
    sudo ln -s /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
               /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
```

### 问题：前端依赖安装失败

**解决：** 使用 `npm ci` 而不是 `npm install`，并确保 `package-lock.json` 已提交。

### 问题：构建产物没有上传

**检查：**
1. 确保构建成功
2. 检查路径是否正确
3. 查看 Actions 日志

## 📊 构建状态徽章

在 `README.md` 中添加构建状态徽章：

```markdown
[![Build Status](https://github.com/TaoismDao/MarkdownDaoNote/workflows/Build%20and%20Release/badge.svg)](https://github.com/TaoismDao/MarkdownDaoNote/actions)
```

## 🔗 相关资源

- [Wails 文档](https://wails.io/docs/introduction)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [NFPM 文档](https://nfpm.goreleaser.com/)
- [create-dmg](https://github.com/create-dmg/create-dmg)

