/* =========================================================
   sceneManager.js — Phase 2
   A tiny STATE MACHINE: exactly one scene is "active" at a time,
   and goTo(name) moves safely from the current scene to another.

   It does NOT animate anything itself. It only adds/removes the CSS
   class .is-active; the CSS transition in scenes.css does the animating.
   It then WAITS for that animation to finish before continuing.
   ========================================================= */

(function (ns) {
  "use strict";

  const FADE_MS = 700; // must match the 0.7s transition in scenes.css

  const scenes = new Map();   // name → DOM element   e.g. "welcome" → <section>
  const enterHooks = {};      // name → [functions to run after that scene appears]
  let currentName = null;     // the state: which scene is showing
  let isBusy = false;         // a lock: true while a transition is running

  /**
   * waitForFade(el)
   * Purpose: return a Promise that resolves when el finishes its opacity
   * transition. Two safety nets:
   *   1. 'transitionend' fires once PER property (opacity, transform...),
   *      so we only react to opacity on el itself (not bubbling children).
   *   2. A fallback timer, because transitionend never fires if the browser
   *      skips the animation (hidden tab, reduced motion, etc.).
   *      Without it, isBusy could stay true forever and freeze the app.
   */
  function waitForFade(el) {
    return new Promise((resolve) => {
      let finished = false;

      const finish = () => {
        if (finished) return;            // whichever happens first wins
        finished = true;
        el.removeEventListener("transitionend", onEnd);
        clearTimeout(timer);
        resolve();
      };

      const onEnd = (e) => {
        if (e.target === el && e.propertyName === "opacity") finish();
      };

      el.addEventListener("transitionend", onEnd);
      const timer = setTimeout(finish, FADE_MS + 150);
    });
  }

  /**
   * init(startName)
   * Purpose: discover every <section class="scene" data-scene="..."> in the
   * HTML, store them in the Map, and show the first one.
   * Adding a new scene later = adding HTML only. No JS change needed.
   */
  function init(startName) {
    document.querySelectorAll(".scene").forEach((el) => {
      scenes.set(el.dataset.scene, el);
      el.classList.remove("is-active");
      el.setAttribute("tabindex", "-1"); // lets us move keyboard focus to a scene
    });

    const first = scenes.get(startName);
    if (!first) throw new Error(`SceneManager: no scene named "${startName}"`);

    // Wait one frame so the browser registers the "hidden" starting style,
    // otherwise adding .is-active immediately would skip the fade-in.
    requestAnimationFrame(() => {
      first.classList.add("is-active");
      currentName = startName;
    });
  }

  /**
   * goTo(name)
   * Purpose: the one public way to change scenes.
   * Sequence:  fade OUT current → fade IN next → run "enter" hooks.
   * Guards:    ignore the call if a transition is already running, if we're
   *            already on that scene, or if the name doesn't exist.
   */
  async function goTo(name) {
    if (isBusy || name === currentName) return;

    const next = scenes.get(name);
    if (!next) {
      console.warn(`SceneManager: unknown scene "${name}"`);
      return;
    }

    isBusy = true;
    try {
      const prev = scenes.get(currentName);

      prev.classList.remove("is-active");   // CSS starts the fade-out
      await waitForFade(prev);              // pause here until it's done

      next.classList.add("is-active");      // CSS starts the fade-in
      currentName = name;
      next.focus({ preventScroll: true });  // keyboard/screen-reader users follow along
      await waitForFade(next);

      (enterHooks[name] || []).forEach((fn) => fn());
    } finally {
      isBusy = false;                       // ALWAYS release the lock, even after an error
    }
  }

  /**
   * onEnter(name, fn)
   * Purpose: let other modules react when a scene has fully appeared,
   * e.g. the cake scene will start the microphone from here (Phase 4).
   */
  function onEnter(name, fn) {
    (enterHooks[name] = enterHooks[name] || []).push(fn);
  }

  /** current() → name of the active scene (handy for debugging) */
  function current() {
    return currentName;
  }

  // Expose a small public API on one shared global object.
  // (Plain <script> files can't import each other, so we share a namespace.)
  ns.SceneManager = { init, goTo, onEnter, current };
})((window.Birthday = window.Birthday || {}));
