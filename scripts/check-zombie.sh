#!/bin/sh
# ==============================================================================
# check-zombie.sh — Chứng minh không rò process (bài học 19k Zombie)
# Chạy trên HOST Linux (không phải trong container):
#   sh scripts/check-zombie.sh
#   sh scripts/check-zombie.sh --watch   # theo dõi mỗi 2s
# Kỳ vọng: ZOMBIE=0 sau mọi chu kỳ Start/Stop.
# Nếu >0: còn sót fork con -> kiểm tra lại kill PGID (kill -- -PID).
# ==============================================================================
set -eu

count_zombie() {
    # Đếm process state Z trên Linux (/proc). Portable hơn `ps aux | grep defunct`.
    n=0
    if [ -d /proc ]; then
        for d in /proc/[0-9]*; do
            if [ -r "$d/stat" ]; then
                # field 3 trong /proc/PID/stat là state
                st=$(cut -d' ' -f3 "$d/stat" 2>/dev/null || echo "?")
                if [ "$st" = "Z" ]; then
                    n=$((n + 1))
                fi
            fi
        done
    else
        # Fallback macOS/BSD
        n=$(ps aux 2>/dev/null | grep -c defunct || true)
    fi
    printf '%s' "$n"
}

count_tsp() {
    if command -v pgrep >/dev/null 2>&1; then
        pgrep -c -f "tsp" 2>/dev/null || printf '0'
    else
        ps aux 2>/dev/null | grep -c "[t]sp" || true
    fi
}

report() {
    z=$(count_zombie)
    t=$(count_tsp)
    printf '[vtc-check] tsp_processes=%s zombie=%s\n' "$t" "$z"
    if [ "$z" != "0" ]; then
        printf '[vtc-check][WARN] phát hiện Zombie! Liệt kê:\n'
        ps -o pid,ppid,stat,cmd 2>/dev/null | awk '$3 ~ /Z/ {print}' || true
        return 1
    fi
    return 0
}

if [ "${1:-}" = "--watch" ]; then
    while true; do report || true; sleep 2; done
else
    report
fi
