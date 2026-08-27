/* Progressive Enhancement fuer geschaeftsadressen-vergleich.de.
   Ohne JavaScript bleibt die Seite vollstaendig sichtbar und bedienbar,
   das Formular sendet dann klassisch per POST. Kein Tracking, keine Cookies. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Scroll-Reveals ---------- */
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
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- 2. Header-Zustand ---------- */
  var head = document.getElementById("siteHead");
  if (head) {
    var onScroll = function () { head.classList.toggle("is-scrolled", window.scrollY > 20); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- 3. Spekular-Reflex folgt dem Cursor ----------
     Setzt --mx/--my auf jeder Glasflaeche; das Radial-Gradient in
     .glass::after wandert dadurch mit der Maus wie Licht auf echtem Glas. */
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    var glassEls = document.querySelectorAll(".glass");
    var pending = false;
    var lastEvent = null;
    var applyHighlight = function () {
      pending = false;
      if (!lastEvent) return;
      var el = lastEvent.currentTargetRef;
      var rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", ((lastEvent.x - rect.left) / rect.width * 100).toFixed(1) + "%");
      el.style.setProperty("--my", ((lastEvent.y - rect.top) / rect.height * 100).toFixed(1) + "%");
    };
    glassEls.forEach(function (el) {
      el.addEventListener("pointermove", function (event) {
        lastEvent = { x: event.clientX, y: event.clientY, currentTargetRef: el };
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(applyHighlight);
      }, { passive: true });
    });
  }

  /* ---------- 4. Navigation: gleitende Pille + Scrollspy ---------- */
  var nav = document.getElementById("headNav");
  var pill = document.getElementById("navPill");
  if (nav && pill) {
    var links = Array.prototype.slice.call(nav.querySelectorAll(".head-link"));
    var movePill = function (target) {
      if (!target || getComputedStyle(target).display === "none") { pill.style.opacity = "0"; return; }
      pill.style.width = target.offsetWidth + "px";
      pill.style.transform = "translateX(" + target.offsetLeft + "px)";
      pill.style.opacity = "1";
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
      active ? movePill(active) : (pill.style.opacity = "0");
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

  /* ---------- 5. Zahlen zaehlen beim Einblenden hoch ---------- */
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
        var duration = 1100;
        var started = null;
        var step = function (timestamp) {
          if (started === null) started = timestamp;
          var progress = Math.min((timestamp - started) / duration, 1);
          // Ease-out, damit die Zahl weich einrastet statt hart zu stoppen
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = formatNumber(target * eased, decimals) + suffix;
          if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  /* ---------- 6. Partner-Formular ohne Seitenwechsel ---------- */
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
      if (!form.checkValidity()) return; // Browser zeigt seine eigenen Hinweise
      event.preventDefault();
      submitBtn.disabled = true;
      var original = submitBtn.textContent;
      submitBtn.textContent = "Wird gesendet…";

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { "X-Requested-With": "fetch" }
      })
        .then(function (response) { return response.json().catch(function () { return { ok: response.ok }; }); })
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
          submitBtn.textContent = original;
        });
    });
  }

  /* Rueckmeldung nach klassischem POST ohne JavaScript (Redirect mit ?gesendet=1 / ?fehler=1) */
  if (msg && window.location.search.indexOf("gesendet=1") !== -1) {
    msg.textContent = "Vielen Dank. Ihre Anfrage ist eingegangen, wir melden uns in der Regel innerhalb von zwei Werktagen.";
    msg.className = "form-msg show ok";
  } else if (msg && window.location.search.indexOf("fehler=1") !== -1) {
    msg.textContent = "Das hat leider nicht geklappt. Bitte prüfen Sie Ihre Angaben oder schreiben Sie uns direkt an kontakt@geschaeftsadressen-vergleich.de.";
    msg.className = "form-msg show err";
  }
})();
