# 7 · Seri konsol, ağ ve uzaktan erişim

<div class="kunye" markdown>
<span>Süre: ~50 dk + uygulama</span><span>Düzey: Orta</span><span>Ön koşul: Bölüm 2, 5 ve 6</span>
</div>

!!! hedef "Öğrenme hedefleri"
    Bu bölümün sonunda:

    - Seri konsolun donanım ve yazılım katmanlarını, `console=` ve `earlycon` parametrelerini açıklayabilirsiniz.
    - Konsolda oturum açma isteminin (getty) BusyBox init ve systemd'de nasıl başlatıldığını açıklayabilirsiniz.
    - Ağ arayüzlerini iproute2, BusyBox `udhcpc` ve systemd-networkd ile yapılandırabilirsiniz.
    - Gömülü sistemlerde SSH sunucusu seçimini ve anahtar yönetimini değerlendirebilirsiniz.
    - Çekirdeği TFTP ile, kök dosya sistemini NFS ile ağdan yükleyen bir geliştirme düzeni kurabilirsiniz.
    - RTC, sistem saati ve NTP arasındaki ilişkiyi açıklayabilirsiniz.

## 7.1 Seri konsol

Ekransız bir ağ geçidinin geliştirme ve arıza tespiti sürecindeki en temel erişim yolu **seri konsoldur**
(UART). Seri konsol; önyükleyiciden çekirdeğe ve kullanıcı alanına kadar zincirin tüm halkalarında, ağ
yapılandırılmadan ve hiçbir servis çalışmadan önce de kullanılabilir. Çekirdek panik iletileri de
çoğunlukla yalnızca burada görülür.

**Donanım katmanı.** Kart üzerindeki UART uçları genellikle 3,3 V (bazı kartlarda 1,8 V) TTL düzeyindedir;
RS-232 düzeyindeki (±12 V) bir bağlantı doğrudan bağlanırsa yonga zarar görebilir. Geliştirme makinesine
bağlantı bir USB-seri dönüştürücüyle yapılır ve dönüştürücü Linux'ta `/dev/ttyUSB0` veya `/dev/ttyACM0`
olarak görünür. Bağlantı yalnızca TX, RX ve GND uçlarını gerektirir; TX ve RX çapraz bağlanır. Yaygın
ayar **115200 8N1**'dir (115200 baud, 8 veri biti, eşlik yok, 1 durma biti).

**Geliştirme makinesi.** Terminal programı olarak `picocom`, `minicom`, `tio` veya `screen` kullanılabilir:

```bash
picocom -b 115200 /dev/ttyUSB0          # çıkış: Ctrl+A ardından Ctrl+X
```

Kullanıcı `dialout` grubunda değilse `/dev/ttyUSB0` açılamaz (`Permission denied`); kalıcı ad ve izin
için [Bölüm 5](05-kullanici-alani-arayuzleri.md)'teki udev kuralları kullanılabilir.

**Çekirdek katmanı.** Çekirdek, iletilerini `console=` parametresiyle belirtilen konsollara yazar:

| Parametre | Anlamı |
|---|---|
| `console=ttyAMA0,115200` | PL011 UART'ın ilk örneği, 115200 baud |
| `console=ttyS0,115200n8` | 8250/16550 uyumlu UART (x86 ve pek çok ARM yongası) |
| `console=tty0 console=ttyAMA0` | Birden fazla konsol; `/dev/console` **sonuncuya** bağlanır |
| `earlycon` / `earlycon=pl011,0x9000000` | Sürücüler yüklenmeden önceki en erken iletiler için basit konsol; adres verilmezse `/chosen/stdout-path` kullanılır |

`console=` verilmediğinde ARM sistemlerde aygıt ağacının `/chosen/stdout-path` özelliği kullanılır
([Bölüm 4](04-aygit-agaci.md)). Çekirdek, `Starting kernel ...` iletisinden sonra hiçbir şey
yazmıyorsa önce `earlycon` eklenmelidir: bu durumda sorun genellikle çekirdeğin çok erken bir aşamasında
(bellek düzeni, aygıt ağacı adresi) ya da konsol sürücüsünün çekirdekte bulunmamasıdır.

### Oturum açma istemi: getty

