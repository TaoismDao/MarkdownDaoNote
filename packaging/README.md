# MarkdownDaoNote 打包说明

本目录包含了使用 NFPM 生成 DEB 包所需的配置和脚本文件。

## 文件说明

- `nfpm.yaml` - NFPM 主配置文件
- `markdowndaonote.desktop` - Linux 桌面应用程序启动器
- `postinstall.sh` - 安装后执行的脚本
- `preremove.sh` - 卸载前执行的脚本
- `prepare-icons.sh` - 准备不同尺寸图标的脚本

## 前置要求

### 1. 安装 NFPM

```bash
# 使用 Go 安装
go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest

# 或者使用 apt (Ubuntu 22.04+)
sudo apt-get install nfpm
```

### 2. 安装 ImageMagick（用于图标转换）

```bash
sudo apt-get install imagemagick
```

### 3. 创建 webkit2gtk 符号链接（Ubuntu 25.10）

```bash
sudo ln -s /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
           /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
```

## 构建 DEB 包

### 方法 1: 使用 Makefile（推荐）

```bash
# 一键构建 DEB 包（包含编译、准备图标、打包）
make deb
```

生成的 DEB 包位于：`build/packages/markdowndaonote_1.0.1_amd64.deb`

### 方法 2: 手动步骤

```bash
# 1. 编译应用程序
wails build

# 2. 准备图标文件
./packaging/prepare-icons.sh

# 3. 生成 DEB 包
nfpm package --packager deb --target ./build/packages/
```

## 安装 DEB 包

```bash
# 安装
sudo dpkg -i build/packages/markdowndaonote_1.0.1_amd64.deb

# 如果有依赖问题，运行：
sudo apt-get install -f
```

## 卸载

```bash
sudo apt-get remove markdowndaonote
```

## 测试

安装后，你可以：

1. 从应用程序菜单启动 MarkdownDaoNote
2. 在终端运行 `markdowndaonote`
3. 右键点击 .md 文件，选择"用 MarkdownDaoNote 打开"

## 自定义配置

### 修改版本号

编辑 `../nfpm.yaml`，修改 `version` 字段：

```yaml
version: "v1.0.2"
```

同时更新 `../Makefile` 中的 `VERSION` 变量。

### 修改维护者信息

编辑 `../nfpm.yaml`，修改 `maintainer` 字段：

```yaml
maintainer: "Your Name <your-email@example.com>"
```

### 添加额外的文件

在 `../nfpm.yaml` 的 `contents` 部分添加新的文件映射：

```yaml
contents:
  - src: ./path/to/source
    dst: /path/to/destination
    file_info:
      mode: 0644
```

## 故障排除

### 问题：找不到 nfpm 命令

**解决**：确保 `$GOPATH/bin` 在你的 PATH 中：

```bash
export PATH=$PATH:$(go env GOPATH)/bin
```

或将此行添加到 `~/.bashrc` 或 `~/.zshrc`。

### 问题：图标转换失败

**解决**：确保安装了 ImageMagick：

```bash
sudo apt-get install imagemagick
```

### 问题：构建失败，提示找不到 webkit2gtk-4.0

**解决**：创建符号链接（见前置要求第 3 步）

### 问题：DEB 包安装后无法启动

**检查**：

```bash
# 查看日志
journalctl -xe | grep markdowndaonote

# 手动运行查看错误
markdowndaonote
```

## 高级选项

### 构建多架构包

修改 `nfpm.yaml` 中的 `arch` 字段：

```yaml
arch: "arm64"  # 或 "armhf"
```

### 生成 RPM 包

```bash
nfpm package --packager rpm --target ./build/packages/
```

### 生成 Arch Linux 包

```bash
nfpm package --packager archlinux --target ./build/packages/
```

## 参考资料

- [NFPM 官方文档](https://nfpm.goreleaser.com/)
- [Desktop Entry 规范](https://specifications.freedesktop.org/desktop-entry-spec/latest/)
- [Debian 打包指南](https://www.debian.org/doc/manuals/maint-guide/)

