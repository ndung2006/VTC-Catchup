#!/bin/bash
# Mount RAMDisk tmpfs cho HLS live (Prod). Dev dùng ./storage/ramdisk.
# Usage: sudo ./mount-ramdisk.sh
set -e
sudo mkdir -p /media/ramdisk/live
sudo mount -t tmpfs -o size=4G tmpfs /media/ramdisk/live
echo "Mounted tmpfs 4G at /media/ramdisk/live"
df -h /media/ramdisk/live
