/* ============================================================
   OASIS J&R LAND CLEARING — main.js
   Vanilla JS, no dependencies. Eight independent features:
   1. Mobile nav toggle (aria-expanded)
   2. Staggered scroll-reveal via IntersectionObserver
   3. Hero on-load stagger (fade + slide up, fixed sequence)
   4. Gallery lightbox with focus trap + Escape + focus-return
   5. EN / ES language toggle (data-en / data-es swap)
   6. Hero background video (reduced-motion aware autoplay)
   7. Project photo carousel (auto-advance, arrows, swipe, loop)
   8. Hero scroll fade — content + scrim fade out together as
      the user scrolls, revealing heroimage.png (RAF-throttled)
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
     7. Project photo carousel
     Runs before the language toggle below clones two slides at
     each end for a seamless loop; those clones need to exist
     before the language toggle queries [data-en], otherwise
     clone captions would never get swept into translatableEls.
     --------------------------------------------------------- */
  var carouselRoot = document.getElementById("gallery-carousel");
  if (carouselRoot) {
    var carouselTrack = document.getElementById("gallery-track");
    var carouselViewport = carouselRoot.querySelector(".carousel__viewport");
    var carouselPrev = carouselRoot.querySelector(".carousel__arrow--prev");
    var carouselNext = carouselRoot.querySelector(".carousel__arrow--next");
    var carouselRealSlides = Array.prototype.slice.call(carouselTrack.children);
    var CAROUSEL_REAL_COUNT = carouselRealSlides.length;
    var CAROUSEL_CLONE_COUNT = 2; // covers both the 2-up and 1-up step sizes

    // Prepend clones of the last two slides, append clones of the first
    // two, so stepping past either end lands on a visually-identical
    // clone — then we snap (no transition) back to the real slide.
    carouselRealSlides.slice(CAROUSEL_REAL_COUNT - CAROUSEL_CLONE_COUNT).forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("data-carousel-clone", "true");
      carouselTrack.insertBefore(clone, carouselTrack.firstChild);
    });
    carouselRealSlides.slice(0, CAROUSEL_CLONE_COUNT).forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("data-carousel-clone", "true");
      carouselTrack.appendChild(clone);
    });

    var carouselPosition = CAROUSEL_CLONE_COUNT; // index of real slide 0

    function carouselVisibleCount() {
      return window.matchMedia("(max-width: 640px)").matches ? 1 : 2;
    }
    function carouselStepPx() {
      var firstSlide = carouselTrack.children[0];
      var gap = parseFloat(getComputedStyle(carouselTrack).columnGap) || 0;
      return firstSlide.getBoundingClientRect().width + gap;
    }
    function carouselRender(instant) {
      var offset = -carouselPosition * carouselStepPx();
      if (instant || prefersReducedMotion) {
        carouselTrack.style.transition = "none";
        carouselTrack.style.transform = "translateX(" + offset + "px)";
        void carouselTrack.offsetHeight; // force reflow before re-enabling transition
        carouselTrack.style.transition = "";
      } else {
        carouselTrack.style.transform = "translateX(" + offset + "px)";
      }
    }
    function carouselGo(delta) {
      carouselPosition += delta;
      carouselRender(false);
    }

    carouselTrack.addEventListener("transitionend", function (e) {
      if (e.target !== carouselTrack || e.propertyName !== "transform") return;
      if (carouselPosition >= CAROUSEL_CLONE_COUNT + CAROUSEL_REAL_COUNT) {
        carouselPosition -= CAROUSEL_REAL_COUNT;
        carouselRender(true);
      } else if (carouselPosition < CAROUSEL_CLONE_COUNT) {
        carouselPosition += CAROUSEL_REAL_COUNT;
        carouselRender(true);
      }
    });

    var CAROUSEL_AUTO_MS = 4500;
    var carouselTimer = null;
    function carouselStop() {
      if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
    }
    function carouselStart() {
      carouselStop();
      if (prefersReducedMotion) return;
      carouselTimer = setInterval(function () { carouselGo(carouselVisibleCount()); }, CAROUSEL_AUTO_MS);
    }

    if (carouselPrev) {
      carouselPrev.addEventListener("click", function () {
        carouselGo(-carouselVisibleCount());
        carouselStart(); // reset the timer so it doesn't jump right after
      });
    }
    if (carouselNext) {
      carouselNext.addEventListener("click", function () {
        carouselGo(carouselVisibleCount());
        carouselStart();
      });
    }

    carouselRoot.addEventListener("mouseenter", carouselStop);
    carouselRoot.addEventListener("mouseleave", carouselStart);
    carouselRoot.addEventListener("focusin", carouselStop);
    carouselRoot.addEventListener("focusout", function () {
      // Only resume once focus has actually left the whole carousel.
      requestAnimationFrame(function () {
        if (!carouselRoot.contains(document.activeElement)) carouselStart();
      });
    });

    // Touch swipe — threshold-based (not drag-follow) to keep this simple
    // and robust; a plain tap still passes through to the tile's click.
    // Compares deltaX to deltaY so a mostly-vertical scroll gesture isn't
    // mistaken for a swipe and doesn't hijack page scrolling.
    var carouselTouchStartX = null;
    var carouselTouchStartY = null;
    if (carouselViewport) {
      carouselViewport.addEventListener("touchstart", function (e) {
        carouselTouchStartX = e.touches[0].clientX;
        carouselTouchStartY = e.touches[0].clientY;
        carouselStop();
      }, { passive: true });
      carouselViewport.addEventListener("touchend", function (e) {
        if (carouselTouchStartX === null) return;
        var deltaX = e.changedTouches[0].clientX - carouselTouchStartX;
        var deltaY = e.changedTouches[0].clientY - carouselTouchStartY;
        if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
          carouselGo(deltaX < 0 ? carouselVisibleCount() : -carouselVisibleCount());
        }
        carouselTouchStartX = null;
        carouselTouchStartY = null;
        carouselStart();
      }, { passive: true });
    }

    window.addEventListener("resize", function () { carouselRender(true); });

    carouselRender(true);
    carouselStart();
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
     8. Hero scroll fade
     As the user scrolls through the hero, .hero__content (the
     business name, eyebrow, headline, subhead, CTAs,
     credibility pills, logo placeholder, and EN/ES toggle all
     live inside this one wrapper) fades from opaque to
     transparent, while .hero__scrim fades the same amount so
     the dark overlay lightens and heroimage.png shows through
     clearly. Both driven by one scroll-progress value (0 at the
     top of the hero, 1 once it's scrolled a full hero-height)
     so the two effects stay perfectly in sync.

     Opacity is set directly (no CSS transition) and only inside
     a requestAnimationFrame callback gated by a "ticking" flag,
     so a burst of scroll events collapses to one style write per
     frame — smooth and layout-shift-free. Skipped entirely under
     prefers-reduced-motion, leaving the content/scrim at their
     normal (non-scroll-linked) state.
     --------------------------------------------------------- */
  var heroEl = document.querySelector(".hero");
  var heroContentEl = document.querySelector(".hero__content");
  var heroScrimEl = document.querySelector(".hero__scrim");

  if (heroEl && heroContentEl && heroScrimEl && !prefersReducedMotion) {
    var heroFadeHeight = heroEl.offsetHeight;
    var heroFadeTicking = false;

    function updateHeroFade() {
      heroFadeTicking = false;
      var progress = heroFadeHeight > 0 ? window.scrollY / heroFadeHeight : 0;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      var opacity = String(1 - progress);
      heroContentEl.style.opacity = opacity;
      heroScrimEl.style.opacity = opacity;
    }

    function onHeroScroll() {
      if (heroFadeTicking) return;
      heroFadeTicking = true;
      requestAnimationFrame(updateHeroFade);
    }

    window.addEventListener("scroll", onHeroScroll, { passive: true });
    window.addEventListener("resize", function () {
      heroFadeHeight = heroEl.offsetHeight;
      onHeroScroll();
    });

    updateHeroFade(); // correct state immediately, e.g. on a mid-scroll reload
  }

  /* ---------------------------------------------------------
     4. Gallery lightbox
     --------------------------------------------------------- */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxCaption = document.getElementById("lightbox-caption");
  var lightboxClose = document.getElementById("lightbox-close");
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

  // Delegated (not per-tile) so the carousel's cloned slides — added
  // above, after this script started running — open the lightbox too.
  if (carouselRoot) {
    carouselRoot.addEventListener("click", function (e) {
      var tile = e.target.closest(".gallery-tile");
      if (tile) openLightbox(tile);
    });
  }

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
