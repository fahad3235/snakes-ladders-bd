// Snakes & Ladders BD - DOM + i18n + localStorage.
// All Bengali text comes from STRINGS (js/i18n.js) as \uXXXX escapes;
// this file is pure ASCII. Emoji are written as \uXXXX escapes too.
(function () {
  'use strict';
  var L = window.SnakesLaddersLogic;
  var STR = window.STRINGS;

  var TOKEN_COLORS = ['#d32f2f', '#1565c0', '#2e7d32', '#f9a825'];
  var LANG_KEY = 'snakes-ladders-bd-lang';
  var STATS_KEY = 'snakes-ladders-bd-stats';
  var SNAKE_EMOJI = '\uD83D\uDC0D'; // snake
  var LADDER_EMOJI = '\uD83E\uDE9C'; // ladder
  var ARROW = ' \u2192 '; // rightwards arrow

  var lang = 'en';
  try {
    var savedLang = JSON.parse(localStorage.getItem(LANG_KEY));
    if (savedLang === 'bn' || savedLang === 'en') lang = savedLang;
  } catch (e) { /* fresh install */ }

  function t(key, params) {
    var s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.split('{' + k + '}').join(params[k]);
      });
    }
    return s;
  }

  // Bengali digits (U+09E6..U+09EF) when lang is bn.
  function fmt(n) {
    var s = String(n);
    if (lang !== 'bn') return s;
    return s.replace(/[0-9]/g, function (d) {
      return String.fromCharCode(0x09E6 + parseInt(d, 10));
    });
  }

  function loadStats() {
    try {
      var s = JSON.parse(localStorage.getItem(STATS_KEY));
      if (s && typeof s.gamesPlayed === 'number' && s.wins) return s;
    } catch (e) { /* corrupted -> reset */ }
    return { gamesPlayed: 0, wins: {} };
  }
  function saveStats(s) {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { /* storage full/blocked */ }
  }
  var stats = loadStats();

  // ---- element handles ----
  function el(id) { return document.getElementById(id); }
  var boardEl = el('board'), diceFaceEl = el('diceFace'), diceMsgEl = el('diceMsg'),
      rollBtn = el('rollBtn'), turnTextEl = el('turnText'), turnDotEl = el('turnDot'),
      playersRowEl = el('playersRow'), logListEl = el('logList'), logEmptyEl = el('logEmpty'),
      ladderListEl = el('ladderList'), snakeListEl = el('snakeList'),
      winsListEl = el('winsList'), statsEmptyEl = el('statsEmpty');

  var game = null;
  var rolling = false;
  var computerTimer = null;

  // ---- board ----
  var cellEls = {}; // cell number -> element
  function buildBoard() {
    boardEl.innerHTML = '';
    cellEls = {};
    for (var row = 9; row >= 0; row--) {
      for (var col = 0; col < 10; col++) {
        var n = L.cellNumber(row, col);
        var cell = document.createElement('div');
        cell.className = 'cell' + (((row + col) % 2 === 0) ? '' : ' alt');
        cell.setAttribute('role', 'gridcell');
        cell.dataset.cell = String(n);
        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = fmt(n);
        cell.appendChild(num);
        if (L.LADDERS[n] !== undefined) {
          cell.classList.add('ladder-start');
          cell.appendChild(markEl(LADDER_EMOJI, fmt(n) + ARROW + fmt(L.LADDERS[n])));
        } else if (L.SNAKES[n] !== undefined) {
          cell.classList.add('snake-start');
          cell.appendChild(markEl(SNAKE_EMOJI, fmt(n) + ARROW + fmt(L.SNAKES[n])));
        }
        // Endpoints get a quiet highlight so the route is traceable.
        var isLadderEnd = Object.keys(L.LADDERS).some(function (k) { return L.LADDERS[k] === n; });
        var isSnakeEnd = Object.keys(L.SNAKES).some(function (k) { return L.SNAKES[k] === n; });
        if (isLadderEnd) cell.classList.add('ladder-end');
        if (isSnakeEnd) cell.classList.add('snake-end');
        var tokens = document.createElement('span');
        tokens.className = 'tokens';
        cell.appendChild(tokens);
        cellEls[n] = cell;
        boardEl.appendChild(cell);
      }
    }
  }
  function markEl(emoji, dest) {
    var wrap = document.createElement('span');
    var m = document.createElement('span');
    m.className = 'mark';
    m.textContent = emoji;
    var d = document.createElement('span');
    d.className = 'dest';
    d.textContent = dest;
    wrap.appendChild(m);
    wrap.appendChild(d);
    return wrap;
  }

  function renderTokens() {
    Object.keys(cellEls).forEach(function (k) {
      var box = cellEls[k].querySelector('.tokens');
      if (box) box.innerHTML = '';
    });
    if (!game) return;
    game.players.forEach(function (p, i) {
      if (p.pos < 1) return;
      var box = cellEls[p.pos].querySelector('.tokens');
      var tok = document.createElement('span');
      tok.className = 'token';
      tok.style.background = p.color;
      tok.textContent = String(i + 1);
      tok.title = p.name;
      box.appendChild(tok);
    });
  }

  // ---- setup ----
  function playerCount() { return parseInt(el('playerCount').value, 10); }
  function computerCount() { return parseInt(el('computerCount').value, 10); }

  function rebuildSetup() {
    var count = playerCount();
    var compSel = el('computerCount');
    var comp = Math.min(computerCount(), count - 1);
    compSel.innerHTML = '';
    for (var c = 0; c <= count - 1; c++) {
      var opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = fmt(c);
      if (c === comp) opt.selected = true;
      compSel.appendChild(opt);
    }
    var fields = el('nameFields');
    fields.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var row = document.createElement('div');
      row.className = 'name-row';
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = TOKEN_COLORS[i];
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'name-' + i;
      input.maxLength = 16;
      input.value = t('player') + ' ' + fmt(i + 1);
      input.setAttribute('aria-label', t('nameLabel') + ' ' + fmt(i + 1));
      var tag = document.createElement('span');
      tag.className = 'tag';
      // Last N slots are computer-controlled.
      tag.textContent = (i >= count - comp) ? t('computer') : '';
      row.appendChild(dot);
      row.appendChild(input);
      row.appendChild(tag);
      fields.appendChild(row);
    }
  }

  function startGame() {
    var count = playerCount();
    var comp = computerCount();
    var players = [];
    for (var i = 0; i < count; i++) {
      var name = el('name-' + i).value.trim() || (t('player') + ' ' + fmt(i + 1));
      players.push({
        name: name,
        isComputer: i >= count - comp,
        color: TOKEN_COLORS[i]
      });
    }
    clearTimeout(computerTimer);
    game = L.createGame(players);
    el('setupCard').classList.add('hidden');
    el('gameCard').classList.remove('hidden');
    el('winOverlay').classList.add('hidden');
    diceFaceEl.textContent = '\u2680';
    diceMsgEl.textContent = '';
    renderAll();
    maybeComputerTurn();
  }

  function playAgain() {
    if (!game) return;
    var players = game.players.map(function (p) {
      return { name: p.name, isComputer: p.isComputer, color: p.color };
    });
    clearTimeout(computerTimer);
    game = L.createGame(players);
    el('winOverlay').classList.add('hidden');
    diceFaceEl.textContent = '\u2680';
    diceMsgEl.textContent = '';
    renderAll();
    maybeComputerTurn();
  }

  function newGame() {
    clearTimeout(computerTimer);
    game = null;
    el('winOverlay').classList.add('hidden');
    el('gameCard').classList.add('hidden');
    el('setupCard').classList.remove('hidden');
    rebuildSetup();
  }

  // ---- rendering ----
  function moveMessage(entry) {
    var parts = [];
    parts.push(t('rolled', { name: entry.player, n: fmt(entry.roll) }));
    if (entry.overshoot) {
      parts.push(t('overshoot', { n: fmt(100 - entry.from) }));
    } else {
      parts.push(t('movedTo', { n: fmt(entry.final) }));
      entry.events.forEach(function (ev) {
        parts.push(ev.type === 'ladder'
          ? t('climbed', { n: fmt(ev.to) })
          : t('slid', { n: fmt(ev.to) }));
      });
    }
    if (entry.extraTurn && !entry.won) parts.push(t('extraTurn'));
    return parts.join(' ');
  }

  function renderAll() {
    renderTurn();
    renderTokens();
    renderLog();
    renderStats();
  }

  function renderTurn() {
    if (!game) return;
    var p = game.players[game.current];
    turnDotEl.style.background = p.color;
    turnTextEl.textContent = game.winner
      ? t('wins', { name: game.winner })
      : t('turnOf', { name: p.name });
    rollBtn.disabled = rolling || !!game.winner || p.isComputer;
    rollBtn.textContent = p.isComputer ? t('computerThinking') : t('rollDice');
    playersRowEl.innerHTML = '';
    game.players.forEach(function (pl, i) {
      var chip = document.createElement('span');
      chip.className = 'player-chip' + (i === game.current && !game.winner ? ' active' : '')
        + (game.winner === pl.name ? ' winner' : '');
      var dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = pl.color;
      var label = document.createElement('span');
      label.textContent = pl.name + ' \u00B7 ' + (pl.pos === 0 ? t('atStart') : fmt(pl.pos))
        + ' \u00B7 ' + fmt(pl.moves) + ' ' + t('moves')
        + (pl.isComputer ? ' \u00B7 ' + t('computer') : '');
      chip.appendChild(dot);
      chip.appendChild(label);
      playersRowEl.appendChild(chip);
    });
  }

  function renderLog() {
    logListEl.innerHTML = '';
    if (!game || game.log.length === 0) {
      logEmptyEl.classList.remove('hidden');
      return;
    }
    logEmptyEl.classList.add('hidden');
    game.log.forEach(function (entry) {
      var li = document.createElement('li');
      li.textContent = moveMessage(entry);
      logListEl.appendChild(li);
    });
  }

  function renderStats() {
    el('gamesPlayedNum').textContent = fmt(stats.gamesPlayed);
    winsListEl.innerHTML = '';
    var names = Object.keys(stats.wins);
    if (names.length === 0) {
      statsEmptyEl.classList.remove('hidden');
      return;
    }
    statsEmptyEl.classList.add('hidden');
    names.sort(function (a, b) { return stats.wins[b] - stats.wins[a]; }).forEach(function (name) {
      var li = document.createElement('li');
      li.textContent = name + ': ' + fmt(stats.wins[name]) + ' ' + t('winsLabel');
      winsListEl.appendChild(li);
    });
  }

  function renderLegend() {
    ladderListEl.innerHTML = '';
    Object.keys(L.LADDERS).map(Number).sort(function (a, b) { return a - b; }).forEach(function (from) {
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.className = 'l';
      b.textContent = LADDER_EMOJI + ' ' + fmt(from) + ARROW + fmt(L.LADDERS[from]);
      li.appendChild(b);
      ladderListEl.appendChild(li);
    });
    snakeListEl.innerHTML = '';
    Object.keys(L.SNAKES).map(Number).sort(function (a, b) { return a - b; }).forEach(function (from) {
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.className = 's';
      b.textContent = SNAKE_EMOJI + ' ' + fmt(from) + ARROW + fmt(L.SNAKES[from]);
      li.appendChild(b);
      snakeListEl.appendChild(li);
    });
  }

  // ---- dice / turns ----
  function diceChar(n) { return String.fromCharCode(0x2680 + n - 1); }

  function doRoll() {
    if (!game || rolling || game.winner) return;
    var p = game.players[game.current];
    rolling = true;
    renderTurn();
    diceFaceEl.classList.add('rolling');
    diceMsgEl.textContent = t('rolling');
    var ticks = 0;
    var anim = setInterval(function () {
      diceFaceEl.textContent = diceChar(1 + Math.floor(Math.random() * 6));
      ticks++;
      if (ticks >= 6) {
        clearInterval(anim);
        var roll = L.rollDie();
        diceFaceEl.textContent = diceChar(roll);
        diceFaceEl.classList.remove('rolling');
        var res = L.applyRoll(game, roll);
        diceMsgEl.textContent = moveMessage(game.log[0]);
        rolling = false;
        if (res.won) {
          stats.gamesPlayed += 1;
          stats.wins[p.name] = (stats.wins[p.name] || 0) + 1;
          saveStats(stats);
          renderAll();
          showWin(p);
        } else {
          renderAll();
          maybeComputerTurn();
        }
      }
    }, 90);
  }

  function maybeComputerTurn() {
    clearTimeout(computerTimer);
    if (!game || game.winner) return;
    var p = game.players[game.current];
    if (p.isComputer) {
      computerTimer = setTimeout(doRoll, 900);
    }
  }

  function showWin(p) {
    el('winTitle').textContent = t('wins', { name: p.name });
    el('winDetail').textContent = fmt(p.moves) + ' ' + t('moves');
    el('winOverlay').classList.remove('hidden');
  }

  // ---- i18n ----
  function applyI18n() {
    document.documentElement.lang = (lang === 'bn') ? 'bn' : 'en';
    el('langBtn').textContent = t('langBtn');
    el('appTitle').textContent = t('appTitle');
    el('appSubtitle').textContent = t('appSubtitle');
    el('setupTitle').textContent = t('setupTitle');
    el('playersLabel').textContent = t('playersLabel');
    el('computerLabel').textContent = t('computerLabel');
    el('startBtn').textContent = t('startGame');
    el('legendTitle').textContent = t('ladders') + ' & ' + t('snakes');
    el('laddersTitle').textContent = t('ladders');
    el('snakesTitle').textContent = t('snakes');
    el('logTitle').textContent = t('moveLog');
    el('logEmpty').textContent = t('logEmpty');
    el('statsTitle').textContent = t('statsTitle');
    el('gamesPlayedLbl').textContent = t('gamesPlayed');
    el('statsEmpty').textContent = t('noWinsYet');
    el('resetStatsBtn').textContent = t('resetStats');
    el('newGameBtn').textContent = t('newGame');
    el('howToTitle').textContent = t('howToPlay');
    el('howToText').textContent = t('howToPlayText');
    el('footerText').textContent = t('footer');
    el('playAgainBtn').textContent = t('playAgain');
    el('winNewGameBtn').textContent = t('newGame');
    buildBoard();
    renderLegend();
    if (game) {
      diceMsgEl.textContent = game.log.length ? moveMessage(game.log[0]) : '';
      renderAll();
    } else {
      rebuildSetup();
      renderStats();
    }
  }

  // ---- wiring ----
  el('playerCount').addEventListener('change', rebuildSetup);
  el('computerCount').addEventListener('change', rebuildSetup);
  el('startBtn').addEventListener('click', startGame);
  rollBtn.addEventListener('click', doRoll);
  el('newGameBtn').addEventListener('click', newGame);
  el('winNewGameBtn').addEventListener('click', newGame);
  el('playAgainBtn').addEventListener('click', playAgain);
  el('resetStatsBtn').addEventListener('click', function () {
    if (window.confirm(t('confirmReset'))) {
      stats = { gamesPlayed: 0, wins: {} };
      saveStats(stats);
      renderStats();
    }
  });
  el('langBtn').addEventListener('click', function () {
    lang = (lang === 'en') ? 'bn' : 'en';
    try { localStorage.setItem(LANG_KEY, JSON.stringify(lang)); } catch (e) { /* ignore */ }
    applyI18n();
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && game && !game.winner && !rolling
        && !game.players[game.current].isComputer
        && !el('gameCard').classList.contains('hidden')) {
      e.preventDefault();
      doRoll();
    }
  });

  // Expose a tiny handle for the smoke test (read-only state inspection).
  window.SnakesLaddersApp = {
    getGame: function () { return game; },
    getLang: function () { return lang; },
    startWithPlayers: function (players) {
      game = L.createGame(players);
      el('setupCard').classList.add('hidden');
      el('gameCard').classList.remove('hidden');
      renderAll();
      return game;
    }
  };

  applyI18n();
})();
