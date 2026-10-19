/* ==========================================================================
   Miami Beach Botanical Garden — script.js
   --------------------------------------------------------------------------
   1. Mobile hamburger menu
   2. Active nav state (based on current page)
   3. Scroll fade-in animation
   4. Accordions (Visit + About pages)
   5. Event category filtering (Events page)
   6. Back-to-top button
   7. Smooth scrolling for anchor links
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {

  /* ------------------------------------------------------------------
     1. Mobile hamburger menu
     ------------------------------------------------------------------ */
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", function () {
      const isOpen = mobileNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close the menu when a nav link is clicked
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    // Close the menu with the Escape key (keyboard accessibility)
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && mobileNav.classList.contains("open")) {
        mobileNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.focus();
      }
    });

    // Accordion: expand/collapse each tab's sub-links on mobile
    mobileNav.querySelectorAll(".m-toggle").forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        const sub = toggle.closest(".m-group").querySelector(".m-sub");
        const isOpen = sub.classList.toggle("open");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
    });
  }


  /* ------------------------------------------------------------------
     2. Active nav state — highlight the link for the current page
     ------------------------------------------------------------------ */
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document
    .querySelectorAll(".main-nav .nav-link, .mobile-nav .m-parent-link")
    .forEach(function (link) {
      const linkPage = link.getAttribute("href");
      if (linkPage === currentPage) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });


  /* ------------------------------------------------------------------
     3. Scroll fade-in animation
     Sections with the .fade-in class become visible as they scroll
     into view. IntersectionObserver keeps this efficient.
     ------------------------------------------------------------------ */
  const fadeElements = document.querySelectorAll(".fade-in");

  if ("IntersectionObserver" in window) {
    const fadeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            fadeObserver.unobserve(entry.target); // animate only once
          }
        });
      },
      { threshold: 0.12 }
    );

    fadeElements.forEach(function (el) {
      fadeObserver.observe(el);
    });
  } else {
    // Older browsers: just show everything
    fadeElements.forEach(function (el) {
      el.classList.add("visible");
    });
  }


  /* ------------------------------------------------------------------
     4. Accordions
     Each accordion is a <button class="accordion-trigger"> followed
     by a <div class="accordion-panel">. The panel animates open and
     closed using max-height.
     ------------------------------------------------------------------ */
  document.querySelectorAll(".accordion-trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      const panel = document.getElementById(
        trigger.getAttribute("aria-controls")
      );
      const isExpanded = trigger.getAttribute("aria-expanded") === "true";

      trigger.setAttribute("aria-expanded", isExpanded ? "false" : "true");

      if (isExpanded) {
        panel.style.maxHeight = null; // collapse
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px"; // expand
      }
    });
  });


  /* ------------------------------------------------------------------
     5. Event category filtering (Events page)
     Clicking a filter button shows only event cards whose
     data-category matches the button's data-filter value.
     ------------------------------------------------------------------ */
  const filterButtons = document.querySelectorAll(".filter-btn");
  const eventCards = document.querySelectorAll(".event-card");

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const filter = button.getAttribute("data-filter");

      // Update which button looks active
      filterButtons.forEach(function (btn) {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");

      // Show/hide event cards
      eventCards.forEach(function (card) {
        const category = card.getAttribute("data-category");
        if (filter === "all" || category === filter) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });


  /* ------------------------------------------------------------------
     6. Back-to-top button
     Appears after scrolling down; scrolls smoothly back to the top.
     ------------------------------------------------------------------ */
  const backToTop = document.querySelector(".back-to-top");

  if (backToTop) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 500) {
        backToTop.classList.add("show");
      } else {
        backToTop.classList.remove("show");
      }
    });

    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }


  /* ------------------------------------------------------------------
     6.5 Butterfly cursor follower
     A butterfly trails behind the mouse, gently fluttering its wings.
     - Only runs on devices with a real mouse (pointer: fine)
     - Skipped entirely if the user prefers reduced motion
     - The wings flap faster while the cursor moves, and settle into
       a slow idle flutter when it rests.
     ------------------------------------------------------------------ */
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (hasFinePointer && !prefersReducedMotion) {
    // RESTING DISTANCE: where the butterfly settles relative to the
    // cursor once you stop moving. Positive X = right, positive Y = down.
    // (34, -30) parks it up and to the right. Increase for more distance.
    const FOLLOW_OFFSET_X = 34;
    const FOLLOW_OFFSET_Y = -30;

    // Build the follower element (no HTML edits needed on any page)
    const butterfly = document.createElement("div");
    butterfly.className = "butterfly-follower";
    butterfly.setAttribute("aria-hidden", "true");

    const wings = document.createElement("img");
    wings.src = "images/butterfly.svg";
    wings.alt = "";
    butterfly.appendChild(wings);
    document.body.appendChild(butterfly);

    // Mouse target position
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    // Butterfly's current (lagging) position
    let posX = mouseX;
    let posY = mouseY;

    let flapPhase = 0;        // where we are in the flap cycle
    let lastTime = performance.now();
    let started = false;

    document.addEventListener("mousemove", function (event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!started) {
        started = true;
        posX = mouseX + FOLLOW_OFFSET_X;
        posY = mouseY + FOLLOW_OFFSET_Y;
        butterfly.classList.add("visible");
      }
    });

    // Fade out when the cursor leaves the window, back in on return
    document.addEventListener("mouseleave", function () {
      butterfly.classList.remove("visible");
    });
    document.addEventListener("mouseenter", function () {
      if (started) butterfly.classList.add("visible");
    });

    function animateButterfly(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // seconds
      lastTime = now;

      // The butterfly aims for a point OFFSET from the cursor,
      // so it never lands on top of it
      const targetX = mouseX + FOLLOW_OFFSET_X;
      const targetY = mouseY + FOLLOW_OFFSET_Y;

      // Ease toward the target — this creates the "lag"
      const ease = 1 - Math.pow(0.001, dt); // ~framerate-independent
      posX += (targetX - posX) * ease * 0.55;
      posY += (targetY - posY) * ease * 0.55;

      // How far from the resting point are we? (drives tilt + flap speed)
      const dx = targetX - posX;
      const dy = targetY - posY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Wings: slow idle flutter, faster while chasing the cursor
      // const flapSpeed = 5 + Math.min(distance * 0.12, 9); // cycles/sec-ish
      // flapPhase += flapSpeed * dt * Math.PI * 2;
      // const flapAngle = Math.sin(flapPhase) * 16; // degrees — keep subtle

      // Small tilt in the direction of travel
      const tilt = Math.max(-14, Math.min(14, dx * 0.08));

      // Gentle bob while hovering in place
      const bob = Math.sin(now / 600) * 3;

      butterfly.style.transform =
        "translate(" + posX + "px, " + (posY + bob) + "px) " +
        "rotate(" + tilt + "deg)";

      // Flap around the butterfly's diagonal body axis
      // wings.style.transform =
      //   "rotate3d(0.6, 1, 0, " + flapAngle + "deg)";

      requestAnimationFrame(animateButterfly);
    }

    requestAnimationFrame(animateButterfly);
  }


  /* ------------------------------------------------------------------
     7. Smooth scrolling for same-page anchor links
     (CSS scroll-behavior handles most of this; this adds a small
     offset so the sticky header doesn't cover section headings.)
     ------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (event) {
      const targetId = anchor.getAttribute("href");
      if (targetId.length > 1) {
        const target = document.querySelector(targetId);
        if (target) {
          event.preventDefault();
          const headerHeight =
            document.querySelector(".site-header").offsetHeight;
          const top =
            target.getBoundingClientRect().top +
            window.scrollY -
            headerHeight -
            16;
          window.scrollTo({ top: top, behavior: "smooth" });
        }
      }
    });
  });

});
