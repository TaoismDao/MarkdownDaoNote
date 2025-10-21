package app

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"runtime"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// SingleInstanceManager 管理单实例模式
type SingleInstanceManager struct {
	appName    string
	socketPath string
	listener   net.Listener
	ctx        context.Context
	app        *App
}

// NewSingleInstanceManager 创建单实例管理器
func NewSingleInstanceManager(appName string, app *App) *SingleInstanceManager {
	return &SingleInstanceManager{
		appName: appName,
		app:     app,
	}
}

// CheckAndHandleSingleInstance 检查并处理单实例模式
func (sim *SingleInstanceManager) CheckAndHandleSingleInstance(ctx context.Context) (bool, error) {
	sim.ctx = ctx

	// 设置socket路径
	if err := sim.setupSocketPath(); err != nil {
		return false, err
	}

	// 尝试连接到已运行的实例
	if sim.tryConnectToExistingInstance() {
		log.Println("Found existing instance, forwarding arguments...")
		return true, nil
	}

	// 启动监听器
	if err := sim.startListener(); err != nil {
		return false, err
	}

	log.Println("Starting as primary instance")
	return false, nil
}

// setupSocketPath 设置socket路径
func (sim *SingleInstanceManager) setupSocketPath() error {
	var socketDir string

	switch runtime.GOOS {
	case "windows":
		// Windows: 使用临时目录
		socketDir = os.TempDir()
		sim.socketPath = filepath.Join(socketDir, fmt.Sprintf("%s.sock", sim.appName))
	case "darwin", "linux":
		// Unix系统: 使用用户目录
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		socketDir = filepath.Join(homeDir, ".config", sim.appName)
		if err := os.MkdirAll(socketDir, 0755); err != nil {
			return err
		}
		sim.socketPath = filepath.Join(socketDir, "instance.sock")
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	return nil
}

// tryConnectToExistingInstance 尝试连接到已运行的实例
func (sim *SingleInstanceManager) tryConnectToExistingInstance() bool {
	// 尝试连接socket
	conn, err := net.Dial("unix", sim.socketPath)
	if err != nil {
		return false
	}
	defer conn.Close()

	// 发送启动参数
	args := os.Args[1:]
	if len(args) > 0 {
		message := fmt.Sprintf("open-file:%s", args[0])
		_, err = conn.Write([]byte(message))
		if err != nil {
			log.Printf("Failed to send message to existing instance: %v", err)
		}
	}

	return true
}

// startListener 启动监听器
func (sim *SingleInstanceManager) startListener() error {
	// 清理旧的socket文件
	if err := os.Remove(sim.socketPath); err != nil && !os.IsNotExist(err) {
		log.Printf("Warning: failed to remove old socket: %v", err)
	}

	// 创建Unix socket监听器
	listener, err := net.Listen("unix", sim.socketPath)
	if err != nil {
		return fmt.Errorf("failed to create listener: %v", err)
	}

	sim.listener = listener

	// 启动goroutine处理连接
	go sim.handleConnections()

	return nil
}

// handleConnections 处理来自其他实例的连接
func (sim *SingleInstanceManager) handleConnections() {
	for {
		conn, err := sim.listener.Accept()
		if err != nil {
			if sim.ctx.Err() != nil {
				// 应用正在关闭
				return
			}
			log.Printf("Failed to accept connection: %v", err)
			continue
		}

		go sim.handleConnection(conn)
	}
}

// handleConnection 处理单个连接
func (sim *SingleInstanceManager) handleConnection(conn net.Conn) {
	defer conn.Close()

	buffer := make([]byte, 1024)
	n, err := conn.Read(buffer)
	if err != nil {
		log.Printf("Failed to read from connection: %v", err)
		return
	}

	message := string(buffer[:n])
	log.Printf("Received message from new instance: %s", message)

	// 解析消息
	if len(message) > 10 && message[:10] == "open-file:" {
		filePath := message[10:]
		if filePath != "" {
			// 将文件路径传递给前端
			wailsRuntime.EventsEmit(sim.ctx, "open-file", filePath)

			// 聚焦窗口但保持最大化状态
			//wailsRuntime.WindowUnminimise(sim.ctx)
			wailsRuntime.WindowShow(sim.ctx)
			// 确保窗口保持最大化状态
			//wailsRuntime.WindowToggleMaximise(sim.ctx)
		}
	}
}

// Close 关闭单实例管理器
func (sim *SingleInstanceManager) Close() error {
	if sim.listener != nil {
		if err := sim.listener.Close(); err != nil {
			return err
		}
	}

	// 清理socket文件
	if err := os.Remove(sim.socketPath); err != nil && !os.IsNotExist(err) {
		log.Printf("Warning: failed to remove socket file: %v", err)
	}

	return nil
}
