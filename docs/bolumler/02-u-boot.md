# 2 · U-Boot: ortam, komutlar ve önyükleme betikleri

<div class="kunye" markdown>
<span>Süre: ~60 dk + uygulama</span><span>Düzey: Orta</span><span>Ön koşul: Bölüm 1</span>
</div>

!!! hedef "Öğrenme hedefleri"
    Bu bölümün sonunda:

    - U-Boot'un kaynak yapısını, yapılandırılmasını ve derleme çıktılarını açıklayabilirsiniz.
    - U-Boot konsolunda bellek, depolama ve önyükleme komutlarını kullanabilirsiniz.
    - Ortam değişkenlerinin nerede saklandığını, nasıl genişletildiğini ve Linux'tan nasıl değiştirildiğini açıklayabilirsiniz.
    - `bootcmd`, `bootargs` ve standart önyükleme (`bootflow`, `extlinux.conf`) mekanizmasını yapılandırabilirsiniz.
    - `boot.scr` betiği ve FIT imajı hazırlayabilirsiniz.
    - İmzalı önyüklemenin (verified boot) güven zincirindeki yerini açıklayabilirsiniz.
    - Yocto'daki `u-boot` tarifini `UBOOT_MACHINE` ve `UBOOT_CONFIG` ile yapılandırabilirsiniz.

## 2.1 U-Boot'un yapısı

**U-Boot** (*Das U-Boot, Universal Boot Loader*), gömülü sistemlerde en yaygın kullanılan açık kaynak
önyükleyicidir. ARM, RISC-V, MIPS, PowerPC ve x86 dahil pek çok mimariyi ve binlerce kartı destekler.
Lisansı GPL-2.0'dır. Sürümler yılda dört kez, `YYYY.MM` biçiminde (ör. 2025.10, 2026.01) yayımlanır;
Yocto 6.0 `u-boot` tarifi 2026.01 sürümünü kullanır. Bu bölümdeki konsol çıktıları ise Ubuntu 24.04'ün
`u-boot-qemu` paketindeki 2025.10 sürümüyle QEMU `virt` makinesinde alınmıştır.

U-Boot kaynak ağacı çekirdeğe benzer biçimde düzenlenmiştir ve yapılandırma için aynı **Kconfig**
altyapısını kullanır:

| Dizin | İçerik |
|---|---|
| `arch/`, `board/<üretici>/<kart>/` | Mimariye ve karta özgü kod; kartın varsayılan ortamı (`.env` dosyası) |
| `configs/` | Kart yapılandırmaları: `qemu_arm64_defconfig`, `rpi_4_defconfig` … |
| `cmd/` | Konsol komutları (`bootflow`, `env`, `load`, `fdt` …) |
| `boot/` | Önyükleme yöntemleri: standart önyükleme (`bootstd`), FIT, `extlinux`, betik |
| `drivers/` | Sürücü modeli (*driver model*, DM) tabanlı aygıt sürücüleri |
| `env/` | Ortamın saklandığı birimler (MMC, SPI flaş, FAT, UBI …) |
| `dts/`, `arch/*/dts/` | U-Boot'un kendi aygıt ağaçları |
| `tools/` | Derleme makinesi araçları: `mkimage`, `dumpimage`, `mkenvimage`, `binman` |

Güncel U-Boot sürümleri donanımı, çekirdekte olduğu gibi bir **aygıt ağacından** öğrenir. Bu "denetim
ağacı" (*control DTB*) çoğu kartta U-Boot ikilisine eklenir; QEMU'da ise QEMU'nun ürettiği ağaç
kullanılır. Açılış çıktısındaki `devicetree: board` ifadesi bunu belirtir.

Yapılandırma ve derleme çekirdekle aynı biçimde yapılır:

```bash
export CROSS_COMPILE=aarch64-linux-gnu-
make O=../uboot-cikti qemu_arm64_defconfig
make O=../uboot-cikti menuconfig          # isteğe bağlı değişiklikler
make O=../uboot-cikti -j$(nproc)
```

U-Boot'ta `ARCH` değişkeni verilmez; mimari, kart yapılandırmasından gelir. Derlemenin başlıca çıktıları:

| Dosya | Açıklama |
|---|---|
| `u-boot` | ELF dosyası; hata ayıklayıcı ve QEMU için |
| `u-boot.bin` | Ham ikili; denetim ağacı eklenmiş olarak |
| `u-boot.dtb` | Denetim ağacı |
| `spl/u-boot-spl.bin`, `tpl/u-boot-tpl.bin` | SPL ve TPL ([Bölüm 1](01-onyukleme-zinciri.md)) |
| `u-boot.img`, `u-boot.itb`, yongaya özgü dosyalar | SPL'nin yüklediği paketler; çoğu `binman` aracıyla üretilir |

## 2.2 Konsol ve temel komutlar

