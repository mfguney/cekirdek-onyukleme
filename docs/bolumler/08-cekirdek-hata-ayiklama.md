# 8 · Çekirdek hata ayıklama: printk, dynamic debug, ftrace, kgdb

<div class="kunye" markdown>
<span>Süre: ~65 dk + uygulama</span><span>Düzey: Orta–İleri</span><span>Ön koşul: Bölüm 3 ve 5</span>
</div>

!!! hedef "Öğrenme hedefleri"
    Bu bölümün sonunda:

    - `printk` günlük düzeylerini, konsol düzeyini ve `dmesg` seçeneklerini doğru kullanabilirsiniz.
    - dynamic debug ile çekirdeği yeniden derlemeden `pr_debug` iletilerini açıp kapatabilirsiniz.
    - ftrace ile çekirdek işlevlerinin çağrı ağacını ve sürelerini yakalayabilirsiniz.
    - Bir oops raporunun bölümlerini okuyup hatalı satırı kaynak koduna kadar izleyebilirsiniz.
    - Panik davranışını (`panic`, `panic_on_oops`) ürün gereksinimlerine göre ayarlayabilirsiniz.
    - kdump ve kgdb'nin hangi durumlarda kullanıldığını açıklayabilirsiniz.
    - QEMU'nun gdb sunucusuyla çekirdeği ilk komutundan itibaren adım adım izleyebilirsiniz.

## 8.1 Çekirdekte hata ayıklamanın özellikleri

Kullanıcı alanındaki bir program durdurulduğunda sistemin geri kalanı çalışır. Çekirdek ise sistemin
kendisidir: onu durdurmak her şeyi durdurur, bekçi köpekleri tetiklenir, bağlantılar kopar. Bu nedenle çekirdek hata ayıklaması büyük ölçüde
**gözleme** dayanır: iletiler (`printk`), izleme (ftrace, tracepoint'ler) ve hata anında üretilen
raporlar (oops, panik, kdump). Etkileşimli hata ayıklama (kgdb, QEMU gdbstub) ise genellikle açılış
sorunları ve tekrarlanabilir hatalar için kullanılır.

Bu bölümün uygulamaları kitabın QEMU sisteminde yapılır. Çekirdek, `agecidi.config` parçasındaki
şu seçeneklerle derlenmiştir: `CONFIG_DYNAMIC_DEBUG`, `CONFIG_DEBUG_FS`, `CONFIG_FUNCTION_TRACER`,
`CONFIG_FUNCTION_GRAPH_TRACER`, `CONFIG_MAGIC_SYSRQ`, `CONFIG_KGDB`, `CONFIG_DEBUG_INFO_DWARF5` ve
`CONFIG_GDB_SCRIPTS`. Örnek modül `ornek_bilgi`, izlenecek ve bilerek çökertilecek işlevleri sağlar.

## 8.2 printk ve günlük düzeyleri

`printk()` çekirdeğin temel ileti işlevidir. İletiler bir **halka tamponuna** yazılır ve günlük düzeyi
konsol düzeyinden küçükse ayrıca konsollara gönderilir. Sekiz düzey vardır:

| Düzey | Makro | Kullanım |
|---|---|---|
| 0 | `KERN_EMERG` / `pr_emerg()` | Sistem kullanılamaz durumda |
| 1 | `KERN_ALERT` / `pr_alert()` | Hemen müdahale gerekir |
| 2 | `KERN_CRIT` / `pr_crit()` | Kritik durum |
| 3 | `KERN_ERR` / `pr_err()` | Hata |
| 4 | `KERN_WARNING` / `pr_warn()` | Uyarı |
| 5 | `KERN_NOTICE` / `pr_notice()` | Önemli, ancak olağan durum |
| 6 | `KERN_INFO` / `pr_info()` | Bilgi |
| 7 | `KERN_DEBUG` / `pr_debug()` | Hata ayıklama |

Sürücü kodunda `pr_*` yerine aygıt bilgisini de ekleyen `dev_err(dev, ...)`, `dev_info()`, `dev_dbg()`
kullanılması tercih edilir. Dosyanın başındaki `#define pr_fmt(fmt) KBUILD_MODNAME ": " fmt` satırı tüm
`pr_*` iletilerine modül adını önek olarak ekler; örnek modülün `ornek_bilgi: yüklendi, kanal=4`
iletisi bu yolla biçimlenir.

**`/proc/sys/kernel/printk`** dört değer içerir: konsol düzeyi, belirtilmemiş iletilerin varsayılan
düzeyi, en düşük konsol düzeyi ve açılıştaki varsayılan konsol düzeyi. Kitabın sisteminde değer
`7 4 1 7`'dir: 7'den küçük (yani `KERN_DEBUG` dışındaki) tüm iletiler konsola yazılır. Konsol düzeyi
şu yollarla değiştirilir:

| Yöntem | Etki |
|---|---|
| `loglevel=N` (komut satırı) | Açılıştan itibaren konsol düzeyi |
| `quiet` | `loglevel=4`: yalnızca uyarı ve üstü |
| `ignore_loglevel` | Düzeyden bağımsız tüm iletiler konsola |
| `dmesg -n N` veya `echo N > /proc/sys/kernel/printk` | Çalışma anında konsol düzeyi |

Konsol düzeyi yalnızca **konsola yazılanı** etkiler; halka tamponuna her ileti yazılır ve `dmesg` ile
okunabilir. Tamponun boyutu `CONFIG_LOG_BUF_SHIFT` ve `log_buf_len=` ile belirlenir; dolduğunda en eski
iletiler silinir. Kullanıcı alanı da `/dev/kmsg` dosyasına `<düzey>ileti` yazarak tampona ileti
ekleyebilir; bu yöntem açılış betiklerinin çıktısını çekirdek günlüğüyle aynı zaman çizelgesinde görmek
için kullanılır.

!!! dikkat "Yavaş seri konsol, yavaş sistem"
    115200 baud'luk bir UART saniyede yaklaşık 11 KB yazabilir. `loglevel=8` ile çok sayıda ileti üreten
    bir sürücü, açılışı saniyelerce uzatabilir ve zamanlamaya bağlı hataların davranışını değiştirebilir.
    Hata ayıklama sırasında iletiler tampona yazılıp konsol düzeyi düşük tutulmalı, tampon sonradan
    `dmesg` ile okunmalıdır. Ürün imajında `quiet` önerilir.

## 8.3 dynamic debug

`pr_debug()` ve `dev_dbg()` iletileri varsayılan olarak **derlenmez**: kaynak dosyada `DEBUG` makrosu
tanımlı değilse bu çağrılar boş ifadelere dönüşür. Her ileti için yeniden derleme yapmak yerine
**dynamic debug** (`CONFIG_DYNAMIC_DEBUG`) kullanılır: tüm `pr_debug` çağrıları derlenir, ancak
kapalı başlar ve çalışma anında tek tek açılabilir. Kapalı bir ileti, dallanma öngörüsüyle neredeyse
sıfır maliyetle atlanır.

Denetim dosyası `/proc/dynamic_debug/control`'dür (debugfs bağlıysa
`/sys/kernel/debug/dynamic_debug/control` de kullanılabilir). Her satır bir ileti noktasını gösterir:
`dosya:satır [modül]işlev =bayraklar "biçim"`. Bayraklar:

