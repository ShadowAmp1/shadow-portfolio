const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max){ return min + Math.random() * (max - min); }
function randi(min, max){ return Math.floor(rand(min, max + 1)); }

const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Elements
const introEl = $("#intro-screen");
const mainEl  = $("#main-content");
const portalEl = $("#portal");

const crackSound = $("#crackSound");
if (crackSound) crackSound.volume = 0.07;

const enterBtn = $("#enterBtn");
const projectsBtn = $("#projectsBtn");
const yearEl = $("#year");

// Cursor
const cursorDot = $("#cursor-dot");
const cursorRing = $("#cursor-ring");

// Glow
const reactiveGlow = $("#reactiveGlow");

// Navbar
const nav = $("#nav");
const navLinks = $$(".nav-link");
const navIndicator = $(".nav-indicator");
const navGlow = $(".nav-glow");

// Modal
const modal = $("#modal");
const modalCard = $("#modalCard");
const modalMedia = $("#modalMedia");
const shot3d = $("#shot3d");
const modalShot = $("#modalShot");
const modalVideo = $("#modalVideo");

const modalTitle = $("#modalTitle");
const modalDesc = $("#modalDesc");
const modalTags = $("#modalTags");
const modalDemo = $("#modalDemo");
const modalCode = $("#modalCode");
const modalMeta = $("#modalMeta");

const crackSvg = $("#crackSvg");
const shardsWrap = $("#shards");

let modalOpen = false;
let lastFocus = null;

// =======================
// Cursor
// =======================
let cx = innerWidth * 0.5;
let cy = innerHeight * 0.5;
let cRAF = null;

function renderCursor(){
  cRAF = null;
  if (!cursorDot || !cursorRing) return;
  cursorDot.style.left = `${cx}px`;
  cursorDot.style.top  = `${cy}px`;
  cursorRing.style.left = `${cx}px`;
  cursorRing.style.top  = `${cy}px`;
}
function cursorShow(){
  if (!cursorDot || !cursorRing) return;
  cursorDot.style.opacity = "1";
  cursorRing.style.opacity = "1";
}
function cursorHide(){
  if (!cursorDot || !cursorRing) return;
  cursorDot.style.opacity = "0";
  cursorRing.style.opacity = "0";
}

if (!prefersReduced){
  addEventListener("mousemove", (e) => {
    cx = e.clientX; cy = e.clientY;
    cursorShow();
    if (!cRAF) cRAF = requestAnimationFrame(renderCursor);

    const linky = e.target?.closest?.("a,button,.card,.filter-btn,.modal-close") || null;
    document.body.classList.toggle("cursor-link", !!linky);

    const hot = e.target?.closest?.(".btn, .filter-btn") || null;
    if (hot){
      const r = hot.getBoundingClientRect();
      hot.style.setProperty("--mx", `${((e.clientX - r.left)/r.width) * 100}%`);
      hot.style.setProperty("--my", `${((e.clientY - r.top)/r.height) * 100}%`);
    }

    const depthEl = e.target?.closest?.(".depth") || null;
    if (depthEl){
      const r = depthEl.getBoundingClientRect();
      depthEl.style.setProperty("--lx", `${((e.clientX - r.left)/r.width) * 100}%`);
      depthEl.style.setProperty("--ly", `${((e.clientY - r.top)/r.height) * 100}%`);
    }
  }, { passive:true });

  addEventListener("mousedown", () => document.body.classList.add("cursor-down"));
  addEventListener("mouseup", () => document.body.classList.remove("cursor-down"));
  addEventListener("mouseleave", cursorHide);
  addEventListener("blur", cursorHide);
}

// =======================
// Magnetic
// =======================
function attachMagnetic(el, strength = 0.18){
  if (!el || prefersReduced) return;
  let raf = null;
  let tx = 0, ty = 0;

  function apply(){
    raf = null;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }

  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    tx = (e.clientX - (r.left + r.width/2)) * strength;
    ty = (e.clientY - (r.top + r.height/2)) * strength;
    if (!raf) raf = requestAnimationFrame(apply);
  });

  el.addEventListener("mouseleave", () => {
    tx = 0; ty = 0;
    if (!raf) raf = requestAnimationFrame(apply);
  });
}
$$(".magnetic").forEach(el => attachMagnetic(el));

