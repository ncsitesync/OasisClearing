/* ============================================================
   OASIS J&R LAND CLEARING — main.js
   Vanilla JS, no dependencies. Six independent features:
   1. Mobile nav toggle (aria-expanded)
   2. Staggered scroll-reveal via IntersectionObserver
   3. Hero on-load stagger (fade + slide up, fixed sequence)
   4. Gallery lightbox with focus trap + Escape + focus-return
   5. EN / ES language toggle (data-en / data-es swap)
   6. Hero background video (reduced-motion aware autoplay)
   ============================================================ */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Hero background video — autoplay is started from here
     rather than the HTML `autoplay` attribute, so that when
     prefers-reduced-motion is on we simply never call play()
     and the poster frame stays put. No flash of motion either
     way, since the poster is itself a frame from the video.
     --------------------------------------------------------- */
  var heroVideo = document.getElementById("hero-video");
  if (heroVideo && !prefersReducedMotion) {
    var playAttempt = heroVideo.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      // Autoplay can still be blocked by the browser in some contexts
      // (e.g. low-power mode) — fail silently and keep the poster.
      playAttempt.catch(function () {});
    }
  }

  /* ---------------------------------------------------------
     0. Language toggle — kept in a plain variable for the
     session only (no localStorage available here). Defaults
     to English on every load.
     --------------------------------------------------------- */
  var currentLang = "en";
  var translatableEls = document.querySelectorAll("[data-en]");
  var langToggleButtons = document.querySelectorAll(".lang-toggle__btn");

  function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;

    translatableEls.forEach(function (el) {
      var value = el.getAttribute("data-" + lang);
      if (value === null) return;
      // The hero headline stores its two lines separated by "|" so a
      // manual <br> survives translation without using innerHTML anywhere
      // else on the page.
      if (value.indexOf("|") !== -1) {
        el.innerHTML = value.split("|").join("<br>");
      } else {
        el.textContent = value;
      }
    });

    langToggleButtons.forEach(function (btn) {
      var isActive = btn.getAttribute("data-lang") === lang;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    // If the lightbox is open when the language changes, refresh its
    // caption too instead of leaving it in the old language.
    if (lightbox && !lightbox.hidden && lastOpenedGalleryTile) {
      lightboxCaption.textContent =
        lastOpenedGalleryTile.getAttribute("data-caption-" + lang) || "";
    }
  }

  langToggleButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = btn.getAttribute("data-lang");
      if (lang && lang !== currentLang) applyLanguage(lang);
    });
  });

  /* ---------------------------------------------------------
     1. Mobile nav toggle
     --------------------------------------------------------- */
  var navToggle = document.getElementById("nav-toggle");
  var mainNav = document.getElementById("main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
      mainNav.classList.toggle("is-open", !isOpen);
    });

    // Close the mobile menu after choosing a link
    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
        mainNav.classList.remove("is-open");
      });
    });
  }

  /* ---------------------------------------------------------
     2. Staggered scroll reveal
     Groups .reveal elements by their parent grid/list so
     siblings stagger in together, then fires once per element.
     --------------------------------------------------------- */
  var revealEls = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var groups = new Map();
    revealEls.forEach(function (el) {
      var parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach(function (siblings) {
      siblings.forEach(function (el, i) {
        el.style.setProperty("--reveal-delay", (i * 90) + "ms");
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "200px 0px -5% 0px" }
    );

    revealEls.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------
     3. Hero on-load stagger
     Separate from the scroll-reveal above: these elements are
     already in the viewport at page load, so they animate
     immediately in a fixed sequence (data-hero-order) rather
     than waiting on an IntersectionObserver.
     --------------------------------------------------------- */
  var heroRevealEls = document.querySelectorAll(".reveal-hero");

  if (prefersReducedMotion) {
    heroRevealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    heroRevealEls.forEach(function (el) {
      var order = parseInt(el.getAttribute("data-hero-order"), 10) || 0;
      el.style.setProperty("--reveal-delay", (order * 100) + "ms");
    });
    // Double rAF so the browser paints the opacity:0 starting state at
    // least once before we flip to is-visible — otherwise the browser
    // can coalesce both style changes into a single paint and the
    // transition never actually plays.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        heroRevealEls.forEach(function (el) { el.classList.add("is-visible"); });
      });
    });
  }

  /* ---------------------------------------------------------
     4. Gallery lightbox
     --------------------------------------------------------- */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxCaption = document.getElementById("lightbox-caption");
  var lightboxClose = document.getElementById("lightbox-close");
  var galleryTiles = document.querySelectorAll(".gallery-tile");
  var lastFocusedEl = null;
  var lastOpenedGalleryTile = null;

  function getFocusable(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return !el.hasAttribute("disabled"); });
  }

  function openLightbox(tile) {
    lastFocusedEl = document.activeElement;
    lastOpenedGalleryTile = tile;

    var caption = tile.getAttribute("data-caption-" + currentLang) || "";
    var imgEl = tile.querySelector(".gallery-tile__img");

    lightboxCaption.textContent = caption;
    lightboxImg.className = "lightbox__img";
    if (imgEl) {
      imgEl.classList.forEach(function (cls) {
        if (cls.indexOf("gallery-tile__img--") === 0) {
          lightboxImg.classList.add("gallery-tile__img--" + cls.split("--")[1]);
        }
      });
    }

    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxClose.focus();

    document.addEventListener("keydown", onLightboxKeydown);
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onLightboxKeydown);
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  function onLightboxKeydown(e) {
    if (e.key === "Escape") {
      closeLightbox();
      return;
    }
    if (e.key === "Tab") {
      var focusable = getFocusable(lightbox);
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  galleryTiles.forEach(function (tile) {
    tile.addEventListener("click", function () { openLightbox(tile); });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  // Normalizes lang-toggle button states and document.documentElement.lang;
  // a no-op on the page text itself since it already matches data-en.
  applyLanguage("en");
})();
