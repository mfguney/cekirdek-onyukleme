# 4 · Aygıt ağacı: yapı, bağlamalar ve overlay'ler

<div class="kunye" markdown>
<span>Süre: ~55 dk + uygulama</span><span>Düzey: Orta</span><span>Ön koşul: Bölüm 1 ve 3</span>
</div>

!!! hedef "Öğrenme hedefleri"
    Bu bölümün sonunda:

    - Aygıt ağacının hangi sorunu çözdüğünü ve çekirdeğin onu hangi aşamalarda kullandığını açıklayabilirsiniz.
    - `.dts`, `.dtsi`, `.dtso`, `.dtb` ve `.dtbo` dosyalarının rollerini ayırt edebilirsiniz.
    - Düğüm, özellik, etiket ve phandle sözdizimini okuyup yazabilirsiniz.
    - `compatible`, `reg`, `#address-cells`, `interrupts` ve `status` özelliklerini doğru kullanabilirsiniz.
    - Bir aygıt ağacını bağlama şemalarına (dt-schema) göre doğrulayabilirsiniz.
    - Bir bindirmeyi (overlay) derleyip temel ağaca uygulayabilirsiniz.
    - Çalışan sistemde `/proc/device-tree` üzerinden çekirdeğin gördüğü ağacı inceleyebilirsiniz.

## 4.1 Aygıt ağacı neden gereklidir?

Bir x86 bilgisayarda çekirdek, PCI ve USB veri yollarını tarayarak hangi aygıtların bulunduğunu çalışma
anında öğrenebilir; taranamayan bilgiler ürün yazılımının ACPI tablolarıyla verilir. Gömülü ARM ve
RISC-V sistemlerde ise çevre birimlerinin çoğu **taranamayan** (*non-discoverable*) bellek eşlemeli
bloklardır: UART'ın yazmaç adresi, I²C hattındaki sıcaklık sensörünün adresi, bir LED'in bağlı olduğu
GPIO pini veya bir kesmenin numarası, donanımın kendisinden sorgulanamaz. Bu bilgiler yonga ve kart
tasarımının sonucudur ve çekirdeğe bir yolla bildirilmelidir.

Linux'un ARM desteğinin ilk yıllarında bu bilgiler çekirdek kaynağındaki C dosyalarına (*board file*)
yazılıyordu. Her kart için ayrı bir dosya, ayrı bir derleme ve çoğu zaman ayrı bir çekirdek gerekiyordu;
`arch/arm/mach-*` dizinleri binlerce kart dosyasıyla şişti. **Aygıt ağacı** (*device tree*, DT) bu
sorunu donanım tanımını koddan ayırarak çözer: donanım, çekirdekten bağımsız bir veri yapısıyla tanımlanır
ve önyükleyici bu yapıyı çekirdeğe iletir. Böylece aynı ARM64 çekirdek ikilisi yüzlerce farklı kartta,
yalnızca farklı bir `.dtb` dosyasıyla çalışabilir.

Aygıt ağacının biçimi Open Firmware (IEEE 1275) geleneğinden gelir ve bugün **Devicetree Specification**
belgesiyle tanımlanır. Ağaç yalnızca donanımı tanımlar; yazılım yapılandırması (hangi servisin
çalışacağı gibi) ağaca yazılmaz. Bu ayrım, aygıt ağacı inceleme sürecinde (*review*) sıkı biçimde uygulanır.

## 4.2 Dosya türleri ve konumları

| Uzantı | Anlamı | Örnek |
|---|---|---|
| `.dts` | Bir kartın kaynak dosyası (*device tree source*) | `agecidi.dts` |
| `.dtsi` | İçerilen ortak dosya; genellikle yonga (SoC) düzeyi | `ornek-soc.dtsi` |
| `.dtso` | Bindirme (overlay) kaynağı; eski ağaçlarda `.dts` uzantısıyla da görülür | `sensor-ek.dtso` |
| `.dtb` | Derlenmiş ikili ağaç (*flattened device tree*, FDT) | `agecidi.dtb` |
| `.dtbo` | Derlenmiş bindirme | `sensor-ek.dtbo` |
| `dt-bindings/*.h` | Ağaçta kullanılan sabitler (kesme türleri, GPIO bayrakları, saat numaraları) | `gpio/gpio.h` |

Çekirdek ağacında ARM64 aygıt ağaçları `arch/arm64/boot/dts/<üretici>/` altında bulunur (ör.
`broadcom/bcm2712-rpi-5-b.dts`). Kart dosyası yonganın `.dtsi` dosyasını, o da çoğu zaman yonga
ailesinin ortak `.dtsi` dosyasını içerir. Sabit tanımları `include/dt-bindings/` altındadır; aygıt ağacı
dosyaları bu dizine `scripts/dtc/include-prefixes/` aracılığıyla erişir.

