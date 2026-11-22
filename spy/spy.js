// ===== Spy =====
// Places + roles come from data/spy.json

const G = {
  places: [],
  settings: MG.load("spy_settings", { players: 6, spies: 1, minutes: 8 }),
  round: null, // { place, assignments: [{spy, role}], current, timeLeft, revealed:Set }
  timerId: null,
};

const setupEl = MG.$("#setup"), revealEl = MG.$("#reveal"), cardEl = MG.$("#revealCard"),
      discussEl = MG.$("#discuss"), overlayEl = MG.$("#overlay"), topInfo = MG.$("#topInfo");

const LIMITS = { minPlayers: 3, maxPlayers: 20, maxMinutes: 20 };
const maxSpies = (p) => Math.max(1, Math.floor((p - 1) / 2));

function show(section) {
  for (const s of [setupEl, revealEl, discussEl]) s.classList.toggle("hidden", s !== section);
  window.scrollTo(0, 0);
}

/* ---------- Setup screen ---------- */
function stepper(label, sub, key, min, maxFn, fmt = (v) => v) {
  const valueEl = MG.el("span", { class: "value" });
  const update = () => {
    const s = G.settings;
    s[key] = Math.min(Math.max(s[key], min), maxFn());
    valueEl.textContent = fmt(s[key]);
  };
  const change = (d) => {
    G.settings[key] += d;
    // keep spies valid when players change
    G.settings.spies = Math.min(Math.max(G.settings.spies, 1), maxSpies(G.settings.players));
    MG.save("spy_settings", G.settings);
    renderSetup();
  };
  update();
  return MG.el("div", { class: "stepper" }, [
    MG.el("div", { class: "label" }, [label, MG.el("small", { text: sub })]),
    MG.el("div", { class: "controls" }, [
      MG.el("button", { text: "−", "aria-label": "less", onclick: () => change(-1) }),
      valueEl,
      MG.el("button", { text: "+", "aria-label": "more", onclick: () => change(1) }),
    ]),
  ]);
}

function renderSetup() {
  stopTimer();
  topInfo.textContent = "";
  const s = G.settings;
  s.players = Math.min(Math.max(s.players, LIMITS.minPlayers), LIMITS.maxPlayers);
  s.spies = Math.min(Math.max(s.spies, 1), maxSpies(s.players));
  s.minutes = Math.min(Math.max(s.minutes, 0), LIMITS.maxMinutes);

  setupEl.innerHTML = "";
  setupEl.append(
    MG.el("div", { class: "spy-hero" }, [
      MG.el("div", { class: "e", text: "🕵️" }),
      MG.el("p", { text: "Everyone gets the same secret place, except the spy. Find the spy before they figure out where you are." }),
    ]),
    stepper("Players", LIMITS.minPlayers + "–" + LIMITS.maxPlayers, "players", LIMITS.minPlayers, () => LIMITS.maxPlayers),
    stepper("Spies", "max " + maxSpies(s.players) + " for " + s.players + " players", "spies", 1, () => maxSpies(s.players)),
    stepper("Timer", "minutes (0 = no timer)", "minutes", 0, () => LIMITS.maxMinutes, (v) => (v === 0 ? "off" : v)),
    MG.el("button", { class: "btn pink", text: "Start game", onclick: startRound }),
    MG.el("details", { class: "card rules" }, [
      MG.el("summary", { text: "How to play" }),
      MG.el("ol", { html:
        "<li>Pass the phone around. Each player taps to see their secret card, then hides it again.</li>" +
        "<li>Normal players see the <b>place</b> and their <b>role</b>. The spy only sees <b>“You are the spy”</b>.</li>" +
        "<li>Take turns asking each other questions about the place. Don't be too obvious, the spy is listening!</li>" +
        "<li>The spy tries to blend in and guess the place.</li>" +
        "<li>When you think you know who the spy is, vote and tap that player's number to reveal if they were the spy.</li>" }),
      MG.el("p", { class: "muted", text: G.places.length + " places in the game." }),
    ]),
  );
  show(setupEl);
}

/* ---------- Round ---------- */
function startRound() {
  const { players, spies } = G.settings;
  const place = MG.pick(G.places);
  const spySet = new Set(MG.shuffle([...Array(players).keys()]).slice(0, spies));

  // hand out roles: shuffle, and if there are more players than roles, reuse them
  let roles = MG.shuffle(place.roles);
  while (roles.length < players) roles = roles.concat(MG.shuffle(place.roles));

  let r = 0;
  const assignments = [...Array(players).keys()].map((i) =>
    spySet.has(i) ? { spy: true, role: null } : { spy: false, role: roles[r++] });

  G.round = { place, assignments, current: 0, timeLeft: G.settings.minutes * 60, checked: {}, crossed: new Set() };
  showPassScreen();
}

function dots() {
  const wrap = MG.el("div", { class: "progress-dots" });
  G.round.assignments.forEach((_, i) =>
    wrap.appendChild(MG.el("i", { class: i < G.round.current ? "done" : i === G.round.current ? "now" : "" })));
  return wrap;
}

