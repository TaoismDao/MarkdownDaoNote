package main

import (
	"embed"
	"io/fs"
	"log"
)

//go:embed frontend/dist/*
var embeddedDist embed.FS

// getAssetsFS returns an fs.FS whose root contains index.html
func getAssetsFS() fs.FS {
	if sub, err := fs.Sub(embeddedDist, "frontend/dist"); err == nil {
		return sub
	} else {
		log.Printf("warning: failed to create sub FS for embedded assets: %v", err)
		return embeddedDist
	}
}