Kitabın örneği bu katmanlı yapıyı izler. `ornek-soc.dtsi` hayalî "Örnek SoC 1" yongasının işlemcisini,
kesme denetleyicisini ve çevre birimlerini tanımlar; çevre birimleri gerçek IP bloklarının (ARM PL011
UART, PL061 GPIO, Synopsys DesignWare I²C) bağlamalarını kullanır ve varsayılan olarak kapalıdır
(`status = "disabled"`). `agecidi.dts` ise kartta gerçekten kullanılan birimleri açar ve karta özgü
aygıtları (I²C sıcaklık sensörü, durum LED'i) ekler.

## 4.3 Sözdizimi

Bir aygıt ağacı, kök düğümden (`/`) başlayan bir **düğümler** ağacıdır. Her düğüm **özellikler**
(*property*) ve alt düğümler içerir:

```dts title="examples/dts/ornek-soc.dtsi (kısaltılmış)"
/ {
	#address-cells = <2>;                      /* (1)! */
	#size-cells = <2>;
	interrupt-parent = <&gic>;                 /* (2)! */

	soc: soc@0 {                               /* (3)! */
		compatible = "simple-bus";
		#address-cells = <1>;
		#size-cells = <1>;
		ranges = <0x0 0x0 0x0 0x40000000>;     /* (4)! */

		gic: interrupt-controller@8000000 {
			compatible = "arm,cortex-a15-gic";
			reg = <0x08000000 0x10000>, <0x08010000 0x10000>;
			interrupt-controller;              /* (5)! */
			#interrupt-cells = <3>;
		};

		uart0: serial@9000000 {
			compatible = "arm,pl011", "arm,primecell";   /* (6)! */
			reg = <0x09000000 0x1000>;
			interrupts = <GIC_SPI 1 IRQ_TYPE_LEVEL_HIGH>; /* (7)! */
			clocks = <&apb_clk>, <&apb_clk>;
			clock-names = "uartclk", "apb_pclk";
			status = "disabled";
		};
	};
};
```

1.  **Hücre sayıları.** Alt düğümlerin `reg` değerinde adresin ve boyutun kaçar adet 32 bitlik hücreyle
    yazılacağını belirtir. Kökte `2`/`2`: 64 bit adres ve boyut.
2.  **Varsayılan kesme denetleyicisi.** Alt düğümler bu değeri devralır.
3.  **Etiket, ad ve birim adresi.** `soc:` bir etikettir (*label*); `soc` düğüm adı, `@0` birim adresidir.
    Birim adresi `reg` değerinin ilk adresiyle aynı olmalıdır; `dtc` aksi durumda uyarı verir.
4.  **Adres çevirisi.** `<çocuk-adres üst-adres boyut>`: çocuk adres alanındaki `0x0`, üst alandaki
    `0x0 0x0` adresine karşılık gelir ve 1 GiB boyunca birebir eşlenir. `ranges` bulunmayan bir veri
    yolunun çocukları işlemci adres alanından erişilemez.
5.  **Değersiz (boolean) özellik.** Varlığı anlam taşır.
6.  **Dize listesi.** En özelden en genele doğru sıralanır.
7.  **Makrolar.** `GIC_SPI` ve `IRQ_TYPE_LEVEL_HIGH`, C ön işlemcisiyle `0` ve `4` değerlerine dönüşür.

Değer türleri şunlardır: dize (`"okay"`), dize listesi (`"a", "b"`), 32 bitlik hücre dizisi (`<1 2 3>`),
bayt dizisi (`[de ad be ef]`), değersiz özellik ve bir düğüme başvuru (`<&gic>`). Başvuru, derleme
sırasında hedef düğüme otomatik atanan bir tamsayıya, **phandle** değerine dönüşür.

Kart dosyası, `.dtsi` içinde tanımlanan düğümleri yeniden yazmadan **etiketle genişletir**:

```dts title="examples/dts/agecidi.dts (kısaltılmış)"
/dts-v1/;
#include "ornek-soc.dtsi"
#include <dt-bindings/gpio/gpio.h>

/ {
	model = "Ornek Endustriyel Sensor Agecidi";
	compatible = "ornek,agecidi", "ornek,soc1";

	chosen {
		stdout-path = "serial0:115200n8";
	};

	memory@40000000 {
		device_type = "memory";
		reg = <0x0 0x40000000 0x0 0x20000000>;   /* 512 MiB */
	};
};

&uart0 {
	status = "okay";
};

&i2c0 {
	status = "okay";
	clock-frequency = <100000>;

	sicaklik: sensor@48 {
		compatible = "ti,tmp102";
		reg = <0x48>;                            /* I²C adresi */
		label = "ortam";
		#thermal-sensor-cells = <1>;
	};
};
```

`&uart0 { ... }` bloğu, `uart0` etiketli düğüme özellik ekler veya var olanı değiştirir. Aynı ad iki kez
tanımlanırsa sonraki değer geçerli olur. Bir özelliği veya düğümü kaldırmak için `/delete-property/`
ve `/delete-node/` yönergeleri kullanılır. I²C denetleyicisinin altındaki düğümde `reg` artık bellek
adresi değil, **I²C veri yolu adresidir**: `i2c0` düğümündeki `#address-cells = <1>` ve
`#size-cells = <0>` değerleri bunu belirler. Adresin anlamını her zaman üst düğüm tanımlar.

## 4.4 Temel özellikler

**`compatible`** aygıt ağacının en önemli özelliğidir: düğümün hangi sürücüyle eşleşeceğini belirler.
Değer `"<üretici>,<model>"` biçimindedir. Sürücü, desteklediği dizeleri bir `of_device_id` tablosunda
bildirir; çekirdek, listedeki ilk dizeden başlayarak eşleşen bir sürücü arar. Örnekteki
`"arm,pl011", "arm,primecell"` listesi, önce PL011'e özgü sürücünün, bulunamazsa genel PrimeCell
desteğinin aranması anlamına gelir. Kök düğümdeki `compatible` ise kartı tanımlar; `model` insan
tarafından okunacak addır ve açılışta `Machine model:` satırında görülür.

**`reg`**, aygıtın üst veri yolu adres alanındaki konum ve boyut çiftleridir. Hücre sayısını üst düğümün
`#address-cells` ve `#size-cells` değerleri belirler. ARM64 kök düğümünde 64 bit değerler iki hücreyle
yazıldığından `memory@40000000` düğümündeki `<0x0 0x40000000 0x0 0x20000000>` değeri "adres
0x40000000, boyut 0x20000000" anlamına gelir.

**`interrupts`**, aygıtın kesme çıkışlarını tanımlar. Değerin biçimi, `interrupt-parent` ile belirtilen
denetleyicinin `#interrupt-cells` değerine ve bağlamasına bağlıdır. ARM GIC için üç hücre kullanılır:
kesme türü (`0` = SPI, `1` = PPI), numara ve tetikleme biçimi. Birden fazla denetleyiciye bağlı
aygıtlarda `interrupts-extended` kullanılır.

**`status`** düğümün kullanılıp kullanılmayacağını belirtir: `"okay"` etkin, `"disabled"` devre dışıdır.
Özellik hiç bulunmazsa düğüm etkin sayılır. Yonga dosyasında birimleri kapalı tanımlayıp kart dosyasında
açmak yerleşik bir uygulamadır; kartta kullanılmayan bir denetleyici için sürücü yoklanmaz, saati ve
gücü açılmaz.

**`/chosen`** düğümü donanımı değil, ürün yazılımının çekirdeğe ilettiği seçimleri taşır: `bootargs`
(çekirdek komut satırı), `stdout-path` (erken konsol) ve initramfs'in adresi (`linux,initrd-start`,
`linux,initrd-end`). U-Boot, çekirdeği başlatmadan hemen önce bu düğümü kendi değerleriyle günceller
(*fixup*); bu nedenle diskteki `.dtb` dosyası ile çekirdeğin gördüğü ağaç birebir aynı değildir.
**`/aliases`** düğümü kısa adlar tanımlar: `serial0 = &uart0;` satırı hem `stdout-path` değerinde
kullanılır hem de çekirdeğin UART'a `ttyAMA0` numarasını vermesini sağlar.

