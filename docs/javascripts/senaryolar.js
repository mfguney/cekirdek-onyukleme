/* Linux Çekirdeği ve Önyükleme: animasyon ve terminal senaryoları
 *
 * Animasyon senaryosu:   window.AkisSenaryolari["ad"] = { baslik, istasyonlar:[{id,ad,yol}], dosyalar:[{id,ad,tur,yer,etiket?}],
 *                                                       kod?:{baslik,satirlar:[],tumunuGoster}, adimlar:[...] }
 * Terminal oturumu:      window.TerminalOturumlari["ad"] = { baslik, istem, adimlar:[{komut,cikti,aciklama,hata?,yorum?,istem?}] }
 * Ayrıntılar: _ortak/BENIOKU.md
 *
 * Adresler QEMU "virt" makinesi (DRAM 0x40000000'dan başlar) ve U-Boot 2025.10 varsayılan ortamına göredir.
 * Terminal çıktıları bu kitabın examples/ dosyalarıyla gerçekten çalıştırılarak alınmıştır; temsilî olanlar
 * açıklamalarında belirtilmiştir.
 */
window.AkisSenaryolari = window.AkisSenaryolari || {};
window.TerminalOturumlari = window.TerminalOturumlari || {};

/* ================================================================== */
/* Bölüm 1                                                             */
/* ================================================================== */
window.AkisSenaryolari["onyukleme-zinciri"] = {
  baslik: "Önyükleme zinciri: imajlar depolamadan SRAM'e, oradan DRAM'e",
  istasyonlar: [
    { id: "depo", ad: "Depolama (eMMC / SD)", yol: "ham ofset + boot bölümü (vda1)" },
    { id: "rom", ad: "Boot ROM", yol: "yonga içi, salt okunur" },
    { id: "sram", ad: "Yonga içi SRAM", yol: "onlarca–yüzlerce KiB" },
    { id: "el3", ad: "Güvenli dünya", yol: "EL3: TF-A BL31 · S-EL1: OP-TEE" },
    { id: "dram", ad: "DRAM", yol: "0x40000000 – 0x5fffffff (512 MiB)" },
    { id: "linux", ad: "Linux", yol: "EL1 · PID 1" }
  ],
  dosyalar: [
    { id: "spl", ad: "u-boot-spl.bin (başlıklı)", tur: "ikili", etiket: "SPL", yer: "depo" },
    { id: "itb", ad: "u-boot.itb (BL31 + OP-TEE + U-Boot)", tur: "imaj", yer: "depo" },
    { id: "img", ad: "Image", tur: "imaj", yer: "depo" },
    { id: "dtb", ad: "agecidi.dtb", tur: "dts", etiket: "DTB", yer: "depo" },
    { id: "rd", ad: "initramfs.cpio.gz", tur: "imaj", yer: "depo" },
    { id: "romk", ad: "ROM kodu", tur: "ikili", etiket: "ROM", yer: "rom" }
  ],
  adimlar: [
    { gorev: "Güç verildi", aciklama: "İşlemci sıfırlamadan çıkar ve Boot ROM'daki kodu çalıştırır. DRAM henüz başlatılmamıştır; kullanılabilen bellek yalnızca yonga içi SRAM'dir.",
      vurgula: ["rom"] },
    { gorev: "ROM → SRAM", komut: "önyükleme pinleri: eMMC",
      aciklama: "Boot ROM önyükleme pinlerinden kaynağı belirler, SPL'yi yongaya özgü başlığıyla birlikte SRAM'e kopyalar ve güvenli önyükleme etkinse imzasını doğrular.",
      islemler: [{ kopyala: "spl", hedef: "sram", yeniId: "spl2", yeniAd: "SPL (çalışıyor)" }],
      vurgula: ["depo", "sram"] },
    { gorev: "SPL: DRAM", komut: "DDR denetleyicisi + eğitim",
      aciklama: "SPL saatleri ve DRAM denetleyicisini karta özgü değerlerle yapılandırır. Bu adımdan sonra 512 MiB DRAM kullanılabilir hale gelir.",
      islemler: [{ vurgu: "spl2" }, { not: "dram", metin: "DRAM başlatıldı" }],
      vurgula: ["sram", "dram"] },
    { gorev: "SPL: FIT parçaları", komut: "u-boot.itb",
      aciklama: "SPL, u-boot.itb içindeki parçaları ayırır: BL31 ve OP-TEE güvenli belleğe, U-Boot DRAM'e yüklenir. Denetim BL31'e geçer.",
      islemler: [
        { notSil: "dram" },
        { olustur: { id: "bl31", ad: "BL31 (PSCI, EL3)", tur: "ikili", etiket: "BL31" }, hedef: "el3", kaynak: "itb" },
        { olustur: { id: "tee", ad: "OP-TEE (S-EL1)", tur: "ikili", etiket: "TEE" }, hedef: "el3", kaynak: "itb" },
        { olustur: { id: "ub", ad: "U-Boot → 0x5f687000 (relocaddr)", tur: "ikili", etiket: "UB" }, hedef: "dram", kaynak: "itb" },
        { soluk: "spl2" }
      ],
      vurgula: ["el3", "dram"] },
    { gorev: "U-Boot: Image", komut: "load virtio 0:1 ${kernel_addr_r} Image",
      aciklama: "U-Boot, BL31 tarafından güvenli olmayan dünyada başlatılır, kendini DRAM'in sonuna taşır ve çekirdeği kernel_addr_r adresine yükler.",
      islemler: [{ kopyala: "img", hedef: "dram", yeniId: "img2", yeniAd: "Image @ 0x40400000" }],
      vurgula: ["dram"] },
    { gorev: "U-Boot: DTB", komut: "load ... ${fdt_addr_r} agecidi.dtb",
      aciklama: "Aygıt ağacı yüklenir. QEMU'da ağacı QEMU üretir ve DRAM'in başına (fdt_addr = 0x40000000) koyar; gerçek kartta dosya diskten okunur.",
      islemler: [{ kopyala: "dtb", hedef: "dram", yeniId: "dtb2", yeniAd: "DTB @ 0x40000000" }],
      vurgula: ["dram"] },
    { gorev: "U-Boot: initramfs", komut: "load ... ${ramdisk_addr_r} initramfs.cpio.gz",
      aciklama: "initramfs, çekirdeğin açıldıktan sonra kaplayacağı alanın dışında kalan ramdisk_addr_r adresine yüklenir; boyutu filesize değişkenine yazılır.",
      islemler: [{ kopyala: "rd", hedef: "dram", yeniId: "rd2", yeniAd: "initramfs @ 0x44000000" }],
      vurgula: ["dram"] },
    { gorev: "booti", komut: "booti ${kernel_addr_r} ${ramdisk_addr_r}:${filesize} ${fdt_addr}",
      aciklama: "U-Boot /chosen düğümüne bootargs ve initramfs adreslerini yazar, x0 yazmacına DTB adresini koyar, MMU'yu kapatır ve çekirdeğe atlar.",
      islemler: [{ yeniden: "dtb2", ad: "DTB (/chosen güncellendi)" }, { tasi: "img2", hedef: "linux" }, { soluk: "ub" }],
      vurgula: ["linux"] },
    { gorev: "Çekirdek → PID 1", komut: "Run /init as init process",
      aciklama: "Çekirdek aygıt ağacını açar, sürücüleri yoklar, initramfs'i rootfs'e açar ve /init'i PID 1 olarak çalıştırır. BL31 bellekte kalır ve PSCI çağrılarına yanıt vermeye devam eder.",
      islemler: [
        { tasi: "dtb2", hedef: "linux" },
        { olustur: { id: "init", ad: "/init (PID 1)", tur: "surec" }, hedef: "linux", kaynak: "rd2" },
        { soluk: "rd2" }
      ],
      vurgula: ["linux", "el3"] }
  ]
};

window.AkisSenaryolari["initramfs-gecis"] = {
  baslik: "initramfs'ten kalıcı kök dosya sistemine: switch_root",
  istasyonlar: [
    { id: "ram", ad: "Bellekteki arşiv", yol: "linux,initrd-start = 0x48000000" },
    { id: "rootfs", ad: "rootfs (ilk kök, tmpfs)", yol: "/" },
    { id: "vda2", ad: "Kök aygıtı", yol: "/dev/vda2 (ext4)" },
    { id: "yeni", ad: "Yeni kök", yol: "/yenikok" },
    { id: "pid1", ad: "PID 1", yol: "/proc/1/cmdline" }
  ],
  dosyalar: [
    { id: "cpio", ad: "initramfs.cpio.gz (newc)", tur: "imaj", yer: "ram" },
    { id: "k-init", ad: "sbin/init → busybox", tur: "ikili", yer: "vda2" },
    { id: "k-tab", ad: "etc/inittab", tur: "conf", yer: "vda2" }
  ],
  kod: {
    baslik: "examples/initramfs/init (özü)",
    satirlar: [
      "mount -t proc     proc     /proc",
      "mount -t sysfs    sysfs    /sys",
      "mount -t devtmpfs devtmpfs /dev",
      "for p in $(cat /proc/cmdline); do ... root=*) kok=... ; done",
      "while [ ! -b \"$kok\" ]; do sleep 0.1; done",
      "mount -t ext4 -o ro \"$kok\" /yenikok",
      "mount --move /dev /yenikok/dev   # proc, sys de",
      "exec switch_root /yenikok /sbin/init"
    ],
    tumunuGoster: false
  },
  adimlar: [
    { gorev: "Başlangıç", aciklama: "U-Boot (veya QEMU) arşivi belleğe koymuş, adresini aygıt ağacının /chosen düğümüne yazmıştır. Kök aygıtı vda2 henüz çekirdek tarafından bulunmamış olabilir.",
      vurgula: ["ram"] },
    { gorev: "Arşivin açılması", komut: "Unpacking initramfs...",
      aciklama: "Çekirdek cpio arşivini her zaman var olan ilk kök dosya sistemine (rootfs) açar ve bellek alanını serbest bırakır (Freeing initrd memory).",
      islemler: [
        { olustur: { id: "r-init", ad: "/init", tur: "betik" }, hedef: "rootfs", kaynak: "cpio" },
        { olustur: { id: "r-bb", ad: "/bin/busybox", tur: "ikili" }, hedef: "rootfs", kaynak: "cpio" },
        { olustur: { id: "r-mod", ad: "/lib/modules/6.18.0-agecidi/", tur: "dizin" }, hedef: "rootfs", kaynak: "cpio" },
        { soluk: "cpio" }
      ],
      vurgula: ["rootfs"] },
    { gorev: "/init çalışır", komut: "Run /init as init process",
      aciklama: "rdinit varsayılanı /init erişilebilir olduğundan çekirdek kök bağlamayı kullanıcı alanına bırakır ve betiği PID 1 olarak çalıştırır.",
      islemler: [{ olustur: { id: "p", ad: "PID 1: /init (sh)", tur: "surec" }, hedef: "pid1", kaynak: "r-init" }],
      vurgula: ["pid1"], kodGoster: [] },
    { gorev: "Sanal dosya sistemleri", komut: "mount -t proc/sysfs/devtmpfs",
      aciklama: "/proc, /sys ve /dev bağlanır. CONFIG_DEVTMPFS_MOUNT initramfs ile açılışta uygulanmadığından /dev de elle bağlanır.",
      islemler: [
        { olustur: { id: "m-proc", ad: "/proc", tur: "dizin" }, hedef: "rootfs" },
        { olustur: { id: "m-sys", ad: "/sys", tur: "dizin" }, hedef: "rootfs" },
        { olustur: { id: "m-dev", ad: "/dev (devtmpfs)", tur: "dizin" }, hedef: "rootfs" }
      ],
      vurgula: ["rootfs"], kodGoster: [0, 1, 2], kodSatir: [0, 1, 2] },
    { gorev: "root= ve bekleme", komut: "cat /proc/cmdline",
      aciklama: "Betik root=/dev/vda2 değerini okur ve aygıt düğümü belirene kadar bekler (rootwait'in kullanıcı alanı karşılığı).",
      islemler: [{ vurgu: "k-init" }, { not: "vda2", metin: "254:2 hazır" }],
      vurgula: ["vda2"], kodGoster: [3, 4], kodSatir: [3, 4] },
    { gorev: "Bağlama", komut: "mount -t ext4 -o ro /dev/vda2 /yenikok",
      aciklama: "Kalıcı kök dosya sistemi salt okunur olarak /yenikok altına bağlanır; içeriği artık bu dizinden görülebilir.",
      islemler: [
        { notSil: "vda2" },
        { kopyala: "k-init", hedef: "yeni", yeniId: "y-init", yeniAd: "/yenikok/sbin/init" },
        { kopyala: "k-tab", hedef: "yeni", yeniId: "y-tab", yeniAd: "/yenikok/etc/inittab" }
      ],
      vurgula: ["yeni"], kodGoster: [5], kodSatir: [5] },
    { gorev: "mount --move", komut: "mount --move /dev /yenikok/dev",
      aciklama: "Sanal dosya sistemleri yeniden bağlanmadan yeni köke taşınır; içerikleri ve açık dosyaları korunur.",
      islemler: [{ tasi: "m-proc", hedef: "yeni" }, { tasi: "m-sys", hedef: "yeni" }, { tasi: "m-dev", hedef: "yeni" }],
      vurgula: ["yeni"], kodGoster: [6], kodSatir: [6] },
    { gorev: "switch_root", komut: "exec switch_root /yenikok /sbin/init",
      aciklama: "switch_root initramfs'teki dosyaları siler (bellek geri kazanılır), /yenikok'u kök yapar ve /sbin/init'i exec eder. PID değişmez: BusyBox init de PID 1'dir.",
      islemler: [
        { sil: "r-init" }, { sil: "r-bb" }, { sil: "r-mod" },
        { yeniden: "p", ad: "PID 1: /sbin/init (BusyBox init)" },
        { not: "yeni", metin: "artık / budur" }
      ],
      vurgula: ["pid1", "yeni"], kodGoster: [7], kodSatir: [7] },
    { gorev: "init → rcS", komut: "::sysinit:/etc/init.d/rcS",
      aciklama: "BusyBox init /etc/inittab dosyasını okur, rcS betiğini çalıştırır ve seri konsolda getty'yi başlatır (Bölüm 6).",
      islemler: [{ vurgu: "y-tab" }, { olustur: { id: "getty", ad: "getty ttyAMA0", tur: "surec" }, hedef: "pid1", kaynak: "y-tab" }],
      vurgula: ["pid1"] }
  ]
};

/* ================================================================== */
/* Bölüm 2                                                             */
/* ================================================================== */
window.AkisSenaryolari["uboot-bootcmd"] = {
  baslik: "U-Boot: ortamdan bootcmd'ye, extlinux.conf'tan çekirdeğe",
  istasyonlar: [
    { id: "flash", ad: "Ortam deposu", yol: "flash1.img · 0x0, 0x40000 bayt, CRC32" },
    { id: "env", ad: "Bellekteki ortam", yol: "printenv" },
    { id: "hush", ad: "hush yorumlayıcısı", yol: "bootcmd" },
    { id: "disk", ad: "Önyükleme bölümü", yol: "virtio 0:1 (ext4)" },
    { id: "dram", ad: "DRAM", yol: "pxefile 0x40300000 · kernel 0x40400000" },
    { id: "cekirdek", ad: "Çekirdek", yol: "/chosen/bootargs" }
  ],
  dosyalar: [
    { id: "blok", ad: "ortam bloğu (CRC + ad=değer)", tur: "veri", yer: "flash" },
    { id: "ext", ad: "extlinux/extlinux.conf", tur: "conf", yer: "disk" },
    { id: "img", ad: "Image", tur: "imaj", yer: "disk" }
  ],
  kod: {
    baslik: "ortam (kısaltılmış)",
    satirlar: [
      "bootdelay=2",
      "boot_targets=qfw usb scsi virtio nvme dhcp",
      "bootcmd=bootflow scan -lb",
      "kernel_addr_r=0x40400000",
      "pxefile_addr_r=0x40300000",
      "fdt_addr=0x40000000"
    ],
    tumunuGoster: true
  },
  adimlar: [
    { gorev: "Ortamın okunması", komut: "Loading Environment from Flash... OK",
      aciklama: "U-Boot ortam bloğunu okur ve CRC değerini denetler. CRC geçersizse derlemeye gömülü varsayılan ortam kullanılır (bad CRC, using default environment).",
      islemler: [{ kopyala: "blok", hedef: "env", yeniId: "env1", yeniAd: "ortam (bellekte)" }],
      vurgula: ["flash", "env"] },
    { gorev: "Geri sayım", komut: "Hit any key to stop autoboot: 2",
      aciklama: "bootdelay saniye boyunca tuş beklenir. Tuşa basılırsa komut istemi (=>) açılır; basılmazsa bootcmd çalıştırılır.",
      islemler: [{ vurgu: "env1" }], vurgula: ["env"], kodSatir: [0] },
    { gorev: "bootcmd", komut: "bootflow scan -lb",
      aciklama: "hush, bootcmd değerini genişletir ve çalıştırır. Standart önyükleme boot_targets sırasıyla aygıtları tarar.",
      islemler: [{ olustur: { id: "cmd", ad: "bootflow scan -lb", tur: "betik" }, hedef: "hush", kaynak: "env1" }],
      vurgula: ["hush"], kodSatir: [1, 2] },
    { gorev: "Bootflow bulundu", komut: "extlinux ready virtio 0:1",
      aciklama: "virtio diskinin 1. bölümünde extlinux önyükleme yöntemi /extlinux/extlinux.conf dosyasını bulur; bu bir bootflow'dur.",
      islemler: [{ vurgu: "ext" }, { not: "disk", metin: "bootmeth: extlinux" }],
      vurgula: ["disk"] },
    { gorev: "Menü dosyası", komut: "Retrieving file: /extlinux/extlinux.conf",
      aciklama: "Dosya pxefile_addr_r adresine okunur ve ayrıştırılır; varsayılan girdi (ornekos) seçilir.",
      islemler: [{ notSil: "disk" }, { kopyala: "ext", hedef: "dram", yeniId: "ext2", yeniAd: "extlinux.conf @ 0x40300000" }],
      vurgula: ["dram"], kodSatir: [4] },
    { gorev: "Çekirdeğin yüklenmesi", komut: "Retrieving file: /Image",
      aciklama: "linux satırındaki dosya kernel_addr_r adresine yüklenir. append satırı bootargs değişkenine yazılır.",
      islemler: [
        { kopyala: "img", hedef: "dram", yeniId: "img2", yeniAd: "Image @ 0x40400000" },
        { olustur: { id: "ba", ad: "bootargs=console=ttyAMA0,115200 root=/dev/vda2 …", tur: "metin" }, hedef: "env", kaynak: "ext2" }
      ],
      vurgula: ["dram", "env"], kodSatir: [3] },
    { gorev: "booti", komut: "Starting kernel ...",
      aciklama: "fdt satırı olmadığından U-Boot elindeki ağacı (fdt_addr) kullanır, /chosen düğümüne bootargs yazar ve çekirdeğe atlar.",
      islemler: [{ tasi: "ba", hedef: "cekirdek" }, { tasi: "img2", hedef: "cekirdek" }, { soluk: "cmd" }],
      vurgula: ["cekirdek"], kodSatir: [5] }
  ]
};

