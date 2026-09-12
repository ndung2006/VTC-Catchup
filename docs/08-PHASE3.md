# Phase 3 — Workers: GC + Alert + HLS healthcheck

> `tsc` sạch, `npm test` **33/33 xanh**.

## Module (`src/jobs/`)

| File | Việc | Test |
|---|---|---|
| `garbageCollector.ts` | Pass 1 xóa `*.ts` quá hạn (retention theo source, mặc định 30 ngày; exports 7 ngày). Pass 2 disk vượt ngưỡng (mặc định 85%) → ép xóa cũ nhất trước. **Không đụng file <1h tuổi** (chunk đang ghi) và file không phải `.ts`. `dryRun` để xem trước. | tmp thật: quá hạn/còn hạn, retention từng source, ép xóa trừ file nóng, dryRun, bỏ qua `.m3u8` |
| `notify.ts` | `TelegramNotifier.alert(key, text)` — cooldown 5'/key chống spam, chưa cấu hình thì log console (không crash), fetch lỗi → `error` (không ném). Template `🚨 [CẢNH BÁO][SOURCE] ...` để filter. | log-mode, cooldown, lỗi mạng, template |
| `healthcheck.ts` | `checkHlsHealth(liveBase, 15s)` — playlist quá 15s không đổi hoặc mất file → `stale` (bắt ca process sống nhưng hình đứng). | fresh/old/missing, dir không tồn tại |

## Gắn vào server

- `ProcessManager` `onCcError` → Telegram key `cc:<sourceId>` (Trigger 2, PRD §15).
- `POST /api/admin/gc {dryRun?}` (auth) — chạy GC ngay, retention lấy từ từng source (`retentionDays`, chốt BRAINSTORM §2.4: theo Source); disk sau >90% → bắn critical.
- `GET /api/admin/hls-health` (auth) — danh sách kênh stale cho dashboard.
- `VTC_GC_ENABLE=1` → server tự GC mỗi giờ (test không bật nên không ảnh hưởng).

## Env

- `VTC_TELEGRAM_BOT_TOKEN`, `VTC_TELEGRAM_CHAT_ID` — thiếu thì chỉ log (dev).
- `VTC_GC_ENABLE=1` — bật cron giờ trong server (Prod).
- `VTC_CAPTURE_DIR`, `VTC_EXPORTS_DIR`, `VTC_LIVE_DIR` — ghi đè path mặc định.

## Thử nhanh

```sh
curl -c jar.txt -X POST localhost:8080/api/auth/login -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin12345"}'
curl -b jar.txt -X POST localhost:8080/api/admin/gc -H 'content-type: application/json' -d '{"dryRun":true}'
curl -b jar.txt localhost:8080/api/admin/hls-health
```

## Còn lại sang Phase 5/6

Nodemailer gửi mail reset-password thật, Nginx X-Accel download, Dockerfile backend + sysctl Prod (đã có `scripts/` mẫu).
