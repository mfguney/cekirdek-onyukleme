# 5 · Çekirdek ile kullanıcı alanı arayüzleri: /proc, /sys, udev

<div class="kunye" markdown>
<span>Süre: ~55 dk + uygulama</span><span>Düzey: Orta</span><span>Ön koşul: Bölüm 1, 3 ve 4</span>
</div>

!!! hedef "Öğrenme hedefleri"
    Bu bölümün sonunda:

    - Kullanıcı alanı programlarının çekirdekle hangi yollardan iletişim kurduğunu sınıflandırabilirsiniz.
    - Bir sistem çağrısının ARM64'te nasıl yapıldığını açıklayabilir ve `strace` ile izleyebilirsiniz.
    - `/proc` ve `/sys` dosya sistemlerinin içeriğini ve kullanım amaçlarını ayırt edebilirsiniz.
    - Bir aygıtın sysfs'teki yerini, sürücüsünü ve özniteliklerini bulabilirsiniz.
    - uevent olaylarının udev veya mdev tarafından nasıl işlendiğini açıklayıp kural yazabilirsiniz.
    - `modprobe`'un `modules.dep` ve `modules.alias` ile modülleri nasıl bulduğunu açıklayabilirsiniz.
    - Sürücülerin ürün yazılımı (firmware) dosyalarını nereden yüklediğini açıklayabilirsiniz.

## 5.1 Çekirdek ile kullanıcı alanı arasındaki sınır

