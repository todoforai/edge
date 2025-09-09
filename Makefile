# Makefile for todoforai-edge

.PHONY: install build-sidecar copy-sidecar tauri-dev tauri-build clean help run run-test deploy-prod bump-version update-icons start-signer start-tunnel start-services stop-signer stop-tunnel stop-services

help:
	@echo "Available commands:"
	@echo "  make run               - Run the edge client with default credentials"
	@echo "  make run-test          - Run the edge client with test credentials"
	@echo "  make bump-version      - Bump the version number by 0.0.1"
	@echo "  make deploy-latest     - Bump version, commit, push to main, then deploy main to latest"
	@echo "  make deploy-tag        - Create a GitHub release tag for the current version"
	@echo "  make update-icons      - Update icons with 'Edge' text"

run:
	@echo "Running TodoForAI Edge client..."
	@if [ -n "$(email)" ]; then \
		echo "Using provided email: $(email)"; \
		if [ -n "$(password)" ]; then \
			python3 run_edge.py --email $(email) --password $(password) --api-url https://api.todofor.ai; \
		else \
			python3 run_edge.py --email $(email) --api-url https://api.todofor.ai; \
		fi; \
	else \
		python3 run_edge.py --email six1@todofor.ai --password Test123 --api-url https://api.todofor.ai; \
	fi

run-test:
	@echo "Running TodoForAI Edge client with test credentials..."
	# python3 run_edge.py --email test@todofor.ai --password Test123 --api-url https://api.todofor.ai
	python3 run_edge.py --email lfg@todofor.ai --password Test123 --api-url http://localhost:4000

run-ws:
  # joins where the frontend asks to:
	TODO4AI_API_URL=https://api.todofor.ai
	python3 edge_frontend/src-tauri/resources/python/ws_sidecar.py

run-frontend:
  # run frontend separately:
	cd edge_frontend && yarn dev

bump-version:
	@echo "Bumping version number..."
	@VERSION=$$(grep -oP 'version = "\K[0-9]+\.[0-9]+\.[0-9]+' pyproject.toml) && \
	MAJOR=$$(echo $$VERSION | cut -d. -f1) && \
	MINOR=$$(echo $$VERSION | cut -d. -f2) && \
	PATCH=$$(echo $$VERSION | cut -d. -f3) && \
	NEW_PATCH=$$((PATCH + 1)) && \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH" && \
	echo "Bumping version from $$VERSION to $$NEW_VERSION" && \
	sed -i "s/version = \"$$VERSION\"/version = \"$$NEW_VERSION\"/" pyproject.toml && \
	sed -i "s/\"version\": \"$$MAJOR.$$MINOR.[0-9]*\"/\"version\": \"$$NEW_VERSION\"/" edge_frontend/package.json && \
	sed -i "s/version = \"$$MAJOR.$$MINOR.[0-9]*\"/version = \"$$NEW_VERSION\"/" edge_frontend/src-tauri/Cargo.toml && \
	sed -i "s/version: '$$MAJOR.$$MINOR.[0-9]*'/version: '$$NEW_VERSION'/" snap/snapcraft.yaml && \
	git add pyproject.toml edge_frontend/package.json edge_frontend/src-tauri/Cargo.toml snap/snapcraft.yaml && \
	git commit -m "Bump version to $$NEW_VERSION" && \
	git push origin main && \
	echo "Version updated to $$NEW_VERSION"

deploy-tag: bump-version
	@VERSION=$$(grep -oP 'version = "\K[0-9]+\.[0-9]+\.[0-9]+' pyproject.toml) && \
	echo "Creating release tag v$$VERSION..." && \
	git tag -a "v$$VERSION" -m "Release v$$VERSION" && \
	git push origin "v$$VERSION" && \
	echo "Release tag v$$VERSION created and pushed to GitHub"

deploy-latest: bump-version
	@echo "Deploying main branch to production..."
	@git checkout prod
	@git pull origin prod
	@git merge origin/main
	@git push origin prod
	@git checkout -
	@echo "Deployment complete!"


# Start signing server only if not running
start-signer:
	@if netstat -an | findstr ":9999" > nul 2>&1; then \
		echo "✅ Signing server already running on port 9999"; \
	else \
		echo "🔐 Starting Code Signing Server..."; \
		cd scripts && start /B python signing_server.py; \
		echo "✅ Signing server started in background"; \
	fi

