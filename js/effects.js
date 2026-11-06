/* =========================================================
   effects.js — hearts, balloons, stars/night, confetti, sprinkles
   Rule: DOM + CSS animation for a few elements (hearts, balloons),
   <canvas> for hundreds of particles (confetti).
   ========================================================= */

(function (ns) {
  "use strict";

  const random = (min, max) => Math.random() * (max - min) + min;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------------- Floating hearts ---------------- */

  const heartsLayer = document.getElementById("hearts-layer");
  const HEART_EMOJIS = ["💗", "💖", "💕", "🩷", "💜", "🤍"];
  const MAX_HEARTS = 18;
  const MAX_HEARTS_BURST = 40;
  let heartTimer = null;

  // JS picks the random numbers, CSS (floatUp) does the moving.
  function spawnHeart(force) {
    const cap = force ? MAX_HEARTS_BURST : MAX_HEARTS;
    if (heartsLayer.childElementCount >= cap) return;

    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = pick(HEART_EMOJIS);
    heart.style.setProperty("--x", `${random(2, 96)}%`);
    heart.style.setProperty("--size", `${random(18, 44)}px`);
    heart.style.setProperty("--dur", `${random(7, 13)}s`);
    heart.style.setProperty("--sway", `${random(-40, 40)}px`);
    heart.style.setProperty("--alpha", random(0.45, 0.9).toFixed(2));
    heart.addEventListener("animationend", () => heart.remove(), { once: true });
    heartsLayer.appendChild(heart);
  }

  function startHearts() {
    if (heartTimer) return;
    for (let i = 0; i < 6; i++) setTimeout(spawnHeart, i * 350);
    heartTimer = setInterval(spawnHeart, 900);
  }

  function heartBurst(n) {
    for (let i = 0; i < n; i++) setTimeout(() => spawnHeart(true), i * 80);
  }

  // Hide the hearts layer while the tab is in the background (saves battery)
  document.addEventListener("visibilitychange", () => {
    heartsLayer.style.display = document.hidden ? "none" : "";
  });

  /* ---------------- Balloons ---------------- */

  const balloonLayer = document.getElementById("balloon-layer");
  const BALLOON_COLORS = [
    ["#ffd3e4", "#ff6fa5"],
    ["#efe5ff", "#b79cff"],
    ["#fff3cf", "#ffc857"],
    ["#dcf4ff", "#6ec3f5"],
    ["#ffe0d6", "#ff8f78"]
  ];
  let balloonTimers = [];

  function spawnBalloon() {
    const [c1, c2] = pick(BALLOON_COLORS);
    const b = document.createElement("span");
    b.className = "balloon";
    b.style.setProperty("--x", `${random(2, 90)}%`);
    b.style.setProperty("--size", `${random(54, 84)}px`);
    b.style.setProperty("--dur", `${random(9, 15)}s`);
    b.style.setProperty("--sway", `${random(-50, 50)}px`);
    b.style.setProperty("--c1", c1);
    b.style.setProperty("--c2", c2);
    b.addEventListener("animationend", () => b.remove(), { once: true });
    balloonLayer.appendChild(b);
  }

  function launchBalloons(count) {
    for (let i = 0; i < count; i++) {
      balloonTimers.push(setTimeout(spawnBalloon, i * 380));
    }
  }

  /* ---------------- Night sky + stars ---------------- */

  const night = document.getElementById("night");

  function buildStars(count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = "star";
      s.style.setProperty("--x", `${random(0, 100)}%`);
      s.style.setProperty("--y", `${random(0, 100)}%`);
      s.style.setProperty("--s", `${random(2, 5).toFixed(1)}px`);
      s.style.setProperty("--d", `${random(2, 5).toFixed(1)}s`);
      s.style.setProperty("--delay", `${random(0, 4).toFixed(1)}s`);
      night.appendChild(s);
    }
  }

  // Toggling one class on <body> fades the dark overlay in or out via CSS
  function setNight(on) {
    document.body.classList.toggle("is-night", on);
  }

  /* ---------------- Confetti (canvas particles) ---------------- */

  const canvas = document.getElementById("confetti-canvas");
  const cctx = canvas.getContext("2d");
  const CONFETTI_COLORS = ["#ff6fa5", "#ff9ec4", "#b79cff", "#d4c1ff", "#ffd36e", "#8fd8ff", "#ffffff", "#ffb3c7"];
  const MAX_PARTICLES = 340;
  let particles = [];
  let rafId = 0;
  let rainTimer = null;
  let W = 0;
  let H = 0;

  // Make the canvas crisp on high-density (retina) phone screens
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function addParticle(x, y, angle, speed) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: random(6, 12),
      color: pick(CONFETTI_COLORS),
      rot: random(0, Math.PI * 2),
      vr: random(-0.25, 0.25),
      tilt: random(0, Math.PI * 2),
      tiltSpeed: random(0.05, 0.2),
      round: Math.random() < 0.3
    });
  }

  function loop() {
    cctx.clearRect(0, 0, W, H);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.28;           // gravity
      p.vx *= 0.985;          // air drag
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.tilt += p.tiltSpeed;

      if (p.y > H + 30) { particles.splice(i, 1); continue; }

      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.color;
      if (p.round) {
        cctx.beginPath();
        cctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        cctx.fill();
      } else {
        // cos(tilt) squashes the rectangle so it looks like it flips in 3D
        cctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.tilt)) + 1);
      }
      cctx.restore();
    }
    // Only keep the animation loop alive while particles exist
    rafId = particles.length ? requestAnimationFrame(loop) : 0;
  }

  function ensureLoop() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  // A fan of confetti shooting upward from a point
  function confettiBurst(count, x, y) {
    const cx = x == null ? W / 2 : x;
    const cy = y == null ? H * 0.5 : y;
    for (let i = 0; i < count; i++) {
      addParticle(cx, cy, random(-Math.PI * 0.95, -Math.PI * 0.05), random(6, 17));
    }
    ensureLoop();
  }

  // Gentle continuous confetti falling from the top for a while
  function confettiRain(ms) {
    clearInterval(rainTimer);
    const end = performance.now() + ms;
    rainTimer = setInterval(() => {
      if (performance.now() > end) { clearInterval(rainTimer); rainTimer = null; return; }
      for (let i = 0; i < 3; i++) {
        addParticle(random(0, W), -12, Math.PI / 2 + random(-0.4, 0.4), random(1, 4));
      }
      ensureLoop();
    }, 120);
  }

  /* ---------------- Cake sprinkles ---------------- */

  const SPRINKLE_COLORS = ["#ff6fa5", "#fff", "#ffd36e", "#8fd8ff", "#b79cff", "#7fe3b0"];

  function buildSprinkles(container, count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement("i");
      s.style.setProperty("--x", `${random(6, 94).toFixed(1)}%`);
      s.style.setProperty("--y", `${random(52, 88).toFixed(1)}%`);
      s.style.setProperty("--r", `${Math.floor(random(0, 180))}deg`);
      s.style.setProperty("--c", pick(SPRINKLE_COLORS));
      container.appendChild(s);
    }
  }

  /* ---------------- Reset (used by Replay) ---------------- */

  function reset() {
    balloonTimers.forEach(clearTimeout);
    balloonTimers = [];
    balloonLayer.innerHTML = "";
    clearInterval(rainTimer);
    rainTimer = null;
    particles = [];
    cctx.clearRect(0, 0, W, H);
  }

  ns.Effects = {
    startHearts, heartBurst,
    launchBalloons,
    buildStars, setNight,
    confettiBurst, confettiRain,
    buildSprinkles,
    reset
  };
})((window.Birthday = window.Birthday || {}));
