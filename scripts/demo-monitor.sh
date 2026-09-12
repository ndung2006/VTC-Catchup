#!/bin/sh
# ==============================================================================
# demo-monitor.sh — Chạy plugin vtcmonitor trên file mẫu (POSIX sh).
# Yêu cầu: đã `make` trong plugins/vtcmonitor (trong container tsduck-dev).
#
#   docker compose up -d --build tsduck
#   docker compose exec tsduck sh -c "cd /work/plugins/vtcmonitor && make && make install"
#   docker compose exec tsduck sh /work/scripts/demo-monitor.sh
#   docker compose exec tsduck sh /work/scripts/demo-monitor.sh --pid 100
# ==============================================================================
set -eu

SAMPLE_URL="${SAMPLE_URL:-https://tsduck.io/streams/test-patterns/test-3packets-04-05-06.ts}"
WORK_DIR="${WORK_DIR:-/tmp/vtc-demo}"
INPUT_TS="$WORK_DIR/input.ts"
FILTER_PID="${2:-}"

log() { printf '[vtc-monitor] %s\n' "$*"; }
die() { printf '[vtc-monitor][ERROR] %s\n' "$*" >&2; exit 1; }

command -v tsp >/dev/null 2>&1 || die "chưa có tsp, hãy chạy trong container tsduck."

# Tải file mẫu nếu chưa có (cache lại như demo-cli.sh).
mkdir -p "$WORK_DIR"
if [ ! -s "$INPUT_TS" ]; then
    log "downloading $SAMPLE_URL"
    if command -v curl >/dev/null 2>&1; then
        curl -fL -o "$INPUT_TS" "$SAMPLE_URL" || die "curl thất bại"
    else
        wget -O "$INPUT_TS" "$SAMPLE_URL" || die "wget thất bại"
    fi
fi

# Kiểm tra plugin đã cài chưa.
if ! tsp -P vtcmonitor --help >/dev/null 2>&1; then
    die "plugin vtcmonitor chưa load được. Chạy: cd /work/plugins/vtcmonitor && make && make install"
fi

# Chạy monitor: đếm + phát hiện CC, không sửa luồng (-O drop).
if [ "${1:-}" = "--pid" ]; then
    log "monitor PID $FILTER_PID trên $INPUT_TS (2 lần lặp để có CC liên tục)"
    exec tsp -I file --repeat 2 "$INPUT_TS" -P vtcmonitor --pid "$FILTER_PID" -O drop
else
    log "monitor toàn bộ PID trên $INPUT_TS (2 lần lặp)"
    log "thử --pid <n> để lọc 1 kênh MPTS"
    exec tsp -I file --repeat 2 "$INPUT_TS" -P vtcmonitor -O drop
fi
