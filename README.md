# A Little Birthday Magic ❤️

An interactive birthday surprise. Plain HTML + CSS + JavaScript, no build step, no backend.

## Personalise it (only file you need to edit)
Open `js/config.js` and change `NAME`, `FROM`, `MESSAGE` and `SIGN_OFF`.

## Run it on your computer
Don't double-click index.html (the microphone needs `localhost` or `https`).
Use VS Code → "Live Server" extension → right-click index.html → Open with Live Server.
Or, in this folder:  `python3 -m http.server 8000`  then open http://localhost:8000

## Put it online (free) so ANY device can open it
The microphone only works on https, and every host below gives you https automatically.

### Option A: Netlify Drop (fastest, ~1 minute)
1. Go to https://app.netlify.com/drop  (sign up free if asked)
2. Drag the whole `birthday-virat` FOLDER onto the page.
3. Copy the https://xxxx.netlify.app link. Done. Optional: Site settings → Change site name.

### Option B: GitHub Pages (permanent, good for your portfolio)
1. Create a new PUBLIC repo on github.com (e.g. `birthday-virat`).
2. Upload the files so index.html is at the TOP of the repo (not inside a subfolder).
3. Settings → Pages → Source: "Deploy from a branch" → Branch: main, folder: / (root) → Save.
4. After ~1 minute your link is https://YOURNAME.github.io/birthday-virat/

### Option C: Cloudflare Pages
Workers & Pages → Create → Pages → "Upload assets" → drag the folder.

## Test checklist before sending
- Open the link on your phone (mobile data, not just Wi-Fi) and allow the microphone.
- Blow gently at the phone's bottom edge. If it's too sensitive/insensitive, add #debug to the
  link to see live numbers, then tweak the values at the top of js/blowDetector.js.
- Test "Replay" and the manual "Blow out the candle" button (deny the mic once to see it).
