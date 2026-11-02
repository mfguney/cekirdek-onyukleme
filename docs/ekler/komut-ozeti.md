# Komut özeti

Kitapta kullanılan komutların konuya göre hızlı başvuru listesi. Ayrıntılı açıklamalar ilgili
bölümlerdedir.

## U-Boot konsolu ([Bölüm 2](../bolumler/02-u-boot.md))

| Komut | İşlev |
|---|---|
| `printenv [ad]` / `setenv ad 'değer'` / `saveenv` | Ortamı göster / değiştir / kaydet |
| `env default -a` | Varsayılan ortama dön |
| `run ad` | Değişkendeki komutları çalıştır |
| `bdinfo`, `version`, `dm tree` | Kart bilgisi, sürüm, aygıt ağacı |
| `bootflow scan -l` / `bootflow scan -lb` | Önyükleme girdilerini listele / ilkiyle önyükle |
| `bootmeth list` / `bootmeth order "extlinux script"` | Önyükleme yöntemleri ve sırası |
| `virtio scan`, `part list virtio 0`, `ls virtio 0:1 /` | Disk ve bölüm inceleme |
| `load virtio 0:1 ${kernel_addr_r} Image` | Dosyayı belleğe yükle; boyut `${filesize}` değişkenine yazılır |
| `setenv autoload no; dhcp; tftpboot ${kernel_addr_r} Image` | Ağdan yükleme |
| `booti ${kernel_addr_r} ${ramdisk_addr_r}:${filesize} ${fdt_addr}` | ARM64 `Image` başlat (initramfs yoksa `-`) |
| `bootz`, `bootm <adres>#conf-1` | ARM `zImage` / uImage ve FIT başlat |
| `source ${scriptaddr}` | Yüklenmiş `boot.scr` betiğini çalıştır |
| `fdt addr ${fdt_addr}; fdt print /chosen` | Aygıt ağacını incele |
| `md.b <adres> 40`, `mw.b <adres> <değer>` | Belleği göster / yaz |

## Derleme makinesi: U-Boot araçları

| Komut | İşlev |
|---|---|
| `mkimage -A arm64 -O linux -T script -C none -d boot.cmd boot.scr` | Önyükleme betiği üret |
| `mkimage -f ornek.its ornek.itb` / `mkimage -l ornek.itb` | FIT üret / incele |
| `dumpimage -l ornek.itb` | FIT içeriğini listele |
| `mkenvimage -s 0x40000 -o env.bin env.txt` | Metinden ortam bloğu üret |
| `fw_printenv -c fw_env.config [ad]`, `fw_setenv ad değer` | Ortamı Linux'tan oku/yaz |

## Çekirdek derleme ([Bölüm 3](../bolumler/03-cekirdek-derleme.md))

| Komut | İşlev |
|---|---|
| `export ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-` | Hedef mimari ve araç zinciri |
| `make O=<dizin> defconfig` / `<ad>_defconfig` / `allnoconfig` | Temel yapılandırma |
| `scripts/kconfig/merge_config.sh -n -O <dizin> parca.config` | Parçayı allnoconfig üzerine birleştir |
| `make O=<dizin> olddefconfig` / `menuconfig` / `savedefconfig` | Güncelle / arayüz / farkları kaydet |
| `scripts/config --file .config --enable X --module Y --disable Z` | `.config` satırlarını değiştir |
| `scripts/diffconfig eski.config yeni.config` | İki yapılandırmayı karşılaştır |
| `make O=<dizin> -j$(nproc) Image modules dtbs` | Derle |
| `make O=<dizin> INSTALL_MOD_PATH=<kök> modules_install` | Modülleri kur |
| `make -C <çekirdek> M=$PWD modules` | Ağaç dışı modül derle |
| `make O=<dizin> kernelrelease` | Sürüm dizesi |

## Aygıt ağacı ([Bölüm 4](../bolumler/04-aygit-agaci.md))

| Komut | İşlev |
|---|---|
| `cpp -nostdinc -undef -D__DTS__ -x assembler-with-cpp -I <inc> -o x.tmp x.dts` | Ön işleme |
| `dtc -@ -I dts -O dtb -o x.dtb x.tmp` | Derle (simge tablosuyla) |
| `dtc -I dtb -O dts x.dtb` | Çöz |
| `fdtget -t x x.dtb /yol özellik`, `fdtget -l x.dtb /yol`, `fdtput` | Özellik oku / alt düğümleri listele / yaz |
| `fdtoverlay -i temel.dtb -o sonuc.dtb ek.dtbo` | Bindirmeyi uygula |
| `dt-mk-schema -j <bindings> > s.json; dt-validate -m -s s.json x.dtb` | Bağlamalara göre doğrula |
| `make dt_binding_check`, `make dtbs_check` | Çekirdek ağacında doğrulama |
| `qemu-system-aarch64 -machine virt,dumpdtb=virt.dtb` | QEMU'nun ağacını dosyaya yaz |