// =======================
// Tilt
// =======================
function attachTilt(el, maxDeg = 10){
  if (!el || prefersReduced) return;

  let raf = null;
  let rx = 0, ry = 0;

  function apply(){
    raf = null;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  }

  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    ry = (px - 0.5) * maxDeg;
    rx = -(py - 0.5) * maxDeg;

    el.style.setProperty("--lx", `${px * 100}%`);
    el.style.setProperty("--ly", `${py * 100}%`);

    if (!raf) raf = requestAnimationFrame(apply);
  });

  el.addEventListener("mouseleave", () => {
    rx = 0; ry = 0;
    if (!raf) raf = requestAnimationFrame(apply);
  });
}
function refreshTilts(){
  $$(".tilt, .card").forEach(el => attachTilt(el, el.classList.contains("card") ? 12 : 9));
}
refreshTilts();

// =======================
// Reveal
// =======================
function setupReveal(){
  const items = $$(".reveal");
  if (!items.length) return;

  if (prefersReduced){
    items.forEach(i => i.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries){
      if (e.isIntersecting){
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12 });

  items.forEach(i => io.observe(i));
}
setupReveal();

// =======================
// Counters
// =======================
function animateCounters(){
  if (prefersReduced) return;
  const els = $$("[data-counter]");
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);

      const target = parseInt(el.dataset.counter || "0", 10);
      const t0 = performance.now();
      const dur = 900;

      function tick(t){
        const p = clamp((t - t0)/dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.floor(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });

  els.forEach(el => io.observe(el));
}
animateCounters();

// =======================
// Audio
// =======================
function playCrackSoft(){
  if (!crackSound) return;
  try { crackSound.currentTime = 0; crackSound.play().catch(()=>{}); } catch {}
}

// =======================
// Intro enter
// =======================
requestAnimationFrame(() => introEl?.classList.add("is-ready"));

function enterSite(scrollToId = null){
  if (!introEl || !mainEl) return;
  if (introEl.classList.contains("is-leaving")) return;

  playCrackSoft();

  mainEl.style.display = "block";
  mainEl.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    introEl.classList.add("is-leaving");
    mainEl.classList.add("is-ready");
  });

  setTimeout(() => {
    introEl.style.display = "none";
    if (scrollToId) document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth" });
  }, 900);
}

enterBtn?.addEventListener("click", () => enterSite());
projectsBtn?.addEventListener("click", () => enterSite("projects"));
introEl?.addEventListener("dblclick", () => enterSite());
addEventListener("keydown", (e) => {
  if (introEl?.style.display === "none") return;
  if (e.key === "Enter" || e.key === " ") enterSite();
});

// Intro mouse parallax
const blobs = $$(".blob[data-parallax-m]");
let mx = 0, my = 0, mouseRaf = null;
function applyMouseParallax(){
  mouseRaf = null;
  for (const b of blobs){
    const s = parseFloat(b.dataset.parallaxM || "0.15");
    b.style.transform = `translate3d(${mx * s}px, ${my * s}px, 0)`;
  }
}
addEventListener("mousemove", (e) => {
  if (!introEl || introEl.style.display === "none") return;
  const cx2 = innerWidth / 2;
  const cy2 = innerHeight / 2;
  mx = (e.clientX - cx2) / 18;
  my = (e.clientY - cy2) / 18;
  if (!mouseRaf) mouseRaf = requestAnimationFrame(applyMouseParallax);
}, { passive:true });

// =======================
// Canvases (web + particles) — лёгкая паутина
// =======================
const webCanvas = $("#webCanvas");
const webCtx = webCanvas?.getContext("2d");
const pCanvas = $("#particles");
const pCtx = pCanvas?.getContext("2d");

