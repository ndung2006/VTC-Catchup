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

Kết quả `DEMO.conf` (đã verify chạy):

```
-I file /tmp/vtc-demo/input.ts --repeat
-P vtcmonitor
-P fork "tsp -P zap 4 -O hls .../demo4/..."
-P fork "tsp -P zap 5 -O hls .../demo5/..."
-O hls --duration 60 --live 0 /mnt/Data/catchup/captures/DEMO/catchup_%05d.ts
```

Chặn sẵn case vô nghĩa (0 live + record_all=0 → chỉ còn `-O drop`).

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
