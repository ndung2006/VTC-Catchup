# B3 — Config theo Source + pipeline full MPTS

> `gen-conf.sh` là bản shell của `ConfigGenerator` (Phase 1). Bản Node TS sau này giữ nguyên logic.

## Sinh conf

```sh
# Dev với file mẫu (2 kênh sid 4,5):
sh scripts/gen-conf.sh --source DEMO \
  --input "file /tmp/vtc-demo/input.ts --repeat" \
  --channel demo4:4:1 --channel demo5:5:1 --record-all 1

# Prod multicast (VD TS8):
sh scripts/gen-conf.sh --source TS8 \
  --input "ip 239.69.69.10:1234" \
  --channel DongNai1:2004:1 --channel LaoCai:2005:1 --record-all 1

cat storage/conf/DEMO.conf
```

Kết quả `DEMO.conf` (đã verify chạy trên TSDuck 3.44 thật, 15/09/2026):

```
-I
file
/tmp/vtc-demo/input.ts
--repeat
-P
vtcmonitor
-P
fork
tsp -P zap 4 -O hls --duration 5 --live 5 --playlist /media/ramdisk/live/demo4/index.m3u8 /media/ramdisk/live/demo4/segment.ts
...
```

**Định dạng bắt buộc: mỗi dòng đúng 1 argv, không comment, không ngoặc kép.**
`@file` của TSDuck không tách khoảng trắng kiểu shell — ghi `-I ip ...` chung
dòng là tsp nhai từng ký tự (`unknown option -2 -3 -9...`). Chuỗi lệnh fork là
1 dòng = 1 argv (tương đương shell `"..."` nhưng không quote).

**Lưu chiểu = VoD (không `--live`).** `--live N` là live stream và TSDuck tự xóa
segment cũ; `--live 0` bị cấm từ 3.44. Template không phải printf — TSDuck tự
đánh số (`catchup-000000.ts`, exporter đọc theo mtime nên không care tên).

Chặn sẵn case vô nghĩa (0 live + record_all=0 → chỉ còn `-O drop`) và SID 0
(đặt trước cho NIT — `zap 0` thoát ngay).

## Chạy full trong container

```sh
docker compose up -d --build tsduck
docker compose exec tsduck sh -c "cd /work/plugins/vtcmonitor && make && make install"
docker compose exec tsduck sh /work/scripts/demo-full.sh
# terminal khác:
docker compose exec tsduck tsp @/opt/vtc/conf/sources/DEMO.conf
```

Dừng: `Ctrl+C` (SIGINT cả nhóm fork). Host kiểm tra `sh scripts/check-zombie.sh` → `zombie=0`.

## Map sang backend Node (Phase 2)

`gen-conf.sh` → `apps/backend/src/core/ConfigGenerator.ts` (cùng input/output, thêm `conf_rev` + `preview-conf` API). `demo-full.sh` → `ProcessManager.start/stop` (`detached:true`, `kill(-pid)`).
