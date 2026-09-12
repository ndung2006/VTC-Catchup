# Phase 6 — Deploy (Docker + Nginx + hạ tầng Prod)

> Đã verify: `next build` standalone OK (`.next/standalone/server.js` — đúng thứ Dockerfile chạy),
> backend `tsc` + chạy `node dist/server.js` OK, compose YAML hợp lệ (yamllint), mọi `sh` qua `sh -n`.
> Box này không có Docker nên `docker build/up` chưa chạy ở đây — đem ra máy có Docker là lên.

## Bản đồ image

| Service | Dockerfile | Ghi chú |
|---|---|---|
| `tsduck` (demo) | `docker/Dockerfile.tsduck` | Ubuntu 24.04 + tsp, `sleep infinity` để exec demo |
| `demo-hls` (dev) | `nginx:alpine` + `docker/nginx.demo.conf` | serve `./storage/ramdisk` ở :8081 để xem Live local |
| `backend` (prod) | `docker/Dockerfile.backend` | Ubuntu 24.04 + tsduck + Node 20: backend spawn tsp con cùng net namespace |
| `frontend` (prod) | `docker/Dockerfile.frontend` | multi-stage, chạy `.next/standalone` user `nextjs` |
| `nginx` (prod) | `nginx:1.27-alpine` + `docker/nginx.conf` | cửa vào :80 duy nhất |

Vì sao backend gộp chung với tsp thay vì `node:alpine` riêng: `tsp` là child process kế thừa network namespace của container — tách image thì child không bắt được multicast của host.

Vì sao container 24.04 trong khi host 22.04: upstream chỉ còn binary TSDuck mới cho 24.04+; container khác OS host không ảnh hưởng tsp user-space. Backend ở host network gọi không được DNS compose nên frontend/nginx dùng `host.docker.internal` (cần `extra_hosts`, đã có trong compose).

## Demo trên laptop (không cần multicast)

```sh
docker compose --profile demo up -d --build
docker compose exec tsduck sh /work/scripts/demo-cli.sh
# Xem Live local: NEXT_PUBLIC_HLS_BASE=http://localhost:8081/hls (demo-hls serve ./storage/ramdisk)
docker compose exec tsduck sh -c "cd /work/plugins/vtcmonitor && make && make install"
docker compose exec tsduck sh /work/scripts/demo-monitor.sh
```

## Prod single-node (checklist)

```sh
sudo sh scripts/prod-check.sh        # rp_filter, rmem 25MB, tmpfs, disk, docker
sudo sh scripts/mount-ramdisk.sh     # tmpfs 4G cho HLS
cp .env.prod.example .env.prod       # điền JWT secret + admin pass + Telegram
docker compose --profile prod up -d --build
# Bind HDD thật: docker compose --profile prod -f docker-compose.yml -f compose.prod.yml up -d
```

- Backend `network_mode: host` (bắt multicast từ switch), GC tự chạy mỗi giờ (`VTC_GC_ENABLE=1`).
- Nginx: `/hls/` từ RAMDisk (`.m3u8` no-cache, anti-hotlink referer + cho VLC), `/api/` proxy giữ cookie/SSE/stream, `/protected-exports/` internal dành cho X-Accel khi cần.
- `.dockerignore` cả 2 app để image gọn, không lọt `node_modules`/`storage`.

## Quy chuẩn mạng (PRD §11/§16, đã có sẵn file)

- `scripts/sysctl-vtc.conf`: `rp_filter=0`, `rmem/wmem ≥25MB`.
- IP multicast về `239.x.x.x` (RFC 2365), bỏ dải sai `227.x/238.60.x`.
- Sizing: remux-only, không GPU — 10 kênh HD ~60Mbps (NIC 1G dư sức), tmpfs 4GB, disk ~1.9TB/kênh/30 ngày.
