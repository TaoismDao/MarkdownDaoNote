#!/bin/bash
set -e

# 更新图标缓存
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

# 更新桌面数据库
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi

# 更新 MIME 类型数据库
if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime >/dev/null 2>&1 || true
fi

echo "MarkdownDaoNote 安装成功！"
echo "您可以在应用程序菜单中找到它，或者在终端运行 'markdowndaonote' 启动。"

exit 0

