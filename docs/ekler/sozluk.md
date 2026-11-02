# Terimler sözlüğü

Kitapta kullanılan Türkçe terimler ve İngilizce karşılıkları. Kaynaklarda ve hata iletilerinde İngilizce
terimler geçtiği için her iki biçim de verilmiştir.

| Türkçe | İngilizce | Açıklama |
|---|---|---|
| Açıcı | Decompressor | Sıkıştırılmış çekirdeği belleğe açan kod; ARM64'te bulunmaz, işi önyükleyici yapar |
| Aygıt ağacı | Device tree (DT) | Taranamayan donanımı tanımlayan veri yapısı; kaynağı `.dts`, ikilisi `.dtb` |
| Aygıt düğümü | Device node | `/dev` altındaki, major/minor numaralı özel dosya |
| Aygıt modeli | Driver model | Çekirdekteki aygıt, sürücü, veri yolu ve sınıf nesnelerinin yapısı; sysfs'te görünür |
| Aygıt yöneticisi | Device manager | uevent olaylarını işleyen kullanıcı alanı programı (udev, mdev) |
| Ayrıcalık düzeyi | Exception level (EL) | ARMv8'de EL0–EL3 çalışma kipleri |
| Bağlama (aygıt ağacı) | Binding | Bir aygıt türü için aygıt ağacı özelliklerinin tanımı; YAML/dt-schema ile yazılır |
| Bağlama (dosya sistemi) | Mount | Bir dosya sisteminin dizin ağacına eklenmesi |
| Bekçi köpeği | Watchdog | Yazılım belirli aralıklarla sinyal vermezse sistemi yeniden başlatan mekanizma |
| Bindirme | Overlay (`.dtbo`) | Temel aygıt ağacına sonradan uygulanan ek ağaç |
| Birim (systemd) | Unit | systemd'nin yönettiği nesne: servis, hedef, soket, zamanlayıcı … |
| Birim adresi | Unit address | Düğüm adındaki `@` sonrası; `reg` değerinin ilk adresi |
| Çalışma düzeyi | Runlevel | SysVinit'te sistemin durumunu belirten 0–6 numaralı düzey |
| Çapraz derleme | Cross compilation | Başka bir mimari için derleme (`CROSS_COMPILE`) |
| Çekirdek komut satırı | Kernel command line | Çekirdeğe önyükleyiciden verilen parametreler (`bootargs`) |
| Çekirdek paniği | Kernel panic | Çekirdeğin devam edemeyeceği hata durumu |
| Denetim ağacı | Control DTB | U-Boot'un kendi donanımını tanımak için kullandığı aygıt ağacı |
| Derleme makinesi | Host / build machine | Hedef için yazılımın derlendiği bilgisayar |
| Ek dosya (systemd) | Drop-in | `<birim>.d/*.conf`; birim dosyasını değiştirmeden üzerine yazan dosya |
| Erken konsol | Early console (`earlycon`) | Sürücüler yüklenmeden önce kullanılan basit konsol |
| Gereksinim (systemd) | Requirement dependency | `Wants=`, `Requires=` gibi başlatma bağımlılıkları |
| Güvenli izleyici | Secure monitor | EL3'te çalışan ürün yazılımı (TF-A BL31) |
| Güvenli önyükleme | Secure boot | Her aşamanın bir sonrakini imzayla doğruladığı önyükleme |
| Halka tamponu | Ring buffer | `printk` ve ftrace kayıtlarının tutulduğu dairesel bellek alanı |
| Hedef (systemd) | Target | Birimleri gruplayan eşitleme noktası (`multi-user.target`) |
| İmzalı önyükleme | Verified boot | U-Boot'ta FIT yapılandırmalarının imza ile doğrulanması |
| İzleyici (ftrace) | Tracer | `function`, `function_graph` gibi ftrace kipleri |
| Kart destek paketi | Board Support Package (BSP) | Bir kartı çalıştırmak için gereken çekirdek, önyükleyici ve ayarlar |
| Kesme | Interrupt (IRQ) | Donanımın işlemciye olay bildirimi |
| Kök dosya sistemi | Root file system (rootfs) | `/` olarak bağlanan dosya sistemi |
| Modül | Loadable kernel module (`.ko`) | Çalışma anında çekirdeğe yüklenebilen kod |
| Olay (çekirdek) | uevent | Aygıt eklenme/kaldırılma bildirimi; `ACTION`, `DEVPATH`, `MODALIAS` gibi değişkenler taşır |
| Oops | Oops | Çekirdekte yakalanan hata raporu; süreç sonlandırılır, sistem çalışmaya devam edebilir |
| Ortam değişkeni (U-Boot) | Environment variable | U-Boot'un CRC korumalı ayar bloğundaki `ad=değer` çiftleri |
| Önyükleme betiği | Boot script (`boot.scr`) | `mkimage` ile paketlenmiş U-Boot komut dizisi |
| Önyükleyici | Bootloader | Çekirdeği belleğe yükleyip başlatan program (U-Boot, GRUB) |
| Özellik (aygıt ağacı) | Property | Düğümdeki `ad = değer;` satırı |
| Parça (yapılandırma) | Configuration fragment | Yalnızca değişen `CONFIG_` satırlarını içeren dosya (`.cfg`, `.config`) |
| Sıcak takma | Hotplug | Aygıtın sistem çalışırken eklenmesi/çıkarılması |
| Sıralama (systemd) | Ordering dependency | `After=`, `Before=`; yalnızca başlatma sırası |
| Sistem çağrısı | System call | Kullanıcı alanından çekirdeğe kontrollü geçiş (`svc #0`) |
| Soğuk tarama | Coldplug | Açılışta kaçırılan uevent olaylarının yeniden üretilmesi |
| Statik bellek (yonga içi) | On-chip SRAM | DRAM başlatılmadan önce kullanılabilen küçük bellek |
| Sürücü yoklaması | Probe | Sürücünün bir aygıtla eşleştikten sonra onu başlatması |
| Takma ad (modül) | Module alias | `modules.alias` içinde bir aygıt kimliğini modüle eşleyen kalıp |
| Ürün yazılımı | Firmware | Aygıtın kendi işlemcisinde çalışan ve sürücünün yüklediği ikili dosya; ayrıca kart ürün yazılımı (UEFI, TF-A) |
| Yapılandırma (FIT) | Configuration | FIT içinde birlikte kullanılacak çekirdek, ağaç ve initramfs kümesi |
| Yükleme adresi | Load address | Bir imajın belleğe kopyalandığı fiziksel adres (`kernel_addr_r`) |
| BL31, BL32, BL33 | Boot Loader stage 3-1/3-2/3-3 | TF-A aşama adları: EL3 çalışma zamanı, güvenli yük (OP-TEE), güvenli olmayan ürün yazılımı (U-Boot) |
| FIT | Flattened Image Tree | Birden fazla imajı özet ve imzalarıyla tek dosyada toplayan U-Boot biçimi (`.its` → `.itb`) |
| initramfs | Initial RAM file system | Açılışta belleğe açılan cpio arşivi; erken kullanıcı alanı |
| phandle | phandle | Aygıt ağacında bir düğüme verilen ve başvurularda kullanılan tamsayı |
| PSCI | Power State Coordination Interface | İşlemci çekirdeklerini açma/kapatma için ARM ürün yazılımı arayüzü |
| SPL / TPL | Secondary / Tertiary Program Loader | U-Boot'un DRAM'i başlatan küçük ön aşamaları |
