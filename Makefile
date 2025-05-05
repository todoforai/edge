.PHONY: help run run-test deploy-prod bump-version

help:
	@echo "Available commands:"
	@echo "  make run               - Run the edge client with default credentials"
	@echo "  make run-test          - Run the edge client with test credentials"
	@echo "  make bump-version      - Bump the version number by 0.0.1"
	@echo "  make deploy-prod       - Bump version, commit, push to main, then deploy main to production"

run:
	@echo "Running TodoForAI Edge client..."
	python3 run_edge.py

run-test:
	@echo "Running TodoForAI Edge client with test credentials..."
	python3 run_edge.py --email lfg@todofor.ai --password Test123

bump-version:
	@echo "Bumping version number..."
	@python3 -c 'import re; \
	f = open("pyproject.toml", "r"); \
	content = f.read(); \
	f.close(); \
	version_match = re.search(r"version = \"([0-9]+)\.([0-9]+)\.([0-9]+)\"", content); \
	if not version_match: \
		print("Error: Could not find version in pyproject.toml"); \
		exit(1); \
	major, minor, patch = map(int, version_match.groups()); \
	new_version = f"{major}.{minor}.{patch+1}"; \
	print(f"Bumping version from {major}.{minor}.{patch} to {new_version}"); \
	new_content = re.sub(r"version = \"[0-9]+\.[0-9]+\.[0-9]+\"", f"version = \"{new_version}\"", content); \
	f = open("pyproject.toml", "w"); \
	f.write(new_content); \
	f.close(); \
	print(f"Version updated to {new_version}");'
	@git add pyproject.toml
	@git commit -m "Bump version to $$(grep -oP "version = \"\K[0-9]+\.[0-9]+\.[0-9]+" pyproject.toml)"
	@git push origin main

deploy-prod: bump-version
	@echo "Deploying main branch to production..."
	@git checkout prod
	@git pull origin prod
	@git merge origin/main
	@git push origin prod
	@git checkout -
	@echo "Deployment complete!"