package app

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// DirectoryEntry describes a node in the opened folder tree.
type DirectoryEntry struct {
	Name        string           `json:"name"`
	Path        string           `json:"path"`
	IsDir       bool             `json:"isDir"`
	HasChildren bool             `json:"hasChildren"`
	Children    []DirectoryEntry `json:"children,omitempty"`
}

func (a *App) buildDirectoryTree(root string) (DirectoryEntry, error) {
	clean := filepath.Clean(root)
	entry, err := a.readDirectoryEntry(clean, true)
	if err != nil {
		return DirectoryEntry{}, err
	}
	return entry, nil
}

func (a *App) readDirectoryEntry(path string, includeChildren bool) (DirectoryEntry, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return DirectoryEntry{}, err
	}

	entry := DirectoryEntry{
		Name:  info.Name(),
		Path:  path,
		IsDir: info.IsDir(),
	}

	if !info.IsDir() {
		return entry, nil
	}

	if includeChildren {
		children, err := a.readDirectoryChildren(path)
		if err != nil {
			return entry, err
		}
		if len(children) > 0 {
			entry.Children = children
			entry.HasChildren = true
		}
	} else {
		entry.HasChildren = a.directoryHasChildren(path)
	}

	return entry, nil
}

func (a *App) readDirectoryChildren(path string) ([]DirectoryEntry, error) {
	dirEntries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	children := make([]DirectoryEntry, 0, len(dirEntries))

	for _, dirEntry := range dirEntries {
		childPath := filepath.Join(path, dirEntry.Name())

		info, err := dirEntry.Info()
		if err != nil {
			a.logTreeWarning("stat entry", childPath, err)
			continue
		}

		childEntry := DirectoryEntry{
			Name:  dirEntry.Name(),
			Path:  childPath,
			IsDir: info.IsDir(),
		}

		if info.Mode()&fs.ModeSymlink != 0 {
			childEntry.IsDir = false
		} else if childEntry.IsDir {
			childEntry.HasChildren = a.directoryHasChildren(childPath)
		} else if !isMarkdownFile(childEntry.Name) {
			continue
		}

		children = append(children, childEntry)
	}

	sort.Slice(children, func(i, j int) bool {
		if children[i].IsDir != children[j].IsDir {
			return children[i].IsDir
		}
		return strings.ToLower(children[i].Name) < strings.ToLower(children[j].Name)
	})

	return children, nil
}

func (a *App) directoryHasChildren(path string) bool {
	entries, err := os.ReadDir(path)
	if err != nil {
		a.logTreeWarning("read dir", path, err)
		return false
	}

	for _, entry := range entries {
		if entry.IsDir() {
			return true
		}

		info, err := entry.Info()
		if err != nil {
			a.logTreeWarning("stat entry", filepath.Join(path, entry.Name()), err)
			continue
		}

		if info.Mode()&fs.ModeSymlink != 0 {
			continue
		}

		if isMarkdownFile(entry.Name()) {
			return true
		}
	}

	return false
}

func (a *App) LoadDirectoryEntries(path string) ([]DirectoryEntry, error) {
	cleaned := filepath.Clean(strings.TrimSpace(path))
	if cleaned == "" {
		return nil, errors.New("path is required")
	}

	entries, err := a.readDirectoryChildren(cleaned)
	if err != nil {
		return nil, err
	}

	return entries, nil
}

func (a *App) logTreeWarning(action string, path string, err error) {
	if a.ctx == nil {
		return
	}
	runtime.LogWarningf(a.ctx, "folder tree: %s '%s': %v", action, path, err)
}

func isMarkdownFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".md", ".markdown", ".mdown", ".mkd", ".mdx":
		return true
	default:
		return false
	}
}
