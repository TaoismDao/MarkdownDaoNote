APP_NAME := MarkdownDaoNote
FRONTEND_DIR := frontend
BUILD_DIR := build

.PHONY: dev build package clean frontend

dev:
	@wails dev

build:
	@wails build

frontend:
	@cd $(FRONTEND_DIR) && npm install && npm run build

package: build
	@./scripts/package.sh $(BUILD_DIR)

clean:
	@rm -rf $(BUILD_DIR)
	@rm -rf $(FRONTEND_DIR)/dist