window.AkisSenaryolari["fit-imaji"] = {
  baslik: "FIT imajı: mkimage ile paketleme, bootm ile doğrulama ve yerleştirme",
  istasyonlar: [
    { id: "girdi", ad: "Girdiler (derleme makinesi)", yol: "~/agecidi/" },
    { id: "mk", ad: "mkimage -f", yol: "ornek.its → ornek.itb" },
    { id: "itb", ad: "FIT dosyası", yol: "ornek.itb (aygıt ağacı biçiminde)" },
    { id: "yuk", ad: "DRAM: FIT kopyası", yol: "0x48000000" },
    { id: "hedef", ad: "DRAM: hedef adresler", yol: "load = 0x40400000 …" },
    { id: "cek", ad: "Çekirdek", yol: "Starting kernel" }
  ],
  dosyalar: [
    { id: "its", ad: "ornek.its", tur: "dts", etiket: "ITS", yer: "girdi" },
    { id: "img", ad: "Image", tur: "imaj", yer: "girdi" },
    { id: "rd", ad: "initramfs.cpio.gz", tur: "imaj", yer: "girdi" },
    { id: "dtb", ad: "virt.dtb", tur: "dts", etiket: "DTB", yer: "girdi" }
  ],
  adimlar: [
    { gorev: "Başlangıç", komut: "ls ~/agecidi", aciklama: ".its dosyası parçaları /incbin/ ile dosya adlarından alır ve her biri için hash-1 (sha256) düğümü ister.",
      vurgula: ["girdi"] },
    { gorev: "Özetler", komut: "mkimage -f ornek.its ornek.itb",
      aciklama: "mkimage her parçanın sha256 özetini hesaplar ve ilgili hash-1 düğümünün value özelliğine yazar.",
      islemler: [{ vurgu: "img" }, { vurgu: "rd" }, { vurgu: "dtb" }, { not: "mk", metin: "sha256 × 3" }],
      vurgula: ["mk"] },
    { gorev: "Paketleme", komut: "ornek.itb",
      aciklama: "Parçalar ve özetleri tek bir FDT dosyasında birleşir; configurations/conf-1 hangi parçaların birlikte kullanılacağını tanımlar.",
      islemler: [
        { notSil: "mk" },
        { olustur: { id: "fit", ad: "ornek.itb (kernel-1, ramdisk-1, fdt-1, conf-1)", tur: "imaj", etiket: "FIT" }, hedef: "itb", kaynak: "its" },
        { soluk: "its" }, { soluk: "img" }, { soluk: "rd" }, { soluk: "dtb" }
      ],
      vurgula: ["itb"] },
    { gorev: "U-Boot: yükleme", komut: "load virtio 0:1 0x48000000 ornek.itb",
      aciklama: "FIT, çekirdeğin hedef bölgesiyle çakışmayan bir adrese tek dosya olarak yüklenir.",
      islemler: [{ kopyala: "fit", hedef: "yuk", yeniId: "fit2", yeniAd: "FIT @ 0x48000000" }],
      vurgula: ["yuk"] },
    { gorev: "Çekirdek doğrulama", komut: "bootm 0x48000000#conf-1",
      aciklama: "bootm conf-1 yapılandırmasını seçer, kernel-1 verisinin özetini yeniden hesaplar ve kayıtlı değerle karşılaştırır: Verifying Hash Integrity ... sha256+ OK.",
      islemler: [{ vurgu: "fit2" }, { not: "yuk", metin: "kernel-1: sha256+ OK" }],
      vurgula: ["yuk"] },
    { gorev: "Yerleştirme", komut: "Loading Kernel Image to 40400000",
      aciklama: "Çekirdek FIT'in içinden load adresine kopyalanır; ramdisk ve fdt de doğrulanıp yerleştirilir. FIT bu bölgede olsaydı kopyalama sırasında kendini ezerdi.",
      islemler: [
        { notSil: "yuk" },
        { olustur: { id: "k", ad: "Image @ 0x40400000", tur: "imaj" }, hedef: "hedef", kaynak: "fit2" },
        { olustur: { id: "r", ad: "initramfs (ramdisk-1)", tur: "imaj" }, hedef: "hedef", kaynak: "fit2" },
        { olustur: { id: "f", ad: "fdt-1 (aygıt ağacı)", tur: "dts", etiket: "DTB" }, hedef: "hedef", kaynak: "fit2" }
      ],
      vurgula: ["hedef"] },
    { gorev: "Başlatma", komut: "Starting kernel ...",
      aciklama: "U-Boot /chosen düğümünü günceller ve çekirdeğe atlar. Bir bayt bile değişmişse önceki adımda Bad Data Hash hatası alınır ve önyükleme durur.",
      islemler: [{ tasi: "k", hedef: "cek" }, { tasi: "f", hedef: "cek" }, { tasi: "r", hedef: "cek" }, { soluk: "fit2" }],
      vurgula: ["cek"] }
  ]
};

/* ================================================================== */
/* Bölüm 3                                                             */
/* ================================================================== */
window.AkisSenaryolari["kconfig-kbuild"] = {
  baslik: "Bir seçeneğin yolculuğu: Kconfig → .config → autoconf.h → obj-m → .ko",
  istasyonlar: [
    { id: "kc", ad: "Kconfig ve parça", yol: "drivers/char/hw_random/Kconfig · agecidi.config" },
    { id: "conf", ad: "Yapılandırma", yol: "~/agecidi/cekirdek/.config" },
    { id: "gen", ad: "Üretilen dosyalar", yol: "include/config/auto.conf · include/generated/autoconf.h" },
    { id: "mk", ad: "Kbuild Makefile", yol: "drivers/char/hw_random/Makefile" },
    { id: "obj", ad: "Nesneler", yol: "drivers/char/hw_random/*.o" },
    { id: "out", ad: "Çıktılar", yol: "vmlinux · Image · *.ko · lib/modules/" }
  ],
  dosyalar: [
    { id: "kcf", ad: "config HW_RANDOM_VIRTIO (tristate, depends on HW_RANDOM && VIRTIO)", tur: "conf", yer: "kc" },
    { id: "frag", ad: "CONFIG_HW_RANDOM_VIRTIO=m", tur: "conf", etiket: "CFG", yer: "kc" },
    { id: "mkf", ad: "obj-$(CONFIG_HW_RANDOM_VIRTIO) += virtio-rng.o", tur: "metin", etiket: "MK", yer: "mk" },
    { id: "src", ad: "virtio-rng.c", tur: "kaynak", yer: "mk" }
  ],
  adimlar: [
    { gorev: "Başlangıç", aciklama: "Seçenek Kconfig dosyasında tanımlıdır; parça yalnızca istenen değeri içerir. Bağımlılıklar (HW_RANDOM, VIRTIO) da parçada açılmıştır.",
      vurgula: ["kc"] },
    { gorev: "merge_config.sh -n", komut: "scripts/kconfig/merge_config.sh -n -O ~/agecidi/cekirdek agecidi.config",
      aciklama: "Parça allnoconfig tabanıyla birleştirilir; Kconfig bağımlılıkları çözer. Koşulu sağlanmayan bir değer (ilk sürümdeki VIRTIO_BLK gibi) burada düşer ve uyarılır.",
      islemler: [{ kopyala: "frag", hedef: "conf", yeniId: "c1", yeniAd: "CONFIG_HW_RANDOM_VIRTIO=m" }],
      vurgula: ["conf"] },
    { gorev: "syncconfig", komut: "make O=~/agecidi/cekirdek ...",
      aciklama: "make her çalıştığında .config'ten iki dosya üretilir: Makefile'ların okuduğu auto.conf ve C kodunun okuduğu autoconf.h. m değeri C tarafında _MODULE sonekiyle görünür.",
      islemler: [
        { olustur: { id: "ac", ad: "auto.conf: CONFIG_HW_RANDOM_VIRTIO=m", tur: "metin" }, hedef: "gen", kaynak: "c1" },
        { olustur: { id: "ah", ad: "autoconf.h: #define CONFIG_HW_RANDOM_VIRTIO_MODULE 1", tur: "kaynak", etiket: "H" }, hedef: "gen", kaynak: "c1" }
      ],
      vurgula: ["gen"] },
    { gorev: "obj-m", komut: "obj-$(CONFIG_HW_RANDOM_VIRTIO) → obj-m",
      aciklama: "Kbuild, Makefile satırını auto.conf değeriyle genişletir: liste obj-m olur, yani nesne vmlinux'a değil ayrı bir modüle girecektir.",
      islemler: [{ vurgu: "ac" }, { yeniden: "mkf", ad: "obj-m += virtio-rng.o" }],
      vurgula: ["mk", "gen"] },
    { gorev: "Derleme", komut: "CC [M]  drivers/char/hw_random/virtio-rng.o",
      aciklama: "Kaynak, -DMODULE ve -include autoconf.h ile derlenir. fixdep, bu nesnenin hangi CONFIG_ değerlerine baktığını kaydeder; yalnızca onlar değişirse yeniden derlenir.",
      islemler: [{ olustur: { id: "o", ad: "virtio-rng.o", tur: "nesne" }, hedef: "obj", kaynak: "src" }],
      vurgula: ["obj"] },
    { gorev: "Modül bağlama", komut: "LD [M]  drivers/char/hw_random/virtio-rng.ko",
      aciklama: "modpost dışa aktarılan sembolleri denetler (Module.symvers); nesne .ko dosyasına bağlanır. y değerli seçenekler ise built-in.a üzerinden vmlinux'a girer.",
      islemler: [
        { olustur: { id: "ko", ad: "virtio-rng.ko", tur: "modul" }, hedef: "out", kaynak: "o" },
        { olustur: { id: "vm", ad: "vmlinux → Image (objcopy)", tur: "ikili" }, hedef: "out" }
      ],
      vurgula: ["out"] },
    { gorev: "modules_install", komut: "make INSTALL_MOD_PATH=~/agecidi/kok modules_install",
      aciklama: "Modül lib/modules/6.18.0-agecidi/kernel/drivers/char/hw_random/ altına kopyalanır; depmod modules.dep ve modules.alias dosyalarını üretir (Bölüm 5).",
      islemler: [{ yeniden: "ko", ad: "lib/modules/6.18.0-agecidi/kernel/.../virtio-rng.ko" }, { olustur: { id: "dep", ad: "modules.dep, modules.alias", tur: "metin" }, hedef: "out", kaynak: "ko" }],
      vurgula: ["out"] }
  ]
};

/* ================================================================== */
/* Bölüm 4                                                             */
/* ================================================================== */
window.AkisSenaryolari["dtc-akisi"] = {
  baslik: "Aygıt ağacı: kaynaklardan çekirdekteki aygıtlara",
  istasyonlar: [
    { id: "src", ad: "Kaynaklar", yol: "examples/dts/ · include/dt-bindings/" },
    { id: "cpp", ad: "C ön işlemcisi", yol: "cikti/agecidi.dts.tmp" },
    { id: "dtc", ad: "dtc", yol: "cikti/agecidi.dtb (0xd00dfeed)" },
    { id: "ub", ad: "U-Boot", yol: "fdt_addr_r · /chosen düzeltmesi" },
    { id: "of", ad: "Çekirdek: OF katmanı", yol: "early_init_dt_scan · unflatten_device_tree" },
    { id: "dev", ad: "Aygıtlar ve sürücüler", yol: "/sys/bus/{amba,platform,i2c}/devices" }
  ],
  dosyalar: [
    { id: "dts", ad: "agecidi.dts", tur: "dts", yer: "src" },
    { id: "dtsi", ad: "ornek-soc.dtsi", tur: "dts", etiket: "DTSI", yer: "src" },
    { id: "h", ad: "dt-bindings/gpio/gpio.h, arm-gic.h", tur: "kaynak", etiket: "H", yer: "src" }
  ],
  adimlar: [
    { gorev: "Başlangıç", aciklama: "Kart dosyası yonga dosyasını ve sabit tanımlarını #include ile içerir. GIC_SPI, IRQ_TYPE_LEVEL_HIGH gibi adlar henüz makrodur.",
      vurgula: ["src"] },
    { gorev: "cpp", komut: "cpp -nostdinc -undef -D__DTS__ -x assembler-with-cpp ...",
      aciklama: "Ön işlemci dosyaları birleştirir ve makroları açar: <GIC_SPI 1 IRQ_TYPE_LEVEL_HIGH> → <0 1 4>.",
      islemler: [{ olustur: { id: "tmp", ad: "agecidi.dts.tmp (tek dosya)", tur: "dts" }, hedef: "cpp", kaynak: "dts" }, { soluk: "dtsi" }, { soluk: "h" }],
      vurgula: ["cpp"] },
    { gorev: "dtc", komut: "dtc -@ -I dts -O dtb -o agecidi.dtb agecidi.dts.tmp",
      aciklama: "dtc sözdizimini ve temel kuralları (birim adresi–reg uyumu gibi) denetler, etiketleri phandle değerlerine çevirir ve -@ ile __symbols__ düğümünü ekler.",
      islemler: [{ olustur: { id: "dtb", ad: "agecidi.dtb (2553 bayt)", tur: "dts", etiket: "DTB" }, hedef: "dtc", kaynak: "tmp" }],
      vurgula: ["dtc"] },
    { gorev: "U-Boot", komut: "booti ... ${fdt_addr_r}",
      aciklama: "U-Boot ağacı belleğe yükler, /chosen düğümüne bootargs ve initramfs adresini, gerekirse bellek düğümlerini yazar; adresi x0 yazmacıyla çekirdeğe iletir.",
      islemler: [{ kopyala: "dtb", hedef: "ub", yeniId: "dtb2", yeniAd: "agecidi.dtb + /chosen" }],
      vurgula: ["ub"] },
    { gorev: "Erken tarama", komut: "setup_arch() → early_init_dt_scan()",
      aciklama: "Çekirdek düz ağaçtan bellek bölgelerini, komut satırını ve model adını okur: Machine model: Ornek Endustriyel Sensor Agecidi.",
      islemler: [{ olustur: { id: "erken", ad: "memory, /chosen, model", tur: "veri" }, hedef: "of", kaynak: "dtb2" }],
      vurgula: ["of"] },
    { gorev: "Açma", komut: "unflatten_device_tree()",
      aciklama: "Ağaç, her düğümü bir struct device_node olan bağlı bir yapıya dönüştürülür; /sys/firmware/devicetree/base altında da görünür.",
      islemler: [{ olustur: { id: "dn", ad: "struct device_node ağacı", tur: "bellek" }, hedef: "of", kaynak: "dtb2" }, { soluk: "erken" }],
      vurgula: ["of"] },
    { gorev: "Aygıt oluşturma", komut: "of_platform_default_populate_init()",
      aciklama: "simple-bus olan soc@0 düğümünün çocukları için aygıtlar oluşturulur: arm,primecell uyumlular AMBA, diğerleri platform aygıtı olur. status = \"disabled\" düğümler atlanır.",
      islemler: [
        { olustur: { id: "d1", ad: "9000000.serial (amba)", tur: "aygit" }, hedef: "dev", kaynak: "dn" },
        { olustur: { id: "d2", ad: "9040000.i2c (platform)", tur: "aygit" }, hedef: "dev", kaynak: "dn" },
        { olustur: { id: "d3", ad: "leds (platform)", tur: "aygit" }, hedef: "dev", kaynak: "dn" }
      ],
      vurgula: ["dev"] },
    { gorev: "Yoklama", komut: "compatible eşleşmesi → probe()",
      aciklama: "Sürücüler of_match_table ile eşleşir: uart-pl011 9000000.serial'ı, i2c_designware 9040000.i2c'yi alır. I²C sürücüsü kendi çocuğu için 0-0048 istemcisini oluşturur; tmp102 sürücüsü ona bağlanır.",
      islemler: [{ vurgu: "d1" }, { vurgu: "d2" }, { olustur: { id: "d4", ad: "0-0048 (ti,tmp102)", tur: "aygit" }, hedef: "dev", kaynak: "d2" }],
      vurgula: ["dev"] }
  ]
};

window.AkisSenaryolari["overlay-uygulama"] = {
  baslik: "Bindirme: __fixups__ adları __symbols__ ile çözülür, parça hedefe birleşir",
  istasyonlar: [
    { id: "temel", ad: "Temel ağaç (-@ ile)", yol: "cikti/agecidi.dtb" },
    { id: "ek", ad: "Bindirme", yol: "cikti/sensor-ek.dtbo" },
    { id: "arac", ad: "Uygulayan", yol: "fdtoverlay · U-Boot fdt apply" },
    { id: "sonuc", ad: "Sonuç ağacı", yol: "cikti/agecidi-ek.dtb" }
  ],
  dosyalar: [
    { id: "i2c", ad: "/soc@0/i2c@9040000 (phandle = <0x07>)", tur: "dts", etiket: "NODE", yer: "temel" },
    { id: "s48", ad: "sensor@48 (ti,tmp102)", tur: "aygit", yer: "temel" },
    { id: "sym", ad: "__symbols__/i2c0 = \"/soc@0/i2c@9040000\"", tur: "metin", yer: "temel" },
    { id: "frag", ad: "fragment@0: target = <0xffffffff>", tur: "dts", etiket: "FRAG", yer: "ek" },
    { id: "s49", ad: "__overlay__/sensor@49 (ti,tmp102)", tur: "aygit", yer: "ek" },
    { id: "fix", ad: "__fixups__/i2c0 = \"/fragment@0:target:0\"", tur: "metin", yer: "ek" }
  ],
  adimlar: [
    { gorev: "Başlangıç", aciklama: "Bindirme derlenirken &i2c0'ın nerede olduğu bilinmediğinden hedef 0xffffffff yer tutucusudur ve ad __fixups__ düğümüne yazılmıştır.",
      vurgula: ["ek"] },
    { gorev: "Ad arama", komut: "__fixups__: i2c0",
      aciklama: "Uygulayıcı her __fixups__ girdisinin adını temel ağacın __symbols__ düğümünde arar: i2c0 → /soc@0/i2c@9040000.",
      islemler: [{ vurgu: "fix" }, { vurgu: "sym" }],
      vurgula: ["arac", "temel"] },
    { gorev: "phandle düzeltme", komut: "target = <0x07>",
      aciklama: "Bulunan düğümün phandle değeri, fixup girdisinin gösterdiği konuma (fragment@0'ın target özelliğinin 0. hücresi) yazılır.",
      islemler: [{ yeniden: "frag", ad: "fragment@0: target = <0x07>" }, { vurgu: "i2c" }],
      vurgula: ["ek"] },
    { gorev: "Kopyalama", komut: "fdtoverlay -i agecidi.dtb -o agecidi-ek.dtb sensor-ek.dtbo",
      aciklama: "Temel ağaç sonuç ağacına kopyalanır; bindirmenin kendisi değiştirilmez.",
      islemler: [
        { kopyala: "i2c", hedef: "sonuc", yeniId: "i2c2", yeniAd: "/soc@0/i2c@9040000" },
        { kopyala: "s48", hedef: "sonuc", yeniId: "s48b", yeniAd: "sensor@48" }
      ],
      vurgula: ["sonuc"] },
    { gorev: "Birleştirme", komut: "__overlay__ → hedef düğüm",
      aciklama: "__overlay__ düğümünün içeriği hedef düğüme birleştirilir: yeni alt düğüm eklenir, aynı adlı özellikler varsa üzerine yazılır.",
      islemler: [{ kopyala: "s49", hedef: "sonuc", yeniId: "s49b", yeniAd: "sensor@49 (kabin)" }],
      vurgula: ["sonuc"] },
    { gorev: "Sonuç", komut: "fdtget -l agecidi-ek.dtb /soc/i2c@9040000",
      aciklama: "I²C denetleyicisinin altında artık sensor@49 ve sensor@48 bulunur. Çekirdek bu ağaçla açıldığında iki tmp102 aygıtı oluşturur.",
      islemler: [{ soluk: "frag" }, { soluk: "fix" }],
      vurgula: ["sonuc"] }
  ]
};

