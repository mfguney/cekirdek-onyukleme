# 3 · Çekirdek kaynak ağacı, Kconfig ve Kbuild

<div class="kunye" markdown>
<span>Süre: ~55 dk + derleme süresi</span><span>Düzey: Orta</span><span>Ön koşul: Bölüm 1; Make bilgisi</span>
</div>

!!! hedef "Öğrenme hedefleri"
    Bu bölümün sonunda:

    - Çekirdek kaynak ağacının ana dizinlerini ve görevlerini açıklayabilirsiniz.
    - `defconfig`, `olddefconfig`, `menuconfig` ve `savedefconfig` hedeflerini doğru amaçla kullanabilirsiniz.
    - Kconfig dilinde `depends on`, `select`, `imply` ve `default` arasındaki farkı açıklayabilirsiniz.
    - `.config` dosyasının `autoconf.h` ve `auto.conf` dosyalarına, oradan derlenen nesnelere nasıl yansıdığını izleyebilirsiniz.
    - Kbuild Makefile'larında `obj-y` ve `obj-m` kullanarak ağaca bir sürücü ekleyebilirsiniz.
    - `vmlinux`, `Image`, `zImage`, `bzImage` ve `System.map` dosyalarını ayırt edebilirsiniz.
    - Yocto'daki `linux-yocto` yapılandırma mekanizmasını Kbuild kavramlarıyla ilişkilendirebilirsiniz.

## 3.1 Kaynak ağacının yapısı

Linux çekirdeği, tek bir depoda tutulan ve tek bir derleme sistemiyle derlenen büyük bir C projesidir.
Linux 6.18 kaynak ağacının üst düzey dizinleri şunlardır:

| Dizin | İçerik |
|---|---|
| `arch/` | Mimariye özgü kod: `arch/arm64/`, `arch/arm/`, `arch/x86/`, `arch/riscv/`. Açılış kodu, bellek yönetiminin donanım tarafı, `configs/` altındaki varsayılan yapılandırmalar ve `boot/dts/` altındaki aygıt ağaçları |
| `drivers/` | Aygıt sürücüleri; kaynağın en büyük bölümü |
| `fs/` | Dosya sistemleri (`ext4`, `vfat`, `nfs`, `proc`, `sysfs` vb.) |
| `kernel/` | Zamanlayıcı, süreç yönetimi, sinyaller, zamanlayıcılar, `printk`, `trace/` (ftrace) |
| `mm/` | Bellek yönetimi |
| `net/` | Ağ yığını |
| `init/` | Açılış: `main.c` (`start_kernel`, `kernel_init`), initramfs açma kodu |
| `include/` | Ortak başlık dosyaları; `include/uapi/` kullanıcı alanına açık arayüzler, `include/dt-bindings/` aygıt ağacı sabitleri |
| `block/`, `crypto/`, `security/`, `sound/`, `ipc/`, `lib/` | Blok katmanı, kriptografi, güvenlik modülleri, ses, süreçler arası iletişim, yardımcı kütüphaneler |
| `scripts/` | Derleme araçları: Kconfig arayüzleri, `dtc`, `merge_config.sh`, `checkpatch.pl`, `faddr2line` |
| `Documentation/` | Belgeler; aygıt ağacı bağlamaları da buradadır |
| `tools/` | Kullanıcı alanı araçları (`perf`, `bpf`, testler) |

Kök dizindeki `Makefile` sürüm bilgisini taşır (`VERSION = 6`, `PATCHLEVEL = 18`) ve tüm derlemenin
giriş noktasıdır. `MAINTAINERS` dosyası her alt sistemin sorumlularını ve e-posta listelerini listeler;
`scripts/get_maintainer.pl` bir yama için kime yazılacağını bu dosyadan bulur.

!!! iyi "Çıktıları kaynak ağacından ayırmak: `O=`"
    `make O=<dizin>` ile derleme çıktıları ayrı bir dizine yazılır; kaynak ağacı temiz kalır. Aynı kaynaktan
    farklı mimariler veya yapılandırmalar için birden fazla çıktı dizini kullanılabilir. Kaynak ağacında
    daha önce `O=` olmadan derleme yapılmışsa Kbuild bunu algılar ve `make mrproper` istenir. Kitaptaki
    `examples/cekirdek/derle.sh` betiği bu yöntemi kullanır; Yocto da çekirdek kaynağını
    `work-shared/<makine>/kernel-source` altında tutup çıktıları ayrı bir dizine (`B`) yazar.

