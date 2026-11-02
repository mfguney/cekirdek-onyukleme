// SPDX-License-Identifier: GPL-2.0-only
/*
 * ornek_bilgi: kitabın Bölüm 5 ve Bölüm 8 uygulamalarında kullanılan küçük modül.
 *
 *  - "kanal" parametresi: /sys/module/ornek_bilgi/parameters/kanal (sysfs)
 *  - "okuma" parametresi: okunduğunda ornek_bilgi_oku() çağrılır (ftrace, dynamic debug)
 *  - "cokert" parametresi: 1 yazıldığında bilerek NULL işaretçi hatası üretir (oops okuma)
 *  - yüklenirken bir platform aygıtı oluşturur ve ürün yazılımı (firmware) ister
 */
#define pr_fmt(fmt) KBUILD_MODNAME ": " fmt

#include <linux/module.h>
#include <linux/moduleparam.h>
#include <linux/platform_device.h>
#include <linux/firmware.h>

static int kanal = 4;
module_param(kanal, int, 0644);
MODULE_PARM_DESC(kanal, "Sensör kanal sayısı");

static struct platform_device *ornek_pdev;
static int sayac;

/*
 * noinline ve noipa: işlev ayrı ve asıl adıyla kalmalıdır. Aksi halde derleyici onu satır içine
 * alabilir veya .constprop/.isra sonekli kopyalar üretebilir; ftrace filtreleri ve oops çıktısı
 * bu durumda farklı adlar gösterir.
 */
static noinline __attribute__((__noipa__)) int ornek_bilgi_oku(int k)
{
	int deger = 210 + (sayac++ % 5) * 4;	/* 21,0 °C + benzetim */

	pr_debug("kanal %d okundu: %d\n", k, deger);
	return deger;
}

static int okuma_get(char *buf, const struct kernel_param *kp)
{
	int d = ornek_bilgi_oku(kanal - 1);

	return sysfs_emit(buf, "%d.%d\n", d / 10, d % 10);
}

static const struct kernel_param_ops okuma_ops = {
	.get = okuma_get,
};
module_param_cb(okuma, &okuma_ops, NULL, 0444);
MODULE_PARM_DESC(okuma, "Okunduğunda benzetim sensör değeri döndürür");

struct ornek_durum {
	int esik;
};

/* Hiçbir zaman ayrılmayan durum yapısı: cokert parametresi bu işaretçiyi kullanır */
static struct ornek_durum *ornek_durum;

static noinline __attribute__((__noipa__)) int ornek_esik_oku(struct ornek_durum *d)
{
	return d->esik;		/* d == NULL ise burada oops oluşur */
}

static int cokert_set(const char *val, const struct kernel_param *kp)
{
	if (strncmp(val, "1", 1))
		return -EINVAL;
	pr_warn("bilerek NULL işaretçi kullanılıyor\n");
	return ornek_esik_oku(ornek_durum);
}

static const struct kernel_param_ops cokert_ops = {
	.set = cokert_set,
};
module_param_cb(cokert, &cokert_ops, NULL, 0200);
MODULE_PARM_DESC(cokert, "1 yazılırsa bilerek oops üretir (yalnızca deneme için)");

static int __init ornek_bilgi_init(void)
{
	const struct firmware *fw;
	int ret;

	ornek_pdev = platform_device_register_simple("ornek-bilgi", -1, NULL, 0);
	if (IS_ERR(ornek_pdev))
		return PTR_ERR(ornek_pdev);

	ret = request_firmware(&fw, "ornek/kalibrasyon.bin", &ornek_pdev->dev);
	if (ret) {
		pr_warn("kalibrasyon dosyası yok (%d), varsayılanlar kullanılıyor\n", ret);
	} else {
		pr_info("kalibrasyon dosyası yüklendi: %zu bayt\n", fw->size);
		release_firmware(fw);
	}

	pr_info("yüklendi, kanal=%d\n", kanal);
	return 0;
}

static void __exit ornek_bilgi_exit(void)
{
	platform_device_unregister(ornek_pdev);
	pr_info("kaldırıldı\n");
}

module_init(ornek_bilgi_init);
module_exit(ornek_bilgi_exit);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("Örnek ağ geçidi bilgi modülü (Linux Çekirdeği ve Önyükleme kitabı)");
MODULE_AUTHOR("Gömülü Linux Kitaplığı");
