package app

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	eventFileOpened          = "file:opened"
	eventFileSaveRequested   = "file:save-requested"
	eventFileSaved           = "file:saved"
	eventFolderOpened        = "folder:opened"
	eventEditorThemeChanged  = "theme:editor-changed"
	eventPreviewThemeChanged = "theme:preview-changed"
	eventToolbarThemeChanged = "theme:toolbar-changed"
	defaultEditorTheme       = "default"
	defaultPreviewTheme      = "default"
	defaultToolbarTheme      = "default"
)

var (
	aboutTitle   = "About MarkdownDaoNote"
	aboutVersion = "1.0.1"
	aboutAuthor  = "Taoism Dao"
	aboutGitHub  = "https://github.com/TaoismDao/MarkdownDaoNote"
)

var editorThemeOptions = []string{
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
}

var previewThemeOptions = []string{
	"default",
	"dark",
}

var toolbarThemeOptions = []string{
	"default",
	"dark",
}

var markdownFilters = []runtime.FileFilter{
	{
		DisplayName: "Markdown files",
		Pattern:     "*.md;*.markdown;*.mdown;*.mkd;*.mdx",
	},
	{
		DisplayName: "All files",
		Pattern:     "*",
	},
}

// Menu builds the application menubar.
func (a *App) Menu() *menu.Menu {
	root := menu.NewMenu()

	fileMenu := root.AddSubmenu("File")
	fileMenu.AddText("Open…", keys.CmdOrCtrl("o"), func(*menu.CallbackData) {
		a.handleOpen()
	})
	fileMenu.AddText("Open Folder…", keys.Combo("o", keys.CmdOrCtrlKey, keys.ShiftKey), func(*menu.CallbackData) {
		a.handleOpenFolder()
	})

	saveItem := fileMenu.AddText("Save", keys.CmdOrCtrl("s"), func(*menu.CallbackData) {
		a.requestSave(false)
	})
	saveItem.Disabled = true
	a.saveMenu = saveItem

	fileMenu.AddText("Save As…", keys.Combo("s", keys.CmdOrCtrlKey, keys.ShiftKey), func(*menu.CallbackData) {
		a.requestSave(true)
	})

	editorTheme := a.currentEditorTheme
	if editorTheme == "" {
		editorTheme = a.loadEditorThemePreference()
	}
	editorTheme = a.normalizeEditorTheme(editorTheme)
	a.currentEditorTheme = editorTheme

	previewTheme := a.currentPreviewTheme
	if previewTheme == "" {
		previewTheme = a.loadPreviewThemePreference()
	}
	previewTheme = a.normalizePreviewTheme(previewTheme)
	a.currentPreviewTheme = previewTheme

	toolbarTheme := a.currentToolbarTheme
	if toolbarTheme == "" {
		toolbarTheme = a.loadToolbarThemePreference()
	}
	toolbarTheme = a.normalizeToolbarTheme(toolbarTheme)
	a.currentToolbarTheme = toolbarTheme

	themeMenu := root.AddSubmenu("Theme")

	editorThemeMenu := themeMenu.AddSubmenu("EditorTheme")
	a.editorThemeMenuItems = map[string]*menu.MenuItem{}
	for _, option := range editorThemeOptions {
		opt := option
		item := editorThemeMenu.AddRadio(displayThemeLabel(opt), opt == editorTheme, nil, func(*menu.CallbackData) {
			a.setEditorTheme(opt, true)
		})
		a.editorThemeMenuItems[opt] = item
	}

	previewThemeMenu := themeMenu.AddSubmenu("PreviewTheme")
	a.previewThemeMenuItems = map[string]*menu.MenuItem{}
	for _, option := range previewThemeOptions {
		opt := option
		item := previewThemeMenu.AddRadio(displayThemeLabel(opt), opt == previewTheme, nil, func(*menu.CallbackData) {
			a.setPreviewTheme(opt, true)
		})
		a.previewThemeMenuItems[opt] = item
	}

	toolbarThemeMenu := themeMenu.AddSubmenu("ToolBarTheme")
	a.toolbarThemeMenuItems = map[string]*menu.MenuItem{}
	for _, option := range toolbarThemeOptions {
		opt := option
		item := toolbarThemeMenu.AddRadio(displayThemeLabel(opt), opt == toolbarTheme, nil, func(*menu.CallbackData) {
			a.setToolbarTheme(opt, true)
		})
		a.toolbarThemeMenuItems[opt] = item
	}
	a.setToolbarTheme(toolbarTheme, false)

	helpMenu := root.AddSubmenu("Help")
	helpMenu.AddText("About MarkdownDaoNote", nil, func(*menu.CallbackData) {
		a.showAbout()
	})

	return root
}

