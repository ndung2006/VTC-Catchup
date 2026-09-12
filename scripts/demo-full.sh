#!/bin/sh
# ==============================================================================
# demo-full.sh — Pipeline hoàn chỉnh: gen conf MPTS 2 kênh + chạy tsp @conf.
# POSIX sh. Chạy trong container tsduck:
#   docker compose exec tsduck sh /work/scripts/demo-full.sh
# Trên host (không docker): sh scripts/gen-conf.sh ... để sinh conf rồi xem.
# ==============================================================================
set -eu
log() { printf '[vtc-full] %s\n' "$*"; }

ROOT="/work"
if [ ! -d "$ROOT/scripts" ]; then
    # đang ở host repo (không phải /work trong container)
    ROOT="."
fi

SAMPLE_IN="file /tmp/vtc-demo/input.ts --repeat"

log "B1: sinh conf MPTS DEMO 2 kênh (sid 4,5 — khớp file mẫu test-3packets)"
sh "$ROOT/scripts/gen-conf.sh" \
    --source DEMO \
    --input "$SAMPLE_IN" \
    --channel demo4:4:1 \
    --channel demo5:5:1 \
    --record-all 1

CONF_HOST="storage/conf/DEMO.conf"
CONF_CT="/opt/vtc/conf/sources/DEMO.conf"
if [ -f "$CONF_HOST" ]; then
    log "xem conf vừa sinh:"
    cat "$CONF_HOST"
fi

if ! command -v tsp >/dev/null 2>&1; then
    log "không có tsp ở đây (host). Copy $CONF_HOST vào container rồi chạy:"
    log "  tsp @$CONF_CT"
    exit 0
fi

# Trong container: đảm bảo input mẫu + plugin đã cài.
sh "$ROOT/scripts/demo-cli.sh" --help >/dev/null 2>&1 || true
log "B2: chạy pipeline (Ctrl+C để dừng, host check zombie=0)"
if [ -f "$CONF_CT" ]; then
    exec tsp @"$CONF_CT"
else
    log "không thấy $CONF_CT, chạy fallback demo-cli 1 kênh"
    exec sh "$ROOT/scripts/demo-cli.sh"
fi
