#!/bin/sh
# ==============================================================================
# prod-check.sh — Kiểm tra máy Prod đạt yêu cầu hạ tầng (PRD §11 + §16) TRƯỚC
# khi `docker compose --profile prod up`. Chạy trên HOST Ubuntu (sudo):
#   sudo sh scripts/prod-check.sh
# Exit 0 = đạt; exit 1 + dòng [FAIL] = phải sửa.
# ==============================================================================
set -eu

PASS=0; FAIL=0
ok() { printf '[PASS] %s\n' "$*"; PASS=$((PASS + 1)); }
bad() { printf '[FAIL] %s\n' "$*"; FAIL=$((FAIL + 1)); }

log() { printf '[prod-check] %s\n' "$*"; }

# --- 1. OS + kernel tuning (multicast) ---
if [ -f /etc/os-release ]; then
    log "OS: $(grep PRETTY_NAME /etc/os-release | cut -d= -f2)"
fi

rp=$(cat /proc/sys/net/ipv4/conf/all/rp_filter 2>/dev/null || echo "?")
if [ "$rp" = "0" ]; then ok "rp_filter=0 (nhận multicast ngoài default gateway)"; else bad "rp_filter=$rp, cần 0 — áp dụng scripts/sysctl-vtc.conf"; fi

rmem=$(cat /proc/sys/net/core/rmem_max 2>/dev/null || echo 0)
if [ "$rmem" -ge 26214400 ]; then ok "rmem_max=$rmem (≥25MB)"; else bad "rmem_max=$rmem, cần ≥26214400 — áp dụng sysctl-vtc.conf"; fi

# --- 2. RAMDisk tmpfs cho HLS ---
if mount | grep -q " /media/ramdisk/live .*tmpfs"; then
    ok "tmpfs đã mount tại /media/ramdisk/live"
else
    bad "/media/ramdisk/live chưa mount tmpfs — chạy scripts/mount-ramdisk.sh"
fi

# --- 3. Ổ catchup + dung lượng trống ---
if [ -d /mnt/Data/catchup/captures ]; then
    free_pct=$(df -P /mnt/Data/catchup/captures | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
    if [ "$free_pct" -lt 85 ]; then ok "captures đã dùng ${free_pct}% (<85%)"; else bad "captures đã dùng ${free_pct}% — dọn trước khi lên sóng"; fi
else
    bad "/mnt/Data/catchup/captures chưa tồn tại — mount HDD/SAN trước"
fi

# --- 4. Docker ---
if command -v docker >/dev/null 2>&1; then ok "docker: $(docker --version)"; else bad "chưa cài docker"; fi

# --- 5. Danh sách kiểm tra bằng tay (không tự động được) ---
log "CHECK tay: IP multicast đã về dải 239.x.x.x (RFC 2365)?"
log "CHECK tay: firewall mở 80 (nginx), 8080 nếu gọi API trực tiếp?"
log "CHECK tay: .env.prod đã điền JWT secret + admin pass mạnh?"
log "CHECK tay: Telegram bot token + chat ID tổ trực?"

printf '[prod-check] PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