## 3.2 Kconfig: yapılandırma dili

Çekirdekte on binlerce yapılandırma seçeneği bulunur. Bu seçenekler, ağaç boyunca dağılmış `Kconfig`
dosyalarında **Kconfig** diliyle tanımlanır. Kök `Kconfig` dosyası `source` satırlarıyla diğerlerini
içerir. `examples/cekirdek/agac-ici/Kconfig` dosyası dilin temel öğelerini gösterir:

```kconfig title="examples/cekirdek/agac-ici/Kconfig"
config ORNEK_BILGI
	tristate "Örnek ağ geçidi bilgi sürücüsü"     # (1)!
	depends on SYSFS                               # (2)!
	select FW_LOADER                               # (3)!
	help
	  Kitabın örnek sürücüsü. Bir platform aygıtı oluşturur, ürün
	  yazılımı ister ve /sys/module/ornek_bilgi/parameters/ altında
	  parametreler sunar.

config ORNEK_BILGI_AYRINTI
	bool "Ayrıntılı hata ayıklama iletileri (DEBUG)"
	depends on ORNEK_BILGI                         # (4)!
```

1.  **Tür ve istem.** `bool` (`y`/`n`), `tristate` (`y`/`m`/`n`), `string`, `int`, `hex`. Tırnak içindeki
    istem metni, seçeneğin arayüzlerde görünen adıdır; istemi olmayan seçenekler kullanıcıya gösterilmez
    ve yalnızca `default` veya `select` ile değer alır.
2.  **Bağımlılık.** Koşul sağlanmadıkça seçenek görünmez ve `n` olur. `tristate` bir seçenek, `m`
    değerli bir bağımlılığa sahipse en fazla `m` olabilir.
3.  **Ters bağımlılık.** `ORNEK_BILGI` seçildiğinde `FW_LOADER` da en az aynı değeri alır; kullanıcı
    onu kapatamaz.
4.  **Alt seçenek.** Üst seçenek kapalıyken görünmez.

Dilin diğer önemli öğeleri: `default` (varsayılan değer, koşullu olabilir), `imply` (zayıf ters bağımlılık:
hedefi açar ama kullanıcı kapatabilir), `range` (sayısal sınır), `menu`/`endmenu`, `choice`/`endchoice`
(seçeneklerden yalnızca biri), `if`/`endif` ve `menuconfig` (alt seçenekleri katlanan menü başlığı).
Dilin başvuru belgesi `Documentation/kbuild/kconfig-language.rst` dosyasıdır.

!!! dikkat "`select` bağımlılıkları denetlemez"
    `select`, hedef seçeneğin kendi `depends on` koşullarına bakmadan onu açar. Bağımlılıkları
    karşılanmayan bir seçeneğin `select` ile açılması bağlama (*link*) hatalarına yol açabilir; Kconfig bu
    durumda `WARNING: unmet direct dependencies detected for ...` uyarısını verir. Belgedeki öneri,
    `select` ifadesinin yalnızca görünmeyen (istemsiz) ve bağımlılığı olmayan seçenekler için
    kullanılması, kullanıcıya görünen seçeneklere ise `depends on` ile bağlanılmasıdır.

## 3.3 `.config` dosyası ve yapılandırma hedefleri

Kconfig'in çıktısı, derleme dizinindeki **`.config`** dosyasıdır. Her etkin seçenek `CONFIG_AD=değer`,
kapalı ve görünür seçenekler ise `# CONFIG_AD is not set` biçiminde yazılır. Bu dosya elle de
düzenlenebilir, ancak bağımlılıkların yeniden hesaplanması için ardından `make olddefconfig`
çalıştırılmalıdır. Yapılandırma hedefleri:

| Hedef | İşlev |
|---|---|
| `make defconfig` | Mimarinin varsayılan yapılandırması (`arch/arm64/configs/defconfig`) |
| `make <ad>_defconfig` | `arch/<mimari>/configs/` altındaki adlandırılmış yapılandırma |
| `make olddefconfig` | Var olan `.config` dosyasını güncelle; yeni seçeneklere varsayılan değeri ver |
| `make oldconfig` | Aynısı, ancak yeni seçenekleri kullanıcıya tek tek sorar |
| `make menuconfig` / `nconfig` / `xconfig` | Metin (ncurses) veya grafik arayüz |
| `make savedefconfig` | `.config` dosyasını varsayılandan farklı satırlara indirger (`defconfig` dosyası) |
| `make allnoconfig` / `tinyconfig` | Mümkün olan her şey kapalı / en küçük çekirdek |
| `make listnewconfig` | `.config` dosyasında karşılığı olmayan yeni seçenekleri listeler |
| `make localmodconfig` | Çalışan sistemde yüklü modüllere göre yapılandırmayı daraltır (derleme makinesinde kullanılır) |

