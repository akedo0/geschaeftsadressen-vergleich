/* Progressive Enhancement fuer geschaeftsadressen-vergleich.de.
   Ohne JavaScript bleibt die Seite vollstaendig sichtbar und bedienbar,
   das Formular sendet dann klassisch per POST. Kein Tracking, keine Cookies. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Reveals beim Scrollen ---------- */
  var reveals = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- 2. Kopfzeile: Zustand und wanderndes Glanzlicht ----------
     Das Glanzlicht auf der Glaspille wandert mit dem Scrollfortschritt.
     So wirkt die Flaeche wie eine echte gewoelbte Glaskante, auf der sich
     die Umgebung spiegelt, statt wie ein statischer Farbverlauf. */
  var head = document.getElementById("siteHead");
  var pill = head && head.querySelector(".head-pill");
  if (head) {
    var lastSheen = -1;
    var onScroll = function () {
      var y = window.scrollY;
      head.classList.toggle("is-scrolled", y > 20);
      if (!pill || reduceMotion) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(y / max, 1) : 0;
      var sheen = Math.round(-25 + progress * 145);
      if (sheen === lastSheen) return;
      lastSheen = sheen;
      pill.style.setProperty("--sheen", sheen + "%");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- 3. Navigation: gleitende Pille und Scrollspy ---------- */
  var nav = document.getElementById("headNav");
  var navPill = document.getElementById("navPill");
  if (nav && navPill) {
    var links = Array.prototype.slice.call(nav.querySelectorAll(".head-link"));
    var movePill = function (target) {
      if (!target || getComputedStyle(target).display === "none") { navPill.style.opacity = "0"; return; }
      navPill.style.width = target.offsetWidth + "px";
      navPill.style.transform = "translateX(" + target.offsetLeft + "px)";
      navPill.style.opacity = "1";
    };
    var setActive = function (link) {
      links.forEach(function (l) { l.classList.toggle("is-active", l === link); });
      movePill(link);
    };

    links.forEach(function (link) {
      link.addEventListener("pointerenter", function () { movePill(link); });
    });
    nav.addEventListener("pointerleave", function () {
      var active = nav.querySelector(".head-link.is-active");
      if (active) { movePill(active); } else { navPill.style.opacity = "0"; }
    });

    var sections = links
      .map(function (l) { return document.querySelector(l.getAttribute("href")); })
      .filter(Boolean);
    if (sections.length && "IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var match = links.filter(function (l) {
            return l.getAttribute("href") === "#" + entry.target.id;
          })[0];
          if (match) setActive(match);
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      sections.forEach(function (s) { spy.observe(s); });
    }
    window.addEventListener("resize", function () {
      var active = nav.querySelector(".head-link.is-active");
      if (active) movePill(active);
    });
  }

  /* ---------- 4. Kennzahlen zaehlen einmalig hoch ---------- */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && !reduceMotion && "IntersectionObserver" in window) {
    var formatNumber = function (value, decimals) {
      return value.toFixed(decimals).replace(".", ",");
    };
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        countObserver.unobserve(el);
        var target = parseFloat(el.getAttribute("data-count"));
        var suffix = el.getAttribute("data-suffix") || "";
        var decimals = (String(target).split(".")[1] || "").length;
        var duration = 950;
        var started = null;
        var step = function (timestamp) {
          if (started === null) started = timestamp;
          var progress = Math.min((timestamp - started) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = formatNumber(target * eased, decimals) + suffix;
          if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  /* ---------- 5. Partner-Formular ohne Seitenwechsel ---------- */
  var form = document.getElementById("partnerForm");
  var msg = document.getElementById("formMsg");
  var submitBtn = document.getElementById("partnerSubmit");
  if (form && msg && window.fetch) {
    var show = function (text, ok) {
      msg.textContent = text;
      msg.className = "form-msg show " + (ok ? "ok" : "err");
      msg.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    };
    form.addEventListener("submit", function (event) {
      if (!form.checkValidity()) return; // Browser meldet fehlende Pflichtfelder selbst
      event.preventDefault();
      submitBtn.disabled = true;
      var original = submitBtn.innerHTML;
      submitBtn.textContent = "Wird gesendet…";

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { "X-Requested-With": "fetch" }
      })
        .then(function (response) {
          return response.json().catch(function () { return { ok: response.ok }; });
        })
        .then(function (data) {
          if (data && data.ok) {
            form.reset();
            show("Vielen Dank. Ihre Anfrage ist eingegangen, wir melden uns in der Regel innerhalb von zwei Werktagen.", true);
          } else {
            show((data && data.error) || "Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.", false);
          }
        })
        .catch(function () {
          show("Verbindung fehlgeschlagen. Bitte versuchen Sie es später erneut.", false);
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
        });
    });
  }

  /* Rueckmeldung nach klassischem POST ohne JavaScript */
  if (msg && window.location.search.indexOf("gesendet=1") !== -1) {
    msg.textContent = "Vielen Dank. Ihre Anfrage ist eingegangen, wir melden uns in der Regel innerhalb von zwei Werktagen.";
    msg.className = "form-msg show ok";
  } else if (msg && window.location.search.indexOf("fehler=1") !== -1) {
    msg.textContent = "Das hat leider nicht geklappt. Bitte prüfen Sie Ihre Angaben oder schreiben Sie uns direkt an kontakt@geschaeftsadressen-vergleich.de.";
    msg.className = "form-msg show err";
  }
})();