!!! dikkat "Birim adresi ile `reg` uyuşmazlığı"
    `serial@9000000` düğümünün `reg` değeri `0x09001000` olarak değiştirilirse `dtc`
    `unit_address_vs_reg` uyarısı verir. Uyarı derlemeyi durdurmaz, ancak çekirdek ağacına gönderilen
    yamalarda kabul edilmez ve genellikle kopyala-yapıştır hatasının işaretidir. Çekirdeğin
    `make dtbs W=1` komutu ek uyarıları da etkinleştirir.

## 4.5 Bağlamalar ve dt-schema

Bir özelliğin adı, türü ve anlamı **bağlama** (*binding*) belgesinde tanımlanır. Çekirdek ağacındaki
bağlamalar `Documentation/devicetree/bindings/` altında YAML biçiminde, **dt-schema** (JSON Schema
tabanlı) kurallarıyla yazılır. Örneğin `hwmon/ti,tmp102.yaml` dosyası TMP102 sensörü için `compatible`
ve `reg` özelliklerini zorunlu kılar, `interrupts`, `label`, `#thermal-sensor-cells` ve `vcc-supply`
özelliklerine izin verir ve `additionalProperties: false` ile diğer her şeyi yasaklar.

Bağlamalar iki amaçla kullanılır: sürücü yazarı ve kart tasarımcısı arasında bir **sözleşme** olarak ve
aygıt ağaçlarının **otomatik doğrulanması** için. `compatible` dizesinin üretici öneki de
`vendor-prefixes.yaml` dosyasında kayıtlı olmalıdır. Doğrulama araçları `dtschema` Python paketinden
gelir (`pip install dtschema`):

