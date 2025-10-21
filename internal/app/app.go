package app

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/yourname/MarkdownDaoNote/internal/services"
)

// App wires backend services for the Wails runtime.
type App struct {
	ctx      context.Context
	files    *services.FileService
	settings *services.SettingsService
	saveMenu *menu.MenuItem

	currentFilePath       string
	currentFolderPath     string
	editorThemeMenuItems  map[string]*menu.MenuItem
	previewThemeMenuItems map[string]*menu.MenuItem
	toolbarThemeMenuItems map[string]*menu.MenuItem
	currentEditorTheme    string
	currentPreviewTheme   string
	currentToolbarTheme   string

	// file to open on startup (from shell association)
	startupOpenPath string

	// whether frontend has reported editor ready
	editorReady bool

	// single instance manager
	singleInstance *SingleInstanceManager
}

// New constructs the application bindings.
func New() *App {
	app := &App{
		files:    services.NewFileService(),
		settings: services.NewSettingsService(),
	}
	app.singleInstance = NewSingleInstanceManager("MarkdownDaoNote", app)
	return app
}

// Startup is called by Wails when the app is ready.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// 检查单实例模式
	isSecondary, err := a.singleInstance.CheckAndHandleSingleInstance(ctx)
	if err != nil {
		log.Printf("Single instance check failed: %v", err)
	}

	if isSecondary {
		// 如果是次要实例，退出
		log.Println("Secondary instance detected, exiting...")
		os.Exit(0)
	}

	// listen for editor ready from frontend
	runtime.EventsOn(a.ctx, "editor:ready", func(_ ...interface{}) {
		a.editorReady = true
		// if there is a pending startup file, send it now
		log.Printf("Event on editor:ready, startupOpenPath: %s", a.startupOpenPath)
		if a.startupOpenPath != "" {
			runtime.EventsEmit(a.ctx, "open-file", a.startupOpenPath)
			// only emit once for this startup file
			a.startupOpenPath = ""
		}
	})
}

// DomReady is called when the frontend DOM is ready and event listeners are registered.
func (a *App) DomReady(ctx context.Context) {
	a.ctx = ctx
}

// Shutdown is called when the app terminates.
func (a *App) Shutdown(ctx context.Context) {
	_ = ctx
	// 清理单实例管理器
	if a.singleInstance != nil {
		if err := a.singleInstance.Close(); err != nil {
			log.Printf("Failed to close single instance manager: %v", err)
		}
	}
}

// LoadFile reads a markdown file from disk.
func (a *App) LoadFile(path string) (string, error) {
	if path == "" {
		return "", errors.New("path is required")
	}

	content, err := a.files.Read(path)
	if err != nil {
		return "", err
	}

	a.setCurrentFile(path)
	return content, nil
}

// SaveFile writes markdown content to disk.
func (a *App) SaveFile(path string, content string) error {
	if path == "" {
		return errors.New("path is required")
	}

	if err := a.files.Write(path, content); err != nil {
		return err
	}

	a.setCurrentFile(path)
	return nil
}

// LoadSettings retrieves persisted editor settings.
func (a *App) LoadSettings() (services.Settings, error) {
	return a.settings.Load()
}

// SetActiveFile updates the current file path without reading from disk.
func (a *App) SetActiveFile(path string) {
	a.setCurrentFile(path)
}

// SetStartupOpenPath sets a file path passed from OS shell to open on launch.
func (a *App) SetStartupOpenPath(path string) {
	a.startupOpenPath = path
}

// OpenFileDialog prompts the user to select one or more files to open.
func (a *App) OpenFileDialog() {
	a.handleOpen()
}

// OpenFolderDialog prompts the user to select a folder.
func (a *App) OpenFolderDialog() {
	a.handleOpenFolder()
}

// RequestSave triggers a save operation from the frontend.
func (a *App) RequestSave(force bool) {
	a.requestSave(force)
}

// ShowAbout displays application information dialog.
func (a *App) ShowAbout() {
	a.showAbout()
}

// SaveSettings persists editor settings.
func (a *App) SaveSettings(settings services.Settings) error {
	return a.settings.Save(settings)
}

// Log allows the frontend to write to the backend log (and file).
// level: debug|info|warn|error
func (a *App) Log(level string, message string) {
	if strings.TrimSpace(message) == "" {
		return
	}
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		log.Printf("[DEBUG] %s", message)
	case "warn", "warning":
		log.Printf("[WARN] %s", message)
	case "error", "err":
		log.Printf("[ERROR] %s", message)
	default:
		log.Printf("[INFO] %s", message)
	}
}

// CreateFile creates a new empty file at the given path.
func (a *App) CreateFile(path string) (bool, error) {
	if path == "" {
		return false, errors.New("path is required")
	}

	err := a.files.CreateFile(path)
	if err != nil {
		return false, err
	}

	return true, nil
}

// CreateDirectory creates a new directory at the given path.
func (a *App) CreateDirectory(path string) (bool, error) {
	if path == "" {
		return false, errors.New("path is required")
	}

	err := a.files.CreateDirectory(path)
	if err != nil {
		return false, err
	}

	return true, nil
}

// DeleteFile removes a file or directory at the given path.
func (a *App) DeleteFile(path string) (bool, error) {
	if path == "" {
		return false, errors.New("path is required")
	}

	err := a.files.DeleteFile(path)
	if err != nil {
		return false, err
	}

	return true, nil
}

// RenameFile renames a file or directory from oldPath to newPath.
func (a *App) RenameFile(oldPath, newPath string) (bool, error) {
	if oldPath == "" || newPath == "" {
		return false, errors.New("both oldPath and newPath are required")
	}

	err := a.files.RenameFile(oldPath, newPath)
	if err != nil {
		return false, err
	}

	return true, nil
}