| Bayrak | Anlamı |
|---|---|
| `p` | İletiyi yazdır |
| `f` | İşlev adını ekle |
| `l` | Satır numarasını ekle |
| `m` | Modül adını ekle |
| `t` | İş parçacığı kimliğini ekle |
| `_` | Hiçbir bayrak yok (kapalı) |

Sorgular `module`, `file`, `func`, `line` ve `format` anahtarlarıyla yazılır:

```sh
echo 'module ornek_bilgi +p'                  > /proc/dynamic_debug/control
echo 'file drivers/net/virtio_net.c +p'       > /proc/dynamic_debug/control
echo 'func ornek_bilgi_oku +pfl'              > /proc/dynamic_debug/control
echo 'module ornek_bilgi format "okundu" -p'  > /proc/dynamic_debug/control
```

Açılış sırasında çalışan kod için ayarlar komut satırından verilir: `dyndbg="file virtio_blk.c +p"`
genel sorgu, `ornek_bilgi.dyndbg=+p` ise belirli bir modül içindir (modül sonradan yüklense bile
uygulanır).

<div class="terminal" data-oturum="dmesg-printk"></div>

## 8.4 ftrace

**ftrace**, çekirdeğin yerleşik izleme altyapısıdır. Arayüzü **tracefs** dosya sistemidir
(`/sys/kernel/tracing`). Temel kavramlar:

- **İzleyici** (*tracer*): `current_tracer` dosyasına yazılır. `function` her işlev girişini,
  `function_graph` giriş ve çıkışları süreleriyle birlikte çağrı ağacı olarak kaydeder; `nop` kapalıdır.
  Yapılandırmaya göre `irqsoff`, `wakeup` gibi gecikme izleyicileri de bulunabilir (`available_tracers`).
- **Filtreler**: `set_ftrace_filter` yalnızca belirtilen işlevlerin izlenmesini, `set_graph_function`
  yalnızca belirtilen işlevden başlayan çağrı ağaçlarının kaydedilmesini sağlar. İzlenebilir işlevlerin
  listesi `available_filter_functions` dosyasındadır.
- **Olaylar** (*events*): çekirdek koduna yerleştirilmiş sabit izleme noktaları (tracepoint):
  `events/sched/sched_switch/enable`, `events/irq/` gibi. İşlev izlemeye göre daha az ayrıntılı, ancak
  daha anlamlı ve daha ucuzdur.
