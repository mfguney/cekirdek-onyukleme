# Animasyonlu şemalar ve terminal canlandırmaları

Bu sayfada kitaptaki tüm animasyonlu şemalar ve terminal canlandırmaları bölüm sırasıyla toplanmıştır.
Animasyonlarda ▶ Oynat ile otomatik ilerlenir, ▶| ile adım adım gezinilir; terminal canlandırmalarında
"Tümü" düğmesi oturumun tamamını gösterir. Terminal çıktıları kitabın `examples/` dosyalarıyla QEMU'da
ve derleme makinesinde gerçekten çalıştırılarak alınmıştır; temsilî olanlar açıklamalarında belirtilmiştir.

## Bölüm 1 · Önyükleme zinciri

### Önyükleme zinciri: depolama → SRAM → DRAM

[Bölüm 1.1](../bolumler/01-onyukleme-zinciri.md)

<div class="akis" data-senaryo="onyukleme-zinciri"></div>

### initramfs'ten kalıcı köke: switch_root

[Bölüm 1.7](../bolumler/01-onyukleme-zinciri.md)

<div class="akis" data-senaryo="initramfs-gecis"></div>

### initramfs arşivinin incelenmesi

<div class="terminal" data-oturum="initramfs-icerik"></div>

### U-Boot'tan oturum açma istemine

[Uygulama 1.1](../bolumler/01-onyukleme-zinciri.md)

<div class="terminal" data-oturum="qemu-acilis"></div>

## Bölüm 2 · U-Boot

### Ortamdan bootcmd'ye, extlinux.conf'tan çekirdeğe

[Bölüm 2.4](../bolumler/02-u-boot.md)

<div class="akis" data-senaryo="uboot-bootcmd"></div>

### Ortam değişkenleri ve genişletme zamanı

<div class="terminal" data-oturum="uboot-ortam"></div>

### Ortam bloğunun üretilmesi ve Linux'tan değiştirilmesi

<div class="terminal" data-oturum="fw-printenv"></div>

### Standart önyükleme ve elle önyükleme

<div class="terminal" data-oturum="uboot-bootflow"></div>

### FIT imajı: paketleme, doğrulama, yerleştirme

[Bölüm 2.7](../bolumler/02-u-boot.md)

<div class="akis" data-senaryo="fit-imaji"></div>

<div class="terminal" data-oturum="mkimage-fit"></div>

## Bölüm 3 · Çekirdek derleme

### Kconfig → .config → autoconf.h → obj-m → .ko

[Bölüm 3.4](../bolumler/03-cekirdek-derleme.md)

<div class="akis" data-senaryo="kconfig-kbuild"></div>

### Yapılandırma parçası ve bağımlılık denetimi

<div class="terminal" data-oturum="kconfig-derleme"></div>

### Derleme çıktıları ve modül kurulumu

<div class="terminal" data-oturum="cekirdek-ciktilari"></div>

## Bölüm 4 · Aygıt ağacı

### Kaynaklardan çekirdekteki aygıtlara

[Bölüm 4.6](../bolumler/04-aygit-agaci.md)

<div class="akis" data-senaryo="dtc-akisi"></div>

### Bindirmenin uygulanması

[Bölüm 4.8](../bolumler/04-aygit-agaci.md)

<div class="akis" data-senaryo="overlay-uygulama"></div>

### Derleme, inceleme ve doğrulama

<div class="terminal" data-oturum="dtc-derleme"></div>

### Çalışan sistemde /proc/device-tree

<div class="terminal" data-oturum="proc-devicetree"></div>

## Bölüm 5 · Çekirdek ile kullanıcı alanı arayüzleri

### Sistem çağrıları (strace)

<div class="terminal" data-oturum="strace-sistem-cagrisi"></div>

### sysfs'te bir aygıt

<div class="terminal" data-oturum="sysfs-gezinti"></div>

### uevent → udev kuralı → /dev düğümü, bağlantı ve servis

[Bölüm 5.6](../bolumler/05-kullanici-alani-arayuzleri.md)

<div class="akis" data-senaryo="uevent-udev"></div>

### MODALIAS ile otomatik modül yükleme

[Bölüm 5.8](../bolumler/05-kullanici-alani-arayuzleri.md)

<div class="akis" data-senaryo="modprobe-zinciri"></div>

<div class="terminal" data-oturum="modprobe-uevent"></div>

## Bölüm 6 · init sistemleri ve systemd

### BusyBox init: PID 1, inittab ve respawn

<div class="terminal" data-oturum="busybox-init"></div>

### systemd: etkinleştirmeden multi-user.target'a

[Bölüm 6.5](../bolumler/06-init-systemd.md)

<div class="akis" data-senaryo="systemd-hedef"></div>

### Birimlerin doğrulanması ve etkinleştirilmesi

<div class="terminal" data-oturum="systemd-analyze"></div>

## Bölüm 7 · Seri konsol, ağ ve uzaktan erişim

### Hedefte ağ ve saat

<div class="terminal" data-oturum="ag-yapilandirma"></div>

### Ağdan önyükleme: DHCP, TFTP, NFS

[Bölüm 7.4](../bolumler/07-sistem-yonetimi.md)

<div class="akis" data-senaryo="ag-onyukleme"></div>

### U-Boot ile TFTP ve çekirdeğin DHCP istemcisi

<div class="terminal" data-oturum="tftp-onyukleme"></div>

## Bölüm 8 · Çekirdek hata ayıklama

### printk düzeyleri ve dynamic debug

<div class="terminal" data-oturum="dmesg-printk"></div>

### ftrace: işlev izinin yakalanması

[Bölüm 8.4](../bolumler/08-cekirdek-hata-ayiklama.md)

<div class="akis" data-senaryo="ftrace-yakalama"></div>

<div class="terminal" data-oturum="ftrace-oturumu"></div>

### Oops ve panik

<div class="terminal" data-oturum="oops-okuma"></div>

### QEMU gdbstub ile çekirdek hata ayıklama

<div class="terminal" data-oturum="gdb-qemu"></div>
