import mitt from "mitt";
import {
    EventsOn,
    EventsEmit,
    Quit,
    WindowMinimise,
    WindowToggleMaximise,
} from "@/wailsjs/wailsjs/runtime/runtime";
import {
    DEFAULT_SETTINGS,
    openFileDialog,
    openFolderDialog,
    loadDirectoryEntries,
    loadSettings,
    saveDocument,
    saveSettings,
    SAVE_CANCELLED_ERROR,
    setActiveFile,
    showAboutDialog,
    loadDocument as loadDocumentFromBackend,
    createFile,
    createDirectory,
    deleteFile,
    renameFile,
    backendLog,
} from "@/services/api";
import type {
    EditorTheme,
    PreviewTheme,
    Settings as AppSettings,
} from "@/services/api";

const APP_NAME = "MarkdownDaoNote";
const APP_VERSION = "1.0.1";
const APP_AUTHOR = "Taoism Dao";
const APP_GITHUB = "https://github.com/TaoismDao/MarkdownDaoNote";
const APP_ICON = "/favicon.ico";

const EVENT_OPEN_FILE = "open-file";
const EVENT_FILE_OPENED = "file:opened";
const EVENT_FILE_SAVE_REQUESTED = "file:save-requested";
const EVENT_FILE_SAVED = "file:saved";
const EVENT_FOLDER_OPENED = "folder:opened";
const EVENT_TOOLBAR_THEME_CHANGED = "theme:toolbar-changed";
const EVENT_EDITOR_THEME_CHANGED = "theme:editor-changed";
const EVENT_PREVIEW_THEME_CHANGED = "theme:preview-changed";
const DEFAULT_WELCOME_MARKDOWN =
    "# Welcome to MarkdownDaoNote\n\nStart iterating on your notes.";

const EDITOR_THEME_OPTIONS: EditorTheme[] = [
    "default",
    "3024-day",
    "3024-night",
    "ambiance",
    "ambiance-mobile",
    "base16-dark",
    "base16-light",
    "blackboard",
    "cobalt",
    "eclipse",
    "elegant",
    "erlang-dark",
    "lesser-dark",
    "mbo",
    "mdn-like",
    "midnight",
    "monokai",
    "neat",
    "neo",
    "night",
    "paraiso-dark",
    "paraiso-light",
    "pastel-on-dark",
    "rubyblue",
    "solarized",
    "the-matrix",
    "tomorrow-night-eighties",
    "twilight",
    "vibrant-ink",
    "xq-dark",
    "xq-light",
];

const PREVIEW_THEME_OPTIONS: PreviewTheme[] = ["default", "dark"];

const TOOLBAR_THEME_OPTIONS: Array<AppSettings["theme"]> = ["default", "dark"];

type Events = {
    "editor:ready": void;
    "settings:loaded": void;
};

type ScriptAssetKey =
    | "jquery"
    | "codemirror"
    | "codemirror-modes"
    | "codemirror-addons"
    | "marked"
    | "prettify"
    | "editormd"
    | "language";

interface FileTreeNode {
    name: string;
    path: string;
    isDir: boolean;
    hasChildren?: boolean;
    children?: FileTreeNode[];
    isLoading?: boolean;
}

interface OpenDocument {
    path: string;
    name: string;
    savedContent: string;
    currentContent: string;
    isDirty: boolean;
}

declare global {
    interface Window {
        $: typeof import("jquery");
        jQuery: typeof import("jquery");
        editormd: any;
        language: any;
    }
}

export class EditorApp {
    private root: HTMLElement;
    private editorElement!: HTMLDivElement;
    private sidebarElement!: HTMLElement;
    private editorInstance: any;
    private events = mitt<Events>();
    private loadedStyles = new Set<string>();
    private loadedScripts = new Set<ScriptAssetKey>();
    private tabBarElement!: HTMLDivElement;
    private openDocuments = new Map<string, OpenDocument>();
    private tabOrder: string[] = [];
    private statusElement!: HTMLDivElement;
    private menuElement!: HTMLDivElement;
    private sidebarTreeRoot: FileTreeNode | null = null;
    private expandedPaths = new Set<string>();
    private currentFilePath: string | null = null;
    private currentFolderPath: string | null = null;
    private activeFilePath: string | null = null;
    private currentSettings: AppSettings | null = null;
    private pendingToolbarTheme: AppSettings["theme"] | null = null;
    private pendingEditorTheme: EditorTheme | null = null;
    private pendingPreviewTheme: PreviewTheme | null = null;
    private suppressChangeHandler = false;
    private statusResetTimeout: number | undefined;
    private subscriptions: Array<() => void> = [];
    private pendingActiveSync: Promise<void> | null = null;
    private openMenuId: string | null = null;
    private activeDropdown: HTMLDivElement | null = null;
    private readonly suppressNativeContextMenu = (event: MouseEvent) => event.preventDefault();
    private contextMenu: HTMLDivElement | null = null;
    private contextMenuTarget: FileTreeNode | null = null;

    /**
     * 统一的MessageDialog方法
     * @param message 消息内容
     * @param title 对话框标题，默认为"MarkdownDaoNote"
     * @param type 对话框类型，默认为"info"
     */
    private async showMessageDialog(
        message: string,
        title: string = APP_NAME,
        type: "info" | "warning" | "error" = "info",
    ): Promise<void> {
        const dialogTitle = `${title} - ${this.getDialogTypeText(type)}`;

        // 创建浮动模态框
        this.createModalDialog(dialogTitle, message, type);
    }

    /**
     * Get the text for the dialog type
     */
    private getDialogTypeText(type: "info" | "warning" | "error"): string {
        switch (type) {
            case "info":
                return "Information";
            case "warning":
                return "Warning";
            case "error":
                return "Error";
            default:
                return "Information";
        }
    }

    /**
     * 获取对话框类型的图标
     */
    private getDialogIcon(type: "info" | "warning" | "error"): string {
        switch (type) {
            case "info":
                return "ℹ️";
            case "warning":
                return "⚠️";
            case "error":
                return "❌";
            default:
                return "ℹ️";
        }
    }