- **Tampon**: her CPU için ayrı bir halka tamponu; `buffer_size_kb` ile boyutlandırılır,
  `tracing_on` ile durdurulup başlatılır. `trace` anlık görüntüyü, `trace_pipe` tüketen akışı verir.

Dinamik ftrace (`CONFIG_DYNAMIC_FTRACE`) etkin bir çekirdekte izlenebilir her işlevin başında birkaç
komutluk bir yer tutucu bulunur. İzleme kapalıyken bu yer tutucular `nop` komutlarıdır; bir işlev
izlenmeye başlandığında ftrace bu komutları çalışma anında izleme rutinine yapılan çağrılarla değiştirir.
İzleme kapalıyken maliyetin ihmal edilebilir düzeyde olması, ftrace'in ürün çekirdeklerinde de açık
bırakılabilmesini sağlar.

<div class="akis" data-senaryo="ftrace-yakalama"></div>

Aşağıdaki oturum, örnek modülün `okuma` parametresi okunduğunda çalışan işlevlerin izlenmesini gösterir:

<div class="terminal" data-oturum="ftrace-oturumu"></div>

!!! iyi "Derleyicinin ürettiği işlev adları"
    Derleyici iyileştirme sırasında bir işlevin özel kopyalarını üretebilir; bunlar `.constprop.0`,
    `.isra.0` veya `.part.0` sonekleriyle görünür. Bu durumda `echo ornek_esik_oku > set_ftrace_filter`
    eşleşmez ve yazma işlemi `Invalid argument` hatası verir. Filtrelemeden önce
    `grep <ad> available_filter_functions` ile gerçek ad denetlenmelidir; joker karakter de kullanılabilir
    (`ornek_*`). Kitabın modülü bu nedenle izlenecek işlevlerde `noinline` ve `noipa` özniteliklerini
    kullanır. İlk sürümünde bu öznitelikler yoktu ve işlev `ornek_bilgi_oku.constprop.0` adıyla görünüyordu.

**trace-cmd** ve onun grafik arayüzü **KernelShark**, tracefs ayarlarını kendisi yapan, tamponları ham
biçimde dosyaya kaydeden ve sonradan çözümleyen araçlardır. Yocto'da `trace-cmd` tarifi imaja eklenebilir
(`tools-profile` imaj özelliği). Kitabın BusyBox sisteminde bulunmadığından aşağıdaki kullanım temsilîdir:

```bash
trace-cmd record -p function_graph -g okuma_get cat /sys/module/ornek_bilgi/parameters/okuma
trace-cmd report | head
trace-cmd record -e sched_switch -e irq sleep 1     # olay tabanlı kayıt
```

## 8.5 Oops: çekirdeğin hata raporu

Çekirdek kodu geçersiz bir bellek erişimi yaptığında veya bir `BUG()` denetimi başarısız olduğunda
çekirdek bir **oops** raporu üretir, hatayı yapan süreci sonlandırır ve (yapılandırmaya göre) çalışmaya
devam eder. Aşağıdaki rapor, örnek modülün `cokert` parametresine `1` yazılarak bu ortamda üretilmiştir:

<div class="terminal" data-oturum="oops-okuma"></div>

Raporun okunması:

1. **Neden:** `Unable to handle kernel NULL pointer dereference at virtual address 0000000000000000`.
   Adres sıfıra yakınsa (ör. `0x10`) bu, NULL bir yapı işaretçisinin bir alanına erişildiği anlamına gelir;
   alanın ofseti adresin kendisidir.
2. **Donanım ayrıntısı:** `Mem abort info` ve `ESR` değerleri ARM64'e özgüdür; `DABT (current EL)` çekirdek
   kipinde bir veri erişim hatasını, `level 2 translation fault` sayfa tablosunda karşılığı olmayan bir
   adresi gösterir.
3. **Başlık:** `Internal error: Oops: 0000000096000006 [#1] SMP`. `[#1]` bu açılıştaki ilk oops'tur;
   ilk rapor her zaman en güvenilir olandır, sonrakiler ilk hatanın yan etkisi olabilir.
4. **Bağlam:** yüklü modüller (`ornek_bilgi(O)`: ağaç dışı), CPU, PID ve süreç adı (`Comm: sh`) ve
   **kirlilik** (*taint*) bayrakları. `O` ağaç dışı modül, `D` daha önce oops oluştuğunu, `P` özel lisanslı
   modül, `W` bir uyarı (`WARN`) üretildiğini gösterir. Topluluk, kirli çekirdeklerdeki hataları
   genellikle incelemez.
