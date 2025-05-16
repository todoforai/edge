# Makefile for todoforai-edge

.PHONY: install build-sidecar copy-sidecar tauri-dev tauri-build clean help run run-test deploy-prod bump-version update-icons

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
	python3 run_edge.py

run-test:
	@echo "Running TodoForAI Edge client with test credentials..."
	python3 run_edge.py --email lfg@todofor.ai --password Test123 --api-url http://localhost:4000

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
	git add pyproject.toml edge_frontend/package.json edge_frontend/src-tauri/Cargo.toml && \
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

# Update icons with 'Edge' text
update-icons:
	@echo "Updating icons with 'Edge' text..."
	@bash edge_frontend/src-tauri/scripts/update_icons.sh

# Install dependencies
install:
	pip install -e .
	cd edge_frontend && npm install

# Build the WebSocket sidecar executable
build-sidecar:
	python3 build_executable.py

# Copy the sidecar executable to the Tauri resources directory
copy-sidecar:
	bash scripts/copy_sidecar_to_resources.sh

# Run Tauri in development mode
tauri-dev:
	cd edge_frontend && npm run tauri dev

# Build Tauri application with the sidecar
tauri-build: copy-sidecar
	# Ensure fresh node dependencies are installed for the current platform
	cd edge_frontend && npm install --no-audit --progress=false
	cd edge_frontend && TAURI_SKIP_UPDATE_CHECK=1 npm run tauri build

# Clean build artifacts
clean:
	rm -rf dist
	rm -rf build
	rm -rf *.spec
	rm -rf edge_frontend/src-tauri/resources/todoforai-edge-sidecar*

# Test the sidecar build
test-sidecar: clean
	bash scripts/test_sidecar_setup.sh

# Default target
all: install build-sidecar copy-sidecar tauri-build