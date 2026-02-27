/* ===========================================================
   Shadow Portfolio — "Middle-look" Upgrade Pack
   Features:
   - Preloader with % (smooth, real tasks + fallback timeout)
   - GPU glass distortion (WebGL overlay) + scroll reactive intensity
   - Realistic glass impact: Voronoi crack + ring cracks + chip debris
   - Physics shards/chips (custom lightweight rAF sim) + CSS fallback
   - SPA-like transitions: portal zoom + hash routing (no reload)
   - Mobile/low-power reductions + reduced-motion fallback
   - A11y: focus trap in modal, skip link, inert/aria handling
   - Perf: lazy hover videos (data-src), rAF only when needed
   =========================================================== */

(() => {
  "use strict";

  // -----------------------------
  // Helpers
  // -----------------------------
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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

  function isUrl(str) {
    try { new URL(str); return true; } catch { return false; }
  }

  // -----------------------------
  // ENV / Power modes
  // -----------------------------
  const MQ_REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const MQ_COARSE = window.matchMedia?.("(pointer: coarse)");
  const MQ_MOBILE = window.matchMedia?.("(max-width: 820px)");

  const REDUCED = !!MQ_REDUCED?.matches;
  const COARSE = !!MQ_COARSE?.matches;
  const MOBILE = !!MQ_MOBILE?.matches || COARSE;

  const SAVE_DATA = !!navigator.connection?.saveData;
  const LOW_POWER = REDUCED || MOBILE || SAVE_DATA;

  const DPR = Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.25 : 2);

  const html = document.documentElement;
  html.classList.toggle("reduced", REDUCED);
  html.classList.toggle("mobile", MOBILE);
  html.classList.toggle("lowpower", LOW_POWER);

  // Always start from top (user request)
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch {}
  window.scrollTo(0, 0);

  // -----------------------------
  // DOM
  // -----------------------------
  const DOM = {
    preloader: $("#preloader"),
    prePercent: $("#prePercent"),
    preBarFill: $("#preBarFill"),
    preHint: $("#preHint"),

    intro: $("#intro-screen"),
    main: $("#main-content"),
    enterBtn: $("#enterBtn"),
    projectsBtn: $("#projectsBtn"),

    glCanvas: $("#glGlass"),

    reactiveGlow: $("#reactiveGlow"),
    microcracks: $("#microcracks"),

    cursorDot: $("#cursor-dot"),
    cursorRing: $("#cursor-ring"),

    portal: $("#portal"),

    nav: $("#nav"),
    navLinks: $("#nav") ? $$(".nav-link", $("#nav")) : [],
    navGlow: $("#nav") ? $(".nav-glow", $("#nav")) : null,
    navIndicator: $("#nav") ? $(".nav-indicator", $("#nav")) : null,

    layers: $$(".layer"),
    projectsGrid: $("#projectsGrid"),
    filterBtns: $$(".filter-btn"),

    year: $("#year"),

    modal: $("#modal"),
    modalCard: $("#modalCard"),
    crackSvg: $("#crackSvg"),
    shardsWrap: $("#shards"),
    modalMedia: $("#modalMedia"),
    shot3d: $("#shot3d"),
    modalShot: $("#modalShot"),
    modalVideo: $("#modalVideo"),
    modalTitle: $("#modalTitle"),
    modalDesc: $("#modalDesc"),
    modalTags: $("#modalTags"),
    modalMeta: $("#modalMeta"),
    modalDemo: $("#modalDemo"),
    modalCode: $("#modalCode"),

    crackSound: $("#crackSound"),
  };

  // -----------------------------
  // Audio (lazy)
  // -----------------------------
  function setAudioVolume(v = 0.12) {
    if (!DOM.crackSound) return;
    DOM.crackSound.volume = clamp(v, 0, 1);
  }
  setAudioVolume(0.12);

  function playCrack() {
    if (!DOM.crackSound) return;
    // Don't force network unless user interacts
    try {
      DOM.crackSound.currentTime = 0;
      DOM.crackSound.play().catch(() => {});
    } catch {}
  }

  // -----------------------------
  // Preloader
  // -----------------------------
  const Preloader = (() => {
    let progress = 0;
    let target = 0;
    let done = false;

    const tasks = {
      dom: false,
      fonts: false,
      gl: false,
      settle: false,
    };

    function taskProgress() {
      const arr = Object.values(tasks);
      const doneCount = arr.filter(Boolean).length;
      return doneCount / arr.length;
    }

    function setTargetFromTasks() {
      // 0..92 from tasks, last 8% is "polish"
      target = 12 + taskProgress() * 80;
      target = clamp(target, 0, 92);
    }

    function set(p) {
      progress = clamp(p, 0, 100);
      if (DOM.prePercent) DOM.prePercent.textContent = `${Math.round(progress)}%`;
      if (DOM.preBarFill) DOM.preBarFill.style.width = `${progress}%`;

      if (DOM.preHint) {
        if (progress < 30) DOM.preHint.textContent = "Подготавливаю эффекты…";
        else if (progress < 60) DOM.preHint.textContent = "Собираю UI-слои…";
        else if (progress < 90) DOM.preHint.textContent = "Оптимизирую 60fps…";
        else DOM.preHint.textContent = "Готово ✨";
      }
    }

    function finish() {
      if (done) return;
      done = true;
      set(100);

      // hide
      if (DOM.preloader) {
        DOM.preloader.classList.add("is-done");
        setTimeout(() => {
          DOM.preloader?.remove();
          // intro becomes ready now (nice timing)
          DOM.intro?.classList.add("is-ready");
        }, REDUCED ? 1 : 540);
      } else {
        DOM.intro?.classList.add("is-ready");
      }
    }

    function start(glReadyPromise) {
      set(0);

      // DOM parsed (defer runs before DOMContentLoaded, but DOM exists)
      tasks.dom = true;
      setTargetFromTasks();

      // Fonts
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { tasks.fonts = true; setTargetFromTasks(); }).catch(() => {
          tasks.fonts = true; setTargetFromTasks();
        });
      } else {
        tasks.fonts = true;
      }

      // WebGL
      if (glReadyPromise && typeof glReadyPromise.then === "function") {
        glReadyPromise.then(() => { tasks.gl = true; setTargetFromTasks(); }).catch(() => {
          tasks.gl = true; setTargetFromTasks();
        });
      } else {
        tasks.gl = true;
      }

      // settle: 2 frames
      requestAnimationFrame(() => requestAnimationFrame(() => {
        tasks.settle = true;
        setTargetFromTasks();
      }));

      // fallback timeout: never block
      setTimeout(() => {
        tasks.dom = tasks.fonts = tasks.gl = tasks.settle = true;
        setTargetFromTasks();
      }, 1800);

      // animate towards target
      let last = now();
      (function loop() {
        const t = now();
        const dt = Math.min(48, t - last);
        last = t;

        // creep to target
        const speed = REDUCED ? 0.45 : 0.18;
        const step = (target - progress) * speed * (dt / 16.7);
        const next = progress + step;

        // allow slow climb even if target stalls (feels alive)
        const drift = (target < 92) ? 0.012 * (dt / 16.7) : 0;
        set(next + drift);

        const allDone = Object.values(tasks).every(Boolean);
        if (allDone && progress >= 92) {
          // smooth finish
          set(100);
          finish();
          return;
        }
        requestAnimationFrame(loop);
      })();
    }

    return { start };
  })();

  // -----------------------------
  // WebGL Glass (GPU distortion overlay)
  // -----------------------------
  const WebGLGlass = (() => {
    let gl = null;
    let prog = null;
    let buf = null;

    let uRes, uTime, uPtr, uVel, uInt;
    let startTime = 0;

    let running = false;

    const state = {
      ptrX: 0.5,
      ptrY: 0.35,
      vel: 0.0,
      velSmooth: 0.0,
      intensity: LOW_POWER ? 0.0 : 1.0,
    };

    const ready = new Promise((resolve) => {
      // init is called immediately below, resolve there
      WebGLGlass._resolveReady = resolve; // eslint-disable-line no-use-before-define
    });

    function createShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(info || "Shader compile failed");
      }
      return s;
    }

    function createProgram(vsSrc, fsSrc) {
      const vs = createShader(gl.VERTEX_SHADER, vsSrc);
      const fs = createShader(gl.FRAGMENT_SHADER, fsSrc);
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);

      gl.deleteShader(vs);
      gl.deleteShader(fs);

      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(p);
        gl.deleteProgram(p);
        throw new Error(info || "Program link failed");
      }
      return p;
    }

    function resize() {
      if (!gl) return;
      const c = DOM.glCanvas;
      if (!c) return;

      const w = Math.max(1, Math.floor(innerWidth * DPR));
      const h = Math.max(1, Math.floor(innerHeight * DPR));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uRes, c.width, c.height);
    }

    function tick(t) {
      if (!running || !gl) return;

      gl.uniform1f(uTime, t - startTime);

      // smooth velocity
      state.velSmooth = lerp(state.velSmooth, state.vel, 0.16);
      state.vel *= 0.86;

      gl.uniform2f(uPtr, state.ptrX, state.ptrY);
      gl.uniform1f(uVel, clamp(state.velSmooth, 0.0, 1.0));
      gl.uniform1f(uInt, clamp(state.intensity, 0.0, 1.0));

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(tick);
    }

    function init() {
      const c = DOM.glCanvas;
      if (!c || LOW_POWER) {
        DOM.glCanvas?.classList.add("is-off");
        WebGLGlass._resolveReady?.();
        return;
      }

      try {
        gl = c.getContext("webgl", {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
          powerPreference: "low-power",
        });

        if (!gl) throw new Error("WebGL not supported");

        const VS = `
          attribute vec2 a_pos;
          varying vec2 v_uv;
          void main() {
            v_uv = (a_pos + 1.0) * 0.5;
            gl_Position = vec4(a_pos, 0.0, 1.0);
          }
        `;

        const FS = `
          precision mediump float;
          varying vec2 v_uv;
          uniform vec2 u_res;
          uniform float u_t;
          uniform vec2 u_ptr;
          uniform float u_vel;
          uniform float u_int;

          float hash(vec2 p){
            return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
          }

          float noise(vec2 p){
            vec2 i = floor(p);
            vec2 f = fract(p);

            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));

            vec2 u = f*f*(3.0 - 2.0*f);
            return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
          }

          float fbm(vec2 p){
            float v = 0.0;
            float a = 0.5;
            for(int i=0;i<4;i++){
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
            }
            return v;
          }

          void main(){
            vec2 uv = v_uv;

            float t = u_t * 0.00022;
            float v = clamp(u_vel, 0.0, 1.0);

            // lens under pointer
            float d = distance(uv, u_ptr);
            float lens = smoothstep(0.65, 0.0, d);

            float n1 = fbm(uv * 3.0 + vec2(t*1.2, t*0.7));
            float n2 = fbm(uv * 7.0 - vec2(t*0.9, t*1.4));

            float distort = (n1 - 0.5) * 0.055 + (n2 - 0.5) * 0.035;
            distort *= (0.35 + lens*0.95) * (0.65 + v*0.85) * u_int;

            uv += vec2(distort, distort*0.7);

            float c1 = fbm(uv*2.2 + t);
            float c2 = fbm(uv*2.4 - t*1.3);
            float c3 = fbm(uv*2.0 + t*0.6);

            vec3 col = vec3(0.0);
            col.r = 0.12 + 0.42*c1;
            col.g = 0.10 + 0.36*c2;
            col.b = 0.16 + 0.55*c3;

            // subtle chroma accents
            col = mix(col, vec3(0.65,0.25,0.95), 0.18*lens);
            col = mix(col, vec3(0.0,0.95,0.95), 0.10*(1.0-lens));

            float a = (0.08 + 0.22*fbm(uv*4.0)) * u_int;
            a *= 0.55 + lens*0.55;
            a *= 0.78 + v*0.30;

            gl_FragColor = vec4(col, a);
          }
        `;

        prog = createProgram(VS, FS);
        gl.useProgram(prog);

        // Fullscreen triangle
        buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          -1, -1,
           3, -1,
          -1,  3,
        ]), gl.STATIC_DRAW);

        const aPos = gl.getAttribLocation(prog, "a_pos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        uRes = gl.getUniformLocation(prog, "u_res");
        uTime = gl.getUniformLocation(prog, "u_t");
        uPtr = gl.getUniformLocation(prog, "u_ptr");
        uVel = gl.getUniformLocation(prog, "u_vel");
        uInt = gl.getUniformLocation(prog, "u_int");

        resize();
        startTime = now();
        running = true;

        requestAnimationFrame(tick);

        // pointer tracking
        window.addEventListener("mousemove", rafThrottle((e) => {
          state.ptrX = clamp(e.clientX / innerWidth, 0, 1);
          state.ptrY = clamp(e.clientY / innerHeight, 0, 1);
        }), { passive: true });

        // scroll reactive intensity
        let lastY = window.scrollY || 0;
        let lastT = now();
        window.addEventListener("scroll", rafThrottle(() => {
          const y = window.scrollY || 0;
          const t = now();
          const dy = y - lastY;
          const dt = Math.max(16, t - lastT);

          const speed = Math.abs(dy) / dt; // px/ms
          const vel = clamp(speed / 1.8, 0, 1);

          state.vel = Math.max(state.vel, vel);

          // tiny intensity breathing on scroll
          state.intensity = LOW_POWER ? 0.0 : clamp(0.92 + vel * 0.22, 0.0, 1.0);

          lastY = y;
          lastT = t;
        }), { passive: true });

        window.addEventListener("resize", rafThrottle(resize));

        WebGLGlass._resolveReady?.();
      } catch (err) {
        // fallback
        if (DOM.glCanvas) DOM.glCanvas.style.display = "none";
        WebGLGlass._resolveReady?.();
      }
    }

    return {
      ready,
      init
    };
  })();

  // -----------------------------
  // Cursor (desktop only)
  // -----------------------------
  const Cursor = (() => {
    if (LOW_POWER) return { init() {} };

    let mouseX = innerWidth * 0.5;
    let mouseY = innerHeight * 0.5;
    let dotX = mouseX, dotY = mouseY;
    let ringX = mouseX, ringY = mouseY;

    function init() {
      window.addEventListener("mousemove", rafThrottle((e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (DOM.cursorDot) DOM.cursorDot.style.opacity = "1";
        if (DOM.cursorRing) DOM.cursorRing.style.opacity = "1";

        const el = document.elementFromPoint(mouseX, mouseY);
        const isInteractive = !!(el && el.closest("a, button, .card, .filter-btn, .modal-close"));
        document.body.classList.toggle("cursor-link", isInteractive);
      }), { passive: true });

      window.addEventListener("mouseleave", () => {
        if (DOM.cursorDot) DOM.cursorDot.style.opacity = "0";
        if (DOM.cursorRing) DOM.cursorRing.style.opacity = "0";
      });

      window.addEventListener("mousedown", () => document.body.classList.add("cursor-down"));
      window.addEventListener("mouseup", () => document.body.classList.remove("cursor-down"));

      (function tick() {
        dotX = lerp(dotX, mouseX, 0.55);
        dotY = lerp(dotY, mouseY, 0.55);
        ringX = lerp(ringX, mouseX, 0.20);
        ringY = lerp(ringY, mouseY, 0.20);

        if (DOM.cursorDot) DOM.cursorDot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%,-50%)`;
        if (DOM.cursorRing) DOM.cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%,-50%)`;

        // reactive glow follows cursor slightly
        if (DOM.reactiveGlow) {
          DOM.reactiveGlow.style.setProperty("--gx", `${(mouseX / innerWidth) * 100}%`);
          DOM.reactiveGlow.style.setProperty("--gy", `${(mouseY / innerHeight) * 100}%`);
        }

        requestAnimationFrame(tick);
      })();
    }

    return { init };
  })();

  // -----------------------------
  // Magnetic + Tilt (guarded, desktop)
  // -----------------------------
  const HoverFX = (() => {
    function setupMagnetic() {
      if (LOW_POWER) return;

      $$(".magnetic").forEach((el) => {
        if (el.dataset.magInit === "1") return;
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

        (function tick() {
          if (!el.isConnected) return;
          bx = lerp(bx, tx, 0.18);
          by = lerp(by, ty, 0.18);
          el.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
          requestAnimationFrame(tick);
        })();
      });
    }

    function setupTilt() {
      if (LOW_POWER) return;

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

        (function tick() {
          if (!el.isConnected) return;
          rx = lerp(rx, trX, 0.12);
          ry = lerp(ry, trY, 0.12);
          el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
          requestAnimationFrame(tick);
        })();
      });
    }

    return {
      init() { setupMagnetic(); setupTilt(); },
      refresh() { setupMagnetic(); setupTilt(); }
    };
  })();

  // -----------------------------
  // Counters + Reveal
  // -----------------------------
  const Reveal = (() => {
    let observer = null;

    function runCounters() {
      const els = $$("[data-counter]");
      els.forEach((el) => {
        const target = parseInt(el.getAttribute("data-counter") || "0", 10);
        if (!target) return;
        const t0 = now();
        const dur = 900;

        (function tick() {
          const t = clamp((now() - t0) / dur, 0, 1);
          const v = Math.round(lerp(0, target, easeOutCubic(t)));
          el.textContent = String(v);
          if (t < 1) requestAnimationFrame(tick);
        })();
      });
    }

    function init() {
      if (observer) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) en.target.classList.add("is-in");
        });
      }, { threshold: 0.12 });

      $$(".reveal").forEach((el) => observer.observe(el));
      runCounters();
    }

    return { init };
  })();

  // -----------------------------
  // Parallax scroll background (light)
  // -----------------------------
  const Parallax = (() => {
    function init() {
      if (!DOM.layers.length) return;

      window.addEventListener("scroll", rafThrottle(() => {
        const y = window.scrollY || 0;
        DOM.layers.forEach((layer) => {
          const sp = parseFloat(layer.getAttribute("data-speed") || "0.2");
          layer.style.transform = `translate3d(0, ${-y * sp}px, 0)`;
        });
      }), { passive: true });
    }
    return { init };
  })();

  // -----------------------------
  // Portal transitions (SPA feel)
  // -----------------------------
  const Portal = (() => {
    function burst(x, y) {
      if (!DOM.portal) return;
      DOM.portal.style.setProperty("--px", `${(x / innerWidth) * 100}%`);
      DOM.portal.style.setProperty("--py", `${(y / innerHeight) * 100}%`);
      DOM.portal.classList.add("show");
      document.body.classList.add("portal-zooming");

      setTimeout(() => {
        DOM.portal?.classList.remove("show");
        document.body.classList.remove("portal-zooming");
      }, 560);
    }

    function toSection(sectionId, clickXY = null, pushHash = true) {
      const el = document.getElementById(sectionId);
      if (!el) return;

      const x = clickXY?.x ?? innerWidth * 0.5;
      const y = clickXY?.y ?? innerHeight * 0.35;

      if (!LOW_POWER) burst(x, y);

      // SPA hash update (no reload)
      if (pushHash) {
        const next = `#${sectionId}`;
        if (location.hash !== next) {
          history.pushState({ sectionId }, "", next);
        }
      }

      // smooth scroll
      setTimeout(() => {
        el.scrollIntoView({ behavior: LOW_POWER ? "auto" : "smooth", block: "start" });
        // accessibility: focus heading target if needed
      }, LOW_POWER ? 0 : 120);
    }

    return { burst, toSection };
  })();

  // -----------------------------
  // Nav: active section + glow scrubbing
  // -----------------------------
  const Nav = (() => {
    const sections = () => $$("section[data-section]");

    const update = rafThrottle(() => {
      if (!DOM.nav || !DOM.navIndicator || DOM.navLinks.length === 0) return;

      const y = window.scrollY || 0;
      const mid = y + innerHeight * 0.35;

      let current = "projects";
      for (const s of sections()) {
        const r = s.getBoundingClientRect();
        const top = r.top + y;
        const bottom = top + r.height;
        if (mid >= top && mid < bottom) {
          current = s.getAttribute("data-section") || current;
          break;
        }
      }

            if (current === "home") current = "projects";

      DOM.navLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.section === current));

      const active = DOM.navLinks.find((a) => a.classList.contains("is-active")) || DOM.navLinks[0];
      if (!active) return;

      const r = active.getBoundingClientRect();
      const nr = DOM.nav.getBoundingClientRect();

      DOM.navIndicator.style.left = `${(r.left - nr.left) + r.width * 0.1}px`;
      DOM.navIndicator.style.width = `${r.width * 0.8}px`;
    });

    function init() {
      if (!DOM.nav) return;

      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      setTimeout(update, 240);

      // glow follows hover (scrubbing)
      DOM.nav.addEventListener("mousemove", rafThrottle((e) => {
        if (!DOM.navGlow) return;
        const nr = DOM.nav.getBoundingClientRect();
        const x = e.clientX - nr.left;
        DOM.nav.style.setProperty("--gW", `54px`);
        DOM.navGlow.style.left = `${clamp(x - 27, 0, nr.width - 54)}px`;
        DOM.nav.classList.add("has-glow");
      }), { passive: true });

      DOM.nav.addEventListener("mouseleave", () => DOM.nav.classList.remove("has-glow"));

      // click routing
      $$(".portal-link").forEach((a) => {
        a.addEventListener("click", (e) => {
          const href = a.getAttribute("href") || "";
          if (!href.startsWith("#")) return;
          e.preventDefault();
          Portal.toSection(href.slice(1), { x: e.clientX, y: e.clientY }, true);
        });
      });
      $$(".portal-btn").forEach((b) => {
        b.addEventListener("click", (e) => {
          const target = b.getAttribute("data-target");
          if (!target) return;
          e.preventDefault();
          Portal.toSection(target, { x: e.clientX, y: e.clientY }, true);
        });
      });

      // back/forward navigation
      window.addEventListener("popstate", () => {
        const id = (location.hash || "#projects").slice(1);
        if (id) Portal.toSection(id, null, false);
      });
    }

    return { init };
  })();

  // -----------------------------
  // Projects data (edit here)
  // -----------------------------
  const PROJECTS = [
    {
      id: "reshenie",
      title: "ООО «РЕШЕНИЕ» — Outsourcing • Legal • Compliance",
      desc:
        "Лендинг сервиса: аутсорсинг персонала + юридическое сопровождение и комплаенс. " +
        "Упор на SLA, прозрачность, процесс за 7 дней и формы заявки.",
      tags: ["UI", "Landing", "Business"],
      filter: ["ui", "js"],
      demo: "https://reshenie-site1.onrender.com/",
      code: "https://github.com/ShadowAmp1",
      shot: "https://image.thum.io/get/width/1400/https://reshenie-site1.onrender.com/",
      video: "https://assets.mixkit.co/videos/preview/mixkit-purple-ink-in-water-117-large.mp4"
    },
    {
      id: "messenger",
      title: "Messenger — web chat (prototype)",
      desc:
        "Мини-мессенджер: диалоги, ввод сообщений, состояния и обработка событий. " +
        "Фокус на UX, скорость интерфейса и подготовку к WebSocket/API.",
      tags: ["JS", "UI", "State"],
      filter: ["js", "ui", "api"],
      demo: "https://messenger-k93n.onrender.com/",
      code: "https://github.com/ShadowAmp1",
      shot: "https://image.thum.io/get/width/1400/https://messenger-k93n.onrender.com/",
      video: "https://assets.mixkit.co/videos/preview/mixkit-network-of-lines-abstract-4886-large.mp4"
    },
    {
      id: "glassui",
      title: "Neon Portfolio (Glass + Portal)",
      desc:
        "Эта страница как проект: preloader, portal-zoom, scrubbing превью, WebGL glass distortion, crack-open модалки и микро-UX.",
      tags: ["UI", "Motion", "WebGL"],
      filter: ["ui", "js"],
      demo: "#",
      code: "https://github.com/ShadowAmp1/shadow-portfolio",
      shot: "og-image.png",
      video: "https://assets.mixkit.co/videos/preview/mixkit-abstract-background-with-moving-lines-4885-large.mp4"
    },
    {
      id: "dashboard",
      title: "Mini Dashboard (UI System)",
      desc:
        "Карточки, фильтры, состояния, skeleton-подход. Тренировка архитектуры и темпа интерфейса.",
      tags: ["UI", "Layout"],
      filter: ["ui"],
      demo: "#",
      code: "https://github.com/ShadowAmp1",
      shot: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&auto=format&fit=crop",
      video: "https://assets.mixkit.co/videos/preview/mixkit-neon-lines-abstract-508-large.mp4"
    },
    {
      id: "api",
      title: "Weather Dashboard (API)",
      desc:
        "Fetch + debounce + error/loading state + кеш последнего ответа. Сборка микро-UX вокруг API.",
      tags: ["API", "JS"],
      filter: ["js", "api"],
      demo: "#",
      code: "https://github.com/ShadowAmp1",
      shot: "https://images.unsplash.com/photo-1526481280695-3c687fd643ed?q=80&w=1600&auto=format&fit=crop",
      video: "https://assets.mixkit.co/videos/preview/mixkit-abstract-background-with-moving-lines-4885-large.mp4"
    },
    {
      id: "python",
      title: "Python Report Tool (CLI)",
      desc:
        "CLI-утилиты: парсинг, генерация отчётов, обработка файлов. Хорошо как дополнительный скилл.",
      tags: ["Python"],
      filter: ["python"],
      demo: "#",
      code: "https://github.com/ShadowAmp1",
      shot: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?q=80&w=1600&auto=format&fit=crop",
      video: "https://assets.mixkit.co/videos/preview/mixkit-abstract-background-with-moving-lines-4885-large.mp4"
    }
  ];

  // -----------------------------
  // Projects render + filter + hover video scrubbing
  // -----------------------------
  const Projects = (() => {
    let activeFilter = "all";

    function cardTemplate(p) {
      const tags = p.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("");

      const demo = p.demo && isUrl(p.demo)
        ? `<a class="magnetic" href="${p.demo}" target="_blank" rel="noreferrer noopener">Demo</a>`
        : `<a class="magnetic" href="#" aria-disabled="true" tabindex="-1" style="opacity:.35">Demo</a>`;

      const code = p.code && isUrl(p.code)
        ? `<a class="magnetic" href="${p.code}" target="_blank" rel="noreferrer noopener">Code</a>`
        : `<a class="magnetic" href="#" aria-disabled="true" tabindex="-1" style="opacity:.35">Code</a>`;

      return `
        <article class="card glass-border depth tilt"
          data-id="${p.id}"
          data-filter="${p.filter.join(",")}"
          tabindex="0"
          role="button"
          aria-label="Открыть проект: ${escapeHtml(p.title)}"
        >
          <div class="card-preview">
            <video class="card-video" preload="metadata" muted loop playsinline data-src="${escapeHtml(p.video)}"></video>
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

    function render() {
      if (!DOM.projectsGrid) return;

      const list = PROJECTS.filter((p) => (activeFilter === "all" ? true : p.filter.includes(activeFilter)));
      DOM.projectsGrid.innerHTML = list.map(cardTemplate).join("");

      HoverFX.refresh();

      // wire cards
      $$(".card", DOM.projectsGrid).forEach((card) => {
        VideoScrub.attach(card);

        card.addEventListener("click", (e) => {
          // don't open modal if user clicked Demo/Code
          if (e.target && e.target.closest("a")) return;
          Modal.openFromCard(card, e);
        });

        card.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          if (e.target && e.target.closest && e.target.closest("a")) return;
          Modal.openFromCard(card, null);
        });
      });
    }

    function init() {
      DOM.filterBtns.forEach((b) => {
        b.addEventListener("click", () => {
          DOM.filterBtns.forEach((x) => {
            x.classList.remove("is-active");
            x.setAttribute("aria-selected", "false");
          });
          b.classList.add("is-active");
          b.setAttribute("aria-selected", "true");

          activeFilter = b.getAttribute("data-filter") || "all";
          render();
        });
      });

      render();
    }

    return { init };
  })();

  // -----------------------------
  // Hover video scrubbing + velocity blur (rAF only on hover)
  // -----------------------------
  const VideoScrub = (() => {
    function attach(card) {
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

      function ensureSrc() {
        if (loaded) return;
        const src = v.dataset.src;
        if (src) v.src = src;
        loaded = true;
      }

      function tick() {
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
        if (LOW_POWER) return;
        hovering = true;
        ensureSrc();

        // warm decode (short play-pause)
        v.play().then(() => {
          setTimeout(() => { try { v.pause(); } catch {} }, 80);
        }).catch(() => {});

        blurNow = 0; blurTarget = 0;
        lastTs = now();
        lastClientX = 0;

        if (!rafId) rafId = requestAnimationFrame(tick);
      });

      card.addEventListener("mousemove", (e) => {
        if (LOW_POWER || !hovering) return;

        const r = card.getBoundingClientRect();
        const px = clamp((e.clientX - r.left) / r.width, 0, 1);

        const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
        if (dur > 0) targetTime = px * (dur * 0.95);

        // velocity => blur
        const t = now();
        const dt = Math.max(8, t - lastTs);
        const dx = Math.abs(e.clientX - lastClientX);
        const speed = dx / dt; // px/ms
        const desired = clamp(speed * 18, 0, 9);
        blurTarget = Math.max(blurTarget, desired);

        lastClientX = e.clientX;
        lastTs = t;

        if (!rafId) rafId = requestAnimationFrame(tick);
      }, { passive: true });

      card.addEventListener("mouseleave", () => {
        hovering = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        card.style.setProperty("--vblur", `0px`);
        try { v.pause(); v.currentTime = 0; } catch {}
      });
    }

    return { attach };
  })();

  // -----------------------------
  // Scroll lock (keeps position, no jump)
  // -----------------------------
  const ScrollLock = (() => {
    let locked = false;
    let y = 0;

    function lock() {
      if (locked) return;
      locked = true;

      y = window.scrollY || 0;
      document.body.style.position = "fixed";
      document.body.style.top = `-${y}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    }

    function unlock() {
      if (!locked) return;
      locked = false;

      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";

      window.scrollTo(0, y);
    }

    return { lock, unlock };
  })();

  // -----------------------------
  // Modal: content + a11y + impact FX
  // -----------------------------
  const Modal = (() => {
    let open = false;
    let lastActiveEl = null;

    // Focus trap
    function getFocusable(root) {
      return $$(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        root
      ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    }

    function trapKeydown(e) {
      if (!open) return;
      if (e.key !== "Tab") return;

      const focusables = getFocusable(DOM.modalCard);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === DOM.modalCard) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function bindModalEvents() {
      if (!DOM.modal) return;

      DOM.modal.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "true") close();
      });

      window.addEventListener("keydown", (e) => {
        if (!open) return;
        if (e.key === "Escape") close();
        trapKeydown(e);
      });
    }

    // 3D screenshot shine
    function bindShot3D() {
      if (!DOM.modalMedia || !DOM.shot3d || LOW_POWER) return;

      DOM.modalMedia.addEventListener("mousemove", rafThrottle((e) => {
        if (!open) return;
        const r = DOM.modalMedia.getBoundingClientRect();
        const x = clamp((e.clientX - r.left) / r.width, 0, 1);
        const y = clamp((e.clientY - r.top) / r.height, 0, 1);

        const rx = (0.5 - y) * 7;
        const ry = (x - 0.5) * 10;

        DOM.shot3d.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        DOM.shot3d.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
        DOM.shot3d.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
        DOM.shot3d.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);

        const shine = clamp(1 - Math.hypot(x - 0.5, y - 0.5) * 1.25, 0, 1);
        DOM.shot3d.style.setProperty("--shine", `${shine.toFixed(3)}`);
      }), { passive: true });

      DOM.modalMedia.addEventListener("mouseleave", () => {
        if (!open) return;
        DOM.shot3d.style.setProperty("--rx", `0deg`);
        DOM.shot3d.style.setProperty("--ry", `0deg`);
        DOM.shot3d.style.setProperty("--shine", `0`);
      });
    }

    // Impact: SVG crack + rings + chips + physics shards
    const ImpactFX = (() => {
      const SVG_NS = "http://www.w3.org/2000/svg";

      function makePath(d, cls, sw, op, delay) {
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("d", d);
        p.setAttribute("class", cls);
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

      // Sites generation (bounded attempts)
      function genSites(w, h, ox, oy, dirToCenter) {
        const pts = [];
        const minWH = Math.max(1, Math.min(w, h));
        const cx = w * 0.5;
        const cy = h * 0.5;
        const target = clamp(Math.floor((w * h) / (260 * 260)), 28, 100);

        const ux = Math.cos(dirToCenter);
        const uy = Math.sin(dirToCenter);

        const pad = 10;
        pts.push({ x: clamp(ox, pad, w - pad), y: clamp(oy, pad, h - pad), w: 1.0 });
        pts.push({ x: cx, y: cy, w: 0.9 });
        pts.push({ x: pad, y: pad, w: 0.6 });
        pts.push({ x: w - pad, y: pad, w: 0.6 });
        pts.push({ x: pad, y: h - pad, w: 0.6 });
        pts.push({ x: w - pad, y: h - pad, w: 0.6 });

        const maxAttempts = target * 30;
        let attempts = 0;

        while (pts.length < target && attempts < maxAttempts) {
          attempts++;

          const x = Math.random() * w;
          const y = Math.random() * h;

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

      // KNN graph (small k)
      function buildKNNGraph(pts, k = 4) {
        const edges = new Map();
        const adj = Array.from({ length: pts.length }, () => []);

        for (let i = 0; i < pts.length; i++) {
          const pi = pts[i];
          const best = [];

          for (let j = 0; j < pts.length; j++) {
            if (j === i) continue;
            const pj = pts[j];
            const d = dist2(pi.x, pi.y, pj.x, pj.y);

            // insert into best (k is small)
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
        return { adj };
      }

      // Grow edges biased towards center direction
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

      // Ring cracks around impact
      function genRingCracks(w, h, ox, oy) {
        const minWH = Math.max(1, Math.min(w, h));
        const rings = [];

        const base = clamp(minWH * 0.08, 18, 38);
        const r1 = base;
        const r2 = base * 1.9;
        const r3 = base * 2.8;

        rings.push({ r: r1, sw: 1.6, op: 0.55 });
        rings.push({ r: r2, sw: 1.2, op: 0.38 });
        rings.push({ r: r3, sw: 0.9, op: 0.24 });

        const paths = [];

        rings.forEach((ring, idx) => {
          const segs = 46;
          const pts = [];
          for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const jitter = rand(-ring.r * 0.045, ring.r * 0.045);
            const rr = ring.r + jitter;

            pts.push({
              x: ox + Math.cos(a) * rr,
              y: oy + Math.sin(a) * rr
            });
          }

          // create broken segments: introduce 3..5 gaps
          const gaps = randi(3, 5);
          const cut = new Set();
          for (let g = 0; g < gaps; g++) {
            const start = randi(0, segs - 8);
            const len = randi(3, 8);
            for (let k = 0; k < len; k++) cut.add(start + k);
          }

          let chunk = [];
          for (let i = 0; i < pts.length; i++) {
            if (cut.has(i)) {
              if (chunk.length >= 2) paths.push({ pts: chunk, ring: idx });
              chunk = [];
            } else {
              chunk.push(pts[i]);
            }
          }
          if (chunk.length >= 2) paths.push({ pts: chunk, ring: idx });
        });

        return paths;
      }

      function genImpactStar(ox, oy) {
        // small star rays from impact
        const rays = [];
        const n = randi(10, 14);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + rand(-0.15, 0.15);
          const len = rand(10, 22);
          const pts = [
            { x: ox + Math.cos(a) * 2, y: oy + Math.sin(a) * 2 },
            { x: ox + Math.cos(a) * len, y: oy + Math.sin(a) * len }
          ];
          rays.push(pts);
        }
        return rays;
      }

      function genVoronoiCrack(w, h, ox, oy, dirToCenter) {
        const pts = genSites(w, h, ox, oy, dirToCenter);
        const { adj } = buildKNNGraph(pts, 4);
        const start = nearestIndex(pts, ox, oy);
        const used = growCrackEdges(pts, adj, start, dirToCenter);

        // sort by length (longer first)
        const edges = [];
        for (const key of used) {
          const [aStr, bStr] = key.split("|");
          const a = parseInt(aStr, 10);
          const b = parseInt(bStr, 10);
          const p0 = pts[a], p1 = pts[b];
          const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          edges.push({ a, b, len });
        }
        edges.sort((A, B) => B.len - A.len);

        return { pts, adj, edges, used };
      }

      function render(w, h, ox, oy, dirToCenter) {
        if (!DOM.crackSvg) return;

        DOM.crackSvg.innerHTML = "";
        DOM.crackSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

        const g = document.createElementNS(SVG_NS, "g");
        DOM.crackSvg.appendChild(g);

        let delay = 0;

        // 1) impact star
        const star = genImpactStar(ox, oy);
        star.forEach((seg) => {
          const d = polyPath(seg);
          const p = makePath(d, "crack-path", rand(1.2, 2.4), rand(0.55, 0.85), delay);
          p.style.animationDuration = `${rand(200, 320).toFixed(0)}ms`;
          g.appendChild(p);
          delay += 6;
        });

        // 2) rings
        const ringPaths = genRingCracks(w, h, ox, oy);
        ringPaths.forEach((rp) => {
          const d = polyPath(rp.pts);
          const sw = rp.ring === 0 ? 1.8 : (rp.ring === 1 ? 1.25 : 0.9);
          const op = rp.ring === 0 ? 0.60 : (rp.ring === 1 ? 0.38 : 0.24);

          const p = makePath(d, "crack-path crack-ring", sw, op, delay + randi(0, 60));
          p.style.animationDuration = `${rand(260, 520).toFixed(0)}ms`;
          g.appendChild(p);
        });

        // 3) Voronoi-like network
        const net = genVoronoiCrack(w, h, ox, oy, dirToCenter);

        net.edges.forEach((e) => {
          const p0 = net.pts[e.a];
          const p1 = net.pts[e.b];
          const poly = jitterPolyline(p0, p1);
          const d = polyPath(poly);
          if (!d) return;

          const sw = clamp(0.9 + (net.pts[e.a].w + net.pts[e.b].w) * 0.85, 0.9, 2.6);
          const op = clamp(0.20 + (net.pts[e.a].w + net.pts[e.b].w) * 0.35, 0.20, 0.90);

          const path = makePath(d, "crack-path", sw, op, delay);
          path.style.animationDuration = `${clamp(260 + e.len * 0.55, 280, 620)}ms`;
          g.appendChild(path);

          delay += 8;
          if (delay > 220) delay = 220;
        });

        // faint micro-cracks
        for (let i = 0; i < 14; i++) {
          const u = randi(0, net.pts.length - 1);
          const neigh = net.adj[u];
          if (!neigh || neigh.length === 0) continue;
          const v = neigh[randi(0, neigh.length - 1)];
          const a = Math.min(u, v), b = Math.max(u, v);
          const key = `${a}|${b}`;
          if (net.used.has(key)) continue;

          const p0 = net.pts[a], p1 = net.pts[b];
          const d = polyPath(jitterPolyline(p0, p1));
          if (!d) continue;

          const path = makePath(d, "crack-path", rand(0.6, 1.05), rand(0.12, 0.26), 140 + randi(0, 160));
          path.style.animationDuration = `${rand(260, 520).toFixed(0)}ms`;
          g.appendChild(path);
        }
      }

      return { render };
    })();

    // Physics shards/chips (single rAF sim)
    const Physics = (() => {
      let active = false;
      let rafId = 0;
      let t0 = 0;
      let prev = 0;

      const parts = [];

      function reset() {
        parts.length = 0;
        active = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      }

      function spawn(el, kind, baseAngle, power, extra = {}) {
        const a = baseAngle + rand(-1.25, 1.25);
        const sp = power * rand(0.65, 1.0);

        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp;

        parts.push({
          el,
          kind,
          x: 0,
          y: 0,
          vx,
          vy,
          rot: rand(-80, 80),
          vr: rand(-420, 420),
          s: extra.s ?? rand(0.75, 1.05),
          life: extra.life ?? rand(0.62, 0.92),
          fade: extra.fade ?? rand(0.15, 0.30),
          op: 0,
        });
      }

      function apply(p) {
        // translate from origin (CSS uses left/top at --crx/--cry)
        p.el.style.opacity = String(clamp(p.op, 0, 1));
        p.el.style.transform =
          `translate(-50%,-50%) translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotate(${p.rot.toFixed(1)}deg) scale(${p.s.toFixed(3)})`;
      }

      function tick(t) {
        if (!active) return;
        const dt = clamp((t - prev) / 1000, 0.010, 0.030);
        prev = t;

        const elapsed = (t - t0) / 1000;
        const gravity = 980; // px/s^2
        const drag = 0.985;

        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];

          // integrate
          p.vy += gravity * dt * (p.kind === "chip" ? 0.85 : 1.0);
          p.vx *= drag;
          p.vy *= drag;

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          p.rot += p.vr * dt;

          // opacity envelope
          const fadeIn = clamp(elapsed / 0.08, 0, 1);
          const fadeOut = clamp((p.life - elapsed) / p.fade, 0, 1);
          p.op = fadeIn * fadeOut;

          // stop condition
          if (elapsed >= p.life) {
            p.el.style.opacity = "0";
            parts.splice(i, 1);
            continue;
          }

          apply(p);
        }

        if (parts.length === 0) {
          reset();
          return;
        }

        rafId = requestAnimationFrame(tick);
      }

      function start(originAngle, intensity = 1.0) {
        if (!DOM.shardsWrap) return;

        reset();

        // if low power -> let CSS run
        if (LOW_POWER) return;

        active = true;
        t0 = now();
        prev = t0;

        DOM.shardsWrap.classList.add("is-physics");

        // shards (existing)
        const shards = $$(".shard", DOM.shardsWrap);
        const power = 760 * intensity;

        shards.forEach((el, i) => {
          el.style.opacity = "0";
          el.style.willChange = "transform, opacity";

          // random sizes
          el.style.width = `${rand(16, 44).toFixed(0)}px`;
          el.style.height = `${rand(10, 26).toFixed(0)}px`;

          const a = originAngle + (i - shards.length * 0.5) * 0.12;
          spawn(el, "shard", a, power, { life: rand(0.55, 0.82), fade: rand(0.12, 0.24) });
        });

        // chip debris (create temporary)
        const chipCount = MOBILE ? 10 : 22;
        for (let i = 0; i < chipCount; i++) {
          const chip = document.createElement("i");
          chip.className = "chip-bit";
          chip.style.width = `${rand(4, 7).toFixed(0)}px`;
          chip.style.height = `${rand(4, 7).toFixed(0)}px`;
          chip.style.opacity = "0";
          DOM.shardsWrap.appendChild(chip);

          const a = originAngle + rand(-1.9, 1.9);
          spawn(chip, "chip", a, power * 0.62, { life: rand(0.38, 0.62), fade: rand(0.10, 0.18), s: rand(0.7, 1.0) });
        }

        rafId = requestAnimationFrame(tick);

        // cleanup temporary chips after burst
        setTimeout(() => {
          $$(".chip-bit", DOM.shardsWrap).forEach((el) => el.remove());
          DOM.shardsWrap.classList.remove("is-physics");
        }, 1100);
      }

      return { start };
    })();

    function openFromCard(card, ev) {
      const id = card.getAttribute("data-id");
      const project = PROJECTS.find((p) => p.id === id);
      if (!project) return;

      let click = null;
      if (ev && typeof ev.clientX === "number") click = { x: ev.clientX, y: ev.clientY };
      else {
        const r = card.getBoundingClientRect();
        click = { x: r.left + r.width * 0.55, y: r.top + r.height * 0.45 };
      }

      openModal(project, click, card);
    }

    function openModal(project, clickXY, openerEl) {
      if (!DOM.modal || !DOM.modalCard) return;

      lastActiveEl = openerEl || document.activeElement;

      // fill content
      DOM.modalTitle.textContent = project.title;
      DOM.modalDesc.textContent = project.desc;
      DOM.modalTags.innerHTML = project.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("");
      DOM.modalMeta.textContent = `Stack: ${project.tags.join(" • ")} • ${project.filter.join(" / ")}`;

      DOM.modalDemo.href = project.demo && isUrl(project.demo) ? project.demo : "#";
      DOM.modalCode.href = project.code && isUrl(project.code) ? project.code : "#";
      DOM.modalDemo.style.opacity = project.demo && isUrl(project.demo) ? "1" : "0.35";
      DOM.modalCode.style.opacity = project.code && isUrl(project.code) ? "1" : "0.35";

      if (DOM.modalShot) {
        DOM.modalShot.src = project.shot || "";
        DOM.modalShot.alt = `Скриншот: ${project.title}`;
      }

      // show modal FIRST (so sizes are not 0)
      DOM.modal.classList.add("is-open");
      DOM.modal.setAttribute("aria-hidden", "false");
      open = true;

      // hide main from AT
      DOM.main?.setAttribute("aria-hidden", "true");
      try { DOM.main?.setAttribute("inert", ""); } catch {}

      ScrollLock.lock();

      // restart opening animation reliably
      DOM.modal.classList.remove("is-opening");
      void DOM.modal.offsetWidth;
      DOM.modal.classList.add("is-opening");

      // media video (lazy)
      if (DOM.modalVideo) {
        try { DOM.modalVideo.pause(); DOM.modalVideo.currentTime = 0; } catch {}
        DOM.modalVideo.removeAttribute("src");
        if (project.video) {
          DOM.modalVideo.src = project.video;
          DOM.modalVideo.load?.();
          DOM.modalVideo.play().catch(() => {});
        }
      }

      // build crack after layout
      requestAnimationFrame(() => {
        const r = DOM.modalCard.getBoundingClientRect();
        const w = Math.max(1, Math.floor(r.width));
        const h = Math.max(1, Math.floor(r.height));

        const ix = clamp(clickXY?.x ?? (r.left + r.width / 2), r.left, r.right);
        const iy = clamp(clickXY?.y ?? (r.top + r.height / 2), r.top, r.bottom);

        const localX = ix - r.left;
        const localY = iy - r.top;

        // origin vars for CSS
        DOM.modalCard.style.setProperty("--crx", `${(localX / r.width) * 100}%`);
        DOM.modalCard.style.setProperty("--cry", `${(localY / r.height) * 100}%`);

        const dirToCenter = Math.atan2((h / 2) - localY, (w / 2) - localX);

        // SVG crack (Voronoi-like + rings)
        ImpactFX.render(w, h, localX, localY, dirToCenter);

        // shards/chips physics (from click direction)
        Physics.start(dirToCenter + Math.PI, 1.0);
      });

      playCrack();
      setTimeout(() => DOM.modal.classList.remove("is-opening"), REDUCED ? 1 : 820);

      // focus
      setTimeout(() => $(".modal-close", DOM.modalCard)?.focus(), 60);
    }

    function close() {
      if (!DOM.modal || !open) return;
      open = false;

      DOM.modal.setAttribute("aria-hidden", "true");
      DOM.modal.classList.remove("is-open");
      DOM.modal.classList.remove("is-opening");

      // cleanup svg
      if (DOM.crackSvg) DOM.crackSvg.innerHTML = "";

      try { DOM.modalVideo?.pause?.(); } catch {}

      ScrollLock.unlock();

      // restore main
      DOM.main?.setAttribute("aria-hidden", "false");
      try { DOM.main?.removeAttribute("inert"); } catch {}

      // restore focus
      if (lastActiveEl && typeof lastActiveEl.focus === "function") {
        setTimeout(() => lastActiveEl.focus(), 20);
      }
    }

    function init() {
      bindModalEvents();
      bindShot3D();
    }

    return { init, openFromCard, close };
  })();

  // -----------------------------
  // Intro -> Enter site
  // -----------------------------
  function showMain() {
    if (!DOM.intro || !DOM.main) return;

    DOM.intro.classList.add("is-leaving");
    setTimeout(() => {
      DOM.intro.style.display = "none";
      DOM.main.style.display = "block";
      requestAnimationFrame(() => {
        DOM.main.classList.add("is-ready");
        DOM.main.setAttribute("aria-hidden", "false");
        try { DOM.main.removeAttribute("inert"); } catch {}
        Reveal.init();
      });
    }, 760);
  }

  function enterSiteToTop() {
    showMain();
    // Always start from top
    setTimeout(() => window.scrollTo(0, 0), 20);
  }

  function enterSiteToProjects(clickXY) {
    showMain();
    // wait until main becomes visible (avoids scrolling while display:none)
    setTimeout(() => Portal.toSection("projects", clickXY, true), 920);
  }

  DOM.enterBtn?.addEventListener("click", (e) => {
    playCrack();
    enterSiteToTop();
  });

  DOM.projectsBtn?.addEventListener("click", (e) => {
    playCrack();
    // user explicitly chose projects
    enterSiteToProjects({ x: e.clientX, y: e.clientY });
  });

  window.addEventListener("keydown", (e) => {
    if (!DOM.intro || DOM.intro.style.display === "none") return;
    if (e.key === "Enter" || e.key === " ") {
      playCrack();
      enterSiteToTop();
    }
  });

  // -----------------------------
  // Boot
  // -----------------------------
  function boot() {
    // init continuous/ambient
    WebGLGlass.init();
    Cursor.init();
    HoverFX.init();
    Parallax.init();
    Nav.init();
    Projects.init();
    Modal.init();

    // year
    if (DOM.year) DOM.year.textContent = String(new Date().getFullYear());

    // Start preloader AFTER WebGL init has had a chance
    Preloader.start(WebGLGlass.ready);
  }

  boot();
})();