5. **Konum:** `pc : ornek_esik_oku+0x8/0x18 [ornek_bilgi]`: hata, 0x18 bayt uzunluğundaki işlevin
   0x8 ofsetindeki komuttadır. `işlev+ofset/boyut` biçimi kaynak satırına çevrilecek bilgidir.
   `lr` (dönüş adresi) çağıran işlevi gösterir: `cokert_set+0x30/0x40`.
6. **Yazmaçlar** ve **çağrı izi** (*call trace*): hatanın hangi yoldan geldiği. Örnekte çağrı,
   `write` sistem çağrısından sysfs ve modül parametre katmanından (`param_attr_store`) geçmiştir.
   `cokert_set` çağrı izinde görünmez: `ornek_esik_oku` yığında çerçeve kaydı oluşturmayan bir yaprak
   işlevdir ve geri iz çerçeve kayıtlarıyla çıkarıldığı için doğrudan çağıran yalnızca `lr` satırında
   görülür. `x0 : 0000000000000000` ise işleve NULL işaretçinin geçirildiğini doğrular.
7. **Code:** hatalı komutun çevresindeki makine kodu; parantez içindeki komut hatayı yapan komuttur.

Ofset, aynı derlemenin hata ayıklama bilgisi içeren dosyasıyla kaynak satırına çevrilir. Çekirdeğe gömülü
kod için `vmlinux`, modüller için `.ko` dosyası kullanılır:

```bash
cd ~/linux
scripts/faddr2line ~/cekirdek-onyukleme/examples/modul/ornek_bilgi.ko ornek_esik_oku+0x8/0x18
scripts/faddr2line ~/agecidi/cekirdek/vmlinux param_attr_store+0x70/0xe0
```

İyileştirilmiş kodda satır bilgisi bir iki satır kayabilir: bu örnekte `faddr2line` işlevin kapanış
satırını (60) gösterir, çünkü GCC değeri yükleyen komutu `return` ifadesinin dönüş noktasına bağlamıştır.
Gösterilen satırın çevresi her zaman birlikte okunmalıdır.

`scripts/decode_stacktrace.sh` ise raporun tamamını alıp her satıra dosya ve satır numarası ekler.
Bu araçların çalışması için [Bölüm 3](03-cekirdek-derleme.md)'te vurgulandığı gibi **aynı derlemeye ait**
`vmlinux` ve modül dosyalarının saklanmış olması gerekir.

!!! dikkat "Oops sonrasında sistem güvenilir değildir"
    Oops, hatayı yapan süreci sonlandırır, ancak o anda tutulan kilitler serbest bırakılmaz ve yarım
    kalan veri yapıları düzeltilmez. Kitabın uygulamasında oops'tan sonra `cokert` parametresine ikinci kez
    yazılmaya çalışıldığında komut hiç dönmemiştir: ilk oops modül parametrelerinin kilidini tutarken
    oluşmuş ve kilit hiç bırakılmamıştır. Bu nedenle oops sonrasında sistem yeniden başlatılmalı ve
    yalnızca **ilk** rapor incelenmelidir. Üretim sistemlerinde genellikle `panic_on_oops=1` tercih edilir.

## 8.6 Panik ve yeniden başlatma

**Panik** (*kernel panic*), çekirdeğin çalışmaya devam edemeyeceğine karar verdiği durumdur: init'in
sonlanması (`Attempted to kill init!`), kök dosya sisteminin bağlanamaması, kesme bağlamında oops veya
`panic_on_oops` etkinken herhangi bir oops. Panikten sonra ne olacağını şu ayarlar belirler:

| Ayar | Komut satırı | sysctl | Anlamı |
|---|---|---|---|
| Panik sonrası bekleme | `panic=5` | `kernel.panic` | N saniye sonra yeniden başlat; `0` sonsuza kadar bekle, negatif değer hemen başlat |
| Oops'ta panik | `oops=panic` | `kernel.panic_on_oops` | Her oops paniğe dönüşür |
| Uyarıda panik | `panic_on_warn=1` | `kernel.panic_on_warn` | `WARN()` da paniğe dönüşür (test ortamları) |
| Askıda kalan görev | — | `kernel.hung_task_panic` | `CONFIG_DETECT_HUNG_TASK` ile uzun süre bekleyen görevde panik |

Ekransız bir ağ geçidi için olağan seçim, `panic_on_oops=1` ve `panic=5` gibi kısa bir yeniden başlatma
süresidir: tutarsız durumda çalışmaya devam etmek yerine cihaz kendini yeniden başlatır. Donanım bekçi
köpeği, çekirdeğin tamamen kilitlendiği durumlara karşı ikinci bir güvencedir. Panik raporunun
kaybolmaması için ise **pstore/ramoops** (`CONFIG_PSTORE_RAM`) kullanılır: rapor, yeniden başlatmada
silinmeyen ayrılmış bir RAM bölgesine yazılır ve bir sonraki açılışta `/sys/fs/pstore/` altında okunur.

