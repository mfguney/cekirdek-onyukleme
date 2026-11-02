# Örnek dosyalar

Bu dizindeki dosyalar *Linux Çekirdeği ve Önyükleme* kitabının uygulamalarında kullanılır. Metin
dosyaları ve betikler MIT (`COPYING.MIT`), çekirdek modülü ile çekirdek ağacına eklenen Kconfig/Makefile
örnekleri GPL-2.0-only lisanslıdır.

Tüm dosyalar Ubuntu 24.04 üzerinde; Linux 6.18 kaynağı, `gcc-aarch64-linux-gnu` 13.3, QEMU 8.2,
`u-boot-qemu` 2025.10, `u-boot-tools` 2025.10, dtc 1.7.0, dtschema 2026.9, BusyBox 1.36.1 (ARM64 statik)
ve systemd 255 ile denenmiştir. "Denendiği biçim" sütunu her dosyanın nasıl doğrulandığını gösterir.

## Dosyalar ve bölümler

| Dosya | Bölüm | İçerik | Denendiği biçim |
|---|---|---|---|
| `cekirdek/agecidi.config` | 3, 8 | `allnoconfig` üzerine uygulanan Kconfig parçası (QEMU `virt` için en küçük çekirdek + hata ayıklama) | `merge_config.sh -n` ile birleştirildi, eksik değer uyarısı yok; çekirdek derlendi ve QEMU'da açıldı |
| `cekirdek/derle.sh` | 1, 3 | Çekirdeği `O=` ile ağaç dışında derleyen betik | Çalıştırıldı (Image + modüller) |
| `cekirdek/agac-ici/Kconfig`, `Makefile`, `ekle.sh` | 3 | `ornek_bilgi` sürücüsünün `drivers/misc/ornek/` olarak çekirdek ağacına eklenmesi | Çekirdek kopyasına eklendi; `CONFIG_ORNEK_BILGI=m` ile `ornek_bilgi.ko` derlendi |
| `modul/ornek_bilgi.c`, `modul/Makefile` | 3, 5, 8 | Ağaç dışı örnek modül: sysfs parametreleri, platform aygıtı, ürün yazılımı isteği, `pr_debug`, ftrace ile izlenen işlev, bilerek oops | Derlendi (uyarısız); QEMU'da yüklendi, dynamic debug, ftrace ve oops çıktıları alındı |
| `initramfs/init` | 1 | initramfs'in `/init` betiği: sanal dosya sistemleri, `root=` bekleme, `switch_root`, `kurtarma` parametresi | QEMU'da `dogrudan` kipte ve FIT ile açılışta çalıştı |
| `initramfs/inittab`, `initramfs/rcS` | 6 | BusyBox init yapılandırması ve açılış betiği | QEMU'da çalıştı (getty, `respawn`, mdev, DHCP) |
| `initramfs/udhcpc.script` | 7 | `udhcpc` olay betiği | QEMU'da adres, yol ve DNS uyguladı |
| `initramfs/profile` | 1 | Kabuk istemi | QEMU'da |
| `initramfs/sensor-oku.c` | 5, 6 | Kitaplığın örnek programı (Yocto kitabındaki ile aynı) | ARM64 için statik, x86-64 için dinamik/statik derlendi |
| `qemu/kok-olustur.sh` | 1 | BusyBox kök dizini, modül kurulumu, `depmod` ve initramfs arşivi | Çalıştırıldı |
| `qemu/disk-olustur.sh` | 1, 2 | Yönetici yetkisi gerektirmeden iki bölümlü disk imajı (`mke2fs -d`, `sfdisk`) | Çalıştırıldı; U-Boot ve çekirdek bölümleri okudu |
| `qemu/calistir.sh` | 1, 2, 7, 8 | QEMU başlatma: `uboot`, `dogrudan`, `gdb`, `dtb` kipleri; TFTP dizini | Tüm kipler çalıştırıldı |
| `u-boot/extlinux.conf` | 2 | Standart önyükleme menüsü (normal ve kurtarma girdileri) | U-Boot menüyü gösterdi ve çekirdeği açtı |
| `u-boot/boot.cmd` | 2 | Önyükleme betiği kaynağı (`mkimage -T script` → `boot.scr`) | `bootmeth order script` ile çalıştırıldı |
| `u-boot/uboot-env.txt` | 2, 7 | Ön tanımlı ortam (`mkenvimage` girdisi) | Flaş imajına yazıldı; U-Boot `OK` ile yükledi |
| `u-boot/fw_env.config` | 2 | `fw_printenv`/`fw_setenv` yapılandırması | `fw_printenv`/`fw_setenv` ile okundu ve yazıldı |
| `u-boot/ornek.its` | 2 | Çekirdek + initramfs + aygıt ağacı FIT tanımı | `mkimage -f` ile üretildi; `bootm` ile açıldı; bozulma `Bad Data Hash` ile yakalandı |
| `dts/ornek-soc.dtsi`, `dts/agecidi.dts` | 4 | Hayalî SoC ve ağ geçidi kartı aygıt ağacı | cpp + dtc ile uyarısız derlendi; `dt-validate` ile çekirdeğin bağlamalarına göre doğrulandı |
| `dts/sensor-ek.dtso` | 4 | İkinci sıcaklık sensörü bindirmesi | `-@` ile derlendi, `fdtoverlay` ile uygulandı |
| `dts/derle-dtb.sh` | 4 | Ağaçları Kbuild yöntemiyle derleyen betik | Çalıştırıldı |
| `udev/99-ornek-sensor.rules` | 5 | Kalıcı ad, izin ve systemd servisi başlatan udev kuralı | `udevadm verify` ile denetlendi (gerçek FTDI donanımı olmadan) |
| `udev/mdev.conf` | 5 | BusyBox mdev kuralları, `$MODALIAS` ile modül yükleme | QEMU'da `virtio-rng` modülünü otomatik yükledi |
| `systemd/sensor-toplayici.service` | 6 | Sertleştirilmiş servis birimi | `systemd-analyze verify` ve `security --offline` ile denetlendi |
| `systemd/sensor-oku.service`, `systemd/sensor-oku.timer` | 6 | Zamanlayıcıyla çalışan tek seferlik servis | `systemd-analyze verify`, `systemctl --root enable` |
| `systemd/10-eth0.network` | 7 | systemd-networkd yapılandırması | Yalnızca `systemd.network(5)` belgesine göre denetlendi; çalışan bir systemd-networkd ile denenmedi |
| `yocto/u-boot_%.bbappend`, `yocto/files/ornek-uboot.cfg`, `yocto/files/boot.cmd` | 2 | ÖrnekOS için U-Boot tarif eki | OE-Core 6.0 sınıflarına (`uboot-config`, `u-boot.inc`) göre yazıldı; BitBake ile derlenmedi |
| `yocto/linux-yocto_%.bbappend`, `yocto/files/agecidi-hata-ayiklama.cfg` | 8 | Hata ayıklama yapılandırma parçası ve tarif eki | Parçadaki seçenekler kitabın çekirdeğinde etkin ve çalışır durumdadır; BitBake ile derlenmedi |

## Hızlı başlangıç

```bash
cd examples
sh cekirdek/derle.sh ~/linux ~/agecidi/cekirdek
make -C modul KDIR=~/agecidi/cekirdek ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-
sh qemu/kok-olustur.sh ~/agecidi/bb/usr/bin/busybox ~/agecidi/cekirdek modul ~/agecidi
cp ~/agecidi/cekirdek/arch/arm64/boot/Image ~/agecidi/
sh qemu/disk-olustur.sh ~/agecidi
sh qemu/calistir.sh uboot ~/agecidi          # çıkış: Ctrl+A, X
```

Ayrıntılar kitabın 1. bölümündeki Uygulama 1.1'dedir. Betikler çalıştırma izni olmadan da `sh <betik>`
biçiminde kullanılabilir. Modül derlemesi `modul/` dizinine ara dosyalar yazar; temizlemek için
`make -C modul KDIR=... clean`.