func (a *App) handleOpen() {
	if a.ctx == nil {
		return
	}

	selections, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Open Markdown File",
		DefaultDirectory: a.defaultDialogDirectory(),
		Filters:          markdownFilters,
	})
	if err != nil {
		runtime.LogErrorf(a.ctx, "open dialog failed: %v", err)
		_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Unable to Open File",
			Message: err.Error(),
		})
		return
	}
	if len(selections) == 0 {
		return
	}

	for _, selection := range selections {
		trimmed := strings.TrimSpace(selection)
		if trimmed == "" {
			continue
		}

		content, readErr := a.files.Read(trimmed)
		if readErr != nil {
			runtime.LogErrorf(a.ctx, "failed reading '%s': %v", trimmed, readErr)
			_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
				Type:    runtime.ErrorDialog,
				Title:   "Unable to Open File",
				Message: readErr.Error(),
			})
			continue
		}

		a.setCurrentFile(trimmed)
		runtime.EventsEmit(a.ctx, eventFileOpened, trimmed, content)
	}
}

func (a *App) handleOpenFolder() {
	if a.ctx == nil {
		return
	}

	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Open Folder",
		DefaultDirectory: a.defaultDialogDirectory(),
	})
	if err != nil {
		runtime.LogErrorf(a.ctx, "open folder dialog failed: %v", err)
		_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Unable to Open Folder",
			Message: err.Error(),
		})
		return
	}
	if selection == "" {
		return
	}

	tree, buildErr := a.buildDirectoryTree(selection)
	if buildErr != nil {
		runtime.LogErrorf(a.ctx, "failed reading folder '%s': %v", selection, buildErr)
		_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Unable to Read Folder",
			Message: buildErr.Error(),
		})
		return
	}

	normalized := strings.TrimSpace(filepath.Clean(selection))
	a.currentFolderPath = normalized
	a.setCurrentFile("")
	runtime.EventsEmit(a.ctx, eventFolderOpened, normalized, tree)
}

func (a *App) requestSave(force bool) {
	if a.ctx == nil {
		return
	}

	shouldForce := force || strings.TrimSpace(a.currentFilePath) == ""
	runtime.EventsEmit(a.ctx, eventFileSaveRequested, shouldForce)
}

func (a *App) defaultDialogDirectory() string {
	if a.currentFilePath != "" {
		dir := filepath.Dir(a.currentFilePath)
		if dir != "." && dir != "" {
			return dir
		}
	}
	if a.currentFolderPath != "" {
		return a.currentFolderPath
	}
	return ""
}

func (a *App) setCurrentFile(path string) {
	a.currentFilePath = strings.TrimSpace(path)
	if a.currentFilePath != "" {
		dir := strings.TrimSpace(filepath.Dir(a.currentFilePath))
		if dir != "" && dir != "." {
			a.currentFolderPath = filepath.Clean(dir)
		}
	}
	a.updateSaveMenuState(a.currentFilePath != "")

	if a.ctx == nil {
		return
	}

	title := "MarkdownDaoNote"
	if a.currentFilePath != "" {
		title = filepath.Base(a.currentFilePath) + " — MarkdownDaoNote"
	}
	runtime.WindowSetTitle(a.ctx, title)
}

func (a *App) updateSaveMenuState(enabled bool) {
	if a.saveMenu == nil {
		return
	}
	if a.saveMenu.Disabled == !enabled {
		return
	}
	a.saveMenu.Disabled = !enabled
	if a.ctx != nil {
		runtime.MenuUpdateApplicationMenu(a.ctx)
	}
}

func (a *App) setEditorTheme(theme string, emit bool) {
	normalized := a.normalizeEditorTheme(theme)
	if a.currentEditorTheme == normalized && emit {
		// No change requested; nothing to do.
		return
	}

	a.currentEditorTheme = normalized

	menuNeedsUpdate := false
	for option, item := range a.editorThemeMenuItems {
		if item == nil {
			continue
		}
		shouldCheck := option == normalized
		if item.Checked != shouldCheck {
			item.Checked = shouldCheck
			menuNeedsUpdate = true
		}
	}

	if emit {
		a.persistEditorTheme(normalized)
	}

	if a.ctx != nil {
		if menuNeedsUpdate {
			runtime.MenuUpdateApplicationMenu(a.ctx)
		}
		if emit {
			runtime.EventsEmit(a.ctx, eventEditorThemeChanged, normalized)
		}
	}
}

func (a *App) setPreviewTheme(theme string, emit bool) {
	normalized := a.normalizePreviewTheme(theme)
	if a.currentPreviewTheme == normalized && emit {
		return
	}

	a.currentPreviewTheme = normalized

	menuNeedsUpdate := false
	for option, item := range a.previewThemeMenuItems {
		if item == nil {
			continue
		}
		shouldCheck := option == normalized
		if item.Checked != shouldCheck {
			item.Checked = shouldCheck
			menuNeedsUpdate = true
		}
	}

	if emit {
		a.persistPreviewTheme(normalized)
	}

	if a.ctx != nil {
		if menuNeedsUpdate {
			runtime.MenuUpdateApplicationMenu(a.ctx)
		}
		if emit {
			runtime.EventsEmit(a.ctx, eventPreviewThemeChanged, normalized)
		}
	}
}