`defconfig` biçimindeki bir dosya **tam bir yapılandırma değildir**: yalnızca varsayılandan farklı değerleri
içerir ve diğer her şey Kconfig'in varsayılanlarıyla tamamlanır. Bu nedenle sürüm denetiminde tam
`.config` yerine `savedefconfig` çıktısı saklanır; çekirdek sürümü değiştiğinde yeni seçenekler
kendiliğinden varsayılan değer alır.

**Yapılandırma parçaları** (*fragment*) bir adım daha ileri gider: yalnızca ürüne özgü değişiklikleri
içeren küçük dosyalardır ve bir temel yapılandırmanın üzerine `scripts/kconfig/merge_config.sh` ile
uygulanır. Kitabın `agecidi.config` parçası `allnoconfig` üzerine uygulanarak QEMU'da açılabilen en küçük
çekirdeği tanımlar:

```text title="examples/cekirdek/agecidi.config (kısaltılmış)"
CONFIG_LOCALVERSION="-agecidi"
CONFIG_PRINTK=y
CONFIG_BLK_DEV_INITRD=y
CONFIG_DEVTMPFS=y
CONFIG_SERIAL_AMBA_PL011=y
CONFIG_SERIAL_AMBA_PL011_CONSOLE=y
CONFIG_VIRTIO_MMIO=y
CONFIG_BLK_DEV=y
CONFIG_VIRTIO_BLK=y
CONFIG_EXT4_FS=y
CONFIG_MODULES=y
CONFIG_HW_RANDOM_VIRTIO=m
# CONFIG_IPV6 is not set
CONFIG_DYNAMIC_DEBUG=y
CONFIG_FUNCTION_TRACER=y
```

```sh title="examples/cekirdek/derle.sh (özü)"
export ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-
cd ~/linux
scripts/kconfig/merge_config.sh -n -O $CIKTI agecidi.config
make O=$CIKTI -j$(nproc) Image modules
```

`ARCH` hedef mimarinin `arch/` altındaki dizin adıdır; `CROSS_COMPILE` ise çapraz derleyici araçlarının
önekidir (`aarch64-linux-gnu-gcc`, `aarch64-linux-gnu-ld` …). İkisi her `make` çağrısında aynı
olmalıdır; aksi halde Kbuild derleme makinesinin mimarisine göre yeni bir yapılandırma üretir.

`merge_config.sh` parçaları sırasıyla birleştirir ve parçadaki bir değerin önceki değeri değiştirdiği her
satırı `Value of ... is redefined by fragment` iletisiyle bildirir. `-n` seçeneği, parçada bulunmayan
seçeneklerin `allnoconfig` mantığıyla kapatılmasını sağlar (verilmezse `alldefconfig` kullanılır);
`-m` ise yalnızca birleştirme yapıp Kconfig'i hiç çalıştırmaz. `-m` verilmediğinde betik son olarak
parçadaki her değerin `.config` dosyasına girip girmediğini denetler ve girmeyenleri
`Value requested for ... not in final .config` uyarısıyla bildirir.

!!! dikkat "Bağımlılığı eksik seçenek sessizce düşer"
    Bu kitabın parçasının ilk sürümünde `CONFIG_BLK_DEV=y` satırı yoktu. `CONFIG_VIRTIO_BLK` seçeneği
    `BLK_DEV` menüsünün içinde tanımlandığından Kconfig onu kapattı; derleme hatasız tamamlandı, ancak
    çekirdek açılışta `Waiting for root device /dev/vda2...` satırında kaldı, çünkü disk sürücüsü
    çekirdekte yoktu. `merge_config.sh` `-m` olmadan çalıştırıldığında sorun derleme başlamadan
    görülür. Bir seçeneğin bağımlılıkları `menuconfig` arayüzünde seçenek üzerinde `?` tuşuna basılarak
    veya Kconfig dosyasında okunarak bulunur. Aşağıdaki oturum bu durumu da göstermektedir.

    `-n` (allnoconfig tabanı) bir başka yan etkiye de sahiptir: parçada yazılmayan ve varsayılanı `y`
    olan görünür seçenekler de kapanır. Kitabın çekirdeğinde ilk derlemede `CONFIG_RTC_HCTOSYS` ve
    `CONFIG_RTC_INTF_SYSFS` kapandığı için sistem saati 1970'ten başlamış ve `/sys/class/rtc` boş
    kalmıştır; parçaya bu seçenekler açıkça eklenmiştir. `alldefconfig` tabanında bu seçenekler
    varsayılan değerlerini alırdı.

