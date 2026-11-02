#!/bin/sh
# SPDX-License-Identifier: MIT
# BusyBox tabanlı küçük bir ARM64 kök dosya sistemi dizini ve initramfs arşivi hazırlar. Bölüm 1, 5, 6.
# Kullanım: ./kok-olustur.sh <busybox-arm64> <çekirdek-çıktı-dizini> <modül-dizini> <hedef-dizin>
#   busybox-arm64      : statik ARM64 busybox ikilisi
#   çekirdek-çıktı-dizini: derle.sh ile üretilen O= dizini
#   modül-dizini       : examples/modul (derlenmiş ornek_bilgi.ko içerir)
set -eu
BB=${1:?busybox}; KO=${2:?çekirdek çıktı dizini}; MOD=${3:?modül dizini}; HEDEF=${4:?hedef}
mkdir -p "$HEDEF"
# Betik dizin değiştirdiği için tüm yollar mutlak yola çevrilir
BB=$(cd "$(dirname "$BB")" && pwd)/$(basename "$BB")
KO=$(cd "$KO" && pwd); MOD=$(cd "$MOD" && pwd); HEDEF=$(cd "$HEDEF" && pwd)
ORNEK=$(cd "$(dirname "$0")/.." && pwd)
KOK="$HEDEF/kok"
rm -rf "$KOK"; mkdir -p "$KOK"
cd "$KOK"
mkdir -p bin sbin usr/bin usr/sbin etc/init.d proc sys dev tmp run root lib/firmware/ornek yenikok

install -m 0755 "$BB" bin/busybox
# Uygulama (applet) bağlantıları: listeyi aynı sürümdeki yerel busybox'tan al
for a in $(busybox --list-full); do
	[ -e "$a" ] || ln -s /bin/busybox "$a"
done

install -m 0755 "$ORNEK/initramfs/init"           init
install -m 0644 "$ORNEK/initramfs/inittab"        etc/inittab
install -m 0755 "$ORNEK/initramfs/rcS"            etc/init.d/rcS
install -m 0755 "$ORNEK/initramfs/udhcpc.script"  etc/udhcpc.script
install -m 0644 "$ORNEK/initramfs/profile"        etc/profile
install -m 0644 "$ORNEK/udev/mdev.conf"           etc/mdev.conf
echo agecidi > etc/hostname
echo 'root::0:0:root:/root:/bin/sh' > etc/passwd
echo 'root:x:0:'                    > etc/group

# Örnek program (statik, ARM64)
aarch64-linux-gnu-gcc -static -O2 -o usr/bin/sensor-oku "$ORNEK/initramfs/sensor-oku.c"

# Çekirdek modülleri ve ürün yazılımı (Bölüm 5)
make -s -C "$KO" ARCH=arm64 INSTALL_MOD_PATH="$KOK" modules_install
make -s -C "$KO" ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- M="$MOD" INSTALL_MOD_PATH="$KOK" modules_install
rm -f lib/modules/*/build        # derleme makinesine işaret eden bağlantı hedefte gereksizdir
depmod -b "$KOK" "$(cat "$KO/include/config/kernel.release")"
printf 'ORNEK-KALIBRASYON v1\n' > lib/firmware/ornek/kalibrasyon.bin

# initramfs: newc biçiminde cpio arşivi, gzip ile sıkıştırılmış
find . -print0 | cpio --null -o -H newc --owner=0:0 2>/dev/null | gzip -9 > "$HEDEF/initramfs.cpio.gz"
ls -l "$HEDEF/initramfs.cpio.gz"