function showPassScreen() {
  const i = G.round.current;
  topInfo.textContent = (i + 1) + " / " + G.round.assignments.length;
  cardEl.innerHTML = "";
  cardEl.append(
    MG.el("div", { class: "player-num", text: "Pass the phone to" }),
    MG.el("h2", { class: "player-big", text: "Player " + (i + 1) }),
    dots(),
    MG.el("button", { class: "hold-btn", text: "Tap to see your card", onclick: showSecret }),
    MG.el("p", { class: "muted", text: "Make sure nobody else is looking 👀" }),
  );
  show(revealEl);
}

function showSecret() {
  const i = G.round.current;
  const a = G.round.assignments[i];
  const last = i === G.round.assignments.length - 1;
  const secret = a.spy
    ? MG.el("div", { class: "secret is-spy" }, [
        MG.el("div", { class: "e", text: "🕵️" }),
        MG.el("div", { class: "val", text: "You are the SPY" }),
        MG.el("div", { class: "hint", text: "You don't know the place. Listen carefully, blend in and try to figure out where everyone is." +
          (G.settings.spies > 1 ? " There are " + G.settings.spies + " spies in this round." : "") }),
      ])
    : MG.el("div", { class: "secret" }, [
        MG.el("div", { class: "e", text: G.round.place.emoji }),
        MG.el("div", { class: "lbl", text: "Place" }),
        MG.el("div", { class: "val", text: G.round.place.name }),
        MG.el("div", { class: "lbl", text: "Your role" }),
        MG.el("div", { class: "val", text: a.role }),
        MG.el("div", { class: "hint", text: "Don't say the place out loud. Find the spy!" }),
      ]);

  cardEl.innerHTML = "";
  cardEl.append(
    MG.el("div", { class: "player-num", text: "Player " + (i + 1) }),
    secret,
    MG.el("button", {
      class: "btn", style: "max-width:380px",
      text: last ? "Hide & start the round" : "Hide & pass to Player " + (i + 2),
      onclick: () => {
        G.round.current++;
        if (last) startDiscussion(); else showPassScreen();
      },
    }),
  );
  MG.vibrate(25);
}

/* ---------- Discussion ---------- */
function startDiscussion() {
  topInfo.textContent = G.settings.players + " players";
  if (G.settings.minutes > 0) startTimer();
  renderDiscussion();
  show(discussEl);
}

function renderDiscussion() {
  const R = G.round;
  discussEl.innerHTML = "";

  if (G.settings.minutes > 0) {
    discussEl.appendChild(MG.el("div", { class: "card center" }, [
      MG.el("div", { class: "muted", text: "Time left" }),
      MG.el("div", { class: "timer-big", id: "timerBig", text: MG.formatTime(R.timeLeft) }),
      MG.el("div", { class: "row", style: "margin-top:10px" }, [
        MG.el("button", { class: "btn secondary", id: "pauseBtn", text: G.timerId ? "Pause" : "Resume", onclick: togglePause }),
        MG.el("button", { class: "btn secondary", text: "+1 min", onclick: () => { R.timeLeft += 60; updateTimer(); } }),
      ]),
    ]));
  } else {
    discussEl.appendChild(MG.el("div", { class: "card center" }, [
      MG.el("div", { style: "font-size:2.4rem", text: "🗣️" }),
      MG.el("b", { text: "Start asking questions!" }),
      MG.el("p", { class: "muted", style: "margin:6px 0 0", text: "Player " + (MG.randInt(R.assignments.length) + 1) + " asks first." }),
    ]));
  }

  const grid = MG.el("div", { class: "player-grid" });
  R.assignments.forEach((a, i) => {
    const state = R.checked[i];
    const b = MG.el("button", {
      class: state === undefined ? "" : state ? "was-spy" : "not-spy",
      onclick: () => revealPlayer(i),
    }, [String(i + 1), MG.el("small", { text: state === undefined ? "Player" : state ? "SPY" : "not spy" })]);
    grid.appendChild(b);
  });

  discussEl.append(
    MG.el("div", { class: "card" }, [
      MG.el("b", { text: "Found the spy? Tap the suspect:" }),
      MG.el("p", { class: "muted", style: "margin:4px 0 12px;font-size:.88rem", text: "Reveals whether that player was the spy." }),
      grid,
    ]),
    MG.el("details", { class: "card" }, [
      MG.el("summary", { text: "📍 All possible places (" + G.places.length + ")" }),
      MG.el("p", { class: "muted", style: "font-size:.85rem", text: "Spy: use this list to guess. Tap to cross places out." }),
      placesList(),
    ]),
    MG.el("button", { class: "btn danger", text: "Reveal everything", onclick: revealAll }),
    MG.el("div", { class: "row" }, [
      MG.el("button", { class: "btn", text: "New round", onclick: () => confirmLeave(startRound) }),
      MG.el("button", { class: "btn secondary", text: "Settings", onclick: () => confirmLeave(renderSetup) }),
    ]),
  );
}