    /**
     * 创建浮动模态框
     */
    private createModalDialog(
        title: string,
        message: string,
        type: "info" | "warning" | "error",
    ): void {
        // 移除现有的模态框
        this.removeExistingModal();

        // 创建遮罩层
        const overlay = document.createElement("div");
        overlay.className =
            "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center";
        overlay.id = "modal-overlay";
        overlay.style.zIndex = "99999";

        // 创建模态框容器
        const modal = document.createElement("div");
        modal.className =
            "bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100";
        modal.style.minWidth = "320px";
        modal.style.maxWidth = "500px";

        // 根据类型设置不同的样式
        const typeStyles = this.getModalTypeStyles(type);
        modal.style.borderColor = typeStyles.borderColor;
        modal.style.borderLeftWidth = "4px";

        // 创建标题栏
        const header = document.createElement("div");
        header.className =
            "flex items-center gap-3 px-6 py-4 border-b border-gray-700";

        const icon = document.createElement("span");
        icon.textContent = this.getDialogIcon(type);
        icon.className = "text-2xl";

        const titleElement = document.createElement("h3");
        titleElement.textContent = title;
        titleElement.className = "text-lg font-semibold text-white flex-1";

        const closeButton = document.createElement("button");
        closeButton.innerHTML = "×";
        closeButton.className =
            "text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors";
        closeButton.addEventListener("click", () => this.removeExistingModal());

        header.appendChild(icon);
        header.appendChild(titleElement);
        header.appendChild(closeButton);

        // 创建内容区域
        const content = document.createElement("div");
        content.className = "px-6 py-4";

        const messageElement = document.createElement("p");
        messageElement.textContent = message;
        messageElement.className =
            "text-gray-200 leading-relaxed whitespace-pre-wrap";

        content.appendChild(messageElement);

        // 创建按钮区域
        const footer = document.createElement("div");
        footer.className =
            "flex justify-end gap-3 px-6 py-4 border-t border-gray-700";

        const okButton = document.createElement("button");
        okButton.textContent = "OK";
        okButton.className = `px-4 py-2 rounded font-medium transition-colors ${typeStyles.buttonClass}`;
        okButton.addEventListener("click", () => this.removeExistingModal());

        footer.appendChild(okButton);

        // 组装模态框
        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // 添加到页面
        document.body.appendChild(overlay);

        // 添加动画效果
        setTimeout(() => {
            modal.style.transform = "scale(1)";
        }, 10);

        // 点击遮罩层关闭
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                this.removeExistingModal();
            }
        });

        // ESC键关闭
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                this.removeExistingModal();
                document.removeEventListener("keydown", handleKeyDown);
            }
        };
        document.addEventListener("keydown", handleKeyDown);

        // 自动聚焦到确定按钮
        okButton.focus();
    }

    /**
     * 获取模态框类型样式
     */
    private getModalTypeStyles(type: "info" | "warning" | "error") {
        switch (type) {
            case "info":
                return {
                    borderColor: "#3b82f6", // blue-500
                    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
                };
            case "warning":
                return {
                    borderColor: "#f59e0b", // amber-500
                    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
                };
            case "error":
                return {
                    borderColor: "#ef4444", // red-500
                    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
                };
            default:
                return {
                    borderColor: "#3b82f6",
                    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
                };
        }
    }

    /**
     * 移除现有的模态框
     */
    private removeExistingModal(): void {
        const existingOverlay = document.getElementById("modal-overlay");
        if (existingOverlay) {
            existingOverlay.remove();
        }
    }
    private readonly handleGlobalMenuClose = (event: MouseEvent) => {
        if (!this.menuElement) {
            return;
        }
        const target = event.target as HTMLElement | null;
        if (
            target &&
            (this.menuElement.contains(target) ||
                (this.activeDropdown && this.activeDropdown.contains(target)))
        ) {
            return;
        }
        this.closeMenu();
    };

    constructor(root: HTMLElement) {
        this.root = root;
    }

    async bootstrap() {
        // 重写window.alert方法，使用统一的showMessageDialog
        this.overrideWindowAlert();
        
        this.mountSkeleton();
        this.renderSidebar();
        this.registerBackendEvents();
        await this.ensureEditorAssets();

        // 窗口已在main.go中设置为最大化，无需再次调用

        const settings = await loadSettings();
        if (this.pendingToolbarTheme) {
            settings.theme = this.pendingToolbarTheme;
        }
        if (this.pendingEditorTheme) {
            settings.editorTheme = this.pendingEditorTheme;
        }
        if (this.pendingPreviewTheme) {
            settings.previewTheme = this.pendingPreviewTheme;
        }
        this.pendingToolbarTheme = null;
        this.pendingEditorTheme = null;
        this.pendingPreviewTheme = null;

        this.currentSettings = settings;
        this.renderMenuBar();
        this.events.emit("settings:loaded");

        this.initializeEditor(settings, DEFAULT_WELCOME_MARKDOWN);

        // 延迟初始化编辑器，确保所有资源都已加载
        /* setTimeout(() => {
        this.initializeEditor(settings, DEFAULT_WELCOME_MARKDOWN);
        this.applyToolbarTheme(settings.theme, false);
        this.applyEditorTheme(settings.editorTheme, false);
        this.applyPreviewTheme(settings.previewTheme, false);
        }, 500); // 增加延迟时间 */

        window.addEventListener("beforeunload", () => {
            const snapshot = this.currentSettings;
            this.dispose();
            if (snapshot) {
                saveSettings(snapshot).catch((error) =>
                    console.warn("failed saving settings", error),
                );
            }
        });
    }

    private dispose() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe());
        this.subscriptions = [];
        this.clearStatusFlash();
        this.sidebarTreeRoot = null;
        this.expandedPaths.clear();
        this.currentFilePath = null;
        this.currentFolderPath = null;
        this.activeFilePath = null;
        this.currentSettings = null;
        this.openDocuments.clear();
        this.tabOrder = [];
        this.pendingToolbarTheme = null;
        this.pendingEditorTheme = null;
        this.pendingPreviewTheme = null;
        this.renderTabs();
        this.openMenuId = null;
        if (this.menuElement) {
            this.menuElement.innerHTML = "";
        }
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
        document.removeEventListener("mousedown", this.handleGlobalMenuClose);
        document.removeEventListener(
            "contextmenu",
            this.suppressNativeContextMenu,
        );
    }

    /**
     * 重写window.alert方法，使用统一的showMessageDialog
     */
    private overrideWindowAlert() {
        const originalAlert = window.alert;
        window.alert = (message: string) => {
            // 使用统一的showMessageDialog替代原生alert
            this.showMessageDialog(message, APP_NAME, "info");
        };
    }

    private mountSkeleton() {
        // 清空 root 元素
        this.root.innerHTML = "";

        // 创建主容器
        const container = document.createElement("div");
        container.className = "app-root flex flex-col flex-1 w-full min-h-0";
        container.style.position = "relative";

        // 禁用主容器的右键菜单
        /* container.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        }); */

        const header = document.createElement("header");
        header.className =
            "app-drag-region px-4 py-2 border-b border-white/5 bg-black/20 backdrop-blur flex items-center gap-4";

        // 禁用头部区域的右键菜单
        /* header.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        }); */

        const brand = document.createElement("div");
        brand.className = "flex flex-col";

        const title = document.createElement("div");
        title.className = "font-semibold tracking-wide";
        title.textContent = APP_NAME;

        const tagline = document.createElement("div");
        tagline.className = "text-xs text-white/60";
        tagline.textContent = "Cross-platform Markdown workstation";

        brand.append(title, tagline);

        const status = document.createElement("div");
        status.className = "text-xs text-white/60 no-drag";
        status.textContent = "No document loaded";
        this.statusElement = status;
        status.style.marginLeft = "auto";

        const windowControls = document.createElement("div");
        windowControls.className =
            "no-drag flex items-center gap-1 text-white/70";

        const controlButton = (
            label: string,
            titleText: string,
            handler: () => void,
        ) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            btn.title = titleText;
            btn.className =
                "w-7 h-7 flex items-center justify-center rounded hover:bg-white/15 focus:outline-none transition-colors duration-200 font-mono text-sm";
            btn.style.fontSize = "14px";
            btn.style.fontWeight = "500";
            btn.addEventListener("click", (event) => {
                event.stopPropagation();
                handler();
            });
            return btn;
        };

        // 最小化和最大化按钮
        windowControls.append(
            controlButton("−", "Minimise", () => WindowMinimise()),
            controlButton("□", "Maximise / Restore", () =>
                WindowToggleMaximise(),
            ),
        );

        // 关闭按钮 - 特殊样式
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.textContent = "×";
        closeBtn.title = "Close";
        closeBtn.className =
            "w-7 h-7 flex items-center justify-center rounded hover:bg-red-500 focus:outline-none transition-colors duration-200 font-mono text-sm";
        closeBtn.style.fontSize = "14px";
        closeBtn.style.fontWeight = "500";
        closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            Quit();
        });
        windowControls.append(closeBtn);

        this.menuElement = document.createElement("div");
        this.menuElement.className =
            "no-drag flex items-center gap-3 text-sm text-white/80";
        this.menuElement.style.marginLeft = "35px";

        header.append(brand, this.menuElement, status, windowControls);

        const body = document.createElement("div");
        body.className = "flex flex-1 min-h-0 bg-transparent overflow-hidden";

        const sidebarWrapper = document.createElement("div");
        sidebarWrapper.className =
            "flex flex-col border-r border-white/5 bg-black/10 text-white/80 overflow-hidden";
        sidebarWrapper.style.width = "18rem";
        sidebarWrapper.style.minWidth = "12rem";
        sidebarWrapper.style.maxWidth = "30rem";
        sidebarWrapper.style.resize = "horizontal";
        sidebarWrapper.style.overflow = "hidden";

        // 为侧边栏包装器添加右键菜单支持
        sidebarWrapper.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showContextMenu(event, null);
        });

        const sidebar = document.createElement("aside");
        sidebar.className = "flex-1 overflow-y-auto sidebar-scroll";
        this.sidebarElement = sidebar;

        sidebarWrapper.appendChild(sidebar);

        const editorWrapper = document.createElement("div");
        editorWrapper.className = "flex-1 min-w-0 min-h-0 flex flex-col";

        this.tabBarElement = document.createElement("div");
        this.tabBarElement.className =
            "flex items-center gap-1 px-2 border-b border-white/10 bg-black/30 text-xs overflow-x-auto shrink-0";

        this.editorElement = document.createElement("div");
        this.editorElement.id = "markdownpad-editor";
        this.editorElement.className = "editormd flex-1 min-h-0 editor-scroll";
        this.editorElement.style.minHeight = "0";
        this.editorElement.style.height = "100%";
        this.editorElement.style.width = "100%";
        this.editorElement.style.display = "block";
        this.editorElement.style.visibility = "visible";

        // 使用 HTML 字符串创建 textarea，避免动态创建的问题
        this.editorElement.innerHTML = `
            <textarea name="markdown" id="markdownpad-editor-textarea" data-editor="markdown" data-autofocus="true" data-save="true" placeholder="Enjoy Markdown! coding now..."></textarea>
        `;

        const textarea = this.editorElement.querySelector(
            'textarea[name="markdown"]',
        ) as HTMLTextAreaElement;

        // 确保 textarea 有正确的属性和值
        if (textarea) {
            textarea.value = "";
            textarea.style.display = "block";
            textarea.style.visibility = "visible";
            textarea.style.width = "100%";
            textarea.style.height = "100%";
        }

        editorWrapper.appendChild(this.tabBarElement);
        editorWrapper.appendChild(this.editorElement);

        // 禁用编辑器区域的右键菜单
        /* editorWrapper.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        }); */

        // 为标签栏添加右键菜单 - 只在标签上显示菜单
        this.tabBarElement.addEventListener("contextmenu", (event) => {
            const target = event.target as HTMLElement;
            const tabElement = target.closest("[data-tab-path]") as HTMLElement;

            if (tabElement) {
                // 如果点击在标签上，显示菜单
                event.preventDefault();
                this.showTabContextMenu(event);
            } else {
                // 如果点击在标签栏空白区域，禁用右键菜单
                event.preventDefault();
            }
        });

        body.append(sidebarWrapper, editorWrapper);

        // 将 header 和 body 添加到容器中
        container.appendChild(header);
        container.appendChild(body);

        // 添加容器到 root 元素
        this.root.appendChild(container);

        this.renderTabs();
        this.renderMenuBar();
        document.removeEventListener("mousedown", this.handleGlobalMenuClose);
        document.addEventListener("mousedown", this.handleGlobalMenuClose);
        // document.removeEventListener("contextmenu", this.suppressNativeContextMenu);
        // document.addEventListener("contextmenu", this.suppressNativeContextMenu);
    }

    private initializeEditor(
        settings: AppSettings,
        initialMarkdown = DEFAULT_WELCOME_MARKDOWN,
    ) {
        if (typeof window.editormd !== "function") {
            console.error("Editor.md assets are not ready");
            return;
        }

        // 检查 CodeMirror 是否可用
        if (!(window as any).CodeMirror) {
            console.error("CodeMirror is not available");
            return;
        }

        // 确保编辑器元素存在
        if (!this.editorElement) {
            console.error("Editor element not found");
            return;
        }

        try {
            const toolbarTheme = this.normalizeToolbarTheme(settings.theme);
            const editorTheme = this.normalizeEditorTheme(settings.editorTheme);
            const previewTheme = this.normalizePreviewTheme(
                settings.previewTheme,
            );

            // 确保 textarea 元素存在且有正确的值
            const textarea = this.editorElement.querySelector(
                'textarea[name="markdown"]',
            ) as HTMLTextAreaElement;
            if (textarea) {
                textarea.value = initialMarkdown;
            } else {
                console.error("Textarea element not found");
                return;
            }

            // 方法1: 使用最基本的配置，不依赖 textarea
            try {
                // 确保 textarea 正确设置
                if (textarea) {
                    textarea.style.display = "block";
                    textarea.style.visibility = "visible";
                    textarea.value = initialMarkdown;
                }

                this.editorInstance = window.editormd("markdownpad-editor", {
                    width: "100%",
                    height: "100%",
                    path: "/vendor/editor.md/lib/",
                    markdown: initialMarkdown,
                    saveHTMLToTextarea: false, // 禁用保存到 textarea
                    autoLoadModules: true,
                    watch: true,
                    toolbar: true, // 启用工具栏
                    toolbarIcons: "full", // 显示完整工具栏
                    theme: settings.theme, // 工具栏主题
                    editorTheme: settings.editorTheme, // 编辑器主题
                    preview: true, // 启用预览
                    previewCodeHighlight: true, // 预览代码高亮
                    previewTheme: settings.previewTheme, // 预览主题
                    // 布局设置
                    layout: "vertical", // 垂直布局
                    // 强制启用分屏模式
                    splitView: true, // 启用分屏视图
                    fullscreen: false, // 禁用全屏
                    // 预览设置
                    previewMode: "split", // 预览模式为分屏
                    tocm: true, // 启用目录
                    tocDropdown: false, // 启用目录下拉
                    tocContainer: "", // 目录容器
                    tocStartLevel: 1, // 目录开始级别
                    htmlDecode: "style,script,iframe|on*", // HTML 解码
                    emoji: false, // 启用 emoji
                    taskList: true, // 启用任务列表
                    tex: false, // 禁用 TeX 公式（避免 katex 错误）
                    flowChart: false, // 禁用流程图（避免依赖错误）
                    sequenceDiagram: false, // 禁用时序图（避免依赖错误）
                    onload: function () {
                        // 确保预览面板显示
                        if (this.preview) {
                            this.preview.show();
                        } else {
                            console.warn("Preview object not found");
                        }

                        // 通知后端：前端编辑器已就绪（用于触发延迟的 open-file 事件）
                        try {
                            backendLog("INFO", "EXEC Backend EventsEmit editor:ready");
                            EventsEmit("editor:ready");
                        } catch (error) {
                            backendLog("ERROR", "Failed to emit editor:ready event: " + error);
                        }

                        // 隐藏"关于MarkdownPad"按钮
                        /* const aboutButton = document.querySelector('a[title="关于MarkdownPad"]');
                        if (aboutButton) {
                            (aboutButton as HTMLElement).style.display = 'none';
                        } */
                    },
                    onchange: () => this.handleEditorChange(),
                });
            } catch (error1) {
                console.error("Initialization failed:", error1);
            }
        } catch (error) {
            console.error("Failed to initialize Markdown editor", error);
            this.editorInstance = null;
            return;
        }

        // 直接应用主题，不等待编辑器完全准备好
        /* if (this.editorInstance) {
            console.log("编辑器实例已创建，开始应用主题");

            // 延迟应用主题，给编辑器一些时间初始化
            setTimeout(() => {
                console.log("开始应用主题");

        if (this.pendingEditorTheme) {
            const theme = this.pendingEditorTheme;
            this.pendingEditorTheme = null;
            this.applyEditorTheme(theme, false);
        }
        if (this.pendingPreviewTheme) {
            const theme = this.pendingPreviewTheme;
            this.pendingPreviewTheme = null;
            this.applyPreviewTheme(theme, false);
        }
        if (this.pendingToolbarTheme) {
            const theme = this.pendingToolbarTheme;
            this.pendingToolbarTheme = null;
            this.applyToolbarTheme(theme, false);
                }
            }, 1000); // 给编辑器1秒时间初始化
        } */

        this.events.emit("editor:ready");
    }

    private applyToolbarTheme(theme: string, persist = false) {
        const normalized = this.normalizeToolbarTheme(theme);

        if (this.currentSettings) {
            this.currentSettings.theme = normalized;
        } else {
            this.pendingToolbarTheme = normalized;
        }

        const colorScheme = normalized === "dark" ? "dark" : "light";
        const root = document.documentElement;
        root.style.setProperty("--color-scheme", colorScheme);
        root.dataset.theme = normalized;
        root.dataset.toolbarTheme = normalized;
        if (document.body) {
            document.body.dataset.theme = normalized;
            document.body.dataset.toolbarTheme = normalized;
        }

        if (!this.editorInstance) {
            this.pendingToolbarTheme = normalized;
        } else {
            try {
                if (typeof this.editorInstance.setTheme === "function") {
                    this.editorInstance.setTheme(normalized);
                }
                this.pendingToolbarTheme = null;
            } catch (error) {
                console.warn("Failed to apply toolbar theme:", error);
                this.pendingToolbarTheme = normalized;
            }
        }

        if (persist && this.currentSettings) {
            saveSettings({ theme: normalized }).catch((error) =>
                console.warn("failed saving settings", error),
            );
        }
    }

    private applyEditorTheme(theme: string, persist = false) {
        const normalized = this.normalizeEditorTheme(theme);

        if (this.currentSettings) {
            this.currentSettings.editorTheme = normalized;
        } else {
            this.pendingEditorTheme = normalized;
        }

        if (!this.editorInstance) {
            this.pendingEditorTheme = normalized;
        } else {
            try {
                // 尝试应用主题，如果失败就延迟应用
                if (typeof this.editorInstance.setEditorTheme === "function") {
                    this.editorInstance.setEditorTheme(normalized);
                    this.pendingEditorTheme = null;
                    console.log(
                        "Editor theme applied successfully (setEditorTheme):",
                        normalized,
                    );
                } else if (
                    this.editorInstance.cm &&
                    typeof this.editorInstance.cm.setOption === "function"
                ) {
                    this.editorInstance.cm.setOption("theme", normalized);
                    this.pendingEditorTheme = null;
                    console.log(
                        "Editor theme applied successfully (cm.setOption):",
                        normalized,
                    );
                } else {
                    console.warn("Editor instance not fully ready, delay applying theme");
                    this.pendingEditorTheme = normalized;
                }
            } catch (error) {
                console.warn("Failed to apply editor theme:", error);
                this.pendingEditorTheme = normalized;
            }
        }

        if (persist && this.currentSettings) {
            saveSettings({ editorTheme: normalized }).catch((error) =>
                console.warn("failed saving settings", error),
            );
        }
    }

    private applyPreviewTheme(theme: string, persist = false) {
        const normalized = this.normalizePreviewTheme(theme);

        if (this.currentSettings) {
            this.currentSettings.previewTheme = normalized;
        } else {
            this.pendingPreviewTheme = normalized;
        }

        if (!this.editorInstance) {
            this.pendingPreviewTheme = normalized;
        } else {
            try {
                if (typeof this.editorInstance.setPreviewTheme === "function") {
                    this.editorInstance.setPreviewTheme(normalized);
                    this.pendingPreviewTheme = null;
                }
            } catch (error) {
                console.warn("Failed to apply preview theme:", error);
                this.pendingPreviewTheme = normalized;
            }
        }

        if (persist && this.currentSettings) {
            saveSettings({ previewTheme: normalized }).catch((error) =>
                console.warn("failed saving settings", error),
            );
        }
    }

    private normalizeEditorTheme(theme: string): EditorTheme {
        const value = String(theme ?? "")
            .trim()
            .toLowerCase();
        return EDITOR_THEME_OPTIONS.includes(value as EditorTheme)
            ? (value as EditorTheme)
            : DEFAULT_SETTINGS.editorTheme;
    }

    private normalizePreviewTheme(theme: string): PreviewTheme {
        const value = String(theme ?? "")
            .trim()
            .toLowerCase();
        return PREVIEW_THEME_OPTIONS.includes(value as PreviewTheme)
            ? (value as PreviewTheme)
            : DEFAULT_SETTINGS.previewTheme;
    }

    private normalizeToolbarTheme(theme: string): AppSettings["theme"] {
        const value = String(theme ?? "")
            .trim()
            .toLowerCase() as AppSettings["theme"];
        return TOOLBAR_THEME_OPTIONS.includes(value)
            ? value
            : DEFAULT_SETTINGS.theme;
    }

    private ensureEditorReady(): boolean {
        if (this.editorInstance) {
            return true;
        }
        if (!this.currentSettings) {
            backendLog("warn", "No settings available to initialise editor yet");
            return false;
        }

        this.initializeEditor(this.currentSettings, "");
        return Boolean(this.editorInstance);
    }

    private registerBackendEvents() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe());
        this.subscriptions = [
            // 打开文件（来自操作系统文件关联或其他后端触发）
            EventsOn(EVENT_OPEN_FILE, async (rawPath: string) => {
                await backendLog("info", "open-file event detected: " + rawPath);
                try {
                    const incomingPath =
                        typeof rawPath === "string"
                            ? rawPath
                            : String(rawPath ?? "");
                    const path = this.normalizePath(incomingPath);
                    await backendLog("info", "normalized path: " + path);
                    if (!path) {
                        await backendLog("error", "path is null");
                        return;
                    }
                    // 从后端读取文件内容
                    const content = await loadDocumentFromBackend(path);
                    await this.handleFileOpened(path, content);
                } catch (error) {
                    await backendLog("error", "open-file event failed: " + error);
                    this.flashStatus("Open failed");
                }
            }),
            EventsOn(EVENT_FILE_OPENED, async (path: string, content: string) => {
                const filePath =
                    typeof path === "string" ? path : String(path ?? "");
                const text =
                    typeof content === "string"
                        ? content
                        : String(content ?? "");
                await this.handleFileOpened(filePath, text);
            }),
            EventsOn(EVENT_FILE_SAVE_REQUESTED, (force?: boolean) => {
                void this.handleSaveRequested(Boolean(force));
            }),
            EventsOn(EVENT_FILE_SAVED, (path: string) => {
                const rawPath =
                    typeof path === "string" ? path : String(path ?? "");
                const filePath = this.normalizePath(rawPath);
                if (filePath) {
                    const previousPath = this.currentFilePath;
                    this.updateDocumentAfterSave(previousPath, filePath);
                    this.setCurrentFile(filePath);
                    this.flashStatus(`Saved: ${filePath}`);
                } else {
                    this.setCurrentFile(null);
                }
            }),
            EventsOn(
                EVENT_FOLDER_OPENED,
                (folderPath: string, rawTree: unknown) => {
                    this.persistActiveDocument();

                    const tree = this.normalizeTree(rawTree);
                    if (!tree) {
                        console.warn(
                            "Received invalid folder tree payload",
                            rawTree,
                        );
                        return;
                    }
                    const normalizedFolder =
                        typeof folderPath === "string" &&
                        folderPath.trim().length > 0
                            ? folderPath.trim()
                            : tree.path;

                    this.sidebarTreeRoot = tree;
                    this.expandedPaths = new Set<string>();
                    if (tree.path) {
                        this.expandedPaths.add(tree.path);
                    }
                    this.currentFolderPath =
                        normalizedFolder || this.currentFolderPath;

                    this.setCurrentFile(null);

                    const label = this.currentFolderPath || normalizedFolder;
                    if (label) {
                        this.flashStatus(`Opened folder: ${label}`);
                    }
                },
            ),
            EventsOn(EVENT_TOOLBAR_THEME_CHANGED, (theme: string) => {
                this.applyToolbarTheme(theme, false);
            }),
            EventsOn(EVENT_EDITOR_THEME_CHANGED, (theme: string) => {
                this.applyEditorTheme(theme, false);
            }),
            EventsOn(EVENT_PREVIEW_THEME_CHANGED, (theme: string) => {
                this.applyPreviewTheme(theme, false);
            }),
        ];
    }

    private async handleFileOpened(path: string, content: string) {
        if (!this.ensureEditorReady()) {
            await backendLog("error", "Editor not ready when handling file open");
            return;
        }

        this.persistActiveDocument();

        const normalized = this.normalizePath(path);
        const doc = this.upsertDocument(normalized, content ?? "");

        this.applyMarkdownContent(doc.currentContent);
        if (normalized) {
            this.setCurrentFile(normalized);
        } else {
            this.setCurrentFile(null);
        }

        const label = normalized || doc.name;
        this.flashStatus(`Opened: ${label}`);
    }

    private async handleSaveRequested(forceDialog: boolean) {
        if (!this.ensureEditorReady()) {
            console.warn("Ignoring save request - editor not ready");
            return;
        }

        const previousPath = this.currentFilePath;
        const markdown = this.persistActiveDocument() ?? this.getMarkdown();

        await (this.pendingActiveSync ?? Promise.resolve());

        try {
            const savedPath = await saveDocument(markdown, forceDialog);
            const filePath =
                typeof savedPath === "string"
                    ? savedPath
                    : String(savedPath ?? "");
            if (filePath) {
                this.updateDocumentAfterSave(previousPath, filePath);
                this.setCurrentFile(filePath);
                this.flashStatus(`Saved: ${filePath}`);
            } else {
                this.updateStatusForPath(this.currentFilePath);
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (message === SAVE_CANCELLED_ERROR) {
                this.clearStatusFlash();
                this.updateStatusForPath(this.currentFilePath);
                return;
            }
            console.error("Save failed", error);
            this.flashStatus("Save failed");
        }
    }

    private setCurrentFile(path: string | null) {
        const normalized =
            typeof path === "string" && path.trim().length > 0
                ? path.trim()
                : null;
        this.currentFilePath = normalized;
        this.activeFilePath = normalized;

        if (normalized) {
            const folder = this.extractDirectory(normalized);
            if (folder) {
                this.currentFolderPath = folder;
            }
            this.expandAncestors(normalized);
        }

        this.renderSidebar();
        this.renderTabs();
        if (!this.statusResetTimeout) {
            this.updateStatusForPath(normalized);
        }

        const backendPath = normalized ?? "";
        this.pendingActiveSync = setActiveFile(backendPath).catch((error) => {
            console.warn("setActiveFile failed", error);
        });
    }

    private extractDirectory(path: string): string | null {
        const trimmed = path.trim();
        if (!trimmed) {
            return null;
        }

        const lastSlash = Math.max(
            trimmed.lastIndexOf("/"),
            trimmed.lastIndexOf("\\"),
        );
        if (lastSlash <= 0) {
            return null;
        }

        return trimmed.slice(0, lastSlash);
    }

    private updateStatusForPath(path: string | null) {
        const trimmed = path?.trim() ?? "";
        if (trimmed) {
            this.updateStatus(`Editing: ${trimmed}`);
            return;
        }
        if (this.currentFolderPath) {
            this.updateStatus(`Browsing: ${this.currentFolderPath}`);
            return;
        }
        this.updateStatus("No document loaded");
    }

    private updateStatus(message: string) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
    }

    private flashStatus(message: string, duration = 2200) {
        this.updateStatus(message);
        this.clearStatusFlash();
        this.statusResetTimeout = window.setTimeout(() => {
            this.statusResetTimeout = undefined;
            this.updateStatusForPath(this.currentFilePath);
        }, duration);
    }

    private clearStatusFlash() {
        if (this.statusResetTimeout) {
            window.clearTimeout(this.statusResetTimeout);
            this.statusResetTimeout = undefined;
        }
    }

    private getMarkdown(): string {
        if (typeof this.editorInstance?.getMarkdown === "function") {
            return this.editorInstance.getMarkdown();
        }
        if (typeof this.editorInstance?.cm?.getValue === "function") {
            return this.editorInstance.cm.getValue();
        }
        if (typeof this.editorInstance?.cm?.getDoc === "function") {
            const doc = this.editorInstance.cm.getDoc();
            if (doc?.getValue) {
                return doc.getValue();
            }
        }
        return "";
    }

    private applyMarkdownContent(markdown: string) {
        const apply = () => {
            if (!this.editorInstance) {
                return;
            }
            this.suppressChangeHandler = true;
            try {
                if (typeof this.editorInstance?.setMarkdown === "function") {
                    this.editorInstance.setMarkdown(markdown ?? "");
                } else if (
                    typeof this.editorInstance?.cm?.getDoc === "function"
                ) {
                    const doc = this.editorInstance.cm.getDoc();
                    if (doc?.setValue) {
                        doc.setValue(markdown ?? "");
                    }
                    if (doc?.clearHistory) {
                        doc.clearHistory();
                    }
                }
            } finally {
                this.suppressChangeHandler = false;
            }
        };

        if (!this.editorInstance) {
            const handler = () => {
                this.events.off("editor:ready", handler);
                apply();
            };
            this.events.on("editor:ready", handler);
            return;
        }

        apply();
    }

    private persistActiveDocument(): string | null {
        if (!this.editorInstance) {
            return null;
        }
        const activePath = this.currentFilePath;
        if (!activePath) {
            return null;
        }
        const doc = this.openDocuments.get(activePath);
        if (!doc) {
            return null;
        }
        const markdown = this.getMarkdown();
        doc.currentContent = markdown;
        const wasDirty = doc.isDirty;
        doc.isDirty = doc.currentContent !== doc.savedContent;
        if (doc.isDirty !== wasDirty) {
            this.renderTabs();
        }
        return markdown;
    }

    private switchToDocument(path: string) {
        const normalized = this.normalizePath(path);
        if (!normalized || normalized === this.currentFilePath) {
            return;
        }
        this.persistActiveDocument();
        const doc = this.openDocuments.get(normalized);
        if (!doc) {
            return;
        }
        this.applyMarkdownContent(doc.currentContent);
        this.setCurrentFile(normalized);
    }

    private renderTabs() {
        if (!this.tabBarElement) {
            return;
        }

        this.tabBarElement.innerHTML = "";
        if (!this.tabOrder.length) {
            const placeholder = document.createElement("div");
            placeholder.className = "px-3 py-2 text-xs text-white/50";
            placeholder.textContent = "No documents open";
            this.tabBarElement.appendChild(placeholder);
            return;
        }

        const activePath = this.currentFilePath;
        for (const path of this.tabOrder) {
            const doc = this.openDocuments.get(path);
            if (!doc) {
                continue;
            }
            const isActive = path === activePath;

            const tab = document.createElement("div");
            tab.className = isActive
                ? "group flex items-center gap-2 px-2 py-1 rounded-t border border-white/20 bg-black/60 text-white whitespace-nowrap"
                : "group flex items-center gap-2 px-2 py-1 rounded-t border border-transparent text-white/80 hover:text-white hover:bg-black/20 whitespace-nowrap";
            tab.setAttribute("data-tab-path", path);

            const labelButton = document.createElement("button");
            labelButton.type = "button";
            labelButton.dataset.path = path;
            labelButton.setAttribute("data-tab-path", path);
            labelButton.title = doc.path;
            labelButton.textContent = `${doc.name}${doc.isDirty ? " *" : ""}`;
            labelButton.className = isActive
                ? "text-left whitespace-nowrap cursor-default"
                : "text-left whitespace-nowrap cursor-pointer";
            labelButton.disabled = isActive;
            if (!isActive) {
                labelButton.addEventListener("click", () =>
                    this.switchToDocument(path),
                );
            }

            const closeButton = document.createElement("button");
            closeButton.type = "button";
            closeButton.title = `Close ${doc.name}`;
            closeButton.textContent = "×";
            closeButton.className =
                "ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white focus:opacity-100 focus:outline-none";
            closeButton.addEventListener("click", (event) => {
                event.stopPropagation();
                event.preventDefault();
                this.closeDocument(path);
            });

            tab.append(labelButton, closeButton);
            this.tabBarElement.appendChild(tab);
        }
    }

    private async ensureDirectoryChildren(node: FileTreeNode): Promise<void> {
        if (!node.isDir) {
            return;
        }
        if (node.children && node.children.length > 0) {
            return;
        }
        if (node.hasChildren === false) {
            node.children = [];
            return;
        }

        try {
            const entries = await loadDirectoryEntries(node.path);
            const children = entries
                .map((entry) => this.normalizeTree(entry))
                .filter((child): child is FileTreeNode => Boolean(child));
            node.children = children;
            node.hasChildren = children.length > 0;
        } catch (error) {
            console.error(
                `Failed to load directory entries for ${node.path}`,
                error,
            );
            node.children = [];
            node.hasChildren = false;
        }
    }

    private async ensureAncestorsLoaded(path: string): Promise<void> {
        if (!this.sidebarTreeRoot) {
            return;
        }

        const normalizedTarget = this.normalizePath(path);
        if (!normalizedTarget) {
            return;
        }

        const ancestors = this.collectAncestorPaths(normalizedTarget);
        let currentNode: FileTreeNode | null = this.sidebarTreeRoot;

        if (currentNode.isDir && !currentNode.children) {
            await this.ensureDirectoryChildren(currentNode);
        }
        this.expandedPaths.add(currentNode.path);

        for (const ancestor of ancestors) {
            if (!ancestor || !currentNode) {
                continue;
            }

            if (!currentNode.children || currentNode.children.length === 0) {
                await this.ensureDirectoryChildren(currentNode);
            }

            const child: FileTreeNode | null =
                currentNode.children?.find((candidate) =>
                    this.pathsEqual(candidate.path, ancestor),
                ) ?? null;

            if (!child) {
                continue;
            }

            if (child.isDir) {
                if (!child.children || child.children.length === 0) {
                    await this.ensureDirectoryChildren(child);
                }
                this.expandedPaths.add(child.path);
            }

            currentNode = child;
        }

        this.renderSidebar();
    }

    private collectAncestorPaths(path: string): string[] {
        if (!this.sidebarTreeRoot) {
            return [];
        }

        const normalized = this.normalizePath(path);
        const rootPath = this.sidebarTreeRoot.path;
        if (!normalized || !rootPath) {
            return [];
        }

        const ancestors: string[] = [];
        const seen = new Set<string>();
        let current = this.extractDirectory(normalized);
        const rootKey = this.normalizePathForCompare(rootPath);

        while (current) {
            const key = this.normalizePathForCompare(current);
            if (!key || seen.has(key)) {
                break;
            }
            seen.add(key);
            ancestors.unshift(current);
            if (key === rootKey) {
                break;
            }
            const next = this.extractDirectory(current);
            if (!next) {
                break;
            }
            current = next;
        }

        return ancestors;
    }

    private normalizePathForCompare(path: string | null | undefined): string {
        if (typeof path !== "string") {
            return "";
        }
        return path
            .replace(/[\\/]+$/, "")
            .trim()
            .toLowerCase();
    }

    private pathsEqual(
        a: string | null | undefined,
        b: string | null | undefined,
    ): boolean {
        return (
            this.normalizePathForCompare(a) === this.normalizePathForCompare(b)
        );
    }

    private handleEditorChange() {
        if (this.suppressChangeHandler) {
            return;
        }
        const activePath = this.currentFilePath;
        if (!activePath) {
            return;
        }
        const doc = this.openDocuments.get(activePath);
        if (!doc) {
            return;
        }
        if (!doc.isDirty) {
            doc.isDirty = true;
            this.renderTabs();
        }
    }

    private updateDocumentAfterSave(
        previousPath: string | null,
        savedPath: string,
    ) {
        const normalized = this.normalizePath(savedPath);
        if (!normalized) {
            return;
        }

        const previous = this.normalizePath(previousPath) || normalized;
        let doc =
            this.openDocuments.get(previous) ??
            this.openDocuments.get(normalized);
        if (!doc) {
            doc = this.upsertDocument(normalized, this.getMarkdown());
        }

        const oldPath = doc.path;
        if (!doc.currentContent) {
            doc.currentContent = this.getMarkdown();
        }
        doc.savedContent = doc.currentContent;
        doc.isDirty = false;

        if (normalized !== oldPath) {
            this.openDocuments.delete(oldPath);
            doc.path = normalized;
            doc.name = this.displayNameForPath(normalized);
            this.openDocuments.set(normalized, doc);
            this.tabOrder = this.tabOrder.map((p) =>
                p === oldPath ? normalized : p,
            );
        }

        if (!this.tabOrder.includes(normalized)) {
            this.tabOrder.push(normalized);
        }

        this.renderTabs();
    }

    private upsertDocument(path: string, content: string): OpenDocument {
        const normalized = this.normalizePath(path);
        const resolvedContent = content ?? "";
        if (!normalized) {
            const fallbackPath = `untitled-${Date.now()}`;
            const fallback: OpenDocument = {
                path: fallbackPath,
                name: "Untitled",
                savedContent: resolvedContent,
                currentContent: resolvedContent,
                isDirty: false,
            };
            this.openDocuments.set(fallbackPath, fallback);
            if (!this.tabOrder.includes(fallbackPath)) {
                this.tabOrder.push(fallbackPath);
            }
            return fallback;
        }

        let doc = this.openDocuments.get(normalized);
        if (!doc) {
            doc = {
                path: normalized,
                name: this.displayNameForPath(normalized),
                savedContent: resolvedContent,
                currentContent: resolvedContent,
                isDirty: false,
            };
            this.openDocuments.set(normalized, doc);
        } else {
            doc.savedContent = resolvedContent;
            doc.currentContent = resolvedContent;
            doc.isDirty = false;
        }

        if (!this.tabOrder.includes(normalized)) {
            this.tabOrder.push(normalized);
        }

        return doc;
    }

    private displayNameForPath(path: string): string {
        const normalized = this.normalizePath(path);
        if (!normalized) {
            return "Untitled";
        }
        const lastSlash = Math.max(
            normalized.lastIndexOf("/"),
            normalized.lastIndexOf("\\"),
        );
        if (lastSlash >= 0 && lastSlash < normalized.length - 1) {
            return normalized.slice(lastSlash + 1);
        }
        return normalized;
    }

    private normalizePath(input: string | null | undefined): string {
        if (typeof input !== "string") {
            return "";
        }
        return input.trim();
    }

    private closeDocument(path: string) {
        const normalized = this.normalizePath(path);
        if (!normalized) {
            return;
        }

        const doc = this.openDocuments.get(normalized);
        if (!doc) {
            return;
        }

        const wasActive = normalized === this.currentFilePath;
        const index = this.tabOrder.indexOf(normalized);

        this.openDocuments.delete(normalized);
        if (index >= 0) {
            this.tabOrder.splice(index, 1);
        }

        const label = doc.name || normalized || "Untitled";

        if (wasActive) {
            const fallbackPath =
                this.tabOrder[index] ??
                this.tabOrder[index - 1] ??
                (this.tabOrder.length ? this.tabOrder[0] : "");

            if (fallbackPath) {
                const fallbackDoc = this.openDocuments.get(fallbackPath);
                this.setCurrentFile(fallbackPath);
                this.applyMarkdownContent(fallbackDoc?.currentContent ?? "");
            } else {
                this.setCurrentFile(null);
                this.applyMarkdownContent(DEFAULT_WELCOME_MARKDOWN);
            }
        } else {
            this.renderTabs();
        }

        this.flashStatus(`Closed: ${label}`);
    }

    private renderMenuBar() {
        if (!this.menuElement) {
            return;
        }

        this.menuElement.innerHTML = "";
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }

        const menus: Array<{
            id: string;
            label: string;
            builder: (dropdown: HTMLDivElement) => void;
        }> = [
            {
                id: "file",
                label: "File",
                builder: (dropdown) => this.buildFileMenu(dropdown),
            },
            {
                id: "theme",
                label: "Theme",
                builder: (dropdown) => this.buildThemeMenu(dropdown),
            },
            {
                id: "help",
                label: "Help",
                builder: (dropdown) => this.buildHelpMenu(dropdown),
            },
        ];

        menus.forEach((menu) => {
            const wrapper = document.createElement("div");
            wrapper.className = "relative";

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = menu.label;
            button.className =
                "px-2 py-1 rounded hover:bg-white/10 focus:outline-none";
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                if (this.openMenuId === menu.id) {
                    this.closeMenu();
                } else {
                    this.openMenuId = menu.id;
                    this.renderMenuBar();
                }
            });

            wrapper.appendChild(button);

            if (this.openMenuId === menu.id) {
                const dropdown = document.createElement("div");
                dropdown.className = "no-drag dropdown-menu";
                dropdown.style.position = "fixed";
                dropdown.style.minWidth = "12rem";
                dropdown.style.maxWidth = "20rem";
                dropdown.style.maxHeight = "20rem"; // 设置最大高度
                dropdown.style.overflowY = "auto"; // 超出时显示滚动条
                dropdown.style.background = "rgba(15, 15, 20, 0.95)";
                dropdown.style.border = "1px solid rgba(255, 255, 255, 0.1)";
                dropdown.style.borderRadius = "0.375rem";
                dropdown.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.35)";
                dropdown.style.padding = "0.25rem 0";
                dropdown.style.zIndex = "2000";

                // 禁用下拉菜单的右键菜单
                dropdown.addEventListener("contextmenu", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                });

                menu.builder(dropdown);

                // 确保在计算位置前，wrapper 已经在 DOM 中
                this.menuElement.appendChild(wrapper);

                const rect = button.getBoundingClientRect();

                // 直接使用 button 的位置，但确保计算正确
                dropdown.style.top = `${rect.bottom + window.scrollY + 6}px`;
                dropdown.style.left = `${rect.left + window.scrollX}px`;

                console.log("Menu positioning debug:", {
                    buttonRect: rect,
                    scrollX: window.scrollX,
                    scrollY: window.scrollY,
                    dropdownTop: dropdown.style.top,
                    dropdownLeft: dropdown.style.left,
                    buttonBottom: rect.bottom,
                    buttonLeft: rect.left,
                });

                document.body.appendChild(dropdown);
                this.activeDropdown = dropdown;
            } else {
                this.menuElement.appendChild(wrapper);
            }
        });
    }

    private buildFileMenu(dropdown: HTMLDivElement) {
        this.createMenuItem(dropdown, "Open…", () =>
            this.handleOpenFileDialog(),
        );
        this.createMenuItem(dropdown, "Open Folder…", () =>
            this.handleOpenFolderDialog(),
        );
        this.createMenuSeparator(dropdown);
        this.createMenuItem(dropdown, "Save", () =>
            this.handleSaveRequested(false),
        );
        this.createMenuItem(dropdown, "Save As…", () =>
            this.handleSaveRequested(true),
        );
    }

    private buildThemeMenu(dropdown: HTMLDivElement) {
        const sectionHeader = (title: string) => {
            const header = document.createElement("div");
            header.textContent = title;
            header.style.fontSize = "11px";
            header.style.opacity = "0.6";
            header.style.textTransform = "uppercase";
            header.style.letterSpacing = "0.08em";
            header.style.padding = "6px 12px 2px";
            dropdown.appendChild(header);
        };

        sectionHeader("Toolbar Theme");
        TOOLBAR_THEME_OPTIONS.forEach((option) =>
            this.createMenuItem(
                dropdown,
                this.displayNameForTheme(option),
                () => this.applyToolbarTheme(option, true),
                { selected: this.currentSettings?.theme === option },
            ),
        );

        this.createMenuSeparator(dropdown);
        sectionHeader("Editor Theme");
        EDITOR_THEME_OPTIONS.forEach((option) =>
            this.createMenuItem(
                dropdown,
                this.displayNameForTheme(option),
                () => this.applyEditorTheme(option, true),
                { selected: this.currentSettings?.editorTheme === option },
            ),
        );

        this.createMenuSeparator(dropdown);
        sectionHeader("Preview Theme");
        PREVIEW_THEME_OPTIONS.forEach((option) =>
            this.createMenuItem(
                dropdown,
                this.displayNameForTheme(option),
                () => this.applyPreviewTheme(option, true),
                { selected: this.currentSettings?.previewTheme === option },
            ),
        );
    }

    private buildHelpMenu(dropdown: HTMLDivElement) {
        this.createMenuItem(dropdown, "About MarkdownPad…", () =>
            this.handleShowAbout(),
        );
    }

    private createMenuItem(
        dropdown: HTMLDivElement,
        label: string,
        action: () => void | Promise<void>,
        options?: { selected?: boolean; shortcut?: string },
    ) {
        const item = document.createElement("button");
        item.type = "button";
        item.className =
            "w-full px-3 py-1 text-left text-sm text-white/85 hover:bg-white/10 flex items-center gap-2";
        item.addEventListener("click", (event) => {
            event.stopPropagation();
            const result = action();
            this.closeMenu();
            if (result instanceof Promise) {
                result.catch((error) =>
                    console.warn("menu action failed", error),
                );
            }
        });

        const marker = document.createElement("span");
        marker.textContent = options?.selected ? "✓" : "";
        marker.style.width = "1rem";

        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        labelSpan.style.flex = "1";

        item.append(marker, labelSpan);

        if (options?.shortcut) {
            const shortcut = document.createElement("span");
            shortcut.textContent = options.shortcut;
            shortcut.style.opacity = "0.6";
            item.append(shortcut);
        }

        dropdown.appendChild(item);
    }

    private createMenuSeparator(dropdown: HTMLDivElement) {
        const separator = document.createElement("div");
        separator.style.margin = "4px 0";
        separator.style.borderTop = "1px solid rgba(255, 255, 255, 0.07)";
        dropdown.appendChild(separator);
    }

    private closeMenu() {
        if (this.openMenuId === null) {
            return;
        }
        this.openMenuId = null;
        this.renderMenuBar();
    }

    private displayNameForTheme(theme: string): string {
        return theme
            .split("-")
            .map((part) =>
                part.length ? part[0].toUpperCase() + part.slice(1) : part,
            )
            .join(" ");
    }

    private handleOpenFileDialog() {
        openFileDialog().catch((error) =>
            console.warn("Open file dialog failed", error),
        );
    }

    private handleOpenFolderDialog() {
        openFolderDialog().catch((error) =>
            console.warn("Open folder dialog failed", error),
        );
    }

    private handleShowAbout() {
        this.showAboutDialog();
    }

    /**
     * 显示关于对话框，包含GitHub超链接
     */
    private showAboutDialog(): void {
        // 移除现有的模态框
        this.removeExistingModal();

        // 创建遮罩层
        const overlay = document.createElement("div");
        overlay.className =
            "fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center";
        overlay.id = "modal-overlay";
        overlay.style.zIndex = "99999";

        // 创建模态框容器
        const modal = document.createElement("div");
        modal.className =
            "bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100";
        modal.style.minWidth = "320px";
        modal.style.maxWidth = "500px";
        modal.style.borderLeftColor = "#3b82f6";
        modal.style.borderLeftWidth = "4px";

        // 创建标题栏
        const header = document.createElement("div");
        header.className =
            "flex items-center gap-3 px-6 py-4 border-b border-gray-700";

        const icon = document.createElement("img");
        icon.src = APP_ICON;
        icon.alt = "App Icon";
        icon.className = "w-8 h-8";

        const titleElement = document.createElement("h3");
        titleElement.textContent = `About ${APP_NAME}`;
        titleElement.className = "text-lg font-semibold text-white flex-1";

        const closeButton = document.createElement("button");
        closeButton.innerHTML = "×";
        closeButton.className =
            "text-gray-400 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors";
        closeButton.addEventListener("click", () => this.removeExistingModal());

        header.appendChild(icon);
        header.appendChild(titleElement);
        header.appendChild(closeButton);

        // 创建内容区域
        const content = document.createElement("div");
        content.className = "px-6 py-4";

        // 应用信息
        const appInfo = document.createElement("div");
        appInfo.className = "text-gray-200 leading-relaxed space-y-2";
        
        const appName = document.createElement("div");
        appName.textContent = APP_NAME;
        appName.className = "text-xl font-semibold text-white mb-3";
        
        const version = document.createElement("div");
        version.textContent = `Version: ${APP_VERSION}`;
        version.className = "text-sm text-gray-300";
        
        const author = document.createElement("div");
        author.textContent = `Author: ${APP_AUTHOR}`;
        author.className = "text-sm text-gray-300";
        
        // GitHub 链接
        const githubContainer = document.createElement("div");
        githubContainer.className = "mt-4";
        
        const githubLabel = document.createElement("div");
        githubLabel.textContent = "GitHub: ";
        githubLabel.className = "text-sm text-gray-300 inline";
        
        const githubLink = document.createElement("a");
        githubLink.textContent = APP_GITHUB;
        githubLink.href = APP_GITHUB;
        githubLink.target = "_blank";
        githubLink.className = "text-blue-400 hover:text-blue-300 underline text-sm transition-colors";
        githubLink.addEventListener("click", (e) => {
            e.preventDefault();
            // 使用 Wails 的 BrowserOpenURL 方法打开链接
            if (window.go && window.go.main && window.go.main.App) {
                window.go.main.App.BrowserOpenURL(APP_GITHUB);
            } else {
                // 备用方案：使用 window.open
                window.open(APP_GITHUB, "_blank");
            }
        });
        
        githubContainer.appendChild(githubLabel);
        githubContainer.appendChild(githubLink);
        
        appInfo.appendChild(appName);
        appInfo.appendChild(version);
        appInfo.appendChild(author);
        appInfo.appendChild(githubContainer);
        
        content.appendChild(appInfo);

        // 创建按钮区域
        const footer = document.createElement("div");
        footer.className =
            "flex justify-end gap-3 px-6 py-4 border-t border-gray-700";

        const okButton = document.createElement("button");
        okButton.textContent = "OK";
        okButton.className = "px-4 py-2 rounded font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white";
        okButton.addEventListener("click", () => this.removeExistingModal());

        footer.appendChild(okButton);

        // 组装模态框
        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // 添加到页面
        document.body.appendChild(overlay);

        // 添加动画效果
        setTimeout(() => {
            modal.style.transform = "scale(1)";
        }, 10);

        // 点击遮罩层关闭
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                this.removeExistingModal();
            }
        });

        // ESC键关闭
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                this.removeExistingModal();
                document.removeEventListener("keydown", handleKeyDown);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
    }

    private renderSidebar() {
        if (!this.sidebarElement) {
            return;
        }

        this.sidebarElement.innerHTML = "";

        if (!this.sidebarTreeRoot) {
            // 创建空状态容器
            const emptyState = document.createElement("div");
            emptyState.className = "flex flex-col items-center justify-center h-full px-4 py-8 text-center";
            
            // 创建logo区域
            const logoSection = document.createElement("div");
            logoSection.className = "mb-6";
            
            // 创建logo图标（使用SVG）
            const logoIcon = document.createElement("div");
            logoIcon.className = "w-12 h-12 mx-auto mb-3";
            logoIcon.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full text-blue-400">
                    <path d="M3 7V5C3 3.89543 3.89543 3 5 3H9L11 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 11H16M8 15H12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            
            // 创建应用名称
            const appName = document.createElement("div");
            appName.className = "text-lg font-semibold text-white mb-1";
            appName.textContent = APP_NAME;
            
            // 创建版本信息
            const version = document.createElement("div");
            version.className = "text-xs text-white/60 mb-4";
            version.textContent = `Version: ${APP_VERSION}`;
            
            logoSection.appendChild(logoIcon);
            logoSection.appendChild(appName);
            logoSection.appendChild(version);
            
            // 创建打开文件夹按钮
            const openButton = document.createElement("button");
            openButton.className = "flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium text-sm";
            openButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5">
                    <path d="M3 7V5C3 3.89543 3.89543 3 5 3H9L11 5H19C20.1046 5 21 5.89543 21 7V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 11H16M8 15H12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Open Folder
            `;
            
            // 添加点击事件
            openButton.addEventListener("click", () => {
                this.handleOpenFolderDialog();
            });
            
            // 创建提示文本
            const hintText = document.createElement("div");
            hintText.className = "text-xs text-white/50 mt-4";
            hintText.textContent = "Select a folder to browse your files";
            
            // 组装空状态
            emptyState.appendChild(logoSection);
            emptyState.appendChild(openButton);
            emptyState.appendChild(hintText);
            
            // 为整个空状态添加右键菜单支持
            emptyState.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.showContextMenu(event, null);
            });

            this.sidebarElement.appendChild(emptyState);
            return;
        }

        const container = document.createElement("div");
        container.className = "py-2 text-sm";

        this.renderTreeNode(this.sidebarTreeRoot, 0, container);
        this.sidebarElement.appendChild(container);
    }

    private renderTreeNode(
        node: FileTreeNode,
        depth: number,
        container: HTMLElement,
    ) {
        const row = document.createElement("div");
        row.className =
            "flex items-center gap-2 px-3 py-1 text-sm text-white/80 hover:bg-white/10 cursor-pointer select-none";
        row.style.paddingLeft = `${depth * 16}px`;
        row.setAttribute("data-path", node.path);

        if (node.path === this.activeFilePath) {
            row.classList.add("bg-white/15", "text-white");
        }

        const marker = document.createElement("span");
        marker.className = "w-5 text-xs";
        if (node.isDir) {
            const hasChildren =
                Boolean(node.children?.length) || node.hasChildren;
            if (node.isLoading) {
                marker.textContent = "⌛";
            } else if (hasChildren) {
                marker.textContent = this.expandedPaths.has(node.path)
                    ? "📂"
                    : "📁";
            } else {
                marker.textContent = "📁";
            }
        } else {
            marker.textContent = "📚";
        }

        const label = document.createElement("span");
        label.className = "flex-1 truncate";
        label.textContent = node.name || node.path || "(unnamed)";

        row.append(marker, label);

        // 添加右键菜单事件监听器
        row.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showContextMenu(event, node);
        });

        if (node.isDir) {
            row.addEventListener("click", (event) => {
                event.stopPropagation();
                const expanded = this.expandedPaths.has(node.path);
                if (expanded) {
                    this.expandedPaths.delete(node.path);
                    this.renderSidebar();
                    return;
                }

                if (node.hasChildren === false && !node.children?.length) {
                    return;
                }

                this.expandedPaths.add(node.path);

                if (
                    (!node.children || node.children.length === 0) &&
                    node.hasChildren !== false &&
                    !node.isLoading
                ) {
                    node.isLoading = true;
                    this.renderSidebar();
                    this.ensureDirectoryChildren(node)
                        .catch((error) =>
                            console.error(
                                `Failed to load directory entries for ${node.path}`,
                                error,
                            ),
                        )
                        .finally(() => {
                            node.isLoading = false;
                            if (!node.children || node.children.length === 0) {
                                node.hasChildren = false;
                                this.expandedPaths.delete(node.path);
                            }
                            this.renderSidebar();
                        });
                } else {
                    this.renderSidebar();
                }
            });
        } else {
            row.addEventListener("click", (event) => {
                event.stopPropagation();
                this.openFile(node.path);
            });
        }

        container.appendChild(row);

        if (
            node.isDir &&
            node.children &&
            node.children.length > 0 &&
            this.expandedPaths.has(node.path)
        ) {
            node.children.forEach((child) =>
                this.renderTreeNode(child, depth + 1, container),
            );
        }
    }

    private expandAncestors(path: string) {
        void this.ensureAncestorsLoaded(path);
    }

    private normalizeTree(raw: unknown): FileTreeNode | null {
        if (!raw || typeof raw !== "object") {
            return null;
        }
        const value = raw as Record<string, unknown>;
        const name =
            typeof value.name === "string"
                ? value.name
                : String(value.name ?? "");
        const path =
            typeof value.path === "string" && value.path.length > 0
                ? value.path
                : name;
        const isDir =
            typeof value.isDir === "boolean"
                ? value.isDir
                : Boolean(value.isDir);

        let children: FileTreeNode[] | undefined;
        if (Array.isArray(value.children)) {
            children = value.children
                .map((child) => this.normalizeTree(child))
                .filter((child): child is FileTreeNode => Boolean(child));
            if (!children.length) {
                children = undefined;
            }
        }

        const node: FileTreeNode = {
            name,
            path,
            isDir,
            hasChildren:
                typeof value.hasChildren === "boolean"
                    ? Boolean(value.hasChildren)
                    : Boolean(children && children.length > 0),
        };

        if (children) {
            node.children = children;
            node.hasChildren = children.length > 0;
        }

        return node;
    }

    private async ensureEditorAssets() {
        const assetRoot = "/vendor/editor.md/";
        const libRoot = `${assetRoot}lib/`;

        // 首先加载 jQuery
        await this.loadScriptOnce("/vendor/jquery/jquery.min.js", "jquery");
        if (window.jQuery && !window.$) {
            window.$ = window.jQuery;
        }

        // 加载样式表
        await this.loadStylesheetOnce(
            `${assetRoot}css/editormd.min.css`,
            "editormd-css",
        );
        await this.loadStylesheetOnce(
            `${libRoot}codemirror/codemirror.min.css`,
            "codemirror-css",
        );
        await this.loadStylesheetOnce(
            `${libRoot}codemirror/addon/dialog/dialog.css`,
            "codemirror-dialog-css",
        );
        await this.loadStylesheetOnce(
            `${libRoot}codemirror/addon/search/matchesonscrollbar.css`,
            "codemirror-search-css",
        );

        // 按正确顺序加载脚本 - CodeMirror 核心必须先加载
        await this.loadScriptOnce(
            `${libRoot}codemirror/codemirror.min.js`,
            "codemirror",
        );

        // 等待 CodeMirror 完全初始化
        await this.waitForCodeMirror();

        // 然后加载 CodeMirror 扩展
        await this.loadScriptOnce(
            `${libRoot}codemirror/modes.min.js`,
            "codemirror-modes",
        );
        await this.loadScriptOnce(
            `${libRoot}codemirror/addons.min.js`,
            "codemirror-addons",
        );

        // 加载其他依赖
        await this.loadScriptOnce(`${libRoot}marked.min.js`, "marked");
        await this.loadScriptOnce(`${libRoot}prettify.min.js`, "prettify");

        // 最后加载 Editor.md
        await this.loadScriptOnce(`${assetRoot}editormd.min.js`, "editormd");

        if (window.editormd) {
            await this.loadScriptOnce(`${libRoot}en.js`, "language");
            window.editormd.mouseOrTouch = (mouseEventType: string) =>
                mouseEventType || "click";
            window.editormd.defaults = window.editormd.defaults || {};
            window.editormd.defaults.lang = window.editormd.defaults.lang || {};
            window.editormd.defaults.lang.toolbar = {
                undo: "Undo (Ctrl+Z)",
                redo: "Redo (Ctrl+Y)",
                bold: "Bold",
                del: "Delete line",
                italic: "Italic",
                quote: "Quote",
                ucwords:
                    "Convert each word to uppercase",
                uppercase: "Convert selected text to uppercase",
                lowercase: "Convert selected text to lowercase",
                h1: "Heading 1",
                h2: "Heading 2",
                h3: "Heading 3",
                h4: "Heading 4",
                h5: "Heading 5",
                h6: "Heading 6",
                "list-ul": "Unordered list",
                "list-ol": "Ordered list",
                hr: "Horizontal rule",
                link: "Link",
                "reference-link": "Reference link",
                image: "Add image",
                code: "Inline code",
                "preformatted-text":
                    "Preformatted text / Code block (indented code)",
                "code-block":
                    "Code block (multiple languages)",
                table: "Add table",
                datetime: "Date time",
                emoji: "Emoji",
                "html-entities":
                    "HTML entities",
                pagebreak: "Page break",
                "goto-line": "Go to line",
                watch: "Close real-time preview",
                unwatch: "Open real-time preview",
                preview:
                    "Full screen preview HTML (Press Shift + ESC to exit)",
                fullscreen:
                    "Full screen (Press ESC to exit)",
                clear: "Clear",
                search: "Search",
                help: "Help",
                info: "About MarkdownDaoNotePad",
            };
        }
    }

    private async waitForCodeMirror(): Promise<void> {
        return new Promise((resolve, reject) => {
            const maxAttempts = 50; // Wait for 5 seconds
            let attempts = 0;

            const checkCodeMirror = () => {
                attempts++;

                if (
                    (window as any).CodeMirror &&
                    typeof (window as any).CodeMirror.fromTextArea ===
                        "function"
                ) {
                    resolve();
                    return;
                }

                if (attempts >= maxAttempts) {
                    reject(
                        new Error("CodeMirror failed to load within timeout"),
                    );
                    return;
                }

                setTimeout(checkCodeMirror, 100);
            };

            checkCodeMirror();
        });
    }

    private async waitForEditorReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const maxAttempts = 100; // Wait for 10 seconds
            let attempts = 0;

            const checkEditor = () => {
                attempts++;

                // 检查编辑器实例是否存在且 CodeMirror 实例已准备好
                if (
                    this.editorInstance &&
                    this.editorInstance.cm &&
                    typeof this.editorInstance.cm.setOption === "function"
                ) {
                    console.log("Editor CodeMirror instance is ready");
                    resolve();
                    return;
                }

                if (attempts >= maxAttempts) {
                    console.warn("Timeout waiting for editor to be ready");
                    reject(
                        new Error("Editor failed to initialize within timeout"),
                    );
                    return;
                }

                setTimeout(checkEditor, 100);
            };

            checkEditor();
        });
    }

    private initializeWithCodeMirror(initialMarkdown: string) {
        console.log("Initialize editor with native CodeMirror");

        // 清空编辑器元素
        this.editorElement.innerHTML = "";

        // 创建 textarea
        const textarea = document.createElement("textarea");
        textarea.id = "codemirror-textarea";
        textarea.value = initialMarkdown;
        textarea.style.width = "100%";
        textarea.style.height = "100%";
        textarea.style.border = "none";
        textarea.style.outline = "none";
        textarea.style.resize = "none";

        this.editorElement.appendChild(textarea);

        // 使用原生 CodeMirror
        const CodeMirror = (window as any).CodeMirror;
        if (!CodeMirror) {
            throw new Error("CodeMirror not available");
        }

        const cm = CodeMirror.fromTextArea(textarea, {
            mode: "markdown",
            theme: "monokai",
            lineNumbers: true,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: true,
            styleActiveLine: true,
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        });

        // 设置尺寸
        cm.setSize("100%", "100%");

        // 确保 CodeMirror 容器可见
        const cmElement = cm.getWrapperElement();
        if (cmElement) {
            cmElement.style.width = "100%";
            cmElement.style.height = "100%";
            cmElement.style.display = "block";
            cmElement.style.visibility = "visible";
            cmElement.style.position = "relative";
            cmElement.style.overflow = "hidden";
            console.log(
                "CodeMirror element styles set:",
                cmElement.style.cssText,
            );
        }

        // 确保编辑器元素也有正确的样式
        this.editorElement.style.display = "block";
        this.editorElement.style.visibility = "visible";
        this.editorElement.style.position = "relative";
        this.editorElement.style.overflow = "hidden";

        // 创建模拟的编辑器实例
        this.editorInstance = {
            cm: cm,
            getMarkdown: () => cm.getValue(),
            setMarkdown: (content: string) => cm.setValue(content),
            setEditorTheme: (theme: string) => cm.setOption("theme", theme),
            setPreviewTheme: (theme: string) => {
                console.log("Preview theme set:", theme);
            },
            setTheme: (theme: string) => {
                console.log("Toolbar theme set:", theme);
            },
        };

        // 监听变化
        cm.on("change", () => {
            this.handleEditorChange();
        });

        // 强制刷新显示
        setTimeout(() => {
            cm.refresh();
            console.log("CodeMirror refreshed");

            // 再次确保元素可见
            if (cmElement) {
                cmElement.style.display = "block";
                cmElement.style.visibility = "visible";
            }
        }, 100);

        console.log("Native CodeMirror initialized successfully");
    }

    private async openFile(path: string) {
        const target = path?.trim();
        if (!target) {
            return;
        }

        try {
            const content = await loadDocumentFromBackend(target);
            this.persistActiveDocument();
            const doc = this.upsertDocument(target, content ?? "");
            this.setCurrentFile(doc.path);
            this.applyMarkdownContent(doc.currentContent);
            this.flashStatus(`Opened: ${doc.path}`);
        } catch (error) {
            backendLog('ERROR', `Failed to open file '${target}': ${error}`);
            this.flashStatus("Failed to open file");
        }
    }

    private loadStylesheetOnce(href: string, key: string): Promise<void> {
        if (this.loadedStyles.has(key)) {
            return Promise.resolve();
        }

        if (document.querySelector(`link[data-editor-asset="${key}"]`)) {
            this.loadedStyles.add(key);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.dataset.editorAsset = key;
            link.onload = () => {
                this.loadedStyles.add(key);
                resolve();
            };
            link.onerror = () =>
                reject(
                    new Error(`Failed to load stylesheet ${key} from ${href}`),
                );
            document.head.appendChild(link);
        });
    }

    private loadScriptOnce(src: string, key: ScriptAssetKey): Promise<void> {
        const globals: Partial<Record<ScriptAssetKey, () => boolean>> = {
            jquery: () => Boolean(window.jQuery),
            editormd: () => Boolean(window.editormd),
            codemirror: () => Boolean((window as any).CodeMirror),
            "codemirror-modes": () =>
                Boolean((window as any).CodeMirror?.defineMode),
            "codemirror-addons": () =>
                Boolean((window as any).CodeMirror?.commands),
            marked: () => Boolean((window as any).marked),
            prettify: () => typeof (window as any).prettyPrint === "function",
            language: () => Boolean(window.language),
        };

        const isLoaded = globals[key];
        if (isLoaded && isLoaded()) {
            this.loadedScripts.add(key);
            return Promise.resolve();
        }

        if (
            this.loadedScripts.has(key) ||
            document.querySelector(`script[data-editor-asset="${key}"]`)
        ) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.charset = "utf-8";
            script.src = src;
            script.async = false; // 改为同步加载以确保顺序
            script.dataset.editorAsset = key;
            script.onload = () => {
                this.loadedScripts.add(key);
                // 对于关键脚本，添加额外等待时间确保完全初始化
                if (key === "codemirror" || key === "editormd") {
                    setTimeout(() => resolve(), 50);
                } else {
                    resolve();
                }
            };
            script.onerror = () =>
                reject(new Error(`Failed to load script ${key} from ${src}`));
            document.head.appendChild(script);
        });
    }

    private showContextMenu(event: MouseEvent, target: FileTreeNode | null) {
        // 隐藏现有的右键菜单
        this.hideContextMenu();

        this.contextMenuTarget = target;

        const menu = document.createElement("div");
        menu.className = "no-drag";
        menu.style.position = "fixed";
        menu.style.top = `${event.clientY}px`;
        menu.style.left = `${event.clientX}px`;
        menu.style.minWidth = "12rem";
        menu.style.maxWidth = "20rem";
        menu.style.maxHeight = "20rem";
        menu.style.overflowY = "auto";
        menu.style.background = "rgba(15, 15, 20, 0.95)";
        menu.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        menu.style.borderRadius = "0.375rem";
        menu.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.35)";
        menu.style.padding = "0.25rem 0";
        menu.style.zIndex = "3000";
        menu.style.backdropFilter = "blur(8px)";

        if (target) {
            // 右键点击文件或目录
            if (target.isDir) {
                // 文件夹右键菜单：新建文件、新建文件夹、重命名、删除
                const newFileInFolderItem = this.createContextMenuItem(
                    "New File",
                    "📄",
                    () => {
                        this.handleNewFileInFolder(target);
                    },
                );
                const newFolderInFolderItem = this.createContextMenuItem(
                    "New Folder",
                    "📁",
                    () => {
                        this.handleNewFolderInFolder(target);
                    },
                );
                const renameItem = this.createContextMenuItem(
                    "Rename",
                    "✏️",
                    () => {
                        this.handleRenameItem(target);
                    },
                );
                const deleteItem = this.createContextMenuItem(
                    "Delete",
                    "🗑️",
                    () => {
                        this.handleDeleteItem(target);
                    },
                );

                menu.appendChild(newFileInFolderItem);
                menu.appendChild(newFolderInFolderItem);
                menu.appendChild(renameItem);
                menu.appendChild(deleteItem);
            } else {
                // 文件右键菜单：重命名、删除
                const renameItem = this.createContextMenuItem(
                    "Rename",
                    "✏️",
                    () => {
                        this.handleRenameItem(target);
                    },
                );
                const deleteItem = this.createContextMenuItem(
                    "Delete",
                    "🗑️",
                    () => {
                        this.handleDeleteItem(target);
                    },
                );

                menu.appendChild(renameItem);
                menu.appendChild(deleteItem);
            }
        } else {
            // 右键点击空白区域
            const newFileItem = this.createContextMenuItem(
                "New File",
                "📄",
                () => {
                    this.handleNewFile();
                },
            );
            const newFolderItem = this.createContextMenuItem(
                "New Folder",
                "📁",
                () => {
                    this.handleNewFolder();
                },
            );
            const refreshItem = this.createContextMenuItem("Refresh", "🔄", () => {
                this.handleRefresh();
            });
            menu.appendChild(newFileItem);
            menu.appendChild(newFolderItem);
            menu.appendChild(refreshItem);
        }

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // 添加全局点击事件监听器来隐藏菜单
        const hideMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                this.hideContextMenu();
                document.removeEventListener("click", hideMenu);
            }
        };

        // 延迟添加事件监听器，避免立即触发
        setTimeout(() => {
            document.addEventListener("click", hideMenu);
        }, 10);
    }

    private createContextMenuItem(
        text: string,
        icon: string,
        onClick: () => void,
    ): HTMLDivElement {
        const item = document.createElement("div");
        item.className =
            "flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 cursor-pointer";
        item.innerHTML = `
            <span class="w-5 text-xs">${icon}</span>
            <span>${text}</span>
        `;
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick();
            this.hideContextMenu();
        });
        return item;
    }

    private hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
        this.contextMenuTarget = null;
    }

    private async handleNewFile() {
        if (!this.sidebarTreeRoot) {
            await this.showMessageDialog(
                "Please open a folder first",
                "MarkdownDaoNote",
                "warning",
            );
            return;
        }

        this.showInlineInput("New File", "", (fileName) => {
            this.createFileInRoot(fileName);
        });
    }

    private async handleNewFileInFolder(targetFolder: FileTreeNode) {
        this.showInlineInput(
            `New File in "${targetFolder.name}"`,
            "",
            (fileName) => {
                this.createFileInFolder(targetFolder, fileName);
            },
        );
    }

    private async handleNewFolderInFolder(targetFolder: FileTreeNode) {
        this.showInlineInput(
            `New Folder in "${targetFolder.name}"`,
            "",
            (folderName) => {
                this.createFolderInFolder(targetFolder, folderName);
            },
        );
    }

    private async handleNewFolder() {
        if (!this.sidebarTreeRoot) {
            await this.showMessageDialog(
                "Please open a folder first",
                "MarkdownDaoNote",
                "warning",
            );
            return;
        }

        this.showInlineInput("New Folder", "", (folderName) => {
            this.createFolderInRoot(folderName);
        });
    }

    private showInlineInput(
        placeholder: string,
        defaultValue: string,
        onConfirm: (value: string) => void,
    ) {
        // 创建输入框行
        const inputRow = document.createElement("div");
        inputRow.className =
            "flex items-center gap-2 px-3 py-1 text-sm text-white/80 bg-blue-500/20 border border-blue-400/30 rounded";
        inputRow.style.marginLeft = "0px";

        const input = document.createElement("input");
        input.type = "text";
        input.value = defaultValue;
        input.placeholder = placeholder;
        input.className =
            "flex-1 bg-transparent border-none outline-none text-white/90 placeholder-white/50";
        input.style.fontSize = "14px";

        // 添加输入框到侧边栏顶部
        const sidebarContainer = this.sidebarElement.querySelector(".py-2");
        if (sidebarContainer) {
            sidebarContainer.insertBefore(
                inputRow,
                sidebarContainer.firstChild,
            );
        } else {
            this.sidebarElement.insertBefore(
                inputRow,
                this.sidebarElement.firstChild,
            );
        }

        inputRow.appendChild(input);

        // 自动聚焦并选中文本
        input.focus();
        input.select();

        // 处理确认
        const handleConfirm = () => {
            const value = input.value.trim();
            if (value) {
                onConfirm(value);
            }
            inputRow.remove();
        };

        // 处理取消
        const handleCancel = () => {
            inputRow.remove();
        };

        // 事件监听
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
            }
        });

        // 点击外部取消
        const handleClickOutside = (e: MouseEvent) => {
            if (!inputRow.contains(e.target as Node)) {
                handleCancel();
                document.removeEventListener("click", handleClickOutside);
            }
        };

        setTimeout(() => {
            document.addEventListener("click", handleClickOutside);
        }, 100);
    }

    private async createFileInRoot(fileName: string) {
        if (!fileName.trim()) return;

        // 验证文件名
        if (fileName.includes("/") || fileName.includes("\\")) {
            await this.showMessageDialog(
                "File name cannot contain path separators",
                "MarkdownDaoNote",
                "error",
            );
            return;
        }

        const targetPath = `${this.sidebarTreeRoot!.path}/${fileName}`;

        try {
            const success = await createFile(targetPath);
            if (success) {
                this.refreshSidebar();
                this.showStatus("File created successfully", "success");
            } else {
                this.showStatus("File creation failed", "error");
            }
        } catch (error) {
            console.error("File creation failed:", error);
            this.showStatus("File creation failed", "error");
        }
    }

    private async createFileInFolder(
        targetFolder: FileTreeNode,
        fileName: string,
    ) {
        if (!fileName.trim()) return;

        // 验证文件名
        if (fileName.includes("/") || fileName.includes("\\")) {
            await this.showMessageDialog(
                "File name cannot contain path separators",
                "MarkdownDaoNote",
                "error",
            );
            return;
        }

        const targetPath = `${targetFolder.path}/${fileName}`;

        try {
            const success = await createFile(targetPath);
            if (success) {
                // 确保目标文件夹是展开状态
                this.expandedPaths.add(targetFolder.path);

                // 刷新侧边栏
                this.refreshSidebar();

                // 延迟聚焦到新创建的文件
                setTimeout(() => {
                    this.focusOnNewFile(targetPath);
                }, 100);

                this.showStatus(
                    `File created successfully in "${targetFolder.name}"`,
                    "success",
                );
            } else {
                this.showStatus("File creation failed", "error");
            }
        } catch (error) {
            console.error("File creation failed:", error);
            this.showStatus("File creation failed", "error");
        }
    }

    private async createFolderInRoot(folderName: string) {
        if (!folderName.trim()) return;

        // 验证文件夹名
        if (folderName.includes("/") || folderName.includes("\\")) {
            await this.showMessageDialog(
                "Folder name cannot contain path separators",
                "MarkdownDaoNote",
                "error",
            );
            return;
        }

        const targetPath = `${this.sidebarTreeRoot!.path}/${folderName}`;

        try {
            const success = await createDirectory(targetPath);
            if (success) {
                this.refreshSidebar();
                this.showStatus("Folder created successfully", "success");
            } else {
                this.showStatus("Folder creation failed", "error");
            }
        } catch (error) {
            console.error("Folder creation failed:", error);
            this.showStatus("Folder creation failed", "error");
        }
    }

    private async createFolderInFolder(
        targetFolder: FileTreeNode,
        folderName: string,
    ) {
        if (!folderName.trim()) return;

        // 验证文件夹名
        if (folderName.includes("/") || folderName.includes("\\")) {
            await this.showMessageDialog(
                "Folder name cannot contain path separators",
                "MarkdownDaoNote",
                "error",
            );
            return;
        }

        const targetPath = `${targetFolder.path}/${folderName}`;
        try {
            const success = await createDirectory(targetPath);
            if (success) {
                // 确保目标文件夹是展开状态
                this.expandedPaths.add(targetFolder.path);

                // 刷新侧边栏
                this.refreshSidebar();

                // 延迟聚焦到新创建的文件夹
                setTimeout(() => {
                    this.focusOnNewFile(targetPath);
                }, 100);

                this.showStatus(
                    `Folder created successfully in "${targetFolder.name}"`,
                    "success",
                );
            } else {
                this.showStatus("Folder creation failed", "error");
            }
        } catch (error) {
            console.error("Folder creation failed:", error);
            this.showStatus("Folder creation failed", "error");
        }
    }

    private focusOnNewFile(filePath: string) {
        // 查找新创建的文件元素
        const fileElements =
            this.sidebarElement.querySelectorAll("[data-path]");
        let targetElement: HTMLElement | null = null;

        // 标准化路径，统一使用正斜杠进行比较
        const normalizedTargetPath = filePath.replace(/\\/g, "/");

        for (const element of fileElements) {
            const path = element.getAttribute("data-path");
            if (path) {
                const normalizedElementPath = path.replace(/\\/g, "/");
                console.log(
                    "Compare paths:",
                    normalizedElementPath,
                    "vs",
                    normalizedTargetPath,
                );
                if (normalizedElementPath === normalizedTargetPath) {
                    targetElement = element as HTMLElement;
                    break;
                }
            }
        }

        if (targetElement) {
            // 高亮显示新文件
            targetElement.classList.add(
                "bg-blue-500/30",
                "border",
                "border-blue-400/50",
            );

            // 滚动到新文件位置
            targetElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });

            // 3秒后移除高亮
            setTimeout(() => {
                targetElement?.classList.remove(
                    "bg-blue-500/30",
                    "border",
                    "border-blue-400/50",
                );
            }, 3000);

            console.log("Focus on new file successfully:", filePath);
        } else {
            console.log("New file element not found:", filePath);
            console.log("All file paths:");
            for (const element of fileElements) {
                const path = element.getAttribute("data-path");
                console.log("- ", path);
            }
        }
    }

    private async handleRenameItem(target: FileTreeNode) {
        const itemType = target.isDir ? "Folder" : "File";
        this.showInlineInput(`Rename ${itemType}`, target.name, (newName) => {
            this.renameItem(target, newName);
        });
    }

    private async renameItem(target: FileTreeNode, newName: string) {
        if (!newName.trim()) return;

        const itemType = target.isDir ? "Folder" : "File";

        // 验证新名称
        if (newName.includes("/") || newName.includes("\\")) {
            await this.showMessageDialog(
                "Name cannot contain path separators",
                "MarkdownDaoNote",
                "error",
            );
            return;
        }

        if (newName.trim() === "") {
            await this.showMessageDialog(
                "Name cannot be empty",
                "MarkdownDaoNote",
                "error",
            );
            return;
        }

        // 如果名称没有变化，直接返回
        if (newName === target.name) return;

        // 使用更安全的路径处理方式，支持 Windows 和 Unix 路径
        const oldPath = target.path;

        // 查找最后一个路径分隔符（支持 Windows 和 Unix）
        const forwardSlashIndex = oldPath.lastIndexOf("/");
        const backSlashIndex = oldPath.lastIndexOf("\\");
        const lastSlashIndex = Math.max(forwardSlashIndex, backSlashIndex);

        const parentPath =
            lastSlashIndex > 0 ? oldPath.substring(0, lastSlashIndex) : "";

        // 使用原始路径的分隔符
        const separator = oldPath.includes("\\") ? "\\" : "/";
        const newPath = parentPath
            ? `${parentPath}${separator}${newName}`
            : newName;

        try {
            const success = await renameFile(oldPath, newPath);
            if (success) {
                this.updateOpenDocumentsAfterRename(
                    oldPath,
                    newPath,
                    target.isDir,
                );
                // 刷新侧边栏
                this.refreshSidebar();
                this.showStatus(`${itemType} renamed successfully`, "success");
            } else {
                this.showStatus(`${itemType} renamed failed`, "error");
            }
        } catch (error) {
            console.error(`Rename ${itemType} failed:`, error);
            this.showStatus(`${itemType} renamed failed`, "error");
        }
    }

    private updateOpenDocumentsAfterRename(
        oldPath: string,
        newPath: string,
        wasDirectory: boolean,
    ) {
        const updates: Array<{ oldPath: string; newPath: string }> = [];
        const normalizedOld = this.normalizePath(oldPath);
        const normalizedNew = this.normalizePath(newPath);
        const separator = normalizedOld.includes("\\") ? "\\" : "/";

        if (wasDirectory) {
            const normalizedOldPrefix = normalizedOld.endsWith(separator)
                ? normalizedOld
                : normalizedOld + separator;
            const normalizedNewPrefix = normalizedNew.endsWith(separator)
                ? normalizedNew
                : normalizedNew + separator;

            this.openDocuments.forEach((_doc, docPath) => {
                const normalizedDocPath = this.normalizePath(docPath);
                if (
                    normalizedDocPath === normalizedOld ||
                    normalizedDocPath.startsWith(normalizedOldPrefix)
                ) {
                    const suffix = normalizedDocPath.slice(
                        normalizedOldPrefix.length,
                    );
                    const updatedPath = `${normalizedNewPrefix}${suffix}`;
                    updates.push({ oldPath: docPath, newPath: updatedPath });
                }
            });
        } else {
            updates.push({ oldPath: normalizedOld, newPath: normalizedNew });
        }

        if (!updates.length) {
            return;
        }

        if (wasDirectory && this.currentFolderPath) {
            const currentFolderNormalized = this.normalizePath(
                this.currentFolderPath,
            );
            const oldDirPrefix = normalizedOld.endsWith(separator)
                ? normalizedOld
                : normalizedOld + separator;
            if (currentFolderNormalized === normalizedOld) {
                this.currentFolderPath = newPath;
            } else if (currentFolderNormalized.startsWith(oldDirPrefix)) {
                const suffix = currentFolderNormalized.slice(
                    oldDirPrefix.length,
                );
                const replacementPrefix = normalizedNew.endsWith(separator)
                    ? normalizedNew
                    : normalizedNew + separator;
                this.currentFolderPath = `${replacementPrefix}${suffix}`;
            }
        }

        let activePathUpdated = false;

        updates.forEach(({ oldPath: oldDocPath, newPath: newDocPath }) => {
            const doc = this.openDocuments.get(oldDocPath);
            if (!doc) {
                return;
            }

            this.openDocuments.delete(oldDocPath);
            doc.path = newDocPath;
            doc.name = this.displayNameForPath(newDocPath);
            this.openDocuments.set(newDocPath, doc);

            this.tabOrder = this.tabOrder.map((path) =>
                path === oldDocPath ? newDocPath : path,
            );

            if (this.currentFilePath === oldDocPath) {
                this.currentFilePath = newDocPath;
                this.activeFilePath = newDocPath;
                activePathUpdated = true;
            }
        });

        if (activePathUpdated) {
            this.renderTabs();
            this.updateStatusForPath(this.currentFilePath);
        } else {
            this.renderTabs();
        }
    }

    private async handleDeleteItem(target: FileTreeNode) {
        const itemType = target.isDir ? "Folder" : "File";
        this.showDeleteConfirm(target, itemType);
    }

    private showDeleteConfirm(target: FileTreeNode, itemType: string) {
        // 创建删除确认框
        const confirmRow = document.createElement("div");
        confirmRow.className =
            "flex items-center gap-2 px-3 py-2 text-sm text-white bg-red-600 border border-red-500 rounded";
        confirmRow.style.position = "sticky";
        confirmRow.style.top = "0";
        confirmRow.style.zIndex = "1000";
        confirmRow.style.marginLeft = "0px";
        confirmRow.style.marginBottom = "8px";

        // 警告图标
        const warningIcon = document.createElement("span");
        warningIcon.textContent = "⚠️";
        warningIcon.className = "text-red-400";

        // 确认文本
        const confirmText = document.createElement("span");
        confirmText.textContent = `Are you sure you want to delete ${itemType} "${target.name}"?`;
        confirmText.className = "flex-1 text-white";

        // 按钮容器
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "flex items-center gap-2";

        // 确认按钮
        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Confirm";
        confirmBtn.className =
            "px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors";
        confirmBtn.addEventListener("click", () => {
            this.executeDelete(target, itemType);
            confirmRow.remove();
        });

        // 取消按钮
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.className =
            "px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded transition-colors";
        cancelBtn.addEventListener("click", () => {
            confirmRow.remove();
        });

        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);

        confirmRow.appendChild(warningIcon);
        confirmRow.appendChild(confirmText);
        confirmRow.appendChild(buttonContainer);

        // 添加确认框到侧边栏顶部，使用 sticky 定位
        const sidebarContainer = this.sidebarElement.querySelector(".py-2");
        if (sidebarContainer) {
            sidebarContainer.insertBefore(
                confirmRow,
                sidebarContainer.firstChild,
            );
        } else {
            this.sidebarElement.insertBefore(
                confirmRow,
                this.sidebarElement.firstChild,
            );
        }

        // 点击外部取消
        const handleClickOutside = (e: MouseEvent) => {
            if (!confirmRow.contains(e.target as Node)) {
                confirmRow.remove();
                document.removeEventListener("click", handleClickOutside);
            }
        };

        setTimeout(() => {
            document.addEventListener("click", handleClickOutside);
        }, 100);
    }

    private async executeDelete(target: FileTreeNode, itemType: string) {
        try {
            const success = await deleteFile(target.path);
            if (success) {
                // 刷新侧边栏
                this.refreshSidebar();
                this.showStatus(`${itemType} deleted successfully`, "success");
            } else {
                this.showStatus(`${itemType} deleted failed`, "error");
            }
        } catch (error) {
            console.error(`Delete ${itemType} failed:`, error);
            this.showStatus(`${itemType} deleted failed`, "error");
        }
    }

    private showTabContextMenu(event: MouseEvent) {
        // 隐藏现有的上下文菜单
        this.hideContextMenu();

        // 检查是否点击在标签上
        const target = event.target as HTMLElement;
        const tabElement = target.closest("[data-tab-path]") as HTMLElement;

        if (!tabElement) {
            return; // 如果没有点击在标签上，不显示菜单
        }

        const tabPath = tabElement.getAttribute("data-tab-path");
        if (!tabPath) return;

        // 创建菜单
        const menu = document.createElement("div");
        menu.className =
            "absolute bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-32 z-50";
        menu.style.position = "fixed";
        menu.style.top = `${event.clientY}px`;
        menu.style.left = `${event.clientX}px`;
        menu.style.minWidth = "8rem";
        menu.style.maxWidth = "12rem";
        menu.style.maxHeight = "20rem";
        menu.style.overflowY = "auto";
        menu.style.background = "rgba(31, 41, 55, 0.95)";
        menu.style.border = "1px solid rgba(75, 85, 99, 0.8)";
        menu.style.borderRadius = "0.375rem";
        menu.style.boxShadow = "0 10px 25px -3px rgba(0, 0, 0, 0.3)";
        menu.style.padding = "0.25rem 0";
        menu.style.zIndex = "1000";
        menu.style.backdropFilter = "blur(8px)";

        // 菜单项
        const menuItems = [
            { text: "Close", icon: "×", action: () => this.closeTab(tabPath) },
            {
                text: "Close Others",
                icon: "⊠",
                action: () => this.closeOtherTabs(tabPath),
            },
            {
                text: "Close to the Right",
                icon: "⊡",
                action: () => this.closeTabsToRight(tabPath),
            },
            { text: "Close All", icon: "⊟", action: () => this.closeAllTabs() },
        ];

        menuItems.forEach((item, index) => {
            const menuItem = document.createElement("div");
            menuItem.className =
                "px-3 py-2 text-sm text-white/90 hover:bg-white/10 cursor-pointer flex items-center gap-2";
            menuItem.innerHTML = `
                <span class="text-xs w-4 text-center">${item.icon}</span>
                <span>${item.text}</span>
            `;

            menuItem.onclick = () => {
                item.action();
                menu.remove();
            };

            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);
        this.contextMenu = menu;

        // 点击外部关闭菜单
        const closeOnOutsideClick = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node)) {
                menu.remove();
                document.removeEventListener("click", closeOnOutsideClick);
            }
        };
        setTimeout(
            () => document.addEventListener("click", closeOnOutsideClick),
            100,
        );
    }

    private closeTab(tabPath: string) {
        console.log("Close tab:", tabPath);
        this.closeDocument(tabPath);
        this.showStatus(`Close tab: ${tabPath}`, "success");
    }

    private closeOtherTabs(currentTabPath: string) {
        console.log("Close other tabs, keep:", currentTabPath);
        const tabsToClose = this.tabOrder.filter(
            (path) => path !== currentTabPath,
        );
        for (const path of tabsToClose) {
            this.closeDocument(path);
        }
        this.showStatus(`Close other tabs (${tabsToClose.length} tabs)`, "success");
    }

    private closeTabsToRight(tabPath: string) {
        console.log("Close tabs to the right, from:", tabPath);
        const currentIndex = this.tabOrder.indexOf(tabPath);
        if (currentIndex === -1) return;

        const tabsToClose = this.tabOrder.slice(currentIndex + 1);
        for (const path of tabsToClose) {
            this.closeDocument(path);
        }
        this.showStatus(`Close tabs to the right (${tabsToClose.length} tabs)`, "success");
    }

    private closeAllTabs() {
        console.log("Close all tabs");
        const allTabs = [...this.tabOrder];
        for (const path of allTabs) {
            this.closeDocument(path);
        }
        this.showStatus(`Close all tabs (${allTabs.length} tabs)`, "success");
    }

    private async handleRefresh() {
        if (!this.sidebarTreeRoot) {
            this.showStatus("No folder opened", "error");
            return;
        }

        try {
            this.showStatus("Refreshing...", "info");
            await this.refreshSidebar();
            this.showStatus("Refresh completed", "success");
        } catch (error) {
            console.error("Refresh failed:", error);
            this.showStatus("Refresh failed", "error");
        }
    }

    private async refreshSidebar() {
        if (this.sidebarTreeRoot) {
            // 重新加载根目录
            try {
                const entries = await loadDirectoryEntries(
                    this.sidebarTreeRoot.path,
                );
                this.sidebarTreeRoot.children = entries;

                // 重新加载所有已展开的文件夹
                await this.refreshExpandedFolders();

                this.renderSidebar();
            } catch (error) {
                console.error("Refresh sidebar failed:", error);
            }
        }
    }

    private async refreshExpandedFolders() {
        const expandedPathsArray = Array.from(this.expandedPaths);
        console.log("Refresh expanded folders:", expandedPathsArray);

        for (const path of expandedPathsArray) {
            try {
                const entries = await loadDirectoryEntries(path);
                // 找到对应的文件夹节点并更新其内容
                this.updateFolderChildren(this.sidebarTreeRoot!, path, entries);
            } catch (error) {
                console.error(`Refresh folder failed ${path}:`, error);
            }
        }
    }

    private updateFolderChildren(
        node: FileTreeNode,
        targetPath: string,
        newChildren: FileTreeNode[],
    ): boolean {
        if (node.path === targetPath) {
            node.children = newChildren;
            return true;
        }

        if (node.children) {
            for (const child of node.children) {
                if (this.updateFolderChildren(child, targetPath, newChildren)) {
                    return true;
                }
            }
        }

        return false;
    }

    private showStatus(
        message: string,
        type: "success" | "error" | "info" = "info",
    ) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
            this.statusElement.className = `px-3 py-1 text-xs ${
                type === "success"
                    ? "text-green-400"
                    : type === "error"
                      ? "text-red-400"
                      : "text-white/60"
            }`;

            // 3 seconds to clear the status
            if (this.statusResetTimeout) {
                clearTimeout(this.statusResetTimeout);
            }
            this.statusResetTimeout = window.setTimeout(() => {
                this.statusElement.textContent = "No document loaded";
                this.statusElement.className = "text-xs text-white/60";
            }, 3000);
        }
    }
}