| Komut | İşlev |
|---|---|
| `make dt_binding_check` | Bağlama YAML dosyalarının kendisini ve içlerindeki örnekleri denetler |
| `make dtbs_check` | Çekirdek ağacındaki `.dtb` dosyalarını bağlamalara göre denetler |
| `dt-mk-schema -j <bindings> > s.json` | Bağlamaları tek bir işlenmiş şemada birleştirir |
| `dt-validate -s s.json kart.dtb` | Ağaç dışındaki bir `.dtb` dosyasını denetler |

Aşağıdaki oturum, kitabın örnek ağacının bu ortamda derlenmesini, incelenmesini ve doğrulanmasını
gösterir:

<div class="terminal" data-oturum="dtc-derleme"></div>

!!! iyi "Kuruma özgü özellikler için önek ve bağlama"
    Kuruma özgü bir aygıt için `compatible = "ornek,sensor-kopru"` gibi bir dize ve
    `ornek,kanal-sayisi` gibi önekli özellikler kullanılmalı; bunlar için ürün deposunda bir bağlama
    YAML dosyası yazılmalıdır. Öneksiz, uydurma özellik adları (`kanal-sayisi`) gelecekte çekirdeğe
    eklenecek genel bir özellikle çakışabilir. Sürücü çekirdeğe gönderilecekse önek de
    `vendor-prefixes.yaml` dosyasına eklenir.

## 4.6 Derleme: cpp ve dtc

Aygıt ağacı iki aşamada derlenir. Önce **C ön işlemcisi** `#include` satırlarını ve makroları açar; sonra
**dtc** (*device tree compiler*) metni ikili FDT biçimine dönüştürür. Çekirdeğin Kbuild sistemi bu iki
adımı otomatik yürütür:

```bash
make ARCH=arm64 dtbs                                   # yapılandırmada etkin tüm platformlar
make ARCH=arm64 broadcom/bcm2712-rpi-5-b.dtb           # tek bir kart
make ARCH=arm64 DTC_FLAGS=-@ dtbs                      # simge tablosuyla (bindirmeler için)
```

Kitabın `examples/dts/derle-dtb.sh` betiği aynı adımları çekirdek ağacının dışında uygular:

```sh title="examples/dts/derle-dtb.sh (özü)"
cpp -nostdinc -undef -D__DTS__ -x assembler-with-cpp \
    -I dts -I ~/linux/include -I ~/linux/scripts/dtc/include-prefixes \
    -o agecidi.dts.tmp agecidi.dts
dtc -@ -I dts -O dtb -o agecidi.dtb agecidi.dts.tmp
```

`-x assembler-with-cpp` seçeneği, ön işlemcinin `#` ile başlayan aygıt ağacı sözdizimini (ör.
`#address-cells`) yönerge sanmasını önler. `-undef` ise `linux` gibi önceden tanımlı makroların
kaldırılmasını sağlar; aksi halde `compatible = "linux,dummy"` gibi bir dize `"1,dummy"` olurdu.

Ortaya çıkan `.dtb` dosyası bir başlık, bellek ayırma tablosu, yapı bloğu (düğümler ve özellikler) ve
dizeler bloğundan (özellik adları) oluşur. Başlığın ilk dört baytı her zaman `0xd00dfeed` sihirli
sayısıdır; U-Boot ve çekirdek geçerli bir ağaç olup olmadığını bu değerle anlar. İkili ağaç `dtc -I dtb
-O dts` ile yeniden kaynak biçimine çevrilebilir. Çevrilen metinde etiketler ve makrolar kaybolmuş,
phandle değerleri sayıya dönüşmüştür; ancak çalışan bir sistemdeki gerçek ağacı görmenin en güvenilir
yolu budur.

