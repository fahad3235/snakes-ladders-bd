// Snakes & Ladders BD smoke tests - local QA harness, NOT pushed.
// Raw CDP over the stock Playwright headless_shell binary.
// Run: node tests/smoke.mjs
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PORT = 9337;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file://' + path.resolve(DIR, '..', 'index.html');

const proc = spawn(BIN, [
  '--headless', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT, '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

async function waitForVersion(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (r.ok) return await r.json();
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('CDP did not come up');
}

let seq = 0;
const pending = new Map();
let ws;
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 15000);
  });
}
async function ev(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('page eval threw: ' + JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let passed = 0;
function check(name, cond, extra = '') {
  if (!cond) throw new Error('FAIL: ' + name + ' ' + extra);
  passed++;
  console.log('ok - ' + name);
}

try {
  await waitForVersion();
  const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(PAGE), { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await once(ws, 'open');
  ws.addEventListener('message', (evt) => {
    const m = JSON.parse(evt.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(JSON.stringify(m.params.args).slice(0, 300));
    } else if (m.method === 'Network.loadingFailed') {
      failedRequests.push(JSON.stringify(m.params).slice(0, 200));
    } else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      failedRequests.push(m.params.response.url + ' -> ' + m.params.response.status);
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await sleep(1200);

  check('title renders', await ev(`document.getElementById('appTitle').textContent`) === 'Snakes & Ladders BD');
  check('setup screen visible, game hidden', await ev(`
    !document.getElementById('setupCard').classList.contains('hidden')
    && document.getElementById('gameCard').classList.contains('hidden')`));
  check('log empty state shows before start', await ev(`!document.getElementById('logEmpty').classList.contains('hidden')`));

  // Start a 4-player human game via the real UI.
  await ev(`document.getElementById('startBtn').click()`);
  await sleep(300);
  check('game screen visible after start', await ev(`!document.getElementById('gameCard').classList.contains('hidden')`));
  check('100 board cells present', await ev(`document.querySelectorAll('#board .cell').length`) === 100);
  check('board cell 1 is a ladder start (1 -> 38)', await ev(`
    (function(){ var c = document.querySelector('[data-cell="1"]');
      return c.classList.contains('ladder-start') && c.textContent.indexOf('38') !== -1; })()`));
  check('board cell 16 is a snake start (16 -> 6)', await ev(`
    (function(){ var c = document.querySelector('[data-cell="16"]');
      return c.classList.contains('snake-start') && c.textContent.indexOf('6') !== -1; })()`));
  check('legend lists 9 ladders', await ev(`document.querySelectorAll('#ladderList li').length`) === 9);
  check('legend lists 10 snakes', await ev(`document.querySelectorAll('#snakeList li').length`) === 10);
  check('turn indicator shows player 1', (await ev(`document.getElementById('turnText').textContent`)).includes('Player 1'));

  // Roll the dice via the real button; animation is 6 ticks x 90ms.
  await ev(`document.getElementById('rollBtn').click()`);
  await sleep(1200);
  const afterRoll = await ev(`({
    log: document.querySelectorAll('#logList li').length,
    tokens: document.querySelectorAll('#board .token').length,
    msg: document.getElementById('diceMsg').textContent,
    turn: document.getElementById('turnText').textContent
  })`);
  check('dice roll logs a move', afterRoll.log === 1, JSON.stringify(afterRoll));
  check('token appears on the board after roll', afterRoll.tokens >= 1, JSON.stringify(afterRoll));
  check('dice message describes the roll', afterRoll.msg.length > 0, JSON.stringify(afterRoll));
  check('turn passes to player 2 (or extra turn keeps player 1)', /Player [12]/.test(afterRoll.turn), JSON.stringify(afterRoll));

  // Space key rolls for the current human player.
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))`);
  await sleep(1200);
  check('Space key rolls the dice', await ev(`document.querySelectorAll('#logList li').length`) === 2);

  // EN -> BN toggle: title changes and Bengali digits appear on the board.
  await ev(`document.getElementById('langBtn').click()`);
  await sleep(300);
  const bnTitle = await ev(`document.getElementById('appTitle').textContent`);
  check('BN toggle changes title', bnTitle !== 'Snakes & Ladders BD' && bnTitle.length > 0, bnTitle);
  check('BN mode shows Bengali digits on board', await ev(`
    /[\\u09E6-\\u09EF]/.test(document.querySelector('[data-cell="1"] .num').textContent)`));
  check('BN lang persisted', await ev(`localStorage.getItem('snakes-ladders-bd-lang')`) === '"bn"');
  const rollLabelBn = await ev(`document.getElementById('rollBtn').textContent`);
  check('BN roll button label changes', rollLabelBn.length > 0 && rollLabelBn !== 'Roll dice', rollLabelBn);
  // Toggle back to English for a clean state.
  await ev(`document.getElementById('langBtn').click()`);
  await sleep(200);

  // 390px mobile: no horizontal overflow.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(400);
  check('390px no horizontal overflow', await ev(`document.documentElement.scrollWidth <= 390`), 'scrollWidth=' + await ev(`document.documentElement.scrollWidth`));

  check('0 page errors', pageErrors.length === 0, pageErrors.join('; '));
  check('0 console errors', consoleErrors.length === 0, consoleErrors.join('; '));
  check('0 failed requests', failedRequests.length === 0, failedRequests.join('; '));

  console.log(passed + ' smoke tests passed');
} finally {
  try { ws && ws.close(); } catch (e) {}
  proc.kill();
}
process.exit(0);
