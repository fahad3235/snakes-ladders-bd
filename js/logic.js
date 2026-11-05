// Snakes & Ladders BD - pure game logic (no DOM).
// Classic 10x10 board, boustrophedon numbering 1-100.
// Exported for Node tests via the module guard at the bottom.

const BOARD_SIZE = 100;
const WIN_CELL = 100;

const LADDERS = {
  1: 38, 4: 14, 9: 31, 21: 42, 28: 84,
  36: 44, 51: 67, 71: 91, 80: 100
};

const SNAKES = {
  16: 6, 47: 26, 49: 11, 56: 53, 62: 19,
  64: 60, 87: 24, 93: 73, 95: 75, 98: 78
};

// cellRowCol(n): 1-based cell number -> { row, col } where
// row 0 is the BOTTOM row (cells 1-10) and col 0 is the left edge.
// Boustrophedon: even rows (from bottom) run left->right, odd rows right->left.
function cellRowCol(n) {
  if (!Number.isInteger(n) || n < 1 || n > BOARD_SIZE) {
    throw new Error('cell out of range: ' + n);
  }
  const row = Math.floor((n - 1) / 10);
  const posInRow = (n - 1) % 10;
  const col = (row % 2 === 0) ? posInRow : 9 - posInRow;
  return { row, col };
}

// cellNumber(row, col): inverse of cellRowCol.
function cellNumber(row, col) {
  if (row < 0 || row > 9 || col < 0 || col > 9) {
    throw new Error('row/col out of range: ' + row + ',' + col);
  }
  const posInRow = (row % 2 === 0) ? col : 9 - col;
  return row * 10 + posInRow + 1;
}

function rollDie(random) {
  const r = random || Math.random;
  return 1 + Math.floor(r() * 6);
}

// resolveMove(pos, roll): pure single-move resolution.
// Returns { from, roll, landed, final, events, won, extraTurn, overshoot }.
// events: [{ type: 'ladder'|'snake', from, to }] in resolution order.
// Chained snake/ladder landings are resolved in a loop (guarded).
function resolveMove(pos, roll) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
    throw new Error('invalid roll: ' + roll);
  }
  if (!Number.isInteger(pos) || pos < 0 || pos > BOARD_SIZE) {
    throw new Error('invalid position: ' + pos);
  }
  if (pos + roll > BOARD_SIZE) {
    return {
      from: pos, roll: roll, landed: pos, final: pos,
      events: [], won: false, extraTurn: roll === 6, overshoot: true
    };
  }
  const landed = pos + roll;
  let cur = landed;
  const events = [];
  let guard = 0;
  while (guard++ < 20) {
    if (LADDERS[cur] !== undefined) {
      events.push({ type: 'ladder', from: cur, to: LADDERS[cur] });
      cur = LADDERS[cur];
    } else if (SNAKES[cur] !== undefined) {
      events.push({ type: 'snake', from: cur, to: SNAKES[cur] });
      cur = SNAKES[cur];
    } else {
      break;
    }
  }
  return {
    from: pos, roll: roll, landed: landed, final: cur,
    events: events, won: cur === WIN_CELL,
    extraTurn: roll === 6, overshoot: false
  };
}

function nextPlayerIndex(current, count) {
  if (count < 2) throw new Error('need at least 2 players');
  return (current + 1) % count;
}

// createGame(players): players = [{ name, isComputer, color }]
// Returns mutable state; applyRoll(state, roll) advances it.
function createGame(players) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
    throw new Error('need 2-4 players');
  }
  return {
    players: players.map(function (p, i) {
      return {
        name: (p.name || '').trim() || ('Player ' + (i + 1)),
        isComputer: !!p.isComputer,
        color: p.color || '#888888',
        pos: 0,
        moves: 0
      };
    }),
    current: 0,
    winner: null,
    log: [] // newest first, capped at 10 by applyRoll
  };
}

// applyRoll(state, roll): applies one dice roll for the current player.
// Returns the resolveMove result. Advances the turn unless the player
// rolled a 6 (extra turn) or won the game.
function applyRoll(state, roll) {
  if (state.winner) throw new Error('game already over');
  const player = state.players[state.current];
  const res = resolveMove(player.pos, roll);
  player.pos = res.final;
  player.moves += 1;
  state.log.unshift({
    player: player.name,
    roll: roll,
    from: res.from,
    landed: res.landed,
    final: res.final,
    events: res.events,
    won: res.won,
    extraTurn: res.extraTurn,
    overshoot: res.overshoot
  });
  if (state.log.length > 10) state.log.length = 10;
  if (res.won) {
    state.winner = player.name;
  } else if (!res.extraTurn) {
    state.current = nextPlayerIndex(state.current, state.players.length);
  }
  return res;
}

const SnakesLaddersLogic = {
  BOARD_SIZE: BOARD_SIZE,
  WIN_CELL: WIN_CELL,
  LADDERS: LADDERS,
  SNAKES: SNAKES,
  cellRowCol: cellRowCol,
  cellNumber: cellNumber,
  rollDie: rollDie,
  resolveMove: resolveMove,
  nextPlayerIndex: nextPlayerIndex,
  createGame: createGame,
  applyRoll: applyRoll
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SnakesLaddersLogic;
}
if (typeof window !== 'undefined') {
  window.SnakesLaddersLogic = SnakesLaddersLogic;
}
