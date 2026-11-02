#!/bin/sh
# SPDX-License-Identifier: MIT
# agecidi.dts ve sensor-ek.dtso dosyalarını çekirdeğin Kbuild'i ile aynı yöntemle derler:
# önce C ön işlemcisi (#include, makrolar), sonra dtc. Bölüm 4.
# Kullanım: ./derle-dtb.sh <çekirdek-kaynağı> <çıktı-dizini>
set -eu
KAYNAK=${1:?çekirdek kaynak dizini}
CIKTI=${2:?çıktı dizini}
BURASI=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$CIKTI"

onisle() {   # $1: girdi, $2: çıktı
	cpp -nostdinc -undef -D__DTS__ -x assembler-with-cpp \
	    -I "$BURASI" -I "$KAYNAK/include" -I "$KAYNAK/scripts/dtc/include-prefixes" \
	    -o "$2" "$1"
}

onisle "$BURASI/agecidi.dts" "$CIKTI/agecidi.dts.tmp"
dtc -@ -I dts -O dtb -o "$CIKTI/agecidi.dtb" "$CIKTI/agecidi.dts.tmp"

onisle "$BURASI/sensor-ek.dtso" "$CIKTI/sensor-ek.dtso.tmp"
dtc -@ -I dts -O dtb -o "$CIKTI/sensor-ek.dtbo" "$CIKTI/sensor-ek.dtso.tmp"

# Bindirmeyi derleme makinesinde uygulayıp sonucu doğrulama
fdtoverlay -i "$CIKTI/agecidi.dtb" -o "$CIKTI/agecidi-ek.dtb" "$CIKTI/sensor-ek.dtbo"
ls -l "$CIKTI"/*.dtb "$CIKTI"/*.dtbo
