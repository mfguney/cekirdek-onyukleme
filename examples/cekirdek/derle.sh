#!/bin/sh
# SPDX-License-Identifier: MIT
# Linux 6.18 çekirdeğini agecidi.config parçasıyla ARM64 için ağaç dışında (O=) derler. Bölüm 3.
# Kullanım: ./derle.sh <çekirdek-kaynağı> <çıktı-dizini>
set -eu
KAYNAK=$(cd "${1:?çekirdek kaynak dizini}" && pwd)
mkdir -p "${2:?çıktı dizini}"
CIKTI=$(cd "$2" && pwd)
PARCA=$(cd "$(dirname "$0")" && pwd)/agecidi.config
export ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-
# Sürüm dizesine (uname -v, /proc/version) derleme makinesinin kullanıcı ve ana bilgisayar
# adı yerine sabit değerler yazılır; Yocto da aynı amaçla oe-user/oe-host kullanır.
export KBUILD_BUILD_USER=gelistirici KBUILD_BUILD_HOST=derleme

# -n: eksik seçenekler allnoconfig ile kapatılır (Yocto'daki KCONFIG_MODE="allnoconfig" ile aynı).
# Betik sonunda parçadaki her değerin .config dosyasına girip girmediğini denetler.
cd "$KAYNAK"
scripts/kconfig/merge_config.sh -n -O "$CIKTI" "$PARCA"
make O="$CIKTI" -j"$(nproc)" Image modules
echo "Çekirdek: $CIKTI/arch/arm64/boot/Image"
