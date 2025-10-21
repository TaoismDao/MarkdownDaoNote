package app

import (
	"errors"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var errSaveCancelled = errors.New("save cancelled")

// SaveDocument persists the current editor content to disk.
func (a *App) SaveDocument(content string, forceDialog bool) (string, error) {
	if a.ctx == nil {
		return "", errors.New("application not ready")
	}

	targetPath := a.currentFilePath
	if forceDialog || strings.TrimSpace(targetPath) == "" {
		defaultFilename := ""
		if targetPath != "" {
			defaultFilename = filepath.Base(targetPath)
		}

		selection, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:            "Save Markdown File",
			DefaultDirectory: a.defaultDialogDirectory(),
			DefaultFilename:  defaultFilename,
			Filters:          markdownFilters,
		})
		if err != nil {
			runtime.LogErrorf(a.ctx, "save dialog failed: %v", err)
			_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
				Type:    runtime.ErrorDialog,
				Title:   "Unable to Save File",
				Message: err.Error(),
			})
			return "", err
		}
		if selection == "" {
			return "", errSaveCancelled
		}
		targetPath = selection
	}

	if strings.TrimSpace(targetPath) == "" {
		return "", errors.New("no target file selected")
	}

	if err := a.files.Write(targetPath, content); err != nil {
		runtime.LogErrorf(a.ctx, "failed writing '%s': %v", targetPath, err)
		_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Unable to Save File",
			Message: err.Error(),
		})
		return "", err
	}

	a.setCurrentFile(targetPath)
	runtime.EventsEmit(a.ctx, eventFileSaved, targetPath)
	return targetPath, nil
}