<div class="terminal" data-oturum="kconfig-derleme"></div>

## 3.4 `.config` dosyasından derlenen nesnelere

Yapılandırma değerleri derleme sistemine iki yoldan ulaşır. `make` her çalıştığında `syncconfig` adımı
`.config` dosyasından şu dosyaları üretir:

- **`include/config/auto.conf`**: Makefile sözdizimiyle `CONFIG_AD=y` satırları. Kbuild Makefile'ları bu
  dosyayı içerir ve `obj-$(CONFIG_AD)` ifadeleri bu değerlerle genişler.
- **`include/generated/autoconf.h`**: C ön işlemcisi tanımları. `y` değerli seçenek `#define CONFIG_AD 1`,
  `m` değerli seçenek `#define CONFIG_AD_MODULE 1` olarak yazılır; kapalı seçenekler için tanım yoktur.
  Bu dosya her çekirdek kaynak dosyasına otomatik olarak eklenir.

C kodunda seçenekler `#ifdef CONFIG_AD` yerine tercihen `include/linux/kconfig.h` makrolarıyla sınanır:
`IS_ENABLED(CONFIG_AD)` (`y` veya `m`), `IS_BUILTIN()` (yalnızca `y`), `IS_MODULE()` (yalnızca `m`).
Bu makrolar normal bir `if` içinde kullanılabildiğinden kapalı daldaki kod da derleyici tarafından
sözdizimi açısından denetlenir, ardından ölü kod olarak atılır.

Kbuild ayrıca hangi kaynak dosyanın hangi seçeneklere baktığını izler (`fixdep` aracı). Bir seçenek
değiştiğinde yalnızca o seçeneği kullanan dosyalar yeniden derlenir; tüm çekirdeğin yeniden derlenmesi
gerekmez.

Aşağıdaki animasyon bir seçeneğin yapılandırma dosyalarından derleme çıktılarına kadar izlediği yolu
gösterir:

<div class="akis" data-senaryo="kconfig-kbuild"></div>

## 3.5 Kbuild Makefile'ları: `obj-y` ve `obj-m`

Çekirdek dizinlerindeki Makefile'lar sıradan Make kuralları değil, Kbuild'in yorumladığı **listelerdir**:

```make title="examples/cekirdek/agac-ici/Makefile"
obj-$(CONFIG_ORNEK_BILGI)		+= ornek_bilgi.o
ccflags-$(CONFIG_ORNEK_BILGI_AYRINTI)	+= -DDEBUG
```

`CONFIG_ORNEK_BILGI=y` ise satır `obj-y += ornek_bilgi.o` olur ve nesne dizinin `built-in.a` arşivine,
oradan `vmlinux` dosyasına girer. `=m` ise satır `obj-m += ornek_bilgi.o` olur ve ayrı bir
`ornek_bilgi.ko` modülü üretilir. Seçenek kapalıysa `obj-` (boş) listesine düşer ve hiç derlenmez.
Diğer kalıplar:

| Kalıp | Anlamı |
|---|---|
| `obj-y += altdizin/` | Alt dizine in ve oradaki Makefile'ı işle |
| `ornek-y := a.o b.o` + `obj-m += ornek.o` | Birden fazla kaynaktan tek modül (`ornek.ko`) |
| `ccflags-y`, `ccflags-$(CONFIG_…)` | Bu dizindeki dosyalar için ek derleyici bayrakları |
| `obj-$(CONFIG_A) += x.o` + `x-$(CONFIG_B) += x_ek.o` | Koşullu ek kaynak |

Ağaç dışı modüllerin Makefile'ı da aynı dili kullanır; tek fark, derlemenin çekirdek derleme dizinine
`make -C <çekirdek> M=$(PWD)` ile yönlendirilmesidir (`examples/modul/Makefile`). Modül geliştirmenin
ayrıntıları <a href="../../aygit-surucusu/bolumler/01-modul-temelleri.html">Aygıt Sürücüsü kitabı, Bölüm 1</a>'de,
Make'in genel kuralları <a href="../../c-derleme/bolumler/03-make.html">C, Make ve CMake kitabı, Bölüm 3</a>'te anlatılır.

