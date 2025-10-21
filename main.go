package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"github.com/yourname/MarkdownDaoNote/internal/app"
)

func main() {
	// 获取可执行文件所在目录
	exePath, err := os.Executable()
	if err != nil {
		log.Printf("Failed to get executable path: %v", err)
	} else {
		exeDir := filepath.Dir(exePath)
		logPath := filepath.Join(exeDir, "MarkdownDaoNote.log")

		// 设置日志输出到可执行文件同目录
		logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			log.Printf("Failed to open log file: %v", err)
		} else {
			log.SetOutput(logFile)
			defer logFile.Close()
		}
	}

	log.Println("Starting MarkdownDaoNote application...")

	application := app.New()
	log.Printf("Args(%d): %v", len(os.Args), os.Args)
	// Windows: if launched via file association, the shell passes the file path as arg1
	if len(os.Args) > 1 {
		// Only accept the first argument as a file path
		log.Printf("Startup open path detected: %s", os.Args[1])
		application.SetStartupOpenPath(os.Args[1])
	} else {
		log.Printf("No startup file argument detected")
	}
	log.Println("Application instance created")

	err = wails.Run(&options.App{
		Title:            "MarkdownDaoNote",
		MinWidth:         960,
		MinHeight:        600,
		AssetServer:      &assetserver.Options{Assets: getAssetsFS()},
		OnStartup:        application.Startup,
		OnDomReady:       application.DomReady,
		OnShutdown:       application.Shutdown,
		Bind:             []interface{}{application},
		Menu:             nil, // 隐藏菜单栏，使用自定义界面
		BackgroundColour: &options.RGBA{R: 19, G: 20, B: 24, A: 255},
		DisableResize:    false,
		Frameless:        true,
		WindowStartState: options.Maximised,
	})

	if err != nil {
		log.Fatalf("failed to start application: %v", err)
	}

	log.Println("Application started successfully")
}