Aşağıdaki animasyon kaynak dosyalardan çekirdekteki aygıtlara uzanan yolu gösterir:

<div class="akis" data-senaryo="dtc-akisi"></div>

## 4.7 Çekirdek ağacı nasıl kullanır?

Çekirdek aygıt ağacını üç aşamada kullanır:

1. **Erken tarama** (`early_init_dt_scan()`, `setup_arch()` içinde): ağaç henüz düz (*flat*) biçimdeyken
   bellek düğümleri, `/chosen` düğümündeki komut satırı ve initramfs adresi ile ayrılmış bellek bölgeleri
   (`/reserved-memory`) okunur.
2. **Açma** (`unflatten_device_tree()`): ikili ağaç, her düğümün bir `struct device_node` ile temsil
   edildiği bağlı bir yapıya dönüştürülür. Sürücüler bundan sonra `of_property_read_u32()` gibi
   işlevlerle özellikleri okur.
3. **Aygıtların oluşturulması** (`of_platform_default_populate_init()`, `arch_initcall_sync` düzeyinde):
   kökün çocukları ve `simple-bus`, `simple-mfd`, `isa`, `arm,amba-bus` uyumlu veri yollarının çocukları
   için aygıt nesneleri oluşturulur. `arm,primecell` uyumlu düğümler AMBA aygıtı, diğerleri platform
   aygıtı olur. I²C ve SPI denetleyicilerinin çocuklarını ise denetleyicinin sürücüsü, kendi yoklaması
   sırasında oluşturur.

Bir aygıt nesnesi oluştuğunda sürücü çekirdeği, `compatible` dizesini kayıtlı sürücülerin
`of_match_table` tablolarıyla karşılaştırır ve eşleşen sürücünün `probe()` işlevini çağırır. Sürücü
modül olarak derlenmişse eşleşme, modülün yüklenmesini tetikleyen bir `uevent` olayıyla kullanıcı alanına
bildirilir ([Bölüm 5](05-kullanici-alani-arayuzleri.md)). Sürücü tarafının ayrıntıları için
<a href="../../aygit-surucusu/bolumler/03-platform-surucusu.html">Aygıt Sürücüsü kitabı, Bölüm 3</a>
incelenebilir.

Çekirdeğin gördüğü ağaç çalışma anında `/sys/firmware/devicetree/base/` altında dizin ve dosyalar olarak
sunulur; `/proc/device-tree` bu dizine bir sembolik bağlantıdır (`drivers/of/base.c`). Her düğüm bir
dizin, her özellik bir dosyadır; dosyaların içeriği ikili ağaçtaki ham baytlardır (hücreler büyük uçlu,
*big-endian*). Aşağıdaki oturum QEMU'daki örnek sistemde alınmıştır; ağacı burada QEMU üretmiştir:

<div class="terminal" data-oturum="proc-devicetree"></div>

## 4.8 Bindirmeler (overlay)

Bir temel kartın üzerine takılan genişletme kartları (HAT, cape, mezzanine) veya isteğe bağlı bileşenler
için her birleşimin ayrı bir `.dts` dosyası tutulması pratik değildir. **Bindirme** (*overlay*),
temel ağaca sonradan uygulanan küçük bir ağaçtır:

```dts title="examples/dts/sensor-ek.dtso"
/dts-v1/;
/plugin/;

&i2c0 {
	#address-cells = <1>;
	#size-cells = <0>;

	sensor@49 {
		compatible = "ti,tmp102";
		reg = <0x49>;
		label = "kabin";
		#thermal-sensor-cells = <1>;
	};
};
```

`/plugin/;` yönergesi `dtc`'ye bunun bir bindirme olduğunu bildirir. Bindirme derlenirken `i2c0`
etiketinin hangi düğüme karşılık geldiği bilinmez; `dtc` bu başvuruyu `__fixups__` düğümüne
çözülmemiş olarak yazar. Temel ağaç `-@` ile derlendiğinde ise tüm etiketler ve yolları `__symbols__`
düğümüne eklenir. Bindirmeyi uygulayan araç, `__fixups__` içindeki adları `__symbols__` içinde arayarak
başvuruları çözer ve parçaları (*fragment*) hedef düğümlere birleştirir:

<div class="akis" data-senaryo="overlay-uygulama"></div>

Bindirmeyi uygulayan taraf duruma göre değişir:

