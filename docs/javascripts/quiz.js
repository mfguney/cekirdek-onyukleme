/* Yocto Project ile Gömülü Linux — değerlendirme soruları
 *
 * Markdown içinde kullanım (ham HTML):
 *
 *   <div class="quiz" data-id="b05-1">
 *   <p class="quiz-soru">Soru metni?</p>
 *   <ul>
 *     <li>Yanlış seçenek</li>
 *     <li data-dogru>Doğru seçenek</li>
 *   </ul>
 *   <p class="quiz-aciklama">Neden doğru olduğunu anlatan kısa açıklama.</p>
 *   </div>
 */
(function () {
  "use strict";

  function karistir(dizi) {
    for (var i = dizi.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = dizi[i]; dizi[i] = dizi[j]; dizi[j] = t;
    }
    return dizi;
  }

  function kur(quiz) {
    if (quiz.dataset.kuruldu) { return; }
    quiz.dataset.kuruldu = "1";
    var liste = quiz.querySelector("ul");
    if (!liste) { return; }

    var baslik = document.createElement("p");
    baslik.className = "quiz-baslik";
    baslik.textContent = "Soru " + (quiz.dataset.no || "");
    quiz.insertBefore(baslik, quiz.firstChild);

    /* Seçenek sırasını karıştır (data-sabit verilmişse karıştırma) */
    var secenekler = Array.prototype.slice.call(liste.children);
    if (!quiz.hasAttribute("data-sabit")) {
      karistir(secenekler).forEach(function (li) { liste.appendChild(li); });
    }

    var denemeler = 0;
    secenekler.forEach(function (li) {
      li.setAttribute("tabindex", "0");
      li.setAttribute("role", "button");
      function sec() {
        if (quiz.classList.contains("cozuldu") || li.classList.contains("yanlis")) { return; }
        denemeler++;
        if (li.hasAttribute("data-dogru")) {
          li.classList.add("dogru");
          quiz.classList.add("cozuldu");
          baslik.textContent = "Soru " + (quiz.dataset.no || "") + " · " +
            (denemeler === 1 ? "doğru yanıt" : "doğru yanıt (" + denemeler + ". deneme)");
        } else {
          li.classList.add("yanlis");
          li.setAttribute("aria-disabled", "true");
        }
      }
      li.addEventListener("click", sec);
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sec(); }
      });
    });
  }

  function hepsiniKur() {
    document.querySelectorAll(".md-typeset .quiz").forEach(function (q, i) {
      if (!q.dataset.no) { q.dataset.no = String(i + 1); }
      kur(q);
    });
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(hepsiniKur);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hepsiniKur);
  } else { hepsiniKur(); }
})();
