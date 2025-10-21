package app

import (
	"embed"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

//go:embed all:frontend/dist
var embeddedDist embed.FS

// Assets resolves the front-end distribution folder for the asset server.
func Assets() fs.FS {
	// 1) 优先从嵌入资源中截取子FS，使根目录直接包含 index.html
	if sub, err := fs.Sub(embeddedDist, "frontend/dist"); err == nil {
		// 读取校验 index.html 是否存在可读
		if _, statErr := fs.Stat(sub, "index.html"); statErr == nil {
			log.Println("Using embedded frontend assets (fs.Sub)")
			return sub
		}
		log.Printf("warning: embedded assets missing index.html: %v", err)
	} else {
		log.Printf("warning: failed to use embedded assets sub FS: %v", err)
	}

	// 2) 退回到磁盘目录（开发或异常情况下）
	distDir := filepath.Join("frontend", "dist")
	if _, statErr := os.Stat(distDir); statErr == nil {
		log.Printf("Using disk assets at: %s", distDir)
		return os.DirFS(distDir)
	}

	// 3) 再尝试其他相对路径
	cwd, _ := os.Getwd()
	candidates := []string{
		filepath.Join(cwd, "frontend", "dist"),
		filepath.Join(cwd, "..", "frontend", "dist"),
		filepath.Join(cwd, "..", "..", "frontend", "dist"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			log.Printf("Using disk assets at: %s", p)
			return os.DirFS(p)
		}
	}

	// 4) 最终回退：仍返回磁盘相对路径（即使不存在），避免返回嵌入FS根导致找不到 index.html
	log.Printf("warning: frontend assets not found; fallback to %s", distDir)
	return os.DirFS(distDir)
}