function resizeCanvases(){
  if (!webCanvas || !pCanvas || !webCtx || !pCtx) return;
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

  webCanvas.width = Math.floor(innerWidth * dpr);
  webCanvas.height = Math.floor(innerHeight * dpr);
  webCanvas.style.width = `${innerWidth}px`;
  webCanvas.style.height = `${innerHeight}px`;
  webCtx.setTransform(dpr,0,0,dpr,0,0);

  pCanvas.width = Math.floor(innerWidth * dpr);
  pCanvas.height = Math.floor(innerHeight * dpr);
  pCanvas.style.width = `${innerWidth}px`;
  pCanvas.style.height = `${innerHeight}px`;
  pCtx.setTransform(dpr,0,0,dpr,0,0);
}

let lines = [];
function resetLines(){
  lines = [];
  const cx2 = innerWidth/2, cy2 = innerHeight/2;
  const count = 54;
  for (let i=0;i<count;i++){
    lines.push({
      cx: cx2, cy: cy2,
      tx: Math.random()*innerWidth,
      ty: Math.random()*innerHeight,
      progress: Math.random()*0.30,
      spd: 0.010 + Math.random()*0.016
    });
  }
}
function drawWeb(){
  if (!webCtx) return;
  webCtx.clearRect(0,0,innerWidth,innerHeight);
  webCtx.lineWidth = 1;

  for (const l of lines){
    l.progress = Math.min(1, l.progress + l.spd);
    const x = l.cx + (l.tx - l.cx) * l.progress;
    const y = l.cy + (l.ty - l.cy) * l.progress;
    const a = 0.10 + 0.34 * (1 - Math.abs(0.5 - l.progress) * 2);
    webCtx.strokeStyle = `rgba(168,85,247,${a})`;
    webCtx.beginPath();
    webCtx.moveTo(l.cx, l.cy);
    webCtx.lineTo(x,y);
    webCtx.stroke();
  }
  requestAnimationFrame(drawWeb);
}

let particles = [];
function resetParticles(){
  particles = [];
  const count = 130;
  for (let i=0;i<count;i++){
    particles.push({
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      r: 0.7 + Math.random()*2.0,
      dx: (Math.random()-0.5)*0.65,
      dy: (Math.random()-0.5)*0.65,
      a: 0.10 + Math.random()*0.22
    });
  }
}
function drawParticles(){
  if (!pCtx) return;
  pCtx.clearRect(0,0,innerWidth,innerHeight);
  for (const p of particles){
    p.x += p.dx; p.y += p.dy;
    if (p.x < -10) p.x = innerWidth+10;
    if (p.x > innerWidth+10) p.x = -10;
    if (p.y < -10) p.y = innerHeight+10;
    if (p.y > innerHeight+10) p.y = -10;

    pCtx.fillStyle = `rgba(168,85,247,${p.a})`;
    pCtx.beginPath();
    pCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
    pCtx.fill();
  }
  requestAnimationFrame(drawParticles);
}

resizeCanvases();
resetLines();
resetParticles();
drawWeb();
drawParticles();

addEventListener("resize", () => {
  resizeCanvases();
  resetLines();
  resetParticles();
});

// =======================
// Scroll parallax + glow
// =======================
const parallaxLayers = $$(".parallax-bg .layer");
const parallaxTargets = $$("[data-parallax]");
let lastY = 0;
let ticking = false;

function applyScrollFX(scrollY){
  for (const el of parallaxLayers){
    const speed = parseFloat(el.dataset.speed || "0.2");
    el.style.transform = `translate3d(0, ${-(scrollY*speed)}px, 0)`;
  }
  for (const el of parallaxTargets){
    const speed = parseFloat(el.dataset.parallax || "0.2");
    el.style.transform = `translate3d(0, ${-(scrollY*speed)}px, 0)`;
  }

  if (reactiveGlow){
    const h = Math.max(1, document.body.scrollHeight - innerHeight);
    const p = clamp(scrollY / h, 0, 1);
    reactiveGlow.style.setProperty("--gx", `${lerp(46, 70, p)}%`);
    reactiveGlow.style.setProperty("--gy", `${lerp(22, 62, p)}%`);
  }
}

