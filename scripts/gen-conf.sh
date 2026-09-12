#!/bin/sh
# ==============================================================================
# gen-conf.sh — Sinh tsp .conf theo Source (MPTS), đúng PRD §3.1 + fix Zombie.
# POSIX sh. Đây là bản shell của ConfigGenerator (bản Node TS sẽ làm ở Phase 2,
# logic giữ nguyên để không phải viết lại).
#
# Công thức:
#   -I <input> -P vtcmonitor -P zap <SID> [-P fork "tsp ... HLS ..."]... -O hls|--drop
# Quy tắc:
#   - 1 Source = 1 file .conf = 1 process tsp @conf chạy 24/7.
#   - TUYỆT ĐỐI KHÔNG --max-duration. Cắt chunk = -O hls --live 0.
#   - Mỗi kênh is_live=true sinh 1 fork HLS con trên RAMDisk.
#
# Dùng:
#   sh scripts/gen-conf.sh --source DEMO --input "file /tmp/vtc-demo/input.ts --repeat" \
#     --channel ch1:5:1 --channel ch2:6:1 --record-all 1
#   sh scripts/gen-conf.sh --source TS8 --input "ip 239.69.69.10:1234" \
#     --channel "DongNai1:2004:1" --channel "LaoCai:2005:1" --record-all 1
#   cat storage/conf/DEMO.conf
# ==============================================================================
set -eu

SOURCE=""; INPUT=""; RECORD_ALL=1
CHANNELS=""

log() { printf '[gen-conf] %s\n' "$*"; }
die() { printf '[gen-conf][ERROR] %s\n' "$*" >&2; exit 1; }
usage() {
    echo "Usage: $0 --source ID --input \"...\" [--channel name:sid:is_live]... [--record-all 0|1]"
    exit 2
}

while [ $# -gt 0 ]; do
    case "$1" in
        --source) SOURCE="${2:-}"; shift 2;;
        --input) INPUT="${2:-}"; shift 2;;
        --channel) CHANNELS="$CHANNELS ${2:-}"; shift 2;;
        --record-all) RECORD_ALL="${2:-}"; shift 2;;
        -h|--help) usage;;
        *) die "arg lạ: $1";;
    esac
done

[ -n "$SOURCE" ] || usage
[ -n "$INPUT" ] || usage

OUT="storage/conf/${SOURCE}.conf"
mkdir -p "$(dirname "$OUT")"

live_count=0
for c in $CHANNELS; do
    # format name:sid:is_live — name không chứa dấu cách khi dùng shell demo
    is_live=$(printf '%s' "$c" | awk -F: '{print $3}')
    if [ "$is_live" = "1" ]; then live_count=$((live_count + 1)); fi
done

if [ "$live_count" -eq 0 ] && [ "$RECORD_ALL" != "1" ]; then
    die "Source $SOURCE vô nghĩa: 0 kênh live + record_all=0 (chỉ còn -O drop). Từ chối sinh conf."
fi

{
    printf '# VTCCatchup conf — Source %s (sinh bởi gen-conf.sh, 1 process 24/7)\n' "$SOURCE"
    printf '# KHÔNG dùng --max-duration. Dừng bằng SIGTERM tới PGID.\n'
    printf -- '-I %s\n' "$INPUT"
    printf -- '-P vtcmonitor\n'
    # Tách service chung nếu muốn giữ PAT/PMT gốc? Ở đây zap tổng để giữ MPTS cho record.
    # Fork HLS từng kênh:
    for c in $CHANNELS; do
        name=$(printf '%s' "$c" | awk -F: '{print $1}')
        sid=$(printf '%s' "$c" | awk -F: '{print $2}')
        is_live=$(printf '%s' "$c" | awk -F: '{print $3}')
        if [ "$is_live" = "1" ]; then
            printf -- '-P fork "tsp -P zap %s -O hls --duration 5 --live 5 --playlist /media/ramdisk/live/%s/index.m3u8 /media/ramdisk/live/%s/segment.ts"\n' \
                "$sid" "$name" "$name"
        fi
    done
    if [ "$RECORD_ALL" = "1" ]; then
        printf -- '-O hls --duration 60 --live 0 /mnt/Data/catchup/captures/%s/catchup_%%05d.ts\n' "$SOURCE"
    else
        printf -- '-O drop\n'
    fi
} > "$OUT"

log "wrote $OUT (live_channels=$live_count record_all=$RECORD_ALL)"
cat "$OUT"
