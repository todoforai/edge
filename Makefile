.PHONY: help run run-dev build compile bump-version deploy-tag deploy-latest

help:
	@echo "  make run               - Run edge (production)"
	@echo "  make run-dev           - Run edge (dev)"
	@echo "  make build             - Build for Node"
	@echo "  make compile           - Compile standalone binary"
	@echo "  make bump-version      - Bump version by 0.0.1"
	@echo "  make deploy-latest     - Bump, push main, merge to prod"

run:
	@test -n "$$TODOFORAI_API_KEY" || (echo "Error: TODOFORAI_API_KEY not set" && exit 1)
	cd bun && bun run src/index.ts --api-key $$TODOFORAI_API_KEY --api-url https://api.todofor.ai

run-dev:
	@test -n "$$TODOFORAI_API_KEY_DEV" || (echo "Error: TODOFORAI_API_KEY_DEV not set" && exit 1)
	cd bun && bun run src/index.ts --api-key $$TODOFORAI_API_KEY_DEV --api-url http://localhost:4000

build:
	cd bun && bun run build

compile:
	cd bun && bun build src/index.ts --compile --outfile dist/todoforai-edge

bump-version:
	@VERSION=$$(grep -oP '"version": "\K[0-9]+\.[0-9]+\.[0-9]+' bun/package.json) && \
	MAJOR=$$(echo $$VERSION | cut -d. -f1) && \
	MINOR=$$(echo $$VERSION | cut -d. -f2) && \
	PATCH=$$(echo $$VERSION | cut -d. -f3) && \
	NEW_PATCH=$$((PATCH + 1)) && \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH" && \
	echo "Bumping $$VERSION -> $$NEW_VERSION" && \
	sed -i "s/\"version\": \"$$VERSION\"/\"version\": \"$$NEW_VERSION\"/" bun/package.json && \
	git add bun/package.json && \
	git commit -m "Bump version to $$NEW_VERSION" && \
	git push origin main

deploy-tag: bump-version
	@VERSION=$$(grep -oP '"version": "\K[0-9]+\.[0-9]+\.[0-9]+' bun/package.json) && \
	git tag -a "v$$VERSION" -m "Release v$$VERSION" && \
	git push origin "v$$VERSION"

deploy-latest: bump-version
	@git checkout prod && git pull origin prod && git merge origin/main && git push origin prod && git checkout -