addEventListener("scroll", () => {
  lastY = window.scrollY || 0;
  if (!ticking){
    ticking = true;
    requestAnimationFrame(() => {
      applyScrollFX(lastY);
      ticking = false;
    });
  }
}, { passive:true });

// =======================
// Portal navigation
// =======================
let portalBusy = false;

function portalTo(targetId, originEvent){
  const target = document.getElementById(targetId);
  if (!target || portalBusy) return;

  portalBusy = true;
  playCrackSoft();

  const x = originEvent?.clientX ?? innerWidth * 0.5;
  const y = originEvent?.clientY ?? innerHeight * 0.42;

  portalEl?.style.setProperty("--px", `${(x / innerWidth) * 100}%`);
  portalEl?.style.setProperty("--py", `${(y / innerHeight) * 100}%`);

  portalEl?.classList.add("show");
  document.body.classList.add("portal-zooming");

  setTimeout(() => target.scrollIntoView({ behavior: "auto", block: "start" }), 210);

  setTimeout(() => {
    portalEl?.classList.remove("show");
    document.body.classList.remove("portal-zooming");
    portalBusy = false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 560);
}

function bindPortalLinks(){
  $$(".portal-link").forEach(a => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      e.preventDefault();
      const id = href.slice(1);
      if (introEl && introEl.style.display !== "none"){
        enterSite(id);
        return;
      }
      portalTo(id, e);
    });
  });

  $$(".portal-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = btn.dataset.target;
      if (!id) return;
      if (introEl && introEl.style.display !== "none"){
        enterSite(id);
        return;
      }
      portalTo(id, e);
    });
  });
}
bindPortalLinks();

// =======================
// Projects
// =======================
function thumb(url, w = 1400){
  return `https://image.thum.io/get/width/${w}/${url}`;
}

const projects = [
  {
    title: "ООО «РЕШЕНИЕ» — Outsourcing • Legal • Compliance",
    desc: "Лендинг сервиса: аутсорсинг персонала + юридическое сопровождение и комплаенс. Упор на SLA, прозрачность, процесс за 7 дней и формы заявки.",
    tags: ["UI", "Landing", "Business"],
    filter: ["ui"],
    demo: "https://reshenie-site1.onrender.com/",
    code: "https://github.com/ShadowAmp1/reshenie-site1",
    meta: "Разделы: услуги, процесс, отрасли, подход, заявка/контакты.",
    video: "https://assets.mixkit.co/videos/preview/mixkit-purple-ink-in-water-117-large.mp4",
    screenshot: thumb("https://reshenie-site1.onrender.com/", 1400)
  },
  {
    title: "Mini Messenger",
    desc: "Мини-мессенджер: чаты, авторизация/регистрация, профиль, контакты, голосовые. Хоткеи (Enter/Shift+Enter), beta звонки.",
    tags: ["JS", "UI", "App"],
    filter: ["js","ui"],
    demo: "https://messenger-k93n.onrender.com/",
    code: "https://github.com/ShadowAmp1/messenger-clone",
    meta: "Интерфейс под телефон и ПК: меню, модалки, контекстные действия сообщений.",
    video: "https://assets.mixkit.co/videos/preview/mixkit-network-of-lines-abstract-4886-large.mp4",
    screenshot: thumb("https://messenger-k93n.onrender.com/", 1400)
  },
  {
    title: "Neon Portfolio (Glass + Portal)",
    desc: "Витринный сайт портфолио с интро, portal-переходами, микро UX и параллаксом.",
    tags: ["UI", "JS", "Motion"],
    filter: ["ui","js"],
    demo: "https://shadowamp1.github.io/neon-portfolio/",
    code: "https://github.com/ShadowAmp1/neon-portfolio",
    meta: "Фокус: UI, анимации, структура проекта, 60fps.",
    video: "https://assets.mixkit.co/videos/preview/mixkit-abstract-background-with-moving-lines-4885-large.mp4",
    screenshot: thumb("https://shadowamp1.github.io/neon-portfolio/", 1400)
  }
];