U-Boot açıldığında `bootdelay` saniye kadar bekler ve bu sürede bir tuşa basılırsa otomatik önyüklemeyi
durdurup komut istemini (`=>`) gösterir. Komut yorumlayıcısı, BusyBox'tan türetilmiş **hush** kabuğudur:
değişkenler, `;` ile ardışık komutlar, `&&`/`||`, `if`/`then`/`else`/`fi`, `for` ve `test` desteklenir.

| Grup | Komutlar |
|---|---|
| Bilgi | `version`, `bdinfo`, `coninfo`, `dm tree`, `help <komut>` |
| Ortam | `printenv`, `setenv`, `saveenv`, `env default -a`, `env delete`, `run`, `editenv` |
| Bellek | `md` (göster), `mw` (yaz), `cp`, `cmp`, `crc32` |
| Depolama | `mmc list/dev/part`, `usb start`, `virtio scan`, `part list`, `ls`, `load`, `ext4load`, `fatload` |
| Ağ | `dhcp`, `tftpboot`, `ping`, `nfs`, `wget` |
| Önyükleme | `booti` (ARM64 `Image`), `bootz` (ARM `zImage`), `bootm` (uImage/FIT), `bootflow`, `source`, `bootefi` |
| Aygıt ağacı | `fdt addr`, `fdt print`, `fdt set`, `fdt apply`, `fdt resize` |

Dosya yükleyen komutlar (`load`, `tftpboot`) okunan bayt sayısını `filesize` değişkenine yazar. Bu
değer onaltılık tabandadır ve initramfs'in boyutunu `booti` komutuna iletmek için kullanılır:

```text
=> load virtio 0:1 ${ramdisk_addr_r} initramfs.cpio.gz
=> booti ${kernel_addr_r} ${ramdisk_addr_r}:${filesize} ${fdt_addr}
```

`booti` üç argüman alır: çekirdeğin adresi, initramfs'in `adres:boyut` değeri (yoksa `-`) ve aygıt
ağacının adresi. U-Boot çekirdeği başlatmadan önce ağacın `/chosen` düğümüne `bootargs` ve initramfs
konumunu yazar, gerekiyorsa bellek düğümlerini günceller.

## 2.3 Ortam değişkenleri

U-Boot'un davranışı büyük ölçüde **ortam değişkenleriyle** (*environment*) belirlenir. Ortam,
`ad=değer` dizelerinden oluşan, başında 32 bitlik bir CRC bulunan bir bellek bloğudur. Açılışta şu sırayla
belirlenir:

1. U-Boot, yapılandırmada seçilen birimden (`CONFIG_ENV_IS_IN_MMC`, `_SPI_FLASH`, `_FAT`, `_EXT4`,
   `_UBI`, `_FLASH` …) ortam bloğunu okur ve CRC değerini denetler.
2. CRC geçerliyse bu ortam kullanılır (`Loading Environment from ... OK`).
3. Blok boşsa veya bozuksa derlemeye gömülü **varsayılan ortam** kullanılır
   (`*** Warning - bad CRC, using default environment`). Varsayılan ortam karta ait `.env` metin
   dosyasından (`board/<üretici>/<kart>/<kart>.env`) üretilir.

`saveenv` (veya `env save`) bellekteki ortamın tamamını saklama birimine yazar. Güç kesintisine karşı
`CONFIG_ENV_REDUNDANT` (2026.01 öncesindeki adıyla `CONFIG_SYS_REDUNDAND_ENVIRONMENT`) ile iki kopya tutulabilir; her yazmada eski kopya korunur ve geçerli
olanı bir sayaç belirler.

!!! dikkat "Değişken genişletmesi: çift tırnak ve tek tırnak"
    hush kabuğu `${ad}` ifadesini **komut satırı ayrıştırılırken** genişletir. `setenv a "echo ${yol}"`
    komutunda değişkene o anki değer yazılır; `setenv a 'echo ${yol}'` ise ifadeyi olduğu gibi saklar ve
    genişletme `run a` sırasında yapılır. Önyükleme komutlarını birleştiren değişkenler (`bootcmd`,
    `ayarla_args` gibi) her zaman tek tırnakla tanımlanmalıdır; aksi halde sonradan yapılan değişiklikler
    etkisiz kalır. Aşağıdaki oturum farkı gösterir.

<div class="terminal" data-oturum="uboot-ortam"></div>

Ortam, Linux'tan da okunup yazılabilir. `libubootenv` projesinin `fw_printenv` ve `fw_setenv` araçları,
ortamın konumunu `/etc/fw_env.config` dosyasından öğrenir. Bir sahadaki cihazda güncelleme ajanının
etkin bölümü değiştirmesi veya fabrikada seri numarasının yazılması bu araçlarla yapılır. Fabrikada ilk
ortam, metin dosyasından `mkenvimage` ile üretilip flaş belleğe yazılabilir:

<div class="terminal" data-oturum="fw-printenv"></div>