func (a *App) setToolbarTheme(theme string, emit bool) {
	normalized := a.normalizeToolbarTheme(theme)
	if a.currentToolbarTheme == normalized && emit {
		return
	}

	a.currentToolbarTheme = normalized

	menuNeedsUpdate := false
	for option, item := range a.toolbarThemeMenuItems {
		if item == nil {
			continue
		}
		shouldCheck := option == normalized
		if item.Checked != shouldCheck {
			item.Checked = shouldCheck
			menuNeedsUpdate = true
		}
	}

	if emit {
		a.persistToolbarTheme(normalized)
	}

	if a.ctx != nil {
		if normalized == "dark" {
			runtime.WindowSetDarkTheme(a.ctx)
		} else {
			runtime.WindowSetLightTheme(a.ctx)
		}

		if menuNeedsUpdate {
			runtime.MenuUpdateApplicationMenu(a.ctx)
		}
		if emit {
			runtime.EventsEmit(a.ctx, eventToolbarThemeChanged, normalized)
		}
	}
}

func (a *App) loadEditorThemePreference() string {
	if a.settings == nil {
		return defaultEditorTheme
	}

	settings, err := a.settings.Load()
	if err != nil {
		return defaultEditorTheme
	}

	return a.normalizeEditorTheme(settings.EditorTheme)
}

func (a *App) loadPreviewThemePreference() string {
	if a.settings == nil {
		return defaultPreviewTheme
	}

	settings, err := a.settings.Load()
	if err != nil {
		return defaultPreviewTheme
	}

	return a.normalizePreviewTheme(settings.PreviewTheme)
}

func (a *App) loadToolbarThemePreference() string {
	if a.settings == nil {
		return defaultToolbarTheme
	}

	settings, err := a.settings.Load()
	if err != nil {
		return defaultToolbarTheme
	}

	return a.normalizeToolbarTheme(settings.Theme)
}

func (a *App) normalizeEditorTheme(theme string) string {
	value := strings.ToLower(strings.TrimSpace(theme))
	for _, option := range editorThemeOptions {
		if value == option {
			return option
		}
	}
	return defaultEditorTheme
}

func (a *App) normalizePreviewTheme(theme string) string {
	value := strings.ToLower(strings.TrimSpace(theme))
	for _, option := range previewThemeOptions {
		if value == option {
			return option
		}
	}
	return defaultPreviewTheme
}

func (a *App) normalizeToolbarTheme(theme string) string {
	value := strings.ToLower(strings.TrimSpace(theme))
	for _, option := range toolbarThemeOptions {
		if value == option {
			return option
		}
	}
	return defaultToolbarTheme
}

func (a *App) persistEditorTheme(theme string) {
	if a.settings == nil {
		return
	}

	settings, err := a.settings.Load()
	if err != nil {
		if a.ctx != nil {
			runtime.LogErrorf(a.ctx, "failed loading settings: %v", err)
		}
		return
	}

	if settings.EditorTheme == theme {
		return
	}

	settings.EditorTheme = theme
	if err := a.settings.Save(settings); err != nil && a.ctx != nil {
		runtime.LogErrorf(a.ctx, "failed saving editor theme: %v", err)
	}
}

func (a *App) persistPreviewTheme(theme string) {
	if a.settings == nil {
		return
	}

	settings, err := a.settings.Load()
	if err != nil {
		if a.ctx != nil {
			runtime.LogErrorf(a.ctx, "failed loading settings: %v", err)
		}
		return
	}

	if settings.PreviewTheme == theme {
		return
	}

	settings.PreviewTheme = theme
	if err := a.settings.Save(settings); err != nil && a.ctx != nil {
		runtime.LogErrorf(a.ctx, "failed saving preview theme: %v", err)
	}
}

func (a *App) persistToolbarTheme(theme string) {
	if a.settings == nil {
		return
	}

	settings, err := a.settings.Load()
	if err != nil {
		if a.ctx != nil {
			runtime.LogErrorf(a.ctx, "failed loading settings: %v", err)
		}
		return
	}

	if settings.Theme == theme {
		return
	}

	settings.Theme = theme
	if err := a.settings.Save(settings); err != nil && a.ctx != nil {
		runtime.LogErrorf(a.ctx, "failed saving toolbar theme: %v", err)
	}
}

func displayThemeLabel(value string) string {
	if value == "" {
		return "Default"
	}
	parts := strings.Split(value, "-")
	for i, part := range parts {
		if len(part) == 0 {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + strings.ToLower(part[1:])
	}
	return strings.Join(parts, "-")
}

func (a *App) showAbout() {
	if a.ctx == nil {
		return
	}

	message := fmt.Sprintf("MarkdownDaoNote\n\nVersion: %s\nAuthor: %s\nGitHub: %s", aboutVersion, aboutAuthor, aboutGitHub)

	if _, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.InfoDialog,
		Title:         aboutTitle,
		Message:       message,
		Buttons:       []string{"OK"},
		DefaultButton: "OK",
	}); err != nil {
		runtime.LogErrorf(a.ctx, "about dialog failed: %v", err)
	}
}
