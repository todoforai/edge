# Makefile for todoforai-edge

.PHONY: install clean help run run-dev run-dev2 deploy-prod bump-version deploy-tag deploy-latest

PYTHON ?= python3

help:
	@echo "Available commands:"
	@echo "  make run               - Run the edge client with production credentials"
	@echo "  make run-dev           - Run the edge client with dev credentials"
	@echo "  make run-dev2          - Run the edge client with dev2 credentials"
	@echo "  make bump-version      - Bump the version number by 0.0.1"
	@echo "  make deploy-latest     - Bump version, commit, push to main, then deploy main to latest"
	@echo "  make deploy-tag        - Create a GitHub release tag for the current version"

run:
	@echo "Running TodoForAI Edge client..."
	@test -n "$$TODOFORAI_API_KEY" || (echo "Error: TODOFORAI_API_KEY environment variable not set" && exit 1)
	python3 run_edge.py --api-key $$TODOFORAI_API_KEY --api-url https://api.todofor.ai

run-dev:
	@echo "Running TodoForAI Edge client with dev credentials..."
	@test -n "$$TODOFORAI_API_KEY_DEV" || (echo "Error: TODOFORAI_API_KEY_DEV environment variable not set" && exit 1)
	python3 run_edge.py --api-key $$TODOFORAI_API_KEY_DEV --api-url http://localhost:4000

run-dev2:
	@echo "Running TodoForAI Edge client with dev2 credentials..."
	@test -n "$$TODOFORAI_API_KEY_DEV2" || (echo "Error: TODOFORAI_API_KEY_DEV2 environment variable not set" && exit 1)
	python3 run_edge.py --api-key $$TODOFORAI_API_KEY_DEV2 --api-url http://localhost:4000

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
	sed -i "s/\"version\": \"$$VERSION\"/\"version\": \"$$NEW_VERSION\"/" bun/package.json && \
	git add pyproject.toml bun/package.json && \
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

# Install dependencies
install:
	$(PYTHON) -m pip install -r requirements.txt
	$(PYTHON) -m pip install -e .

# Clean build artifacts
clean:
	rm -rf dist
	rm -rf build
	rm -rf *.spec