function placesList() {
  const wrap = MG.el("div", { class: "places-list" });
  const sorted = G.places.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const s = MG.el("span", { class: G.round.crossed.has(p.name) ? "crossed" : "", text: p.emoji + " " + p.name });
    s.addEventListener("click", () => {
      if (G.round.crossed.has(p.name)) G.round.crossed.delete(p.name); else G.round.crossed.add(p.name);
      s.classList.toggle("crossed");
    });
    wrap.appendChild(s);
  }
  return wrap;
}

function spyNumbers() {
  return G.round.assignments.map((a, i) => (a.spy ? i + 1 : null)).filter((x) => x !== null);
}

function revealPlayer(i) {
  const R = G.round;
  const isSpy = R.assignments[i].spy;
  R.checked[i] = isSpy;
  const spiesLeft = spyNumbers().filter((n) => R.checked[n - 1] !== true).length;
  MG.vibrate(isSpy ? [40, 60, 40] : 30);

  const buttons = [];
  if (isSpy && spiesLeft === 0) {
    buttons.push(MG.el("button", { class: "btn", text: "Show the place", onclick: revealAll }));
  }
  buttons.push(MG.el("button", { class: "btn secondary", text: "Back", onclick: () => { closeOverlay(); renderDiscussion(); } }));

  openModal(isSpy ? "spy-yes" : "spy-no", [
    MG.el("div", { class: "result-emoji", text: isSpy ? "🕵️" : "🙅" }),
    MG.el("h2", { text: "Player " + (i + 1) + (isSpy ? " was the spy!" : " was NOT the spy") }),
    MG.el("p", { text: isSpy
      ? (spiesLeft === 0 ? (G.settings.spies > 1 ? "All spies found. " : "") + "The players win, unless the spy can name the place now!"
                         : spiesLeft + " more spy" + (spiesLeft > 1 ? "s are" : " is") + " still hiding…")
      : "Wrong person. The spy is still out there…" }),
    MG.el("div", { class: "stack" }, buttons),
  ]);
}

function revealAll() {
  stopTimer();
  const R = G.round;
  const nums = spyNumbers();
  nums.forEach((n) => (R.checked[n - 1] = true));
  openModal("", [
    MG.el("div", { class: "result-emoji", text: R.place.emoji }),
    MG.el("p", { style: "margin:0", text: "The place was" }),
    MG.el("h2", { text: R.place.name }),
    MG.el("p", { style: "margin:14px 0 0", text: nums.length > 1 ? "The spies were" : "The spy was" }),
    MG.el("div", { class: "spy-names", text: nums.map((n) => "Player " + n).join(", ") }),
    MG.el("div", { class: "stack" }, [
      MG.el("button", { class: "btn pink", text: "New round", onclick: () => { closeOverlay(); startRound(); } }),
      MG.el("button", { class: "btn secondary", text: "Back", onclick: () => { closeOverlay(); renderDiscussion(); } }),
    ]),
  ]);
}

function confirmLeave(action) {
  openModal("", [
    MG.el("h2", { text: "End this round?" }),
    MG.el("p", { text: "The current place and spies will be lost." }),
    MG.el("div", { class: "row" }, [
      MG.el("button", { class: "btn secondary", text: "Cancel", onclick: closeOverlay }),
      MG.el("button", { class: "btn danger", text: "Yes", onclick: () => { closeOverlay(); action(); } }),
    ]),
  ]);
}

function openModal(cls, children) {
  overlayEl.innerHTML = "";
  overlayEl.appendChild(MG.el("div", { class: "modal " + cls }, children));
  overlayEl.classList.remove("hidden");
}
function closeOverlay() { overlayEl.classList.add("hidden"); overlayEl.innerHTML = ""; }

/* ---------- Timer ---------- */
function startTimer() {
  stopTimer();
  G.timerId = setInterval(() => {
    G.round.timeLeft = Math.max(0, G.round.timeLeft - 1);
    updateTimer();
    if (G.round.timeLeft === 0) {
      stopTimer();
      MG.vibrate([200, 100, 200, 100, 400]);
      openModal("", [
        MG.el("div", { class: "result-emoji", text: "⏰" }),
        MG.el("h2", { text: "Time's up!" }),
        MG.el("p", { text: "Vote now: who is the spy? Then tap their number." }),
        MG.el("button", { class: "btn", text: "OK", onclick: () => { closeOverlay(); renderDiscussion(); } }),
      ]);
    }
  }, 1000);
}
function stopTimer() { if (G.timerId) clearInterval(G.timerId); G.timerId = null; }
function togglePause() {
  if (G.timerId) stopTimer(); else if (G.round.timeLeft > 0) startTimer();
  const b = MG.$("#pauseBtn");
  if (b) b.textContent = G.timerId ? "Pause" : "Resume";
}
function updateTimer() {
  const t = MG.$("#timerBig");
  if (!t) return;
  t.textContent = MG.formatTime(G.round.timeLeft);
  t.classList.toggle("low", G.round.timeLeft <= 30);
}

/* ---------- Init ---------- */
(async function init() {
  try {
    const data = await MG.loadJSON("../data/spy.json");
    G.places = data.places;
    renderSetup();
  } catch (err) {
    MG.showError(setupEl, err);
  }
})();
