# GitHub Pages 配置说明

本目录包含 MarkdownDaoNote 项目的 GitHub Pages 网站。

## 📄 文件说明

- `index.html` - 项目主页，展示功能特性、截图和下载链接

## 🚀 启用 GitHub Pages

### 1. 在 GitHub 仓库中启用

访问仓库的 Settings → Pages：

```
https://github.com/TaoismDao/MarkdownDaoNote/settings/pages
```

### 2. 配置源

- **Source**: Deploy from a branch
- **Branch**: `main`
- **Folder**: `/docs`

### 3. 保存并等待

点击 "Save" 后，GitHub 会自动构建和部署网站。

通常需要 1-2 分钟，完成后会显示网站地址：

```
https://taoismdao.github.io/MarkdownDaoNote/
```

## 🌐 中英文切换

网站支持中英文双语界面：

- 页面右上角有语言切换按钮（中文/English）
- 切换语言后，所有文本内容会立即更新
- 用户的语言偏好会保存到浏览器 localStorage
- 下次访问时自动加载上次选择的语言
- 默认语言为中文

### 如何添加新的翻译

编辑 `index.html` 中的 `translations` 对象：

```javascript
const translations = {
    'zh': {
        'key-name': '中文文本',
        // ...
    },
    'en': {
        'key-name': 'English text',
        // ...
    }
};
```

然后在 HTML 元素上添加 `data-i18n` 属性：

```html
<p data-i18n="key-name"></p>
```

## 🎨 自定义

### 修改主题颜色

编辑 `index.html` 中的 CSS 变量：

```css
:root {
    --primary-color: #667eea;      /* 主色调 */
    --secondary-color: #764ba2;    /* 次色调 */
    --text-dark: #2d3748;          /* 深色文本 */
    --text-light: #718096;         /* 浅色文本 */
}
```

### 更新截图

截图位于 `docs/assets/preview/` 目录：

- `screen1.png` - 主界面截图
- `screen2.png` - 编辑界面截图
- `screen-theme.png` - 主题切换截图
- `screen-full-preview.png` - 全屏预览截图
- `screen-close-preview.png` - 纯编辑模式截图

**注意**：截图已复制到 docs 目录内，以便 GitHub Pages 可以访问。

### 更新下载链接

下载链接使用 GitHub Releases 的 latest 标签：

```html
https://github.com/TaoismDao/MarkdownDaoNote/releases/latest/download/文件名
```

## 🌐 访问网站

配置完成后，可以通过以下地址访问：

- **GitHub Pages**: https://taoismdao.github.io/MarkdownDaoNote/
- **自定义域名**（可选）: 在 Settings → Pages → Custom domain 中配置

## 📱 响应式设计

网站支持响应式布局，在以下设备上都有良好显示：

- 桌面电脑 (≥1200px)
- 平板电脑 (768px - 1199px)
- 手机 (<768px)

## 🔧 本地预览

在本地预览网站：

```bash
# 使用 Python 3
cd docs
python3 -m http.server 8000

# 或使用 Python 2
python -m SimpleHTTPServer 8000

# 或使用 Node.js
npx http-server .
```

然后访问 `http://localhost:8000`

## 📝 SEO 优化

页面已包含基本的 SEO 优化：

- Meta 描述
- Meta 关键词
- 语义化 HTML
- 图片 alt 属性

## 🎯 特性

- ✅ **中英文切换** - 支持中英文界面切换，自动保存用户语言偏好
- ✅ 响应式设计
- ✅ 平滑滚动
- ✅ 优雅动画
- ✅ 截图预览模态框
- ✅ 渐变背景
- ✅ 现代化 UI
- ✅ 无需外部依赖
- ✅ 加载速度快

## 📄 许可证

与主项目相同 - MIT License

