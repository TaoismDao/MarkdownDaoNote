# 快速开始：生成 DEB 包

## 一键构建

```bash
# 在项目根目录执行
make deb
```

这个命令会自动完成：
1. 编译应用程序
2. 生成图标文件
3. 安装 NFPM（如果需要）
4. 打包成 DEB

## 安装生成的包

```bash
sudo dpkg -i build/packages/markdowndaonote_1.0.1_amd64.deb
```

如果提示依赖问题：

```bash
sudo apt-get install -f
```

## 测试

```bash
# 命令行启动
markdowndaonote

# 或从应用程序菜单启动
```

## 卸载

```bash
sudo apt-get remove markdowndaonote
```

## 常见问题

### Q: make deb 失败，提示 "command not found: nfpm"

A: 确保 Go 的 bin 目录在 PATH 中：

```bash
export PATH=$PATH:$(go env GOPATH)/bin
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
```

### Q: 图标转换失败

A: 安装 ImageMagick：

```bash
sudo apt-get install imagemagick
```

### Q: 编译失败，提示找不到 webkit2gtk-4.0

A: 创建符号链接：

```bash
sudo ln -s /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc \
           /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.0.pc
```

然后重新运行 `make deb`。

