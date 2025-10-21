#!/bin/bash
# 准备不同尺寸的图标文件
# 需要安装 ImageMagick: sudo apt-get install imagemagick

set -e

ICONS_DIR="$(dirname "$0")/../assets/icons"
mkdir -p "$ICONS_DIR"

# 检查是否安装了 ImageMagick
if ! command -v convert >/dev/null 2>&1; then
    echo "错误: 需要安装 ImageMagick"
    echo "运行: sudo apt-get install imagemagick"
    exit 1
fi

# 检查源图标文件
if [ ! -f "$ICONS_DIR/icon.ico" ]; then
    echo "错误: 找不到源图标文件 icon.ico"
    exit 1
fi

# 从 .ico 文件提取并生成不同尺寸的 PNG
echo "正在生成图标文件..."

# 生成主图标
convert "$ICONS_DIR/icon.ico[0]" -resize 256x256 "$ICONS_DIR/icon.png"

# 生成不同尺寸的图标
convert "$ICONS_DIR/icon.png" -resize 16x16 "$ICONS_DIR/icon-16x16.png"
convert "$ICONS_DIR/icon.png" -resize 32x32 "$ICONS_DIR/icon-32x32.png"
convert "$ICONS_DIR/icon.png" -resize 48x48 "$ICONS_DIR/icon-48x48.png"
convert "$ICONS_DIR/icon.png" -resize 128x128 "$ICONS_DIR/icon-128x128.png"
convert "$ICONS_DIR/icon.png" -resize 256x256 "$ICONS_DIR/icon-256x256.png"

echo "图标文件生成完成！"
ls -lh "$ICONS_DIR"/*.png