| Uygulayan | Yöntem |
|---|---|
| Derleme makinesi | `fdtoverlay -i temel.dtb -o sonuc.dtb ek.dtbo` |
| U-Boot | `fdt addr`, `fdt resize`, `fdt apply <adres>` komutları; `extlinux.conf` içinde `fdtoverlays` satırı; FIT yapılandırmaları |
| Raspberry Pi ürün yazılımı | `config.txt` içinde `dtoverlay=` satırları |
| Çekirdek (çalışma anında) | Genel kullanıma açık bir arayüz bulunmaz; ana akım çekirdekte yalnızca sürücülerin iç kullanımı içindir |

!!! dikkat "Simge tablosu olmadan bindirme uygulanamaz"
    Temel ağaç `-@` olmadan derlenmişse `__symbols__` düğümü bulunmaz ve `fdtoverlay` ile U-Boot
    bindirmeyi uygulayamaz (`FDT_ERR_NOTFOUND`). Yocto'da bunun için makine dosyasına
    `KERNEL_DTC_FLAGS = "-@"` yazılır. Simge tablosu `.dtb` boyutunu bir miktar artırır; bindirme
    kullanılmayan ürünlerde gerekmez.

!!! lab "Uygulama 4.1 · Örnek ağacın derlenmesi, doğrulanması ve bindirme"
    `device-tree-compiler` paketi (`dtc`, `fdtget`, `fdtoverlay`) ve `dtschema` kurulur:

    ```bash
    sudo apt install device-tree-compiler
    pip install --user dtschema
    cd ~/cekirdek-onyukleme/examples
    sh dts/derle-dtb.sh ~/linux cikti
    ```

    1. `fdtget -t x cikti/agecidi.dtb /soc/serial@9000000 interrupts` çıktısını `GIC_SPI 1
       IRQ_TYPE_LEVEL_HIGH` ifadesiyle karşılaştırın; `cikti/agecidi.dts.tmp` dosyasında ön işlemcinin
       ürettiği satırı bulun.
    2. `dtc -I dtb -O dts cikti/sensor-ek.dtbo` çıktısında `fragment@0`, `__overlay__` ve `__fixups__`
       düğümlerini bulun.
    3. `fdtget -l cikti/agecidi-ek.dtb /soc/i2c@9040000` ile bindirme sonrasında I²C denetleyicisinin
       altında iki sensörün bulunduğunu doğrulayın.
    4. İşlenmiş şemayı üretip ağacı doğrulayın (ilk komut birkaç dakika sürer):

        ```bash
        dt-mk-schema -j ~/linux/Documentation/devicetree/bindings > cikti/semalar.json
        dt-validate -m -s cikti/semalar.json cikti/agecidi.dtb
        ```

        `-m` seçeneği, hiçbir bağlamayla eşleşmeyen `compatible` değerlerini de raporlar. Yalnızca kök
        düğümün `ornek,agecidi` dizesi raporlanmalıdır; bu dize hayalî kart için bir bağlama
        yazılmadığından beklenen bir sonuçtur.

## 4.9 Yocto'daki karşılıklar

Yocto'da çekirdek ağacındaki aygıt ağaçları makine dosyasında `KERNEL_DEVICETREE` ile seçilir ve çekirdek
tarifi tarafından derlenir; çıktılar `tmp/deploy/images/<makine>/` altına kopyalanır. Kuruma özgü bir
kart için iki yol vardır:

- `.dts` dosyası çekirdek kaynağına bir **yama** olarak eklenir ve `arch/arm64/boot/dts/<üretici>/Makefile`
  dosyasına kaydedilir. Bu yol, dosyanın çekirdeğin `dtbs_check` denetiminden geçmesini kolaylaştırır.
- Çekirdek ağacının dışında tutulan kaynaklar için OE-Core'un **`devicetree` sınıfı** kullanılır. Sınıf,
  `DT_FILES_PATH` dizinindeki `.dts`/`.dtso` dosyalarını çekirdeğin başlık dosyalarıyla derler ve
  `${DEPLOY_DIR_IMAGE}/devicetree/` altına yerleştirir.

Makine dosyası örnekleri ve bindirmelerin U-Boot ile Raspberry Pi tarafında uygulanması
<a href="../../yocto-gomulu-linux/bolumler/10-makine-bsp.html">Yocto kitabı, Bölüm 10</a>'da anlatılmıştır.
U-Boot da kendi aygıt ağacını kullanır; çoğu kartta U-Boot ve çekirdek aynı `.dts` kaynağının farklı
sürümlerini taşır. Ağaç yalnızca çekirdekte güncellenirse U-Boot'un davranışı değişmez; ikisinin
tutarlılığı sürüm yönetiminin bir parçasıdır.

## Özet