const projectsGrid = $("#projectsGrid");
const filterButtons = $$(".filter-btn");

function projectCard(p, idx){
  const tags = p.tags.map(t => `<span>${t}</span>`).join("");
  return `
  <article class="card glass-border tilt depth" data-idx="${idx}" data-filters="${p.filter.join(",")}">
    <div class="card-preview">
      <video class="card-video" playsinline muted loop preload="metadata" data-src="${p.video}"></video>
    </div>

    <h3>${p.title}</h3>
    <p>${p.desc}</p>

    <div class="card-tags">${tags}</div>

    <div class="card-links">
      <a href="${p.demo}" target="_blank" rel="noreferrer">Demo</a>
      <a href="${p.code}" target="_blank" rel="noreferrer">Code</a>
    </div>
  </article>`;
}

function applyFilter(active){
  const cards = $$("#projectsGrid .card");
  cards.forEach(c => {
    const fs = (c.getAttribute("data-filters") || "").split(",").map(s => s.trim()).filter(Boolean);
    const ok = (active === "all") || fs.includes(active);
    c.style.display = ok ? "" : "none";
  });
}

function renderProjects(active = "all"){
  if (!projectsGrid) return;
  projectsGrid.innerHTML = projects.map(projectCard).join("");
  applyFilter(active);

  refreshTilts();
  $$(".magnetic").forEach(el => attachMagnetic(el));

  bindCardVideoScrubVelocity();
  bindCardClicks();
}

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    applyFilter(btn.dataset.filter || "all");
  });
});

renderProjects("all");

/* scrubbing + velocity blur */
function bindCardVideoScrubVelocity(){
  const cards = $$("#projectsGrid .card");
  for (const card of cards){
    const v = card.querySelector(".card-video");
    if (!v) continue;

    let loaded = false;
    let hovering = false;

    let raf = null;
    let targetTime = 0;

    let lastX = 0;
    let lastT = 0;
    let blurNow = 0;
    let blurTarget = 0;

    const ensureSrc = () => {
      if (loaded) return;
      const src = v.dataset.src;
      if (src){
        v.src = src;
        loaded = true;
      }
    };

    const tick = () => {
      raf = null;
      if (!hovering) return;

      const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
      if (dur > 0){
        const cur = v.currentTime || 0;
        const next = cur + (targetTime - cur) * 0.22;
        try { v.currentTime = clamp(next, 0, Math.max(0, dur - 0.05)); } catch {}
      }

      blurNow = blurNow + (blurTarget - blurNow) * 0.18;
      blurTarget *= 0.88;
      if (blurTarget < 0.02) blurTarget = 0;

      v.style.setProperty("--vblur", `${blurNow.toFixed(2)}px`);
      raf = requestAnimationFrame(tick);
    };

    card.addEventListener("mouseenter", () => {
      if (prefersReduced) return;
      hovering = true;

      ensureSrc();
      v.style.opacity = "1";

      // warmup for frames
      v.play().then(() => {
        setTimeout(() => { try { v.pause(); } catch {} }, 80);
      }).catch(()=>{});

      lastX = 0;
      lastT = performance.now();
      blurNow = 0;
      blurTarget = 0;

      if (!raf) raf = requestAnimationFrame(tick);
    });

    card.addEventListener("mousemove", (e) => {
      if (prefersReduced || !hovering) return;
      ensureSrc();

      const r = card.getBoundingClientRect();
      const pct = clamp((e.clientX - r.left) / r.width, 0, 1);

      const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
      if (dur > 0) targetTime = pct * (dur * 0.95);

      const now = performance.now();
      const x = e.clientX;
      const dx = Math.abs(x - lastX);
      const dt = Math.max(8, now - lastT);
      const speed = dx / dt;              // px/ms
      const desired = clamp(speed * 18, 0, 10); // blur

      blurTarget = Math.max(blurTarget, desired);

      lastX = x;
      lastT = now;

      if (!raf) raf = requestAnimationFrame(tick);
    });

    card.addEventListener("mouseleave", () => {
      hovering = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      try { v.pause(); v.currentTime = 0; } catch {}
      v.style.opacity = "";
      v.style.setProperty("--vblur", "0px");
    });
  }
}

