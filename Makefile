# Contract Management System Makefile

.PHONY: help install dev test build deploy clean

help:
	@echo "Available commands:"
	@echo "  make install    Install dependencies"
	@echo "  make dev        Start development servers"
	@echo "  make test       Run tests"
	@echo "  make build      Build for production"
	@echo "  make deploy     Deploy to production"
	@echo "  make clean      Clean build artifacts"

install:
	cd backend && npm install
	cd frontend && npm install

dev:
	docker-compose up -d mongodb redis
	cd backend && npm run dev & cd frontend && npm start

test:
	cd backend && npm test
	cd frontend && npm test

build:
	cd backend && npm run build
	cd frontend && npm run build

clean:
	rm -rf backend/node_modules backend/dist
	rm -rf frontend/node_modules frontend/build
