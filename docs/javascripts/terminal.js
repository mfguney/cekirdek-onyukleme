/* Gömülü Linux Kitaplığı — terminal canlandırıcı (terminal.js)
 *
 * Kullanım: <div class="terminal" data-oturum="ad"></div>
 *
 * Oturumlar her kitabın docs/javascripts/senaryolar.js dosyasında tanımlanır:
 *   window.TerminalOturumlari = window.TerminalOturumlari || {};
 *   window.TerminalOturumlari["ad"] = {
 *     baslik: "Kısa başlık",
 *     istem: "kullanici@agecidi:~$",          // varsayılan istem
 *     adimlar: [
 *       { komut: "ls -l", cikti: "satır1\nsatır2", aciklama: "Bu adımda ne olduğu.",
 *         istem: "...",          // isteğe bağlı, bu adım için farklı istem
 *         yorum: true }          // isteğe bağlı: komut yerine yalnızca açıklama satırı (# ...)
 *     ]
 *   };
 *
 * Komutlar yazılıyormuş gibi canlandırılır, ardından çıktı görünür. prefers-reduced-motion
 * etkinse yazma animasyonu atlanır.
 */
(function () {
  "use strict";

  var azHareket = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(etiket, sinif, metin) {
    var e = document.createElement(etiket);
    if (sinif) { e.className = sinif; }
    if (metin !== undefined) { e.textContent = metin; }
    return e;
  }

  function Terminal(kutu, oturum) {
    this.kutu = kutu;
    this.o = oturum;
    this.adim = -1;
    this.oynuyor = false;
    this.zaman = null;
    this.yaziyor = false;
    this.kur();
  }

  Terminal.prototype.kur = function () {
    var self = this;
    this.kutu.innerHTML = "";
    var cerceve = el("div", "trm-cerceve");
    var ust = el("div", "trm-ust");
    ust.appendChild(el("span", "trm-nokta"));
    ust.appendChild(el("span", "trm-nokta"));
    ust.appendChild(el("span", "trm-nokta"));
    ust.appendChild(el("span", "trm-baslik", this.o.baslik || "terminal"));
    cerceve.appendChild(ust);
    this.ekran = el("pre", "trm-ekran");
    this.ekran.setAttribute("tabindex", "0");
    this.ekran.setAttribute("aria-label", "Terminal çıktısı");
    cerceve.appendChild(this.ekran);
    this.kutu.appendChild(cerceve);

    this.aciklama = el("p", "trm-aciklama");
    this.aciklama.setAttribute("aria-live", "polite");
    this.kutu.appendChild(this.aciklama);

    var den = el("div", "akis-denetim");
    function dug(etiket, aria, fn) {
      var d = el("button", "md-button akis-dug", etiket);
      d.type = "button"; d.setAttribute("aria-label", aria);
      d.addEventListener("click", fn);
      den.appendChild(d);
      return d;
    }
    dug("⏮", "Baştan başlat", function () { self.dur(); self.sifirla(); });
    this.oynatDug = dug("▶ Oynat", "Oynat veya duraklat", function () { self.oynuyor ? self.dur() : self.oynat(); });
    this.oynatDug.classList.add("md-button--primary");
    dug("▶|", "Sonraki komut", function () { self.dur(); self.ileri(true); });
    dug("Tümü", "Tüm komutları göster", function () { self.dur(); self.tumu(); });
    this.sayac = el("span", "akis-sayac", "");
    den.appendChild(this.sayac);
    this.kutu.appendChild(den);
    this.sifirla();
  };

  Terminal.prototype.sifirla = function () {
    this.adim = -1;
    this.ekran.innerHTML = "";
    this.aciklama.textContent = "▶ Oynat ile komutlar sırayla çalıştırılır; ▶| ile adım adım ilerlenir.";
    this.sayacGuncelle();
  };

  Terminal.prototype.sayacGuncelle = function () {
    this.sayac.textContent = "Komut " + Math.max(0, this.adim + 1) + " / " + this.o.adimlar.length;
  };

  Terminal.prototype.satirEkle = function (a, anlik, bitti) {
    var self = this;
    var satir = el("span", "trm-satir");
    if (a.yorum) {
      satir.appendChild(el("span", "trm-yorum", "# " + a.komut));
      this.ekran.appendChild(satir);
      this.ekran.appendChild(document.createTextNode("\n"));
      bitti();
      return;
    }
    satir.appendChild(el("span", "trm-istem", (a.istem || this.o.istem || "$") + " "));
    var komutEl = el("span", "trm-komut", "");
    satir.appendChild(komutEl);
    var imlec = el("span", "trm-imlec", "▌");
    satir.appendChild(imlec);
    this.ekran.appendChild(satir);
    this.ekran.appendChild(document.createTextNode("\n"));

    function ciktiyiYaz() {
      imlec.remove();
      if (a.cikti) {
        var c = el("span", "trm-cikti" + (a.hata ? " trm-hata" : ""), a.cikti);
        self.ekran.appendChild(c);
        self.ekran.appendChild(document.createTextNode("\n"));
      }
      self.ekran.scrollTop = self.ekran.scrollHeight;
      bitti();
    }
    if (anlik || azHareket) {
      komutEl.textContent = a.komut;
      ciktiyiYaz();
      return;
    }
    var i = 0;
    this.yaziyor = true;
    (function harf() {
      if (i <= a.komut.length) {
        komutEl.textContent = a.komut.slice(0, i);
        i += 1;
        self.ekran.scrollTop = self.ekran.scrollHeight;
        setTimeout(harf, 28);
      } else {
        self.yaziyor = false;
        setTimeout(ciktiyiYaz, 250);
      }
    })();
  };

  Terminal.prototype.ileri = function (elle, sonra) {
    var self = this;
    if (this.yaziyor) { return false; }
    if (this.adim >= this.o.adimlar.length - 1) { return false; }
    this.adim += 1;
    var a = this.o.adimlar[this.adim];
    this.aciklama.textContent = a.aciklama || "";
    this.sayacGuncelle();
    this.satirEkle(a, false, function () { if (sonra) { sonra(); } });
    return true;
  };

  Terminal.prototype.tumu = function () {
    this.ekran.innerHTML = "";
    for (var i = 0; i < this.o.adimlar.length; i++) {
      this.satirEkle(this.o.adimlar[i], true, function () {});
    }
    this.adim = this.o.adimlar.length - 1;
    this.aciklama.textContent = this.o.adimlar[this.adim].aciklama || "";
    this.sayacGuncelle();
  };

  Terminal.prototype.oynat = function () {
    var self = this;
    if (this.adim >= this.o.adimlar.length - 1) { this.sifirla(); }
    this.oynuyor = true;
    this.oynatDug.textContent = "⏸ Duraklat";
    function tik() {
      if (!self.oynuyor) { return; }
      var devam = self.ileri(false, function () {
        if (!self.oynuyor) { return; }
        self.zaman = setTimeout(tik, 1500);
      });
      if (!devam) { self.dur(); }
    }
    tik();
  };

  Terminal.prototype.dur = function () {
    this.oynuyor = false;
    clearTimeout(this.zaman);
    this.oynatDug.textContent = "▶ Oynat";
  };

  function hepsiniKur() {
    document.querySelectorAll(".md-typeset .terminal").forEach(function (kutu) {
      if (kutu.dataset.kuruldu) { return; }
      var o = (window.TerminalOturumlari || {})[kutu.dataset.oturum];
      if (!o) { kutu.textContent = "Bilinmeyen terminal oturumu: " + kutu.dataset.oturum; return; }
      kutu.dataset.kuruldu = "1";
      new Terminal(kutu, o);
    });
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(hepsiniKur);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hepsiniKur);
  } else { hepsiniKur(); }
})();
