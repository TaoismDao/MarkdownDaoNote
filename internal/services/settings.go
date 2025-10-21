package services

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

const (
	settingsDirName  = "markdownpad"
	settingsFileName = "settings.json"
)

// Settings describes persisted editor preferences.
type Settings struct {
	Theme        string `json:"theme"`
	AutoSave     bool   `json:"autoSave"`
	FontSize     int    `json:"fontSize"`
	WordWrap     bool   `json:"wordWrap"`
	LastFile     string `json:"lastFile"`
	EditorTheme  string `json:"editorTheme"`
	PreviewTheme string `json:"previewTheme"`
}

// SettingsService manages persistence of editor settings.
type SettingsService struct {
	path string
}

// NewSettingsService constructs a SettingsService using the OS config directory.
func NewSettingsService() *SettingsService {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}

	path := filepath.Join(dir, settingsDirName, settingsFileName)
	return &SettingsService{path: path}
}

// Load reads settings from disk or returns defaults.
func (s *SettingsService) Load() (Settings, error) {
	defaults := Settings{
		Theme:        "default",
		AutoSave:     true,
		FontSize:     16,
		WordWrap:     true,
		EditorTheme:  "default",
		PreviewTheme: "default",
	}

	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return defaults, nil
	}
	if err != nil {
		return defaults, err
	}

	if err := json.Unmarshal(data, &defaults); err != nil {
		return defaults, err
	}
	return defaults, nil
}

// Save writes provided settings to disk atomically.
func (s *SettingsService) Save(settings Settings) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}

	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}

	return os.Rename(tmp, s.path)
}
