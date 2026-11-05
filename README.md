# Snakes & Ladders BD

An offline, bilingual (English / Bengali) Snakes & Ladders board game
(সাপ ও মই) for the family — a classic 10×10 board, 2–4 pass-and-play
players, optional computer opponents, and persistent stats. No server,
no network requests, no accounts: open `index.html` and play.

## The problem

The classic board game is a staple of Bangladeshi family evenings, but
most online versions need an internet connection, show ads, or only work
in English. This is a small, honest, offline toy: the standard board,
real rules, and a full Bengali interface with Bengali digits for players
who prefer it.

## Features

- **Classic 10×10 board** — boustrophedon numbering 1–100, rendered as a
  real HTML grid (not an image). Bottom row 1–10 runs left to right, the
  next row right to left, and so on.
- **Standard snake/ladder layout** — 9 ladders
  (1→38, 4→14, 9→31, 21→42, 28→84, 36→44, 51→67, 71→91, 80→100) and
  10 snakes (16→6, 47→26, 49→11, 56→53, 62→19, 64→60, 87→24, 93→73,
  95→75, 98→78), drawn on the board with coloured cells, emoji markers
  and start→end labels, plus a full legend.
- **2–4 players** — pass-and-play humans, plus optional computer
  opponents (0 up to players−1). Editable player names, distinct token
  colours, per-player move counts.
- **Real dice rules** — tap/click or press Space to roll, animated dice
  face, rolling a 6 grants an extra turn, exact roll required to reach
  100 (overshoot = stay put, with a message).
- **Turn indicator, move log** (last 10 moves with ladder/snake events),
  win overlay with Play Again / New Game.
- **Stats in localStorage** — games played and wins per player name,
  persisted across reloads, with a confirm-guarded Reset stats button.
- **English / Bengali toggle** — persisted in localStorage; Bengali mode
  shows Bengali digits (০–৯) everywhere numbers appear.
- **Offline & mobile-first** — zero network requests (no CDN, fonts or
  images); responsive layout verified at 390 px with no horizontal
  overflow.

## How to play

1. Choose the number of players (2–4) and how many are computer
   controlled, edit names if you like, and press **Start game**.
2. Tap **Roll dice** (or press Space). Your token moves forward by the
   number shown.
3. Land on a ladder foot to climb up; land on a snake head to slide down.
4. Rolling a 6 gives you another turn.
5. You must land on square 100 **exactly** — if your roll would go past
   100, you stay where you are.
6. First player to reach 100 wins.

## Stack

- Plain HTML + CSS + vanilla JavaScript — no frameworks, no build step,
  no dependencies.
- `js/logic.js` — pure, DOM-free game logic (board map, move resolution
  including chained snake/ladder landings, win check, turn order, dice
  rules). Exported for Node tests via a `typeof module` guard.
- `js/i18n.js` — English/Bengali strings. Bengali is stored as
  `\uXXXX` escapes and numeric character references only, so every
  source file is pure ASCII (verified with
  `grep -rP '[^\x00-\x7F]'` — zero matches).
- `js/app.js` — DOM rendering, input, i18n switching, localStorage.

## How to run locally

No install step. Open `index.html` in any modern browser, or serve the
folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Testing

Unit tests (plain Node, no dependencies):

```sh
node --test tests/unit.test.js
```

Expected output (21 tests, all passing):

```text
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

Headless-Chrome smoke tests (raw CDP over the cached Playwright
`headless_shell` binary; needs no install):

```sh
node tests/smoke.mjs
```

Expected output (23 checks, all passing):

```text
23 smoke tests passed
```

The smoke test loads `file://index.html`, starts a game through the real
UI, rolls the dice (button and Space key), checks the board/legend,
toggles EN→BN, checks 390 px overflow, and asserts 0 console errors and
0 failed requests. See `tests/TEST_RESULTS.md` for the full recorded
results, including a scripted game played to exactly 100.

## Deployment

Static site — copy the folder to any static host, or enable GitHub Pages
on the repository's `main` branch (root). No build step and no
environment variables.

## Limitations

- Pass-and-play only: there is no online multiplayer.
- Computer opponents just auto-roll; they make no tactical decisions
  (there are none to make — the game is pure chance).
- Stats are keyed by player name in the browser's localStorage; clearing
  browser data clears them, and the same name on another device is a
  different record.
- The win overlay and move log are English/Bengali only.

## Status

Complete MVP. Unit tests 21/21 green, smoke tests 23/23 green
(2026-11-05). Offline toy using the classic public-domain board layout;
not affiliated with any publisher.
