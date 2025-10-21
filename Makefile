APP_NAME := MarkdownDaoNote
FRONTEND_DIR := frontend
BUILD_DIR := build
VERSION := 1.0.1

.PHONY: dev build package clean frontend prepare-icons prepare-macos-icon deb install-nfpm

dev:
	@wails dev

build:
	@wails build

frontend:
	@cd $(FRONTEND_DIR) && npm install && npm run build

# 准备 Linux 图标文件
prepare-icons:
	@echo "Preparing Linux icons..."
	@./packaging/prepare-icons.sh

# 准备 macOS 图标文件
prepare-macos-icon:
	@echo "Preparing macOS icon..."
	@./packaging/prepare-macos-icon.sh

# 安装 NFPM（如果未安装）
install-nfpm:
	@command -v nfpm >/dev/null 2>&1 || { \
		echo "Installing nfpm..."; \
		go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest; \
	}

# 构建 DEB 包
deb: build prepare-icons install-nfpm
	@echo "Building DEB package..."
	@mkdir -p $(BUILD_DIR)/packages
	@nfpm package --packager deb --target $(BUILD_DIR)/packages/
	@echo "DEB package created in $(BUILD_DIR)/packages/"

# 旧的打包脚本（保留兼容性）
package: build
	@./scripts/package.sh $(BUILD_DIR)

clean:
	@rm -rf $(BUILD_DIR)
	@rm -rf $(FRONTEND_DIR)/dist
	@rm -f assets/icons/icon*.png
