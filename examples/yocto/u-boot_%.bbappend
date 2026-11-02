# SPDX-License-Identifier: MIT
# meta-ornek/recipes-bsp/u-boot/u-boot_%.bbappend: U-Boot'a ÖrnekOS ayarları (Bölüm 2)
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

# Kconfig parçası ve önyükleme betiği yalnızca ÖrnekOS dağıtımında uygulanır
SRC_URI:append:ornekos = " file://ornek-uboot.cfg file://boot.cmd"

# boot.cmd -> boot.scr (mkimage -T script); /boot ve DEPLOY_DIR_IMAGE altına kurulur
UBOOT_ENV:ornekos = "boot"
UBOOT_ENV_SUFFIX:ornekos = "scr"
