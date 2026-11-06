/* =========================================================
   blowDetector.js — detects a person blowing into the microphone.

   Pipeline:
     Microphone → MediaStream → AudioContext → AnalyserNode
        → numbers (loudness + "noisiness") → decision

   A breath is not just "loud". Compared with a clap or speech it is:
     • SUSTAINED   (a few hundred ms, not a single spike)
     • NOISE-LIKE  (a hiss/rumble with no clear pitch; speech has pitch)
     • NOT TONAL   (no single frequency sticking out, unlike a whistle)
   So we require: loud enough  AND  noise-like  AND  not tonal  AND  sustained.
   ========================================================= */

(function (ns) {
  "use strict";

  // All tuning knobs in one place. If blowing is too hard/easy to detect on
  // your phone, change these (open the site with #debug at the end to see
  // live numbers on screen).
  const CFG = {
    FFT_SIZE: 1024,        // analysis window size
    CALIBRATE_MS: 700,     // measure room noise for this long first
    MIN_RMS: 0.07,         // never trigger below this loudness (0..1 scale)
    NOISE_MULT: 3,         // threshold = room noise × this (if higher than MIN_RMS)
    MIN_FLATNESS: 0.2,     // 0 = pure tone, 1 = pure noise. Breath is noisy.
    MIN_LOW_RATIO: 0.7,    // …or most of the energy is low-frequency rumble
    LOW_HZ: 700,
    CREST_HZ: 1000,        // tonality check looks at 60..1000 Hz
    MAX_CREST: 7,          // peak ÷ average in that band. Breath ≈ 2–4, a whistle/tone ≫ 10
    BAND_MIN_HZ: 60,
    BAND_MAX_HZ: 6000,
    SUSTAIN_MS: 350        // how long the "blow" must last
  };

  const noop = () => {};

  function makeError(code, original) {
    const e = new Error(code);
    e.code = code;       // "unsupported" | "denied" | "no-mic" | "error"
    e.original = original;
    return e;
  }

  /**
   * start({ onLevel, onBlow, onDebug })
   * Asks for the microphone and starts listening.
   *  - onLevel(0..1): how close we are to a confirmed blow (drives the flame lean + meter)
   *  - onBlow():      a blow was confirmed
   * Returns a Promise → { stop() }. Rejects with an Error whose .code says why.
   */
  async function start(handlers) {
    const { onLevel = noop, onBlow = noop, onDebug = null } = handlers || {};
    const AC = window.AudioContext || window.webkitAudioContext;

    // getUserMedia only exists on https:// or localhost
    if (!window.isSecureContext || !AC ||
        !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      throw makeError("unsupported");
    }

    let stream;
    try {
      // IMPORTANT: switch OFF the browser's voice "cleanup". Noise suppression
      // and auto-gain are designed to REMOVE steady noise, which is exactly
      // what a breath looks like to the mic.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
    } catch (err) {
      const n = err && err.name;
      if (n === "NotAllowedError" || n === "SecurityError") throw makeError("denied", err);
      if (n === "NotFoundError" || n === "DevicesNotFoundError") throw makeError("no-mic", err);
      throw makeError("error", err);
    }

    const ctx = new AC();
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch (_) { /* ignore */ }
    }

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = CFG.FFT_SIZE;
    analyser.smoothingTimeConstant = 0.2;
    // We connect source → analyser only (NOT to the speakers), otherwise the
    // mic would play back through the speaker and howl.
    source.connect(analyser);

    const timeData = new Float32Array(analyser.fftSize);
    const freqData = new Float32Array(analyser.frequencyBinCount);

    // Convert Hz limits into FFT bin indexes
    const binHz = ctx.sampleRate / analyser.fftSize;
    const loBin = Math.max(1, Math.floor(CFG.BAND_MIN_HZ / binHz));
    const hiBin = Math.min(freqData.length - 1, Math.ceil(CFG.BAND_MAX_HZ / binHz));
    const lowBin = Math.floor(CFG.LOW_HZ / binHz);
    const crestBin = Math.min(hiBin, Math.floor(CFG.CREST_HZ / binHz));

    let raf = 0;
    let stopped = false;
    let fired = false;
    const t0 = performance.now();
    let last = t0;
    let calibSum = 0;
    let calibN = 0;
    let calibrated = false;
    let threshold = CFG.MIN_RMS;
    let sustain = 0;

    function tick(now) {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 100); // clamp: a lagging tab shouldn't count as a long blow
      last = now;

      // 1) Loudness: RMS of the waveform (values are -1..1)
      analyser.getFloatTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
      const rms = Math.sqrt(sum / timeData.length);

      // 2) Calibration: learn the room's background level, then set the threshold
      if (!calibrated) {
        calibSum += rms;
        calibN++;
        if (now - t0 >= CFG.CALIBRATE_MS) {
          const floor = Math.min(calibSum / Math.max(calibN, 1), 0.05);
          threshold = Math.max(CFG.MIN_RMS, floor * CFG.NOISE_MULT);
          calibrated = true;
        }
        return;
      }

      // 3) Spectrum: how noise-like is the sound?
      analyser.getFloatFrequencyData(freqData); // values in dB
      let logSum = 0, linSum = 0, lowE = 0, totE = 0, n = 0;
      let peak = 0, bandSum = 0, bandN = 0;
      for (let i = loBin; i <= hiBin; i++) {
        const db = Math.max(freqData[i], -120);   // -Infinity (silence) → -120
        const mag = Math.pow(10, db / 20);
        logSum += Math.log(mag + 1e-12);
        linSum += mag;
        const e = mag * mag;
        totE += e;
        if (i <= lowBin) lowE += e;
        if (i <= crestBin) {                      // for the tonality check
          if (mag > peak) peak = mag;
          bandSum += mag;
          bandN++;
        }
        n++;
      }
      // Spectral flatness = geometric mean / arithmetic mean (0 tonal … 1 noise)
      const flatness = Math.exp(logSum / n) / (linSum / n + 1e-12);
      const lowRatio = totE > 0 ? lowE / totE : 0;
      // Crest = how much one frequency sticks out. A whistle or steady tone has a
      // huge spike; a breath is a smooth rumble with no spike.
      const crest = bandN ? peak / (bandSum / bandN + 1e-12) : 0;

      // 4) Decision, with a "sustain" timer that rises while blowing and
      //    falls twice as fast when not, so one clap or cough never counts.
      const blowy = rms > threshold &&
                    crest < CFG.MAX_CREST &&
                    (flatness > CFG.MIN_FLATNESS || lowRatio > CFG.MIN_LOW_RATIO);
      sustain = blowy ? sustain + dt : Math.max(0, sustain - dt * 2);

      const level = Math.min(1, sustain / CFG.SUSTAIN_MS);
      onLevel(level);
      if (onDebug) onDebug({ rms, threshold, flatness, lowRatio, crest, sustain });

      if (!fired && sustain >= CFG.SUSTAIN_MS) {
        fired = true;
        onBlow();
      }
    }

    // stop(): release everything. Without this the browser keeps showing the
    // red "recording" indicator and the mic stays on.
    function stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      try { source.disconnect(); } catch (_) { /* ignore */ }
      if (ctx.state !== "closed") ctx.close().catch(() => {});
    }

    raf = requestAnimationFrame(tick);
    return { stop };
  }

  ns.BlowDetector = { start };
})((window.Birthday = window.Birthday || {}));