```text title="examples/u-boot/fw_env.config"
# Aygıt veya dosya      Konum    Ortam boyutu
flash1.img              0x0      0x40000
```

Gerçek bir cihazda ilk sütun bir MTD aygıtı (`/dev/mtd1`) veya eMMC bölümüdür
(`/dev/mmcblk0boot1`); konum ve boyut U-Boot'un `CONFIG_ENV_OFFSET` ve `CONFIG_ENV_SIZE` değerleriyle
**aynı** olmalıdır. Uyuşmazlık, `fw_printenv` tarafında `Warning: Bad CRC, using default environment`
iletisine, daha kötüsü yanlış bir bölgenin üzerine yazılmasına yol açar.

!!! iyi "Ortamı yazılabilir bırakmak bir güvenlik kararıdır"
    Konsola erişebilen veya ortamı değiştirebilen biri `bootargs` değerine `init=/bin/sh` ekleyerek kimlik
    doğrulamasını atlayabilir. Üretim cihazlarında `bootdelay` değeri `-2` (tuş beklemeden önyükle) veya
    `0` yapılmalı, `CONFIG_ENV_WRITEABLE_LIST` ile yalnızca `w` bayrağı verilmiş değişkenlerin
    değiştirilmesine izin verilmeli ve imzalı önyükleme kullanılıyorsa komut satırı FIT yapılandırmasına sabitlenmelidir.

## 2.4 `bootcmd`, `bootdelay` ve `bootargs`

Otomatik önyüklemede U-Boot, `bootdelay` süresi dolduğunda **`bootcmd`** değişkenindeki komutları
çalıştırır. `bootcmd` tek bir komut veya `run` ile başka değişkenleri çağıran bir zincir olabilir.
Kitabın ön tanımlı ortamı (`examples/u-boot/uboot-env.txt`) bu yapıyı örnekler:

```text title="examples/u-boot/uboot-env.txt (kısaltılmış)"
konsol=console=ttyAMA0,115200
kok=root=/dev/vda2 rootfstype=ext4 rootwait ro
ayarla_args=setenv bootargs ${konsol} ${kok} ${ekargs}
diskten=run ayarla_args; load virtio 0:1 ${kernel_addr_r} Image; booti ${kernel_addr_r} - ${fdt_addr}
agdan=run ayarla_args; dhcp; tftpboot ${kernel_addr_r} Image; booti ${kernel_addr_r} - ${fdt_addr}
bootcmd=bootflow scan -lb
```

**`bootargs`** çekirdek komut satırıdır; U-Boot bu değeri aygıt ağacının `/chosen/bootargs` özelliğine
yazar. Değişkenleri küçük parçalara bölmek (konsol, kök, ek parametreler) sahada yalnızca bir parçanın
değiştirilmesini kolaylaştırır: hata ayıklama için `fw_setenv ekargs loglevel=7` yeterlidir.

Aşağıdaki animasyon `bootcmd` değerinin genişletilmesinden çekirdeğe atlanmasına kadar olan adımları
gösterir:

<div class="akis" data-senaryo="uboot-bootcmd"></div>

## 2.5 Standart önyükleme: `bootflow` ve `extlinux.conf`

Eskiden her kartın `bootcmd` değeri, o karta özgü uzun bir betikti. Dağıtımların (Debian, Fedora vb.) aynı
imajla farklı kartlarda açılabilmesi için önce **distro boot** adlı ortak bir betik kümesi
(`distro_bootcmd`, `boot_targets`, `scan_dev_for_boot`) geliştirildi. Güncel U-Boot sürümlerinde bunun
yerini C ile yazılmış **standart önyükleme** (*standard boot*, `bootstd`) almıştır. Kavramları:

- **bootdev**: önyükleme yapılabilecek bir aygıt (MMC, USB, virtio, ağ).
- **bootmeth**: bir önyükleme yöntemi: `extlinux` (`extlinux/extlinux.conf`), `script`
  (`boot.scr.uimg`, `boot.scr`), `efi`, `pxe` …
- **bootflow**: bir bootdev üzerinde bir bootmeth'in bulduğu önyüklenebilir bir girdi.

`bootflow scan` komutu `boot_targets` sırasıyla aygıtları ve her aygıtın bölümlerini tarar; dosyalar
`/` ve `/boot/` öneklerinde aranır. `-l` bulunanları listeler, `-b` ilk geçerli girdiyle önyükler.
Distro boot için yazılmış eski `boot_targets` değerleri de yeni mekanizmada kullanılır.

`extlinux.conf`, Syslinux'tan devralınmış basit bir menü biçimidir:

```text title="examples/u-boot/extlinux.conf"
menu title ÖrnekOS önyükleme menüsü
timeout 30
default ornekos

label ornekos
    menu label ÖrnekOS (kök: /dev/vda2)
    linux /Image
    append console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro

label kurtarma
    menu label ÖrnekOS kurtarma (initramfs kabuğu)
    linux /Image
    initrd /initramfs.cpio.gz
    append console=ttyAMA0,115200 kurtarma
```

