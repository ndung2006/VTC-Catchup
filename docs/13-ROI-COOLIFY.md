# 13 — Backend trên máy WSL (plain compose + systemd, ngoài Coolify)

> Mặt bắt tín hiệu chạy 24/7 thì vòng đời phải là systemd, không phải nút
> Redeploy. Frontend Next.js (stateless) ở lại Coolify.
> Áp dụng cho backend từ commit `5cbef52` trở đi (TSDuck .deb 3.44-4676,
> plugin vtcmonitor build sẵn trong image, PORT 18080, link HLS có token).

## 0. Điều kiện + quy ước

- Windows 11 22H2+, WSL2 + distro Ubuntu-24.04, máy đã vào đúng LAN tín hiệu.
- Quy ước dưới đây: `<IP-WIN>` = IP máy Windows, `<MCAST>` = multicast thật.
- Mọi lệnh WSL chạy trong distro Ubuntu (không phải PowerShell, trừ chỗ ghi rõ).

## 1. Windows: mirrored network + nguồn + firewall (làm 1 lần)

```powershell
winver                        # >= 22H2
wsl --version; wsl -l -v      # wsl >= 2.0; chưa có Ubuntu-24.04 thì: wsl --install -d Ubuntu-24.04
```

File `%USERPROFILE%\.wslconfig` (NAT mặc định mù multicast — bắt buộc đổi):

```ini
[wsl2]
networkingMode=mirrored
memory=8GB
```

```powershell
wsl --shutdown
# Sleep/Hibernate = Never (lab ngủ là backend chết). IP tĩnh hoặc DHCP reservation.
New-NetFirewallRule -DisplayName "VTC-Catchup BE" -Direction Inbound -Protocol TCP -LocalPort 18080 -Action Allow
```

## 2. Trong WSL: Docker + systemd + code

```bash
# Docker TRONG distro (đừng qua Docker Desktop — Desktop có VM riêng, lằng nhằng):
sudo apt update && sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
sudo usermod -aG docker $USER && newgrp docker && docker --version

# systemd (để chạy unit backend):
printf '[boot]\nsystemd=true\n' | sudo tee /etc/wsl.conf
# -> ra PowerShell: wsl --shutdown ; mở lại Ubuntu; kiểm tra:
systemctl is-system-running   # running/degraded đều OK

# Code (kho do bạn làm chủ, ngoài tầm Coolify):
sudo mkdir -p /srv/vtccatchup && sudo chown $USER:$USER /srv/vtccatchup
git clone https://github.com/ndung2006/VTC-Catchup /srv/vtccatchup/repo
cd /srv/vtccatchup/repo && git checkout main && git log --oneline -1
```

## 3. Secret + ổ đĩa + mạng (làm 1 lần, kiểm từng dòng)

```bash
# Secret — sinh 2 chuỗi, GIỮ LẠI để dán sang Frontend sau:
openssl rand -hex 32   # -> VTC_JWT_SECRET
openssl rand -hex 32   # -> VTC_HLS_SECRET (phải GIỐNG HỆT 2 bên, lệch là 403 hết link xem)
cp .env.prod.example .env.prod && nano .env.prod
# Điền: 2 secret trên, VTC_ADMIN_USER=admin + pass mạnh, Telegram bot/chat,
# PORT=18080. SMTP để trống cũng được.

# Ổ đĩa (compose bind trực tiếp, phải tồn tại trước):
sudo mkdir -p /mnt/Data/catchup/captures /mnt/Data/catchup/exports /opt/vtc/conf/sources /var/log/vtccatchup /media/ramdisk/live
echo 'tmpfs /media/ramdisk/live tmpfs size=4G 0 0' | sudo tee -a /etc/fstab
sudo mount -a && df -h /media/ramdisk/live

# Mạng mirrored có ăn không? (WSL mirrored KHÔNG dùng netplan — sai là sửa phía Windows)
ip addr | grep -E 'inet 192\.168'      # phải thấy IP của Windows
ip route get <MCAST>                   # phải ra đúng card đi về phía nguồn phát
```

**Sao lưu cấu hình đang chạy** trước khi đụng gì: `/admin` → Tải file sao lưu.

## 4. Build + bật + verify 5 dòng (thiếu 1 dòng là dừng)

```bash
cd /srv/vtccatchup/repo
docker compose -f docker-compose.catchup.yml build backend   # ~1-2 phút (.deb ghim 3.44-4676)
docker compose -f docker-compose.catchup.yml up -d backend
docker inspect vtccatchup-backend --format '{{.HostConfig.NetworkMode}}'  # host
docker exec vtccatchup-backend tsp --version                              # 3.44-4676
docker exec vtccatchup-backend tsp -P vtcmonitor --help >/dev/null && echo PLUGIN-OK
curl -m 5 -s http://127.0.0.1:18080/health                                # {"ok":true}
```

Thử tín hiệu thô (chưa qua UI):

```bash
tsp -I ip <MCAST> -P analyze -O drop
# Có bitrate/packet chạy = đường tín hiệu vào tới nơi. Ctrl-C thoát.
```

Giao systemd giữ sau reboot:

```bash
sudo cp systemd/vtccatchup-backend.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now vtccatchup-backend
```

## 5. Nối Frontend (Coolify, 2 phút)

`VTC_API_ORIGIN=http://<IP-WIN>:18080` + `VTC_HLS_SECRET` (chuỗi bước 3) →
Deploy Frontend → `/login` → `/admin` xanh → bắn tin thử → `/sources` thêm nguồn
(`-I ip <MCAST>`, kênh + SID) → Start → `/channels` → `/channel/<tên>` xem live,
link token sống 4 giờ, copy sang VLC chạy.

## 6. Thử reboot + rollback

Restart Windows → mở Ubuntu → `docker ps` thấy backend tự lên, health OK, nguồn
RUNNING tự chạy lại. Hỏng: `docker logs vtccatchup-backend | tail -30`.

Lui về: `docker compose -f docker-compose.catchup.yml stop backend`, trỏ FE về
backend cũ + Deploy FE. Cấu hình còn trong `/opt/vtc/conf/sources/sources.db.json`
và file backup bước 3.

## Ghi nhớ vận hành

- TSDuck ghim `3.44-4676` (ARG trong Dockerfile.backend, chung version VTC-SI).
  Đổi version = đổi hành vi → Start thử 1 nguồn rồi mới tin.
- Không CPU quota (compose đã bỏ); RAM 2G; log 2 lớp (`vtc.log` xoay + json-file).
- VTC-SI chạy máy khác, không đụng cổng nhau (SI web `:8080`, Catchup `:18080`).
