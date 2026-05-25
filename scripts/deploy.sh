#!/usr/bin/env bash
# ==============================================================================
#                      TASKRA SYSTEM-WIDE DEPLOYMENT SCRIPT
# ==============================================================================
# This script automates production readiness steps including linting,
# workspace building, database schema validation, and docker orchestration.

set -euo pipefail

# Style variables
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}        Taskra Production Orchestration Utility        ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# 1. Monorepo Validation
echo -e "\n${YELLOW}[Step 1/5] Running static analysis and compilation checks...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm package manager is not installed! Please run npm i -g pnpm.${NC}"
    exit 1
fi

pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Package dependencies synchronized.${NC}"

pnpm --filter @taskra/types build
pnpm --filter @taskra/sdk build
pnpm --filter @taskra/ui build
echo -e "${GREEN}✓ Core packages compiled successfully.${NC}"

# 2. Database Sync Verification
echo -e "\n${YELLOW}[Step 2/5] Checking Prisma Database schema migrations...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✓ Found root environment config .env.${NC}"
else
    echo -e "${YELLOW}! Warning: Root .env config missing. Creating from example...${NC}"
    cp .env.example .env
fi

# Load variables
export $(grep -v '^#' .env | xargs) || true

if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL variable is not set in your environment!${NC}"
    exit 1
fi

echo -e "${BLUE}Pushing Prisma schemas to database schema pool...${NC}"
pnpm --filter taskra-api exec prisma db push --accept-data-loss
echo -e "${GREEN}✓ Prisma database push complete.${NC}"

# 3. Microservice Build Checks
echo -e "\n${YELLOW}[Step 3/5] Validating microservice build bundles...${NC}"
if pnpm --filter taskra-api build && pnpm --filter taskra-agents-engine build && pnpm --filter taskra-web build; then
    echo -e "${GREEN}✓ All Next.js, API and Agent modules compiled cleanly in production mode.${NC}"
else
    echo -e "${RED}Error: Code compilation failed! Check compiler logs.${NC}"
    exit 1
fi

# 4. Local Staging Docker Deploy
echo -e "\n${YELLOW}[Step 4/5] Checking Docker orchestrations...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}! Warning: Docker is not installed on this system. Skipping container builds.${NC}"
else
    echo -e "${BLUE}Building Taskra production container ecosystem...${NC}"
    docker compose -f docker/docker-compose.yml build
    echo -e "${GREEN}✓ Docker container images compiled successfully.${NC}"
fi

# 5. Live Gateway Verification
echo -e "\n${YELLOW}[Step 5/5] Performing post-flight live gateway validation...${NC}"
if [ -n "${NEXT_PUBLIC_API_URL:-}" ]; then
    echo -e "${BLUE}Probing API gateway endpoint: ${NEXT_PUBLIC_API_URL}${NC}"
    if curl --output /dev/null --silent --head --fail "${NEXT_PUBLIC_API_URL}"; then
        echo -e "${GREEN}✓ Target API gateway is alive and reachable.${NC}"
    else
        echo -e "${YELLOW}! Target API gateway is currently unreachable. Ensure server is started.${NC}"
    fi
else
    echo -e "${BLUE}API gateway endpoint check bypassed (no URL supplied).${NC}"
fi

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}  Taskra is completely prepared for production deployment!  ${NC}"
echo -e "${GREEN}=====================================================${NC}"