!!! lab "Uygulama 3.1 · Sürücünün çekirdek ağacına eklenmesi"
    `examples/cekirdek/agac-ici/ekle.sh` betiği `ornek_bilgi` sürücüsünü `drivers/misc/ornek/` olarak
    ağaca ekler, `drivers/misc/Kconfig` dosyasına `source` satırını ve `drivers/misc/Makefile` dosyasına
    `obj-y += ornek/` satırını yazar. Çekirdek kaynağının bir kopyasında çalışılması önerilir:

    ```bash
    sh ~/cekirdek-onyukleme/examples/cekirdek/agac-ici/ekle.sh ~/linux
    cd ~/linux
    export ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-
    scripts/config --file ~/agecidi/cekirdek/.config --module ORNEK_BILGI
    make O=~/agecidi/cekirdek olddefconfig
    grep ORNEK ~/agecidi/cekirdek/.config
    make O=~/agecidi/cekirdek -j$(nproc) modules
    grep ORNEK ~/agecidi/cekirdek/include/generated/autoconf.h
    ```

    Bu ortamda alınan sonuçlar: `.config` dosyasında `CONFIG_ORNEK_BILGI=m` ve
    `# CONFIG_ORNEK_BILGI_AYRINTI is not set` satırları; derleme çıktısında `CC [M]
    drivers/misc/ornek/ornek_bilgi.o` ve `LD [M]  drivers/misc/ornek/ornek_bilgi.ko`; ardından
    `autoconf.h` dosyasında `#define CONFIG_ORNEK_BILGI_MODULE 1`. `autoconf.h` dosyasının `olddefconfig`
    ile değil, sonraki `make` çağrısının `syncconfig` adımında güncellendiğine dikkat edilmelidir. Ardından `--enable ORNEK_BILGI` ile seçenek `y` yapılıp yeniden derlendiğinde
    `.ko` dosyası üretilmez ve `System.map` içinde `ornek_bilgi_oku` sembolü görülür.

## 3.6 Derleme çıktıları

Derleme sonunda çıktı dizininde şu dosyalar bulunur:

| Dosya | Açıklama |
|---|---|
| `vmlinux` | Bağlanmış çekirdeğin ELF dosyası; semboller ve (etkinse) hata ayıklama bilgisi içerir. Önyüklenmez; `gdb`, `addr2line` ve `crash` gibi araçlar için saklanır |
| `System.map` | Sembol adları ve adresleri; oops çözümlemesinde kullanılır |
| `arch/arm64/boot/Image` | ARM64'ün önyüklenebilir ham ikilisi (`objcopy -O binary`) ve 64 baytlık başlık |
| `arch/arm64/boot/Image.gz` | Sıkıştırılmış `Image`; açmayı önyükleyici yapar |
| `arch/arm/boot/zImage` | 32 bit ARM'de kendini açan çekirdek |
| `arch/x86/boot/bzImage` | x86'da kendini açan çekirdek; EFI uygulaması olarak da çalışabilir |
| `uImage`, FIT | U-Boot'a özgü başlıklı biçimler ([Bölüm 2](02-u-boot.md)) |
| `*.ko`, `modules.order`, `Module.symvers` | Modüller, yükleme sırası ve dışa aktarılan sembollerin sağlamaları |

`vmlinux` ile `Image` arasındaki boyut farkı büyüktür: bu kitabın yapılandırmasında hata ayıklama bilgisi
etkin olduğundan `vmlinux` 109 MiB, `Image` 9,5 MiB'tır. Cihaza yalnızca `Image` gönderilir;
`vmlinux` ise aynı derlemeye ait olduğu bilinerek arşivlenmelidir. Farklı bir derlemenin `vmlinux`
dosyasıyla yapılan oops çözümlemesi yanlış satırları gösterir.

**Modüllerin kurulumu** `modules_install` hedefiyle yapılır. Modüller
`$(INSTALL_MOD_PATH)/lib/modules/<sürüm>/` altına kopyalanır, ardından `depmod` çalıştırılarak
`modules.dep`, `modules.alias` gibi dizin dosyaları üretilir ([Bölüm 5](05-kullanici-alani-arayuzleri.md)).
Çapraz derlemede `INSTALL_MOD_PATH` mutlaka hedefin kök dosya sistemi dizinini göstermelidir; verilmezse
modüller derleme makinesinin `/lib/modules` dizinine yazılmaya çalışılır. `INSTALL_MOD_STRIP=1`
modüllerden hata ayıklama sembollerini ayıklar.