Yollar dosyanın bulunduğu bölüme göredir. `fdt` veya `fdtdir` satırı ile aygıt ağacı da diskten
yüklenebilir; satır yoksa U-Boot kendi elindeki ağacı (`fdt_addr` veya denetim ağacı) kullanır.
`timeout` değeri saniyenin onda biri birimindedir. Aşağıdaki oturum, kitabın disk imajıyla QEMU'da
alınmıştır. Tarama sırasında aygıttan bağımsız (*global*) EFI önyükleme yöneticisi de denenir; bu
düzende EFI uygulaması bulunmadığından başarısız olur ve sıra virtio diskine gelir:

<div class="terminal" data-oturum="uboot-bootflow"></div>

!!! sss "extlinux.conf mu, boot.scr mi?"
    `extlinux.conf` bildirimsel ve okunması kolay bir biçimdir; Yocto'nun `uboot-extlinux-config` sınıfı
    onu otomatik üretebilir. Koşullu mantık (A/B bölüm seçimi, başarısız önyükleme sayacı, ürün yazılımı
    sürümüne göre davranış) gerektiğinde ise `boot.scr` betiği daha uygundur. İki yöntem aynı bölümde
    bulunabilir; hangisinin önce deneneceğini `bootmeth order` belirler.

## 2.6 Önyükleme betiği: `boot.scr`

`boot.scr`, U-Boot komutlarından oluşan bir metnin `mkimage` ile **eski uImage başlığı** eklenerek
paketlenmiş halidir. Başlık 64 bayttır ve içeriğin CRC değerini taşır:

```text title="examples/u-boot/boot.cmd"
echo "boot.scr: ${devtype} ${devnum}:${distro_bootpart} bölümünden yükleniyor"
setenv bootargs "console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro"
load ${devtype} ${devnum}:${distro_bootpart} ${kernel_addr_r} Image
load ${devtype} ${devnum}:${distro_bootpart} ${ramdisk_addr_r} initramfs.cpio.gz
setenv rd_boyut ${filesize}
booti ${kernel_addr_r} ${ramdisk_addr_r}:${rd_boyut} ${fdt_addr}
```

```bash
mkimage -A arm64 -O linux -T script -C none -n "ornekos boot" -d boot.cmd boot.scr
mkimage -l boot.scr        # başlığı göster
```

Standart önyüklemenin `script` yöntemi, betiği çalıştırmadan önce `devtype`, `devnum`,
`distro_bootpart` ve `prefix` değişkenlerini atar (`boot/bootmeth_script.c`). Böylece aynı betik SD
kartta da USB bellekte de çalışır. Betik elle de çalıştırılabilir:
`load virtio 0:1 ${scriptaddr} boot.scr; source ${scriptaddr}`.

## 2.7 FIT imajı

**FIT** (*Flattened Image Tree*), çekirdek, aygıt ağaçları, initramfs ve diğer ikilileri tek dosyada
birleştiren U-Boot biçimidir. Adından da anlaşılacağı gibi bir aygıt ağacıdır: kaynağı `.its`
(*image tree source*) dosyası, çıktısı `.itb` dosyasıdır. FIT'in eski uImage biçimine göre üstünlükleri:

- Birden fazla çekirdek, ağaç ve initramfs tek dosyada bulunabilir; **yapılandırmalar**
  (*configurations*) hangi parçaların birlikte kullanılacağını tanımlar. Aynı FIT farklı kart
  sürümlerinde farklı ağaçlarla açılabilir.
- Her parça için **özet** (`hash`: `sha256`, `crc32` …) tutulur; U-Boot yüklemeden önce bütünlüğü denetler.
- Yapılandırmalar **imzalanabilir** (2.8).

```dts title="examples/u-boot/ornek.its (kısaltılmış)"
/ {
	description = "ÖrnekOS FIT imajı (agecidi)";
	images {
		kernel-1 {
			data = /incbin/("Image");
			type = "kernel"; arch = "arm64"; os = "linux";
			compression = "none";
			load = <0x40400000>; entry = <0x40400000>;
			hash-1 { algo = "sha256"; };
		};
		ramdisk-1 { data = /incbin/("initramfs.cpio.gz"); type = "ramdisk"; ... };
		fdt-1     { data = /incbin/("virt.dtb"); type = "flat_dt"; ... };
	};
	configurations {
		default = "conf-1";
		conf-1 { kernel = "kernel-1"; ramdisk = "ramdisk-1"; fdt = "fdt-1"; };
	};
};
```

FIT `mkimage -f ornek.its ornek.itb` ile üretilir ve U-Boot'ta `bootm <adres>` (varsayılan yapılandırma)
veya `bootm <adres>#conf-1` ile başlatılır. `bootm`, çekirdeği `.itb` içinden `load` adresine kopyalar;
FIT dosyasının yüklendiği adres bu nedenle çekirdeğin hedef bölgesiyle çakışmamalıdır.

