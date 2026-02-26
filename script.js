/* ===========================================================
   Shadow Portfolio — Junior+ Glass / Portal / Voronoi Crack UI
   Fixes/Optimizations:
   - FIX: modal crack generation measured AFTER modal is visible (prevents 0x0 infinite loops)
   - FIX: Voronoi genSites has bounded attempts (no infinite accept-reject)
   - OPT: card scrubbing uses rAF loop only while hovering
   - OPT: magnetic/tilt init guarded (no duplicate loops on re-render)
   =========================================================== */

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rafThrottle(fn) {
    let rafId = 0;
    return (...args) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        fn(...args);
      });
    };
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- DOM ----------
  const intro = $("#intro-screen");
  const main = $("#main-content");
  const enterBtn = $("#enterBtn");
  const projectsBtn = $("#projectsBtn");

  const portal = $("#portal");

  const cursorDot = $("#cursor-dot");
  const cursorRing = $("#cursor-ring");

  const reactiveGlow = $("#reactiveGlow");

  const nav = $("#nav");
  const navLinks = nav ? $$(".nav-link", nav) : [];
  const navGlow = nav ? $(".nav-glow", nav) : null;
  const navIndicator = nav ? $(".nav-indicator", nav) : null;

  const projectsGrid = $("#projectsGrid");
  const filterBtns = $$(".filter-btn");

  const modal = $("#modal");
  const modalCard = $("#modalCard");
  const crackSvg = $("#crackSvg");
  const shardsWrap = $("#shards");

  const modalTitle = $("#modalTitle");
  const modalDesc = $("#modalDesc");
  const modalTags = $("#modalTags");
  const modalMeta = $("#modalMeta");
  const modalDemo = $("#modalDemo");
  const modalCode = $("#modalCode");

  const modalVideo = $("#modalVideo");
  const modalShot = $("#modalShot");
  const shot3d = $("#shot3d");
  const modalMedia = $("#modalMedia");

  const crackSound = $("#crackSound");

  // ---------- Audio ----------
  function setAudioVolume(v = 0.18) {
    if (!crackSound) return;
    crackSound.volume = clamp(v, 0, 1);
  }
  setAudioVolume(0.12);

  function playCrack() {
    if (!crackSound) return;
    try {
      crackSound.currentTime = 0;
      crackSound.play().catch(() => {});
    } catch (_) {}
  }

  // ---------- Intro ready animation ----------
  window.addEventListener("load", () => intro?.classList.add("is-ready"), { once: true });

  // ---------- Cursor ----------
  let mouseX = window.innerWidth * 0.5;
  let mouseY = window.innerHeight * 0.5;
  let dotX = mouseX, dotY = mouseY;
  let ringX = mouseX, ringY = mouseY;

  if (!REDUCED) {
    window.addEventListener("mousemove", rafThrottle((e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (cursorDot) cursorDot.style.opacity = "1";
      if (cursorRing) cursorRing.style.opacity = "1";

      const el = document.elementFromPoint(mouseX, mouseY);
      const isLink = !!(el && el.closest("a, button, .card, .filter-btn, .modal-close"));
      document.body.classList.toggle("cursor-link", isLink);
    }), { passive: true });

    window.addEventListener("mouseleave", () => {
      if (cursorDot) cursorDot.style.opacity = "0";
      if (cursorRing) cursorRing.style.opacity = "0";
    });

    window.addEventListener("mousedown", () => document.body.classList.add("cursor-down"));
    window.addEventListener("mouseup", () => document.body.classList.remove("cursor-down"));

    (function tickCursor(){
      dotX = lerp(dotX, mouseX, 0.55);
      dotY = lerp(dotY, mouseY, 0.55);
      ringX = lerp(ringX, mouseX, 0.20);
      ringY = lerp(ringY, mouseY, 0.20);

      if (cursorDot) cursorDot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%,-50%)`;
      if (cursorRing) cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%,-50%)`;

      // glow follow (subtle)
      if (reactiveGlow) {
        reactiveGlow.style.setProperty("--gx", `${(mouseX / innerWidth) * 100}%`);
        reactiveGlow.style.setProperty("--gy", `${(mouseY / innerHeight) * 100}%`);
      }

      requestAnimationFrame(tickCursor);
    })();
  }

  // ---------- Magnetic hover (guarded init) ----------
  function setupMagnetic() {
    if (REDUCED) return;
    $$(".magnetic").forEach((el) => {
      if (el.dataset.magInit === "1") return;
      // don't fight tilt transforms
      if (el.classList.contains("tilt")) return;

      el.dataset.magInit = "1";
      let bx = 0, by = 0;
      let tx = 0, ty = 0;

      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;

        el.style.setProperty("--mx", `${(mx / r.width) * 100}%`);
        el.style.setProperty("--my", `${(my / r.height) * 100}%`);

        const dx = mx - r.width / 2;
        const dy = my - r.height / 2;

        tx = dx * 0.08;
        ty = dy * 0.08;
      }, { passive: true });

      el.addEventListener("mouseleave", () => { tx = 0; ty = 0; });

      (function tick(){
        if (!el.isConnected) return;
        bx = lerp(bx, tx, 0.18);
        by = lerp(by, ty, 0.18);
        el.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
        requestAnimationFrame(tick);
      })();
    });
  }

  // ---------- Tilt (guarded init) ----------
  function setupTilt() {
    if (REDUCED) return;
    $$(".tilt").forEach((el) => {
      if (el.dataset.tiltInit === "1") return;
      el.dataset.tiltInit = "1";

      let rx = 0, ry = 0, trX = 0, trY = 0;

      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;

        el.style.setProperty("--lx", `${(x + 0.5) * 100}%`);
        el.style.setProperty("--ly", `${(y + 0.5) * 100}%`);

        trX = clamp(-y * 8, -10, 10);
        trY = clamp(x * 10, -12, 12);
      }, { passive: true });

      el.addEventListener("mouseleave", () => {
        trX = 0; trY = 0;
        el.style.setProperty("--lx", `50%`);
        el.style.setProperty("--ly", `35%`);
      });

      (function tick(){
        if (!el.isConnected) return;
        rx = lerp(rx, trX, 0.12);
        ry = lerp(ry, trY, 0.12);
        el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
        requestAnimationFrame(tick);
      })();
    });
  }

  setupMagnetic();
  setupTilt();

  // ---------- Counters ----------
  function runCounters() {
    const els = $$("[data-counter]");
    els.forEach((el) => {
      const target = parseInt(el.getAttribute("data-counter") || "0", 10);
      if (!target) return;
      const t0 = now();
      const dur = 900;

      (function tick(){
        const t = clamp((now() - t0) / dur, 0, 1);
        const v = Math.round(lerp(0, target, easeOutCubic(t)));
        el.textContent = String(v);
        if (t < 1) requestAnimationFrame(tick);
      })();
    });
  }

  // ---------- Reveal observer ----------
  let revealObserver = null;
  function runRevealObserver() {
    if (revealObserver) return;

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) en.target.classList.add("is-in");
      });
    }, { threshold: 0.12 });

    $$(".reveal").forEach((el) => revealObserver.observe(el));
  }

  // ---------- Intro exit ----------
  function enterSite(targetSection = null, clickXY = null) {
    if (!intro || !main) return;

    intro.classList.add("is-leaving");
    setTimeout(() => {
      intro.style.display = "none";
      main.style.display = "block";
      // ensure we start at the top of the page on first entry
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      requestAnimationFrame(() => {
        main.classList.add("is-ready");
        main.setAttribute("aria-hidden", "false");
        runRevealObserver();
        runCounters();
        if (targetSection) portalToSection(targetSection, clickXY);
      });
    }, 760);
  }

  enterBtn?.addEventListener("click", (e) => {
    playCrack();
    enterSite(null, { x: e.clientX, y: e.clientY });
  });
  projectsBtn?.addEventListener("click", (e) => {
    playCrack();
    enterSite("projects", { x: e.clientX, y: e.clientY });
  });

  window.addEventListener("keydown", (e) => {
    if (intro && intro.style.display !== "none") {
      if (e.key === "Enter" || e.key === " ") {
        playCrack();
        enterSite(null, { x: mouseX, y: mouseY });
      }
    }
  });

  // ---------- Parallax scroll ----------
  window.addEventListener("scroll", rafThrottle(() => {
    const y = window.scrollY || 0;
    $$(".layer").forEach((layer) => {
      const sp = parseFloat(layer.getAttribute("data-speed") || "0.2");
      layer.style.transform = `translate3d(0, ${-y * sp}px, 0)`;
    });
  }), { passive: true });

  // ---------- Nav indicator + glow ----------
  const updateNavIndicator = rafThrottle(() => {
    if (!nav || !navIndicator || navLinks.length === 0) return;

    const sections = $$("section[data-section]");
    const y = window.scrollY || 0;
    const mid = y + innerHeight * 0.35;

    let current = "projects";
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      const top = r.top + y;
      const bottom = top + r.height;
      if (mid >= top && mid < bottom) {
        current = s.getAttribute("data-section") || current;
        break;
      }
    }

    navLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.section === current));

    const active = navLinks.find((a) => a.classList.contains("is-active")) || navLinks[0];
    const r = active.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();

    navIndicator.style.left = `${(r.left - nr.left) + r.width * 0.1}px`;
    navIndicator.style.width = `${r.width * 0.8}px`;
  });

  window.addEventListener("scroll", updateNavIndicator, { passive: true });
  window.addEventListener("resize", updateNavIndicator);
  setTimeout(updateNavIndicator, 240);

  nav?.addEventListener("mousemove", rafThrottle((e) => {
    if (!navGlow) return;
    const nr = nav.getBoundingClientRect();
    const x = e.clientX - nr.left;
    nav.style.setProperty("--gW", `54px`);
    navGlow.style.left = `${clamp(x - 27, 0, nr.width - 54)}px`;
    nav.classList.add("has-glow");
  }), { passive: true });
  nav?.addEventListener("mouseleave", () => nav.classList.remove("has-glow"));

  // ---------- Portal transitions ----------
  function portalBurst(x, y) {
    if (!portal) return;
    portal.style.setProperty("--px", `${(x / innerWidth) * 100}%`);
    portal.style.setProperty("--py", `${(y / innerHeight) * 100}%`);
    portal.classList.add("show");
    document.body.classList.add("portal-zooming");
    setTimeout(() => {
      portal.classList.remove("show");
      document.body.classList.remove("portal-zooming");
    }, 560);
  }

  function portalToSection(sectionId, clickXY = null) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const x = clickXY?.x ?? mouseX;
    const y = clickXY?.y ?? mouseY;
    portalBurst(x, y);
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  $$(".portal-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      e.preventDefault();
      portalToSection(href.slice(1), { x: e.clientX, y: e.clientY });
    });
  });
  $$(".portal-btn").forEach((b) => {
    b.addEventListener("click", (e) => {
      const target = b.getAttribute("data-target");
      if (!target) return;
      portalToSection(target, { x: e.clientX, y: e.clientY });
    });
  });

  // ---------- Projects data ----------
  const PROJECTS = [
    {
      id: "reshenie",
      title: "Reshenie — лендинг услуг",
      desc:
        "Многостраничный сайт с формами и акцентом на структуру: секции, CTA, блоки доверия. " +
        "Упор на аккуратную верстку, контраст и плавные UI-переходы.",
      tags: ["UI", "JS", "Layout"],
      filter: ["ui", "js"],
      demo: "https://reshenie-site1.onrender.com/",
      code: "https://github.com/ShadowAmp1/reshenie-site1",
      shot: "https://image.thum.io/get/width/1200/https://reshenie-site1.onrender.com/",
      video: "https://assets.mixkit.co/videos/preview/mixkit-purple-ink-in-water-117-large.mp4"
    },
    {
      id: "messenger",
      title: "Messenger — чат (prototype)",
      desc:
        "Мини-мессенджер: список диалогов, поле ввода, состояния, взаимодействие через события. " +
        "Фокус на UX и скорость интерфейса (задел под WebSocket/API).",
      tags: ["JS", "UI", "State"],
      filter: ["js", "ui", "api"],
      demo: "https://messenger-k93n.onrender.com/",
      code: "https://github.com/ShadowAmp1/messenger-clone",
      shot: "https://image.thum.io/get/width/1200/https://messenger-k93n.onrender.com/",
      video: "https://assets.mixkit.co/videos/preview/mixkit-network-of-lines-abstract-4886-large.mp4"
    },
    {
      id: "glassui",
      title: "Glass UI Motion Kit",
      desc:
        "Набор микро-анимаций: hover-tilt, portal-zoom переходы, crack-open модалка и scrubbing видео-превью.",
      tags: ["UI", "Motion", "JS"],
      filter: ["ui", "js"],
      demo: "https://shadowamp1.github.io/neon-portfolio/",
      code: "https://github.com/ShadowAmp1/neon-portfolio",
      shot: "https://image.thum.io/get/width/1200/https://shadowamp1.github.io/neon-portfolio/",
      video: "https://assets.mixkit.co/videos/preview/mixkit-abstract-background-with-moving-lines-4885-large.mp4"
    }
  ];

  // ---------- Render projects ----------
  let activeFilter = "all";

  function cardTemplate(p) {
    const tags = p.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("");
    const demo = p.demo ? `<a class="magnetic" href="${p.demo}" target="_blank" rel="noreferrer">Demo</a>` : "";
    const code = p.code ? `<a class="magnetic" href="${p.code}" target="_blank" rel="noreferrer">Code</a>` : "";

    return `
      <article class="card glass-border depth tilt"
        data-id="${p.id}"
        data-filter="${p.filter.join(",")}"
        tabindex="0"
        role="button"
        aria-label="Открыть проект ${escapeHtml(p.title)}"
      >
        <div class="card-preview">
          <video class="card-video" preload="metadata" muted loop playsinline data-src="${p.video}"></video>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.desc)}</p>

        <div class="card-tags">${tags}</div>

        <div class="card-links">
          ${demo}
          ${code}
        </div>
      </article>
    `;
  }

  function renderProjects() {
    if (!projectsGrid) return;

    const list = PROJECTS.filter((p) => activeFilter === "all" ? true : p.filter.includes(activeFilter));
    projectsGrid.innerHTML = list.map(cardTemplate).join("");

    // attach handlers
    setupMagnetic();
    setupTilt();

    $$(".card", projectsGrid).forEach((card) => {
      setupCardVideoScrub(card);
      card.addEventListener("click", (e) => {
        if (e.target && e.target.closest("a")) return;
        openModalByCard(card, e);
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter") openModalByCard(card, null);
      });
    });
  }

  filterBtns.forEach((b) => {
    b.addEventListener("click", () => {
      filterBtns.forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      activeFilter = b.getAttribute("data-filter") || "all";
      renderProjects();
    });
  });

  renderProjects();

  // ---------- Hover video scrubbing + velocity blur (optimized) ----------
  function setupCardVideoScrub(card) {
    if (card.dataset.scrubInit === "1") return;
    card.dataset.scrubInit = "1";

    const v = $(".card-video", card);
    if (!v) return;

    let loaded = false;
    let hovering = false;
    let rafId = 0;

    let targetTime = 0;
    let blurNow = 0;
    let blurTarget = 0;

    let lastClientX = 0;
    let lastTs = 0;

    function ensureSrc(){
      if (loaded) return;
      const src = v.dataset.src;
      if (src) v.src = src;
      loaded = true;
    }

    v.addEventListener("loadedmetadata", () => {}, { once: true });

    function tick(){
      rafId = 0;
      if (!hovering) return;

      const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;

      if (dur > 0) {
        const cur = v.currentTime || 0;
        const next = cur + (targetTime - cur) * 0.22;
        try { v.currentTime = clamp(next, 0, Math.max(0, dur - 0.05)); } catch {}
      }

      blurNow = blurNow + (blurTarget - blurNow) * 0.18;
      blurTarget *= 0.86;
      if (blurTarget < 0.02) blurTarget = 0;

      card.style.setProperty("--vblur", `${blurNow.toFixed(2)}px`);

      rafId = requestAnimationFrame(tick);
    }

    card.addEventListener("mouseenter", () => {
      if (REDUCED) return;
      hovering = true;
      ensureSrc();

      // warm up decoding so seeking feels smoother
      v.play().then(() => {
        setTimeout(() => { try { v.pause(); } catch {} }, 80);
      }).catch(()=>{});

      blurNow = 0; blurTarget = 0;
      lastTs = now();
      lastClientX = 0;

      if (!rafId) rafId = requestAnimationFrame(tick);
    });

    card.addEventListener("mousemove", (e) => {
      if (REDUCED || !hovering) return;

      const r = card.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width, 0, 1);

      const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
      if (dur > 0) targetTime = px * (dur * 0.95);

      // velocity -> blur
      const t = now();
      const dt = Math.max(8, t - lastTs);
      const dx = Math.abs(e.clientX - lastClientX);
      const speed = dx / dt; // px/ms
      const desired = clamp(speed * 18, 0, 9);
      blurTarget = Math.max(blurTarget, desired);

      lastClientX = e.clientX;
      lastTs = t;

      if (!rafId) rafId = requestAnimationFrame(tick);
    }, { passive:true });

    card.addEventListener("mouseleave", () => {
      hovering = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      card.style.setProperty("--vblur", `0px`);
      try { v.pause(); v.currentTime = 0; } catch {}
    });
  }

  // ---------- Modal open/close ----------
  let isModalOpen = false;

  // Scroll lock that preserves the exact scroll position (prevents jump-to-top on close)
  let __scrollLockY = 0;
  let __scrollLocked = false;
  function lockScroll(){
    if (__scrollLocked) return;
    __scrollLocked = true;
    __scrollLockY = window.scrollY || window.pageYOffset || 0;

    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${__scrollLockY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  }

  function unlockScroll(){
    if (!__scrollLocked) return;
    __scrollLocked = false;

    document.documentElement.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";

    window.scrollTo({ top: __scrollLockY, left: 0, behavior: "auto" });
  }


  function openModalByCard(card, ev) {
    const id = card.getAttribute("data-id");
    const project = PROJECTS.find((p) => p.id === id);
    if (!project) return;

    let click = null;
    if (ev && typeof ev.clientX === "number") {
      click = { x: ev.clientX, y: ev.clientY };
    } else {
      const r = card.getBoundingClientRect();
      click = { x: r.left + r.width * 0.55, y: r.top + r.height * 0.45 };
    }
    openModal(project, click);
  }

  function openModal(project, clickXY) {
    if (!modal || !modalCard) return;

    // fill content first
    modalTitle.textContent = project.title;
    modalDesc.textContent = project.desc;
    modalTags.innerHTML = project.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("");
    modalMeta.textContent = `Stack: ${project.tags.join(" • ")} • ${project.filter.join(" / ")}`;

    modalDemo.href = project.demo || "#";
    modalCode.href = project.code || "#";
    modalDemo.style.opacity = project.demo ? "1" : "0.35";
    modalCode.style.opacity = project.code ? "1" : "0.35";

    if (modalShot) {
      modalShot.src = project.shot || "";
      modalShot.alt = `Скриншот: ${project.title}`;
    }

    // show modal FIRST (so bounding box has real size)
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockScroll();
    isModalOpen = true;

    // restart opening animation reliably
    modal.classList.remove("is-opening");
    void modal.offsetWidth;
    modal.classList.add("is-opening");

    // media (after open to avoid load jank while hidden)
    if (modalVideo) {
      try { modalVideo.pause(); modalVideo.currentTime = 0; } catch {}
      modalVideo.removeAttribute("src");
      if (project.video) {
        modalVideo.src = project.video;
        modalVideo.load?.();
        modalVideo.play().catch(()=>{});
      }
    }

    // generate crack/shards in next frame when modal is laid out
    requestAnimationFrame(() => {
      const r = modalCard.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));

      // impact point inside modalCard (clamped)
      const ix = clamp(clickXY?.x ?? (r.left + r.width/2), r.left, r.right);
      const iy = clamp(clickXY?.y ?? (r.top + r.height/2), r.top, r.bottom);
      const localX = ix - r.left;
      const localY = iy - r.top;

      // set CSS origin
      modalCard.style.setProperty("--crx", `${(localX / r.width) * 100}%`);
      modalCard.style.setProperty("--cry", `${(localY / r.height) * 100}%`);

      // direction from impact -> center
      const dirToCenter = Math.atan2((h / 2) - localY, (w / 2) - localX);

      // clear old and generate new (Voronoi-like)
      if (crackSvg) crackSvg.innerHTML = "";
      genVoronoiCrack(w, h, localX, localY, dirToCenter);
      genShards(localX, localY, w, h, dirToCenter);
    });

    playCrack();
    setTimeout(() => modal.classList.remove("is-opening"), REDUCED ? 1 : 820);

    setTimeout(() => $(".modal-close", modalCard)?.focus(), 60);
  }

  function closeModal() {
    if (!modal || !isModalOpen) return;
    isModalOpen = false;

    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    modal.classList.remove("is-opening");

    // cleanup
    if (crackSvg) crackSvg.innerHTML = "";
    unlockScroll();

    try { modalVideo?.pause?.(); } catch {}
  }

  // backdrop / close button
  modal?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "true") closeModal();
  });
  $(".modal-close", modalCard)?.addEventListener("click", closeModal);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // ---------- 3D screenshot (attach once) ----------
  if (shot3d && modalMedia && !REDUCED) {
    let bound = false;
    if (!bound) {
      bound = true;
      modalMedia.addEventListener("mousemove", rafThrottle((e) => {
        if (!isModalOpen) return;
        const r = modalMedia.getBoundingClientRect();
        const x = clamp((e.clientX - r.left) / r.width, 0, 1);
        const y = clamp((e.clientY - r.top) / r.height, 0, 1);

        const rx = (0.5 - y) * 7;
        const ry = (x - 0.5) * 10;

        shot3d.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        shot3d.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
        shot3d.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
        shot3d.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);

        const shine = clamp(1 - Math.hypot(x - 0.5, y - 0.5) * 1.25, 0, 1);
        shot3d.style.setProperty("--shine", `${shine.toFixed(3)}`);
      }), { passive: true });

      modalMedia.addEventListener("mouseleave", () => {
        if (!isModalOpen) return;
        shot3d.style.setProperty("--rx", `0deg`);
        shot3d.style.setProperty("--ry", `0deg`);
        shot3d.style.setProperty("--shine", `0`);
      });
    }
  }

  // ---------- Shards burst (lighter + deterministic) ----------
  function genShards(localX, localY, w, h, dirToCenter) {
    if (!shardsWrap || !modalCard) return;

    // set origin vars (used by CSS for positioning)
    modalCard.style.setProperty("--crx", `${(localX / w) * 100}%`);
    modalCard.style.setProperty("--cry", `${(localY / h) * 100}%`);

    const shards = $$(".shard", shardsWrap);
    const base = dirToCenter;

    shards.forEach((s, i) => {
      const a = base + rand(-1.25, 1.25) + i * 0.10;
      const mag = rand(140, 360) * (i % 5 === 0 ? 1.25 : 1);

      const tx = Math.cos(a) * mag;
      const ty = Math.sin(a) * mag;

      s.style.setProperty("--tx", `${tx.toFixed(0)}px`);
      s.style.setProperty("--ty", `${ty.toFixed(0)}px`);
      s.style.setProperty("--w", `${rand(16, 34).toFixed(0)}px`);
      s.style.setProperty("--h", `${rand(10, 22).toFixed(0)}px`);

      const sr = rand(-90, 90);
      const er = sr + rand(-240, 240);
      s.style.setProperty("--sr", `${sr.toFixed(0)}deg`);
      s.style.setProperty("--er", `${er.toFixed(0)}deg`);

      s.style.animationDelay = `${randi(0, 70)}ms`;
    });
  }

  // =======================
  // Voronoi-like crack generation (safe + bounded)
  // =======================
  const SVG_NS = "http://www.w3.org/2000/svg";

  function makePath(d, sw, op, delay) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "crack-path");
    p.setAttribute("pathLength", "1000");
    p.style.setProperty("--sw", sw.toFixed(2));
    p.style.setProperty("--op", op.toFixed(2));
    p.style.animationDelay = `${delay}ms`;
    return p;
  }

  function polyPath(points) {
    if (!points || points.length < 2) return "";
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }
    return d;
  }

  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  function nearestIndex(pts, x, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = dist2(pts[i].x, pts[i].y, x, y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function genSites(w, h, ox, oy, dirToCenter) {
    const pts = [];

    const minWH = Math.max(1, Math.min(w, h));
    const cx = w * 0.5;
    const cy = h * 0.5;

    // adaptive target count (kept moderate)
    const target = clamp(Math.floor((w * h) / (260 * 260)), 28, 100);

    const ux = Math.cos(dirToCenter);
    const uy = Math.sin(dirToCenter);

    // anchors
    const pad = 10;
    pts.push({ x: clamp(ox, pad, w - pad), y: clamp(oy, pad, h - pad), w: 1.0 }); // impact
    pts.push({ x: cx, y: cy, w: 0.9 });
    pts.push({ x: pad, y: pad, w: 0.6 });
    pts.push({ x: w - pad, y: pad, w: 0.6 });
    pts.push({ x: pad, y: h - pad, w: 0.6 });
    pts.push({ x: w - pad, y: h - pad, w: 0.6 });

    // bounded attempts to prevent freeze
    const maxAttempts = target * 30;
    let attempts = 0;

    while (pts.length < target && attempts < maxAttempts) {
      attempts++;

      const x = Math.random() * w;
      const y = Math.random() * h;

      // corridor bias
      const vx = x - ox;
      const vy = y - oy;
      const t = vx * ux + vy * uy;

      const px = ox + ux * t;
      const py = oy + uy * t;
      const perp = Math.sqrt(dist2(x, y, px, py));

      const corridorW = Math.max(1, lerp(minWH * 0.08, minWH * 0.22, clamp(t / (minWH * 0.9), 0, 1)));
      const corridorScore = Math.exp(-(perp * perp) / (2 * corridorW * corridorW));

      const toCenter = Math.sqrt(dist2(x, y, cx, cy));
      const centerScore = 1 - clamp(toCenter / (minWH * 0.95), 0, 1);

      const acceptProb = clamp(0.18 + 0.60 * corridorScore + 0.18 * centerScore, 0.05, 0.95);

      if (Math.random() < acceptProb) {
        pts.push({ x, y, w: 0.35 + 0.65 * corridorScore });
      }
    }

    return pts;
  }

  function buildKNNGraph(pts, k = 4) {
    // For small k, keep k nearest without sorting full array
    const edges = new Map();
    const adj = Array.from({ length: pts.length }, () => []);

    for (let i = 0; i < pts.length; i++) {
      const pi = pts[i];
      const best = []; // {j,d} sorted asc

      for (let j = 0; j < pts.length; j++) {
        if (j === i) continue;
        const pj = pts[j];
        const d = dist2(pi.x, pi.y, pj.x, pj.y);

        // insert into best
        let inserted = false;
        for (let t = 0; t < best.length; t++) {
          if (d < best[t].d) {
            best.splice(t, 0, { j, d });
            inserted = true;
            break;
          }
        }
        if (!inserted && best.length < k) best.push({ j, d });
        if (best.length > k) best.pop();
      }

      for (let t = 0; t < best.length; t++) {
        const j = best[t].j;
        const a = Math.min(i, j);
        const b = Math.max(i, j);
        const key = `${a}|${b}`;
        if (!edges.has(key)) {
          edges.set(key, true);
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }

    return { adj, edges };
  }

  function growCrackEdges(pts, adj, startIdx, dirToCenter) {
    const used = new Set();
    const visited = new Array(pts.length).fill(false);
    const q = [];

    visited[startIdx] = true;
    q.push(startIdx);

    const maxEdges = clamp(Math.floor(pts.length * 0.65), 55, 150);
    const ux = Math.cos(dirToCenter);
    const uy = Math.sin(dirToCenter);

    let count = 0;

    while (q.length && count < maxEdges) {
      const u = q.shift();
      const pu = pts[u];
      const neigh = adj[u] || [];
      if (neigh.length === 0) continue;

      // score neighbors
      const scored = neigh.map((v) => {
        const pv = pts[v];
        const dx = pv.x - pu.x;
        const dy = pv.y - pu.y;
        const len = Math.max(1e-6, Math.hypot(dx, dy));
        const ax = dx / len, ay = dy / len;
        const align = ax * ux + ay * uy;
        const score = (1.25 * align) - (0.004 * len) + rand(-0.10, 0.10);
        return { v, score, len };
      }).sort((a, b) => b.score - a.score);

      const fan = clamp(Math.round(lerp(1, 3, pts[u].w)), 1, 3);

      for (let i = 0; i < scored.length && i < fan && count < maxEdges; i++) {
        const v = scored[i].v;
        const a = Math.min(u, v);
        const b = Math.max(u, v);
        const key = `${a}|${b}`;
        if (used.has(key)) continue;

        const p = clamp(0.52 + (scored[i].score * 0.16) + (pts[u].w * 0.18), 0.22, 0.92);
        if (Math.random() > p) continue;

        used.add(key);
        count++;

        if (!visited[v]) {
          visited[v] = true;
          if (Math.random() < 0.45) q.unshift(v);
          else q.push(v);
        }
      }
    }

    return used;
  }

  function jitterPolyline(p0, p1) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const steps = clamp(Math.round(len / 18), 2, 10);

    const nx = -dy / len;
    const ny = dx / len;

    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p0.x + dx * t;
      const y = p0.y + dy * t;

      const k = Math.sin(Math.PI * t);
      const j = rand(-1.0, 1.0) * (2.2 * k);
      pts.push({ x: x + nx * j, y: y + ny * j });
    }
    return pts;
  }

  function genVoronoiCrack(w, h, ox, oy, dirToCenter) {
    if (!crackSvg) return;

    crackSvg.innerHTML = "";
    crackSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const g = document.createElementNS(SVG_NS, "g");
    crackSvg.appendChild(g);

    const pts = genSites(w, h, ox, oy, dirToCenter);
    const { adj } = buildKNNGraph(pts, 4);
    const start = nearestIndex(pts, ox, oy);
    const used = growCrackEdges(pts, adj, start, dirToCenter);

    // order edges for nicer draw: longer first
    const edgesArr = [];
    for (const key of used) {
      const [aStr, bStr] = key.split("|");
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      const p0 = pts[a], p1 = pts[b];
      const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      edgesArr.push({ a, b, len });
    }
    edgesArr.sort((A, B) => B.len - A.len);

    let delay = 0;
    for (const e of edgesArr) {
      const p0 = pts[e.a], p1 = pts[e.b];
      const sw = clamp(0.9 + (pts[e.a].w + pts[e.b].w) * 0.85, 0.9, 2.6);
      const op = clamp(0.22 + (pts[e.a].w + pts[e.b].w) * 0.35, 0.22, 0.92);

      const poly = jitterPolyline(p0, p1);
      const d = polyPath(poly);
      if (!d) continue;

      const path = makePath(d, sw, op, delay);
      path.style.animationDuration = `${clamp(260 + e.len * 0.55, 280, 620)}ms`;
      g.appendChild(path);

      delay += 10;
      if (delay > 180) delay = 180;
    }

    // faint micro cracks for richness
    for (let i = 0; i < 16; i++) {
      const u = randi(0, pts.length - 1);
      const neigh = adj[u];
      if (!neigh || neigh.length === 0) continue;
      const v = neigh[randi(0, neigh.length - 1)];
      const a = Math.min(u, v), b = Math.max(u, v);
      const key = `${a}|${b}`;
      if (used.has(key)) continue;

      const p0 = pts[a], p1 = pts[b];
      const d = polyPath(jitterPolyline(p0, p1));
      if (!d) continue;

      const path = makePath(d, rand(0.6, 1.05), rand(0.12, 0.26), 120 + randi(0, 140));
      path.style.animationDuration = `${rand(260, 520).toFixed(0)}ms`;
      g.appendChild(path);
    }
  }

  // ---------- Footer year ----------
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

})();
