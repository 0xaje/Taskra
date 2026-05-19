#!/usr/bin/env bash

echo "🔥 Launching Taskra Monorepo in Development Mode..."
echo "🔗 Frontend web running on http://localhost:3000"
echo "🔌 Fastify API running on http://localhost:3001"

# delegating task to turbo parallel pipeline execution
pnpm run dev