<div class="akis" data-senaryo="fit-imaji"></div>

<div class="terminal" data-oturum="mkimage-fit"></div>

## 2.8 İmzalı önyükleme (verified boot)

FIT'teki özetler kazara bozulmayı yakalar, ancak dosyayı değiştiren kişi özeti de yeniden hesaplayabilir.
**İmzalı önyükleme** (*verified boot*), FIT yapılandırmasının bir özel anahtarla imzalanması ve açık
anahtarın U-Boot'un denetim ağacına gömülmesiyle bu açığı kapatır:

1. Derleme makinesinde bir RSA veya ECDSA anahtar çifti üretilir. Özel anahtar yalnızca imzalama
   ortamında (tercihen bir HSM'de) bulunur.
2. `.its` dosyasındaki yapılandırmaya bir `signature-1` düğümü eklenir (`algo = "sha256,rsa2048"`,
   `key-name-hint = "dev"`, `sign-images = "kernel", "fdt", "ramdisk"`).
3. `mkimage -f ornek.its -k <anahtar-dizini> -K u-boot.dtb -r ornek.itb` komutu FIT'i imzalar ve açık
   anahtarı `u-boot.dtb` içindeki `/signature` düğümüne `required = "conf"` özelliğiyle yazar.
4. Açık anahtarı taşıyan U-Boot ikilisi yeniden paketlenir. `bootm`, imzası doğrulanamayan bir
   yapılandırmayı reddeder.

Bu yöntemin güvenilirliği, U-Boot'un kendisinin değiştirilememesine bağlıdır. Açık anahtar U-Boot'un
içindedir; U-Boot ise Boot ROM tarafından doğrulanmalıdır ([Bölüm 1](01-onyukleme-zinciri.md)). Yonganın
güvenli önyüklemesi etkinleştirilmeden yapılan FIT imzalama, yalnızca U-Boot'un değiştirilmediği
varsayımı altında koruma sağlar. Ayrıca U-Boot ortamı ve konsolu, imzalı yapılandırmanın dışındaki
yollarla (ör. `booti` ile elle önyükleme) çekirdek başlatılmasına izin vermemelidir. Yocto'daki karşılığı
`UBOOT_SIGN_ENABLE`, `UBOOT_SIGN_KEYDIR` ve `UBOOT_SIGN_KEYNAME` değişkenleridir
(<a href="../../yocto-gomulu-linux/bolumler/17-guvenlik-guncelleme.html">Yocto kitabı, Bölüm 17</a>).

## 2.9 Yocto'da U-Boot

OE-Core'daki `u-boot` tarifi (6.0'da 2026.01) `uboot-config`, `uboot-extlinux-config` ve `uboot-sign`
sınıflarını kullanır. Tek yapılandırmalı bir kartta makine dosyasında şu satırlar yeterlidir:

```bitbake
PREFERRED_PROVIDER_virtual/bootloader ?= "u-boot"
UBOOT_MACHINE = "qemu_arm64_defconfig"       # configs/ altındaki dosya
```

Aynı kart için birden fazla yapılandırma gerektiğinde 6.0'ın bayrak tabanlı `UBOOT_CONFIG` biçimi
kullanılır; bu biçim ve eski virgüllü biçimden geçiş
<a href="../../yocto-gomulu-linux/bolumler/10-makine-bsp.html">Yocto kitabı, Bölüm 10</a>'da anlatılmıştır:

```bitbake
UBOOT_MACHINE = ""
UBOOT_CONFIG ??= "sd emmc"
UBOOT_CONFIG[sd] = "ornek_sd_defconfig"
UBOOT_CONFIG[emmc] = "ornek_emmc_defconfig"
UBOOT_CONFIG_BINARY[emmc] = "u-boot-with-spl.bin"
```

Bu bölümde anlatılan diğer öğelerin Yocto karşılıkları:

| Öğe | Yocto değişkeni veya tarifi |
|---|---|
| `boot.cmd` → `boot.scr` | `UBOOT_ENV = "boot"` ve `UBOOT_ENV_SUFFIX = "scr"`; tarif `boot.cmd` dosyasını `mkimage -T script` ile paketler ve `/boot` ile dağıtım dizinine koyar |
| `extlinux.conf` | `UBOOT_EXTLINUX = "1"`, `UBOOT_EXTLINUX_ROOT`, `UBOOT_EXTLINUX_CONSOLE`, `UBOOT_EXTLINUX_LABELS` |
| Kconfig parçaları | `SRC_URI` içindeki `.cfg` dosyaları; `UBOOT_FRAGMENTS`, `UBOOT_CONFIG_FRAGMENTS[...]` |
| `fw_printenv`, `fw_setenv` | `libubootenv` tarifi (`libubootenv-bin` paketi); `fw_env.config` için `u-boot-default-env` veya kurumun kendi dosyası |
| FIT imzalama | `UBOOT_SIGN_ENABLE`, `UBOOT_SIGN_KEYDIR`, `UBOOT_SIGN_KEYNAME`; FIT üretimi `linux-yocto-fitimage` tarifi |

