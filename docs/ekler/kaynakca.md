# Kaynakça ve ileri okuma

Bu sayfadaki kaynaklar kitabın yazımında başvurulan birincil belgeler ve konuyu derinleştirmek için
önerilen yayınlardır. Çevrimiçi belgeler sürekli güncellenir; sürüme bağlı ayrıntılarda ilgili sürümün
belgesine bakılmalıdır.

## Resmî belgeler

### Linux çekirdeği

Çekirdek belgelerinin güncel sürümü <https://docs.kernel.org/> adresindedir; aynı belgeler çekirdek
kaynağının `Documentation/` dizininde de bulunur. Kitapta en çok başvurulanlar:

| Konu | Kaynaktaki yol |
|---|---|
| ARM64 önyükleme protokolü | `Documentation/arch/arm64/booting.rst` |
| Çekirdek komut satırı parametreleri | `Documentation/admin-guide/kernel-parameters.txt` |
| initramfs | `Documentation/filesystems/ramfs-rootfs-initramfs.rst` |
| init seçimi ve sorun giderme | `Documentation/admin-guide/init.rst` |
| Kconfig dili | `Documentation/kbuild/kconfig-language.rst` |
| Kbuild Makefile'ları | `Documentation/kbuild/makefiles.rst` |
| Ağaç dışı modüller | `Documentation/kbuild/modules.rst` |
| Aygıt ağacı kullanım modeli | `Documentation/devicetree/usage-model.rst` |
| Aygıt ağacı bağlamaları | `Documentation/devicetree/bindings/` |
| sysfs | `Documentation/filesystems/sysfs.rst` |
| Ürün yazılımı yükleme | `Documentation/driver-api/firmware/` |
| Seri konsol | `Documentation/admin-guide/serial-console.rst` |
| NFS kök dosya sistemi | `Documentation/admin-guide/nfs/nfsroot.rst` |
| Dynamic debug | `Documentation/admin-guide/dynamic-debug-howto.rst` |
| ftrace | `Documentation/trace/ftrace.rst` |
| Oops ve hata raporları | `Documentation/admin-guide/bug-hunting.rst` |
| Magic SysRq | `Documentation/admin-guide/sysrq.rst` |
| kdump | `Documentation/admin-guide/kdump/kdump.rst` |
| kgdb ve gdb betikleri | `Documentation/process/debugging/kgdb.rst`, `Documentation/process/debugging/gdb-kernel-debugging.rst` |

### Önyükleyici ve ürün yazılımı

- U-Boot belgeleri: <https://docs.u-boot.org/>; özellikle *Environment Variables*, *Standard Boot*,
  *Flattened Image Tree (FIT)* ve komut başvuruları (`doc/usage/` ve `doc/develop/bootstd/` dizinleri).
- Trusted Firmware-A belgeleri: <https://trustedfirmware-a.readthedocs.io/>
- OP-TEE belgeleri: <https://optee.readthedocs.io/>
- Devicetree Specification: <https://www.devicetree.org/specifications/>
- dt-schema (bağlama doğrulama araçları): <https://github.com/devicetree-org/dt-schema>
- Device Tree Compiler (dtc): <https://git.kernel.org/pub/scm/utils/dtc/dtc.git>

### Kullanıcı alanı

- systemd kılavuz sayfaları: <https://www.freedesktop.org/software/systemd/man/>; özellikle
  `systemd.unit(5)`, `systemd.service(5)`, `systemd.special(7)`, `systemd.exec(5)`, `systemd-analyze(1)`,
  `journald.conf(5)`, `systemd.network(5)`, `udev(7)`.
- BusyBox: <https://busybox.net/> (`docs/mdev.txt` ve `examples/inittab` kaynak dağıtımında bulunur).
- libubootenv (`fw_printenv`, `fw_setenv`): <https://github.com/sbabic/libubootenv>
- QEMU belgeleri: <https://www.qemu.org/docs/master/>; ARM `virt` makinesi ve gdbstub bölümleri.

### Yocto Project

- Yocto Project belgeleri: <https://docs.yoctoproject.org/>; özellikle *Linux Kernel Development Manual*,
  *BSP Developer's Guide* ve *Reference Manual*'daki değişken açıklamaları (`UBOOT_MACHINE`,
  `UBOOT_CONFIG`, `KERNEL_DEVICETREE`, `KCONFIG_MODE`, `INIT_MANAGER`, `SERIAL_CONSOLES`).

## Kitaplar

- Chris Simmonds, Frank Vasquez. *Mastering Embedded Linux Programming*, 3. baskı. Packt, 2021.
  Önyükleyici, çekirdek, init sistemleri ve aygıt yönetimini gömülü bakış açısıyla ele alır.
- Christopher Hallinan. *Embedded Linux Primer*, 2. baskı. Prentice Hall, 2010. Önyükleme ve çekirdek
  açılışı üzerine ayrıntılı, ancak bazı bölümleri güncel sürümlerin gerisinde kalmıştır.
- Brian Ward. *How Linux Works*, 3. baskı. No Starch Press, 2021. Açılış, init, udev ve ağ yapılandırmasına
  genel bir giriş.
- Robert Love. *Linux Kernel Development*, 3. baskı. Addison-Wesley, 2010. Çekirdek iç yapısına giriş.
- Jonathan Corbet, Alessandro Rubini, Greg Kroah-Hartman. *Linux Device Drivers*, 3. baskı. O'Reilly, 2005.
  Çevrimiçi ücretsiz sürümü: <https://lwn.net/Kernel/LDD3/>. Çekirdek arayüzleri eskimiş olsa da aygıt
  modeli ve sysfs bölümleri kavramsal olarak değerlidir.

## Eğitim malzemeleri ve makaleler

- Bootlin eğitim belgeleri: <https://bootlin.com/docs/>. Gömülü Linux, çekirdek ve sürücü geliştirme
  eğitimlerinin slaytları ve uygulama kılavuzları CC BY-SA lisansıyla yayımlanır.
- LWN.net çekirdek dizini: <https://lwn.net/Kernel/Index/>. Aygıt ağacı, ftrace, dynamic debug ve
  initramfs gibi konularda çekirdek geliştiricilerinin yazdığı makaleler.

## Kitaplıktaki ilgili kitaplar

- <a href="../../yocto-gomulu-linux/index.html">Yocto Project ile Gömülü Linux</a>: Bölüm 9 (imajlar),
  10 (makine ve BSP), 11 (dağıtım ve `INIT_MANAGER`), 12 (çekirdek), 14 (hata ayıklama), 17 (güvenlik ve güncelleme)
- <a href="../../aygit-surucusu/index.html">Linux Aygıt Sürücüsü Geliştirme</a>
- <a href="../../c-derleme/index.html">C, Make ve CMake ile Derleme</a>