- Aygıt ağacı, taranamayan donanımı koddan bağımsız bir veri yapısıyla tanımlar; önyükleyici `.dtb` dosyasını çekirdeğe iletir.
- `.dtsi` yonga, `.dts` kart, `.dtso` bindirme kaynağıdır; derleme cpp + dtc ile yapılır.
- `compatible` sürücü eşleşmesini, `reg` adres ve boyutu, `#address-cells`/`#size-cells` hücre sayılarını, `interrupts` kesmeleri, `status` etkinliği belirler. Adresin anlamını üst düğüm tanımlar.
- Etiketler (`&uart0`) ile düğümler başka dosyalarda genişletilir; başvurular derlemede phandle değerine dönüşür.
- Bağlamalar YAML (dt-schema) ile yazılır; `dt_binding_check`, `dtbs_check` ve `dt-validate` ile denetlenir.
- Çekirdek ağacı erken tarar, `struct device_node` yapısına açar ve platform/AMBA aygıtlarını oluşturur. Çalışan ağaç `/proc/device-tree` altındadır.
- Bindirmeler `/plugin/;` ile yazılır; uygulanabilmeleri için temel ağacın `-@` ile derlenmesi gerekir.

## Değerlendirme soruları

<div class="quiz" data-id="b04-1">
<p class="quiz-soru">Bir I²C denetleyicisinin altındaki <code>sensor@48</code> düğümünde <code>reg = &lt;0x48&gt;;</code> yazılıdır. Bu değerin I²C adresi olarak yorumlanmasını ne sağlar?</p>
<ul>
<li><code>compatible</code> değerindeki <code>ti,</code> öneki</li>
<li>Düğüm adındaki <code>sensor</code> sözcüğü</li>
<li data-dogru>Üst düğümdeki (I²C denetleyicisi) <code>#address-cells = &lt;1&gt;</code> ve <code>#size-cells = &lt;0&gt;</code> değerleri ve I²C bağlaması</li>
<li>Kök düğümdeki <code>#address-cells = &lt;2&gt;</code></li>
</ul>
<p class="quiz-aciklama"><code>reg</code> değerinin biçimini ve anlamını her zaman üst düğüm belirler. I²C veri yolunda adres tek hücredir ve boyut yoktur.</p>
</div>

<div class="quiz" data-id="b04-2">
<p class="quiz-soru">Yonga <code>.dtsi</code> dosyasında <code>status = "disabled"</code> olarak tanımlanan bir UART için kart dosyasında ne yazılmalıdır?</p>
<ul>
<li>UART düğümünün tamamı kart dosyasına kopyalanıp <code>status</code> silinmelidir</li>
<li data-dogru><code>&amp;uart0 { status = "okay"; };</code></li>
<li><code>/delete-node/ &amp;uart0;</code></li>
<li><code>&amp;uart0 { compatible = "okay"; };</code></li>
</ul>
<p class="quiz-aciklama">Etiketle genişletme, düğümü yeniden yazmadan özelliğin değiştirilmesini sağlar. Sonradan verilen değer öncekini geçersiz kılar.</p>
</div>

<div class="quiz" data-id="b04-3">
<p class="quiz-soru"><code>fdtoverlay</code> bir bindirmeyi uygularken <code>FDT_ERR_NOTFOUND</code> hatası vermektedir. En olası neden nedir?</p>
<ul>
<li>Bindirme dosyasında <code>/dts-v1/;</code> satırı vardır</li>
<li data-dogru>Temel ağaç <code>-@</code> olmadan derlenmiştir; <code>__symbols__</code> düğümü olmadığından <code>&amp;i2c0</code> başvurusu çözülemez</li>
<li><code>dtc</code> sürümü çekirdekten yenidir</li>
<li>Bindirme <code>.dtbo</code> yerine <code>.dtb</code> uzantısıyla kaydedilmiştir</li>
</ul>
<p class="quiz-aciklama">Bindirmedeki etiket başvuruları <code>__fixups__</code> içinde ad olarak tutulur ve temel ağacın <code>__symbols__</code> düğümünde aranır. Simge tablosu yoksa ad bulunamaz.</p>
</div>

<div class="quiz" data-id="b04-4">
<p class="quiz-soru">Diskteki <code>agecidi.dtb</code> dosyasında <code>/chosen/bootargs</code> bulunmamasına rağmen çalışan sistemde <code>/proc/device-tree/chosen/bootargs</code> dosyası vardır. Bunun açıklaması nedir?</p>
<ul>
<li>Çekirdek komut satırını derleme sırasında ağaca gömmüştür</li>
<li data-dogru>U-Boot, çekirdeği başlatmadan önce <code>/chosen</code> düğümünü <code>bootargs</code> ve initramfs adresleriyle günceller</li>
<li><code>/proc/device-tree</code> diskteki dosyanın doğrudan bir kopyasıdır</li>
<li>systemd açılışta bu dosyayı oluşturur</li>
</ul>
<p class="quiz-aciklama">Önyükleyici ağaç üzerinde düzeltmeler (<em>fixup</em>) yapar: <code>/chosen</code>, bellek düğümleri ve gerekirse MAC adresleri güncellenir. <code>/proc/device-tree</code> çekirdeğin aldığı ağacı gösterir.</p>
</div>

