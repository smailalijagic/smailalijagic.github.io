// ===== Sudoku =====
// Puzzles are generated in the browser. data/sudoku.json defines the difficulty levels.
// Every generated puzzle has exactly one solution.

/* ---------- Generator / solver (bitmask backtracking) ---------- */
const BOX = (r, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

function popcount(x) { let n = 0; while (x) { x &= x - 1; n++; } return n; }

// Solves grid (array of 81, 0 = empty). Returns number of solutions found (up to limit).
// If out is given, first solution is written into it. random = shuffle digit order.
function solve(grid, limit, out, random) {
  const g = grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    const r = (i / 9) | 0, c = i % 9, b = BOX(r, c), bit = 1 << v;
    if ((rows[r] | cols[c] | boxes[b]) & bit) return 0; // invalid grid
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
  }
  let count = 0;
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function rec() {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const r = (i / 9) | 0, c = i % 9;
      const mask = ~(rows[r] | cols[c] | boxes[BOX(r, c)]) & 0x3fe;
      const n = popcount(mask);
      if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n === 0) return; }
    }
    if (best === -1) {
      count++;
      if (out && count === 1) for (let i = 0; i < 81; i++) out[i] = g[i];
      return;
    }
    const r = (best / 9) | 0, c = best % 9, b = BOX(r, c);
    const order = random ? MG.shuffle(digits) : digits;
    for (const d of order) {
      const bit = 1 << d;
      if (!(bestMask & bit)) continue;
      g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec();
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  }
  rec();
  return count;
}

function generatePuzzle(targetClues, attempts) {
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const solution = new Array(81).fill(0);
    solve(new Array(81).fill(0), 1, solution, true);
    const puzzle = solution.slice();
    let filled = 81;
    for (const idx of MG.shuffle([...Array(81).keys()])) {
      if (filled <= targetClues) break;
      const keep = puzzle[idx];
      puzzle[idx] = 0;
      if (solve(puzzle, 2) !== 1) puzzle[idx] = keep;
      else filled--;
    }
    if (!best || filled < best.filled) best = { puzzle, solution, filled };
    if (filled <= targetClues) break;
  }
  return best;
}

/* ---------- Game state & UI ---------- */
const S = {
  levels: [],
  level: null,
  puzzle: null,   // givens (0 = empty)
  solution: null,
  values: null,   // current player values
  notes: null,    // bitmask per cell
  selected: -1,
  notesMode: false,
  mistakes: 0,
  hints: 0,
  seconds: 0,
  history: [],
  timerId: null,
  finished: false,
};

const menuEl = MG.$("#menu"), gameEl = MG.$("#game"), boardEl = MG.$("#board"),
      padEl = MG.$("#pad"), overlayEl = MG.$("#overlay"), timerEl = MG.$("#timer");
const cells = [];

function peersOf(i) {
  const r = (i / 9) | 0, c = i % 9, b = BOX(r, c), out = [];
  for (let j = 0; j < 81; j++) {
    if (j === i) continue;
    const rj = (j / 9) | 0, cj = j % 9;
    if (rj === r || cj === c || BOX(rj, cj) === b) out.push(j);
  }
  return out;
}
const PEERS = [...Array(81).keys()].map(peersOf);

function buildBoard() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9;
    const cell = MG.el("div", { class: "cell", role: "gridcell" });
    if (c === 2 || c === 5) cell.classList.add("bR");
    if (r === 2 || r === 5) cell.classList.add("bB");
    cell.addEventListener("click", () => select(i));
    boardEl.appendChild(cell);
    cells[i] = cell;
  }
  padEl.innerHTML = "";
  for (let d = 1; d <= 9; d++) {
    const b = MG.el("button", { class: "pad-btn", "data-d": d }, [String(d), MG.el("small")]);
    b.addEventListener("click", () => input(d));
    padEl.appendChild(b);
  }
}

function render() {
  const sel = S.selected;
  const selVal = sel >= 0 ? S.values[sel] : 0;
  const peerSet = sel >= 0 ? new Set(PEERS[sel]) : new Set();
  const counts = new Array(10).fill(0);

  for (let i = 0; i < 81; i++) {
    const v = S.values[i];
    if (v && v === S.solution[i]) counts[v]++;
    const cell = cells[i];
    cell.className = "cell";
    const r = (i / 9) | 0, c = i % 9;
    if (c === 2 || c === 5) cell.classList.add("bR");
    if (r === 2 || r === 5) cell.classList.add("bB");
    if (S.puzzle[i]) cell.classList.add("given");
    if (peerSet.has(i)) cell.classList.add("peer");
    if (selVal && v === selVal) cell.classList.add("same");
    if (i === sel) cell.classList.add("selected");
    if (v && v !== S.solution[i]) cell.classList.add("error");

    if (v) {
      cell.textContent = v;
    } else if (S.notes[i]) {
      const n = MG.el("div", { class: "notes" });
      for (let d = 1; d <= 9; d++) n.appendChild(MG.el("span", { text: S.notes[i] & (1 << d) ? d : "" }));
      cell.textContent = "";
      cell.appendChild(n);
    } else {
      cell.textContent = "";
    }
  }

  padEl.querySelectorAll(".pad-btn").forEach((b) => {
    const d = +b.dataset.d;
    const left = 9 - counts[d];
    b.classList.toggle("done", left <= 0);
    b.classList.toggle("notes-mode", S.notesMode);
    b.querySelector("small").textContent = left > 0 ? left : "";
  });

  MG.$("#mistakes").textContent = S.mistakes;
  MG.$("#notesBtn").classList.toggle("on", S.notesMode);
  MG.$("#notesState").textContent = S.notesMode ? "on" : "off";
  timerEl.textContent = MG.formatTime(S.seconds);
}

