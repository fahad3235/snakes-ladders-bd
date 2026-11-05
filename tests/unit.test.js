// Snakes & Ladders BD - unit tests for js/logic.js (pure logic, no DOM).
// Run: node --test tests/unit.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

test('boustrophedon mapping: bottom row runs left to right', () => {
  assert.deepEqual(L.cellRowCol(1), { row: 0, col: 0 });
  assert.deepEqual(L.cellRowCol(5), { row: 0, col: 4 });
  assert.deepEqual(L.cellRowCol(10), { row: 0, col: 9 });
});

test('boustrophedon mapping: second row runs right to left', () => {
  assert.deepEqual(L.cellRowCol(11), { row: 1, col: 9 });
  assert.deepEqual(L.cellRowCol(15), { row: 1, col: 5 });
  assert.deepEqual(L.cellRowCol(20), { row: 1, col: 0 });
});

test('boustrophedon mapping: higher rows alternate', () => {
  assert.deepEqual(L.cellRowCol(21), { row: 2, col: 0 });
  assert.deepEqual(L.cellRowCol(30), { row: 2, col: 9 });
  assert.deepEqual(L.cellRowCol(91), { row: 9, col: 9 });
  assert.deepEqual(L.cellRowCol(100), { row: 9, col: 0 });
});

test('cellNumber is the inverse of cellRowCol for all 100 cells', () => {
  for (let n = 1; n <= 100; n++) {
    const { row, col } = L.cellRowCol(n);
    assert.equal(L.cellNumber(row, col), n, 'round-trip failed for ' + n);
  }
});

test('board has exactly 9 ladders and 10 snakes', () => {
  assert.equal(Object.keys(L.LADDERS).length, 9);
  assert.equal(Object.keys(L.SNAKES).length, 10);
});

test('every ladder endpoint climbs', () => {
  const cases = [[0, 1, 38], [3, 1, 14], [8, 1, 31], [20, 1, 42], [27, 1, 84],
    [35, 1, 44], [50, 1, 67], [70, 1, 91], [79, 1, 100]];
  for (const [pos, roll, expected] of cases) {
    const r = L.resolveMove(pos, roll);
    assert.equal(r.final, expected, `ladder from ${pos + roll}`);
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].type, 'ladder');
    assert.equal(r.events[0].to, expected);
  }
});

test('every snake endpoint slides down', () => {
  const cases = [[15, 1, 6], [46, 1, 26], [48, 1, 11], [55, 1, 53], [61, 1, 19],
    [63, 1, 60], [86, 1, 24], [92, 1, 73], [94, 1, 75], [97, 1, 78]];
  for (const [pos, roll, expected] of cases) {
    const r = L.resolveMove(pos, roll);
    assert.equal(r.final, expected, `snake from ${pos + roll}`);
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].type, 'snake');
    assert.equal(r.events[0].to, expected);
  }
});

test('normal move: no snake, no ladder, no win', () => {
  const r = L.resolveMove(10, 3);
  assert.equal(r.landed, 13);
  assert.equal(r.final, 13);
  assert.deepEqual(r.events, []);
  assert.equal(r.won, false);
  assert.equal(r.overshoot, false);
  assert.equal(r.extraTurn, false);
});

test('ladder 80 -> 100 wins the game', () => {
  const r = L.resolveMove(79, 1);
  assert.equal(r.final, 100);
  assert.equal(r.won, true);
});

test('exact roll to 100 wins; overshoot stays put', () => {
  const win = L.resolveMove(97, 3);
  assert.equal(win.final, 100);
  assert.equal(win.won, true);
  assert.equal(win.overshoot, false);

  const over = L.resolveMove(97, 4);
  assert.equal(over.final, 97);
  assert.equal(over.overshoot, true);
  assert.equal(over.won, false);

  const over2 = L.resolveMove(99, 6);
  assert.equal(over2.final, 99);
  assert.equal(over2.overshoot, true);
});

test('rolling a 6 flags an extra turn', () => {
  assert.equal(L.resolveMove(10, 6).extraTurn, true);
  assert.equal(L.resolveMove(10, 5).extraTurn, false);
  // Even an overshooting 6 still grants the extra turn (standard rule).
  assert.equal(L.resolveMove(98, 6).extraTurn, true);
});