Örnek katmanın U-Boot tarif eki, yapılandırma parçasını ve önyükleme betiğini yalnızca ÖrnekOS
dağıtımında uygular:

```bitbake title="examples/yocto/u-boot_%.bbappend"
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

SRC_URI:append:ornekos = " file://ornek-uboot.cfg file://boot.cmd"

UBOOT_ENV:ornekos = "boot"
UBOOT_ENV_SUFFIX:ornekos = "scr"
```

```text title="examples/yocto/files/ornek-uboot.cfg"
CONFIG_BOOTDELAY=0
CONFIG_SYS_PROMPT="agecidi=> "
```

!!! lab "Uygulama 2.1 · U-Boot konsolunda önyükleme"
    [Uygulama 1.1](01-onyukleme-zinciri.md)'de hazırlanan disk imajı kullanılır. QEMU başlatılır ve
    geri sayım sırasında bir tuşa basılarak konsola geçilir:

    ```bash
    sh ~/cekirdek-onyukleme/examples/qemu/calistir.sh uboot ~/agecidi
    ```

    1. `printenv kernel_addr_r ramdisk_addr_r fdt_addr` ile adresleri not edin.
    2. `virtio scan`, `part list virtio 0` ve `ls virtio 0:1 /` ile disk düzenini inceleyin.
    3. `bootflow scan -l` ile bulunan önyükleme girdilerini listeleyin; `extlinux` ve `script`
       yöntemlerinin ikisinin de bulunduğunu doğrulayın.
    4. Çekirdeği elle başlatın:

        ```text
        => setenv bootargs console=ttyAMA0,115200 root=/dev/vda2 rootwait ro loglevel=8
        => load virtio 0:1 ${kernel_addr_r} Image
        => booti ${kernel_addr_r} - ${fdt_addr}
        ```

    5. Linux açıldıktan sonra `cat /proc/cmdline` ile `bootargs` değerinin çekirdeğe ulaştığını,
       `cat /proc/device-tree/chosen/bootargs` ile aygıt ağacına yazıldığını doğrulayın.

!!! lab "Uygulama 2.2 · FIT imajı üretip önyükleme"
    `ornek.its` dosyası `Image`, `initramfs.cpio.gz` ve `virt.dtb` dosyalarıyla aynı dizine kopyalanır.
    `virt.dtb`, QEMU'nun ürettiği ağaçtır:

    ```bash
    cd ~/cekirdek-onyukleme/examples
    sh qemu/calistir.sh dtb ~/agecidi           # uboot kipiyle aynı makinenin ağacı → ~/agecidi/virt.dtb
    cd ~/agecidi
    cp ~/cekirdek-onyukleme/examples/u-boot/ornek.its .
    mkimage -f ornek.its ornek.itb
    sh ~/cekirdek-onyukleme/examples/qemu/disk-olustur.sh ~/agecidi   # ornek.itb vda1'e kopyalanır
    sh ~/cekirdek-onyukleme/examples/qemu/calistir.sh uboot ~/agecidi
    ```

    !!! dikkat "Ağaç, çalışan makineyle aynı seçeneklerle dışa aktarılmalıdır"
        QEMU'nun ürettiği ağaç komut satırına göre değişir. `-bios` verilmeden dışa aktarılan ağaçta
        U-Boot ile açılan makinede bulunmayan bir PL061 GPIO birimi tanımlıdır. Bu kitabın ilk denemesinde
        böyle bir ağaçla hazırlanan FIT, çekirdeğin bu birimi yoklarken çökmesine ve
        `Attempted to kill init!` paniğine yol açmıştır ([Bölüm 8](08-cekirdek-hata-ayiklama.md)).
        `calistir.sh dtb` kipi, `uboot` kipiyle aynı seçenekleri kullanır.

    U-Boot konsolunda FIT, çekirdeğin hedef bölgesinin üzerinde bir adrese yüklenir ve başlatılır:

    ```text
    => load virtio 0:1 0x48000000 ornek.itb
    => setenv bootargs console=ttyAMA0,115200 kurtarma
    => bootm 0x48000000#conf-1
    ```

    Çıktıda her parça için `Verifying Hash Integrity ... sha256+ OK` satırı görülmelidir. Ardından QEMU
    yeniden başlatılıp FIT yeniden yüklenir ve çekirdek verisinin ilk dört baytı değiştirilir:

    ```text
    => load virtio 0:1 0x48000000 ornek.itb
    => fdt addr 0x48000000
    => fdt get addr veri /images/kernel-1 data
    => mw.l ${veri} 0xdeadbeef 1
    => bootm 0x48000000#conf-1
    ```

    U-Boot `Bad Data Hash` iletisiyle önyüklemeyi durdurmalıdır. FIT bir aygıt ağacı olduğu için
    `fdt` komutlarıyla da incelenebilir.

