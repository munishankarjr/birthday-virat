/* =========================================================
   config.js — everything personal lives here.
   Edit the text below and the whole site updates. No other file
   needs to change.
   ========================================================= */

window.Birthday = window.Birthday || {};

window.Birthday.CONFIG = {
  // Name shown on every screen
  NAME: "Virat",

  // Optional: your name, shown at the end of the message. Leave "" to skip.
  FROM: "",

  // The birthday message. One string = one paragraph (they appear one by one).
  MESSAGE: [
    "Another year around the sun, and the world is a little brighter because you're in it.",
    "Thank you for the laughs, the memories, and for being exactly who you are.",
    "I hope this year gives you the kind of happiness that makes your cheeks hurt from smiling, and that every wish you just made comes true.",
    "Never forget how loved you are. 💖"
  ],

  // Line shown under the message (your name is added after it if FROM is set)
  SIGN_OFF: "With all my love",

  // Timings (milliseconds)
  WISH_MS: 2800,                 // how long "make a wish" shows before the mic starts
  MANUAL_BUTTON_DELAY_MS: 10000  // the manual "blow it out" button appears after this, even if the mic works
};