/* ================================================================== */
/* Bölüm 5                                                             */
/* ================================================================== */
window.AkisSenaryolari["uevent-udev"] = {
  baslik: "Sensör takıldığında: uevent → udev kuralı → /dev düğümü, bağlantı ve servis",
  istasyonlar: [
    { id: "kern", ad: "Çekirdek: sürücü", yol: "ftdi_sio · device_add()" },
    { id: "devfs", ad: "/dev (devtmpfs)", yol: "kdevtmpfs" },
    { id: "nl", ad: "Netlink", yol: "NETLINK_KOBJECT_UEVENT" },
    { id: "udevd", ad: "systemd-udevd", yol: "/etc/udev/rules.d/99-ornek-sensor.rules" },
    { id: "sysd", ad: "systemd", yol: "dev-sensor\\x2duart.device" }
  ],
  dosyalar: [
    { id: "usb", ad: "USB aygıtı 0403:6001 (FT232R)", tur: "aygit", yer: "kern" },
    { id: "kural", ad: "SUBSYSTEM==\"tty\", ATTRS{idVendor}==\"0403\" …", tur: "conf", etiket: "RULE", yer: "udevd" }
  ],
  adimlar: [
    { gorev: "Takılma", aciklama: "USB-seri dönüştürücü takılır; USB çekirdeği aygıtı tanır ve ftdi_sio sürücüsü bağlanır.",
      vurgula: ["kern"] },
    { gorev: "tty aygıtı", komut: "device_add(ttyUSB0)",
      aciklama: "Sürücü bir tty aygıtı kaydeder. devtmpfs düğümü hemen, çekirdeğin varsayılan adı ve izniyle oluşturur.",
      islemler: [
        { olustur: { id: "tty", ad: "ttyUSB0 (188:0)", tur: "aygit" }, hedef: "kern", kaynak: "usb" },
        { olustur: { id: "node", ad: "/dev/ttyUSB0 crw------- root root", tur: "aygit" }, hedef: "devfs", kaynak: "tty" }
      ],
      vurgula: ["kern", "devfs"] },
    { gorev: "uevent", komut: "kobject_uevent(KOBJ_ADD)",
      aciklama: "Çekirdek olayı değişkenleriyle birlikte netlink üzerinden yayımlar: ACTION=add, SUBSYSTEM=tty, DEVNAME=ttyUSB0, MAJOR=188, MINOR=0, SEQNUM=…",
      islemler: [{ olustur: { id: "ev", ad: "ACTION=add DEVNAME=ttyUSB0 SUBSYSTEM=tty", tur: "veri", etiket: "EVT" }, hedef: "nl", kaynak: "tty" }],
      vurgula: ["nl"] },
    { gorev: "Kural eşleşmesi", komut: "ATTRS{idVendor}==\"0403\"",
      aciklama: "udevd olayı alır ve kuralları sırayla işler. ATTRS anahtarları tty aygıtından yukarı doğru üst aygıtlarda aranır ve USB aygıtı düzeyinde eşleşir.",
      islemler: [{ kopyala: "ev", hedef: "udevd", yeniId: "ev2", yeniAd: "olay alındı: ttyUSB0 (add)" }, { soluk: "ev" }, { vurgu: "kural" }, { vurgu: "usb" }],
      vurgula: ["udevd"] },
    { gorev: "İzin ve grup", komut: "MODE=\"0660\", GROUP=\"dialout\"",
      aciklama: "udevd düğümün izinlerini ve grubunu değiştirir. NAME ağ arayüzü dışındaki aygıtlarda kullanılamadığından düğümün adı ttyUSB0 olarak kalır.",
      islemler: [{ yeniden: "node", ad: "/dev/ttyUSB0 crw-rw---- root dialout" }],
      vurgula: ["devfs"] },
    { gorev: "Kalıcı ad", komut: "SYMLINK+=\"sensor-uart\"",
      aciklama: "Uygulamaların kullanacağı kalıcı ad bir sembolik bağlantıdır; aygıt hangi numarayı alırsa alsın /dev/sensor-uart aynı kalır.",
      islemler: [{ olustur: { id: "link", ad: "/dev/sensor-uart → ttyUSB0", tur: "aygit", etiket: "LINK" }, hedef: "devfs", kaynak: "node" }],
      vurgula: ["devfs"] },
    { gorev: "systemd", komut: "TAG+=\"systemd\", ENV{SYSTEMD_WANTS}",
      aciklama: "Etiketli aygıt systemd'de bir .device birimi olur; SYSTEMD_WANTS bu birime sensor-toplayici.service gereksinimini ekler ve servis başlatılır.",
      islemler: [
        { olustur: { id: "unit", ad: "dev-sensor\\x2duart.device", tur: "surec" }, hedef: "sysd", kaynak: "ev2" },
        { olustur: { id: "svc", ad: "sensor-toplayici.service (active)", tur: "surec" }, hedef: "sysd", kaynak: "unit" },
        { soluk: "ev2" }
      ],
      vurgula: ["sysd"] }
  ]
};

window.AkisSenaryolari["modprobe-zinciri"] = {
  baslik: "MODALIAS ile otomatik modül yükleme: virtio-rng örneği",
  istasyonlar: [
    { id: "bus", ad: "virtio veri yolu", yol: "/sys/bus/virtio/devices/virtio1" },
    { id: "mdev", ad: "mdev (hotplug yardımcısı)", yol: "/proc/sys/kernel/hotplug · /etc/mdev.conf" },
    { id: "alias", ad: "modules.alias", yol: "/lib/modules/6.18.0-agecidi/" },
    { id: "dep", ad: "modules.dep", yol: "/lib/modules/6.18.0-agecidi/" },
    { id: "kern", ad: "Çekirdek", yol: "finit_module() · /proc/modules" }
  ],
  dosyalar: [
    { id: "dev", ad: "virtio1 (aygıt türü 4, satıcı QEMU)", tur: "aygit", yer: "bus" },
    { id: "kural", ad: "$MODALIAS=.* … @modprobe -q \"$MODALIAS\"", tur: "conf", etiket: "RULE", yer: "mdev" },
    { id: "al", ad: "alias virtio:d00000004v* virtio_rng", tur: "metin", yer: "alias" },
    { id: "dp", ad: "virtio-rng.ko: rng-core.ko", tur: "metin", yer: "dep" }
  ],
  adimlar: [
    { gorev: "Başlangıç", aciklama: "Aygıt virtio veri yolunda kayıtlıdır, ancak sürücüsü (virtio_rng) çekirdeğe gömülü değil, modüldür ve henüz yüklenmemiştir.",
      vurgula: ["bus"] },
    { gorev: "uevent", komut: "echo add > /sys/bus/virtio/devices/virtio1/uevent",
      aciklama: "Açılışta (veya soğuk taramada) aygıtın olayı üretilir. Olayda MODALIAS=virtio:d00000004v554D4551 bulunur: d = aygıt türü, v = satıcı kimliği.",
      islemler: [{ olustur: { id: "ev", ad: "MODALIAS=virtio:d00000004v554D4551", tur: "veri", etiket: "EVT" }, hedef: "mdev", kaynak: "dev" }],
      vurgula: ["mdev"] },
    { gorev: "mdev kuralı", komut: "modprobe -q virtio:d00000004v554D4551",
      aciklama: "Düğümü olmayan olay $MODALIAS kuralıyla eşleşir; mdev, takma adı modprobe'a verir.",
      islemler: [{ vurgu: "kural" }],
      vurgula: ["mdev"] },
    { gorev: "Takma ad", komut: "grep virtio:d00000004 modules.alias",
      aciklama: "modprobe kalıpları sırayla dener; virtio:d00000004v* kalıbı eşleşir ve modül adı virtio_rng bulunur. Bu satırı depmod, modülün MODULE_DEVICE_TABLE bilgisinden üretmiştir.",
      islemler: [{ tasi: "ev", hedef: "alias" }, { vurgu: "al" }],
      vurgula: ["alias"] },
    { gorev: "Bağımlılık", komut: "modules.dep",
      aciklama: "virtio-rng.ko, rng-core.ko'nun dışa aktardığı sembolleri kullanır. modprobe önce bağımlılığı yükler.",
      islemler: [{ vurgu: "dp" }, { olustur: { id: "m1", ad: "rng_core", tur: "modul" }, hedef: "kern", kaynak: "dp" }],
      vurgula: ["dep", "kern"] },
    { gorev: "Yükleme", komut: "finit_module(virtio-rng.ko)",
      aciklama: "Asıl modül yüklenir, sürücü kaydolur ve çekirdek bekleyen virtio1 aygıtıyla eşleştirip probe() çağırır.",
      islemler: [{ olustur: { id: "m2", ad: "virtio_rng (Used by: 0)", tur: "modul" }, hedef: "kern", kaynak: "dp" }, { soluk: "ev" }],
      vurgula: ["kern"] },
    { gorev: "Sonuç", komut: "cat /sys/class/misc/hw_random/rng_current",
      aciklama: "Aygıt sürücüsüne bağlanmıştır: lsmod iki modülü gösterir, rng_current değeri virtio_rng.0'dır ve /dev/hwrng kullanılabilir.",
      islemler: [{ yeniden: "dev", ad: "virtio1 → driver: virtio_rng" }, { olustur: { id: "node", ad: "/dev/hwrng", tur: "aygit" }, hedef: "bus", kaynak: "m2" }],
      vurgula: ["bus", "kern"] }
  ]
};

/* ================================================================== */
/* Bölüm 6                                                             */
/* ================================================================== */
window.AkisSenaryolari["systemd-hedef"] = {
  baslik: "systemd: etkinleştirme bağlantısından multi-user.target'a",
  istasyonlar: [
    { id: "unit", ad: "Birim dosyaları", yol: "/usr/lib/systemd/system/" },
    { id: "wants", ad: "Etkinleştirme bağlantıları", yol: "/etc/systemd/system/multi-user.target.wants/" },
    { id: "sys", ad: "Erken açılış", yol: "sysinit.target → basic.target" },
    { id: "ag", ad: "Ağ", yol: "network-online.target" },
    { id: "hedef", ad: "Hedef", yol: "multi-user.target (default.target)" }
  ],
  dosyalar: [
    { id: "svc", ad: "sensor-toplayici.service", tur: "conf", etiket: "UNIT", yer: "unit" },
    { id: "nwd", ad: "systemd-networkd.service", tur: "conf", etiket: "UNIT", yer: "unit" },
    { id: "wo", ad: "systemd-networkd-wait-online.service", tur: "conf", etiket: "UNIT", yer: "unit" }
  ],
  kod: {
    baslik: "sensor-toplayici.service",
    satirlar: [
      "[Unit]",
      "Wants=network-online.target",
      "After=network-online.target",
      "[Service]",
      "ExecStart=/usr/bin/sensor-oku 100",
      "[Install]",
      "WantedBy=multi-user.target"
    ],
    tumunuGoster: true
  },
  adimlar: [
    { gorev: "Başlangıç", aciklama: "Birim dosyası kurulmuştur, ancak hiçbir hedef onu istememektedir.", vurgula: ["unit"] },
    { gorev: "enable", komut: "systemctl enable sensor-toplayici.service",
      aciklama: "[Install] bölümündeki WantedBy satırı, hedefin .wants dizininde birime bir bağlantı oluşturur. Bu, multi-user.target için bir Wants= bağımlılığıdır.",
      islemler: [{ olustur: { id: "lnk", ad: "sensor-toplayici.service → /usr/lib/…", tur: "metin", etiket: "LINK" }, hedef: "wants", kaynak: "svc" }],
      vurgula: ["wants"], kodSatir: [5, 6] },
    { gorev: "Grafik", komut: "default.target → multi-user.target",
      aciklama: "Açılışta systemd default.target'tan başlayarak tüm Wants/Requires bağımlılıklarını toplar ve bir iş (job) kümesi oluşturur.",
      islemler: [{ olustur: { id: "mu", ad: "multi-user.target (bekliyor)", tur: "surec" }, hedef: "hedef" }],
      vurgula: ["hedef", "wants"] },
    { gorev: "Erken açılış", komut: "sysinit.target, basic.target",
      aciklama: "Dosya sistemleri, udevd ve journald başlar. DefaultDependencies=yes olan servisler basic.target sonrasına sıralanır.",
      islemler: [{ olustur: { id: "bt", ad: "basic.target (ulaşıldı)", tur: "surec" }, hedef: "sys" }],
      vurgula: ["sys"] },
    { gorev: "Paralel başlatma", komut: "systemd-networkd.service",
      aciklama: "Sıralama gerektirmeyen birimler paralel başlatılır. Ağ yöneticisi arayüzü yapılandırırken bekleme servisi bağlantının kurulmasını izler.",
      islemler: [{ kopyala: "nwd", hedef: "ag", yeniId: "nwd2", yeniAd: "systemd-networkd.service (active)" }, { kopyala: "wo", hedef: "ag", yeniId: "wo2", yeniAd: "systemd-networkd-wait-online.service" }],
      vurgula: ["ag"] },
    { gorev: "After= sırası", komut: "After=network-online.target",
      aciklama: "Servis ağın hazır olmasını bekler: network-online.target'a ulaşılmadan sensor-toplayici başlatılmaz. Wants= tek başına bu beklemeyi sağlamazdı.",
      islemler: [{ olustur: { id: "no", ad: "network-online.target (ulaşıldı)", tur: "surec" }, hedef: "ag", kaynak: "wo2" }],
      vurgula: ["ag"], kodSatir: [1, 2] },
    { gorev: "Servis", komut: "ExecStart=/usr/bin/sensor-oku 100",
      aciklama: "Servis başlatılır; Type=simple olduğundan süreç oluşturulduğu an etkin sayılır.",
      islemler: [{ kopyala: "svc", hedef: "hedef", yeniId: "svc2", yeniAd: "sensor-toplayici.service (active)" }],
      vurgula: ["hedef"], kodSatir: [4] },
    { gorev: "Hedefe ulaşıldı", komut: "Reached target multi-user.target",
      aciklama: "multi-user.target'ın tüm istekleri tamamlanmıştır. systemd-analyze critical-chain bu noktaya giden en uzun bekleme zincirini gösterir.",
      islemler: [{ yeniden: "mu", ad: "multi-user.target (ulaşıldı)" }],
      vurgula: ["hedef"] }
  ]
};

/* ================================================================== */
/* Bölüm 7                                                             */
/* ================================================================== */
window.AkisSenaryolari["ag-onyukleme"] = {
  baslik: "Ağdan önyükleme: DHCP, TFTP ile çekirdek, NFS ile kök dosya sistemi",
  istasyonlar: [
    { id: "kart", ad: "Kart: U-Boot", yol: "ipaddr · serverip" },
    { id: "dhcp", ad: "DHCP sunucusu", yol: "10.0.2.2 (QEMU) · 192.168.10.1 (ofis)" },
    { id: "tftp", ad: "TFTP sunucusu", yol: "/srv/tftp/" },
    { id: "dram", ad: "Kart DRAM", yol: "kernel_addr_r = 0x40400000" },
    { id: "nfs", ad: "NFS sunucusu", yol: "/srv/nfs/agecidi" },
    { id: "linux", ad: "Linux", yol: "root=/dev/nfs ip=dhcp" }
  ],
  dosyalar: [
    { id: "srv", ad: "kiralama: 10.0.2.15/24, gw 10.0.2.2", tur: "ag", yer: "dhcp" },
    { id: "img", ad: "Image (9869320 bayt)", tur: "imaj", yer: "tftp" },
    { id: "dtb", ad: "agecidi.dtb", tur: "dts", etiket: "DTB", yer: "tftp" },
    { id: "kok", ad: "kök dosya sistemi (sbin/init …)", tur: "dizin", yer: "nfs" }
  ],
  adimlar: [
    { gorev: "Başlangıç", komut: "setenv autoload no", aciklama: "Kartın diskinde çekirdek yoktur veya kullanılmayacaktır. autoload=no, dhcp komutunun dosya indirmeye çalışmasını önler.",
      vurgula: ["kart"] },
    { gorev: "DHCP", komut: "dhcp",
      aciklama: "U-Boot adres ister; sunucu ipaddr, netmask, gatewayip ve serverip değerlerini verir: DHCP client bound to address 10.0.2.15.",
      islemler: [{ olustur: { id: "ip", ad: "ipaddr=10.0.2.15 serverip=10.0.2.2", tur: "ag" }, hedef: "kart", kaynak: "srv" }],
      vurgula: ["kart", "dhcp"] },
    { gorev: "TFTP: çekirdek", komut: "tftpboot ${kernel_addr_r} Image",
      aciklama: "Çekirdek UDP üzerinden bloklar halinde indirilir ve doğrudan belleğe yazılır: Bytes transferred = 9869320.",
      islemler: [{ kopyala: "img", hedef: "dram", yeniId: "img2", yeniAd: "Image @ 0x40400000" }],
      vurgula: ["tftp", "dram"] },
    { gorev: "TFTP: ağaç", komut: "tftpboot ${fdt_addr_r} agecidi.dtb",
      aciklama: "Gerçek kartta aygıt ağacı da TFTP'den alınır; QEMU'da ağacı QEMU sağladığı için bu adım atlanır.",
      islemler: [{ kopyala: "dtb", hedef: "dram", yeniId: "dtb2", yeniAd: "agecidi.dtb" }],
      vurgula: ["dram"] },
    { gorev: "booti", komut: "setenv bootargs ... root=/dev/nfs nfsroot=... ip=dhcp; booti",
      aciklama: "Komut satırı çekirdeğe kök dosya sisteminin NFS'te olduğunu ve adresi kendisinin alması gerektiğini söyler.",
      islemler: [{ tasi: "img2", hedef: "linux" }, { tasi: "dtb2", hedef: "linux" }],
      vurgula: ["linux"] },
    { gorev: "IP-Config", komut: "IP-Config: Got DHCP answer from 10.0.2.2, my address is 10.0.2.15",
      aciklama: "Çekirdek, kullanıcı alanı başlamadan önce kendi DHCP istemcisiyle adres alır (CONFIG_IP_PNP_DHCP). Bu ileti kitabın QEMU sisteminde gerçekten görülmüştür.",
      islemler: [{ olustur: { id: "ip2", ad: "eth0: 10.0.2.15/24 (çekirdek)", tur: "ag" }, hedef: "linux", kaynak: "srv" }],
      vurgula: ["linux", "dhcp"] },
    { gorev: "NFS kök", komut: "VFS: Mounted root (nfs filesystem) on device 0:…",
      aciklama: "Çekirdek nfsroot ile verilen dizini kök olarak bağlar (bu satır temsilîdir; kitabın çekirdeğinde NFS desteği yoktur). Dosyalar sunucuda kalır, kart yalnızca okuduğunu alır.",
      islemler: [{ kopyala: "kok", hedef: "linux", yeniId: "kok2", yeniAd: "/ (NFS üzerinden)" }],
      vurgula: ["nfs", "linux"] },
    { gorev: "init", komut: "Run /sbin/init as init process",
      aciklama: "init NFS'teki kök dosya sisteminden çalışır. Geliştirme makinesinde paylaşılan dizine kopyalanan bir program kartta anında kullanılabilir.",
      islemler: [{ olustur: { id: "init", ad: "PID 1: /sbin/init", tur: "surec" }, hedef: "linux", kaynak: "kok2" }],
      vurgula: ["linux"] }
  ]
};