## Özet

- U-Boot, çekirdekle aynı Kconfig altyapısını kullanan, sürücü modeli ve kendi aygıt ağacı olan bir önyükleyicidir. `make <kart>_defconfig` ile yapılandırılır.
- Konsol komutları hush kabuğunda çalışır; `load`/`tftpboot` dosya boyutunu `filesize` değişkenine yazar. `booti` ARM64 `Image`, `bootz` ARM `zImage`, `bootm` uImage ve FIT başlatır.
- Ortam CRC ile korunan bir bloktur; geçersizse varsayılan ortam kullanılır. `saveenv` yazar; Linux'ta `fw_printenv`/`fw_setenv` aynı bloğa `fw_env.config` aracılığıyla erişir.
- `${...}` ifadeleri ayrıştırma anında genişler; önyükleme zincirleri tek tırnakla tanımlanmalıdır.
- Otomatik önyükleme `bootcmd` ile yapılır; güncel sürümlerde standart önyükleme (`bootflow scan`) `boot_targets` sırasıyla `extlinux.conf` ve `boot.scr` arar.
- FIT, birden fazla parçayı özetleri ve yapılandırmalarıyla tek dosyada toplar; imzalı yapılandırmalar açık anahtarı U-Boot'a gömülü olarak doğrulanır.
- Yocto'da `UBOOT_MACHINE`/`UBOOT_CONFIG`, `UBOOT_ENV`, `UBOOT_EXTLINUX` ve `UBOOT_SIGN_*` bu mekanizmaları yapılandırır.

## Değerlendirme soruları

<div class="quiz" data-id="b02-1">
<p class="quiz-soru">U-Boot konsolunda <code>setenv bootcmd "run ayarla_args; booti ${kernel_addr_r} - ${fdt_addr}"</code> yazılmış ve kaydedilmiştir. Sonradan <code>kernel_addr_r</code> değiştirildiğinde ne olur?</p>
<ul>
<li>Yeni değer kullanılır, çünkü <code>bootcmd</code> her açılışta yeniden genişletilir</li>
<li data-dogru>Eski adres kullanılmaya devam eder, çünkü çift tırnak içindeki ifade <code>setenv</code> anında genişletilmiştir</li>
<li>U-Boot hata verir ve açılmaz</li>
<li><code>bootcmd</code> boş kalır</li>
</ul>
<p class="quiz-aciklama">hush, çift tırnak içindeki <code>${...}</code> ifadelerini komut ayrıştırılırken genişletir. Genişletmenin <code>run</code> anına bırakılması için değer tek tırnakla yazılmalıdır.</p>
</div>

<div class="quiz" data-id="b02-2">
<p class="quiz-soru">Linux'ta <code>fw_printenv</code> her seferinde <code>Bad CRC, using default environment</code> uyarısı vermekte, U-Boot ise kaydedilen değerleri doğru okumaktadır. En olası neden nedir?</p>
<ul>
<li>U-Boot ortamı şifrelenmiştir</li>
<li data-dogru><code>/etc/fw_env.config</code> içindeki aygıt, konum veya boyut U-Boot'un <code>CONFIG_ENV_*</code> değerleriyle uyuşmamaktadır</li>
<li><code>fw_printenv</code> yalnızca x86'da çalışır</li>
<li>Ortamda çok fazla değişken vardır</li>
</ul>
<p class="quiz-aciklama">CRC, belirtilen konum ve boyuttaki blok üzerinden hesaplanır. Konum veya boyut farklıysa araç yanlış bir bölgeyi okur. Bu durumda <code>fw_setenv</code> çalıştırmak başka verilerin üzerine yazabilir.</p>
</div>

<div class="quiz" data-id="b02-3">
<p class="quiz-soru">Standart önyükleme (<code>bootflow scan</code>) bir bölümde hangi dosyaları arar?</p>
<ul>
<li>Yalnızca <code>uImage</code></li>
<li data-dogru>Etkin önyükleme yöntemlerine göre <code>/</code> ve <code>/boot/</code> öneklerinde <code>extlinux/extlinux.conf</code>, <code>boot.scr.uimg</code>/<code>boot.scr</code> ve EFI uygulamaları gibi dosyaları</li>
<li>Yalnızca bölümün kökündeki <code>Image</code> dosyasını</li>
<li>Hiçbir dosyayı; yalnızca <code>bootcmd</code> değişkenini çalıştırır</li>
</ul>
<p class="quiz-aciklama">Her <em>bootmeth</em> kendi dosyasını arar; varsayılan önekler <code>bootstd</code> düğümünde <code>filename-prefixes</code> ile değiştirilebilir. Bulunan her girdi bir <em>bootflow</em> olur.</p>
</div>

