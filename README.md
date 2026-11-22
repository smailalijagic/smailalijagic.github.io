# 🎮 Mini Games

A small mobile-first mini games website that runs entirely in the browser and is hosted on **GitHub Pages**.
No build step, no frameworks, no backend: just HTML, CSS, JavaScript and one JSON file per game.

## Games

| Game | What it does | Data |
|---|---|---|
| **Sudoku** | Easy / Medium / Hard / Extreme Hard. Puzzles are generated in the browser and always have exactly one solution. Notes mode, undo, erase, hints, mistake counter, timer, best times, auto-save. | `data/sudoku.json` (difficulty levels) |
| **Spy** | Choose the number of players (3–20), spies and an optional timer. Pass the phone around: each player sees the place and their role, the spy sees only "You are the spy". Tap a player number to reveal whether they were the spy. | `data/spy.json` (100 places × 8 roles) |
| **Higher / Lower** | Screen split in half. Tap the side with the higher value. Streak + best score, pick your categories. | `data/higher-lower.json` (10 categories) |

## Project structure

```
index.html              ← home page / game menu
css/style.css           ← shared styles
js/common.js            ← shared helpers (JSON loading, storage, shuffle…)
data/
  sudoku.json
  spy.json
  higher-lower.json
sudoku/       index.html, sudoku.css, sudoku.js
spy/          index.html, spy.css, spy.js
higher-lower/ index.html, hl.css, hl.js
.nojekyll               ← tells GitHub Pages to serve files as they are
```

## Publish on GitHub Pages

1. Create a new repository on GitHub (e.g. `minigames`), public.
2. Upload all files from this folder (keep the folder structure). Via the website: **Add file → Upload files**, drag everything in, commit.
   Or with git:
   ```bash
   git init
   git add .
   git commit -m "Mini games website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/minigames.git
   git push -u origin main
   ```
3. In the repo go to **Settings → Pages**.
   Under **Build and deployment** choose **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, then **Save**.
4. After about a minute the site is live at `https://<your-username>.github.io/minigames/`.

Tip: If you name the repository `<your-username>.github.io`, the site is served at `https://<your-username>.github.io/` directly.

## Run locally

The games load their JSON with `fetch`, which browsers block when you open `index.html` straight from disk.
Start a small local server instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Editing the data

### Spy – `data/spy.json`
```json
{ "name": "Airplane", "emoji": "✈️", "roles": ["Pilot", "Flight Attendant", "Passenger"] }
```
Add or remove places freely. If there are more players than roles, roles are reused.

### Higher / Lower – `data/higher-lower.json`
Each category has a question, a number format and a list of items:
```json
{
  "id": "billionaires", "title": "Billionaires", "emoji": "💰",
  "question": "Who has more money?",
  "prefix": "$", "suffix": "", "format": "compact",
  "source": "Approx. net worth, Forbes 2025",
  "items": [ { "name": "Bill Gates", "value": 108000000000, "emoji": "💻" } ]
}
```
- `format`: `compact` (1.2B), `number` (8'849) or `decimal` (44.7)
- Pairs whose values are closer than `settings.minDifferencePercent` are never shown.
- Values like net worth or box office change over time, update them now and then.

### Sudoku – `data/sudoku.json`
`clues` = how many numbers are given at the start (fewer = harder).

## Add to home screen
On iPhone (Safari) or Android (Chrome): open the site → Share / menu → **Add to Home Screen**. It then opens like an app.