/* ================================================================== */
/* Bölüm 8                                                             */
/* ================================================================== */
window.AkisSenaryolari["ftrace-yakalama"] = {
  baslik: "ftrace: işlev izinin yakalanması (function_graph)",
  istasyonlar: [
    { id: "ayar", ad: "tracefs ayarları", yol: "/sys/kernel/tracing/" },
    { id: "kod", ad: "Çekirdek kodu", yol: "okuma_get → ornek_bilgi_oku [ornek_bilgi]" },
    { id: "tampon", ad: "Halka tamponu (CPU başına)", yol: "per_cpu/cpu*/ · buffer_size_kb" },
    { id: "cikti", ad: "Okuma arayüzleri", yol: "trace · trace_pipe" },
    { id: "tc", ad: "trace-cmd (isteğe bağlı)", yol: "trace.dat" }
  ],
  dosyalar: [
    { id: "f1", ad: "okuma_get(): nop (yamalanmamış)", tur: "kaynak", yer: "kod" },
    { id: "f2", ad: "ornek_bilgi_oku(): nop", tur: "kaynak", yer: "kod" }
  ],
  kod: {
    baslik: "komutlar",
    satirlar: [
      "cd /sys/kernel/tracing",
      "echo 0 > options/funcgraph-irqs",
      "echo okuma_get > set_graph_function",
      "echo function_graph > current_tracer",
      "cat /sys/module/ornek_bilgi/parameters/okuma",
      "cat trace",
      "echo nop > current_tracer"
    ],
    tumunuGoster: false
  },
  adimlar: [
    { gorev: "Başlangıç", aciklama: "Dinamik ftrace etkin bir çekirdekte izlenebilir her işlevin başında birkaç komutluk bir yer tutucu bulunur; izleme kapalıyken bunlar nop'tur ve maliyet yok denecek kadar azdır.",
      vurgula: ["kod"] },
    { gorev: "Filtre", komut: "echo okuma_get > set_graph_function",
      aciklama: "function_graph izleyicisine yalnızca okuma_get ile başlayan çağrı ağaçlarının kaydedilmesi söylenir. Kesme işleyicileri funcgraph-irqs=0 ile dışarıda bırakılır.",
      islemler: [{ olustur: { id: "flt", ad: "set_graph_function: okuma_get", tur: "conf" }, hedef: "ayar" }],
      vurgula: ["ayar"], kodGoster: [0, 1, 2], kodSatir: [1, 2] },
    { gorev: "İzleyici", komut: "echo function_graph > current_tracer",
      aciklama: "ftrace, izlenecek işlevlerin başındaki nop'ları izleme rutinine yapılan çağrılarla değiştirir (çalışma anında kod yaması). Giriş ve çıkış zamanları kaydedilecektir.",
      islemler: [{ yeniden: "f1", ad: "okuma_get(): → ftrace_caller" }, { yeniden: "f2", ad: "ornek_bilgi_oku(): → ftrace_caller" }],
      vurgula: ["kod"], kodGoster: [3], kodSatir: [3] },
    { gorev: "Tetikleme", komut: "cat /sys/module/ornek_bilgi/parameters/okuma",
      aciklama: "Parametre okunduğunda okuma_get çalışır ve ornek_bilgi_oku'yu çağırır. Her giriş/çıkış olayı, çalışılan CPU'nun halka tamponuna yazılır.",
      islemler: [
        { olustur: { id: "e1", ad: "okuma_get() { (giriş)", tur: "veri" }, hedef: "tampon", kaynak: "f1" },
        { olustur: { id: "e2", ad: "ornek_bilgi_oku() 238.336 us", tur: "veri" }, hedef: "tampon", kaynak: "f2" },
        { olustur: { id: "e3", ad: "} (çıkış, toplam süre)", tur: "veri" }, hedef: "tampon", kaynak: "f1" }
      ],
      vurgula: ["tampon"], kodGoster: [4], kodSatir: [4] },
    { gorev: "Okuma", komut: "cat trace",
      aciklama: "trace dosyası tamponların anlık görüntüsünü biçimlendirerek gösterir (CPU, süre, girintili çağrı ağacı). trace_pipe ise okunanı tampondan tüketir ve bekleyerek akış sağlar.",
      islemler: [
        { kopyala: "e1", hedef: "cikti", yeniId: "c1", yeniAd: " 1)  | okuma_get [ornek_bilgi]() {" },
        { kopyala: "e2", hedef: "cikti", yeniId: "c2", yeniAd: " 1)  |   ornek_bilgi_oku [ornek_bilgi]();" },
        { kopyala: "e3", hedef: "cikti", yeniId: "c3", yeniAd: " 1)  | }" }
      ],
      vurgula: ["cikti"], kodGoster: [5], kodSatir: [5] },
    { gorev: "trace-cmd", komut: "trace-cmd record -p function_graph -g okuma_get cat …",
      aciklama: "trace-cmd aynı tracefs ayarlarını kendisi yapar, tamponları ham biçimde trace.dat dosyasına kaydeder; dosya başka bir makinede trace-cmd report veya KernelShark ile incelenebilir.",
      islemler: [{ olustur: { id: "dat", ad: "trace.dat (ham kayıt)", tur: "veri", etiket: "DAT" }, hedef: "tc", kaynak: "e1" }],
      vurgula: ["tc"] },
    { gorev: "Kapatma", komut: "echo nop > current_tracer",
      aciklama: "İzleyici kapatılınca çağrılar yeniden nop'a çevrilir; sistem izleme öncesindeki başarımına döner.",
      islemler: [{ yeniden: "f1", ad: "okuma_get(): nop" }, { yeniden: "f2", ad: "ornek_bilgi_oku(): nop" }, { soluk: "e1" }, { soluk: "e2" }, { soluk: "e3" }],
      vurgula: ["kod"], kodGoster: [6], kodSatir: [6] }
  ]
};

