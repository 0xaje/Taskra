#!/usr/bin/env bash
set -e

echo "🛠️  Initializing Taskra Monorepo pnpm Workspaces..."

# Assert pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed. Installing globally..."
    npm install -g pnpm
fi

# Install dependencies at monorepo root
echo "📦 Installing workspaces dependencies..."
pnpm install

# Run initial turborepo build pipelines
echo "🚀 Executing workspace builds via Turborepo..."
pnpm run build

echo "🎉 Taskra workspace setup successfully completed! You are ready to develop."
