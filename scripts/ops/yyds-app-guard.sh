#!/usr/bin/env bash
# 线上自愈守护：定时检查站点，发现打不开就自动拉回来。
#
# 为什么需要：发布时 .next 会被重写，构建期间一旦内存打满、断网或服务器重启，
# .next 就停在半成品状态；Next 生产模式缺少完整构建会直接启动失败，pm2 反复重启，
# nginx 没有上游只能回 502，站点会一直打不开直到有人手动登服务器。
# 兜底顺序：先退回上一版构建（秒级恢复），退不回去才重新构建（慢，且只在别无选择时做）。
set -uo pipefail

APP_DIR="${YYDS_APP_DIR:-/var/www/yyds-course-platform}"
APP_NAME="${YYDS_APP_NAME:-yyds-course}"
APP_PORT="${YYDS_APP_PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${APP_PORT}/"
LOG_FILE="${YYDS_GUARD_LOG:-/var/log/yyds-app-guard.log}"
LOCK_FILE="/tmp/yyds-app-guard.lock"
DEPLOY_MARKER="/tmp/yyds-deploy-in-progress"
# 发布中站点本来就会短暂打不开，守护不能插一脚；但标记过期要失效，否则残留文件会永久挡住自愈
DEPLOY_MARKER_MAX_AGE=3600
# 重启和重建都要时间，判定失败前必须等够，否则会把正在启动的进程当成挂了反复折腾
RESTART_WAIT_SECONDS=45
BUILD_WAIT_SECONDS=90
LOG_MAX_BYTES=$((5 * 1024 * 1024))

# 重建可能跑好几分钟，定时器下一轮不能并发再进来一次
if [ "${YYDS_GUARD_LOCKED:-}" != "1" ]; then
  export YYDS_GUARD_LOCKED=1
  exec flock -n "$LOCK_FILE" "$0" "$@"
fi

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG_FILE" 2>/dev/null
}

rotate_log() {
  local size
  size=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
    tail -c $((LOG_MAX_BYTES / 2)) "$LOG_FILE" >"$LOG_FILE.tmp" 2>/dev/null &&
      mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
}

# 连不上时 curl 会输出 000；5xx 说明 Next 没起来，nginx 对外就是 502。两种都算不健康
is_healthy() {
  local code
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$HEALTH_URL" 2>/dev/null)
  case "$code" in
    [1-9][0-9][0-9]) [ "$code" -lt 500 ] ;;
    *) return 1 ;;
  esac
}

deploy_in_progress() {
  pgrep -f '[n]ext build' >/dev/null 2>&1 && return 0
  [ -f "$DEPLOY_MARKER" ] || return 1
  local age
  age=$(( $(date +%s) - $(stat -c %Y "$DEPLOY_MARKER" 2>/dev/null || echo 0) ))
  [ "$age" -lt "$DEPLOY_MARKER_MAX_AGE" ]
}

has_build() {
  [ -f "$APP_DIR/.next/BUILD_ID" ]
}

has_previous_build() {
  [ -f "$APP_DIR/.next.prev/BUILD_ID" ]
}

restore_previous_build() {
  log "restore .next from .next.prev"
  rm -rf "$APP_DIR/.next.broken"
  if [ -d "$APP_DIR/.next" ]; then
    mv "$APP_DIR/.next" "$APP_DIR/.next.broken"
  fi
  # 用硬链接复制而不是直接 mv：.next.prev 要留着，否则下一轮就只剩整包重建这条路
  cp -al "$APP_DIR/.next.prev" "$APP_DIR/.next" 2>/dev/null ||
    cp -a "$APP_DIR/.next.prev" "$APP_DIR/.next"
}

restart_app() {
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env >/dev/null 2>&1
  else
    (cd "$APP_DIR" && pm2 start npm --name "$APP_NAME" -- start -- -p "$APP_PORT" >/dev/null 2>&1)
  fi
  pm2 save >/dev/null 2>&1
}

rebuild_app() {
  log "rebuild start"
  rm -f "$APP_DIR/.next/lock"
  local pids
  pids=$(pgrep -f '[n]ext build' || true)
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null
  fi
  "$APP_DIR/scripts/ops/yyds-build.sh" >>"$LOG_FILE" 2>&1
  log "rebuild exit=$?"
}

rotate_log
is_healthy && exit 0
deploy_in_progress && exit 0

log "unhealthy: build=$(has_build && echo yes || echo no) prev=$(has_previous_build && echo yes || echo no)"

if ! has_build && has_previous_build; then
  restore_previous_build
fi

restart_app
sleep "$RESTART_WAIT_SECONDS"
if is_healthy; then
  log "recovered by restart"
  exit 0
fi

# 走到这里说明连上一版构建都救不回来，只能在线重建
rebuild_app
restart_app
sleep "$BUILD_WAIT_SECONDS"
if is_healthy; then
  log "recovered by rebuild"
  exit 0
fi

log "still down after rebuild; needs manual check"
exit 1
