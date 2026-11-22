// ===== Higher / Lower =====
// Questions come from data/higher-lower.json

const H = {
  data: null,
  enabled: null,   // Set of enabled category ids
  score: 0,
  best: MG.load("hl_best", 0),
  current: null,   // { cat, a, b }
  recent: [],      // recently used pair keys, to avoid repeats
  locked: true,
};

const leftEl = MG.$("#left"), rightEl = MG.$("#right"), vsEl = MG.$("#vs"),
      overlayEl = MG.$("#overlay");

function formatValue(cat, v) {
  let s;
  if (cat.format === "compact") {
    s = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: v >= 1e9 ? 2 : 1 }).format(v);
  } else if (cat.format === "decimal" || v < 10) {
    s = new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v);
  } else {
    s = new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(v).replace(/,/g, "'");
  }
  return (cat.prefix || "") + s + (cat.suffix || "");
}

function minDiff() {
  return (H.data.settings && H.data.settings.minDifferencePercent || 2.5) / 100;
}

function nextPair() {
  const cats = H.data.categories.filter((c) => H.enabled.has(c.id));
  for (let tries = 0; tries < 200; tries++) {
    const cat = MG.pick(cats);
    const [a, b] = MG.shuffle(cat.items).slice(0, 2);
    const diff = Math.abs(a.value - b.value) / Math.max(a.value, b.value);
    if (diff < minDiff()) continue;
    const key = cat.id + ":" + [a.name, b.name].sort().join("|");
    if (H.recent.includes(key) && tries < 150) continue;
    H.recent.push(key);
    if (H.recent.length > 40) H.recent.shift();
    return { cat, a, b };
  }
  return null;
}

function fillHalf(el, item) {
  el.className = el.className.replace(/\b(revealed|win|lose|picked)\b/g, "").trim();
  el.innerHTML = "";
  el.append(
    MG.el("div", { class: "emoji", text: item.emoji || "❔" }),
    MG.el("div", { class: "name", text: item.name }),
    MG.el("div", { class: "value", text: "" }),
    MG.el("div", { class: "tap", text: "tap if higher" }),
    MG.el("div", { class: "mark", text: "" }),
  );
  el.disabled = false;
}

function newRound() {
  H.current = nextPair();
  if (!H.current) return;
  const { cat, a, b } = H.current;
  MG.$("#catLabel").textContent = cat.emoji + " " + cat.title;
  MG.$("#qText").textContent = cat.question;
  MG.$("#source").textContent = cat.source || "";
  vsEl.className = "vs";
  vsEl.textContent = "VS";
  fillHalf(leftEl, a);
  fillHalf(rightEl, b);
  H.locked = false;
}

function countUp(el, cat, target, ms = 650) {
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatValue(cat, p < 1 ? target * eased : target);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function choose(side) {
  if (H.locked || !H.current) return;
  H.locked = true;
  const { cat, a, b } = H.current;
  const pickedEl = side === "left" ? leftEl : rightEl;
  const higherIsLeft = a.value > b.value;
  const correct = (side === "left") === higherIsLeft;

  leftEl.disabled = rightEl.disabled = true;
  [[leftEl, a], [rightEl, b]].forEach(([el, item]) => {
    el.classList.add("revealed");
    countUp(el.querySelector(".value"), cat, item.value);
  });
  (higherIsLeft ? leftEl : rightEl).classList.add("win");
  (higherIsLeft ? rightEl : leftEl).classList.add("lose");
  pickedEl.querySelector(".mark").textContent = correct ? "✅" : "❌";
  pickedEl.classList.add("picked");
  vsEl.className = "vs " + (correct ? "ok" : "bad");
  vsEl.textContent = correct ? "✓" : "✗";

  if (correct) {
    H.score++;
    if (H.score > H.best) { H.best = H.score; MG.save("hl_best", H.best); }
    updateScore();
    MG.vibrate(20);
    setTimeout(newRound, 1500);
  } else {
    MG.vibrate([60, 50, 60]);
    setTimeout(gameOver, 1700);
  }
}

function updateScore() {
  MG.$("#score").textContent = H.score;
  MG.$("#best").textContent = H.best;
}

/* ---------- Overlays ---------- */
function categoryChips() {
  const wrap = MG.el("div", { class: "chips" });
  for (const c of H.data.categories) {
    const chip = MG.el("button", { class: "chip" + (H.enabled.has(c.id) ? " on" : ""), text: c.emoji + " " + c.title });
    chip.addEventListener("click", () => {
      if (H.enabled.has(c.id)) {
        if (H.enabled.size === 1) return; // keep at least one
        H.enabled.delete(c.id);
      } else H.enabled.add(c.id);
      chip.classList.toggle("on", H.enabled.has(c.id));
      MG.save("hl_categories", [...H.enabled]);
    });
    wrap.appendChild(chip);
  }
  return wrap;
}

function openModal(children) {
  overlayEl.innerHTML = "";
  overlayEl.appendChild(MG.el("div", { class: "modal" }, children));
  overlayEl.classList.remove("hidden");
}
function closeModal() { overlayEl.classList.add("hidden"); overlayEl.innerHTML = ""; }

function startGame() {
  closeModal();
  H.score = 0;
  updateScore();
  newRound();
}

function showStart() {
  H.locked = true;
  openModal([
    MG.el("div", { class: "big-emoji", text: "⚖️" }),
    MG.el("h2", { text: "Higher / Lower" }),
    MG.el("p", { text: "Tap the side with the higher value. One wrong answer and it's over." }),
    MG.el("div", { class: "muted", style: "font-size:.85rem;margin-bottom:8px", text: "Categories" }),
    categoryChips(),
    MG.el("button", { class: "btn pink", text: "Play", onclick: startGame }),
  ]);
}

function gameOver() {
  const newBest = H.score > 0 && H.score === H.best;
  openModal([
    MG.el("div", { class: "big-emoji", text: newBest ? "🏆" : "💥" }),
    MG.el("h2", { text: newBest ? "New best!" : "Game over" }),
    MG.el("p", { class: "final-score", style: "color:var(--text)", text: String(H.score) }),
    MG.el("p", { text: "Best: " + H.best }),
    MG.el("div", { class: "stack" }, [
      MG.el("button", { class: "btn pink", text: "Play again", onclick: startGame }),
      MG.el("button", { class: "btn secondary", text: "Categories", onclick: showStart }),
    ]),
  ]);
}

/* ---------- Init ---------- */
leftEl.addEventListener("click", () => choose("left"));
rightEl.addEventListener("click", () => choose("right"));
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") choose("left");
  if (e.key === "ArrowRight") choose("right");
});

(async function init() {
  try {
    H.data = await MG.loadJSON("../data/higher-lower.json");
    const savedCats = MG.load("hl_categories");
    const ids = H.data.categories.map((c) => c.id);
    const valid = (savedCats || []).filter((id) => ids.includes(id));
    H.enabled = new Set(valid.length ? valid : ids);
    updateScore();
    newRound();
    showStart();
  } catch (err) {
    MG.$("#qText").textContent = "Could not load questions. Open via a web server or GitHub Pages.";
  }
})();
