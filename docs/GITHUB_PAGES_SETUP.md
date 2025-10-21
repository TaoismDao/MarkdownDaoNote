# 启用 GitHub Pages 快速指南

## 🎯 目标

启用 GitHub Pages，让项目主页在线访问。

## 📋 步骤

### 1. 访问仓库设置

在浏览器中打开：

```
https://github.com/TaoismDao/MarkdownDaoNote/settings/pages
```

或者：

1. 访问仓库主页
2. 点击 **Settings** (设置)
3. 在左侧菜单找到 **Pages**

### 2. 配置 GitHub Pages

在 Pages 设置页面：

#### **Build and deployment** (构建和部署)

- **Source**: 选择 `Deploy from a branch`

#### **Branch** (分支)

- **Branch**: 选择 `main`
- **Folder**: 选择 `/docs`

#### **Custom domain** (可选)

如果有自定义域名，在这里输入

### 3. 保存配置

点击 **Save** 按钮

### 4. 等待部署

- GitHub 会自动开始构建
- 通常需要 1-3 分钟
- 完成后会在页面顶部显示：

```
✅ Your site is live at https://taoismdao.github.io/MarkdownDaoNote/
```

### 5. 访问网站

打开浏览器访问：

```
https://taoismdao.github.io/MarkdownDaoNote/
```

## 🔍 验证部署

### 检查部署状态

1. 访问仓库的 **Actions** 标签页
2. 查看 `pages build and deployment` workflow
3. 确认状态为 ✅ 成功

### 测试网站

访问以下链接确认各功能正常：

- 主页：https://taoismdao.github.io/MarkdownDaoNote/
- 截图可以正常显示
- 下载链接可以点击
- 响应式布局在移动设备上正常

## 🎨 预览

网站包含以下部分：

1. **Header** - 项目标题和下载按钮
2. **Features** - 6个核心特性卡片
3. **Screenshots** - 5张应用截图（可点击放大）
4. **Download** - 三个平台的下载链接
5. **Footer** - 作者信息和许可证

## 🔧 故障排除

### 404 错误

**问题**: 访问网站显示 404

**解决方案**:
1. 确认 Branch 设置为 `main`
2. 确认 Folder 设置为 `/docs`
3. 确认 `docs/index.html` 文件存在
4. 等待几分钟让部署完成

### 截图无法显示

**问题**: 页面加载但截图不显示

**解决方案**:
1. 确认 `assets/preview/` 目录存在
2. 确认截图文件名正确
3. 检查浏览器控制台的错误信息

### CSS 样式不生效

**问题**: 页面显示但样式混乱

**解决方案**:
1. 清除浏览器缓存
2. 使用无痕模式访问
3. 检查 `index.html` 中的 `<style>` 标签

## 📱 移动端访问

网站采用响应式设计，在移动设备上访问体验：

- 自动调整布局
- 触摸友好的按钮
- 优化的图片加载

## 🌐 分享链接

启用后，可以在以下地方分享：

- ✅ 主 README.md 添加徽章
- ✅ 社交媒体
- ✅ 技术博客
- ✅ 产品发布平台

## 📊 添加徽章到 README

在主 README.md 中添加：

```markdown
[![Website](https://img.shields.io/badge/website-online-brightgreen)](https://taoismdao.github.io/MarkdownDaoNote/)
```

效果：

[![Website](https://img.shields.io/badge/website-online-brightgreen)](https://taoismdao.github.io/MarkdownDaoNote/)

## ✨ 完成！

GitHub Pages 现在已启用，项目主页在线可访问！

访问：**https://taoismdao.github.io/MarkdownDaoNote/**