<div class="terminal" data-oturum="cekirdek-ciktilari"></div>

## 3.7 Çekirdek komut satırı

Çekirdek komut satırı, çekirdeğin açılış davranışını derleme gerektirmeden değiştiren parametrelerdir.
Çoğunlukla önyükleyiciden, aygıt ağacının `/chosen/bootargs` özelliği aracılığıyla gelir. ARM64'te
derleme sırasında da varsayılan bir komut satırı verilebilir:

| Seçenek | Davranış |
|---|---|
| `CONFIG_CMDLINE="..."` | Derlemeye gömülen varsayılan komut satırı |
| `CONFIG_CMDLINE_FROM_BOOTLOADER` | Önyükleyicinin değeri varsa o kullanılır, yoksa `CONFIG_CMDLINE` |
| `CONFIG_CMDLINE_FORCE` | Önyükleyicinin değeri yok sayılır; her zaman `CONFIG_CMDLINE` |

Parametreler üç gruba ayrılır. Çekirdeğin çekirdek parametreleri (`console=`, `root=`, `loglevel=`,
`panic=`) `Documentation/admin-guide/kernel-parameters.txt` dosyasında listelenir. Çekirdeğe gömülü
modüllerin parametreleri `<modül>.<parametre>=değer` biçiminde verilir (ör. `printk.time=1`). Çekirdeğin
tanımadığı parametreler ise init sürecine iletilir ([Bölüm 1](01-onyukleme-zinciri.md)). Çalışan sistemde
komut satırı `/proc/cmdline` dosyasından okunur.

!!! dikkat "`CONFIG_CMDLINE_FORCE` ürünü kilitleyebilir"
    Komut satırının derlemeye zorla gömülmesi sahada `root=` veya `console=` değiştirmeyi imkânsız kılar;
    yanlış bir değerle gönderilen çekirdek ancak yeni bir çekirdekle düzeltilebilir. Güvenlik amacıyla
    komut satırının değiştirilmesi engellenmek isteniyorsa doğru yer, imzalı bir FIT imajında
    önyükleyicinin `bootargs` değerini sabitlemektir ([Bölüm 2](02-u-boot.md)).

## 3.8 Yocto'da çekirdek yapılandırması

Yocto'nun `linux-yocto` tarifinde yukarıdaki kavramların her biri bir değişkene veya göreve karşılık gelir:

| Kbuild kavramı | Yocto karşılığı |
|---|---|
| `ARCH`, `CROSS_COMPILE` | Makine dosyasından türetilen `ARCH` ve `TARGET_PREFIX`; `kernel` sınıfı iletir |
| `make <ad>_defconfig` | `KBUILD_DEFCONFIG` veya `SRC_URI` içindeki `file://defconfig` |
| `allnoconfig` / `alldefconfig` tabanı | `KCONFIG_MODE` |
| Yapılandırma parçaları + `merge_config.sh` | `SRC_URI` içindeki `.cfg` dosyaları ve `KERNEL_FEATURES`; `do_kernel_configme` görevi `merge_config.sh` çağırır |
| `make menuconfig` | `bitbake -c menuconfig virtual/kernel` |
| Farkın parçaya dönüştürülmesi | `bitbake -c diffconfig virtual/kernel` |
| `Image`/`zImage`/`bzImage` seçimi | `KERNEL_IMAGETYPE` (makine dosyası) |
| `modules_install` | `do_install` içinde `MODLIB` ve `INSTALL_FW_PATH` ile çağrılır |
| `O=` çıktı dizini | `B`; kaynak `STAGING_KERNEL_DIR` (`work-shared`) altındadır |

`do_kernel_configme` görevinin uyguladığı yöntem, bu bölümdeki `derle.sh` betiğiyle aynıdır: temel
yapılandırma ile parçalar `merge_config.sh` ile birleştirilir. Birleştirme günlüğü
`cfg/merge_config_build.log` dosyasına yazılır; `do_kernel_configcheck` ise istenen değerlerin sonuca
girip girmediğini denetler. Parça yazımı, `menuconfig` → `diffconfig` iş akışı ve çekirdek yamaları
<a href="../../yocto-gomulu-linux/bolumler/12-cekirdek.html">Yocto kitabı, Bölüm 12</a>'de ayrıntılı olarak
anlatılmıştır.