// =======================
// Modal crack generation (directional rays)
// =======================
const SVG_NS = "http://www.w3.org/2000/svg";

function makePath(d, sw, op, delay){
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", d);
  p.setAttribute("class", "crack-path");
  p.setAttribute("pathLength", "1000"); // makes dash consistent
  p.style.setProperty("--sw", sw.toFixed(2));
  p.style.setProperty("--op", op.toFixed(2));
  p.style.animationDelay = `${delay}ms`;
  return p;
}

function polyPath(points){
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i=1;i<points.length;i++){
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

function genRay(ox, oy, angle, length, boundsW, boundsH){
  const segs = randi(18, 34);
  const step = length / segs;
  const jitter = rand(0.06, 0.16); // rad

  let a = angle;
  let x = ox, y = oy;
  const pts = [{x, y}];

  for (let i=0;i<segs;i++){
    a += rand(-jitter, jitter);

    // slight perpendicular drift
    const perp = a + Math.PI/2;
    const drift = rand(-step*0.12, step*0.12);

    x += Math.cos(a) * step + Math.cos(perp) * drift;
    y += Math.sin(a) * step + Math.sin(perp) * drift;

    // keep within bounds (stop if outside)
    if (x < -30 || y < -30 || x > boundsW + 30 || y > boundsH + 30) break;
    pts.push({x, y});
  }
  return pts;
}

function genCrack(w, h, ox, oy, dirToCenter){
  if (!crackSvg) return;

  crackSvg.innerHTML = "";
  crackSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const g = document.createElementNS(SVG_NS, "g");
  crackSvg.appendChild(g);

  // Bias: длинные лучи в сторону центра (удар по стеклу с точки клика)
  const mainDir = dirToCenter;

  // 1) Main long rays (toward center)
  const mainCount = 7;
  for (let i=0;i<mainCount;i++){
    const spread = (i === 0) ? 0.12 : 0.55; // first ray almost straight
    const ang = mainDir + rand(-spread, spread);
    const len = rand(Math.min(w,h) * 0.55, Math.min(w,h) * 0.95) * (i === 0 ? 1.18 : 1.0);

    const pts = genRay(ox, oy, ang, len, w, h);
    if (pts.length < 3) continue;

    const sw = (i === 0) ? 2.6 : rand(1.4, 2.3);
    const op = (i === 0) ? 0.95 : rand(0.45, 0.85);
    const delay = i * 26;

    g.appendChild(makePath(polyPath(pts), sw, op, delay));

    // Branches on the ray
    const branchCount = (i === 0) ? 2 : randi(0, 2);
    for (let b=0;b<branchCount;b++){
      const at = randi(Math.floor(pts.length*0.25), Math.floor(pts.length*0.75));
      const p0 = pts[at];
      const branchAng = ang + rand(-1.15, 1.15);
      const branchLen = len * rand(0.18, 0.42);

      const bpts = genRay(p0.x, p0.y, branchAng, branchLen, w, h);
      if (bpts.length < 3) continue;

      g.appendChild(makePath(polyPath(bpts), rand(0.9, 1.5), rand(0.28, 0.55), delay + randi(40, 120)));
    }
  }

  // 2) Some short “back rays” (opposite) for realism
  const backCount = 3;
  for (let i=0;i<backCount;i++){
    const ang = (mainDir + Math.PI) + rand(-0.9, 0.9);
    const len = rand(Math.min(w,h) * 0.18, Math.min(w,h) * 0.38);
    const pts = genRay(ox, oy, ang, len, w, h);
    if (pts.length < 3) continue;

    g.appendChild(makePath(polyPath(pts), rand(0.8, 1.2), rand(0.20, 0.40), 120 + i * 22));
  }
}

function seedShards(dirToCenter){
  if (!shardsWrap) return;
  const shards = $$(".shard", shardsWrap);
  const base = dirToCenter;

  shards.forEach((s, i) => {
    // wider spread around base direction
    const a = base + rand(-1.25, 1.25);
    const mag = rand(180, 340) * (i % 4 === 0 ? 1.25 : 1.0);

    const tx = Math.cos(a) * mag;
    const ty = Math.sin(a) * mag;

    const w = rand(16, 34);
    const h = rand(10, 22);

    const sr = rand(-60, 60);
    const er = sr + rand(-260, 260);

    s.style.setProperty("--tx", `${tx.toFixed(0)}px`);
    s.style.setProperty("--ty", `${ty.toFixed(0)}px`);
    s.style.setProperty("--w", `${w.toFixed(0)}px`);
    s.style.setProperty("--h", `${h.toFixed(0)}px`);
    s.style.setProperty("--sr", `${sr.toFixed(0)}deg`);
    s.style.setProperty("--er", `${er.toFixed(0)}deg`);
    s.style.animationDelay = `${randi(0, 60)}ms`;
  });
}

// =======================
// Modal open/close + crack at click + directional rays
// =======================
function openModal(project, ev){
  if (!modal || !project || !modalCard) return;

  lastFocus = document.activeElement;
  modalOpen = true;

  playCrackSoft();

  modalTitle.textContent = project.title || "Project";
  modalDesc.textContent = project.desc || "";
  modalTags.innerHTML = (project.tags || []).map(t => `<span>${t}</span>`).join("");
  modalMeta.textContent = project.meta || "";
  modalDemo.href = project.demo || "#";
  modalCode.href = project.code || "#";

  // screenshot
  if (modalShot){
    if (project.screenshot) modalShot.src = project.screenshot;
    else modalShot.removeAttribute("src");
  }

  // subtle video behind screenshot
  if (modalVideo){
    try { modalVideo.pause(); modalVideo.currentTime = 0; } catch {}
    modalVideo.removeAttribute("src");
    if (project.video){
      modalVideo.src = project.video;
      modalVideo.currentTime = 0;
      modalVideo.play().catch(()=>{});
    }
  }

  // open modal
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    const r = modalCard.getBoundingClientRect();

    // click position in viewport
    const cx = ev?.clientX ?? (r.left + r.width * 0.5);
    const cy = ev?.clientY ?? (r.top  + r.height * 0.45);

    // clamp click to modal card bounds -> “impact point on glass”
    const ix = clamp(cx, r.left, r.right);
    const iy = clamp(cy, r.top,  r.bottom);

    // local coords in px and percent
    const localX = ix - r.left;
    const localY = iy - r.top;

    const crx = clamp((localX / r.width) * 100, 0, 100);
    const cry = clamp((localY / r.height) * 100, 0, 100);

    modalCard.style.setProperty("--crx", `${crx}%`);
    modalCard.style.setProperty("--cry", `${cry}%`);

    // direction: from impact point -> center (rays go “into glass”)
    const centerX = r.width * 0.5;
    const centerY = r.height * 0.5;
    const dirToCenter = Math.atan2(centerY - localY, centerX - localX);

    // Generate crack rays + shards with bias
    genCrack(Math.floor(r.width), Math.floor(r.height), localX, localY, dirToCenter);
    seedShards(dirToCenter);

    // restart opening animation
    modal.classList.remove("is-opening");
    void modal.offsetWidth; // reflow
    modal.classList.add("is-opening");

    setTimeout(() => modal.classList.remove("is-opening"), prefersReduced ? 1 : 760);
  });

  setTimeout(() => modal.querySelector("[data-close]")?.focus?.(), 0);
}