<div class="quiz" data-id="b04-5">
<p class="quiz-soru">Bir <code>.dts</code> dosyası <code>cpp</code> ile ön işlenirken neden <code>-undef</code> seçeneği kullanılır?</p>
<ul>
<li>Tanımsız etiketlerin hata vermemesi için</li>
<li>Derlemeyi hızlandırmak için</li>
<li data-dogru>Derleyicinin önceden tanımladığı makroların (ör. <code>linux</code>) <code>compatible</code> dizelerindeki sözcükleri değiştirmesini önlemek için</li>
<li><code>#address-cells</code> satırlarının silinmesi için</li>
</ul>
<p class="quiz-aciklama">GCC Linux üzerinde <code>linux</code> makrosunu <code>1</code> olarak tanımlar. <code>-undef</code> olmadan <code>"linux,dummy"</code> gibi dizeler bozulabilir. <code>#</code> ile başlayan özellik adları ise <code>-x assembler-with-cpp</code> ile korunur.</p>
</div>

!!! alistirma "Alıştırma: Durum LED'i için ikinci bir GPIO ve bir bindirme"
    Ağ geçidinin yeni donanım sürümünde, I²C sensörünün yanına GPIO 5'e bağlı ve **etkin düşük**
    (*active low*) çalışan kırmızı bir "hata" LED'i eklenmiştir. Bu LED yalnızca yeni sürümde
    bulunduğundan temel `agecidi.dts` dosyası değiştirilmeyecektir.

    1. `examples/dts/led-hata.dtso` adlı bir bindirme yazın. LED, `agecidi.dts` içindeki `leds` düğümüne
       eklenmeli ve varsayılan tetikleyici olarak `none` kullanılmalıdır.
    2. Bindirmeyi derleyin, `fdtoverlay` ile uygulayın ve `fdtget` ile sonucu doğrulayın.
    3. `leds` düğümünün bir etiketi olmadığı göz önüne alınarak hedefin nasıl belirtileceğini açıklayın.

    ??? success "Örnek çözüm"
        `leds` düğümünün etiketi bulunmadığından bindirme `&etiket` yerine **yol ile** hedef gösterir.
        `dtc`, `&{/yol}` sözdizimini `target-path` özelliğine dönüştürür; bu biçim `__symbols__`
        gerektirmez:

        ```dts
        /dts-v1/;
        /plugin/;

        #include <dt-bindings/gpio/gpio.h>

        &{/leds} {
        	led-hata {
        		label = "agecidi:red:hata";
        		gpios = <&gpio0 5 GPIO_ACTIVE_LOW>;
        		linux,default-trigger = "none";
        	};
        };
        ```

        `&gpio0` başvurusu ise yine `__fixups__` üzerinden çözülür; temel ağaç `-@` ile derlenmiş olmalıdır.
        Derleme ve doğrulama:

        ```bash
        cpp -nostdinc -undef -D__DTS__ -x assembler-with-cpp -I ~/linux/include \
            -o cikti/led-hata.tmp dts/led-hata.dtso
        dtc -@ -I dts -O dtb -o cikti/led-hata.dtbo cikti/led-hata.tmp
        fdtoverlay -i cikti/agecidi.dtb -o cikti/agecidi-led.dtb cikti/led-hata.dtbo
        fdtget -l cikti/agecidi-led.dtb /leds
        ```

        Son komut `led-hata` ve `led-durum` alt düğümlerini listeler (eklenen düğüm başa yazılır).
        Bindirmenin `dtc -I dtb -O dts` ile çözülmüş halinde hedefin `target-path = "/leds"` olarak
        yazıldığı görülür. Etkin düşük çalışma bilgisi
        `GPIO_ACTIVE_LOW` bayrağıyla ağaçta tutulur; sürücü LED'i "açık" yaptığında pini lojik 0'a çeker.
        Böylece donanımdaki ters mantık uygulama koduna sızmaz.

**Sonraki bölüm:** [5 · Çekirdek ile kullanıcı alanı arayüzleri →](05-kullanici-alani-arayuzleri.md)
