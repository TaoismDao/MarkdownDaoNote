package models

// EditorState represents the Markdown editor session metadata.
type EditorState struct {
    ActiveFile string `json:"activeFile"`
    Content    string `json:"content"`
    Dirty      bool   `json:"dirty"`
}
