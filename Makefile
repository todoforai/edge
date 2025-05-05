.PHONY: help run run-test deploy-prod bump-version

help:
	@echo "Available commands:"
	@echo "  make run               - Run the edge client with default credentials"
	@echo "  make run-test          - Run the edge client with test credentials"
	@echo "  make bump-version      - Bump the version number by 0.0.1"
	@echo "  make deploy-latest     - Bump version, commit, push to main, then deploy main to latest"
	@echo "  make deploy-tag        - Create a GitHub release tag for the current version"

run:
	@echo "Running TodoForAI Edge client..."
	python3 run_edge.py

run-test:
	@echo "Running TodoForAI Edge client with test credentials..."
	python3 run_edge.py --email lfg@todofor.ai --password Test123

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
	git add pyproject.toml && \
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