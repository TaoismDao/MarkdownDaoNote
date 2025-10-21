#!/bin/bash

# 准备 macOS .icns 图标文件
# 从 icon.ico 或 icon.png 生成 .icns 文件

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ICONS_DIR="$PROJECT_ROOT/assets/icons"
SOURCE_ICON="$ICONS_DIR/icon.png"
OUTPUT_ICON="$ICONS_DIR/icon.icns"
TEMP_DIR="$ICONS_DIR/icon.iconset"

echo "准备 macOS .icns 图标..."

# 检查源图标是否存在
if [ ! -f "$SOURCE_ICON" ]; then
    # 如果 icon.png 不存在，尝试从 icon.ico 转换
    if [ -f "$ICONS_DIR/icon.ico" ]; then
        echo "从 icon.ico 转换为 icon.png..."
        if command -v convert >/dev/null 2>&1; then
            convert "$ICONS_DIR/icon.ico[0]" -resize 512x512 "$SOURCE_ICON"
        elif command -v magick >/dev/null 2>&1; then
            magick "$ICONS_DIR/icon.ico[0]" -resize 512x512 "$SOURCE_ICON"
        else
            echo "错误: 需要安装 ImageMagick"
            echo "macOS: brew install imagemagick"
            echo "Linux: sudo apt-get install imagemagick"
            exit 1
        fi
    else
        echo "错误: 找不到源图标文件"
        exit 1
    fi
fi

# 创建临时目录
mkdir -p "$TEMP_DIR"

echo "生成不同尺寸的图标..."

# 检测使用哪个工具生成 .icns
USE_ICONUTIL=false
USE_PNG2ICNS=false

if command -v iconutil >/dev/null 2>&1; then
    USE_ICONUTIL=true
    echo "使用 iconutil (macOS)"
elif command -v png2icns >/dev/null 2>&1; then
    USE_PNG2ICNS=true
    echo "使用 png2icns (Linux)"
fi

# 根据工具选择生成策略
if [ "$USE_ICONUTIL" = true ]; then
    # iconutil 需要 .iconset 目录结构，包含 @2x 版本
    sizes=(16 32 128 256 512)
    
    for size in "${sizes[@]}"; do
        size2x=$((size * 2))
        
        if command -v sips >/dev/null 2>&1; then
            # macOS 系统自带的 sips 工具
            sips -z $size $size "$SOURCE_ICON" --out "$TEMP_DIR/icon_${size}x${size}.png" >/dev/null 2>&1
            sips -z $size2x $size2x "$SOURCE_ICON" --out "$TEMP_DIR/icon_${size}x${size}@2x.png" >/dev/null 2>&1
        else
            echo "错误: macOS 上需要 sips 工具"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    done
elif [ "$USE_PNG2ICNS" = true ]; then
    # png2icns 只需要实际的像素尺寸，避免重复
    # 生成所有需要的尺寸：16, 32, 64, 128, 256, 512, 1024
    actual_sizes=(16 32 64 128 256 512 1024)
    
    for size in "${actual_sizes[@]}"; do
        if command -v convert >/dev/null 2>&1; then
            # ImageMagick
            convert "$SOURCE_ICON" -resize ${size}x${size} "$TEMP_DIR/icon_${size}x${size}.png"
        elif command -v magick >/dev/null 2>&1; then
            # ImageMagick 7+
            magick "$SOURCE_ICON" -resize ${size}x${size} "$TEMP_DIR/icon_${size}x${size}.png"
        else
            echo "错误: 需要 ImageMagick"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    done
else
    # 备用方案：生成基本尺寸用于其他用途
    sizes=(16 32 128 256 512)
    
    for size in "${sizes[@]}"; do
        if command -v convert >/dev/null 2>&1; then
            convert "$SOURCE_ICON" -resize ${size}x${size} "$TEMP_DIR/icon_${size}x${size}.png"
        elif command -v magick >/dev/null 2>&1; then
            magick "$SOURCE_ICON" -resize ${size}x${size} "$TEMP_DIR/icon_${size}x${size}.png"
        else
            echo "错误: 需要 ImageMagick"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    done
fi

echo "生成 .icns 文件..."

# 使用 iconutil 生成 .icns 文件 (仅 macOS)
if command -v iconutil >/dev/null 2>&1; then
    iconutil -c icns "$TEMP_DIR" -o "$OUTPUT_ICON"
    echo "✅ 成功生成 $OUTPUT_ICON"
elif command -v png2icns >/dev/null 2>&1; then
    # Linux 上的替代方案
    png2icns "$OUTPUT_ICON" "$TEMP_DIR"/*.png
    echo "✅ 成功生成 $OUTPUT_ICON (使用 png2icns)"
else
    echo "⚠️  警告: 无法生成 .icns 文件"
    echo "macOS: iconutil 应该已预装"
    echo "Linux: 需要安装 icnsutils (sudo apt-get install icnsutils)"
    echo "可以继续构建，但 macOS 应用可能没有正确的图标"
fi

# 清理临时文件
rm -rf "$TEMP_DIR"

echo "图标准备完成！"