!!! sss "Aygıt ağacı hatası da panik üretir mi?"
    Evet. Kitabın FIT uygulaması hazırlanırken QEMU'nun aygıt ağacı U-Boot olmadan (`-bios` seçeneği
    verilmeden) dışa aktarılmış ve FIT'e konmuştur. Bu ağaçta U-Boot ile çalışan makinede bulunmayan bir
    PL061 GPIO birimi tanımlıydı. Çekirdek açılışta bu birimin kimlik yazmaçlarını okumaya çalıştı;
    `amba_read_periphid` işlevinde bir oops oluştu ve bu kod init'in bağlamında çalıştığı için sistem
    `Attempted to kill init! exitcode=0x0000000b` paniğiyle durdu. Çağrı izi
    `of_platform_default_populate_init` → `of_platform_populate` → `amba_device_add` →
    `amba_read_periphid` biçimindeydi ([Bölüm 4](04-aygit-agaci.md)). Aygıt ağacının donanımla birebir
    uyuşması, önyükleme hatalarının en sık görülen nedenlerinden biridir.

### Magic SysRq

**Magic SysRq**, sistem kilitlenmiş gibi göründüğünde bile çekirdeğe doğrudan komut göndermeyi sağlar.
`/proc/sysrq-trigger` dosyasına bir harf yazılarak veya seri konsolda *break* sinyalinin ardından harfe
basılarak kullanılır: `t` tüm görevlerin yığınlarını, `w` engellenmiş görevleri, `m` bellek durumunu,
`l` tüm CPU'ların geri izini yazdırır; `s` diskleri eşitler, `u` dosya sistemlerini salt okunur yapar,
`b` hemen yeniden başlatır, `c` bilerek çökertir (kdump denemeleri için). İzin verilen işlevler
`/proc/sys/kernel/sysrq` değeriyle sınırlanır.

## 8.7 kdump

**kdump**, panik anındaki belleğin tamamını sonradan incelemek için kaydeder. Açılışta `crashkernel=256M`
gibi bir parametreyle bellek ayrılır ve `kexec -p` ile bu bölgeye ikinci bir "yakalama çekirdeği"
yüklenir. Panik olduğunda çalışan çekirdek, ürün yazılımına dönmeden yakalama çekirdeğine geçer; bu
çekirdek eski belleği `/proc/vmcore` olarak sunar ve bir betik bu dosyayı diske veya ağa kaydeder.
Döküm daha sonra `crash` aracıyla, aynı derlemenin `vmlinux` dosyası kullanılarak incelenir.

kdump sunucu dağıtımlarında yaygındır, ancak gömülü sistemlerde uygulaması zordur: ayrılan bellek ürünün
kullanamayacağı bellektir, dökümü yazacak yer çoğu zaman yoktur ve yakalama çekirdeğinin de ayrıca
hazırlanması gerekir (`CONFIG_CRASH_DUMP`, `CONFIG_KEXEC`). Bu nedenle gömülü ürünlerde genellikle
pstore/ramoops ile yalnızca çekirdek günlüğünün son bölümünü saklamak tercih edilir.

## 8.8 kgdb ve QEMU gdbstub

**kgdb**, çekirdeğin içine yerleşik bir gdb sunucusudur. Seri konsol üzerinden (`kgdboc`) çalışır:

```text
kgdboc=ttyAMA0,115200 kgdbwait        # komut satırı: açılışta bağlantı bekle
echo g > /proc/sysrq-trigger          # çalışan sistemde hata ayıklayıcıya geç
```

Geliştirme makinesinde `gdb-multiarch vmlinux` çalıştırılıp `target remote /dev/ttyUSB0` ile bağlanılır.
Konsol ve gdb aynı UART'ı paylaştığından `agent-proxy` gibi bir araçla ayrılmaları gerekir. kgdb,
JTAG erişimi olmayan gerçek kartlarda değerlidir; ancak çekirdeğin kendisi çalışır durumda olmalıdır.
Çekirdek açılmadan önceki sorunlar için **JTAG** hata ayıklayıcıları (OpenOCD ile) veya geliştirme
aşamasında **QEMU** kullanılır.

QEMU'nun yerleşik gdb sunucusu çekirdekten bağımsızdır ve sistemi **ilk komuttan** itibaren durdurabilir:

| Seçenek | Anlamı |
|---|---|
| `-s` | 1234 numaralı TCP portunda gdb sunucusu (`-gdb tcp::1234` kısaltması) |
| `-S` | İşlemciyi başlatmadan bekle; gdb'den `continue` gelene kadar hiçbir komut çalışmaz |

