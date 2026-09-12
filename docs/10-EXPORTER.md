# Phase 5 — Catchup Exporter (trích xuất bất đồng bộ)

> Backend `tsc` sạch, `npm test` **42/42 xanh**; frontend `tsc` + `next build` OK.

## Backend (`src/exporter/exporter.ts`)

- **Validate cứng (PRD §6.A/§17.A):** Out>In; thời lượng ≤6h (message đúng PRD); disk exports >90% từ chối job mới; không có chunk phủ khoảng → 400 (không tạo job rác).
- **Async (PRD §6.C/§17.B):** `submit()` tạo job `QUEUED` → trả 200 ngay; `pump()` giữ tối đa 2 concurrent (tránh nghẽn I/O), còn lại xếp hàng; lệnh `tsp -I file <chunk...> -P zap <SID> -O file <out>`, `detached:false` (job ngắn hạn, không fork).
- **Chống "thành công giả" (PRD §17.C):** chỉ `exit 0` + stat thấy file mới `SUCCESS`; fail → `ERROR` + `unlink` file dở.
- **Map thời gian → chunk:** file `catchup_*.ts` có mtime phủ `[In, Out]` (chunk 60s, hằng `CAPTURE_CHUNK_MS`).
- **Xóa (PRD §6.E):** `remove()` unlink vật lý trước, record sau; file mất vẫn xóa record; job đang chạy không cho xóa.
- **Tên file (PRD §6.D):** `Kênh_DDMMYYYY_HHmm-HHmm.ts` giờ VN (test đúng mẫu `THVL1_17042026_0700-1200.ts`).

## API (sau gate auth)

| Method | Route | Ghi chú |
|---|---|---|
| POST | `/api/exports` | `{channelName,sourceId,serviceId,inPoint,outPoint}` (ISO hoặc epoch) → 200 job ngay |
| GET | `/api/exports`, `/api/exports/:id` | lịch sử (mới nhất trước) |
| GET | `/api/exports/:id/download` | stream `createReadStream().pipe(res)` + `Content-Disposition: attachment` (không load RAM); 409 khi chưa xong, 404 khi file bị GC dọn |
| DELETE | `/api/exports/:id` | xóa file rồi xóa record |

## Frontend (`app/exports/page.tsx`)

Dropdown kênh từ `/api/sources` (kèm sourceId/serviceId), validate client y hệt backend, poll 3s cập nhật `Đang xử lý → Hoàn thành/Lỗi`, nút Tải (link download, cookie đi kèm) + Xóa có **modal xác nhận** đúng PRD.

## Thử nhanh

```sh
# Backend chạy với tsp thật (container) hoặc fake; seed chunk rồi:
curl -c jar -X POST :8080/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"..."}'
curl -b jar -X POST :8080/api/exports -H 'content-type: application/json' -d \
 '{"channelName":"demo4","sourceId":"S1","serviceId":4,"inPoint":"2026-09-12T00:00:00+07:00","outPoint":"2026-09-12T02:00:00+07:00"}'
curl -b jar :8080/api/exports/exp_xxx/download -o out.ts
```

## Còn lại: Phase 6 Deploy

Dockerfile backend + Nginx (serve HLS, anti-hotlink, X-Accel cho download) + sysctl Prod + tài liệu vận hành.
