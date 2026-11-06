/* =========================================================
   main.js — the conductor.
   The other files are specialists (sound, mic, particles, scenes);
   this file decides WHEN each one acts, following the story:

     welcome → cake (wish) → blow → dark reveal → message → replay
   ========================================================= */

(function () {
  "use strict";

  const { CONFIG, SceneManager, Effects, Sfx, BlowDetector } = window.Birthday;
  const $ = (id) => document.getElementById(id);

  const el = {
    openBtn: $("open-btn"),
    cake: $("cake"),
    cakeHint: $("cake-hint"),
    micRow: $("mic-row"),
    micStatus: $("mic-status"),
    meterFill: $("meter-fill"),
    manualBtn: $("manual-btn"),
    revealTitle: $("reveal-title"),
    continueBtn: $("continue-btn"),
    messageBody: $("message-body"),
    signoff: $("signoff"),
    replayBtn: $("replay-btn")
  };

  /* ---------- State ---------- */

  let detector = null;   // the running microphone listener (or null)
  let blown = false;     // has the candle been blown out in this run?
  let gen = 0;           // "run number": lets async work notice it is out of date after Replay
  let timers = [];       // every pending setTimeout, so Replay can cancel them all

  /** later(fn, ms) → setTimeout that we remember, so clearTimers() can cancel it */
  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /* ---------- Build the personal content from config.js ---------- */

  /** Put the name everywhere that has data-name */
  function fillNames() {
    document.querySelectorAll("[data-name]").forEach((n) => (n.textContent = CONFIG.NAME));
  }

  /**
   * buildRevealTitle()
   * Purpose: turn "HAPPY BIRTHDAY VIRAT! ❤️" into one <span> per letter, each
   * with an index --i. CSS turns the index into an animation delay, so the
   * letters pop in one after another. aria-label keeps it readable for
   * screen readers (the individual letters are hidden from them).
   */
  function buildRevealTitle() {
    const words = ["HAPPY", "BIRTHDAY", `${CONFIG.NAME.toUpperCase()}!`];
    let i = 0;
    el.revealTitle.setAttribute("aria-label", `Happy Birthday ${CONFIG.NAME}!`);
    words.forEach((w, wi) => {
      const line = document.createElement("span");
      line.className = "word";
      line.setAttribute("aria-hidden", "true");
      [...w].forEach((ch) => {
        const s = document.createElement("span");
        s.className = "letter";
        s.style.setProperty("--i", i++);
        s.textContent = ch;
        line.appendChild(s);
      });
      if (wi === words.length - 1) {
        const heart = document.createElement("span");
        heart.className = "letter letter--heart";
        heart.style.setProperty("--i", i++);
        heart.textContent = "❤️";
        line.appendChild(heart);
      }
      el.revealTitle.appendChild(line);
    });
  }

  /** Create one <p> per message paragraph; --i staggers their appearance */
  function buildMessage() {
    CONFIG.MESSAGE.forEach((text, i) => {
      const p = document.createElement("p");
      p.className = "seq";
      p.style.setProperty("--i", i);
      p.textContent = text;
      el.messageBody.appendChild(p);
    });
    const n = CONFIG.MESSAGE.length;
    el.signoff.style.setProperty("--i", n);
    el.signoff.textContent = CONFIG.FROM ? `${CONFIG.SIGN_OFF}, ${CONFIG.FROM} ❤️` : `${CONFIG.SIGN_OFF} ❤️`;
    el.replayBtn.style.setProperty("--i", n + 1);
  }

  /* ---------- Small UI helpers ---------- */

  /** Swap the hint text with a fade (remove class → force reflow → add class) */
  function setHint(text) {
    el.cakeHint.classList.remove("swap");
    void el.cakeHint.offsetWidth;          // reading offsetWidth forces the browser to restart the animation
    el.cakeHint.textContent = text;
    el.cakeHint.classList.add("swap");
  }
  function setStatus(text) { el.micStatus.textContent = text; }
  function showManual() { el.manualBtn.classList.remove("is-hidden"); }

  /* ---------- Microphone flow ---------- */

  const MIC_MESSAGES = {
    unsupported: "This browser can't use the microphone here, so use the button 👇",
    denied: "No worries! Use the button to blow it out 👇",
    "no-mic": "No microphone found. Use the button 👇",
    error: "The microphone didn't start. Use the button 👇"
  };

  function stopMic() {
    if (detector) {
      detector.stop();      // releases the mic (removes the browser's "recording" indicator)
      detector = null;
    }
    el.micRow.classList.remove("is-listening");
    if (debugBox) { debugBox.remove(); debugBox = null; }   // debug panel only lives while listening
  }

  /**
   * startMic()
   * Purpose: ask for the microphone and wire the detector to the UI.
   *  - onLevel → the flame leans and the meter fills while you blow
   *  - onBlow  → extinguish the candle
   * If anything fails, we show the manual button instead. The experience never gets stuck.
   */
  async function startMic(myGen) {
    setStatus("Allow the microphone when your browser asks 🎤");
    try {
      const d = await BlowDetector.start({
        onLevel: (level) => {
          el.cake.style.setProperty("--lean", level.toFixed(3));
          el.meterFill.style.setProperty("--level", level.toFixed(3));
        },
        onBlow: () => blowOut(),
        onDebug: debugOn ? showDebug : null
      });

      // While we waited for permission, the person may have pressed the manual
      // button or hit Replay. If so, this result is stale, so release the mic.
      if (myGen !== gen || blown) { d.stop(); return; }

      detector = d;
      el.micRow.classList.add("is-listening");
      setStatus("🎤 Listening… blow gently toward your phone");
    } catch (err) {
      if (myGen !== gen) return;
      showManual();
      setStatus(MIC_MESSAGES[err && err.code] || MIC_MESSAGES.error);
    }
  }

  /** Runs when the cake scene has fully appeared */
  function startWishFlow() {
    const myGen = gen;
    blown = false;

    later(() => {
      setHint("Take a deep breath and blow out the candle!");
      startMic(myGen);
    }, CONFIG.WISH_MS);

    // Even if the mic seems to work, offer the button after a while (just in case)
    later(showManual, CONFIG.WISH_MS + CONFIG.MANUAL_BUTTON_DELAY_MS);
  }

  /* ---------- Blow out → reveal ---------- */

  /**
   * blowOut()
   * Purpose: the single exit point from the cake scene (mic OR manual button).
   * JS only adds the class .is-out; cake.css animates the flame, ember, smoke.
   * Guarded by `blown` so it can never run twice.
   */
  function blowOut() {
    if (blown) return;
    blown = true;

    stopMic();
    el.cake.classList.add("is-out");
    el.cake.style.setProperty("--lean", 0);
    Sfx.poof();
    el.manualBtn.classList.add("is-hidden");
    setStatus("");
    setHint("Your wish is on its way… ✨");

    // Let the smoke drift for a moment, then the screen goes dark and the reveal begins
    later(() => {
      Effects.setNight(true);
      SceneManager.goTo("reveal");
    }, 2000);
  }

  /* ---------- Scene hooks ---------- */

  function onReveal() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    Sfx.sparkle();
    Effects.confettiBurst(110, w * 0.2, h * 0.75);
    Effects.confettiBurst(110, w * 0.8, h * 0.75);
    later(() => Effects.confettiBurst(90, w * 0.5, h * 0.8), 700);
    Effects.confettiRain(9000);
    Effects.launchBalloons(9);
    Effects.heartBurst(24);

    later(() => el.continueBtn.classList.remove("is-hidden"), 4500);
  }

  function onFinal() {
    Effects.heartBurst(16);
    Effects.confettiBurst(100);
    Effects.confettiRain(5000);
    Effects.launchBalloons(5);
  }

  /* ---------- Replay: put EVERYTHING back to the start ---------- */

  function replay() {
    gen++;                    // invalidates any pending async work
    clearTimers();
    stopMic();
    blown = false;

    Effects.reset();
    Effects.setNight(false);

    el.cake.classList.remove("is-out");
    el.cake.style.setProperty("--lean", 0);
    el.meterFill.style.setProperty("--level", 0);
    el.manualBtn.classList.add("is-hidden");
    el.continueBtn.classList.add("is-hidden");
    setStatus("");
    el.cakeHint.textContent = "Close your eyes and think of something wonderful…";

    SceneManager.goTo("welcome");
  }

  /* ---------- Optional debug panel: add #debug to the URL ---------- */

  const debugOn = location.hash === "#debug";
  let debugBox = null;
  function showDebug(d) {
    if (!debugBox) {
      debugBox = document.createElement("pre");
      debugBox.style.cssText =
        "position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:8px;font:11px/1.3 monospace;" +
        "background:rgba(0,0,0,.75);color:#9fffb0;border-radius:8px;pointer-events:none";
      document.body.appendChild(debugBox);
    }
    debugBox.textContent =
      `rms       ${d.rms.toFixed(3)}  (need > ${d.threshold.toFixed(3)})\n` +
      `flatness  ${d.flatness.toFixed(2)}\n` +
      `lowRatio  ${d.lowRatio.toFixed(2)}\n` +
      `crest     ${d.crest.toFixed(1)}  (must be < 7)\n` +
      `sustain   ${Math.round(d.sustain)} ms`;
  }

  /* ---------- Wire everything up ---------- */

  el.openBtn.addEventListener("click", () => {
    Sfx.unlock();                 // this tap is our permission to use audio
    Effects.heartBurst(10);
    SceneManager.goTo("cake");
  });
  el.manualBtn.addEventListener("click", blowOut);
  el.continueBtn.addEventListener("click", () => SceneManager.goTo("final"));
  el.replayBtn.addEventListener("click", replay);

  SceneManager.onEnter("cake", startWishFlow);
  SceneManager.onEnter("reveal", onReveal);
  SceneManager.onEnter("final", onFinal);

  // Release the microphone if the page is closed or hidden mid-listening
  window.addEventListener("pagehide", stopMic);

  /* ---------- Boot ---------- */
  fillNames();
  buildRevealTitle();
  buildMessage();
  document.querySelectorAll("[data-sprinkles]").forEach((c) =>
    Effects.buildSprinkles(c, Number(c.dataset.sprinkles))
  );
  Effects.buildStars(70);
  SceneManager.init("welcome");
  Effects.startHearts();
})();