İşlemci, çekirdek kodunu ayrıcalıklı bir kipte (ARM64'te EL1), uygulamaları ise ayrıcalıksız kipte (EL0)
çalıştırır. Uygulamalar donanıma, çekirdek belleğine veya başka süreçlerin belleğine doğrudan erişemez;
bu tür her istek çekirdekten **istenir**. Bu istek yolları birkaç gruba ayrılır:

| Yol | Örnek | Tipik kullanım |
|---|---|---|
| Sistem çağrıları | `openat`, `read`, `write`, `ioctl`, `mmap` | Her türlü kaynak erişimi |
| Aygıt düğümleri (`/dev`) | `/dev/ttyAMA0`, `/dev/i2c-0`, `/dev/hwrng` | Sürücülere `read`/`write`/`ioctl` ile erişim |
| Sanal dosya sistemleri | `/proc`, `/sys`, `/sys/kernel/debug` | Durum bilgisi, yapılandırma, hata ayıklama |
| Netlink yuvaları | Ağ yapılandırması (`ip`), uevent olayları | Olay tabanlı ve yapısal iletişim |
| Diğer | `eventfd`, `inotify`, BPF, `io_uring` | Özel amaçlı arayüzler |

Bu arayüzlerin ortak özelliği **kararlılıktır**. Çekirdek geliştiricileri, kullanıcı alanına açılmış bir
davranışın sonraki sürümlerde bozulmaması ilkesini ("*we don't break user space*") sıkı biçimde uygular.
Çekirdeğin iç işlevleri her sürümde değişebilirken (ağaç dışı modüllerin her çekirdek sürümü için yeniden
derlenmesi bu yüzden gerekir), sistem çağrıları ve belgelenmiş sysfs öznitelikleri korunur. Kullanıcı
alanına açık tanımlar `include/uapi/` dizinindedir; kararlı sysfs arayüzleri
`Documentation/ABI/stable/` altında belgelenir.

## 5.2 Sistem çağrıları

Bir sistem çağrısı, uygulamanın çekirdeğe kontrollü bir geçiş yapmasıdır. ARM64'te C kütüphanesi çağrı
numarasını `x8` yazmacına, argümanları `x0`–`x5` yazmaçlarına koyar ve `svc #0` komutunu çalıştırır.
İşlemci EL1'e geçer, çekirdeğin istisna vektörü çağrıyı numarasına göre ilgili `sys_*` işlevine yönlendirir
ve sonuç `x0` yazmacıyla döner. Hata durumunda çekirdek negatif bir hata kodu döndürür; C kütüphanesi
bunu `-1` ve `errno` değerine çevirir.

Çağrı numaraları mimariye özgüdür. ARM64 ve RISC-V gibi yeni mimariler ortak tabloyu
(`include/uapi/asm-generic/unistd.h`) kullanır: `openat` 56, `read` 63, `write` 64, `exit_group` 94'tür.
x86-64'ün tablosu farklıdır ve eski `open` çağrısını da içerir. Bu nedenle sistem çağrılarını
numarayla doğrudan kullanan kod (ör. seccomp filtreleri) taşınabilir değildir.

Bir programın yaptığı sistem çağrıları **`strace`** ile izlenebilir. Aşağıdaki oturum, örnek
`sensor-oku` programının derleme makinesinde (x86-64) statik ve dinamik bağlanmış iki sürümünü izler:

<div class="terminal" data-oturum="strace-sistem-cagrisi"></div>

Dinamik bağlanmış sürümde ilk çağrıların çoğu, dinamik bağlayıcının `libc.so.6` dosyasını açıp belleğe
eşlemesine (`openat`, `mmap`) aittir; programın asıl işi tek bir `write` çağrısıdır. Gömülü sistemlerde
açılış süresini çözümlerken bu ayrım önemlidir: yüzlerce paylaşılan kütüphaneye bağlı bir programın
başlangıç maliyeti çoğu zaman kendi kodundan büyüktür. Bağlama türleri ve dinamik bağlayıcı
<a href="../../c-derleme/bolumler/02-elf-kutuphaneler.html">C, Make ve CMake kitabı, Bölüm 2</a>'de anlatılır.

## 5.3 `/proc`: süreçler ve çekirdek durumu

**procfs** (`/proc`), içeriği okunduğu anda çekirdek tarafından üretilen sanal bir dosya sistemidir.
Diskte karşılığı yoktur; dosya boyutları genellikle `0` görünür. İki tür bilgi içerir:

- **Süreç bilgisi:** Her süreç için bir `/proc/<pid>/` dizini: `cmdline`, `status` (bellek, durum,
  yetenekler), `maps` (bellek eşlemeleri), `fd/` (açık dosyalar), `environ`, `limits`. `/proc/self`,
  okuyan sürecin kendi dizinine bağlantıdır.
- **Sistem bilgisi:** `/proc/cmdline` (çekirdek komut satırı), `/proc/version`, `/proc/cpuinfo`,
  `/proc/meminfo`, `/proc/interrupts` (kesme sayaçları), `/proc/modules`, `/proc/mounts`,
  `/proc/config.gz` (`CONFIG_IKCONFIG_PROC` ile çekirdeğin yapılandırması).

**`/proc/sys/`** altındaki dosyalar ayarlanabilir çekirdek parametreleridir (*sysctl*). Örneğin
`/proc/sys/kernel/printk` konsol günlük düzeyini, `/proc/sys/kernel/panic` panik sonrası yeniden başlatma
süresini, `/proc/sys/kernel/hotplug` uevent yardımcı programını, `/proc/sys/net/ipv4/ip_forward` yönlendirmeyi
belirler. Kalıcı ayarlar `/etc/sysctl.conf` veya `/etc/sysctl.d/*.conf` dosyalarına yazılır ve açılışta
`sysctl -p` (systemd'de `systemd-sysctl.service`) ile uygulanır. Nokta ile yazılan ad, yolun karşılığıdır:
`kernel.panic` = `/proc/sys/kernel/panic`. 6.x çekirdeklerinde bu parametreler çekirdek komut satırına
`sysctl.kernel.panic=5` biçiminde de yazılabilir.

!!! iyi "Yeni sürücüler için `/proc` değil `/sys`"
    `/proc` tarihsel olarak her türlü bilgiyi barındırmıştır, ancak yeni sürücülerin buraya dosya eklemesi
    kabul görmez. Aygıt özellikleri sysfs özniteliği, hata ayıklama bilgisi debugfs dosyası, ayarlanabilir
    genel parametreler ise sysctl olarak sunulmalıdır.

## 5.4 `/sys`: aygıt modelinin görünümü

**sysfs** (`/sys`), çekirdeğin **aygıt modelini** (*driver model*) dizinler ve dosyalar olarak gösterir.
Çekirdekteki her `kobject` bir dizin, her özniteliği bir dosya, nesneler arasındaki ilişkiler sembolik
bağlantılardır. Temel kural, **bir dosyada tek bir değer** bulunmasıdır; bu sayede öznitelikler
betiklerden `cat` ve `echo` ile kullanılabilir.

| Yol | İçerik |
|---|---|
| `/sys/devices/` | Tüm aygıtların fiziksel bağlantı ağacı; aygıtların "gerçek" konumu |
| `/sys/bus/<veri yolu>/devices/`, `drivers/` | Veri yoluna (platform, amba, i2c, virtio …) göre aygıtlar ve sürücüler |
| `/sys/class/<sınıf>/` | İşlevine göre aygıtlar: `tty`, `net`, `rtc`, `leds`, `hwmon`, `block` |
| `/sys/module/<modül>/` | Yüklü modüller ve `parameters/` altında parametreleri |
| `/sys/firmware/devicetree/base/` | Çekirdeğin aldığı aygıt ağacı ([Bölüm 4](04-aygit-agaci.md)) |
| `/sys/kernel/debug/`, `/sys/kernel/tracing/` | debugfs ve tracefs bağlama noktaları ([Bölüm 8](08-cekirdek-hata-ayiklama.md)) |

`/sys/class` ve `/sys/bus` altındaki girdiler `/sys/devices` içindeki gerçek dizinlere işaret eden
bağlantılardır. Bir aygıt dizininde genellikle şunlar bulunur: `driver` (bağlı sürücüye bağlantı),
`subsystem`, `uevent` (olay değişkenleri), `of_node` (aygıt ağacı düğümüne bağlantı) ve sürücüye özgü
öznitelikler. Karakter ve blok aygıtlarında `dev` dosyası `major:minor` numarasını içerir.

Sürücü ile aygıt arasındaki bağlantı elle de değiştirilebilir: sürücünün dizinindeki `unbind` dosyasına
aygıt adı yazıldığında sürücü aygıttan ayrılır, `bind` dosyasına yazıldığında yeniden bağlanır. Bu
yöntem, sürücü geliştirmede modülü kaldırmadan `remove`/`probe` yollarını denemek için kullanılır.

Aşağıdaki oturum QEMU'daki örnek sistemde alınmıştır:

<div class="terminal" data-oturum="sysfs-gezinti"></div>

## 5.5 Aygıt düğümleri ve devtmpfs

Karakter ve blok aygıtlarına `/dev` altındaki **aygıt düğümleri** üzerinden erişilir. Bir düğüm; türü
(`c` veya `b`) ile **major** ve **minor** numaralarından oluşur. Major numara sürücüyü, minor numara o
sürücünün yönettiği aygıtlardan birini seçer: `ttyAMA0` için `204:64`, `vda` için `254:0` gibi. Dosyanın
adı önemli değildir; `mknod /tmp/konsol c 204 64` ile oluşturulan düğüm de aynı UART'ı açar.

Eskiden düğümler elle veya kurulumda statik olarak oluşturulurdu. Güncel sistemlerde **devtmpfs**
kullanılır: çekirdek her yeni aygıt için `/dev` altında düğümü kendisi, varsayılan adla ve izinlerle
oluşturur. Kullanıcı alanındaki aygıt yöneticisi (udev, mdev) bunun üzerine izinleri, sahipliği, kalıcı
adları (sembolik bağlantıları) ve olaylara bağlı eylemleri ekler. devtmpfs sayesinde aygıt yöneticisi
henüz çalışmadan önce de `/dev/console` ve kök aygıtı kullanılabilir ([Bölüm 1](01-onyukleme-zinciri.md)).

## 5.6 uevent: çekirdekten gelen olaylar

Bir aygıt eklendiğinde, kaldırıldığında veya durumu değiştiğinde çekirdek bir **uevent** olayı üretir
(`kobject_uevent()`, `lib/kobject_uevent.c`). Olay, `ANAHTAR=değer` biçiminde değişkenlerden oluşur:

```text
ACTION=add
DEVPATH=/devices/platform/a003c00.virtio_mmio/virtio1
SUBSYSTEM=virtio
MODALIAS=virtio:d00000004v554D4551
SEQNUM=<olay sıra numarası>
```

Karakter ve blok aygıtlarında `MAJOR`, `MINOR` ve `DEVNAME`, sürücüsü henüz yüklenmemiş aygıtlarda
**`MODALIAS`** değişkeni de bulunur. Olay kullanıcı alanına iki yoldan iletilir:

1. **Netlink:** `NETLINK_KOBJECT_UEVENT` yuvasını dinleyen tüm süreçlere (systemd-udevd, mdev'in
   daemon kipi). Güncel sistemlerde kullanılan yöntem budur.
2. **Yardımcı program:** `/proc/sys/kernel/hotplug` dosyasına yazılan program, her olay için değişkenler
   ortamında olacak biçimde çalıştırılır (`CONFIG_UEVENT_HELPER`). Her olayda yeni bir süreç
   oluşturduğu için yavaştır; yalnızca BusyBox mdev gibi çok küçük sistemlerde kullanılır. Örnek sistemin
   `rcS` betiği `echo /sbin/mdev > /proc/sys/kernel/hotplug` satırıyla bu yolu seçer.

Aygıt yöneticisi başlamadan önce oluşan olaylar kaçırılmıştır. Bu nedenle açılışta **soğuk tarama**
(*coldplug*) yapılır: `/sys` altındaki her aygıtın `uevent` dosyasına `add` yazılarak çekirdeğin olayları
yeniden üretmesi sağlanır. systemd'de bunu `systemd-udev-trigger.service` (`udevadm trigger`), BusyBox'ta
`mdev -s` yapar.

<div class="akis" data-senaryo="uevent-udev"></div>

## 5.7 udev kuralları

**udev** (systemd'de `systemd-udevd`), uevent olaylarını kurallara göre işler. Kurallar
`/usr/lib/udev/rules.d/` (paketler) ve `/etc/udev/rules.d/` (yerel ayarlar) dizinlerindeki `.rules`
dosyalarındadır; dosyalar adlarına göre sıralanır ve aynı adlı dosyada `/etc` önceliklidir. Her satır,
virgülle ayrılmış **eşleşme** (`==`, `!=`) ve **atama** (`=`, `+=`, `:=`) anahtarlarından oluşur:

```text title="examples/udev/99-ornek-sensor.rules"
# USB-seri dönüştürücüye bağlı sensör: kalıcı ad, izin ve grup; takıldığında
# systemd toplayıcı servisini başlatır
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", \
    SYMLINK+="sensor-uart", MODE="0660", GROUP="dialout", \
    TAG+="systemd", ENV{SYSTEMD_WANTS}+="sensor-toplayici.service"

# Ağ arayüzüne MAC adresine göre kalıcı ad
SUBSYSTEM=="net", ACTION=="add", ATTR{address}=="52:54:00:12:34:56", NAME="eth0"
```

| Anahtar | Anlamı |
|---|---|
| `KERNEL`, `SUBSYSTEM`, `DRIVER`, `ATTR{x}` | Olayın kendi aygıtında eşleşme |
| `KERNELS`, `SUBSYSTEMS`, `DRIVERS`, `ATTRS{x}` | Aygıtın **üst** aygıtlarından herhangi birinde eşleşme |
| `ENV{x}` | Olay değişkeni (okuma veya atama) |
| `SYMLINK`, `MODE`, `OWNER`, `GROUP` | Düğüme bağlantı, izin ve sahiplik |
| `NAME` | Yalnızca ağ arayüzlerini yeniden adlandırır; diğer aygıtlarda çekirdeğin verdiği ad korunur |
| `RUN+=` | Olay işlendikten sonra kısa bir program çalıştırır; uzun süren işler için uygun değildir |
| `TAG+="systemd"`, `ENV{SYSTEMD_WANTS}` | Aygıtı systemd'ye birim olarak tanıtır ve bir servisi başlatır |

Kural yazarken gereken öznitelikler `udevadm info -a /dev/ttyUSB0` ile görülür; çıktı aygıttan başlayıp
üst aygıtlara doğru her düzeyin özniteliklerini listeler. Bir kuralda `ATTRS{...}` anahtarlarının hepsi
**aynı** üst aygıttan gelmelidir. Olaylar `udevadm monitor --property` ile canlı izlenir, kural
dosyalarının sözdizimi ise `udevadm verify` ile denetlenir. Örnek kural dosyası bu ortamda bu komutla
denetlenmiştir.

!!! dikkat "`RUN+=` ile uzun süren iş başlatılmaz"
    udev, `RUN` ile başlatılan programı olay işlemenin parçası sayar ve bir süre sonra sonlandırır;
    program sonlanana kadar o aygıtın diğer olayları bekler. Uzun süren veya sürekli çalışması gereken
    işler `ENV{SYSTEMD_WANTS}` ile bir systemd servisine devredilmelidir ([Bölüm 6](06-init-systemd.md)).

**BusyBox mdev**, aynı işi çok daha basit bir kural diliyle yapar. Örnek sistemin `/etc/mdev.conf`
dosyası her satırda bir aygıt adı düzenli ifadesi, sahiplik, izin ve isteğe bağlı bir eylem içerir:

```text title="examples/udev/mdev.conf (kısaltılmış)"
ttyAMA[0-9]   root:root 660
vd[a-z][0-9]* root:root 660 >disk/%0
$MODALIAS=.*  root:root 660 @modprobe -q "$MODALIAS"
```

`>disk/%0` kuralı düğümü `/dev/disk/` altına taşıyıp eski adla bağlantı bırakır. `$MODALIAS=.*` satırı ise
düğümü olmayan olayları ortam değişkeniyle eşleştirir ve sürücüsü yüklenmemiş her aygıt için
`modprobe` çalıştırır; bir sonraki bölümün konusu budur. `mdev -s` yalnızca `/sys/class` ve `/sys/block`
altındaki aygıt düğümlerini tarar; düğümü olmayan aygıtların olayları için örnek `rcS` betiği soğuk
taramayı elle yapar: `for u in /sys/bus/*/devices/*/uevent; do echo add > "$u"; done`.

## 5.8 Modüllerin yüklenmesi: modprobe, modules.dep, modules.alias

Bir çekirdek modülü (`.ko`) en alt düzeyde `init_module`/`finit_module` sistem çağrısıyla yüklenir.
`insmod` bu çağrıyı doğrudan yapar; modülün bağımlılıklarını bilmez. **`modprobe`** ise modülü adıyla
veya bir takma adla (*alias*) bulur, önce bağımlılıklarını yükler ve `/etc/modprobe.d/` altındaki
seçenekleri uygular. Bu iş için `depmod` aracının `/lib/modules/<sürüm>/` altında ürettiği dizinleri
kullanır:

| Dosya | İçerik |
|---|---|
| `modules.dep` (+ `.bin`) | Her modülün yolu ve bağımlı olduğu modüller: `virtio-rng.ko: rng-core.ko` |
| `modules.alias` | Sürücülerin `MODULE_DEVICE_TABLE` ile bildirdiği eşleşme kalıpları → modül adı |
| `modules.softdep` | Yumuşak bağımlılıklar (`softdep` bildirimleri) |
| `modules.builtin` | Çekirdeğe gömülü olanlar; `modprobe` bunlar için hata vermez |
| `modules.devname` | Yüklendiğinde belirli bir `/dev` düğümü oluşturan modüller |

Bağımlılık, bir modülün başka bir modülün dışa aktardığı (`EXPORT_SYMBOL`) sembolleri kullanmasından
doğar; `depmod` bunu sembol tablolarından hesaplar. **Otomatik yükleme** ise şu zincirle gerçekleşir:

1. Bir veri yolu sürücüsü, aygıtın kimliğinden bir `MODALIAS` dizesi üretir
   (`virtio:d00000004v554D4551`: virtio aygıt türü 4, yani rastgele sayı üreteci).
2. uevent ile kullanıcı alanına gelen bu dize `modprobe` komutuna verilir.
3. `modprobe`, `modules.alias` içinde `alias virtio:d00000004v* virtio_rng` kalıbını bulur ve
   `modules.dep` ile önce `rng-core.ko`, sonra `virtio-rng.ko` yükler.

<div class="akis" data-senaryo="modprobe-zinciri"></div>

<div class="terminal" data-oturum="modprobe-uevent"></div>

Modül parametreleri yükleme sırasında (`modprobe ornek_bilgi kanal=8`), kalıcı olarak
`/etc/modprobe.d/*.conf` içinde (`options ornek_bilgi kanal=8`) veya gömülü modüller için çekirdek komut
satırında (`ornek_bilgi.kanal=8`) verilir. Çalışma anında `/sys/module/<modül>/parameters/` altında
görünürler; izinleri yazmaya açıksa buradan değiştirilebilirler. Bir modülün otomatik yüklenmesi
`blacklist <ad>` satırıyla engellenir, ancak bu satır `modprobe <ad>` ile yapılan doğrudan yüklemeyi
engellemez. systemd'de açılışta koşulsuz yüklenecek modüller `modules-load.d` dizinindeki dosyalarla
belirtilir.

## 5.9 Ürün yazılımı (firmware) yükleme

Pek çok aygıt (kablosuz ağ yongaları, Bluetooth, bazı sensörler ve DSP'ler) çalışmak için sürücünün
yüklediği bir ürün yazılımı dosyasına ihtiyaç duyar. Sürücü `request_firmware()` ile bir dosya adı ister;
çekirdeğin ürün yazılımı yükleyicisi dosyayı şu dizinlerde sırasıyla arar
(`drivers/base/firmware_loader/main.c`):

1. `firmware_class.path=` parametresiyle verilen dizin
2. `/lib/firmware/updates/<çekirdek sürümü>`
3. `/lib/firmware/updates`
4. `/lib/firmware/<çekirdek sürümü>`
5. `/lib/firmware`

Dosya bulunamazsa sürücüye `-ENOENT` (−2) döner; sürücü bu durumu kendi mantığına göre işler.
Örnek modül `ornek/kalibrasyon.bin` dosyasını ister ve dosya yoksa varsayılan değerlerle çalışmaya
devam eder. Dosya, sürücü çekirdeğe gömülüyken ve kök dosya sistemi henüz bağlanmamışken istenirse
bulunamaz; bu durumda dosya initramfs'e konmalı ya da `CONFIG_EXTRA_FIRMWARE` ile çekirdeğe gömülmelidir.

!!! sss "Ürün yazılımı dosyaları imaja nasıl girer?"
    Yocto'da `linux-firmware` tarifi her ürün yazılımını ayrı bir pakete böler (`linux-firmware-bcm43455`
    gibi). Yalnızca gereken paketler `MACHINE_EXTRA_RRECOMMENDS` veya imaj tarifiyle eklenmelidir; tüm
    paket yüzlerce megabayttır. Ürün yazılımlarının lisansları farklıdır ve `LICENSE_FLAGS` ile kabul
    gerektirebilir (<a href="../../yocto-gomulu-linux/bolumler/16-lisans-sbom.html">Yocto kitabı, Bölüm 16</a>).

!!! lab "Uygulama 5.1 · Bir aygıtın sysfs'ten izlenmesi ve modülün yüklenmesi"
    [Uygulama 1.1](01-onyukleme-zinciri.md)'deki sistem açılır ve `root` olarak oturum açılır.

    1. Rastgele sayı üretecinin otomatik yüklendiğini doğrulayın: `lsmod`, `cat /sys/class/misc/hw_random/rng_current`.
    2. Aygıtın sysfs yolunu bulun: `readlink -f /sys/bus/virtio/drivers/virtio_rng/virtio*`. Bu dizindeki
       `uevent` dosyasını okuyun ve `modalias` değerini `modules.alias` içinde arayın:
       `grep virtio:d00000004 /lib/modules/$(uname -r)/modules.alias`.
    3. Sürücüyü aygıttan ayırıp yeniden bağlayın:

        ```sh
        cd /sys/bus/virtio/drivers/virtio_rng
        ls                        # virtio1 gibi bir bağlantı görülür
        echo virtio1 > unbind
        cat /sys/class/misc/hw_random/rng_current
        echo virtio1 > bind
        ```

    4. Örnek modülü parametreyle yükleyin ve sonuçları inceleyin:

        ```sh
        modprobe ornek_bilgi kanal=8
        dmesg | tail -3
        cat /sys/module/ornek_bilgi/parameters/kanal
        ls -l /sys/bus/platform/devices/ornek-bilgi
        ```

    5. Ürün yazılımı dosyasının adını değiştirip (`mv /lib/firmware/ornek/kalibrasyon.bin /tmp/`) modülü
       yeniden yükleyin ve `dmesg` çıktısındaki hata kodunu yorumlayın.

## 5.10 Yocto'daki karşılıklar

| Konu | Yocto karşılığı |
|---|---|
| Aygıt yöneticisi seçimi | `VIRTUAL-RUNTIME_dev_manager`: systemd ile `systemd` (udevd), SysVinit ile `udev`, `mdev-busybox` ile `busybox-mdev`; `INIT_MANAGER` tarafından ayarlanır |
| udev kuralları | Tarifte `${nonarch_base_libdir}/udev/rules.d/` (genellikle `/usr/lib/udev/rules.d/`) altına kurulur |
| Modül paketleri | Her modül `kernel-module-<ad>` paketi olur; `depmod` imaj oluşturulurken çalıştırılır |
| Açılışta yükleme | `KERNEL_MODULE_AUTOLOAD += "ornek_bilgi"` → `modules-load.d` dosyası |
| Modül seçenekleri | `KERNEL_MODULE_PROBECONF` ve `module_conf_<ad>` → `modprobe.d` dosyası |
| Ürün yazılımı | `linux-firmware-*` paketleri; kurumun dosyaları için `${nonarch_base_libdir}/firmware` altına kuran bir tarif |
| sysctl ayarları | `/etc/sysctl.d/*.conf` dosyasını kuran bir tarif veya `procps` tarif eki |

`KERNEL_MODULE_AUTOLOAD` ve `KERNEL_MODULE_PROBECONF` kullanımı ile ağaç dışı modül tarifleri
<a href="../../yocto-gomulu-linux/bolumler/12-cekirdek.html">Yocto kitabı, Bölüm 12</a>'de örneklenmiştir.
`INIT_MANAGER` seçiminin aygıt yöneticisine etkisi
<a href="../../yocto-gomulu-linux/bolumler/11-distro.html">Yocto kitabı, Bölüm 11</a>'de anlatılır.

## Özet

- Kullanıcı alanı çekirdeğe sistem çağrıları, aygıt düğümleri, sanal dosya sistemleri ve netlink ile erişir; bu arayüzler sürümler arasında kararlı tutulur.
- ARM64'te sistem çağrısı `svc #0` ile yapılır; numara `x8`, argümanlar `x0`–`x5` yazmaçlarındadır. `strace` çağrıları izler.
- `/proc` süreç bilgisi ve sysctl parametrelerini, `/sys` aygıt modelini sunar. sysfs'te her dosya tek bir değer taşır; `/sys/devices` gerçek ağaç, `/sys/class` ve `/sys/bus` bağlantılardır.
- devtmpfs düğümleri çekirdekte oluşturur; udev/mdev izinleri, bağlantıları ve eylemleri ekler.
- uevent olayları netlink veya `/proc/sys/kernel/hotplug` yardımcısıyla iletilir; açılışta soğuk tarama ile yeniden üretilir.
- udev kuralları eşleşme ve atama anahtarlarından oluşur; `ATTRS` üst aygıtlarda arar, `NAME` yalnızca ağ arayüzlerinde geçerlidir, uzun işler systemd'ye devredilir.
- `modprobe`, `MODALIAS` dizesini `modules.alias` ile modül adına, `modules.dep` ile bağımlılık sırasına çevirir.
- `request_firmware()` dosyaları `/lib/firmware` altındaki belirli dizinlerde arar; erken açılışta gereken ürün yazılımı initramfs'e veya çekirdeğe konmalıdır.

## Değerlendirme soruları

<div class="quiz" data-id="b05-1">
<p class="quiz-soru">Bir udev kuralında <code>KERNEL=="ttyUSB*", NAME="sensor"</code> yazılmıştır. Sonuç ne olur?</p>
<ul>
<li>Aygıt <code>/dev/sensor</code> adıyla oluşturulur</li>
<li data-dogru>Ağ arayüzü olmayan aygıtlarda <code>NAME</code> uygulanmaz; doğru yöntem <code>SYMLINK+="sensor"</code> ile bağlantı oluşturmaktır</li>
<li>udev kuralı sözdizimi hatası nedeniyle tüm dosyayı yok sayar</li>
<li>Çekirdek aygıtı yeniden adlandırır</li>
</ul>
<p class="quiz-aciklama">Karakter ve blok aygıtlarının adını devtmpfs aracılığıyla çekirdek belirler. udev yalnızca ağ arayüzlerini yeniden adlandırabilir; diğer aygıtlar için kalıcı ad sembolik bağlantıyla sağlanır.</p>
</div>

<div class="quiz" data-id="b05-2">
<p class="quiz-soru"><code>insmod virtio-rng.ko</code> komutu <code>Unknown symbol in module</code> hatası vermektedir. <code>modprobe virtio_rng</code> ise başarılıdır. Neden?</p>
<ul>
<li><code>insmod</code> yalnızca çekirdeğe gömülü modülleri yükleyebilir</li>
<li data-dogru><code>virtio-rng</code>, <code>rng-core</code> modülünün sembollerini kullanır; <code>modprobe</code> <code>modules.dep</code> ile önce bağımlılığı yükler, <code>insmod</code> yüklemez</li>
<li><code>modprobe</code> imza denetimini atlar</li>
<li>Modül dosya adındaki tire nedeniyle <code>insmod</code> dosyayı bulamaz</li>
</ul>
<p class="quiz-aciklama"><code>insmod</code> tek bir dosyayı yükler. <code>modprobe</code>, <code>depmod</code>'un ürettiği <code>modules.dep</code> dosyasındaki <code>virtio-rng.ko: rng-core.ko</code> satırına göre sıralı yükleme yapar.</p>
</div>

<div class="quiz" data-id="b05-3">
<p class="quiz-soru">Bir sürücü <code>request_firmware(&amp;fw, "ornek/kalibrasyon.bin", dev)</code> çağrısında −2 döndürmektedir. Dosya kök dosya sisteminde <code>/lib/firmware/ornek/kalibrasyon.bin</code> olarak bulunmaktadır ve sürücü çekirdeğe gömülüdür. En olası açıklama nedir?</p>
<ul>
<li>Dosyanın izinleri 0644'tür</li>
<li data-dogru>Sürücü, kök dosya sistemi bağlanmadan önce yoklanmış ve dosyayı istemiştir; o anda <code>/lib/firmware</code> erişilebilir değildir</li>
<li>Dosya adı alt dizin içeremez</li>
<li><code>request_firmware</code> yalnızca modüllerden çağrılabilir</li>
</ul>
<p class="quiz-aciklama">Gömülü sürücüler initcall aşamasında yoklanır. Ürün yazılımı bu durumda initramfs'e veya <code>CONFIG_EXTRA_FIRMWARE</code> ile çekirdeğe konmalı ya da sürücü modül olarak derlenmelidir.</p>
</div>

<div class="quiz" data-id="b05-4">
<p class="quiz-soru">udev ile çalışan bir sistemde açılış sırasında oluşan aygıt olayları, udevd başlamadan önce üretildiği halde aygıtlar nasıl işlenir?</p>
<ul>
<li>Çekirdek olayları udevd başlayana kadar netlink kuyruğunda süresiz saklar</li>
<li data-dogru><code>udevadm trigger</code> her aygıtın <code>uevent</code> dosyasına <code>add</code> yazarak olayları yeniden ürettirir (soğuk tarama)</li>
<li>Olaylar kaybolur; aygıtlar yalnızca yeniden takıldığında işlenir</li>
<li>initramfs olayları bir dosyaya kaydeder</li>
</ul>
<p class="quiz-aciklama">Soğuk tarama (<em>coldplug</em>) systemd'de <code>systemd-udev-trigger.service</code>, BusyBox'ta <code>mdev -s</code> ile yapılır.</p>
</div>

<div class="quiz" data-id="b05-5">
<p class="quiz-soru">sysfs'teki <code>/sys/class/tty/ttyAMA0</code> girdisi için hangisi doğrudur?</p>
<ul>
<li>Aygıtın asıl dizinidir; diğer yollar ona bağlantıdır</li>
<li data-dogru><code>/sys/devices/...</code> altındaki gerçek aygıt dizinine işaret eden bir sembolik bağlantıdır</li>
<li>Diskte saklanan bir yapılandırma dosyasıdır</li>
<li>Yalnızca udev çalışırken bulunur</li>
</ul>
<p class="quiz-aciklama">sysfs'te aygıtların gerçek konumu fiziksel bağlantı ağacını yansıtan <code>/sys/devices</code> altıdır. <code>/sys/class</code> ve <code>/sys/bus</code> işlev ve veri yoluna göre gruplayan bağlantılar içerir.</p>
</div>

!!! alistirma "Alıştırma: Sensör UART'ı için kalıcı ad ve servis"
    Ağ geçidine USB üzerinden bir sensör bağlanmaktadır. Sensörün dönüştürücüsü FTDI FT232R'dir
    (`idVendor` 0403, `idProduct` 6001) ve seri numarası `ORNEK001`'dir. Sahada aynı türden ikinci bir
    dönüştürücü (bir modem) de bulunabilir.

    1. Yalnızca seri numarası `ORNEK001` olan dönüştürücü için `/dev/sensor-uart` bağlantısı oluşturan,
       `dialout` grubuna 0660 izni veren bir udev kuralı yazın.
    2. Kuralın sözdizimini `udevadm verify` ile denetleyin.
    3. Hangi özniteliklerin hangi üst aygıtta bulunduğunu belirlemek için gerçek donanımda hangi komutun
       kullanılacağını ve neden `ATTRS` kullanıldığını açıklayın.

    ??? success "Örnek çözüm"
        ```text
        SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6001", \
            ATTRS{serial}=="ORNEK001", SYMLINK+="sensor-uart", MODE="0660", GROUP="dialout"
        ```

        ```bash
        udevadm verify 98-sensor-uart.rules
        udevadm info -a -n /dev/ttyUSB0
        ```

        `udevadm info -a` çıktısı `ttyUSB0` aygıtından başlar ve üst aygıtlara (USB-seri dönüştürücü
        arayüzü, USB aygıtı, USB denetleyicisi) doğru her düzeyin özniteliklerini listeler. `idVendor`,
        `idProduct` ve `serial` öznitelikleri `tty` aygıtının kendisinde değil, **USB aygıtı** düzeyinde
        bulunur; bu nedenle `ATTR` yerine üst aygıtlarda arayan `ATTRS` kullanılır. Üç `ATTRS` anahtarı
        aynı üst aygıtta (USB aygıtı) eşleştiği için kural geçerlidir. Seri numarası eşleşmesi, aynı
        modelden ikinci bir dönüştürücünün yanlışlıkla `/dev/sensor-uart` olarak görülmesini önler.

**Sonraki bölüm:** [6 · init sistemleri ve systemd →](06-init-systemd.md)