function select(i) {
  if (S.finished) return;
  S.selected = i;
  render();
}

function pushHistory() {
  S.history.push({ values: S.values.slice(), notes: S.notes.slice() });
  if (S.history.length > 200) S.history.shift();
}

function input(d) {
  const i = S.selected;
  if (S.finished || i < 0 || S.puzzle[i]) return;
  if (S.values[i] && S.values[i] === S.solution[i]) return; // already correct

  pushHistory();
  if (S.notesMode) {
    if (S.values[i]) return;
    S.notes[i] ^= 1 << d;
  } else {
    if (S.values[i] === d) { S.values[i] = 0; }
    else {
      S.values[i] = d;
      S.notes[i] = 0;
      if (d !== S.solution[i]) {
        S.mistakes++;
        MG.vibrate(60);
      } else {
        // remove this digit from notes of peers
        for (const p of PEERS[i]) S.notes[p] &= ~(1 << d);
        checkGroupsDone(i);
      }
    }
  }
  persist();
  render();
  checkWin();
}

function checkGroupsDone(i) {
  // small flash when a row / column / box gets completed
  const r = (i / 9) | 0, c = i % 9, b = BOX(r, c);
  const groups = [
    [...Array(9).keys()].map((k) => r * 9 + k),
    [...Array(9).keys()].map((k) => k * 9 + c),
    [...Array(9).keys()].map((k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)),
  ];
  for (const g of groups) {
    if (g.every((j) => S.values[j] === S.solution[j])) {
      g.forEach((j, n) => setTimeout(() => {
        cells[j].classList.remove("flash"); void cells[j].offsetWidth; cells[j].classList.add("flash");
      }, n * 25));
    }
  }
}

function erase() {
  const i = S.selected;
  if (S.finished || i < 0 || S.puzzle[i]) return;
  if (S.values[i] && S.values[i] === S.solution[i]) return;
  if (!S.values[i] && !S.notes[i]) return;
  pushHistory();
  S.values[i] = 0;
  S.notes[i] = 0;
  persist(); render();
}

function undo() {
  if (S.finished || !S.history.length) return;
  const h = S.history.pop();
  S.values = h.values; S.notes = h.notes;
  persist(); render();
}

function hint() {
  if (S.finished) return;
  let i = S.selected;
  if (i < 0 || S.values[i] === S.solution[i]) {
    const empty = [...Array(81).keys()].filter((j) => S.values[j] !== S.solution[j]);
    if (!empty.length) return;
    i = MG.pick(empty);
  }
  pushHistory();
  S.values[i] = S.solution[i];
  S.notes[i] = 0;
  for (const p of PEERS[i]) S.notes[p] &= ~(1 << S.values[i]);
  S.hints++;
  S.selected = i;
  checkGroupsDone(i);
  persist(); render(); checkWin();
}

function checkWin() {
  for (let i = 0; i < 81; i++) if (S.values[i] !== S.solution[i]) return;
  S.finished = true;
  stopTimer();
  MG.remove("sudoku_save");
  const bestKey = "sudoku_best_" + S.level.id;
  const prev = MG.load(bestKey);
  const isBest = prev === null || S.seconds < prev;
  if (isBest) MG.save(bestKey, S.seconds);
  MG.vibrate([30, 40, 30]);

  overlayEl.innerHTML = "";
  overlayEl.appendChild(MG.el("div", { class: "modal" }, [
    MG.el("div", { class: "big-emoji", text: "🎉" }),
    MG.el("h2", { text: "Solved!" }),
    MG.el("p", { text: S.level.label + (isBest ? " · New best time!" : "") }),
    MG.el("div", { class: "stats" }, [
      MG.el("div", {}, [MG.el("b", { text: MG.formatTime(S.seconds) }), MG.el("span", { text: "Time" })]),
      MG.el("div", {}, [MG.el("b", { text: String(S.mistakes) }), MG.el("span", { text: "Mistakes" })]),
      MG.el("div", {}, [MG.el("b", { text: String(S.hints) }), MG.el("span", { text: "Hints" })]),
    ]),
    MG.el("div", { class: "stack" }, [
      MG.el("button", { class: "btn", text: "Play again", onclick: () => { hideOverlay(); startNew(S.level); } }),
      MG.el("button", { class: "btn secondary", text: "Change difficulty", onclick: () => { hideOverlay(); showMenu(); } }),
    ]),
  ]));
  overlayEl.classList.remove("hidden");
}