## Hedefte: /proc, /sys, aygıtlar, modüller ([Bölüm 5](../bolumler/05-kullanici-alani-arayuzleri.md))

| Komut | İşlev |
|---|---|
| `cat /proc/cmdline`, `/proc/version`, `/proc/interrupts`, `zcat /proc/config.gz` | Çekirdek bilgisi |
| `sysctl kernel.printk`, `sysctl -w ad=değer` | sysctl parametreleri |
| `readlink -f /sys/class/tty/ttyAMA0`, `cat .../uevent` | sysfs'te aygıt |
| `echo <aygıt> > /sys/bus/<v>/drivers/<s>/unbind` (ve `bind`) | Sürücüyü ayır / bağla |
| `udevadm info -a -n /dev/ttyUSB0`, `udevadm monitor --property` | Öznitelikler / olaylar |
| `udevadm trigger`, `udevadm verify <dosya>` | Soğuk tarama / kural denetimi |
| `mdev -s`, `echo /sbin/mdev > /proc/sys/kernel/hotplug` | BusyBox mdev |
| `modprobe <ad> param=değer`, `modprobe -r <ad>`, `lsmod`, `modinfo` | Modül yönetimi |
| `depmod -b <kök> <sürüm>` | `modules.dep` ve diğer dizinleri üret |
| `strace -f <program>`, `strace -c <program>` | Sistem çağrılarını izle / say |

## init ve systemd ([Bölüm 6](../bolumler/06-init-systemd.md))

| Komut | İşlev |
|---|---|
| `systemctl status/start/stop/restart <birim>` | Birim yönetimi |
| `systemctl enable/disable <birim>`, `systemctl --root=<kök> enable <birim>` | Etkinleştir (çevrimdışı da) |
| `systemctl list-dependencies multi-user.target`, `systemctl list-timers` | Bağımlılıklar / zamanlayıcılar |
| `systemctl edit <birim>` | Ek dosya (drop-in) oluştur |
| `systemd-analyze time / blame / critical-chain / plot` | Açılış çözümlemesi |
| `systemd-analyze verify --root=<kök> <birim>` | Birim doğrulama |
| `systemd-analyze security --offline=yes --root=<kök> <birim>` | Güvenlik değerlendirmesi |
| `systemd-analyze calendar '<ifade>'`, `systemd-analyze timespan <süre>` | Zaman ifadeleri |
| `journalctl -b -u <birim> -p err -f -k` | Günlük süzme |

## Konsol ve ağ ([Bölüm 7](../bolumler/07-sistem-yonetimi.md))

| Komut | İşlev |
|---|---|
| `picocom -b 115200 /dev/ttyUSB0` | Seri konsol (çıkış: Ctrl+A, Ctrl+X) |
| `ip -br addr`, `ip link set eth0 up`, `ip addr add …/24 dev eth0`, `ip route` | iproute2 |
| `udhcpc -i eth0 -s <betik>` | BusyBox DHCP istemcisi |
| `networkctl status`, `resolvectl status` | systemd-networkd ve resolved |
| `hwclock -r`, `hwclock -w`, `date` | RTC ve sistem saati |
| `exportfs -ra` | NFS paylaşımlarını yeniden yükle (geliştirme makinesi) |

## Çekirdek hata ayıklama ([Bölüm 8](../bolumler/08-cekirdek-hata-ayiklama.md))

| Komut | İşlev |
|---|---|
| `dmesg -n 8`, `dmesg -l err,warn`, `dmesg -w` | Konsol düzeyi / düzeye göre süz / izle |
| `cat /proc/sys/kernel/printk` | Konsol günlük düzeyleri |
| `echo 'module ornek_bilgi +p' > /proc/dynamic_debug/control` | `pr_debug` iletilerini aç |
| `echo function_graph > /sys/kernel/tracing/current_tracer` | ftrace izleyicisini seç |
| `echo <işlev> > set_graph_function`, `cat trace`, `echo 0 > tracing_on` | ftrace filtre / sonuç / durdur |
| `trace-cmd record -p function_graph -g <işlev> <komut>`; `trace-cmd report` | trace-cmd ile kayıt |
| `echo h > /proc/sysrq-trigger` | Magic SysRq yardımı (`t`: görevler, `c`: kasıtlı çöküş) |
| `scripts/faddr2line vmlinux <işlev>+<ofset>` | Oops adresini kaynak satırına çevir |
| `qemu-system-aarch64 … -s -S` + `gdb-multiarch vmlinux -ex 'target remote :1234'` | QEMU ile çekirdek hata ayıklama |
| `kgdboc=ttyAMA0,115200 kgdbwait` | kgdb'yi seri konsolda etkinleştir (komut satırı) |
