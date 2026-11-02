/* Gömülü Linux Kitaplığı — akış animasyonu motoru (akis-motor.js)
 *
 * Kullanım: <div class="akis" data-senaryo="ad"></div>
 *
 * Her senaryo; istasyonlardan (dizinler veya kavramsal alanlar), dosya "çiplerinden" ve adımlardan
 * oluşur. Her adım dosyaları istasyonlar arasında taşır, kopyalar, oluşturur veya soluklaştırır.
 * Konum değişimleri FLIP tekniğiyle canlandırılır; prefers-reduced-motion etkinse animasyon atlanır.
 */
(function () {
  "use strict";

  /* Senaryolar her kitabın kendi docs/javascripts/senaryolar.js dosyasında tanımlanır:
   *   window.AkisSenaryolari = window.AkisSenaryolari || {};
   *   window.AkisSenaryolari["ad"] = { baslik, istasyonlar, dosyalar, kod?, adimlar };
   */
  function senaryoBul(ad) { return (window.AkisSenaryolari || {})[ad]; }

  /* ================================================================ */
  /* Motor                                                             */
  /* ================================================================ */
  var TUR_ETIKET = { tarif: "BB", kaynak: "C", ikili: "ELF", paket: "PKG", imaj: "IMG", metin: "TXT", conf: "CONF", dizin: "DIR", sinif: "CLS",
    betik: "SH", python: "PY", commit: "CMT", dal: "REF", nesne: "OBJ", surec: "PROC", aygit: "DEV", modul: "KO", dts: "DTS", bellek: "MEM", ag: "NET", veri: "DATA" };
  var azHareket = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(etiket, sinif, metin) {
    var e = document.createElement(etiket);
    if (sinif) { e.className = sinif; }
    if (metin !== undefined) { e.textContent = metin; }
    return e;
  }

  function Akis(kutu, senaryo) {
    this.kutu = kutu;
    this.s = senaryo;
    this.adim = 0;              // gösterilen adım (0 = başlangıç)
    this.oynuyor = false;
    this.zaman = null;
    this.hiz = 2600;
    this.kur();
  }

  Akis.prototype.kur = function () {
    var self = this, s = this.s;
    this.kutu.innerHTML = "";
    this.kutu.appendChild(el("p", "akis-baslik", s.baslik));

    var govde = el("div", "akis-govde" + (s.kod ? " kodlu" : ""));
    this.sahne = el("div", "akis-sahne");
    this.istasyonEl = {};
    s.istasyonlar.forEach(function (ist, i) {
      var k = el("section", "akis-ist");
      k.dataset.id = ist.id;
      var b = el("header", "akis-ist-bas");
      b.appendChild(el("span", "akis-no", String(i + 1)));
      var t = el("div", "akis-ist-ad");
      t.appendChild(el("strong", "", ist.ad));
      t.appendChild(el("code", "akis-yol", ist.yol));
      b.appendChild(t);
      k.appendChild(b);
      var yuva = el("div", "akis-yuva");
      k.appendChild(yuva);
      var not = el("div", "akis-not");
      not.hidden = true;
      k.appendChild(not);
      self.istasyonEl[ist.id] = { kutu: k, yuva: yuva, not: not };
      self.sahne.appendChild(k);
    });
    govde.appendChild(this.sahne);

    if (s.kod) {
      var kp = el("div", "akis-kod");
      kp.appendChild(el("div", "akis-kod-bas", s.kod.baslik));
      var pre = el("pre", "");
      this.kodSatirlari = s.kod.satirlar.map(function (sat) {
        var sp = el("span", "akis-satir", sat || " ");
        pre.appendChild(sp);
        return sp;
      });
      kp.appendChild(pre);
      govde.appendChild(kp);
    }
    this.kutu.appendChild(govde);

    // Açıklama paneli
    var panel = el("div", "akis-panel");
    panel.setAttribute("aria-live", "polite");
    this.gorevEl = el("span", "akis-gorev");
    this.komutEl = el("code", "akis-komut");
    this.aciklamaEl = el("p", "akis-aciklama");
    var ust = el("div", "akis-panel-ust");
    ust.appendChild(this.gorevEl);
    ust.appendChild(this.komutEl);
    panel.appendChild(ust);
    panel.appendChild(this.aciklamaEl);
    this.kutu.appendChild(panel);

    // Zaman çizelgesi
    var cizelge = el("ol", "akis-cizelge");
    this.noktalar = s.adimlar.map(function (a, i) {
      var li = el("li", "");
      var btn = el("button", "akis-nokta", a.gorev);
      btn.type = "button";
      btn.addEventListener("click", function () { self.dur(); self.git(i, false); });
      li.appendChild(btn);
      cizelge.appendChild(li);
      return btn;
    });
    this.kutu.appendChild(cizelge);

    // Denetimler
    var den = el("div", "akis-denetim");
    function dug(etiket, aria, fn) {
      var d = el("button", "md-button akis-dug", etiket);
      d.type = "button"; d.setAttribute("aria-label", aria);
      d.addEventListener("click", fn);
      den.appendChild(d);
      return d;
    }
    dug("⏮", "Başa dön", function () { self.dur(); self.git(0, false); });
    dug("◀", "Önceki adım", function () { self.dur(); self.git(Math.max(0, self.adim - 1), false); });
    this.oynatDug = dug("▶ Oynat", "Oynat veya duraklat", function () { self.oynuyor ? self.dur() : self.oynat(); });
    this.oynatDug.classList.add("md-button--primary");
    dug("▶|", "Sonraki adım", function () { self.dur(); self.ileri(); });
    this.sayac = el("span", "akis-sayac", "");
    den.appendChild(this.sayac);
    this.kutu.appendChild(den);

    this.git(0, false);
  };

  /* Durumu sıfırdan kur, 0..n adımlarını animasyonsuz uygula */
  Akis.prototype.git = function (n, animasyonlu) {
    var self = this;
    if (!animasyonlu) {
      Object.keys(this.istasyonEl).forEach(function (k) {
        self.istasyonEl[k].yuva.innerHTML = "";
        self.istasyonEl[k].not.hidden = true;
      });
      this.cipler = {};
      this.s.dosyalar.forEach(function (d) { self.cipEkle(d, d.yer); });
      if (this.kodSatirlari) {
        this.kodSatirlari.forEach(function (sp) { sp.classList.remove("acik", "isik"); if (self.s.kod.tumunuGoster) { sp.classList.add("acik"); } });
      }
      for (var i = 1; i <= n; i++) { this.uygula(this.s.adimlar[i], false); }
      if (this.s.adimlar[0].kodGoster) { this.kodGoster(this.s.adimlar[0].kodGoster); }
      for (var j = 0; j <= n; j++) { if (this.s.adimlar[j].kodGoster) { this.kodGoster(this.s.adimlar[j].kodGoster); } }
    } else {
      this.uygula(this.s.adimlar[n], true);
      if (this.s.adimlar[n].kodGoster) { this.kodGoster(this.s.adimlar[n].kodGoster); }
    }
    this.adim = n;
    this.paneliGuncelle();
  };

  Akis.prototype.ileri = function () {
    if (this.adim >= this.s.adimlar.length - 1) { return false; }
    this.git(this.adim + 1, !azHareket);
    return true;
  };

  Akis.prototype.oynat = function () {
    var self = this;
    if (this.adim >= this.s.adimlar.length - 1) { this.git(0, false); }
    this.oynuyor = true;
    this.oynatDug.textContent = "⏸ Duraklat";
    function tik() {
      if (!self.oynuyor) { return; }
      if (!self.ileri()) { self.dur(); return; }
      self.zaman = setTimeout(tik, self.hiz);
    }
    this.zaman = setTimeout(tik, 400);
  };

  Akis.prototype.dur = function () {
    this.oynuyor = false;
    clearTimeout(this.zaman);
    if (this.oynatDug) { this.oynatDug.textContent = "▶ Oynat"; }
  };

  Akis.prototype.paneliGuncelle = function () {
    var a = this.s.adimlar[this.adim], self = this;
    this.gorevEl.textContent = a.gorev;
    this.komutEl.textContent = a.komut || "";
    this.komutEl.hidden = !a.komut;
    this.aciklamaEl.textContent = a.aciklama;
    this.sayac.textContent = "Adım " + (this.adim + 1) + " / " + this.s.adimlar.length;
    this.noktalar.forEach(function (b, i) {
      b.classList.toggle("gecti", i < self.adim);
      b.classList.toggle("simdi", i === self.adim);
      if (i === self.adim) { b.setAttribute("aria-current", "step"); } else { b.removeAttribute("aria-current"); }
    });
    Object.keys(this.istasyonEl).forEach(function (k) {
      self.istasyonEl[k].kutu.classList.toggle("etkin", (a.vurgula || []).indexOf(k) !== -1);
    });
    if (this.kodSatirlari) {
      this.kodSatirlari.forEach(function (sp, i) { sp.classList.toggle("isik", (a.kodSatir || []).indexOf(i) !== -1); });
    }
  };

  Akis.prototype.kodGoster = function (liste) {
    var self = this;
    liste.forEach(function (i) { if (self.kodSatirlari[i]) { self.kodSatirlari[i].classList.add("acik"); } });
  };

  Akis.prototype.cipEkle = function (d, yer) {
    var c = el("div", "akis-cip tur-" + (d.tur || "metin"));
    c.dataset.id = d.id;
    var e = el("span", "akis-cip-tur", d.etiket || TUR_ETIKET[d.tur] || "•");
    c.appendChild(e);
    c.appendChild(el("span", "akis-cip-ad", d.ad));
    this.istasyonEl[yer].yuva.appendChild(c);
    this.cipler[d.id] = c;
    return c;
  };

  /* FLIP: öğeyi kaynak konumdan bugünkü konumuna kaydır */
  function kaydir(cip, ilkRect) {
    var son = cip.getBoundingClientRect();
    var dx = ilkRect.left - son.left, dy = ilkRect.top - son.top;
    cip.style.transition = "none";
    cip.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.04)";
    cip.classList.add("ucuyor");
    void cip.offsetWidth;
    cip.style.transition = "transform .95s cubic-bezier(.2,.75,.2,1)";
    cip.style.transform = "";
    setTimeout(function () { cip.classList.remove("ucuyor"); cip.style.transition = ""; }, 1000);
  }

  function belir(cip) {
    cip.classList.add("yeni");
    setTimeout(function () { cip.classList.remove("yeni"); }, 1200);
  }

  Akis.prototype.uygula = function (adim, animasyonlu) {
    var self = this;
    (adim.islemler || []).forEach(function (op) {
      var kaynakCip, ilk, yeni;
      if (op.tasi) {
        kaynakCip = self.cipler[op.tasi];
        if (!kaynakCip) { return; }
        ilk = kaynakCip.getBoundingClientRect();
        self.istasyonEl[op.hedef].yuva.appendChild(kaynakCip);
        if (animasyonlu) { kaydir(kaynakCip, ilk); }
      } else if (op.kopyala) {
        kaynakCip = self.cipler[op.kopyala];
        if (!kaynakCip) { return; }
        ilk = kaynakCip.getBoundingClientRect();
        var turu = op.tur || (kaynakCip.className.match(/tur-(\w+)/) || [])[1];
        var etk = op.etiket || (op.tur ? undefined : kaynakCip.querySelector(".akis-cip-tur").textContent);
        yeni = self.cipEkle({ id: op.yeniId, ad: op.yeniAd || kaynakCip.querySelector(".akis-cip-ad").textContent, tur: turu, etiket: etk }, op.hedef);
        if (animasyonlu) { kaydir(yeni, ilk); belir(yeni); }
      } else if (op.olustur) {
        yeni = self.cipEkle(op.olustur, op.hedef);
        if (animasyonlu) {
          var k = op.kaynak && self.cipler[op.kaynak];
          if (k) { kaydir(yeni, k.getBoundingClientRect()); }
          belir(yeni);
        }
      } else if (op.soluk) {
        if (self.cipler[op.soluk]) { self.cipler[op.soluk].classList.add("soluk"); }
      } else if (op.sil) {
        var s = self.cipler[op.sil];
        if (s) {
          if (animasyonlu) { s.classList.add("siliniyor"); setTimeout(function () { s.remove(); }, 600); }
          else { s.remove(); }
          delete self.cipler[op.sil];
        }
      } else if (op.vurgu) {
        if (animasyonlu && self.cipler[op.vurgu]) { belir(self.cipler[op.vurgu]); }
      } else if (op.yeniden) {
        var r = self.cipler[op.yeniden];
        if (r) { r.querySelector(".akis-cip-ad").textContent = op.ad; r.classList.add("degisti"); if (animasyonlu) { belir(r); } }
      } else if (op.not) {
        var n = self.istasyonEl[op.not].not;
        n.textContent = op.metin; n.hidden = false;
      } else if (op.notSil) {
        self.istasyonEl[op.notSil].not.hidden = true;
      } else if (op.bag) {
        if (animasyonlu) {
          [op.bag, op.hedefDosya].forEach(function (id) { if (self.cipler[id]) { belir(self.cipler[id]); } });
        }
      }
    });
  };

  function hepsiniKur() {
    document.querySelectorAll(".md-typeset .akis").forEach(function (kutu) {
      if (kutu.dataset.kuruldu) { return; }
      var s = senaryoBul(kutu.dataset.senaryo);
      if (!s) { kutu.textContent = "Bilinmeyen senaryo: " + kutu.dataset.senaryo; return; }
      kutu.dataset.kuruldu = "1";
      new Akis(kutu, s);
    });
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(hepsiniKur);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hepsiniKur);
  } else { hepsiniKur(); }
})();