<div class="quiz" data-id="b02-4">
<p class="quiz-soru">Bir FIT imajı <code>0x40400000</code> adresine yüklenmiş ve <code>bootm</code> çalıştırılmıştır. FIT içindeki çekirdeğin <code>load</code> değeri de <code>0x40400000</code>'dır. Sorun nedir?</p>
<ul>
<li>Sorun yoktur; U-Boot çekirdeği yerinde çalıştırır</li>
<li data-dogru>Çekirdek FIT'in içinden aynı bölgeye kopyalanırken FIT'in kendisi ezilir; diğer parçalar (initramfs, dtb) bozulabilir</li>
<li>FIT imajları yalnızca <code>booti</code> ile başlatılabilir</li>
<li>U-Boot FIT dosyasını otomatik olarak başka adrese taşır</li>
</ul>
<p class="quiz-aciklama"><code>bootm</code> parçaları FIT'ten <code>load</code> adreslerine kopyalar. FIT dosyası, bu hedef bölgelerin dışında, örneğin <code>0x48000000</code> gibi bir adrese yüklenmelidir.</p>
</div>

<div class="quiz" data-id="b02-5">
<p class="quiz-soru">FIT yapılandırmaları imzalanmış ve açık anahtar U-Boot'a gömülmüştür, ancak yonganın güvenli önyüklemesi etkin değildir. Bu düzenin zayıf noktası nedir?</p>
<ul>
<li>FIT imzası sha256 kullandığı için kırılabilir</li>
<li>Çekirdek modülleri imzalanmamıştır</li>
<li data-dogru>Saldırgan U-Boot'u, imza denetimi yapmayan veya kendi anahtarını taşıyan bir U-Boot ile değiştirebilir; güven zincirinin kökü doğrulanmamaktadır</li>
<li>Aygıt ağacı imzalanamaz</li>
</ul>
<p class="quiz-aciklama">Her halka bir sonrakini doğrular; zincirin kökü Boot ROM'un U-Boot'u (veya SPL'yi) doğrulamasıdır. Bu adım yoksa sonraki imzalar yalnızca kazara değişikliğe karşı koruma sağlar.</p>
</div>

!!! alistirma "Alıştırma: A/B bölüm seçimi yapan önyükleme betiği"
    Ağ geçidinde iki kök bölüm bulunmaktadır: `vda2` (A) ve `vda3` (B). Güncelleme ajanı yeni sürümü
    pasif bölüme yazdıktan sonra Linux'tan `fw_setenv etkin B` komutunu çalıştırmaktadır.

    1. `etkin` değişkenine göre `root=` değerini seçen ve çekirdeği de ilgili bölümün `/boot/Image`
       dosyasından yükleyen bir `boot.cmd` yazın. `etkin` tanımlı değilse A kullanılmalıdır.
    2. Betiği `mkimage` ile paketleyip `mkimage -l` ile başlığını doğrulayın.
    3. Yeni sürüm açılamazsa eski bölüme dönülmesi için hangi ek mekanizmanın gerektiğini açıklayın.

    ??? success "Örnek çözüm"
        ```text
        if test "${etkin}" = "B"; then
            setenv kokbolum 3
        else
            setenv kokbolum 2
        fi
        echo "boot.scr: etkin=${etkin} -> vda${kokbolum}"
        setenv bootargs "console=ttyAMA0,115200 root=/dev/vda${kokbolum} rootfstype=ext4 rootwait ro"
        load virtio 0:${kokbolum} ${kernel_addr_r} /boot/Image
        booti ${kernel_addr_r} - ${fdt_addr}
        ```

        ```bash
        mkimage -A arm64 -O linux -T script -C none -n "ornekos A/B" -d boot.cmd boot.scr
        mkimage -l boot.scr
        ```

        `mkimage -l` çıktısında `Image Type: AArch64 Linux Script (uncompressed)` satırı görülür.
        Geri dönüş için bir **deneme sayacı** gerekir: güncelleme ajanı `fw_setenv yukseltme_deneme 1`
        yazar; betik her açılışta sayacı artırıp `saveenv` ile kaydeder ve sayaç bir sınırı aşarsa
        `etkin` değerini eski bölüme çevirir. Yeni sistem başarıyla açıldığında kullanıcı alanındaki bir
        servis sayacı sıfırlar. U-Boot'un `CONFIG_BOOTCOUNT_LIMIT` özelliği (`bootcount`, `bootlimit`,
        `altbootcmd` değişkenleri) bu mantığı hazır sunar; RAUC, SWUpdate ve Mender gibi güncelleme
        çerçeveleri de aynı yöntemi kullanır.

**Sonraki bölüm:** [3 · Çekirdek kaynak ağacı, Kconfig ve Kbuild →](03-cekirdek-derleme.md)
