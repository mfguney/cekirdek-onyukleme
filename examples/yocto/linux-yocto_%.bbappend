# SPDX-License-Identifier: MIT
# meta-ornek/recipes-kernel/linux/linux-yocto_%.bbappend (Bölüm 8)
# Yocto kitabı Bölüm 12'deki tarif ekinin genişletilmiş hali: ürün parçasına ek olarak
# geliştirme sürecinde çekirdek hata ayıklama parçası uygulanır. Ürün imajına geçmeden
# önce ikinci satır kaldırılmalı ya da ayrı bir geliştirme dağıtımına taşınmalıdır.
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

SRC_URI:append:ornekos = " file://ornek-cekirdek.cfg"
SRC_URI:append:ornekos = " file://agecidi-hata-ayiklama.cfg"