Çekirdek `nokaslr` ile açılmalıdır; aksi halde çekirdek kendini rastgele bir adrese taşır ve `vmlinux`
içindeki sembol adresleri tutmaz (kitabın yapılandırmasında `CONFIG_RANDOMIZE_BASE` zaten kapalıdır).
`CONFIG_GDB_SCRIPTS` ile derlenen çekirdek, gdb'ye `lx-dmesg`, `lx-lsmod`, `lx-ps`, `lx-symbols` gibi
çekirdeğe özgü komutlar ekleyen `vmlinux-gdb.py` betiğini üretir (`make scripts_gdb`).

<div class="terminal" data-oturum="gdb-qemu"></div>

Oturumda dikkat çeken nokta, [Bölüm 1](01-onyukleme-zinciri.md)'de anlatılan ARM64 önyükleme
protokolünün doğrudan gözlenmesidir: çekirdeğin ilk komutunda `x0` yazmacı aygıt ağacının fiziksel
adresini taşır ve o adresteki ilk dört bayt FDT sihirli sayısıdır (`d0 0d fe ed`).

!!! lab "Uygulama 8.1 · Oops'un kaynak satırına kadar izlenmesi"
    QEMU sistemi açılır ve modül yüklenir:

    ```sh
    modprobe ornek_bilgi
    cat /proc/sys/kernel/tainted
    sh -c 'echo 1 > /sys/module/ornek_bilgi/parameters/cokert'
    cat /proc/sys/kernel/tainted
    ```

    1. Kirlilik değerinin `4096`'dan (yalnızca `O`, bit 12) `4224`'e (`O` + `D`, bit 7) değiştiğini
       doğrulayın.
    2. Rapordaki `pc` satırını not edin ve derleme makinesinde `scripts/faddr2line` ile kaynak satırını
       bulun. Gösterilen satırın (işlevin kapanışı) hemen öncesindeki `return d->esik;` ifadesinin hatalı
       erişim olduğunu, `x0` yazmacının değeriyle birlikte açıklayın.
    3. QEMU'yu kapatıp yeniden açın; bu kez önce `echo 1 > /proc/sys/kernel/panic_on_oops` ve
       `echo 5 > /proc/sys/kernel/panic` yazıp aynı komutu çalıştırın. `Kernel panic - not syncing` ve
       `Rebooting in 5 seconds..` iletilerini gözleyin.

!!! lab "Uygulama 8.2 · QEMU ile çekirdeğin ilk komutundan izlenmesi"
    İki terminal kullanılır. Birincisinde QEMU durdurulmuş olarak başlatılır:

    ```bash
    EKARGS=nokaslr sh ~/cekirdek-onyukleme/examples/qemu/calistir.sh gdb ~/agecidi
    ```

    İkincisinde gdb bağlanır:

    ```bash
    cd ~/agecidi/cekirdek
    gdb-multiarch vmlinux
    (gdb) target remote :1234
    (gdb) hbreak *0x40200000
    (gdb) continue
    (gdb) info registers x0
    (gdb) x/4xb $x0
    (gdb) hbreak start_kernel
    (gdb) continue
    (gdb) bt
    (gdb) add-auto-load-safe-path ~/linux/scripts/gdb
    (gdb) source vmlinux-gdb.py
    (gdb) hbreak kernel_init
    (gdb) continue
    (gdb) lx-dmesg
    ```

    1. `0x40200000`, QEMU'nun `-kernel` ile verilen `Image` dosyasını yüklediği adrestir; MMU henüz
       kapalı olduğundan fiziksel adresle donanım kesme noktası kullanılır.
    2. `start_kernel` noktasında MMU açılmıştır ve adres sanal adrestir (`0xffff8000…`). Yazılım kesme
       noktası (`break`) yerine `hbreak` kullanılmasının nedenini açıklayın.
    3. `lx-dmesg` çıktısının, konsolda o ana kadar görülen iletilerle aynı olduğunu doğrulayın.

## 8.9 Yocto'daki karşılıklar

| Konu | Yocto karşılığı |
|---|---|
| Hata ayıklama seçenekleri | Bir `.cfg` parçası (`examples/yocto/files/agecidi-hata-ayiklama.cfg`) ve tarif eki; yalnızca geliştirme yapılandırmasında |
| `vmlinux` ve modül sembolleri | `kernel-vmlinux` paketi; dağıtım dizininde `vmlinux` dosyası; `-dbg` paketleri |
| trace-cmd, perf | `IMAGE_FEATURES += "tools-profile"` veya `trace-cmd` tarifi |
| Hedefte gdb | `IMAGE_FEATURES += "tools-debug"`; uzaktan hata ayıklama için `gdbserver` |
| QEMU ile hata ayıklama | `runqemu ... qemuparams="-s -S"` ve SDK'daki `gdb` |
| pstore/ramoops | Çekirdek parçası (`CONFIG_PSTORE_RAM`) ve aygıt ağacında `reserved-memory` altında `ramoops` düğümü |

