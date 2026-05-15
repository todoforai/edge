.PHONY: help run run-dev build compile deploy

help:
	@echo "  make run        - Run edge (production)"
	@echo "  make run-dev    - Run edge (dev)"
	@echo "  make build      - Build for Node"
	@echo "  make compile    - Compile standalone binary"
	@echo "  make deploy     - Fast-forward prod to main (CI publishes to npm + tags release)"

run:
	cd bun && bun run src/index.ts --api-url https://api.todofor.ai --kill

run-dev:
	cd bun && bun run src/index.ts --api-url http://localhost:4000 --kill

build:
	cd bun && bun run build

compile:
	cd bun && bun build src/index.ts --compile --outfile dist/todoforai-edge

deploy:
	git push origin main:prod