Çekirdeğin konsola ileti yazması, o konsolda oturum açılabileceği anlamına gelmez. Oturum açma istemini
kullanıcı alanında **getty** sunar: terminali açar, hızını ayarlar, `login:` istemini yazar ve kullanıcı
adını aldıktan sonra yerini `login` programına bırakır. BusyBox init'te bu `inittab` içindeki
`ttyAMA0::respawn:/sbin/getty -L 115200 ttyAMA0 vt100` satırıyla yapılır ([Bölüm 6](06-init-systemd.md)).

systemd'de `systemd-getty-generator`, çekirdek komut satırındaki `console=` değerlerinden ve
`/sys/class/tty/console/active` dosyasından konsolu bulur ve `serial-getty@ttyAMA0.service` birimini
kendiliğinden etkinleştirir. Yocto'da makine dosyasındaki `SERIAL_CONSOLES = "115200;ttyAMA0"` değeri,
imaja bu konsol için getty'nin kurulmasını sağlar (systemd'de `systemd-serialgetty`, SysVinit'te
`inittab` satırı).

!!! dikkat "Üretim cihazında açık seri konsol"
    Parolasız `root` oturumu açan bir seri konsol, kartın kapağını açabilen herkese tam erişim verir.
    Üretim imajında getty kaldırılmalı veya parola zorunlu olmalı, U-Boot'un otomatik önyüklemeyi
    durdurma özelliği kapatılmalı ([Bölüm 2](02-u-boot.md)) ve gerekiyorsa çekirdek iletileri
    `quiet` ile azaltılmalıdır. Yocto'da `debug-tweaks` ve `allow-empty-password` gibi imaj özellikleri
    yalnızca geliştirme imajlarında kullanılmalıdır.

## 7.2 Ağ yapılandırması

Linux'ta ağ yapılandırmasının çekirdek tarafı netlink yuvaları üzerinden yapılır. Kullanıcı alanında
bunun için farklı katmanlar bulunur:

| Araç | Kullanım |
|---|---|
| **iproute2** (`ip`) | Arayüz, adres, yol ve komşu tablolarını doğrudan yönetir; eski `ifconfig`/`route` araçlarının yerini almıştır |
| BusyBox `ip`, `udhcpc` | iproute2'nin küçük bir alt kümesi ve DHCP istemcisi; `udhcpc` adresi bir olay betiğiyle uygular |
| **systemd-networkd** | `.network`, `.netdev`, `.link` dosyalarıyla bildirimsel yapılandırma; ekransız ürünler için uygundur |
| NetworkManager, ConnMan | Kablosuz ağ, mobil bağlantı ve kullanıcı etkileşimi gereken cihazlar |
| Çekirdek `ip=` parametresi | Kullanıcı alanı başlamadan çekirdeğin kendisinin adres alması (NFS kök için) |

iproute2 ile elle yapılandırma:

```bash
ip link set eth0 up
ip addr add 192.168.10.20/24 dev eth0
ip route add default via 192.168.10.1
ip -br addr                      # kısa özet (iproute2; BusyBox ip desteklemez)
ip route get 8.8.8.8             # bir hedefe hangi yoldan gidileceği
```

Bu komutlar kalıcı değildir; yeniden başlatmada kaybolur. Kalıcı yapılandırma, kullanılan ağ
yöneticisinin dosyalarıyla yapılır. Örnek sistemin `rcS` betiği BusyBox `udhcpc` ile adres alır;
`udhcpc`, sunucudan gelen değerleri `ip`, `router`, `dns` gibi ortam değişkenleriyle
`examples/initramfs/udhcpc.script` betiğine iletir ve betik bunları `ip` komutlarıyla uygular.
systemd kullanan ÖrnekOS'ta aynı iş tek bir dosyayla yapılır:

```ini title="examples/systemd/10-eth0.network"
[Match]
Name=eth0

[Network]
DHCP=ipv4
#Address=192.168.10.20/24
#Gateway=192.168.10.1
NTP=pool.ntp.org

[DHCPv4]
UseHostname=no
```