function closeModal(){
  if (!modal || !modalOpen) return;
  modalOpen = false;

  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("is-open");
  modal.classList.remove("is-opening");
  document.body.style.overflow = "";

  try{
    modalVideo?.pause?.();
    if (modalVideo) modalVideo.currentTime = 0;
  } catch {}

  resetShot3D();
  if (crackSvg) crackSvg.innerHTML = "";

  lastFocus?.focus?.();
}

function bindCardClicks(){
  $$("#projectsGrid .card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target?.closest?.("a")) return;
      const idx = parseInt(card.dataset.idx || "-1", 10);
      if (idx < 0 || !projects[idx]) return;
      openModal(projects[idx], e);
    });
  });
}

modal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.close === "true") closeModal();
});
addEventListener("keydown", (e) => {
  if (!modalOpen) return;
  if (e.key === "Escape") closeModal();
});

// =======================
// 3D screenshot interaction
// =======================
let shotRAF = null;
let shotRX = 0, shotRY = 0;
let shotTRX = 0, shotTRY = 0;
let shine = 0, tShine = 0;
let shineX = 50, shineY = 50;

function applyShot3D(){
  shotRAF = null;
  if (!shot3d) return;

  shotRX = shotRX + (shotTRX - shotRX) * 0.16;
  shotRY = shotRY + (shotTRY - shotRY) * 0.16;
  shine = shine + (tShine - shine) * 0.18;

  shot3d.style.setProperty("--rx", `${shotRX.toFixed(3)}deg`);
  shot3d.style.setProperty("--ry", `${shotRY.toFixed(3)}deg`);
  shot3d.style.setProperty("--shine", `${shine.toFixed(3)}`);
  shot3d.style.setProperty("--px", `${shineX.toFixed(1)}%`);
  shot3d.style.setProperty("--py", `${shineY.toFixed(1)}%`);
}

