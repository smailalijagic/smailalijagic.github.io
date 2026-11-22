// Shared helpers used by all games
const MG = {
  async loadJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load " + path);
    return res.json();
  },

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  randInt(n) {
    return Math.floor(Math.random() * n);
  },

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // localStorage can throw (private mode etc.), so always wrap it
  save(key, value) {
    try { localStorage.setItem("mg_" + key, JSON.stringify(value)); } catch (e) {}
  },
  load(key, fallback = null) {
    try {
      const v = localStorage.getItem("mg_" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  remove(key) {
    try { localStorage.removeItem("mg_" + key); } catch (e) {}
  },

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  },

  vibrate(ms = 20) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  },

  $(sel, root = document) { return root.querySelector(sel); },

  el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  },

  showError(container, err) {
    container.innerHTML =
      '<div class="card center"><p><b>Could not load game data.</b></p>' +
      '<p class="muted">If you opened the file directly from your disk, start a local server ' +
      '(see README) or open the GitHub Pages URL.</p><p class="muted"><small>' +
      String(err.message || err) + "</small></p></div>";
  },
};
