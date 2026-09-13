#!/usr/bin/env bash
# 线上构建：把 next build 关进内存受限的 systemd scope 再跑。
#
# 为什么：生产机只有 3.4G 内存，直接跑构建会把整机吃到无响应，
# 连 SSH 都连不上（外部表现就是网站 ERR_CONNECTION_CLOSED），阿里云随后硬重启，
# .next 停在半成品状态，站点起不来。放进 cgroup 后超限只杀构建本身，机器保持在线。
set -uo pipefail

APP_DIR="${YYDS_APP_DIR:-/var/www/yyds-course-platform}"
# 给系统和正在服务的 Node 进程留出余量，别把整机内存都让给构建
BUILD_MEMORY_MAX="${YYDS_BUILD_MEMORY_MAX:-2600M}"
NODE_HEAP_MB="${YYDS_NODE_HEAP_MB:-2048}"

cd "$APP_DIR" || exit 1
export NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_MB}"

if command -v systemd-run >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  exec sudo -n systemd-run --scope --quiet \
    --uid="$(id -u)" --gid="$(id -g)" \
    --working-directory="$APP_DIR" \
    --setenv=NODE_OPTIONS="$NODE_OPTIONS" \
    -p MemoryMax="$BUILD_MEMORY_MAX" \
    -p MemorySwapMax=4G \
    npm run build
fi

echo "systemd-run unavailable; building without memory cap" >&2
exec npm run build