`.network` dosyaları adlarına göre sıralanır ve bir arayüze **ilk eşleşen** dosya uygulanır. Aşağıdaki
oturum QEMU'daki örnek sistemde alınmıştır. QEMU'nun kullanıcı kipi ağı, `10.0.2.0/24` ağında bir DHCP
sunucusu (`10.0.2.2` ağ geçidi, `10.0.2.3` DNS) ve bir TFTP sunucusu sağlar:

<div class="terminal" data-oturum="ag-yapilandirma"></div>

!!! iyi "Arayüz adlarının kalıcılığı"
    Tek Ethernet arayüzü olan kartta `eth0` adı sorun çıkarmaz. Birden fazla arayüzde (ör. bir yerleşik
    ve bir USB Ethernet) sürücülerin yoklanma sırası değişebileceğinden adlar da değişebilir. Kalıcı ad
    udev kuralıyla (`NAME=`, MAC adresine göre) veya systemd'nin `.link` dosyalarıyla verilir. systemd'nin
    "öngörülebilir arayüz adları" (`enp1s0` gibi) da bu amaçla geliştirilmiştir.

## 7.3 SSH ile uzaktan erişim

Ürün sahaya çıktıktan sonra seri konsola erişim çoğu zaman mümkün değildir; bakım ve tanı **SSH** ile
yapılır. Gömülü sistemlerde iki sunucu yaygındır:

| | OpenSSH | Dropbear |
|---|---|---|
| Boyut | Birkaç MiB | Birkaç yüz KiB |
| Özellikler | Tam (SFTP alt sistemi, sertifikalar, ayrıntılı politika) | Temel (SCP; SFTP için ayrı bir sunucu gerekir) |
| Yocto imaj özelliği | `ssh-server-openssh` | `ssh-server-dropbear` |

İki konu özellikle dikkat ister:

- **Ana bilgisayar anahtarları** (*host keys*) ilk açılışta üretilir. Kök dosya sistemi salt okunursa
  anahtarlar her açılışta yeniden üretilir ve istemciler her seferinde "anahtar değişti" uyarısı verir.
  Anahtarlar kalıcı ve yazılabilir bir bölümde tutulmalıdır. Aynı imajdan üretilen cihazların aynı
  anahtarı paylaşmaması için anahtarlar imaja gömülmemelidir.
- **Kimlik doğrulama** parola yerine anahtarla yapılmalı, `root` ile parolalı giriş kapatılmalıdır
  (OpenSSH'ta `PermitRootLogin prohibit-password`, Dropbear'da `-w` ve `-s` seçenekleri).

Kitabın QEMU düzeninde `calistir.sh`, geliştirme makinesinin 2222 numaralı portunu konuğun 22 numaralı
portuna yönlendirir (`hostfwd=tcp::2222-:22`). BusyBox tabanlı örnek kök dosya sisteminde SSH sunucusu
bulunmadığından bu bağlantı ancak bir Yocto imajıyla (`ssh-server-dropbear` özelliği) denenebilir:

```bash
ssh -p 2222 root@localhost
```

## 7.4 Ağ üzerinden önyükleme: TFTP ve NFS

Çekirdek veya kullanıcı alanı geliştirilirken her değişiklikte SD kartı çıkarıp yeniden yazmak zaman
alır ve kartı aşındırır. **Ağ üzerinden önyükleme** bu döngüyü kısaltır:

- **TFTP**: U-Boot, çekirdeği ve aygıt ağacını geliştirme makinesindeki bir TFTP sunucusundan indirir.
  Yeni bir çekirdek denemek için dosyanın TFTP dizinine kopyalanması ve kartın yeniden başlatılması yeterlidir.
- **NFS kök dosya sistemi**: çekirdek, kök dosya sistemini geliştirme makinesindeki bir NFS paylaşımından
  bağlar. Geliştirme makinesinde paylaşılan dizine kopyalanan bir program, kartta anında kullanılabilir.

<div class="akis" data-senaryo="ag-onyukleme"></div>

**U-Boot tarafı.** U-Boot'un ağ komutları `ipaddr`, `serverip`, `netmask`, `gatewayip` ve `ethaddr`
değişkenlerini kullanır. `dhcp` bu değerleri DHCP sunucusundan alır; `autoload` değişkeni `no` değilse
`dhcp` ayrıca sunucunun bildirdiği dosyayı da indirmeye çalışır. Aşağıdaki oturum QEMU'nun yerleşik TFTP
sunucusuyla bu ortamda alınmıştır:

<div class="terminal" data-oturum="tftp-onyukleme"></div>

**Çekirdek tarafı (NFS kök).** Çekirdeğin NFS'ten kök bağlayabilmesi için `CONFIG_NFS_FS=y`,
`CONFIG_ROOT_NFS=y` ve `CONFIG_IP_PNP=y` (DHCP için `CONFIG_IP_PNP_DHCP=y`) seçenekleri çekirdeğe gömülü
olmalıdır; modül olarak derlenmeleri işe yaramaz, çünkü modüller kök dosya sistemi bağlandıktan sonra
yüklenebilir. Komut satırı:

```text
root=/dev/nfs nfsroot=192.168.10.1:/srv/nfs/agecidi,v3,tcp ip=dhcp rw
```

`ip=` parametresinin tam biçimi
`ip=<istemci-ip>:<sunucu-ip>:<ağ-geçidi>:<ağ-maskesi>:<ad>:<aygıt>:<otomatik>` şeklindedir
(`Documentation/admin-guide/nfs/nfsroot.rst`). `ip=dhcp` en sık kullanılan kısaltmadır. Çekirdek bu
durumda kullanıcı alanından önce adres alır ve açılış günlüğüne `IP-Config:` satırlarını yazar.

**Geliştirme makinesi tarafı.** Ubuntu'da bir TFTP ve NFS sunucusu şöyle kurulur:

```bash
sudo apt install tftpd-hpa nfs-kernel-server
sudo cp Image virt.dtb /srv/tftp/
sudo mkdir -p /srv/nfs/agecidi
sudo tar -C /srv/nfs/agecidi -xf ornek-image-ornek-agecidi.rootfs.tar.zst
echo '/srv/nfs/agecidi 192.168.10.0/24(rw,sync,no_subtree_check,no_root_squash)' | \
    sudo tee -a /etc/exports
sudo exportfs -ra
```

`no_root_squash`, cihazdaki `root` kullanıcısının sunucudaki dosyalara `root` olarak erişebilmesi
için gereklidir; bu nedenle NFS kök yalnızca yalıtılmış bir geliştirme ağında kullanılmalıdır. Yocto,
kök dosya sistemini `tar` biçiminde üretmek için `IMAGE_FSTYPES += "tar.zst"` ayarını, QEMU için de
`runqemu ... nfs` seçeneğini sunar.

!!! info "Bu bölümdeki NFS örneği hakkında"
    Kitabın QEMU çekirdeği NFS desteği olmadan derlenmiştir ve bu ortamda bir NFS sunucusu
    çalıştırılamamıştır. NFS ile ilgili komutlar ve parametreler çekirdek belgelerine dayanır;
    animasyondaki `IP-Config` ve `VFS: Mounted root (nfs filesystem)` iletileri çekirdek kaynağındaki
    `pr_info` metinlerinden alınmış temsilî çıktılardır.

## 7.5 Saat: RTC, sistem saati ve NTP

Linux'ta iki saat vardır:

- **Sistem saati**: çekirdeğin tuttuğu, `date` ile okunan saat. Güç kesildiğinde kaybolur.
- **Donanım saati (RTC)**: pille beslenen ayrı bir yonga veya SoC içindeki bir birim; `/dev/rtc0` olarak
  görünür ve `hwclock` ile okunur/yazılır.

`CONFIG_RTC_HCTOSYS` etkinse çekirdek açılışta sistem saatini RTC'den ayarlar; örnek sistemin açılış
günlüğündeki `rtc-pl031 9010000.pl031: setting system clock to ...` satırı bunu gösterir. Pek çok düşük
maliyetli kartta (Raspberry Pi dahil) pilli RTC bulunmaz; sistem 1970 yılından veya imajın derlendiği
tarihten başlar. Bu durum TLS sertifika doğrulamasını, günlük zaman damgalarını ve zamanlayıcıları
doğrudan etkiler.

Ağ üzerinden saat eşitlemesi için **NTP** istemcisi kullanılır:

| İstemci | Özellik |
|---|---|
| `systemd-timesyncd` | Yalnızca istemci (SNTP); küçük; son bilinen zamanı `/var/lib/systemd/timesync/clock` dosyasında saklar ve RTC'siz kartta saatin geriye gitmesini önler |
| `chrony` | Tam NTP; kesintili bağlantılarda ve hassas eşitlemede başarılı; sunucu da olabilir |
| BusyBox `ntpd` | Çok küçük; `ntpd -q -p pool.ntp.org` ile tek seferlik eşitleme |

!!! sss "Saat yanlışsa hangi belirtiler görülür?"
    HTTPS bağlantıları `certificate is not yet valid` hatasıyla reddedilir, paket yöneticisi imzaları
    doğrulanamaz, journald kayıtları yanlış sırada görünür ve `OnCalendar=` zamanlayıcıları beklenmedik
    anlarda tetiklenir. Ürün tasarımında saatin nereden geleceği (RTC, NTP, hücresel ağ, GNSS) erken
    belirlenmeli; RTC'siz ürünlerde açılışta saatin en az imaj derleme tarihine ayarlandığı
    doğrulanmalıdır.

!!! lab "Uygulama 7.1 · TFTP ile çekirdek yükleme"
    Çekirdek QEMU'nun TFTP dizinine kopyalanır ve U-Boot ile başlatılır:

    ```bash
    cp ~/agecidi/Image ~/agecidi/tftp/
    sh ~/cekirdek-onyukleme/examples/qemu/calistir.sh uboot ~/agecidi
    ```

    U-Boot konsolunda:

    ```text
    => setenv autoload no
    => dhcp
    => printenv ipaddr serverip
    => setenv serverip 10.0.2.2
    => tftpboot ${kernel_addr_r} Image
    => setenv bootargs console=ttyAMA0,115200 root=/dev/vda2 rootwait ro
    => booti ${kernel_addr_r} - ${fdt_addr}
    ```

    1. `tftpboot` çıktısındaki aktarım hızını ve `Bytes transferred` değerini `ls -l ~/agecidi/Image`
       ile karşılaştırın.
    2. Linux açıldıktan sonra `ip addr show eth0`, `ip route` ve `cat /etc/resolv.conf` ile `udhcpc`'nin
       yaptığı yapılandırmayı inceleyin. BusyBox'ın `ip` uygulaması iproute2'nin `-br` (kısa) çıktı
       seçeneğini desteklemez.
    3. `kok` değişkenini kullanan `agdan` değişkenini (`examples/u-boot/uboot-env.txt`) `run agdan`
       ile deneyin; bunun için ortamın `mkenvimage` ile `flash1.img` dosyasına yazılmış olması gerekir
       ([Bölüm 2](02-u-boot.md)).

## 7.6 Yocto'daki karşılıklar

| Konu | Yocto karşılığı |
|---|---|
| Konsol ve getty | `SERIAL_CONSOLES` (makine dosyası); systemd'de `systemd-serialgetty` |
| Ağ yöneticisi | `systemd-networkd` (systemd `PACKAGECONFIG` içinde `networkd`), `.network` dosyaları için bir tarif; alternatif olarak `networkmanager` veya `connman` |
| SSH | `IMAGE_FEATURES += "ssh-server-dropbear"` veya `"ssh-server-openssh"` |
| NTP | systemd'de `timesyncd` (`PACKAGECONFIG`), ya da `chrony` tarifi |
| NFS/TFTP ile geliştirme | `IMAGE_FSTYPES += "tar.zst"`; `runqemu ... nfs`; `KERNEL_IMAGETYPE` ile TFTP'ye konacak dosya |

Geliştirme ve ürün imajlarının ayrılması (SSH sunucusu ve hata ayıklama araçları yalnızca geliştirme
imajında) <a href="../../yocto-gomulu-linux/bolumler/09-imajlar.html">Yocto kitabı, Bölüm 9</a>'da, makinenin
seri konsol tanımı <a href="../../yocto-gomulu-linux/bolumler/10-makine-bsp.html">Bölüm 10</a>'da anlatılmıştır.

## Özet