start-tunnel:
	@if pgrep -f "cloudflared.*tunnel.*run.*SixComp" > /dev/null 2>&1; then \
		echo "✅ Cloudflared tunnel already running"; \
	else \
		echo "🌐 Starting Cloudflared tunnel..."; \
		nohup /c/Cloudflared/bin/cloudflared.exe tunnel run SixComp --config "$$HOME/.cloudflared/config.yml" > /dev/null 2>&1 & \
		echo "✅ Tunnel started in background"; \
	fi

# Start both services (smart - only if not already running)
start-services: start-signer start-tunnel
	@echo "🚀 All services checked/started!"

# Stop signing server
stop-signer:
	@if command -v netstat >/dev/null 2>&1; then \
		PID=$$(netstat -ano 2>/dev/null | grep ":9999" | awk '{print $$5}' | head -1); \
		if [ -n "$$PID" ]; then \
			kill -9 $$PID 2>/dev/null || taskkill //PID $$PID //F 2>/dev/null || echo "Failed to kill process $$PID"; \
			echo "🛑 Signing server stopped (PID: $$PID)"; \
		else \
			echo "🛑 No process found on port 9999"; \
		fi; \
	else \
		pkill -f "signing_server.py" 2>/dev/null || echo "🛑 No signing server process found"; \
	fi

# Stop cloudflared tunnel
stop-tunnel:
	@taskkill /IM cloudflared.exe /F > nul 2>&1 || echo "Cloudflared not running"
	@echo "🛑 Cloudflared tunnel stopped"

# Stop all services
stop-services: stop-signer stop-tunnel
	@echo "🛑 All services stopped!"

# Update icons with 'Edge' text
update-icons:
	@echo "Updating icons with 'Edge' text..."
	@bash edge_frontend/src-tauri/scripts/update_icons.sh

# Install dependencies
install:
	pip install -r requirements.txt
	pip install -e .
	cd edge_frontend && npm install

# Build the WebSocket sidecar executable
build-sidecar:
	@if command -v python3 >/dev/null 2>&1; then \
		if [ -f "venv/Scripts/activate" ]; then \
			echo "Activating Windows venv..."; \
			. venv/Scripts/activate && python3 build_executable.py; \
		elif [ -f "venv/bin/activate" ]; then \
			echo "Activating Unix venv..."; \
			. venv/bin/activate && python3 build_executable.py; \
		else \
			echo "No virtual environment found, using system Python..."; \
			python3 build_executable.py; \
		fi; \
	else \
		echo "Python3 not found"; \
		exit 1; \
	fi

# Copy the sidecar executable to the Tauri resources directory
copy-sidecar:
	bash scripts/copy_sidecar_to_resources.sh

# Run Tauri in development mode
tauri-dev:
	cd edge_frontend && npm run tauri:dev

# Build Tauri application with the sidecar
tauri-build:
	bash scripts/copy_sidecar_to_resources.sh
	# Ensure fresh node dependencies are installed for the current platform
	cd edge_frontend && rm -rf node_modules package-lock.json
	cd edge_frontend && npm install --no-audit --progress=false
	cd edge_frontend && APPIMAGE_EXTRACT_AND_RUN=1 TAURI_SKIP_UPDATE_CHECK=1 npm run tauri build

# Clean build artifacts
clean:
	rm -rf dist
	rm -rf build
	rm -rf *.spec
	rm -rf edge_frontend/src-tauri/resources/todoforai-edge-sidecar*

# Test the sidecar build
test-sidecar: clean
	bash scripts/test_sidecar_setup.sh

# Sign a .deb package
sign-deb:
	@echo "Signing .deb package..."
	@if [ -z "$(DEB_FILE)" ]; then \
		echo "Error: No .deb file specified. Use 'make sign-deb DEB_FILE=path/to/file.deb'"; \
		exit 1; \
	fi; \
	chmod +x edge_frontend/src-tauri/scripts/sign_deb.sh && \
	GPG_PRIVATE_KEY=$$(cat ~/.todoforai/todoforai_edge_gpg_private_key.b64) edge_frontend/src-tauri/scripts/sign_deb.sh "$(DEB_FILE)"

# Default target
all: install build-sidecar copy-sidecar tauri-build

# Add a dev-test target that builds sidecar and runs in production mode
.PHONY: dev-test-production
dev-test-production: build-sidecar copy-sidecar
	cd edge_frontend && TODOFORAI_FORCE_PRODUCTION=1 yarn tauri dev

# Add a target to build sidecar for development testing
.PHONY: build-sidecar-dev
build-sidecar-dev:
	@echo "Building sidecar for development testing..."
	python3 build_executable.py

.PHONY: copy-sidecar-dev
build-and-copy-sidecar: build-sidecar-dev
	@echo "Copying sidecar for development testing..."
	./scripts/copy_sidecar_to_resources.sh