function hideOverlay() { overlayEl.classList.add("hidden"); overlayEl.innerHTML = ""; }

/* ---------- Timer & persistence ---------- */
function startTimer() {
  stopTimer();
  S.timerId = setInterval(() => {
    if (document.hidden) return;
    S.seconds++;
    timerEl.textContent = MG.formatTime(S.seconds);
    if (S.seconds % 5 === 0) persist();
  }, 1000);
}
function stopTimer() { if (S.timerId) clearInterval(S.timerId); S.timerId = null; }

function persist() {
  if (S.finished) return;
  MG.save("sudoku_save", {
    levelId: S.level.id, puzzle: S.puzzle, solution: S.solution, values: S.values,
    notes: S.notes, mistakes: S.mistakes, hints: S.hints, seconds: S.seconds,
  });
}

/* ---------- Screens ---------- */
function showMenu() {
  stopTimer();
  gameEl.classList.add("hidden");
  menuEl.classList.remove("hidden");
  timerEl.textContent = "";
  menuEl.innerHTML = "";

  const saved = MG.load("sudoku_save");
  if (saved && S.levels.find((l) => l.id === saved.levelId)) {
    const lvl = S.levels.find((l) => l.id === saved.levelId);
    menuEl.appendChild(MG.el("button", {
      class: "btn pink",
      text: "▶ Continue " + lvl.label + " (" + MG.formatTime(saved.seconds) + ")",
      onclick: () => resume(saved),
    }));
  }
  menuEl.appendChild(MG.el("h2", { class: "menu-title", text: "New game" }));
  for (const lvl of S.levels) {
    const best = MG.load("sudoku_best_" + lvl.id);
    menuEl.appendChild(MG.el("button", { class: "diff-btn", onclick: () => startNew(lvl) }, [
      MG.el("span", { text: lvl.emoji + "  " + lvl.label }),
      MG.el("small", { text: best !== null ? "Best " + MG.formatTime(best) : lvl.clues + " clues" }),
    ]));
  }
}

function showGame() {
  menuEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  MG.$("#diffLabel").textContent = S.level.emoji + " " + S.level.label;
  render();
  startTimer();
}

function startNew(lvl) {
  menuEl.classList.add("hidden");
  overlayEl.innerHTML = '<div class="modal"><div class="big-emoji">🧩</div><h2>Generating…</h2><p>Building a unique puzzle</p></div>';
  overlayEl.classList.remove("hidden");
  // let the overlay paint before the (blocking) generator runs
  setTimeout(() => {
    const { puzzle, solution } = generatePuzzle(lvl.clues, lvl.attempts || 1);
    Object.assign(S, {
      level: lvl, puzzle, solution, values: puzzle.slice(), notes: new Array(81).fill(0),
      selected: -1, notesMode: false, mistakes: 0, hints: 0, seconds: 0, history: [], finished: false,
    });
    hideOverlay();
    persist();
    showGame();
  }, 40);
}

function resume(saved) {
  Object.assign(S, {
    level: S.levels.find((l) => l.id === saved.levelId),
    puzzle: saved.puzzle, solution: saved.solution, values: saved.values, notes: saved.notes,
    mistakes: saved.mistakes, hints: saved.hints || 0, seconds: saved.seconds,
    selected: -1, notesMode: false, history: [], finished: false,
  });
  showGame();
}

/* ---------- Events ---------- */
MG.$("#undoBtn").addEventListener("click", undo);
MG.$("#eraseBtn").addEventListener("click", erase);
MG.$("#hintBtn").addEventListener("click", hint);
MG.$("#notesBtn").addEventListener("click", () => { S.notesMode = !S.notesMode; render(); });
MG.$("#newBtn").addEventListener("click", () => { persist(); showMenu(); });

// keyboard support for desktop
document.addEventListener("keydown", (e) => {
  if (gameEl.classList.contains("hidden") || S.finished) return;
  if (e.key >= "1" && e.key <= "9") input(+e.key);
  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
  else if (e.key === "n" || e.key === "N") { S.notesMode = !S.notesMode; render(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === "z") undo();
  else if (e.key.startsWith("Arrow")) {
    let i = S.selected < 0 ? 40 : S.selected;
    const r = (i / 9) | 0, c = i % 9;
    if (e.key === "ArrowUp") i = ((r + 8) % 9) * 9 + c;
    if (e.key === "ArrowDown") i = ((r + 1) % 9) * 9 + c;
    if (e.key === "ArrowLeft") i = r * 9 + (c + 8) % 9;
    if (e.key === "ArrowRight") i = r * 9 + (c + 1) % 9;
    e.preventDefault();
    select(i);
  }
});

document.addEventListener("visibilitychange", () => { if (document.hidden && S.level && !S.finished) persist(); });

/* ---------- Init ---------- */
(async function init() {
  try {
    const data = await MG.loadJSON("../data/sudoku.json");
    S.levels = data.difficulties;
    buildBoard();
    showMenu();
  } catch (err) {
    MG.showError(menuEl, err);
  }
})();