- Seri konsol zincirin tüm halkalarında kullanılabilen en temel erişim yoludur; TTL gerilim düzeyine ve 115200 8N1 ayarına dikkat edilmelidir.
- `console=` çekirdeğin ileti yazacağı konsolları belirtir; `/dev/console` sonuncusuna bağlanır. `earlycon` sürücülerden önceki iletileri gösterir.
- Oturum açma istemini getty sunar; BusyBox'ta `inittab`, systemd'de `serial-getty@.service` ile başlatılır.
- `ip` komutları kalıcı değildir; kalıcı yapılandırma udhcpc betiği, systemd-networkd `.network` dosyaları veya bir ağ yöneticisiyle yapılır.
- SSH anahtarları cihaza özgü ve kalıcı olmalı, kimlik doğrulama anahtarla yapılmalıdır.
- TFTP çekirdeği, NFS kök dosya sistemini ağdan yükleyerek geliştirme döngüsünü kısaltır; NFS kök için ilgili çekirdek seçenekleri gömülü olmalıdır.
- Sistem saati RTC'den veya NTP'den gelir; RTC'siz ürünlerde saatin doğrulanması güvenlik açısından zorunludur.

## Değerlendirme soruları

<div class="quiz" data-id="b07-1">
<p class="quiz-soru">Çekirdek komut satırında <code>console=ttyAMA0,115200 console=tty0</code> yazılıdır. init sürecinin standart çıktısı (<code>/dev/console</code>) nereye bağlanır?</p>
<ul>
<li>Seri porta (<code>ttyAMA0</code>)</li>
<li data-dogru>Sonuncu konsola, yani <code>tty0</code>'a; çekirdek iletileri ise her ikisine yazılır</li>
<li>Hiçbirine</li>
<li>Rastgele birine</li>
</ul>
<p class="quiz-aciklama">Birden fazla <code>console=</code> verildiğinde çekirdek iletileri tümüne yazılır, ancak <code>/dev/console</code> son belirtilene bağlanır. Ekransız üründe seri konsol bu nedenle en sona yazılmalıdır.</p>
</div>

<div class="quiz" data-id="b07-2">
<p class="quiz-soru">NFS kök dosya sistemiyle açılması istenen bir çekirdekte <code>CONFIG_NFS_FS=m</code> ve <code>CONFIG_ROOT_NFS</code> seçeneği görünmemektedir. Sorun nedir?</p>
<ul>
<li>NFS kök yalnızca x86'da desteklenir</li>
<li data-dogru>NFS istemcisi modül olarak derlendiğinden kök dosya sistemi bağlanmadan önce yüklenemez; <code>ROOT_NFS</code> seçeneği de bu nedenle <code>NFS_FS=y</code> gerektirir</li>
<li>U-Boot NFS'i desteklemez</li>
<li><code>ip=dhcp</code> parametresi eksiktir</li>
</ul>
<p class="quiz-aciklama">Kök dosya sistemini bağlamak için gereken her şey (ağ sürücüsü, IP otomatik yapılandırması, NFS istemcisi) initramfs kullanılmıyorsa çekirdeğe gömülü olmalıdır.</p>
</div>

<div class="quiz" data-id="b07-3">
<p class="quiz-soru">Salt okunur kök dosya sistemiyle çalışan bir cihazda her yeniden başlatmadan sonra SSH istemcileri "host key changed" uyarısı vermektedir. Neden?</p>
<ul>
<li>SSH sunucusu her açılışta farklı bir port kullanmaktadır</li>
<li data-dogru>Ana bilgisayar anahtarları kalıcı bir yerde saklanamadığı için her açılışta yeniden üretilmektedir</li>
<li>İstemcinin <code>known_hosts</code> dosyası bozuktur</li>
<li>Dropbear anahtar desteklemez</li>
</ul>
<p class="quiz-aciklama">Anahtarlar ilk açılışta üretilir ve diske yazılmalıdır. Salt okunur kökte anahtar dizini kalıcı ve yazılabilir bir bölüme yönlendirilmelidir; anahtarların imaja gömülmesi ise tüm cihazların aynı anahtarı paylaşmasına yol açar.</p>
</div>