Hedef cihazda kullanıcı alanı hata ayıklama, `devtool` ve SDK ile çalışma
<a href="../../yocto-gomulu-linux/bolumler/14-hata-ayiklama.html">Yocto kitabı, Bölüm 14</a>'te; çekirdek
yapılandırma parçaları <a href="../../yocto-gomulu-linux/bolumler/12-cekirdek.html">Bölüm 12</a>'de
anlatılmıştır. Sürücü düzeyindeki hata ayıklama yöntemleri için
<a href="../../aygit-surucusu/index.html">Aygıt Sürücüsü kitabı</a> incelenebilir.

## Özet

- `printk` iletileri sekiz düzeylidir; konsol düzeyi yalnızca konsola yazılanı belirler, tüm iletiler halka tamponundadır ve `dmesg` ile okunur.
- dynamic debug, `pr_debug`/`dev_dbg` iletilerini çalışma anında `/proc/dynamic_debug/control` üzerinden modül, dosya, işlev veya satır düzeyinde açar; açılış için `dyndbg=` kullanılır.
- ftrace, tracefs üzerinden `function` ve `function_graph` izleyicileri, filtreler ve olaylar sunar; izleme kapalıyken maliyeti ihmal edilebilir düzeydedir.
- Oops raporunda neden, bağlam, kirlilik bayrakları, `pc`/`lr`, yazmaçlar ve çağrı izi bulunur; `işlev+ofset` aynı derlemenin `vmlinux`/`.ko` dosyasıyla `faddr2line` ile satıra çevrilir.
- Oops sonrasında sistem tutarsız olabilir; ürünlerde `panic_on_oops` ve `panic=N` ile kendini yeniden başlatma, pstore ile raporun saklanması önerilir.
- kdump tam bellek dökümü sağlar ama gömülüde maliyetlidir; kgdb seri konsol üzerinden çalışır; QEMU gdbstub (`-s -S`) çekirdeği ilk komuttan izlemeye olanak verir.

## Değerlendirme soruları

<div class="quiz" data-id="b08-1">
<p class="quiz-soru"><code>/proc/sys/kernel/printk</code> değeri <code>4 4 1 7</code>'dir. Bir sürücünün <code>pr_info()</code> iletisi nerede görülür?</p>
<ul>
<li>Hem konsolda hem <code>dmesg</code> çıktısında</li>
<li data-dogru>Konsolda görülmez, ancak <code>dmesg</code> çıktısında bulunur</li>
<li>Hiçbir yerde; ileti silinir</li>
<li>Yalnızca konsolda</li>
</ul>
<p class="quiz-aciklama">Konsol düzeyi 4 olduğunda yalnızca düzeyi 4'ten küçük iletiler (hata ve üstü) konsola yazılır. <code>pr_info</code> düzey 6'dır; halka tamponuna yine de yazılır.</p>
</div>

<div class="quiz" data-id="b08-2">
<p class="quiz-soru">Bir sürücüdeki <code>dev_dbg()</code> iletileri, çekirdek <code>CONFIG_DYNAMIC_DEBUG=y</code> ile derlendiği halde görülmemektedir. Yeniden derleme yapmadan iletileri görmek için ne yapılır?</p>
<ul>
<li><code>dmesg -n 8</code> yeterlidir</li>
<li data-dogru>İletinin noktası <code>/proc/dynamic_debug/control</code> dosyasına uygun bir sorguyla <code>+p</code> yazılarak açılır (gerekirse konsol düzeyi de 8 yapılır)</li>
<li>Kaynak dosyaya <code>#define DEBUG</code> eklenmelidir</li>
<li><code>CONFIG_DEBUG_KERNEL</code> açılmalıdır</li>
</ul>
<p class="quiz-aciklama">dynamic debug noktaları kapalı başlar. Açıldıklarında <code>KERN_DEBUG</code> düzeyinde yazılırlar; konsolda görmek için konsol düzeyinin 8 olması gerekir, <code>dmesg</code> ile her durumda görülürler.</p>
</div>

<div class="quiz" data-id="b08-3">
<p class="quiz-soru"><code>echo ornek_esik_oku &gt; set_ftrace_filter</code> komutu <code>Invalid argument</code> hatası vermektedir, ancak işlev kaynakta bulunmaktadır. En olası neden nedir?</p>
<ul>
<li>ftrace yalnızca çekirdeğe gömülü işlevleri izleyebilir</li>
<li data-dogru>Derleyici işlevi satır içine almış veya <code>.isra.0</code>/<code>.constprop.0</code> sonekli bir kopyasını üretmiştir; gerçek ad <code>available_filter_functions</code> içinde aranmalıdır</li>
<li>tracefs bağlı değildir</li>
<li>İşlev <code>static</code> olduğu için izlenemez</li>
</ul>
<p class="quiz-aciklama">Filtre yalnızca <code>available_filter_functions</code> listesindeki adları kabul eder. <code>static</code> işlevler izlenebilir; satır içine alınmış işlevler ise ayrı bir işlev olarak var olmadığı için izlenemez.</p>
</div>