!!! sss "Çekirdek Yocto dışında mı yoksa içinde mi geliştirilmeli?"
    Sürücü geliştirme ve hata ayıklama gibi sık derleme gerektiren işlerde çekirdeğin bu bölümdeki gibi
    doğrudan Kbuild ile derlenmesi daha hızlı bir döngü sağlar. Değişiklikler olgunlaştığında yama ve
    yapılandırma parçası olarak katmana alınır. Yocto'nun `devtool modify linux-yocto` komutu bu iki
    yaklaşımı birleştirir: kaynak bir çalışma alanına çıkarılır, ancak derleme yine Yocto'nun araç
    zinciriyle yapılır.

## Özet

- Çekirdek kaynak ağacı mimariye özgü kodu (`arch/`), sürücüleri (`drivers/`) ve ortak alt sistemleri ayrı dizinlerde tutar; derleme kök `Makefile` üzerinden yürür. `O=` çıktıları ayrı tutar.
- Kconfig dili seçenekleri tanımlar: `depends on` görünürlüğü ve üst sınırı, `select` zorunlu açmayı, `imply` zayıf açmayı belirler.
- `.config` tam yapılandırmadır; `savedefconfig` ve parçalar yalnızca farkları tutar. `merge_config.sh` parçaları birleştirir, `olddefconfig` bağımlılıkları yeniden hesaplar.
- `.config` → `auto.conf` (Makefile) ve `autoconf.h` (C). `m` değerli seçenekler `CONFIG_AD_MODULE` olarak tanımlanır.
- Kbuild'de `obj-y` nesneleri `vmlinux`'a, `obj-m` nesneleri `.ko` modüllerine girer.
- `vmlinux` sembollü ELF, `Image`/`zImage`/`bzImage` önyüklenebilir biçimdir; `System.map` ve `vmlinux` her derleme için saklanmalıdır.
- Yocto'da `KBUILD_DEFCONFIG`, `.cfg` parçaları, `KCONFIG_MODE` ve `KERNEL_IMAGETYPE` bu kavramların karşılığıdır.

## Değerlendirme soruları

<div class="quiz" data-id="b03-1">
<p class="quiz-soru">Bir sürücünün Kconfig girdisinde <code>depends on I2C</code> yazılıdır ve <code>CONFIG_I2C=m</code>'dir. Sürücü seçeneği en fazla hangi değeri alabilir?</p>
<ul>
<li><code>y</code></li>
<li data-dogru><code>m</code></li>
<li>Seçenek görünmez</li>
<li>Bağımlılık değerinden bağımsızdır</li>
</ul>
<p class="quiz-aciklama"><code>tristate</code> bir seçeneğin değeri bağımlılıklarının değeriyle sınırlıdır. Çekirdeğe gömülü bir sürücü, modül olarak yüklenecek bir alt sisteme bağlanamaz.</p>
</div>

<div class="quiz" data-id="b03-2">
<p class="quiz-soru"><code>CONFIG_ORNEK_BILGI=m</code> olduğunda <code>include/generated/autoconf.h</code> içinde hangi satır bulunur?</p>
<ul>
<li><code>#define CONFIG_ORNEK_BILGI 1</code></li>
<li><code>#define CONFIG_ORNEK_BILGI m</code></li>
<li data-dogru><code>#define CONFIG_ORNEK_BILGI_MODULE 1</code></li>
<li>Hiçbir satır; modül seçenekleri yalnızca <code>auto.conf</code> dosyasına yazılır</li>
</ul>
<p class="quiz-aciklama">Modül seçenekleri <code>_MODULE</code> sonekiyle tanımlanır. <code>IS_ENABLED(CONFIG_ORNEK_BILGI)</code> iki durumu da doğru sayar; <code>#ifdef CONFIG_ORNEK_BILGI</code> ise modül durumunu kaçırır.</p>
</div>

<div class="quiz" data-id="b03-3">
<p class="quiz-soru">Bir geliştirici <code>.config</code> dosyasına elle <code>CONFIG_CAN_VCAN=m</code> satırını eklemiş, ardından <code>make olddefconfig</code> çalıştırmıştır. Satır dosyadan kaybolmuştur. Olası neden nedir?</p>
<ul>
<li><code>olddefconfig</code> elle eklenen satırları her zaman siler</li>
<li data-dogru>Seçeneğin bağımlılığı (ör. <code>CONFIG_CAN</code>) karşılanmadığından Kconfig değeri <code>n</code> yapmıştır</li>
<li>Modül seçenekleri <code>.config</code> dosyasında tutulmaz</li>
<li>Satırın sonunda boşluk vardır</li>
</ul>
<p class="quiz-aciklama">Kconfig, bağımlılıkları karşılanmayan seçenekleri sessizce kapatır. Yocto'daki <code>do_kernel_configcheck</code> bu durumu raporlar; Kbuild'de <code>merge_config.sh</code>, <code>-m</code> seçeneği olmadan çalıştırıldığında sonuçta bulunmayan değerleri <code>Value requested for ... not in final .config</code> iletisiyle bildirir.</p>
</div>

