# Linux Çekirdeği ve Önyükleme

**Gömülü Linux sistemlerinde önyükleme zinciri, U-Boot, çekirdek, aygıt ağacı ve init sistemleri üzerine
açık kaynak, Türkçe başvuru ve öğretim kitabı.**

Kitap, bir gömülü Linux cihazının güç verildiği andan servislerin çalışır duruma geldiği ana kadar geçen
süreci ele alır: Boot ROM ve SPL'den U-Boot'a, Kconfig/Kbuild ile çekirdek derlemeden aygıt ağacına,
`/sys`, udev ve modül yüklemeden systemd'ye, seri konsol ve ağdan önyüklemeden çekirdek hata ayıklamaya
kadar. Her bölüm kavramsal anlatım, animasyonlu şemalar, gerçek komut çıktılarından oluşan terminal
canlandırmaları, uygulama çalışmaları, özet, değerlendirme soruları ve bir alıştırmadan oluşur. Örnekler,
kitaplığın ortak örneği olan ekransız bir endüstriyel sensör ağ geçidi (`agecidi`) üzerinden ilerler.

Gömülü Linux Kitaplığı'nın bir parçasıdır.

- **Çevrimiçi sürüm:** https://mfguney.github.io/cekirdek-onyukleme/
- **Depo:** https://github.com/mfguney/cekirdek-onyukleme
- **Sürüm kapsamı:** Linux 6.18, U-Boot 2026.01 (QEMU çıktıları 2025.10), Yocto Project 6.0 *Wrynose*
- **Etkileşimli öğeler:** 12 animasyonlu şema, QEMU'da ve derleme makinesinde alınmış gerçek çıktılarla 21 terminal canlandırması, 40 değerlendirme sorusu
- **Örnekler:** [`examples/`](examples): çekirdek yapılandırma parçası ve derleme betiği, örnek çekirdek modülü,
  initramfs ve BusyBox init dosyaları, QEMU betikleri, U-Boot ortamı/betiği/FIT tanımı, aygıt ağacı ve bindirme,
  udev ve mdev kuralları, systemd birimleri, Yocto tarif ekleri. Ayrıntılar: [`examples/README.md`](examples/README.md)

## Bölümler

| Bölüm | Konu |
|---|---|
| 1 | Önyükleme zinciri: ROM'dan init'e |
| 2 | U-Boot: ortam, komutlar ve önyükleme betikleri |
| 3 | Çekirdek kaynak ağacı, Kconfig ve Kbuild |
| 4 | Aygıt ağacı: yapı, bağlamalar ve overlay'ler |
| 5 | Çekirdek ile kullanıcı alanı arayüzleri: /proc, /sys, udev |
| 6 | init sistemleri ve systemd |
| 7 | Seri konsol, ağ ve uzaktan erişim |
| 8 | Çekirdek hata ayıklama: printk, dynamic debug, ftrace, kgdb |

## Uygulamaların ortamı

Uygulamalar donanım gerektirmez. Ubuntu 24.04 üzerinde gereken paketler:

```bash
sudo apt install qemu-system-arm u-boot-qemu gcc-aarch64-linux-gnu u-boot-tools \
     device-tree-compiler flex bison bc libssl-dev libelf-dev cpio fdisk gdb-multiarch
pip install --user dtschema
```

Başlangıç adımları kitabın 1. bölümündeki Uygulama 1.1'de anlatılmıştır.

## Yerel önizleme

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
mkdocs serve          # http://127.0.0.1:8000
```

## GitHub Pages'te yayınlama

1. GitHub'da `mfguney/cekirdek-onyukleme` adlı boş bir depo oluşturun ve bu klasörü `main` dalına gönderin.
2. Depo ayarlarında **Settings → Pages → Source: GitHub Actions** seçeneğini etkinleştirin.
3. `main` dalına yapılan her gönderimde `.github/workflows/yayinla.yml` siteyi derler ve
   https://mfguney.github.io/cekirdek-onyukleme/ adresinde yayınlar.

## Lisans

Metin [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.tr), örnek kodlar MIT
(`examples/COPYING.MIT`) lisanslıdır. Çekirdek modülü (`examples/modul/`) ve çekirdek ağacına eklenen
Kconfig/Makefile örnekleri (`examples/cekirdek/agac-ici/`) GPL-2.0-only lisanslıdır.