function resetShot3D(){
  shotTRX = 0; shotTRY = 0;
  tShine = 0;
  shineX = 50; shineY = 50;
  if (!shotRAF) shotRAF = requestAnimationFrame(applyShot3D);
}

if (modalMedia && shot3d && !prefersReduced){
  modalMedia.addEventListener("mousemove", (e) => {
    if (!modalOpen) return;
    const r = modalMedia.getBoundingClientRect();
    const px = clamp((e.clientX - r.left) / r.width, 0, 1);
    const py = clamp((e.clientY - r.top) / r.height, 0, 1);

    const max = 7.5;
    shotTRY = (px - 0.5) * max;
    shotTRX = -(py - 0.5) * max;

    shineX = px * 100;
    shineY = py * 100;
    tShine = 1;

    if (!shotRAF) shotRAF = requestAnimationFrame(applyShot3D);
  }, { passive:true });

  modalMedia.addEventListener("mouseleave", () => {
    if (!modalOpen) return;
    resetShot3D();
  });
}

// =======================
// Active nav indicator + glow
// =======================
function moveIndicatorTo(link){
  if (!navIndicator || !nav || !link) return;

  const navRect = nav.getBoundingClientRect();
  const r = link.getBoundingClientRect();
  const left = r.left - navRect.left + nav.scrollLeft;

  navIndicator.style.left = `${left}px`;
  navIndicator.style.width = `${r.width}px`;

  if (navGlow){
    navGlow.style.left = `${left}px`;
    nav.style.setProperty("--gW", `${Math.max(48, r.width)}px`);
    nav.classList.add("has-glow");
  }
}

function setActiveNav(sectionId){
  const link = navLinks.find(a => a.dataset.section === sectionId) || null;
  if (!link) return;
  navLinks.forEach(a => a.classList.remove("is-active"));
  link.classList.add("is-active");
  moveIndicatorTo(link);
}

function setupActiveSectionObserver(){
  const io = new IntersectionObserver((entries) => {
    const vis = entries
      .filter(e => e.isIntersecting)
      .sort((a,b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
    if (!vis) return;

    const id = vis.target.getAttribute("id") || vis.target.dataset.section;
    if (id) setActiveNav(id);
  }, { threshold: [0.25, 0.45, 0.65] });

  ["projects","skills","about","contact"].forEach(id => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });

  setTimeout(() => {
    const active = $(".nav-link.is-active") || navLinks[0];
    if (active) moveIndicatorTo(active);
  }, 0);
}
setupActiveSectionObserver();

addEventListener("resize", () => {
  const active = $(".nav-link.is-active");
  if (active) moveIndicatorTo(active);
});

// =======================
// Year
// =======================
if (yearEl) yearEl.textContent = new Date().getFullYear();