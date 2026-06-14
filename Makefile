.PHONY: dev test build build-all release release-snapshot clean check help

# Default target
help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Run in development mode
	bun run src/index.ts

test: ## Run tests
	bun test

build: ## Compile binary for current platform
	bun build src/index.ts --compile --outfile bin/strudel-tui

build-all: ## Compile binaries for all platforms into build/
	@mkdir -p build
	bun build src/index.ts --compile --outfile build/strudel-tui-darwin-arm64 --target=bun-darwin-arm64
	bun build src/index.ts --compile --outfile build/strudel-tui-darwin-x64 --target=bun-darwin-x64
	bun build src/index.ts --compile --outfile build/strudel-tui-linux-arm64 --target=bun-linux-arm64
	bun build src/index.ts --compile --outfile build/strudel-tui-linux-x64 --target=bun-linux-x64
	bun build src/index.ts --compile --outfile build/strudel-tui-windows-x64.exe --target=bun-windows-x64
	@echo "All binaries built in build/"

check: ## Validate goreleaser config
	goreleaser check

release: ## Run goreleaser release
	goreleaser release --clean

release-snapshot: ## Create a snapshot release (no publish)
	goreleaser release --clean --snapshot

clean: ## Remove build artifacts
	rm -rf bin/ build/ dist/

changelog:
	git cliff -o CHANGELOG.md

changelog-preview:
	git cliff --latest
