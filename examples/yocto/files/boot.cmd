# SPDX-License-Identifier: MIT
# boot.cmd: ÖrnekOS önyükleme betiği. Bölüm 2.
# Derleme: mkimage -A arm64 -O linux -T script -C none -n "ornekos boot" -d boot.cmd boot.scr
# devtype, devnum ve distro_bootpart değişkenlerini U-Boot'un script önyükleme yöntemi atar.

echo "boot.scr: ${devtype} ${devnum}:${distro_bootpart} bölümünden yükleniyor"

setenv bootargs "console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro"

load ${devtype} ${devnum}:${distro_bootpart} ${kernel_addr_r} Image
load ${devtype} ${devnum}:${distro_bootpart} ${ramdisk_addr_r} initramfs.cpio.gz
setenv rd_boyut ${filesize}

# fdt_addr: QEMU'nun ürettiği aygıt ağacı. Gerçek kartta .dtb de diskten yüklenir:
#   load ${devtype} ${devnum}:${distro_bootpart} ${fdt_addr_r} agecidi.dtb
booti ${kernel_addr_r} ${ramdisk_addr_r}:${rd_boyut} ${fdt_addr}