/* ================================================================== */
/* Terminal oturumları (uret.py ile kaydedilmiş gerçek çıktılardan)     */
/* ================================================================== */
window.TerminalOturumlari["initramfs-icerik"] = {
 "baslik": "initramfs arşivinin incelenmesi (derleme makinesi)",
 "istem": "gelistirici@derleme:~/agecidi$",
 "adimlar": [
  {
   "komut": "ls -lh initramfs.cpio.gz",
   "cikti": "-rw-r--r-- 1 gelistirici gelistirici 1.6M Nov  3 00:26 initramfs.cpio.gz",
   "aciklama": "kok-olustur.sh, kök dizinini newc biçiminde cpio arşivine çevirip gzip ile sıkıştırmıştır. Arşiv BusyBox, modüller ve ürün yazılımı ile birlikte 1,6 MiB'tır."
  },
  {
   "komut": "zcat initramfs.cpio.gz | cpio -t 2>/dev/null | head -12",
   "cikti": ".\nyenikok\netc\netc/udhcpc.script\netc/profile\netc/group\netc/inittab\netc/init.d\netc/init.d/rcS\netc/mdev.conf\netc/hostname\netc/passwd",
   "aciklama": "cpio -t arşivdeki yolları listeler. Yollar göreli yazılır; çekirdek bunları rootfs'in köküne açar."
  },
  {
   "komut": "zcat initramfs.cpio.gz | cpio -t 2>/dev/null | wc -l",
   "cikti": "324",
   "aciklama": "Arşivde 324 girdi vardır; büyük bölümü /bin/busybox'a işaret eden uygulama bağlantılarıdır."
  },
  {
   "komut": "zcat initramfs.cpio.gz | cpio -t 2>/dev/null | grep -E '^(init|sbin/init|etc/inittab|lib/firmware/ornek/.*|lib/modules/.*/modules.dep)$'",
   "cikti": "etc/inittab\ninit\nsbin/init\nlib/modules/6.18.0-agecidi/modules.dep\nlib/firmware/ornek/kalibrasyon.bin",
   "aciklama": "Açılış için gereken dosyalar: çekirdeğin çalıştıracağı /init, switch_root sonrasında kullanılacak sbin/init ve inittab, modül dizini ve sürücünün isteyeceği ürün yazılımı."
  },
  {
   "komut": "zcat initramfs.cpio.gz | cpio -tv 2>/dev/null | grep -E ' init$| bin/busybox$'",
   "cikti": "-rwxr-xr-x   1 root     root         1454 Nov  3 00:26 init\n-rwxr-xr-x   1 root     root      1914704 Nov  3 00:26 bin/busybox",
   "aciklama": "/init çalıştırılabilir olmalıdır; değilse çekirdek 'check access for rdinit=/init failed' uyarısıyla kök bağlamayı kendisi dener. Arşivdeki sahiplik --owner=0:0 ile root yapılmıştır."
  },
  {
   "komut": "zcat initramfs.cpio.gz | head -c 110 | od -A d -c | head -4",
   "cikti": "0000000   0   7   0   7   0   1   0   0   2   4   8   0   3   0   0   0\n0000016   0   0   4   1   E   D   0   0   0   0   0   0   0   0   0   0\n0000032   0   0   0   0   0   0   0   0   0   0   0   0   0   E   6   A\n0000048   E   9   0   0   1   1   0   0   0   0   0   0   0   0   0   0",
   "aciklama": "Açılmış arşivin ilk baytları newc biçiminin '070701' sihirli dizesidir; ardından onaltılık alanlar (inode, kip …) gelir."
  }
 ]
};
window.TerminalOturumlari["qemu-acilis"] = {
 "baslik": "U-Boot'tan oturum açma istemine: QEMU'da önyükleme zinciri",
 "istem": "gelistirici@derleme:~$",
 "adimlar": [
  {
   "komut": "sh qemu/calistir.sh uboot ~/agecidi",
   "cikti": "U-Boot 2025.10-0ubuntu0.24.04.4 (Oct 07 2026 - 20:58:59 +0000)\nDRAM:  512 MiB\nusing memory 0x5e647000-0x5f687000 for malloc()\nCore:  51 devices, 14 uclasses, devicetree: board\nFlash: 64 MiB\nLoading Environment from Flash... *** Warning - bad CRC, using default environment\nIn:    serial,usbkbd\nOut:   serial,vidconsole\nErr:   serial,vidconsole\nNo USB controllers found\nNet:   eth0: virtio-net#31",
   "aciklama": "QEMU'da Boot ROM, SPL ve TF-A aşamaları yoktur; zincir doğrudan U-Boot ile başlar. U-Boot DRAM boyutunu, flaşı ve virtio ağ aygıtını bulur; ortam flaşta boş olduğu için varsayılan ortam kullanılır."
  },
  {
   "komut": "# (geri sayım biter, bootcmd: bootflow scan -lb)",
   "cikti": "Scanning bootdev 'virtio-blk#29.bootdev':\n  1  extlinux     ready   virtio       1  virtio-blk#29.bootdev.par /extlinux/extlinux.conf\n** Booting bootflow 'virtio-blk#29.bootdev.part_1' with extlinux\nÖrnekOS önyükleme menüsü\n1:    ÖrnekOS (kök: /dev/vda2)\n2:    ÖrnekOS kurtarma (initramfs kabuğu)\nEnter choice: 1:    ÖrnekOS (kök: /dev/vda2)\nRetrieving file: /Image\nappend: console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro\n## Flattened Device Tree blob at 40000000\n   Booting using the fdt blob at 0x40000000\nWorking FDT set to 40000000\n   Loading Device Tree to 000000005d40e000, end 000000005d510fff ... OK\nWorking FDT set to 5d40e000\nStarting kernel ...",
   "aciklama": "Standart önyükleme virtio diskinin 1. bölümünde /extlinux/extlinux.conf dosyasını bulur, menüyü gösterir ve timeout sonunda varsayılan girdiyi seçer. Image yüklenir, fdt satırı olmadığından QEMU'nun ağacı (0x40000000) kullanılır.",
   "istem": "=>"
  },
  {
   "komut": "# (çekirdek iletileri, seçilmiş satırlar)",
   "cikti": "[    0.000000] Booting Linux on physical CPU 0x0000000000 [0x410fd034]\n[    0.000000] Linux version 6.18.0-agecidi (gelistirici@derleme) (aarch64-linux-gnu-gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, GNU ld (GNU Binutils for Ubuntu) 2.42) #5 SMP Tue Nov  3 00:20:21 +03 2026\n[    0.000000] Machine model: linux,dummy-virt\n[    0.000000] psci: PSCIv1.1 detected in firmware.\n[    0.000000] Kernel command line: console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro\n[    0.071712] smp: Brought up 1 node, 2 CPUs\n[    0.127438] Memory: 500616K/524288K available (5056K kernel code, 1126K rwdata, 1360K rodata, 1984K init, 455K bss, 21000K reserved, 0K cma-reserved)\n[    0.214800] 9000000.pl011: ttyAMA0 at MMIO 0x9000000 (irq = 13, base_baud = 0) is a PL011 rev1\n[    0.399290]  vda: vda1 vda2\n[    0.415913] rtc-pl031 9010000.pl031: setting system clock to 2026-11-02T21:29:45 UTC (1793654985)\n[    0.457837] check access for rdinit=/init failed: -2, ignoring\n[    0.498310] VFS: Mounted root (ext4 filesystem) readonly on device 254:2.\n[    0.500674] devtmpfs: mounted\n[    0.530449] Freeing unused kernel memory: 1984K\n[    0.532414] Run /sbin/init as init process",
   "aciklama": "initrd satırı olmadığından /init yoktur: çekirdek uyarı verir, root=/dev/vda2 değerine göre kök dosya sistemini salt okunur bağlar ve /sbin/init'i (BusyBox init) çalıştırır.",
   "istem": " "
  },
  {
   "komut": "# (kullanıcı alanı: rcS ve getty)",
   "cikti": "[    0.876779] EXT4-fs (vda2): re-mounted 6a69c563-b174-4c71-965a-5e543fba6502 r/w.\nrcS: açılış betiği tamamlandı\nagecidi login: root",
   "aciklama": "BusyBox init sysinit adımında rcS betiğini çalıştırır; betik kökü yazılabilir yapar ve ağ ile aygıtları hazırlar. Ardından respawn satırındaki getty oturum açma istemini gösterir.",
   "istem": " "
  },
  {
   "komut": "cat /proc/cmdline",
   "cikti": "console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro",
   "aciklama": "Çekirdeğe ulaşan komut satırı, extlinux.conf dosyasındaki append satırıdır.",
   "istem": "root@agecidi:~#"
  }
 ]
};
window.TerminalOturumlari["uboot-ortam"] = {
 "baslik": "U-Boot ortam değişkenleri ve genişletme zamanı",
 "istem": "=>",
 "adimlar": [
  {
   "komut": "printenv bootcmd boot_targets kernel_addr_r",
   "cikti": "bootcmd=bootflow scan -lb\nboot_targets=qfw usb scsi virtio nvme dhcp\nkernel_addr_r=0x40400000",
   "aciklama": "Varsayılan ortamdan üç değişken. bootcmd otomatik önyüklemede çalıştırılır; boot_targets standart önyüklemenin tarama sırasıdır.",
   "istem": "=>"
  },
  {
   "komut": "setenv yol virtio",
   "cikti": "",
   "aciklama": "Bir değişken tanımlanır.",
   "istem": "=>"
  },
  {
   "komut": "setenv a1 \"echo yol=${yol}\"",
   "cikti": "",
   "aciklama": "Çift tırnak: ${yol} bu komut ayrıştırılırken genişletilir; a1'e 'virtio' değeri yazılır.",
   "istem": "=>"
  },
  {
   "komut": "setenv a2 'echo yol=${yol}'",
   "cikti": "",
   "aciklama": "Tek tırnak: ifade olduğu gibi saklanır; genişletme çalıştırma anına kalır.",
   "istem": "=>"
  },
  {
   "komut": "printenv a1 a2",
   "cikti": "a1=echo yol=virtio\na2=echo yol=${yol}",
   "aciklama": "Fark saklanan değerlerde görülür.",
   "istem": "=>"
  },
  {
   "komut": "setenv yol dhcp",
   "cikti": "",
   "aciklama": "Değişkenin değeri değiştirilir.",
   "istem": "=>"
  },
  {
   "komut": "run a1; run a2",
   "cikti": "yol=virtio\nyol=dhcp",
   "aciklama": "a1 eski değeri, a2 güncel değeri yazdırır. bootcmd gibi zincirler bu nedenle tek tırnakla tanımlanır.",
   "istem": "=>"
  },
  {
   "komut": "saveenv",
   "cikti": "Saving Environment to Flash... Un-Protected 2 sectors\nErasing Flash...\n.. done\nErased 2 sectors\nWriting to Flash... Flash buffer write timeout at address 4000000 data ffffffffbf586361\nTimeout writing to Flash\nProtected 2 sectors\nFailed (1)",
   "aciklama": "QEMU'nun CFI flaş benzetimi U-Boot'un tampon yazma kipini desteklemediği için kayıt bu ortamda başarısız olmuştur. Gerçek kartlarda çıktı 'Saving Environment to MMC... OK' biçimindedir. Bu kitapta ortam, flaş imajına derleme makinesinde mkenvimage ile yazılır (sonraki oturum).",
   "istem": "=>"
  },
  {
   "komut": "printenv hostname ekargs boot_targets",
   "cikti": "hostname=agecidi\nekargs=loglevel=7\nboot_targets=virtio dhcp",
   "aciklama": "flash1.img içine mkenvimage ile yazılmış ortamla açılış: 'Loading Environment from Flash... OK' görülür ve kitabın değişkenleri yüklüdür.",
   "istem": "=>"
  },
  {
   "komut": "run ayarla_args",
   "cikti": "",
   "aciklama": "ayarla_args, bootargs değerini konsol, kök ve ek parametre parçalarından oluşturur.",
   "istem": "=>"
  },
  {
   "komut": "printenv bootargs",
   "cikti": "bootargs=console=ttyAMA0,115200 root=/dev/vda2 rootfstype=ext4 rootwait ro loglevel=7",
   "aciklama": "ekargs değeri Linux'tan fw_setenv ile yazılmıştır ve sonuca eklenmiştir.",
   "istem": "=>"
  }
 ]
};
window.TerminalOturumlari["fw-printenv"] = {
 "baslik": "Ortam bloğunun üretilmesi ve Linux'tan değiştirilmesi",
 "istem": "gelistirici@derleme:~/agecidi/ortam$",
 "adimlar": [
  {
   "komut": "mkenvimage -s 0x40000 -o uboot-env.bin ~/cekirdek-onyukleme/examples/u-boot/uboot-env.txt",
   "cikti": "",
   "aciklama": "mkenvimage metin dosyasındaki ad=değer satırlarından (# ile başlayan satırlar atlanır) U-Boot'un CONFIG_ENV_SIZE boyutunda bir blok üretir."
  },
  {
   "komut": "ls -l uboot-env.bin",
   "cikti": "-rw-r----- 1 gelistirici gelistirici 262144 Nov  3 00:38 uboot-env.bin",
   "aciklama": "Blok tam 0x40000 = 262144 bayttır."
  },
  {
   "komut": "od -A x -t x1z -N 32 uboot-env.bin",
   "cikti": "000000 be a4 f6 91 61 72 63 68 3d 61 72 6d 00 62 61 75  >....arch=arm.bau<\n000010 64 72 61 74 65 3d 31 31 35 32 30 30 00 62 6f 61  >drate=115200.boa<\n000020",
   "aciklama": "İlk 4 bayt CRC32 değeridir; ardından değişkenler NUL karakteriyle ayrılmış olarak gelir."
  },
  {
   "komut": "truncate -s 64M flash1.img && dd if=uboot-env.bin of=flash1.img conv=notrunc status=none",
   "cikti": "",
   "aciklama": "Blok, QEMU'nun ikinci flaş bankasının (U-Boot'ta CONFIG_ENV_ADDR=0x4000000) başına yazılır."
  },
  {
   "komut": "cp ~/cekirdek-onyukleme/examples/u-boot/fw_env.config . && cat fw_env.config | grep -v '^#'",
   "cikti": "flash1.img              0x0      0x40000",
   "aciklama": "fw_env.config aygıtı (burada bir dosya), ofseti ve boyutu tanımlar; değerler U-Boot yapılandırmasıyla aynı olmalıdır."
  },
  {
   "komut": "fw_printenv -c fw_env.config bootcmd kok",
   "cikti": "bootcmd=bootflow scan -lb\nkok=root=/dev/vda2 rootfstype=ext4 rootwait ro",
   "aciklama": "libubootenv'in fw_printenv aracı CRC'yi doğrulayıp değişkenleri okur."
  },
  {
   "komut": "fw_setenv -c fw_env.config ekargs loglevel=7",
   "cikti": "",
   "aciklama": "fw_setenv yeni bir değişken yazar ve CRC'yi yeniden hesaplar. Bir sahadaki cihazda güncelleme ajanları bu yöntemi kullanır."
  },
  {
   "komut": "fw_printenv -c fw_env.config ekargs",
   "cikti": "ekargs=loglevel=7",
   "aciklama": "U-Boot bir sonraki açılışta bu değeri görür (önceki oturumdaki bootargs çıktısı)."
  }
 ]
};
window.TerminalOturumlari["uboot-bootflow"] = {
 "baslik": "Standart önyükleme: yöntemler, bulunan girdiler ve elle önyükleme",
 "istem": "=>",
 "adimlar": [
  {
   "komut": "bootmeth list",
   "cikti": "Order  Seq  Name                Description\n-----  ---  ------------------  ------------------\n    0    0  extlinux            Extlinux boot from a block device\n    1    1  script              Script boot from a block device\n glob    2  efi_mgr             EFI bootmgr flow\n    3    3  efi                 EFI boot from an .efi file\n    4    4  qfw                 QEMU boot using firmware interface\n    5    5  pxe                 PXE boot from a network device\n glob    6  vbe_simple          VBE simple\n-----  ---  ------------------  ------------------\n(7 bootmeths)",
   "aciklama": "Önyükleme yöntemleri ve sırası. extlinux, script'ten önce denenir; 'glob' yöntemler aygıttan bağımsızdır.",
   "istem": "=>"
  },
  {
   "komut": "bootflow scan -l",
   "cikti": "Scanning for bootflows in all bootdevs\nSeq  Method       State   Uclass    Part  Name                      Filename\n---  -----------  ------  --------  ----  ------------------------  ----------------\nScanning global bootmeth 'efi_mgr':\n\u001b7\u001b8Cannot persist EFI variables without system partition\nMissing TPMv2 device for EFI_TCG_PROTOCOL\n  0  efi_mgr      ready   (none)       0  <NULL>                    \nScanning bootdev 'fw-cfg@9020000.bootdev':\nfatal: no kernel available\nscanning bus for devices...\nScanning bootdev 'virtio-blk#29.bootdev':\n  1  extlinux     ready   virtio       1  virtio-blk#29.bootdev.par /extlinux/extlinux.conf\n  2  script       ready   virtio       1  virtio-blk#29.bootdev.par /boot.scr\nScanning bootdev 'virtio-net#31.bootdev':\nBOOTP broadcast 1\nDHCP client bound to address 10.0.2.15 (2 ms)\n*** Warning: no boot file name; using '0A00020F.img'\nUsing virtio-net#31 device\nTFTP from server 10.0.2.2; our IP address is 10.0.2.15\nFilename '0A00020F.img'.\nLoad address: 0x40400000\nLoading: *\b\nTFTP error: 'File not found' (1)\nNot retrying...\nNo more bootdevs\n---  -----------  ------  --------  ----  ------------------------  ----------------\n(3 bootflows, 3 valid)",
   "aciklama": "Tüm aygıtlar taranır. virtio diskinin 1. bölümünde hem extlinux.conf hem boot.scr bulunur. Ağ aygıtında DHCP sunucusu bir dosya adı vermediği için PXE denemesi başarısız olur.",
   "istem": "=>"
  },
  {
   "komut": "part list virtio 0",
   "cikti": "Partition Map for virtio device 0  --   Partition Type: DOS\nPart    Start Sector    Num Sectors    UUID        Type\n  1    2048          98304         6f39129b-01    83 Boot\n  2    100352        196608        6f39129b-02    83",
   "aciklama": "Disk imajının MBR bölüm tablosu: 1. bölüm önyükleme, 2. bölüm kök dosya sistemi.",
   "istem": "=>"
  },
  {
   "komut": "ls virtio 0:1 /",
   "cikti": "            ./\n            ../\n            lost+found/\n  9869320   Image\n      926   boot.scr\n            extlinux/\n  1592981   initramfs.cpio.gz\n 12512244   ornek.itb\n4 file(s), 4 dir(s)",
   "aciklama": "Önyükleme bölümünün içeriği (ext4).",
   "istem": "=>"
  },
  {
   "komut": "setenv bootargs console=ttyAMA0,115200 root=/dev/vda2 rootwait ro loglevel=8",
   "cikti": "",
   "aciklama": "Elle önyükleme için komut satırı.",
   "istem": "=>"
  },
  {
   "komut": "load virtio 0:1 ${kernel_addr_r} Image",
   "cikti": "9869320 bytes read in 20 ms (470.6 MiB/s)",
   "aciklama": "Çekirdek kernel_addr_r adresine yüklenir; okunan bayt sayısı yazdırılır.",
   "istem": "=>"
  },
  {
   "komut": "printenv filesize",
   "cikti": "filesize=969808",
   "aciklama": "Boyut onaltılık olarak filesize değişkenindedir (0x969808 = 9869320).",
   "istem": "=>"
  },
  {
   "komut": "cat /proc/cmdline",
   "cikti": "console=ttyAMA0,115200 root=/dev/vda2 rootwait ro loglevel=8",
   "aciklama": "Linux açıldıktan sonra: bootargs çekirdeğe ulaşmıştır.",
   "istem": "root@agecidi:~#"
  },
  {
   "komut": "tr -d '\\0' < /proc/device-tree/chosen/bootargs; echo",
   "cikti": "console=ttyAMA0,115200 root=/dev/vda2 rootwait ro loglevel=8",
   "aciklama": "Aynı değer, U-Boot'un aygıt ağacının /chosen düğümüne yazdığı özelliktir.",
   "istem": "root@agecidi:~#"
  }
 ]
};
window.TerminalOturumlari["mkimage-fit"] = {
 "baslik": "FIT imajı ve önyükleme betiği: üretim, doğrulama, bozulmanın yakalanması",
 "istem": "gelistirici@derleme:~/agecidi$",
 "adimlar": [
  {
   "komut": "mkimage -f ornek.its ornek.itb | head -14",
   "cikti": "FIT description: ÖrnekOS FIT imajı (agecidi)\nCreated:         Tue Nov  3 00:38:36 2026\n Image 0 (kernel-1)\n  Description:  Linux 6.18 çekirdeği\n  Created:      Tue Nov  3 00:38:36 2026\n  Type:         Kernel Image\n  Compression:  uncompressed\n  Data Size:    9869320 Bytes = 9638.01 KiB = 9.41 MiB\n  Architecture: AArch64\n  OS:           Linux\n  Load Address: 0x40400000\n  Entry Point:  0x40400000\n  Hash algo:    sha256\n  Hash value:   3a28893477dc4775faf81b00888d158a14333f87c9ac9fabcc35ad8c6454fb46",
   "aciklama": "mkimage, .its dosyasındaki her parçayı okur, sha256 özetini hesaplar ve sonucu listeler (çıktının başı)."
  },
  {
   "komut": "dumpimage -l ornek.itb | sed -n '/Configuration 0/,$p'",
   "cikti": " Configuration 0 (conf-1)\n  Description:  agecidi: çekirdek + initramfs + dtb\n  Kernel:       kernel-1\n  Init Ramdisk: ramdisk-1\n  FDT:          fdt-1",
   "aciklama": "Yapılandırma conf-1 üç parçayı birleştirir."
  },
  {
   "komut": "ls -l Image initramfs.cpio.gz virt.dtb ornek.itb",
   "cikti": "-rw-r--r-- 1 gelistirici gelistirici  9869320 Nov  3 00:26 Image\n-rw-r--r-- 1 gelistirici gelistirici  1592981 Nov  3 00:26 initramfs.cpio.gz\n-rw-r--r-- 1 gelistirici gelistirici 12512244 Nov  3 00:38 ornek.itb\n-rw-r--r-- 1 gelistirici gelistirici  1048576 Nov  3 00:26 virt.dtb",
   "aciklama": "FIT dosyası, parçaların toplamı kadardır (QEMU'nun ağacı 1 MiB'a doldurulmuş olarak dışa aktarılır)."
  },
  {
   "komut": "mkimage -A arm64 -O linux -T script -C none -n 'ornekos boot' -d ~/cekirdek-onyukleme/examples/u-boot/boot.cmd boot.scr",
   "cikti": "Image Name:   ornekos boot\nCreated:      Tue Nov  3 00:38:36 2026\nImage Type:   AArch64 Linux Script (uncompressed)\nData Size:    862 Bytes = 0.84 KiB = 0.00 MiB\nLoad Address: 00000000\nEntry Point:  00000000\nContents:\n   Image 0: 854 Bytes = 0.83 KiB = 0.00 MiB",
   "aciklama": "boot.cmd metni 64 baytlık uImage başlığıyla paketlenir."
  },
  {
   "komut": "mkimage -l boot.scr",
   "cikti": "Image Name:   ornekos boot\nCreated:      Tue Nov  3 00:38:36 2026\nImage Type:   AArch64 Linux Script (uncompressed)\nData Size:    862 Bytes = 0.84 KiB = 0.00 MiB\nLoad Address: 00000000\nEntry Point:  00000000\nContents:\n   Image 0: 854 Bytes = 0.83 KiB = 0.00 MiB",
   "aciklama": "Başlık türü 'Script' olarak görünür; U-Boot'un script önyükleme yöntemi bu dosyayı tanır."
  },
  {
   "komut": "bootmeth order script; bootflow scan -lb",
   "istem": "=>",
   "cikti": "Scanning for bootflows in all bootdevs\nSeq  Method       State   Uclass    Part  Name                      Filename\n---  -----------  ------  --------  ----  ------------------------  ----------------\nScanning bootdev 'fw-cfg@9020000.bootdev':\nscanning bus for devices...\nScanning bootdev 'virtio-blk#29.bootdev':\n  0  script       ready   virtio       1  virtio-blk#29.bootdev.par /boot.scr\n** Booting bootflow 'virtio-blk#29.bootdev.part_1' with script\nboot.scr: virtio 0:1 bölümünden yükleniyor\n9869320 bytes read in 7 ms (1.3 GiB/s)\n1592981 bytes read in 1 ms (1.5 GiB/s)\n## Flattened Device Tree blob at 40000000\n   Booting using the fdt blob at 0x40000000",
   "aciklama": "U-Boot'ta yalnızca script yöntemi bırakılarak betik çalıştırılır: devtype, devnum ve distro_bootpart değişkenleri yöntem tarafından atanmış ve betikteki echo satırında 'virtio 0:1' olarak genişlemiştir. İki load komutu çekirdeği ve initramfs'i okur."
  },
  {
   "komut": "bootm 0x48000000#conf-1",
   "istem": "=>",
   "cikti": "## Loading kernel (any) from FIT Image at 48000000 ...\n   Using 'conf-1' configuration\n   Verifying Hash Integrity ... OK\n   Trying 'kernel-1' kernel subimage\n     Description:  Linux 6.18 çekirdeği\n     Created:      2026-11-02  21:26:45 UTC\n     Type:         Kernel Image\n     Compression:  uncompressed\n     Data Start:   0x480000d8\n     Data Size:    9869320 Bytes = 9.4 MiB\n     Architecture: AArch64\n     OS:           Linux\n     Load Address: 0x40400000\n     Entry Point:  0x40400000\n     Hash algo:    sha256\n     Hash value:   3a28893477dc4775faf81b00888d158a14333f87c9ac9fabcc35ad8c6454fb46\n   Verifying Hash Integrity ... sha256+ OK",
   "aciklama": "U-Boot'ta (load ile 0x48000000 adresine yüklendikten sonra): çekirdek parçasının özeti yeniden hesaplanır ve doğrulanır."
  },
  {
   "komut": "# (ramdisk ve fdt de doğrulanır, parçalar yerleştirilir)",
   "istem": " ",
   "cikti": "   Booting using the fdt blob at 0x48aee954\nWorking FDT set to 48aee954\n   Loading Kernel Image to 40400000\n   Loading Ramdisk to 5d3b1000, end 5d535e95 ... OK\n   Loading Device Tree to 000000005d2ae000, end 000000005d3b0fff ... OK\nWorking FDT set to 5d2ae000\nStarting kernel ...",
   "aciklama": "Çekirdek load adresine kopyalanır, initramfs ve aygıt ağacı DRAM'in üst bölgesine taşınır ve çekirdek başlatılır."
  },
  {
   "komut": "mw.l ${veri} 0xdeadbeef 1; bootm 0x48000000#conf-1",
   "istem": "=>",
   "hata": true,
   "cikti": "   Verifying Hash Integrity ... sha256 error!\nBad hash value for 'hash-1' hash node in 'kernel-1' image node\nBad Data Hash\nERROR -2: can't get kernel image!",
   "aciklama": "fdt get addr ile çekirdek verisinin adresi bulunup ilk 4 baytı değiştirildiğinde özet tutmaz ve bootm durur."
  }
 ]
};
window.TerminalOturumlari["kconfig-derleme"] = {
 "baslik": "Yapılandırma parçası: birleştirme, bağımlılık denetimi ve üretilen dosyalar",
 "istem": "gelistirici@derleme:~/linux$",
 "adimlar": [
  {
   "yorum": true,
   "komut": "Parçanın ilk sürümü (eski.config) CONFIG_BLK_DEV satırını içermiyordu"
  },
  {
   "komut": "scripts/kconfig/merge_config.sh -n -O ~/agecidi/deneme ~/agecidi/eski.config | tail -4",
   "cikti": "Value requested for CONFIG_VIRTIO_BLK not in final .config\nRequested value:  CONFIG_VIRTIO_BLK=y\nActual value:",
   "aciklama": "-m olmadan çalışan merge_config.sh, birleştirme sonunda parçadaki her değeri .config ile karşılaştırır: VIRTIO_BLK sonuca girmemiştir.",
   "hata": true
  },
  {
   "komut": "grep -n -E '^menuconfig BLK_DEV|^if BLK_DEV|^config VIRTIO_BLK' drivers/block/Kconfig",
   "cikti": "6:menuconfig BLK_DEV\n17:if BLK_DEV\n307:config VIRTIO_BLK",
   "aciklama": "Neden Kconfig dosyasında görülür: VIRTIO_BLK, BLK_DEV menüsünün if bloğu içinde tanımlıdır; BLK_DEV kapalıyken seçenek görünmez ve n olur."
  },
  {
   "komut": "scripts/kconfig/merge_config.sh -n -O ~/agecidi/deneme ~/cekirdek-onyukleme/examples/cekirdek/agecidi.config > ~/agecidi/birlestir.log",
   "cikti": "",
   "aciklama": "Düzeltilmiş parça (CONFIG_BLK_DEV=y eklenmiş) yeniden birleştirilir; günlük dosyaya yazılır."
  },
  {
   "komut": "grep -c 'Value requested' ~/agecidi/birlestir.log",
   "cikti": "0",
   "aciklama": "Artık sonuca girmeyen değer yoktur."
  },
  {
   "komut": "grep -E '^CONFIG_(LOCALVERSION|VIRTIO_BLK|HW_RANDOM_VIRTIO)=|CONFIG_IPV6 ' ~/agecidi/cekirdek/.config",
   "cikti": "CONFIG_LOCALVERSION=\"-agecidi\"\n# CONFIG_IPV6 is not set\nCONFIG_VIRTIO_BLK=y\nCONFIG_HW_RANDOM_VIRTIO=m",
   "aciklama": "Asıl derleme dizinindeki .config: yerel sürüm eki, kapalı IPv6, gömülü (y) disk sürücüsü ve modül (m) RNG sürücüsü."
  },
  {
   "komut": "grep -E 'CONFIG_(VIRTIO_BLK|HW_RANDOM_VIRTIO)' ~/agecidi/cekirdek/include/generated/autoconf.h",
   "cikti": "#define CONFIG_VIRTIO_BLK 1\n#define CONFIG_HW_RANDOM_VIRTIO_MODULE 1",
   "aciklama": "C tarafı: y değerli seçenek CONFIG_VIRTIO_BLK, m değerli seçenek CONFIG_HW_RANDOM_VIRTIO_MODULE olarak tanımlanır."
  },
  {
   "komut": "grep -E '^CONFIG_(VIRTIO_BLK|HW_RANDOM_VIRTIO)=' ~/agecidi/cekirdek/include/config/auto.conf",
   "cikti": "CONFIG_VIRTIO_BLK=y\nCONFIG_HW_RANDOM_VIRTIO=m",
   "aciklama": "Makefile tarafı: auto.conf, değerleri Make değişkeni olarak taşır."
  },
  {
   "komut": "grep -E 'VIRTIO_BLK|HW_RANDOM_VIRTIO' drivers/block/Makefile drivers/char/hw_random/Makefile",
   "cikti": "drivers/block/Makefile:obj-$(CONFIG_VIRTIO_BLK)    += virtio_blk.o\ndrivers/char/hw_random/Makefile:obj-$(CONFIG_HW_RANDOM_VIRTIO) += virtio-rng.o",
   "aciklama": "Kbuild Makefile'larında aynı seçenekler obj-$(CONFIG_…) listelerini belirler."
  },
  {
   "komut": "ls ~/agecidi/cekirdek/drivers/block/virtio_blk.o ~/agecidi/cekirdek/drivers/char/hw_random/*.ko",
   "cikti": "/home/gelistirici/agecidi/cekirdek/drivers/block/virtio_blk.o\n/home/gelistirici/agecidi/cekirdek/drivers/char/hw_random/rng-core.ko\n/home/gelistirici/agecidi/cekirdek/drivers/char/hw_random/virtio-rng.ko",
   "aciklama": "Sonuç: virtio_blk.o çekirdeğin parçası olarak derlenmiştir (.o, built-in.a üzerinden vmlinux'a girer); RNG sürücüleri ayrı .ko dosyalarıdır."
  }
 ]
};
window.TerminalOturumlari["cekirdek-ciktilari"] = {
 "baslik": "Derleme çıktıları ve modül kurulumu",
 "istem": "gelistirici@derleme:~/agecidi/cekirdek$",
 "adimlar": [
  {
   "komut": "ls -lh vmlinux System.map arch/arm64/boot/Image",
   "cikti": "-rw-r--r-- 1 gelistirici gelistirici 1.7M Nov  3 00:20 System.map\n-rw-r--r-- 1 gelistirici gelistirici 9.5M Nov  3 00:20 arch/arm64/boot/Image\n-rwxr-xr-x 1 gelistirici gelistirici 109M Nov  3 00:20 vmlinux",
   "aciklama": "vmlinux hata ayıklama bilgisiyle 109 MiB, önyüklenecek Image 9,5 MiB'tır. İkisi ve System.map aynı derlemeden saklanmalıdır."
  },
  {
   "komut": "file vmlinux arch/arm64/boot/Image | cut -c1-110",
   "cikti": "vmlinux:               ELF 64-bit LSB pie executable, ARM aarch64, version 1 (SYSV), statically linked, BuildI\narch/arm64/boot/Image: Linux kernel ARM64 boot executable Image, little-endian, 4K pages",
   "aciklama": "vmlinux bir ELF dosyasıdır; Image ise ARM64 önyükleme başlıklı ham ikilidir."
  },
  {
   "komut": "od -A x -t x1z -N 64 arch/arm64/boot/Image | tail -2",
   "cikti": "000030 00 00 00 00 00 00 00 00 41 52 4d 64 00 00 00 00  >........ARMd....<\n000040",
   "aciklama": "Image başlığının 0x38 ofsetinde 'ARM\\x64' sihirli değeri bulunur; önyükleyiciler (booti) dosyayı bununla tanır."
  },
  {
   "komut": "grep -w -E 'primary_entry|start_kernel|kernel_init' System.map",
   "cikti": "ffff8000804f33e8 t kernel_init\nffff800080659088 T primary_entry\nffff800080660a18 T start_kernel",
   "aciklama": "System.map: açılış zincirinin işlevleri ve sanal adresleri. T dışa açık, t yerel metin sembolüdür."
  },
  {
   "komut": "make -s -C ~/linux O=$PWD kernelrelease",
   "cikti": "6.18.0-agecidi",
   "aciklama": "Sürüm dizesi: Makefile'daki 6.18.0 ve CONFIG_LOCALVERSION. Modüller /lib/modules/<bu dize>/ altında aranır."
  },
  {
   "komut": "make -s -C ~/linux O=$PWD INSTALL_MOD_PATH=$HOME/agecidi/kurulum modules_install",
   "cikti": "",
   "aciklama": "Modüller hedefin kök dizinini temsil eden bir dizine kurulur; INSTALL_MOD_PATH verilmezse derleme makinesinin /lib/modules dizini kullanılırdı."
  },
  {
   "komut": "find ~/agecidi/kurulum -name '*.ko' | sed 's#.*/lib/modules/#lib/modules/#'",
   "cikti": "lib/modules/6.18.0-agecidi/kernel/drivers/char/hw_random/virtio-rng.ko\nlib/modules/6.18.0-agecidi/kernel/drivers/char/hw_random/rng-core.ko",
   "aciklama": "Kurulan modüller kaynak ağacındaki yollarıyla kernel/ altına yerleşir."
  },
  {
   "komut": "cat ~/agecidi/kurulum/lib/modules/6.18.0-agecidi/modules.dep",
   "cikti": "kernel/drivers/char/hw_random/rng-core.ko:\nkernel/drivers/char/hw_random/virtio-rng.ko: kernel/drivers/char/hw_random/rng-core.ko",
   "aciklama": "depmod'un ürettiği modules.dep: virtio-rng, rng-core'a bağımlıdır."
  }
 ]
};
window.TerminalOturumlari["dtc-derleme"] = {
 "baslik": "Aygıt ağacının derlenmesi, incelenmesi ve doğrulanması",
 "istem": "gelistirici@derleme:~/cekirdek-onyukleme/examples$",
 "adimlar": [
  {
   "komut": "sh dts/derle-dtb.sh ~/linux cikti",
   "cikti": "-rw-r--r-- 1 gelistirici gelistirici 2649 Nov  3 00:39 cikti/agecidi-ek.dtb\n-rw-r--r-- 1 gelistirici gelistirici 2553 Nov  3 00:39 cikti/agecidi.dtb\n-rw-r--r-- 1 gelistirici gelistirici  394 Nov  3 00:39 cikti/sensor-ek.dtbo",
   "aciklama": "Betik iki kaynağı cpp + dtc ile derler, bindirmeyi uygular ve üç çıktıyı listeler. dtc'nin uyarı vermemesi temel kuralların sağlandığını gösterir."
  },
  {
   "komut": "grep -n 'interrupts = <0 1 4>' cikti/agecidi.dts.tmp",
   "cikti": "78:   interrupts = <0 1 4>;",
   "aciklama": "Ön işlemci makroları açmıştır: GIC_SPI 1 IRQ_TYPE_LEVEL_HIGH → 0 1 4."
  },
  {
   "komut": "fdtdump cikti/agecidi.dtb 2>/dev/null | sed -n '2,4p;7p'",
   "cikti": "// magic:        0xd00dfeed\n// totalsize:        0x9f9 (2553)\n// off_dt_struct:    0x38\n// version:        17",
   "aciklama": "FDT başlığı: sihirli sayı 0xd00dfeed, toplam boyut ve biçim sürümü 17."
  },
  {
   "komut": "fdtget -t s cikti/agecidi.dtb /soc/i2c@9040000/sensor@48 compatible",
   "cikti": "ti,tmp102",
   "aciklama": "fdtget bir özelliği okur; yol, birim adresi olmadan da yazılabilir (/soc)."
  },
  {
   "komut": "fdtget -t x cikti/agecidi.dtb /soc/serial@9000000 interrupts",
   "cikti": "0 1 4",
   "aciklama": "Kesme özelliğinin üç hücresi: SPI, numara 1, düzey tetiklemeli (4)."
  },
  {
   "komut": "fdtget -l cikti/agecidi.dtb /soc",
   "cikti": "interrupt-controller@8000000\nserial@9000000\ngpio@9030000\ni2c@9040000",
   "aciklama": "soc@0 veri yolunun alt düğümleri; status değerinden bağımsız olarak hepsi ağaçtadır."
  },
  {
   "komut": "fdtget cikti/agecidi.dtb /__symbols__ i2c0",
   "cikti": "/soc@0/i2c@9040000",
   "aciklama": "-@ ile eklenen simge tablosu: etiket adı → düğüm yolu."
  },
  {
   "komut": "dtc -I dtb -O dts cikti/sensor-ek.dtbo",
   "cikti": "/dts-v1/;\n\n/ {\n\n    fragment@0 {\n        target = <0xffffffff>;\n\n        __overlay__ {\n            #address-cells = <0x01>;\n            #size-cells = <0x00>;\n\n            sensor@49 {\n                compatible = \"ti,tmp102\";\n                reg = <0x49>;\n                label = \"kabin\";\n                #thermal-sensor-cells = <0x01>;\n            };\n        };\n    };\n\n    __fixups__ {\n        i2c0 = \"/fragment@0:target:0\";\n    };\n};",
   "aciklama": "Çözülmüş bindirme: hedef henüz bilinmediği için 0xffffffff, çözülecek ad __fixups__ düğümündedir."
  },
  {
   "komut": "fdtget -l cikti/agecidi-ek.dtb /soc/i2c@9040000",
   "cikti": "sensor@49\nsensor@48",
   "aciklama": "fdtoverlay sonrasında I²C denetleyicisinin altında iki sensör vardır."
  },
  {
   "komut": "dt-validate -m -s ~/agecidi/semalar.json cikti/agecidi.dtb",
   "cikti": "cikti/agecidi.dtb: /: failed to match any schema with compatible: ['ornek,agecidi', 'ornek,soc1']\ncikti/agecidi.dtb: /: failed to match any schema with compatible: ['ornek,agecidi', 'ornek,soc1']",
   "aciklama": "Bağlamalara göre doğrulama: yalnızca hayalî kartın kök compatible değeri için şema bulunmadığı bildirilir; düğümlerde hata yoktur."
  },
  {
   "komut": "sed 's/label = \"ortam\";/&\\n\\t\\tornek,kanal-sayisi = <4>;/' dts/agecidi.dts > dts/hatali.dts",
   "cikti": "",
   "aciklama": "Denemek için sensör düğümüne bağlamada olmayan bir özellik eklenir."
  },
  {
   "komut": "cpp -nostdinc -undef -D__DTS__ -x assembler-with-cpp -I dts -I ~/linux/include -o cikti/hatali.tmp dts/hatali.dts && dtc -I dts -O dtb -o cikti/hatali.dtb cikti/hatali.tmp",
   "cikti": "",
   "aciklama": "dtc bu dosyayı da hatasız derler: dtc sözdizimini denetler, bağlamaları bilmez."
  },
  {
   "komut": "dt-validate -s ~/agecidi/semalar.json cikti/hatali.dtb 2>&1 | cut -c1-120 | head -4",
   "cikti": "cikti/hatali.dtb: sensor@48 (ti,tmp102): 'ornek,kanal-sayisi' does not match any of the regexes: '^pinctrl-[0-9]+$'\n    from schema $id: http://devicetree.org/schemas/hwmon/ti,tmp102.yaml\ncikti/hatali.dtb: sensor@48 (ti,tmp102): ornek,kanal-sayisi: b'\\x00\\x00\\x00\\x04' is not of type 'object', 'integer', 'ar\n    from schema $id: http://devicetree.org/schemas/dt-core.yaml",
   "aciklama": "dt-validate ise ti,tmp102.yaml şemasındaki additionalProperties: false kuralına göre özelliği reddeder (satırlar kısaltılmıştır).",
   "hata": true
  }
 ]
};
window.TerminalOturumlari["proc-devicetree"] = {
 "baslik": "Çalışan sistemde aygıt ağacı: /proc/device-tree",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "ls -l /proc/device-tree",
   "cikti": "lrwxrwxrwx    1 root     root            29 Nov  2 21:26 /proc/device-tree -> /sys/firmware/devicetree/base",
   "aciklama": "/proc/device-tree, sysfs'teki ağaca bir bağlantıdır (drivers/of/base.c)."
  },
  {
   "komut": "cat /proc/device-tree/model; echo",
   "cikti": "linux,dummy-virt\u0000",
   "aciklama": "Kök düğümün model özelliği. Bu ağacı QEMU üretmiştir."
  },
  {
   "komut": "ls /proc/device-tree | head -12",
   "cikti": "#address-cells\n#size-cells\napb-pclk\nchosen\ncompatible\ncpus\nflash@0\nfw-cfg@9020000\ngpio-keys\nintc@8000000\ninterrupt-parent\nmemory@40000000",
   "aciklama": "Kök düğümün özellikleri dosya, alt düğümleri dizin olarak görünür. gpio-keys düğümü, QEMU'nun -bios verilmeden açıldığında eklediği PL061 GPIO birimine aittir."
  },
  {
   "komut": "tr '\\0' '\\n' < /proc/device-tree/pl011@9000000/compatible",
   "cikti": "arm,pl011\narm,primecell",
   "aciklama": "Dize listeleri NUL karakteriyle ayrılmış olarak saklanır."
  },
  {
   "komut": "hexdump -C /proc/device-tree/pl011@9000000/reg",
   "cikti": "00000000  00 00 00 00 09 00 00 00  00 00 00 00 00 00 10 00  |................|\n00000010",
   "aciklama": "reg değeri ham baytlardır: büyük uçlu dört hücre (adres 0x0_09000000, boyut 0x0_00001000)."
  },
  {
   "komut": "cat /proc/device-tree/chosen/bootargs; echo",
   "cikti": "console=ttyAMA0,115200 root=/dev/vda2 \u0000",
   "aciklama": "QEMU'nun -append ile verdiği komut satırı /chosen/bootargs özelliğine yazılmıştır."
  },
  {
   "komut": "hexdump -C /proc/device-tree/chosen/linux,initrd-start",
   "cikti": "00000000  00 00 00 00 48 00 00 00                           |....H...|\n00000008",
   "aciklama": "initramfs'in fiziksel adresi (0x48000000); çekirdek arşivi buradan açmıştır."
  },
  {
   "komut": "readlink -f /sys/bus/amba/devices/9000000.pl011/of_node",
   "cikti": "/sys/firmware/devicetree/base/pl011@9000000",
   "aciklama": "Her aygıtın of_node bağlantısı, onu oluşturan ağaç düğümünü gösterir."
  }
 ]
};
window.TerminalOturumlari["strace-sistem-cagrisi"] = {
 "baslik": "Bir programın sistem çağrıları (derleme makinesi, x86-64)",
 "istem": "gelistirici@derleme:~$",
 "adimlar": [
  {
   "komut": "strace ./sensor-oku-statik 1",
   "cikti": "execve(\"./sensor-oku-statik\", [\"./sensor-oku-statik\", \"1\"], 0x7ffc67941808 /* 239 vars */) = 0\nbrk(NULL)                               = 0xfca8000\nbrk(0xfca8d00)                          = 0xfca8d00\narch_prctl(ARCH_SET_FS, 0xfca8380)      = 0\nset_tid_address(0xfca8650)              = 20067\nset_robust_list(0xfca8660, 24)          = 0\nrseq(0xfca8ca0, 0x20, 0, 0x53053053)    = 0\nprlimit64(0, RLIMIT_STACK, NULL, {rlim_cur=8192*1024, rlim_max=RLIM64_INFINITY}) = 0\nreadlinkat(AT_FDCWD, \"/proc/self/exe\", \"/home/gelistirici/sensor-oku-sta\"..., 4096) = 35\ngetrandom(\"\\x17\\x03\\x82\\x3a\\x03\\xb5\\x7c\\xb1\", 8, GRND_NONBLOCK) = 8\nbrk(NULL)                               = 0xfca8d00\nbrk(0xfcc9d00)                          = 0xfcc9d00\nbrk(0xfcca000)                          = 0xfcca000\nmprotect(0x4a5000, 20480, PROT_READ)    = 0\nfstat(1, {st_mode=S_IFIFO|0600, st_size=0, ...}) = 0\nwrite(1, \"\\303\\226rnek a\\304\\237 ge\\303\\247idi \\302\\267 sens\\303\\266r ok\"..., 69Örnek ağ geçidi · sensör okuması\n  sensor0  okuma 1     21.0 C\n) = 69\nexit_group(0)                           = ?\n+++ exited with 0 +++",
   "aciklama": "Statik bağlanmış program: execve ile başlar, birkaç başlatma çağrısının ardından tek bir write ile çıktıyı yazar ve exit_group ile sonlanır. Ortamda 239 değişken olduğu da görülür."
  },
  {
   "komut": "strace -c ./sensor-oku 1 2>&1 >/dev/null | tail -8",
   "cikti": "  1.55    0.000017          17         1           set_tid_address\n  1.55    0.000017          17         1           prlimit64\n  1.55    0.000017          17         1           rseq\n  0.82    0.000009           9         1         1 ioctl\n  0.18    0.000002           2         1           write\n  0.18    0.000002           2         1           getrandom\n------ ----------- ----------- --------- --------- ----------------\n100.00    0.001094          31        35         2 total",
   "aciklama": "-c özeti: dinamik bağlanmış sürüm 35 çağrı yapar; çoğu dinamik bağlayıcının libc.so.6'yı açıp belleğe eşlemesi içindir. Asıl iş yine tek bir write'tır."
  },
  {
   "komut": "strace -e trace=openat,write ./sensor-oku 1",
   "cikti": "openat(AT_FDCWD, \"/etc/ld.so.cache\", O_RDONLY|O_CLOEXEC) = 3\nopenat(AT_FDCWD, \"/lib/x86_64-linux-gnu/libc.so.6\", O_RDONLY|O_CLOEXEC) = 3\nwrite(1, \"\\303\\226rnek a\\304\\237 ge\\303\\247idi \\302\\267 sens\\303\\266r ok\"..., 69Örnek ağ geçidi · sensör okuması\n  sensor0  okuma 1     21.0 C\n) = 69\n+++ exited with 0 +++",
   "aciklama": "-e ile yalnızca belirli çağrılar izlenir: dinamik bağlayıcının açtığı iki dosya ve programın yazması."
  }
 ]
};
window.TerminalOturumlari["sysfs-gezinti"] = {
 "baslik": "sysfs: aygıtın gerçek yeri, sınıfı, sürücüsü ve öznitelikleri",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "ls /sys",
   "cikti": "block     class     devices   fs        module\nbus       dev       firmware  kernel",
   "aciklama": "sysfs'in üst düzey dizinleri."
  },
  {
   "komut": "ls /sys/class/tty | head -4",
   "cikti": "console\nptmx\ntty\ntty0",
   "aciklama": "İşleve göre gruplama: tty sınıfı."
  },
  {
   "komut": "readlink -f /sys/class/tty/ttyAMA0",
   "cikti": "/sys/devices/platform/9000000.pl011/9000000.pl011:0/9000000.pl011:0.0/tty/ttyAMA0",
   "aciklama": "Sınıftaki girdi, /sys/devices altındaki gerçek aygıta bağlantıdır: platform aygıtı 9000000.pl011 → seri port → tty."
  },
  {
   "komut": "cat /sys/class/tty/ttyAMA0/dev",
   "cikti": "204:64",
   "aciklama": "Karakter aygıtının major:minor numarası."
  },
  {
   "komut": "cat /sys/class/tty/ttyAMA0/uevent",
   "cikti": "MAJOR=204\nMINOR=64\nDEVNAME=ttyAMA0",
   "aciklama": "uevent dosyası olayın değişkenlerini verir; aynı dosyaya 'add' yazılırsa olay yeniden üretilir."
  },
  {
   "komut": "ls -l /dev/ttyAMA0",
   "cikti": "crw-------    1 root     root      204,  64 Nov  2 21:26 /dev/ttyAMA0",
   "aciklama": "devtmpfs'in oluşturduğu düğüm aynı numaraları taşır."
  },
  {
   "komut": "ls /sys/bus",
   "cikti": "amba         clocksource  cpu          platform     virtio\nclockevents  container    faux         serial-base  workqueue",
   "aciklama": "Veri yolları. PL011 'arm,primecell' uyumlu olduğu için amba veri yolundadır."
  },
  {
   "komut": "ls -l /sys/bus/amba/devices/9000000.pl011/driver",
   "cikti": "lrwxrwxrwx    1 root     root             0 Nov  2 21:26 /sys/bus/amba/devices/9000000.pl011/driver -> ../../../bus/amba/drivers/uart-pl011",
   "aciklama": "Aygıta bağlı sürücü: uart-pl011."
  },
  {
   "komut": "cat /sys/class/rtc/rtc0/name /sys/class/rtc/rtc0/time",
   "cikti": "rtc-pl031 9010000.pl031\n21:26:50",
   "aciklama": "RTC sınıfının öznitelikleri: sürücü adı ve donanım saati (UTC)."
  }
 ]
};
window.TerminalOturumlari["modprobe-uevent"] = {
 "baslik": "Otomatik modül yükleme, modules.alias / modules.dep ve ürün yazılımı",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "lsmod",
   "cikti": "Module                  Size  Used by    Not tainted\nvirtio_rng             12288  0 \nrng_core               16384  1 virtio_rng",
   "aciklama": "Açılışta mdev'in $MODALIAS kuralı virtio-rng'yi yüklemiştir; rng_core onun bağımlılığıdır (Used by)."
  },
  {
   "komut": "cat /sys/class/misc/hw_random/rng_current",
   "cikti": "virtio_rng.0",
   "aciklama": "Rastgele sayı üreteci çerçevesi virtio aygıtını kullanmaktadır."
  },
  {
   "komut": "ls /sys/bus/virtio/drivers/virtio_rng/",
   "cikti": "bind     module   uevent   unbind   virtio1",
   "aciklama": "Sürücü dizininde bağlı aygıta (virtio1) bağlantı ve bind/unbind dosyaları bulunur."
  },
  {
   "komut": "cat /sys/bus/virtio/drivers/virtio_rng/virtio*/uevent",
   "cikti": "DRIVER=virtio_rng\nMODALIAS=virtio:d00000004v554D4551",
   "aciklama": "MODALIAS: d00000004 virtio aygıt türü 4 (entropi kaynağı), v554D4551 satıcı kimliği ('QEMU')."
  },
  {
   "komut": "grep virtio:d00000004 /lib/modules/$(uname -r)/modules.alias",
   "cikti": "alias virtio:d00000004v* virtio_rng",
   "aciklama": "depmod'un modülün aygıt tablosundan ürettiği kalıp."
  },
  {
   "komut": "grep -E 'virtio-rng|rng-core' /lib/modules/$(uname -r)/modules.dep",
   "cikti": "kernel/drivers/char/hw_random/rng-core.ko:\nkernel/drivers/char/hw_random/virtio-rng.ko: kernel/drivers/char/hw_random/rng-core.ko",
   "aciklama": "Bağımlılık satırı: modprobe önce rng-core.ko'yu yükler."
  },
  {
   "komut": "modprobe ornek_bilgi kanal=8",
   "cikti": "[    4.614010] ornek_bilgi: loading out-of-tree module taints kernel.\n[    4.631909] ornek_bilgi: kalibrasyon dosyası yüklendi: 21 bayt\n[    4.632178] ornek_bilgi: yüklendi, kanal=8",
   "aciklama": "Örnek modül parametreyle yüklenir. Ağaç dışı modül çekirdeği 'kirletir' (taint); ürün yazılımı /lib/firmware/ornek/ altından okunmuştur."
  },
  {
   "komut": "cat /sys/module/ornek_bilgi/parameters/kanal",
   "cikti": "8",
   "aciklama": "Parametre sysfs'te görünür (izin 0644 olduğu için yazılabilir)."
  },
  {
   "komut": "ls -l /sys/bus/platform/devices/ornek-bilgi",
   "cikti": "lrwxrwxrwx    1 root     root             0 Nov  2 21:26 /sys/bus/platform/devices/ornek-bilgi -> ../../../devices/platform/ornek-bilgi",
   "aciklama": "Modülün oluşturduğu platform aygıtı."
  },
  {
   "komut": "modprobe -r ornek_bilgi; mv /lib/firmware/ornek/kalibrasyon.bin /tmp/",
   "cikti": "[    4.845930] ornek_bilgi: kaldırıldı",
   "aciklama": "Modül kaldırılır ve ürün yazılımı dosyası başka yere taşınır."
  },
  {
   "komut": "modprobe ornek_bilgi; dmesg | tail -3",
   "cikti": "[    4.913491] platform ornek-bilgi: Direct firmware load for ornek/kalibrasyon.bin failed with error -2\n[    4.915104] ornek_bilgi: kalibrasyon dosyası yok (-2), varsayılanlar kullanılıyor\n[    4.915192] ornek_bilgi: yüklendi, kanal=4\n[    4.913491] platform ornek-bilgi: Direct firmware load for ornek/kalibrasyon.bin failed with error -2\n[    4.915104] ornek_bilgi: kalibrasyon dosyası yok (-2), varsayılanlar kullanılıyor\n[    4.915192] ornek_bilgi: yüklendi, kanal=4",
   "aciklama": "Dosya bulunamadığında ürün yazılımı yükleyicisi -2 (ENOENT) bildirir; sürücü varsayılanlarla devam eder. İletiler hem konsola hem dmesg çıktısına düştüğü için iki kez görünür."
  }
 ]
};
window.TerminalOturumlari["busybox-init"] = {
 "baslik": "BusyBox init: PID 1, inittab ve respawn",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "ps | grep -v '\\['",
   "cikti": "PID   USER     COMMAND\n    1 root     init\n  189 root     /bin/login -- root\n  190 root     -sh\n  238 root     {ps} -sh",
   "aciklama": "Çekirdek iş parçacıkları dışındaki süreçler: PID 1 init, getty'nin yerini almış login ve kabuk."
  },
  {
   "komut": "cat /proc/1/cmdline | tr '\\0' ' '; echo",
   "cikti": "init",
   "aciklama": "PID 1'in komut satırı."
  },
  {
   "komut": "ls -l /sbin/init",
   "cikti": "lrwxrwxrwx    1 root     root            12 Nov  2 21:26 /sbin/init -> /bin/busybox",
   "aciklama": "/sbin/init, BusyBox'ın bir uygulama bağlantısıdır."
  },
  {
   "komut": "cat /etc/inittab",
   "cikti": "# SPDX-License-Identifier: MIT\n# /etc/inittab: BusyBox init yapılandırması. Bölüm 6.\n# Biçim: <tty>::<eylem>:<komut>\n::sysinit:/etc/init.d/rcS\nttyAMA0::respawn:/sbin/getty -L 115200 ttyAMA0 vt100\n::ctrlaltdel:/sbin/reboot\n::shutdown:/bin/umount -a -r",
   "aciklama": "init'in yapılandırması: sysinit, respawn, ctrlaltdel ve shutdown eylemleri."
  },
  {
   "komut": "exit",
   "cikti": "agecidi login: root\nlogin[190]: root login on 'ttyAMA0'\nBusyBox v1.36.1 (Ubuntu 1:1.36.1-6ubuntu3) built-in shell (ash)",
   "aciklama": "Kabuk sonlandığında respawn satırı getty'yi yeniden başlatır ve yeni bir oturum açma istemi görülür."
  }
 ]
};
window.TerminalOturumlari["systemd-analyze"] = {
 "baslik": "systemd birimlerinin derleme makinesinde doğrulanması ve etkinleştirilmesi",
 "istem": "gelistirici@derleme:~$",
 "adimlar": [
  {
   "komut": "gcc -O2 -o kok/usr/bin/sensor-oku ~/cekirdek-onyukleme/examples/initramfs/sensor-oku.c",
   "cikti": "",
   "aciklama": "Hedef kök dosya sistemini temsil eden kok/ dizinine örnek program kurulur."
  },
  {
   "komut": "cp /usr/lib/systemd/system/*.target kok/usr/lib/systemd/system/",
   "cikti": "",
   "aciklama": "Bağımlılıkların çözülebilmesi için temel hedef birimleri kopyalanır."
  },
  {
   "komut": "cp ~/cekirdek-onyukleme/examples/systemd/sensor-* kok/usr/lib/systemd/system/",
   "cikti": "",
   "aciklama": "Kitabın üç birimi."
  },
  {
   "komut": "systemd-analyze verify --root=kok sensor-toplayici.service sensor-oku.timer",
   "cikti": "",
   "aciklama": "Çıktı yoksa birimler geçerlidir: sözdizimi, bağımlılıklar ve ExecStart yolu denetlenmiştir."
  },
  {
   "komut": "sed 's#ExecStart=/usr/bin/sensor-oku 100#ExecStart=/usr/bin/yok#' -i kok/usr/lib/systemd/system/sensor-toplayici.service; systemd-analyze verify --root=kok sensor-toplayici.service",
   "cikti": "sensor-toplayici.service: Command /usr/bin/yok is not executable: No such file or directory",
   "aciklama": "Var olmayan bir program yazıldığında verify hatayı bildirir.",
   "hata": true
  },
  {
   "komut": "cp ~/cekirdek-onyukleme/examples/systemd/sensor-toplayici.service kok/usr/lib/systemd/system/",
   "cikti": "",
   "aciklama": "Asıl dosya geri konur."
  },
  {
   "komut": "systemctl --root=kok enable sensor-toplayici.service sensor-oku.timer",
   "cikti": "Created symlink /home/gelistirici/kok/etc/systemd/system/multi-user.target.wants/sensor-toplayici.service → /usr/lib/systemd/system/sensor-toplayici.service.\nCreated symlink /home/gelistirici/kok/etc/systemd/system/timers.target.wants/sensor-oku.timer → /usr/lib/systemd/system/sensor-oku.timer.",
   "aciklama": "[Install] bölümleri etkinleştirmede hedeflerin .wants dizinlerine bağlantı oluşturur. Yocto'nun systemd sınıfı aynı işi imaj oluşturulurken yapar."
  },
  {
   "komut": "systemctl --root=kok is-enabled sensor-toplayici.service sensor-oku.service",
   "cikti": "enabled\nstatic",
   "aciklama": "Zamanlayıcıyla çalışan servisin [Install] bölümü yoktur; 'static' durumundadır, onu zamanlayıcı başlatır."
  },
  {
   "komut": "systemd-analyze security --offline=yes --root=kok sensor-toplayici.service | grep -v '✓' | cut -c1-118 | tail -6",
   "cikti": "✗ PrivateNetwork=                                             Service has access to the host's network              \n✗ PrivateUsers=                                               Service has access to other users                     \n✗ DeviceAllow=                                                Service has a device ACL with some special devices: ch\n✗ IPAddressDeny=                                              Service does not define an IP address allow list      \n\n→ Overall exposure level for sensor-toplayici.service: 1.9 OK :-)",
   "aciklama": "Kalan maruz kalma kalemleri ve toplam puan (satırlar kısaltılmıştır). Ağ ve aygıt erişimi bilinçli olarak bırakılmıştır."
  },
  {
   "komut": "systemd-analyze calendar --iterations=2 '*:0/15' | head -5",
   "cikti": "  Original form: *:0/15\nNormalized form: *-*-* *:00/15:00\n    Next elapse: Tue 2026-11-03 00:45:00 +03\n       (in UTC): Mon 2026-11-02 21:45:00 UTC\n       From now: 5min left",
   "aciklama": "Takvim ifadesinin sonraki çalışma zamanları (derleme makinesinin saat dilimiyle)."
  },
  {
   "komut": "systemd-analyze timespan 15min",
   "cikti": "Original: 15min\n      μs: 900000000\n   Human: 15min",
   "aciklama": "Süre ifadesinin mikro saniye karşılığı."
  }
 ]
};
window.TerminalOturumlari["ag-yapilandirma"] = {
 "baslik": "Hedefte ağ ve saat",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "ip link show eth0",
   "cikti": "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast qlen 1000\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff",
   "aciklama": "virtio-net arayüzü; MAC adresi QEMU'nun varsayılanıdır."
  },
  {
   "komut": "ip addr show eth0",
   "cikti": "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast qlen 1000\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff\n    inet 10.0.2.15/24 scope global eth0\n       valid_lft forever preferred_lft forever",
   "aciklama": "rcS'teki udhcpc, QEMU'nun DHCP sunucusundan 10.0.2.15/24 adresini almış ve olay betiği bunu uygulamıştır."
  },
  {
   "komut": "ip route",
   "cikti": "default via 10.0.2.2 dev eth0 \n10.0.2.0/24 dev eth0 scope link  src 10.0.2.15",
   "aciklama": "Varsayılan yol ve bağlı ağ yolu."
  },
  {
   "komut": "cat /etc/resolv.conf",
   "cikti": "nameserver 10.0.2.3",
   "aciklama": "DNS sunucusu, olay betiği tarafından yazılmıştır."
  },
  {
   "komut": "ping -c 2 10.0.2.2",
   "cikti": "PING 10.0.2.2 (10.0.2.2): 56 data bytes\n64 bytes from 10.0.2.2: seq=0 ttl=255 time=24.401 ms\n64 bytes from 10.0.2.2: seq=1 ttl=255 time=1.158 ms\n--- 10.0.2.2 ping statistics ---\n2 packets transmitted, 2 packets received, 0% packet loss\nround-trip min/avg/max = 1.158/12.779/24.401 ms",
   "aciklama": "Ağ geçidine erişim (QEMU kullanıcı kipi ICMP yanıtlarını benzetir)."
  },
  {
   "komut": "date; hwclock -r",
   "cikti": "Mon Nov  2 21:26:55 UTC 2026\nMon Nov  2 21:26:54 2026  0.000000 seconds",
   "aciklama": "Sistem saati ve RTC (PL031) aynıdır, çünkü çekirdek açılışta saati RTC'den ayarlamıştır."
  },
  {
   "komut": "dmesg | grep rtc",
   "cikti": "[    0.695219] rtc-pl031 9010000.pl031: registered as rtc0\n[    0.696318] rtc-pl031 9010000.pl031: setting system clock to 2026-11-02T21:26:47 UTC (1793654807)",
   "aciklama": "CONFIG_RTC_HCTOSYS'in açılıştaki iletisi."
  }
 ]
};
window.TerminalOturumlari["tftp-onyukleme"] = {
 "baslik": "U-Boot ile TFTP'den çekirdek ve çekirdeğin kendi DHCP istemcisi",
 "istem": "=>",
 "adimlar": [
  {
   "komut": "setenv autoload no",
   "cikti": "",
   "aciklama": "dhcp yalnızca adres alsın; dosya indirmeye çalışmasın.",
   "istem": "=>"
  },
  {
   "komut": "dhcp",
   "cikti": "BOOTP broadcast 1\nDHCP client bound to address 10.0.2.15 (2 ms)",
   "aciklama": "QEMU'nun DHCP sunucusundan adres alınır.",
   "istem": "=>"
  },
  {
   "komut": "printenv ipaddr serverip netmask gatewayip",
   "cikti": "ipaddr=10.0.2.15\nserverip=10.0.2.2\nnetmask=255.255.255.0\ngatewayip=10.0.2.2",
   "aciklama": "DHCP yanıtından gelen ağ değişkenleri.",
   "istem": "=>"
  },
  {
   "komut": "tftpboot ${kernel_addr_r} Image",
   "cikti": "Using virtio-net#31 device\nTFTP from server 10.0.2.2; our IP address is 10.0.2.15\nFilename 'Image'.\nLoad address: 0x40400000\nLoading: *\b#################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     #################################################################\n     ##########################################\n     19.1 MiB/s\ndone\nBytes transferred = 9869320 (969808 hex)",
   "aciklama": "Çekirdek, QEMU'nun ~/agecidi/tftp dizinini sunan TFTP sunucusundan doğrudan kernel_addr_r adresine indirilir.",
   "istem": "=>"
  },
  {
   "komut": "setenv bootargs console=ttyAMA0,115200 root=/dev/vda2 rootwait ro ip=dhcp",
   "cikti": "",
   "aciklama": "ip=dhcp: çekirdek kullanıcı alanından önce kendisi adres alacaktır.",
   "istem": "=>"
  },
  {
   "komut": "booti ${kernel_addr_r} - ${fdt_addr}",
   "istem": "=>",
   "cikti": "[    0.875565] Sending DHCP requests ., OK\n[    0.905297] IP-Config: Got DHCP answer from 10.0.2.2, my address is 10.0.2.15\n[    0.905880] IP-Config: Complete:\n[    0.905928]      device=eth0, hwaddr=52:54:00:12:34:56, ipaddr=10.0.2.15, mask=255.255.255.0, gw=10.0.2.2\n[    0.906286]      host=10.0.2.15, domain=, nis-domain=(none)\n[    0.906301]      bootserver=10.0.2.2, rootserver=10.0.2.2, rootpath=\n[    0.906333]      nameserver0=10.0.2.3",
   "aciklama": "Çekirdeğin IP otomatik yapılandırması (net/ipv4/ipconfig.c). NFS kökü kullanılsaydı bu adres ve bootserver değeri nfsroot için kullanılırdı."
  },
  {
   "komut": "cat /proc/net/pnp",
   "cikti": "#PROTO: DHCP\nnameserver 10.0.2.3\nbootserver 10.0.2.2",
   "aciklama": "Çekirdeğin DHCP'den aldığı bilgiler kullanıcı alanına /proc/net/pnp ile sunulur.",
   "istem": "root@agecidi:~#"
  }
 ]
};
window.TerminalOturumlari["dmesg-printk"] = {
 "baslik": "printk düzeyleri, /dev/kmsg ve dynamic debug",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "cat /proc/sys/kernel/printk",
   "cikti": "7    4    1    7",
   "aciklama": "Konsol düzeyi 7: KERN_DEBUG dışındaki tüm iletiler konsola yazılır."
  },
  {
   "komut": "dmesg | grep -E 'Machine model|Kernel command line'",
   "cikti": "[    0.000000] Machine model: linux,dummy-virt\n[    0.000000] Kernel command line: console=ttyAMA0,115200 root=/dev/vda2",
   "aciklama": "Halka tamponundaki açılış iletileri."
  },
  {
   "komut": "echo '<3>agecidi: deneme hata iletisi' > /dev/kmsg",
   "cikti": "[    8.715123] agecidi: deneme hata iletisi",
   "aciklama": "Kullanıcı alanından düzey 3 (KERN_ERR) bir ileti eklenir; konsol düzeyinden küçük olduğu için konsolda da hemen görülür."
  },
  {
   "komut": "dmesg -r | tail -1",
   "cikti": "<11>[    8.715123] agecidi: deneme hata iletisi",
   "aciklama": "-r ham biçimi gösterir: <11> = olanak (facility) 1 (kullanıcı) × 8 + düzey 3."
  },
  {
   "komut": "grep ornek_bilgi /proc/dynamic_debug/control",
   "cikti": "ornek_bilgi.c:33 [ornek_bilgi]ornek_bilgi_oku =_ \"kanal %d okundu: %d\\n\"",
   "aciklama": "Modüldeki pr_debug noktası: dosya:satır, işlev, bayraklar (=_ kapalı) ve biçim dizesi."
  },
  {
   "komut": "cat /sys/module/ornek_bilgi/parameters/okuma; dmesg | tail -1",
   "cikti": "21.0\n[    8.715123] agecidi: deneme hata iletisi",
   "aciklama": "Okuma yapılır, ancak pr_debug kapalı olduğundan yeni ileti yoktur."
  },
  {
   "komut": "echo 'module ornek_bilgi +pfl' > /proc/dynamic_debug/control",
   "cikti": "",
   "aciklama": "Modülün tüm hata ayıklama iletileri açılır; işlev adı ve satır numarası da eklenecektir."
  },
  {
   "komut": "grep ornek_bilgi /proc/dynamic_debug/control",
   "cikti": "ornek_bilgi.c:33 [ornek_bilgi]ornek_bilgi_oku =pfl \"kanal %d okundu: %d\\n\"",
   "aciklama": "Bayraklar =pfl olmuştur."
  },
  {
   "komut": "cat /sys/module/ornek_bilgi/parameters/okuma; dmesg | tail -1",
   "cikti": "21.4\n[    9.298569] ornek_bilgi_oku:33: ornek_bilgi: kanal 3 okundu: 214",
   "aciklama": "Aynı okuma artık bir ileti üretir: işlev:satır önekiyle."
  }
 ]
};
window.TerminalOturumlari["ftrace-oturumu"] = {
 "baslik": "ftrace: function_graph ve yığın izi",
 "istem": "root@agecidi:/sys/kernel/tracing#",
 "adimlar": [
  {
   "komut": "cat available_tracers",
   "cikti": "function_graph function nop",
   "aciklama": "Bu çekirdekte derlenmiş izleyiciler."
  },
  {
   "komut": "grep ornek available_filter_functions",
   "cikti": "ornek_esik_oku [ornek_bilgi]\nornek_bilgi_oku [ornek_bilgi]\nokuma_get [ornek_bilgi]\ncokert_set [ornek_bilgi]",
   "aciklama": "Modülün izlenebilir işlevleri; noipa sayesinde asıl adlarıyla görünürler."
  },
  {
   "komut": "echo 0 > options/funcgraph-irqs",
   "cikti": "",
   "aciklama": "Kesme işleyicilerinin çağrı ağacına karışması engellenir."
  },
  {
   "komut": "echo okuma_get > set_graph_function",
   "cikti": "",
   "aciklama": "Yalnızca okuma_get ile başlayan çağrı ağaçları kaydedilecektir."
  },
  {
   "komut": "echo function_graph > current_tracer",
   "cikti": "",
   "aciklama": "İzleyici etkinleştirilir; işlev girişleri çalışma anında yamalanır."
  },
  {
   "komut": "cat /sys/module/ornek_bilgi/parameters/okuma",
   "cikti": "21.8",
   "aciklama": "Parametre okunarak izlenen işlev çalıştırılır."
  },
  {
   "komut": "cat trace",
   "cikti": "# tracer: function_graph\n#\n# CPU  DURATION                  FUNCTION CALLS\n# |     |   |                     |   |   |   |\n 1)               |  okuma_get [ornek_bilgi]() {\n 1) ! 238.336 us  |    ornek_bilgi_oku [ornek_bilgi]();\n 1) + 35.376 us   |    sysfs_emit();\n 1) # 1366.480 us |  }",
   "aciklama": "Çağrı ağacı ve süreler. Önekler süreyi vurgular: + 10 µs, ! 100 µs, # 1 ms üzeri. Süreler QEMU'nun benzetim yükünü de içerir."
  },
  {
   "komut": "echo nop > current_tracer; echo > set_graph_function",
   "cikti": "",
   "aciklama": "İzleme kapatılır ve filtre temizlenir."
  },
  {
   "komut": "echo ornek_bilgi_oku > set_ftrace_filter; echo function > current_tracer",
   "cikti": "",
   "aciklama": "Bu kez function izleyicisi yalnızca tek bir işlevi izler."
  },
  {
   "komut": "echo 1 > options/func_stack_trace",
   "cikti": "",
   "aciklama": "Her olayla birlikte çekirdek yığın izi de kaydedilir."
  },
  {
   "komut": "cat /sys/module/ornek_bilgi/parameters/okuma > /dev/null",
   "cikti": "",
   "aciklama": "İşlev yeniden çalıştırılır."
  },
  {
   "komut": "grep -A12 'ornek_bilgi_oku <-' trace",
   "cikti": "             cat-272     [001] .....    12.710936: ornek_bilgi_oku <-okuma_get\n             cat-272     [001] .....    12.711386: <stack trace>\n => ornek_bilgi_oku\n => okuma_get\n => param_attr_show\n => module_attr_show\n => sysfs_kf_seq_show\n => kernfs_seq_show\n => seq_read_iter\n => kernfs_fop_read_iter\n => copy_splice_read\n => do_splice_read\n => splice_direct_to_actor",
   "aciklama": "Olay satırı (süreç adı-PID, CPU, zaman damgası, işlev <- çağıran) ve işleve hangi yoldan gelindiği: cat'in okuması sysfs ve modül parametre katmanından geçerek okuma_get'e ulaşmıştır."
  },
  {
   "komut": "echo 0 > options/func_stack_trace; echo nop > current_tracer; echo > set_ftrace_filter; cd",
   "cikti": "",
   "aciklama": "Tüm ayarlar geri alınır."
  }
 ]
};
window.TerminalOturumlari["oops-okuma"] = {
 "baslik": "Bilerek üretilen bir oops, kirlilik bayrakları ve panik",
 "istem": "root@agecidi:~#",
 "adimlar": [
  {
   "komut": "modprobe ornek_bilgi",
   "cikti": "[    4.236588] ornek_bilgi: loading out-of-tree module taints kernel.\n[    4.253053] ornek_bilgi: kalibrasyon dosyası yüklendi: 21 bayt\n[    4.253797] ornek_bilgi: yüklendi, kanal=4",
   "aciklama": "Modül yüklenir."
  },
  {
   "komut": "cat /proc/sys/kernel/tainted",
   "cikti": "4096",
   "aciklama": "4096 = bit 12: ağaç dışı modül (O)."
  },
  {
   "komut": "sh -c 'echo 1 > /sys/module/ornek_bilgi/parameters/cokert'",
   "cikti": "[    4.385490] ornek_bilgi: bilerek NULL işaretçi kullanılıyor\n[    4.386876] Unable to handle kernel NULL pointer dereference at virtual address 0000000000000000\n[    4.387017] Mem abort info:\n[    4.387069]   ESR = 0x0000000096000006\n[    4.387127]   EC = 0x25: DABT (current EL), IL = 32 bits\n[    4.387159]   SET = 0, FnV = 0\n[    4.387185]   EA = 0, S1PTW = 0\n[    4.387788]   FSC = 0x06: level 2 translation fault\n[    4.387835] Data abort info:\n[    4.387849]   ISV = 0, ISS = 0x00000006, ISS2 = 0x00000000\n[    4.387863]   CM = 0, WnR = 0, TnD = 0, TagAccess = 0\n[    4.387878]   GCS = 0, Overlay = 0, DirtyBit = 0, Xs = 0\n[    4.388162] user pgtable: 4k pages, 48-bit VAs, pgdp=00000000415d2000\n[    4.388203] [0000000000000000] pgd=08000000415ca403, p4d=08000000415ca403, pud=0800000041d4e403, pmd=0000000000000000\n[    4.392528] Internal error: Oops: 0000000096000006 [#1]  SMP\n[    4.394350] Modules linked in: ornek_bilgi(O) virtio_rng rng_core\n[    4.397727] CPU: 1 UID: 0 PID: 196 Comm: sh Tainted: G           O        6.18.0-agecidi #5 NONE \n[    4.398137] Tainted: [O]=OOT_MODULE\n[    4.398275] Hardware name: linux,dummy-virt (DT)\n[    4.398527] pstate: 60000005 (nZCv daif -PAN -UAO -TCO -DIT -SSBS BTYPE=--)\n[    4.398728] pc : ornek_esik_oku+0x8/0x18 [ornek_bilgi]\n[    4.400076] lr : cokert_set+0x30/0x40 [ornek_bilgi]\n[    4.400204] sp : ffff800080e73cb0\n[    4.400330] x29: ffff800080e73cb0 x28: ffff000001df9b00 x27: 0000000000000000\n[    4.400556] x26: 0000000000000000 x25: 0000000000000000 x24: ffff0000014a21a0\n[    4.400717] x23: ffff800080e73dc0 x22: ffff000000deba88 x21: 0000000000000002\n[    4.400868] x20: ffff8000789f90d0 x19: ffff0000015cf638 x18: 0000000000000000\n[    4.401192] x17: 0000000000000000 x16: 0000000000000000 x15: 000000001aac7990\n[    4.402186] x14: 0000000000000000 x13: 726f79b1c46cb1c4 x12: 6e616c6c756b2069\n[    4.402770] x11: a7c3746572619fc5 x10: ffff8000808c4928 x9 : ffff8000789f7150\n[    4.403668] x8 : 0000000000000074 x7 : ffff8000808c4928 x6 : 00000000000000f3\n[    4.404139] x5 : 0000000000000000 x4 : 00000000000000f3 x3 : 0000000000000000\n[    4.404715] x2 : ffff80008086c850 x1 : ffff80008086c850 x0 : 0000000000000000\n[    4.405798] Call trace:\n[    4.406333]  ornek_esik_oku+0x8/0x18 [ornek_bilgi] (P)\n[    4.407123]  param_attr_store+0x70/0xe0\n[    4.407835]  module_attr_store+0x28/0x48\n[    4.408268]  sysfs_kf_write+0x5c/0x70\n[    4.408548]  kernfs_fop_write_iter+0x130/0x1e0\n[    4.408897]  vfs_write+0x200/0x350\n[    4.409193]  ksys_write+0x60/0xf0\n[    4.410301]  __arm64_sys_write+0x20/0x30\n[    4.410962]  invoke_syscall.constprop.0+0x54/0xe8\n[    4.411651]  do_el0_svc+0x44/0xc8\n[    4.412100]  el0_svc+0x18/0x58\n[    4.412375]  el0t_64_sync_handler+0x98/0xe0\n[    4.412716]  el0t_64_sync+0x154/0x158\n[    4.413413] Code: 80513fc0 ffff8000 aa1e03e9 d503201f (b9400000) \n[    4.414801] ---[ end trace 0000000000000000 ]---\nSegmentation fault",
   "aciklama": "NULL işaretçi erişimi: rapor neden, ARM64 istisna ayrıntıları, bağlam, pc/lr, yazmaçlar ve çağrı izinden oluşur. Hatayı yapan alt kabuk sonlandırılmış (Segmentation fault), sistem çalışmaya devam etmiştir.",
   "hata": true
  },
  {
   "komut": "cat /proc/sys/kernel/tainted",
   "cikti": "4224",
   "aciklama": "4224 = 4096 + 128: bit 7 (D) eklenmiştir, bu açılışta bir oops oluşmuştur."
  },
  {
   "komut": "scripts/faddr2line ~/cekirdek-onyukleme/examples/modul/ornek_bilgi.ko ornek_esik_oku+0x8/0x18",
   "istem": "gelistirici@derleme:~/linux$",
   "cikti": "ornek_esik_oku+0x8/0x18:\nornek_esik_oku at /home/gelistirici/cekirdek-onyukleme/examples/modul/ornek_bilgi.c:60",
   "aciklama": "Derleme makinesinde pc değeri kaynak satırına çevrilir. Satır 60, ornek_esik_oku işlevinin kapanış satırıdır: GCC, d->esik değerini yükleyen komutu dönüş noktasına bağlamıştır; hatalı ifade bir önceki satırdaki return d->esik; ifadesidir."
  },
  {
   "komut": "echo 1 > /proc/sys/kernel/panic_on_oops; echo 5 > /proc/sys/kernel/panic",
   "cikti": "",
   "aciklama": "Yeniden açılmış sistemde: oops paniğe dönüşsün ve 5 saniye sonra yeniden başlatılsın."
  },
  {
   "komut": "sh -c 'echo 1 > /sys/module/ornek_bilgi/parameters/cokert'",
   "cikti": "[    2.894474] Unable to handle kernel NULL pointer dereference at virtual address 0000000000000000\n[    …    ] (aynı oops raporu)\n[    2.915724] Kernel panic - not syncing: Oops: Fatal exception\n[    2.916057] SMP: stopping secondary CPUs\n[    2.916386] Kernel Offset: disabled\n[    2.916483] CPU features: 0x000000,00000000,00000000,0400400b\n[    2.916808] Memory Limit: none\n[    2.917284] Rebooting in 5 seconds..\n[    0.000000] Booting Linux on physical CPU 0x0000000000 [0x410fd034]",
   "aciklama": "Aynı oops bu kez Kernel panic - not syncing: Oops: Fatal exception iletisine dönüşür; ikincil CPU durdurulur ve sistem 5 saniye sonra yeniden başlar.",
   "hata": true
  }
 ]
};
window.TerminalOturumlari["gdb-qemu"] = {
 "baslik": "QEMU gdbstub: çekirdeği ilk komuttan izlemek",
 "istem": "(gdb)",
 "adimlar": [
  {
   "yorum": true,
   "komut": "QEMU 'calistir.sh gdb' (-s -S) ile durdurulmuş olarak başlatılmıştır; gdb-multiarch vmlinux ile açılır"
  },
  {
   "komut": "target remote :1234",
   "cikti": "0x0000000040000000 in ?? ()",
   "aciklama": "İşlemci ilk komutunda durmaktadır: QEMU'nun DRAM başına koyduğu küçük önyükleme kodu (0x40000000)."
  },
  {
   "komut": "hbreak *0x40200000",
   "cikti": "Hardware assisted breakpoint 1 at 0x40200000",
   "aciklama": "QEMU, -kernel ile verilen Image dosyasını 0x40200000 adresine yüklemiştir. MMU kapalı olduğundan fiziksel adres kullanılır."
  },
  {
   "komut": "continue",
   "cikti": "Thread 1 hit Breakpoint 1, 0x0000000040200000 in ?? ()",
   "aciklama": "Çekirdeğin ilk komutu (primary_entry'ye dallanan Image başlığı)."
  },
  {
   "komut": "info registers pc x0 x1",
   "cikti": "pc             0x40200000          0x40200000\nx0             0x48200000          1210056704\nx1             0x0                 0",
   "aciklama": "ARM64 önyükleme protokolü: x0 aygıt ağacının fiziksel adresini taşır, x1 sıfırdır."
  },
  {
   "komut": "x/4xb $x0",
   "cikti": "0x48200000:    0xd0    0x0d    0xfe    0xed",
   "aciklama": "x0'ın gösterdiği adreste FDT sihirli sayısı: d0 0d fe ed."
  },
  {
   "komut": "hbreak start_kernel",
   "cikti": "Hardware assisted breakpoint 2 at 0xffff800080660a18: file ~/linux/init/main.c, line 911.",
   "aciklama": "C kodunun giriş noktası; sanal adresi vmlinux'taki sembolden gelir (KASLR kapalı)."
  },
  {
   "komut": "continue",
   "cikti": "Thread 1 hit Breakpoint 2, start_kernel () at ~/linux/init/main.c:911\n911    {",
   "aciklama": "MMU açılmış ve çekirdek sanal adres alanına geçmiştir."
  },
  {
   "komut": "bt",
   "cikti": "#0  start_kernel () at ~/linux/init/main.c:911\n#1  0xffff8000806685c8 in __primary_switched () at ~/linux/arch/arm64/kernel/head.S:246\nBacktrace stopped: previous frame identical to this frame (corrupt stack?)",
   "aciklama": "start_kernel'i head.S içindeki __primary_switched çağırmıştır; daha önce çerçeve olmadığı için geri iz burada biter."
  },
  {
   "komut": "p init_uts_ns.name.release",
   "cikti": "$1 = \"6.18.0-agecidi\", '\\000' <repeats 50 times>",
   "aciklama": "Çekirdek değişkenleri doğrudan okunabilir."
  },
  {
   "komut": "source vmlinux-gdb.py",
   "cikti": "",
   "aciklama": "CONFIG_GDB_SCRIPTS betiği lx- komutlarını ekler (önce add-auto-load-safe-path ile dizine izin verilir)."
  },
  {
   "komut": "hbreak kernel_init",
   "cikti": "Hardware assisted breakpoint 3 at 0xffff8000804f33e8: file ~/linux/init/main.c, line 1475.",
   "aciklama": "PID 1 olacak çekirdek iş parçacığı."
  },
  {
   "komut": "continue",
   "cikti": "Thread 1 hit Breakpoint 3, kernel_init (unused=0x0) at ~/linux/init/main.c:1475\n1475    {",
   "aciklama": "rest_init() kernel_init iş parçacığını başlatmıştır."
  },
  {
   "komut": "lx-version",
   "cikti": "Linux version 6.18.0-agecidi (gelistirici@derleme) (aarch64-linux-gnu-gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, GNU ld (GNU Binutils for Ubuntu) 2.42) #5 SMP Tue Nov  3 00:20:21 +03 2026",
   "aciklama": "linux_banner dizesi; /proc/version ile aynıdır."
  },
  {
   "komut": "lx-cmdline",
   "cikti": "console=ttyAMA0,115200 nokaslr",
   "aciklama": "Çekirdeğin sakladığı komut satırı."
  }
 ]
};
