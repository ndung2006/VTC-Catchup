# 13 — Dời backend ra khỏi Coolify (plain compose + systemd)

> Mặt bắt tín hiệu chạy 24/7 thì vòng đời phải là systemd, không phải nút
> Redeploy. Frontend Next.js (stateless) cứ để trong Coolify.

## Vì sao (bằng chứng, không phải khẩu hiệu)

1. Coolify đè `--network host` thành bridge → mù multicast (đã đo: `net=coolify`).
2. Mỗi redeploy đổi IP container (`10.0.1.7`→`.8`→`.9`) → Frontend đỏ theo.
3. Backend bridge không publish cổng + UFW DROP container→host → không địa chỉ nào ổn định.
4. Build source TSDuck ~8 phút mỗi lần deploy; `.deb` ghim version ~1 phút.

## 0. Chuẩn bị trên máy backend (Ubuntu 24.04, làm 1 lần)

```bash
# Kho do bạn làm chủ, NGOÀI tầm Coolify (nó reset --hard kho của nó).
sudo mkdir -p /srv/vtccatchup && sudo chown $USER:$USER /srv/vtccatchup
git clone https://github.com/ndung2006/VTC-Catchup /srv/vtccatchup/repo
cd /srv/vtccatchup/repo && git checkout main

# Secret (ngoài git).
cp .env.prod.example .env.prod && nano .env.prod   # JWT, admin, Telegram, SMTP, PORT=18080

# Thư mục host (compose bind trực tiếp, phải tồn tại trước).
sudo mkdir -p /media/ramdisk/live /mnt/Data/catchup/captures /mnt/Data/catchup/exports \
  /opt/vtc/conf/sources /var/log/vtccatchup
sudo mount -t tmpfs -o size=4G tmpfs /media/ramdisk/live   # hoặc scripts/mount-ramdisk.sh
```

**Ghim tuyến multicast đầu vào (239.x) vào netplan — KHÔNG bỏ qua.**
Catchup là phía THU (ngược với VTC-SI phía phát), nhưng bẫy y hệt: `ip route add`
mất sau reboot, tín hiệu lặng lẽ đi sai card. Thêm vào NIC nhận tín hiệu trong
`/etc/netplan/*.yaml`:

```yaml
    <nic-nhan-tin-hieu>:
      routes:
        - to: 239.0.0.0/8
          scope: link
```

```bash
sudo netplan try
ip route get <multicast-input-cua-ban>   # phải ra đúng dev + src card thu
```

**Sao lưu cấu hình đang chạy** (trước khi đụng gì): vào `/admin` → Tải file sao
lưu. Rồi chép dữ liệu persist của container Coolify cũ ra host (volume của nó
nằm trong Docker, không phải `/opt/vtc/...` của host):

```bash
BE=$(docker ps --format '{{.Names}} {{.Image}}' | grep -E 'vtc.*backend|bvgrkxbvrfh3adzrlbbj0vhe' | awk '{print $1}' | head -1)
docker cp $BE:/opt/vtc/conf/sources/sources.db.json /opt/vtc/conf/sources/sources.db.json
```

## 1. Build + bật backend mới (chưa đụng hệ cũ)

```bash
cd /srv/vtccatchup/repo
docker compose -f docker-compose.catchup.yml build backend   # ~1-2 phút (.deb)
docker compose -f docker-compose.catchup.yml up -d backend
```

Xác nhận, thiếu một dòng là dừng lại sửa, không đi tiếp:

```bash
docker inspect vtccatchup-backend --format '{{.HostConfig.NetworkMode}}'  # phải là: host
docker exec vtccatchup-backend tsp --version                              # phải là: 3.44-4676
docker exec vtccatchup-backend tsp -P vtcmonitor --help >/dev/null && echo PLUGIN-OK
curl -m 5 -s http://127.0.0.1:18080/health                                # phải là: {"ok":true}
```

Rồi Start thử **1 nguồn** trên giao diện (FE vẫn trỏ backend cũ lúc này — dùng
`curl` với cookie login hoặc tạm sửa `/etc/hosts`; mục tiêu chỉ là thấy playlist
mọc trong `/media/ramdisk/live/<kenh>/`).

## 2. Chuyển Frontend sang (Coolify)

`VTC_API_ORIGIN=http://<gateway-mang-coolify>:18080` (thường `http://10.0.1.1:18080`;
lấy chắc bằng `ip -4 addr show | grep -B2 10.0.1.1` trên host) → Deploy Frontend.
Mở firewall cho đường này (làm 1 lần, tồn tại sau reboot vì qua ufw):

```bash
BR=$(ip -4 addr show | grep -B2 '10.0.1.1' | head -1 | awk '{print $2}' | tr -d ':')
ufw allow in on $BR to any port 18080 proto tcp
```

F5 `/admin` → xanh, bắn tin thử → `sent`.

## 3. Dừng backend cũ trên Coolify (sau khi mới đã xanh)

Stop resource Backend cũ. **Đừng xóa vội** — giữ làm đường lui 1 tuần. Chú ý
không bao giờ chạy 2 backend cùng lúc (cùng ghi volumes + cùng bắt multicast).

## 4. Cho systemd lo sau reboot + máy dự phòng

```bash
sudo cp systemd/vtccatchup-backend.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now vtccatchup-backend
```

Máy thứ hai làm y hệt; `restart: unless-stopped` + unit này là đủ, không cần
Coolify đụng vào. (Catchup thu tín hiệu nên 2 máy không xung đột nhau như cặp
phát SI — nhưng retention/GC trên ổ riêng từng máy.)

## 5. Lui về (khi backend mới có vấn đề)

```bash
docker compose -f docker-compose.catchup.yml stop backend   # ở /srv/vtccatchup/repo
```

Rồi Start lại resource Backend cũ trên Coolify + trỏ `VTC_API_ORIGIN` về IP/container
cũ + Deploy Frontend. Cấu hình sources còn nguyên trong volume cũ và file backup
bước 0.

## Ghi nhớ vận hành

- **TSDuck ghim `3.44-4676`** (ARG trong Dockerfile.backend, cùng version VTC-SI).
  Đổi version = đổi hành vi nhị phân → Start thử 1 nguồn rồi mới tin. Bản này khác
  bản build-source cũ (`3.39-3956`); conf chỉ dùng plugin ổn định
  (`ip/file/zap/fork/hls/drop` + `vtcmonitor`) nên an toàn, nhưng vẫn phải thử.
- **Không CPU quota** cho backend (compose đã bỏ; throttle cgroup gây khoảng lặng
  UDP mà watchdog đọc thành "mất nguồn"). RAM giới hạn 2G thì vô hại.
- Log 2 lớp: `vtc.log` xoay trong app + json-file `20m×5` của Docker.
- Đổi cấu hình → backup `/admin` trước; config là JSON trong
  `/opt/vtc/conf/sources/sources.db.json`, chép đi là mang được sang máy khác.
