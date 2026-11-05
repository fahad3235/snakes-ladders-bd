# Snakes & Ladders BD — Test Results

Recorded 2026-11-05 (Asia/Dhaka). All checks were actually run; nothing
here is invented.

## Unit tests — 21/21 PASS

Command: `node --test tests/unit.test.js` (Node v24.22.1)

```text
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

Coverage:

- Boustrophedon mapping: rows 1, 2, 10 spot-checked (cells 1, 5, 10, 11,
  15, 20, 21, 30, 91, 100); `cellNumber` round-trips all 100 cells.
- All 9 ladder endpoints and all 10 snake endpoints verified via
  `resolveMove` (e.g. 0+1 → 38, 79+1 → 100 and wins, 97+1 → 78).
- Normal move, exact win (97+3 → 100), overshoot-stay (97+4 → stays 97;
  99+6 → stays 99), roll-6 extra-turn flag (including overshooting 6).
- Chained resolution: a temporarily injected ladder-then-snake chain
  (1→38, 38→50, 50→20) resolved all three events in order; the classic
  board was restored afterwards (0+1 → 38 again).
- Dice range 1–6 (seeded edges 0 → 1, 0.9999 → 6, plus 200 random rolls).
- Turn rotation/wrap, `createGame` validation (2–4 players, blank-name
  default), `applyRoll` movement/logging/turn passing, win blocks
  further rolls, log capped at last 10 moves, invalid inputs throw.

One real bug found during testing: the first version of the chained-
resolution test expected 2 events but the resolver correctly produced 3
(landing on 1 triggers the 1→38 ladder first). The test expectation was
wrong, not the logic; the test was corrected and now asserts all three
events explicitly.

## Smoke tests — 23/23 PASS

Command: `node tests/smoke.mjs` (raw CDP over the cached Playwright
`headless_shell` binary, `file://index.html`)

```text
23 smoke tests passed
```

Checks passed: title renders; setup screen visible / game hidden before
start; log empty state shows; game screen appears after Start; 100 board
cells; cell 1 is a ladder start labelled →38; cell 16 is a snake start
labelled →6; legend lists 9 ladders + 10 snakes; turn indicator shows
Player 1; dice button roll logs a move and places a token; dice message
describes the roll; turn passes (or extra turn keeps player 1); Space key
rolls; EN→BN toggle changes the title, shows Bengali digits on the
board, persists `"bn"` in localStorage, and changes the roll button
label; 390 px viewport has no horizontal overflow
(`documentElement.scrollWidth <= 390`); 0 page errors; 0 console errors;
0 failed requests.

One real bug found during testing: the smoke harness itself called
`.includes()` on an unevaluated Promise (`await ev(...).includes(...)`
— member access binds tighter than `await`). Fixed with parentheses;
the app code was not at fault.

## Hand-verified scripted game — reaches 100, winner declared

A deterministic greedy script (ladders preferred, snakes avoided) played
a full 2-player game through the real logic module:

- Winner: **Rahim** in 14 rolls. Path included ladder climbs 4→14,
  21→42, 51→67, 71→91, two extra turns on 6s, and a final exact roll
  97+3 → 100. Final positions: Rahim=100, Karim=91.
- 200 random 3-player games: **all terminated with a winner** (max 181
  rolls in a game).

## ASCII audit — 0 non-ASCII bytes

Command: `grep -rP '[^\x00-\x7F]' index.html css/style.css js/*.js
tests/*.js tests/*.mjs` → **0 matches**. Bengali appears only as
`\uXXXX` escapes in JS and numeric character references in HTML.
(An initial audit found 11 raw non-ASCII bytes — em-dashes in comments
and a middle-dot separator in a JS string literal — all replaced with
ASCII/escapes; both suites were re-run green afterwards.)

## Limitations / not verified

- The win overlay and computer-opponent auto-roll were exercised through
  the logic layer and the exposed `window.SnakesLaddersApp` handle, not
  end-to-end in the smoke test (a win needs a long random game; the
  scripted game above covers the win path at the logic level).
- localStorage stats persistence across reloads was not reloaded in the
  smoke run; the save/load code paths are the same ones used for the
  language toggle, which was verified persisted.
- No GitHub repo / Pages deploy was created in this build step (parent
  handles publishing).
