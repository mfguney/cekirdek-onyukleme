# Kitabın kullanımı

Bu kitap **Gömülü Linux Kitaplığı**'nın bir parçasıdır. Kitaplıktaki diğer kitaplar:
<a href="../yocto-gomulu-linux/index.html">Yocto Project ile Gömülü Linux</a>, <a href="../bash-komut-satiri/index.html">Linux Komut Satırı ve Bash</a>, <a href="../git-surum-kontrolu/index.html">Git ile Sürüm Kontrolü</a>, <a href="../python-gomulu/index.html">Gömülü Geliştirici için Python</a>, <a href="../c-derleme/index.html">C, Make ve CMake ile Derleme</a>, <a href="../aygit-surucusu/index.html">Linux Aygıt Sürücüsü Geliştirme</a>.

## Bölüm yapısı

Her bölüm aynı düzeni izler:

1. **Künye:** Tahmini çalışma süresi, düzey ve ön koşullar
2. **Öğrenme hedefleri:** Bölüm sonunda kazanılması beklenen yetkinlikler
3. **Kavramsal anlatım:** Konunun ne olduğu, neden var olduğu ve nasıl çalıştığı
4. **Animasyonlu şemalar ve terminal canlandırmaları:** Kavramın adım adım görselleştirilmesi
5. **Uygulama çalışmaları:** Komut satırında uygulanacak adımlar ve beklenen çıktılar
6. **Özet**
7. **Değerlendirme soruları:** Etkileşimli, çoktan seçmeli sorular
8. **Alıştırma:** Kapsamlı bir görev ve örnek çözüm

## Bilgi kutuları

!!! hedef "Öğrenme hedefleri"
    Bölümün başında, o bölümden sonra yapabilmeniz beklenen işleri listeler.

!!! iyi "İyi uygulama"
    Sektörde yerleşmiş çalışma yöntemleri.

!!! sss "Sık sorulan soru"
    Konuya yeni başlayanların sıklıkla takıldığı noktalar.

!!! dikkat "Dikkat"
    Sık yapılan hatalar ve önemli zaman kayıplarına yol açabilecek durumlar.

!!! lab "Uygulama çalışması"
    Uygulanacak adımlar. Komutlar kopyalanabilir; beklenen çıktılar adımların yanında verilir.

!!! alistirma "Alıştırma"
    Bölüm sonundaki kapsamlı görev. Örnek çözüm katlanmış kutuda yer alır.

## Etkileşimli öğeler

- **Animasyonlu şemalar:** Bir işlem sırasında verinin, dosyaların veya nesnelerin hangi alanlar
  arasında hareket ettiğini adım adım canlandırır. ▶ Oynat ile otomatik ilerler, ▶| ile adım adım
  gezinilir, alttaki adım adlarına tıklanarak doğrudan bir adıma geçilir. Tümü
  [Animasyonlu şemalar](araclar/animasyonlar.md) sayfasında da bulunur.
- **Terminal canlandırmaları:** Komutların yazılışını ve gerçek çıktılarını sırayla gösterir. Her adımın
  altında o komutun ne yaptığı açıklanır. "Tümü" düğmesi oturumun tamamını bir kerede gösterir.
- **Değerlendirme soruları:** Bir seçeneğe tıklandığında geri bildirim ve açıklama gösterilir.

İşletim sisteminde hareketi azaltma ayarı etkinse geçişler animasyonsuz gösterilir.

## Örnek kodlar

Kitaptaki örneklerin tamamı deponun `examples/` dizinindedir. Örnekler, Yocto kitabıyla aynı senaryoyu,
yani ekransız bir **endüstriyel sensör ağ geçidi**ni temel alır.