<div class="quiz" data-id="b08-4">
<p class="quiz-soru">Bir oops raporunda <code>Tainted: G D O</code> görülmektedir. Bu raporla ilgili hangisi doğrudur?</p>
<ul>
<li>Rapor özel lisanslı bir modülden kaynaklanmaktadır</li>
<li data-dogru>Bu açılışta daha önce de bir oops oluşmuştur (<code>D</code>) ve ağaç dışı bir modül yüklüdür (<code>O</code>); asıl incelenmesi gereken ilk rapordur</li>
<li>Çekirdek hata ayıklama seçenekleriyle derlenmiştir</li>
<li>Rapor güvenilirdir, çünkü <code>G</code> tüm modüllerin GPL olduğunu gösterir</li>
</ul>
<p class="quiz-aciklama"><code>D</code> (die) bayrağı daha önce bir oops olduğunu gösterir. Sonraki raporlar ilk hatanın bıraktığı tutarsız durumdan kaynaklanabilir; <code>[#1]</code> numaralı rapor esas alınmalıdır.</p>
</div>

<div class="quiz" data-id="b08-5">
<p class="quiz-soru">QEMU ile çekirdek hata ayıklanırken <code>break start_kernel</code> yerine neden <code>hbreak start_kernel</code> önerilir?</p>
<ul>
<li><code>break</code> komutu ARM64'te desteklenmez</li>
<li data-dogru>Yazılım kesme noktası belleğe komut yazarak çalışır; çekirdek kendini kopyalarken, MMU açılırken veya kodu yeniden yazarken (ör. ftrace, alternatifler) bu değişiklik kaybolabilir. Donanım kesme noktası belleği değiştirmez</li>
<li><code>hbreak</code> daha fazla kesme noktası destekler</li>
<li><code>break</code> yalnızca kullanıcı alanında çalışır</li>
</ul>
<p class="quiz-aciklama">Açılışın erken aşamalarında kod ve eşlemeler değişir. Donanım kesme noktaları işlemcinin hata ayıklama yazmaçlarıyla çalıştığı için bu değişikliklerden etkilenmez; sayıları ise sınırlıdır.</p>
</div>

!!! alistirma "Alıştırma: Açılış sürücüsünün iletilerini ve süresini yakalamak"
    Ağ geçidinin açılışında virtio blok sürücüsünün ne kadar sürede yoklandığı ve hangi `dev_dbg`
    iletilerini ürettiği incelenmek istenmektedir. Çekirdek yeniden derlenmeyecektir.

    1. Sürücünün açılıştaki `pr_debug`/`dev_dbg` iletilerini etkinleştiren komut satırı parametresini yazın.
    2. Açılıştaki initcall sürelerini gösteren çekirdek parametresini bulun ve virtio blok sürücüsünün
       satırını `dmesg` içinde arayın.
    3. Açılış tamamlandıktan sonra, diskten bir dosya okunurken `virtblk_*` işlevlerinin çağrı ağacını
       `function_graph` ile yakalayın.

    ??? success "Örnek çözüm"
        1. `dyndbg="file drivers/block/virtio_blk.c +p"` ve konsolda görmek için `loglevel=8`.
           QEMU düzeninde: `EKARGS='dyndbg="file drivers/block/virtio_blk.c +p" loglevel=8' sh qemu/calistir.sh dogrudan ~/agecidi`.
           Sürücü çekirdeğe gömülü olduğundan `virtio_blk.dyndbg=` biçimi de kullanılabilir.
        2. `initcall_debug` parametresi her initcall'un başlangıcını ve süresini yazdırır
           (`initcall virtio_blk_init+0x0/0x... returned 0 after N usecs`). Çıktı çok uzun olduğundan
           `dmesg | grep virtio_blk` ile süzülür. Bu iletiler `KERN_DEBUG` düzeyindedir; konsol düzeyi
           düşükse yalnızca `dmesg` ile görülür.
        3. ```sh
           cd /sys/kernel/tracing
           grep virtblk available_filter_functions | head
           echo 'virtblk_*' > set_graph_function
           echo function_graph > current_tracer
           echo 3 > /proc/sys/vm/drop_caches; cat /etc/inittab > /dev/null
           cat trace | head -40
           echo nop > current_tracer; echo > set_graph_function
           ```
           `drop_caches` sayfa önbelleğini boşaltır; aksi halde dosya bellekten okunur ve sürücü hiç
           çağrılmaz. Joker karakterli filtre, derleyicinin ürettiği sonekli adları da kapsar.

**Önceki bölüm:** [7 · Seri konsol, ağ ve uzaktan erişim](07-sistem-yonetimi.md) · **Başa dön:** [Giriş](../index.md)
