#!/bin/sh
# SPDX-License-Identifier: MIT
# ornek_bilgi sürücüsünü bir çekirdek kaynak ağacına drivers/misc/ornek/ olarak ekler (Bölüm 3).
# Kullanım: ./ekle.sh <çekirdek-kaynağı>
set -eu
K=${1:?çekirdek kaynak dizini}
BURASI=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$K/drivers/misc/ornek"
cp "$BURASI/Kconfig" "$BURASI/Makefile" "$K/drivers/misc/ornek/"
cp "$BURASI/../../modul/ornek_bilgi.c" "$K/drivers/misc/ornek/"
# Üst dizinin Kconfig ve Makefile dosyalarına bir kez ekle
grep -q 'drivers/misc/ornek/Kconfig' "$K/drivers/misc/Kconfig" ||
	sed -i '/^endmenu/i source "drivers/misc/ornek/Kconfig"' "$K/drivers/misc/Kconfig"
grep -q 'ornek/' "$K/drivers/misc/Makefile" ||
	echo 'obj-y				+= ornek/' >> "$K/drivers/misc/Makefile"
echo "drivers/misc/ornek eklendi"