test('chained resolution: landing on a ladder top that is a snake head resolves both', () => {
  // Classic board has no chain; force one temporarily to prove the loop works.
  L.LADDERS[38] = 50; // 1 -> 38 -> 50
  L.SNAKES[50] = 20;  // then 50 -> 20
  try {
    const r = L.resolveMove(0, 1);
    assert.equal(r.final, 20);
    assert.equal(r.events.length, 3); // 1->38, 38->50, 50->20
    assert.equal(r.events[0].type, 'ladder');
    assert.deepEqual([r.events[0].from, r.events[0].to], [1, 38]);
    assert.equal(r.events[1].type, 'ladder');
    assert.deepEqual([r.events[1].from, r.events[1].to], [38, 50]);
    assert.equal(r.events[2].type, 'snake');
    assert.deepEqual([r.events[2].from, r.events[2].to], [50, 20]);
  } finally {
    delete L.LADDERS[38];
    delete L.SNAKES[50];
  }
  // Board is back to the classic layout.
  assert.equal(L.resolveMove(0, 1).final, 38);
});

test('dice range is always 1-6', () => {
  assert.equal(L.rollDie(() => 0), 1);
  assert.equal(L.rollDie(() => 0.9999), 6);
  assert.equal(L.rollDie(() => 0.5), 4);
  for (let i = 0; i < 200; i++) {
    const d = L.rollDie();
    assert.ok(d >= 1 && d <= 6, 'die out of range: ' + d);
  }
});

test('turn rotation advances and wraps', () => {
  assert.equal(L.nextPlayerIndex(0, 3), 1);
  assert.equal(L.nextPlayerIndex(2, 3), 0);
  assert.equal(L.nextPlayerIndex(3, 4), 0);
});

test('createGame validates player count and defaults', () => {
  assert.throws(() => L.createGame([{ name: 'A' }]), /2-4/);
  assert.throws(() => L.createGame([1, 2, 3, 4, 5].map((i) => ({ name: 'P' + i }))), /2-4/);
  const g = L.createGame([{ name: 'Rahim' }, { name: '' }, { name: '  ', isComputer: true }]);
  assert.equal(g.players[0].name, 'Rahim');
  assert.equal(g.players[1].name, 'Player 2'); // blank name defaulted
  assert.equal(g.players[2].isComputer, true);
  assert.equal(g.players[0].pos, 0);
  assert.equal(g.current, 0);
  assert.equal(g.winner, null);
});

test('applyRoll moves the token, logs the move, and rotates the turn', () => {
  const g = L.createGame([{ name: 'A' }, { name: 'B' }]);
  const r = L.applyRoll(g, 3);
  assert.equal(g.players[0].pos, 3);
  assert.equal(g.players[0].moves, 1);
  assert.equal(g.current, 1, 'turn passes to player B');
  assert.equal(g.log.length, 1);
  assert.equal(g.log[0].roll, 3);
  assert.equal(r.final, 3);
});

test('applyRoll with a 6 keeps the turn with the same player', () => {
  const g = L.createGame([{ name: 'A' }, { name: 'B' }]);
  L.applyRoll(g, 6);
  assert.equal(g.current, 0, 'player A rolls again');
  assert.equal(g.players[0].pos, 6);
});

test('applyRoll on a ladder climb records the event and moves to the top', () => {
  const g = L.createGame([{ name: 'A' }, { name: 'B' }]);
  L.applyRoll(g, 1); // 0 -> 1 -> ladder to 38
  assert.equal(g.players[0].pos, 38);
  assert.equal(g.log[0].events[0].type, 'ladder');
});

test('applyRoll win sets the winner and blocks further rolls', () => {
  const g = L.createGame([{ name: 'A' }, { name: 'B' }]);
  g.players[0].pos = 97;
  L.applyRoll(g, 3);
  assert.equal(g.winner, 'A');
  assert.throws(() => L.applyRoll(g, 2), /already over/);
});

test('move log is capped at the last 10 moves', () => {
  const g = L.createGame([{ name: 'A' }, { name: 'B' }]);
  for (let i = 0; i < 12; i++) L.applyRoll(g, 1);
  assert.equal(g.log.length, 10);
  assert.equal(g.log[0].player, 'B'); // newest first
});

test('invalid rolls and positions throw', () => {
  assert.throws(() => L.resolveMove(10, 0), /invalid roll/);
  assert.throws(() => L.resolveMove(10, 7), /invalid roll/);
  assert.throws(() => L.resolveMove(-1, 3), /invalid position/);
  assert.throws(() => L.cellRowCol(0), /out of range/);
  assert.throws(() => L.cellRowCol(101), /out of range/);
});
