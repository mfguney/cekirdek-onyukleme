#!/bin/sh
# SPDX-License-Identifier: MIT
# İki bölümlü bir disk imajı oluşturur (yönetici yetkisi gerekmez). Bölüm 1, 2.
#   vda1 (boot, ext4): Image, initramfs.cpio.gz, extlinux/extlinux.conf, boot.scr, ornek.itb
#   vda2 (kök, ext4) : kok-olustur.sh ile hazırlanan kök dosya sistemi
# Kullanım: ./disk-olustur.sh <hedef-dizin>   (kok-olustur.sh'nin hedef dizini; içinde Image bulunmalı)
set -eu
H=${1:?hedef dizin}
ORNEK=$(cd "$(dirname "$0")/.." && pwd)
rm -rf "$H/boot"; mkdir -p "$H/boot/extlinux"
cp "$H/Image" "$H/initramfs.cpio.gz" "$H/boot/"
cp "$ORNEK/u-boot/extlinux.conf" "$H/boot/extlinux/"
mkimage -A arm64 -O linux -T script -C none -n "ornekos boot" -d "$ORNEK/u-boot/boot.cmd" "$H/boot/boot.scr" >/dev/null
[ -f "$H/ornek.itb" ] && cp "$H/ornek.itb" "$H/boot/"

rm -f "$H/boot.img" "$H/kok.img" "$H/disk.img"
mke2fs -q -t ext4 -L boot -d "$H/boot" "$H/boot.img" 48M
mke2fs -q -t ext4 -L kok  -d "$H/kok"  "$H/kok.img"  96M

# 1 MiB hizalı MBR bölüm tablosu: 1 MiB boşluk + 48 MiB + 96 MiB
truncate -s 146M "$H/disk.img"
printf 'label: dos\nstart=2048, size=98304, type=83, bootable\nstart=100352, size=196608, type=83\n' \
	| sfdisk -q "$H/disk.img"
dd if="$H/boot.img" of="$H/disk.img" bs=1M seek=1  conv=notrunc status=none
dd if="$H/kok.img"  of="$H/disk.img" bs=1M seek=49 conv=notrunc status=none
sfdisk -l "$H/disk.img"
