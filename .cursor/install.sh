#!/usr/bin/env bash
# Cloud Agent install: 幂等地准备主站开发环境（可重复运行）。
# 任一步骤失败立即中止，避免在依赖未装好时继续跑数据库重置。
set -euo pipefail

# 本地开发用的 .env：仅在缺失时写入，保留开发者已有配置。
# 使用 mock 支付与本地 SQLite，无需任何线上密钥即可离线运行。
if [ ! -f .env ]; then
  cat > .env <<'EOF'
AUTH_SECRET="dev-secret-change-me"
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
PAYMENT_MODE="mock"
EOF
  echo "[install] wrote default .env (mock payment, local SQLite)"
else
  echo "[install] .env already present, keeping it"
fi

echo "[install] installing dependencies (npm ci)"
npm ci

echo "[install] resetting and seeding local SQLite database"
npm run db:reset

echo "[install] done"
