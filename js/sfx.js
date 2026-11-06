/* =========================================================
   sfx.js — tiny sound effects made with the Web Audio API.
   No audio files: every sound is generated from oscillators/noise.
   (All sounds here are original, so there's nothing to license.)
   ========================================================= */

(function (ns) {
  "use strict";

  let ctx = null;

  // Browsers only allow sound after a user gesture, so we create the
  // AudioContext lazily and call unlock() from the first button tap.
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  function unlock() { ensure(); }

  // One soft sine "ding" with a quick attack and a smooth fade
  function tone(c, freq, start, dur, vol) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // Rising magical shimmer for the big reveal
  function sparkle() {
    const c = ensure();
    if (!c) return;
    const notes = [784, 988, 1175, 1319, 1568, 1976, 2349];
    const t0 = c.currentTime + 0.05;
    notes.forEach((f, i) => tone(c, f, t0 + i * 0.09, 1.1, 0.07));
    tone(c, 392, t0, 1.6, 0.05);
  }

  // Soft "puff" when the candle goes out (filtered noise that fades)
  function poof() {
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * 0.35);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = c.createGain();
    gain.gain.value = 0.18;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  ns.Sfx = { unlock, sparkle, poof };
})((window.Birthday = window.Birthday || {}));
