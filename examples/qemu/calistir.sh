#!/bin/sh
# SPDX-License-Identifier: MIT
# QEMU "virt" makinesinde örnek sistemi açar. Bölüm 1, 2, 7, 8.
# Kullanım: ./calistir.sh <kip> <hedef-dizin>
#   uboot    : U-Boot -> disk (extlinux.conf) -> çekirdek. Ortam flash1.img içinde saklanır.
#   dogrudan : QEMU çekirdeği doğrudan yükler (-kernel/-initrd/-append), U-Boot yok.
#   gdb      : dogrudan kipine ek olarak -s -S: işlemci durur, gdb :1234 portundan bağlanır.
#   dtb      : uboot kipindeki makinenin aygıt ağacını <hedef-dizin>/virt.dtb dosyasına yazar (FIT için).
# Ağ: QEMU kullanıcı kipi (10.0.2.0/24), TFTP sunucusu <hedef-dizin>/tftp dizinini sunar.
set -eu
KIP=${1:?kip}; H=${2:?hedef dizin}
ORTAK="-machine virt -cpu cortex-a53 -smp 2 -m 512M -nographic \
 -netdev user,id=ag0,tftp=$H/tftp,hostfwd=tcp::2222-:22 -device virtio-net-device,netdev=ag0 \
 -device virtio-rng-device"
mkdir -p "$H/tftp"
case "$KIP" in
uboot|dtb)
	[ -f "$H/flash1.img" ] || truncate -s 64M "$H/flash1.img"
	MAKINE=""; [ "$KIP" = dtb ] && MAKINE="-machine virt,dumpdtb=$H/virt.dtb"
	exec qemu-system-aarch64 $ORTAK $MAKINE -bios /usr/lib/u-boot/qemu_arm64/u-boot.bin \
		-drive if=pflash,format=raw,index=1,file="$H/flash1.img" \
		-drive if=none,id=disk0,format=raw,file="$H/disk.img" -device virtio-blk-device,drive=disk0 ;;
dogrudan|gdb)
	EK=""; [ "$KIP" = gdb ] && EK="-s -S"
	exec qemu-system-aarch64 $ORTAK $EK -kernel "$H/Image" -initrd "$H/initramfs.cpio.gz" \
		-drive if=none,id=disk0,format=raw,file="$H/disk.img" -device virtio-blk-device,drive=disk0 \
		-append "console=ttyAMA0,115200 root=/dev/vda2 ${EKARGS:-}" ;;
*)	echo "bilinmeyen kip: $KIP" >&2; exit 1 ;;
esac