<div class="quiz" data-id="b03-4">
<p class="quiz-soru">Sahadan gelen bir oops raporundaki adresleri kaynak satırlarına çevirmek için hangi dosya gereklidir?</p>
<ul>
<li><code>arch/arm64/boot/Image</code></li>
<li><code>.config</code></li>
<li data-dogru>Aynı derlemeye ait, hata ayıklama bilgisi içeren <code>vmlinux</code> (ve modüller için ilgili <code>.ko</code>)</li>
<li><code>modules.order</code></li>
</ul>
<p class="quiz-aciklama"><code>Image</code> sembol içermeyen ham ikilidir. Satır bilgisi yalnızca DWARF içeren ELF dosyalarında bulunur ve derlemeye özgüdür; bu nedenle <code>vmlinux</code> her sürüm için arşivlenmelidir (Bölüm 8).</p>
</div>

<div class="quiz" data-id="b03-5">
<p class="quiz-soru">Çapraz derlenen modüller <code>make modules_install</code> ile kurulmak istenmektedir. Hangi değişken mutlaka verilmelidir?</p>
<ul>
<li><code>INSTALL_MOD_STRIP=1</code></li>
<li data-dogru><code>INSTALL_MOD_PATH=&lt;hedefin kök dizini&gt;</code></li>
<li><code>KCONFIG_CONFIG</code></li>
<li><code>LOCALVERSION</code></li>
</ul>
<p class="quiz-aciklama"><code>INSTALL_MOD_PATH</code> verilmezse modüller derleme makinesinin <code>/lib/modules</code> dizinine yazılmaya çalışılır. <code>INSTALL_MOD_STRIP</code> isteğe bağlıdır.</p>
</div>

!!! alistirma "Alıştırma: Yapılandırma farkının çıkarılması"
    `agecidi.config` ile derlenmiş çekirdek dizininde:

    1. `make savedefconfig` ile `defconfig` dosyasını üretin ve satır sayısını `.config` ile karşılaştırın.
    2. `scripts/config` ile `CONFIG_IKCONFIG_PROC` seçeneğini kapatıp `olddefconfig` çalıştırın ve
       `scripts/diffconfig` ile iki yapılandırma arasındaki farkı gösterin.
    3. Bu farkın neden yalnızca bir satır olmadığını (veya olduğunu) açıklayın.

    ??? success "Örnek çözüm"
        ```bash
        cd ~/linux
        export ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu-
        make O=~/agecidi/cekirdek savedefconfig
        wc -l ~/agecidi/cekirdek/defconfig ~/agecidi/cekirdek/.config
        cp ~/agecidi/cekirdek/.config /tmp/eski.config
        scripts/config --file ~/agecidi/cekirdek/.config --disable IKCONFIG_PROC
        make O=~/agecidi/cekirdek olddefconfig
        scripts/diffconfig /tmp/eski.config ~/agecidi/cekirdek/.config
        ```

        `savedefconfig` çıktısı yalnızca varsayılandan farklı seçenekleri içerdiğinden birkaç yüz satırlık
        `.config` dosyasına karşın birkaç düzine satırdır. `diffconfig` çıktısı `-IKCONFIG_PROC y` ya da
        `IKCONFIG_PROC y -> n` biçiminde tek satırdır, çünkü `IKCONFIG_PROC` başka bir seçeneğin
        bağımlılığı değildir. Bir seçenek başka seçeneklerin `depends on` koşuluysa (ör. `CONFIG_NET`)
        kapatıldığında ona bağlı tüm seçenekler de kapanır ve fark çok satırlı olur. Bu nedenle bir
        parçanın etkisi her zaman `olddefconfig` sonrasındaki yapılandırma üzerinden değerlendirilmelidir.

**Sonraki bölüm:** [4 · Aygıt ağacı: yapı, bağlamalar ve overlay'ler →](04-aygit-agaci.md)