<div class="quiz" data-id="b07-4">
<p class="quiz-soru">U-Boot konsolunda <code>dhcp</code> komutu adres aldıktan sonra beklenmedik biçimde bir dosya indirmeye çalışmaktadır. Bunu önlemek için ne yapılır?</p>
<ul>
<li><code>setenv serverip 0.0.0.0</code></li>
<li data-dogru><code>setenv autoload no</code></li>
<li><code>setenv bootfile</code> değişkenine <code>Image</code> yazılır</li>
<li><code>dhcp</code> yerine <code>ping</code> kullanılır</li>
</ul>
<p class="quiz-aciklama"><code>autoload</code> değişkeni <code>no</code> değilse <code>dhcp</code> ve <code>bootp</code>, DHCP yanıtındaki dosyayı TFTP ile indirmeye çalışır. Yalnızca adres almak için <code>autoload=no</code> kullanılır.</p>
</div>

<div class="quiz" data-id="b07-5">
<p class="quiz-soru">Pilli RTC bulunmayan bir ağ geçidi açılışta HTTPS sunucusuna bağlanamamakta, hata <code>certificate is not yet valid</code> olmaktadır. En uygun çözüm hangisidir?</p>
<ul>
<li>Sertifika doğrulamasını kapatmak</li>
<li data-dogru>Saatin bir NTP istemcisiyle eşitlenmesini beklemek ve RTC'siz kartta son bilinen zamanı saklayan bir mekanizma (ör. systemd-timesyncd) kullanmak</li>
<li>Saati her açılışta elle ayarlamak</li>
<li>Sertifikanın geçerlilik başlangıcını 1970'e çekmek</li>
</ul>
<p class="quiz-aciklama">Sistem saati RTC olmadan 1970'ten veya derleme tarihinden başlar. Bağlantı gerektiren servisler saat eşitlemesinden sonra sıralanmalıdır (systemd'de <code>time-sync.target</code>).</p>
</div>

!!! alistirma "Alıştırma: Geliştirme için ağ önyükleme ortamı"
    Ofisteki geliştirme ağında (`192.168.10.0/24`) geliştirme makinesi `192.168.10.1` adresindedir.
    Ağ geçidi kartının her açılışta çekirdeği TFTP'den alması ve kök dosya sistemini
    `/srv/nfs/agecidi` paylaşımından bağlaması istenmektedir.

    1. U-Boot'ta bu işi yapan `nfsboot` adlı bir değişken tanımlayın ve `bootcmd` değerini bu değişkene
       yönlendirin. Değişkenler ortamdaki diğer değişkenleri tekrar kullanmalıdır.
    2. Çekirdek yapılandırma parçasına eklenmesi gereken seçenekleri yazın.
    3. Ürüne geçişte bu ayarların nasıl geri alınacağını açıklayın.

    ??? success "Örnek çözüm"
        ```text
        => setenv serverip 192.168.10.1
        => setenv nfskok 'root=/dev/nfs nfsroot=${serverip}:/srv/nfs/agecidi,v3,tcp ip=dhcp rw'
        => setenv nfsboot 'setenv autoload no; dhcp; tftpboot ${kernel_addr_r} Image; tftpboot ${fdt_addr_r} agecidi.dtb; setenv bootargs ${konsol} ${nfskok}; booti ${kernel_addr_r} - ${fdt_addr_r}'
        => setenv bootcmd 'run nfsboot'
        => saveenv
        ```

        Değişkenler **tek tırnakla** tanımlanmıştır; `${serverip}` ve `${konsol}` çalışma anında
        genişler. Gerçek kartta aygıt ağacı da TFTP'den alınır (`fdt_addr_r`); QEMU'da `fdt_addr`
        kullanılabilir. Çekirdek parçası:

        ```text
        CONFIG_NFS_FS=y
        CONFIG_NFS_V3=y
        CONFIG_ROOT_NFS=y
        CONFIG_IP_PNP=y
        CONFIG_IP_PNP_DHCP=y
        ```

        Ürüne geçişte `bootcmd` değerinin varsayılana dönmesi için `env default bootcmd` ve `saveenv`
        yeterlidir; üretimde ise ortam fabrikada `mkenvimage` ile sıfırdan yazılmalıdır. Çekirdek
        parçası yalnızca geliştirme yapılandırmasına eklenmeli, ürün çekirdeğine girmemelidir; NFS
        istemcisi ürün çekirdeğinde gereksiz bir saldırı yüzeyidir.

**Sonraki bölüm:** [8 · Çekirdek hata ayıklama →](08-cekirdek-hata-ayiklama.md)
