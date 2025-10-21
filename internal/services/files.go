package services

import (
	"io/fs"
	"os"
)

// FileService encapsulates basic file I/O helpers.
type FileService struct{}

// NewFileService constructs a FileService instance.
func NewFileService() *FileService {
	return &FileService{}
}

// Read loads file contents as UTF-8 text.
func (s *FileService) Read(path string) (string, error) {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// Write stores UTF-8 content to the given path.
func (s *FileService) Write(path string, content string) error {
	return os.WriteFile(path, []byte(content), fs.FileMode(0o644))
}

// CreateFile creates a new empty file at the given path.
func (s *FileService) CreateFile(path string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	return file.Close()
}

// CreateDirectory creates a new directory at the given path.
func (s *FileService) CreateDirectory(path string) error {
	return os.MkdirAll(path, fs.FileMode(0o755))
}

// DeleteFile removes a file or directory at the given path.
func (s *FileService) DeleteFile(path string) error {
	return os.RemoveAll(path)
}

// RenameFile renames a file or directory from oldPath to newPath.
func (s *FileService) RenameFile(oldPath, newPath string) error {
	// 添加调试信息
	println("重命名调试 - 原始路径:", oldPath)
	println("重命名调试 - 新路径:", newPath)

	// 检查原始文件是否存在
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		println("错误: 原始文件不存在")
		return err
	}

	// 检查目标路径是否已存在
	if _, err := os.Stat(newPath); err == nil {
		println("错误: 目标路径已存在")
		return os.ErrExist
	}

	// 使用更安全的重命名方法
	err := os.Rename(oldPath, newPath)
	if err != nil {
		println("重命名失败:", err.Error())
		return err
	}

	// 验证重命名是否成功
	if _, err := os.Stat(newPath); os.IsNotExist(err) {
		println("错误: 重命名后文件不存在")
		return err
	}

	println("重命名成功")
	return nil
}
