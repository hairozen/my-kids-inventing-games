import { createGame, step, score, TEAMS } from './model.js';
import { createWorld } from './world.js';
import { createMinimap } from './minimap.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
const minimap = createMinimap($('minimap'));
let game = createGame();
let world;
let mode = 'welcome';
let lastFrame = performance.now();
let lastEvent = 0;
let toastUntil = 0;
let hitUntil = 0;
let pointerTarget = null;
let pointerShot = null;
let pendingShot = false;
let musicOn = true;
let audio;
let musicTimer;
let noteIndex = 0;
const pressed = new Set();
const touchHeld = new Map();
const melody = [60, 64, 67, 72, 69, 67, 64, 62, 60, 64, 67, 76, 72, 69, 67, 64];
const movementCodes = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const teamText = team => TEAMS[team].symbol + ' ' + TEAMS[team].name;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function note(midi, duration, volume, delay = 0) {
  if (!audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = 'sine';
  oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + .06);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .05);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function updateMusic() {
  clearInterval(musicTimer);
  if (!musicOn || mode !== 'playing' || !audio) return;
  const play = () => {
    note(melody[noteIndex % melody.length], 1.2, .045);
    if (noteIndex % 4 === 0) note([48, 53, 45, 55][Math.floor(noteIndex / 4) % 4], 2.4, .025);
    noteIndex++;
  };
  play();
  musicTimer = setInterval(play, 560);
}
function enableAudio() {
  if (!musicOn) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio && !audio) audio = new Audio();
    audio?.resume().then(updateMusic).catch(() => {});
  } catch { /* Sound is optional. */ }
}
function toast(text) {
  $('toast').textContent = text;
  toastUntil = performance.now() + 3300;
}
function clearInput() {
  pressed.clear();
  touchHeld.clear();
  pointerShot = null;
  pendingShot = false;
  pointerTarget = null;
  document.querySelectorAll('.touch-controls .active').forEach(button => button.classList.remove('active'));
}
function setMode(next) {
  mode = next;
  document.body.dataset.mode = next;
  $('welcome').hidden = next !== 'welcome';
  $('hud').hidden = !['playing', 'paused'].includes(next);
  $('touch-controls').hidden = next !== 'playing';
  $('pause').hidden = next !== 'playing';
  $('pause-screen').hidden = next !== 'paused';
  $('result-screen').hidden = next !== 'ended';
  clearInput();
  updateMusic();
}
function focusWorld() { canvas.focus({ preventScroll: true }); }
function startRound() {
  if (!world) return;
  game = createGame({ difficulty: document.querySelector('[name=difficulty]:checked').value });
  lastEvent = 0;
  noteIndex = 0;
  hitUntil = 0;
  lastFrame = performance.now();
  setMode('playing');
  enableAudio();
  focusWorld();
  toast('אתה בירוקים ● זזים אל מגדל ומשפריצים עליו צבע!');
  renderHud();
}
function pause() {
  if (mode !== 'playing') return;
  setMode('paused');
  audio?.suspend().catch(() => {});
  $('resume').focus({ preventScroll: true });
}
function resume() {
  if (mode !== 'paused') return;
  setMode('playing');
  lastFrame = performance.now();
  enableAudio();
  focusWorld();
}
function finish() {
  setMode('ended');
  audio?.suspend().catch(() => {});
  const won = game.winner === 'green';
  $('result-title').textContent = game.winner === 'draw' ? 'תיקו צבעוני!' : TEAMS[game.winner].name + ' ניצחו!';
  $('result-copy').textContent = won ? 'המגדלים שלכם והצבע בכל מקום. ניצחון של הקבוצה!' : game.winner === 'draw' ? 'לקבוצות המובילות אותו מספר מגדלים. עוד סיבוב יכריע?' : 'הפעם המגדלים החליפו ידיים. בסיבוב הבא אפשר להפתיע!';
  $('result-score').replaceChildren(...Object.entries(score(game)).map(([team, value]) => {
    const item = document.createElement('span');
    item.dataset.team = team;
    item.textContent = teamText(team);
    const number = document.createElement('b');
    number.textContent = value;
    item.append(number);
    return item;
  }));
  $('again').focus({ preventScroll: true });
}
function ensureStatus(container, id, className, markup) {
  let item = $(id);
  if (!item) {
    item = document.createElement('div');
    item.id = id;
    item.className = className;
    item.innerHTML = markup;
    $(container).append(item);
  }
  return item;
}
function renderHud() {
  const s = score(game);
  for (const team of Object.keys(TEAMS)) $(team + '-score').textContent = s[team];
  const seconds = Math.ceil(game.timeLeft);
  $('time').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  $('health-value').textContent = game.player.hp + ' מתוך ' + game.player.maxHp;
  $('health-label').textContent = game.player.invulnerable > 0 ? 'מוגן לרגע · יוצאים שוב!' : 'עוד כמה פגיעות עד חזרה';
  $('health-pips').textContent = Array.from({ length: game.player.maxHp }, (_, i) => i < game.player.hp ? '●' : '○').join(' ');
  for (const fort of game.forts) {
    const item = ensureStatus('fort-status', 'status-' + fort.id, 'fort-pill', '<b></b><small></small><i data-progress></i>');
    item.dataset.owner = fort.owner;
    item.querySelector('b').textContent = TEAMS[fort.owner].symbol + ' ' + fort.name;
    item.querySelector('small').textContent = fort.captureTeam ? 'צובעים: ' + teamText(fort.captureTeam) + ' ' + Math.round(fort.captureProgress * 100) + '%' : TEAMS[fort.owner].name;
    item.querySelector('[data-progress]').style.width = Math.round(fort.captureProgress * 100) + '%';
    item.setAttribute('aria-label', fort.name + ': ' + teamText(fort.owner));
  }
  for (const cannon of game.cannons) {
    const item = ensureStatus('cannon-status', 'status-' + cannon.id, 'cannon-card', '<b></b><small></small><span class="ammo-track"><i></i></span>');
    item.dataset.owner = cannon.owner;
    item.querySelector('b').textContent = TEAMS[cannon.owner].symbol + ' ' + cannon.name;
    item.querySelector('small').textContent = cannon.captureTeam ? 'צובעים: ' + teamText(cannon.captureTeam) + ' ' + Math.round(cannon.captureProgress * 100) + '%' : TEAMS[cannon.owner].name + ' · צבע ' + Math.round(cannon.ammo) + '%';
    item.querySelector('.ammo-track i').style.width = cannon.ammo + '%';
  }
  const refill = game.cannons.filter(c => c.owner === 'green' && c.ammo < 30).sort((a, b) => distance(a, game.player) - distance(b, game.player))[0];
  const target = [...game.forts.filter(f => f.owner !== 'green')].sort((a, b) => distance(a, game.player) - distance(b, game.player))[0];
  if (refill && distance(refill, game.player) < 15) $('objective-text').textContent = 'משפריצים על ' + refill.name + ' כדי למלא צבע';
  else if (target) $('objective-text').textContent = 'צובעים את ' + target.name + ' · ' + Math.round(distance(target, game.player)) + ' מטר';
  else $('objective-text').textContent = 'כל המגדלים שלנו! מגינים עד סוף הסיבוב';
}
function handleEvents() {
  for (const event of game.events) {
    if (event.id <= lastEvent) continue;
    lastEvent = event.id;
    if (event.type === 'capture') {
      const fort = game.forts.find(f => f.id === event.fortId);
      toast(fort.name + ' עבר לקבוצת ' + teamText(event.team) + '!');
      if (musicOn && event.team === 'green') { note(72, .5, .07); note(79, .7, .05, .15); }
    }
    if (event.type === 'cannon') {
      const cannon = game.cannons.find(c => c.id === event.cannonId);
      toast(cannon.name + ' מגן עכשיו על ' + teamText(event.team));
    }
    if (event.type === 'hit' && event.actorId === 'player') hitUntil = performance.now() + 180;
    if (event.type === 'respawn' && event.actorId === 'player') toast(score(game).green ? 'חזרת למגדל הקרוב עם צבע חדש. יוצאים שוב!' : 'חזרת למרכז. אפשר לקחת את המגדלים בחזרה!');
  }
}
$('start').addEventListener('click', startRound);
$('again').addEventListener('click', startRound);
$('restart-paused').addEventListener('click', startRound);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('reload').addEventListener('click', () => location.reload());
$('change-difficulty').addEventListener('click', () => { setMode('welcome'); $('start').focus(); });
$('sound').addEventListener('click', () => {
  musicOn = !musicOn;
  $('sound').setAttribute('aria-pressed', String(musicOn));
  $('sound').setAttribute('aria-label', musicOn ? 'כיבוי מוזיקה' : 'הפעלת מוזיקה');
  $('sound').textContent = musicOn ? '♫ מוזיקה' : '♫ ללא מוזיקה';
  if (musicOn && mode === 'playing') enableAudio();
  else { clearInterval(musicTimer); audio?.suspend().catch(() => {}); }
  if (mode === 'playing') focusWorld();
});
document.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
    return;
  }
  if (mode !== 'playing' || /^(BUTTON|INPUT|A)$/.test(event.target.tagName)) return;
  if (movementCodes.has(event.code) || event.code === 'Space') {
    event.preventDefault();
    pressed.add(event.code);
    if (event.code === 'Space' && !event.repeat) pendingShot = true;
    if (movementCodes.has(event.code) && !event.repeat && pointerShot === null) pointerTarget = null;
  }
});
document.addEventListener('keyup', event => pressed.delete(event.code));
canvas.addEventListener('pointermove', event => {
  if (mode === 'playing' && (event.pointerType === 'mouse' || pointerShot === event.pointerId)) pointerTarget = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerdown', event => {
  if (mode !== 'playing' || event.button !== 0) return;
  event.preventDefault();
  focusWorld();
  pointerTarget = { x: event.clientX, y: event.clientY };
  pointerShot = event.pointerId;
  pendingShot = true;
  canvas.setPointerCapture(event.pointerId);
});
function releasePointer(event) {
  if (pointerShot === event.pointerId) pointerShot = null;
  const held = touchHeld.get(event.pointerId);
  if (held) held.button.classList.remove('active');
  touchHeld.delete(event.pointerId);
}
document.addEventListener('pointerup', releasePointer);
document.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);
for (const button of document.querySelectorAll('[data-move],#spray')) {
  button.addEventListener('pointerdown', event => {
    if (mode !== 'playing') return;
    event.preventDefault();
    pointerTarget = null;
    button.setPointerCapture(event.pointerId);
    touchHeld.set(event.pointerId, { direction: button.dataset.move || 'fire', button });
    if (button.id === 'spray') pendingShot = true;
    button.classList.add('active');
    focusWorld();
  });
  button.addEventListener('lostpointercapture', releasePointer);
  button.addEventListener('contextmenu', event => event.preventDefault());
  // Keyboard users can also activate the labelled on-screen buttons.
  button.addEventListener('keydown', event => {
    if (mode !== 'playing' || !['Space', 'Enter'].includes(event.code)) return;
    event.preventDefault();
    pointerTarget = null;
    touchHeld.set(button, { direction: button.dataset.move || 'fire', button });
    if (button.id === 'spray' && !event.repeat) pendingShot = true;
    button.classList.add('active');
  });
  button.addEventListener('keyup', () => { touchHeld.delete(button); button.classList.remove('active'); });
  button.addEventListener('blur', () => { touchHeld.delete(button); button.classList.remove('active'); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('resize', () => { world?.resize(); minimap.resize(); });
window.addEventListener('pagehide', event => {
  pause();
  clearInterval(musicTimer);
  if (!event.persisted) { audio?.close(); world?.dispose(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) { lastFrame = performance.now(); world?.resize(); } });
function frame(now) {
  const dt = Math.max(0, Math.min((now - lastFrame) / 1000, .08));
  lastFrame = now;
  if (mode === 'playing') {
    const held = new Set([...touchHeld.values()].map(item => item.direction));
    const moveX = Number(pressed.has('ArrowRight') || pressed.has('KeyD') || held.has('right')) - Number(pressed.has('ArrowLeft') || pressed.has('KeyA') || held.has('left'));
    const moveZ = Number(pressed.has('ArrowUp') || pressed.has('KeyW') || held.has('up')) - Number(pressed.has('ArrowDown') || pressed.has('KeyS') || held.has('down'));
    const target = pointerTarget ? world.pointAt(pointerTarget.x, pointerTarget.y) : null;
    const aimYaw = target ? Math.atan2(target.x - game.player.x, target.z - game.player.z) : undefined;
    step(game, dt, { moveX, moveZ, aimYaw, fire: pendingShot || pressed.has('Space') || pointerShot !== null || held.has('fire') });
    pendingShot = false;
    handleEvents();
    renderHud();
    if (game.ended) finish();
  }
  $('toast').classList.toggle('visible', now < toastUntil && mode === 'playing');
  $('hit-flash').classList.toggle('active', now < hitUntil && mode === 'playing');
  world.render(game, mode === 'playing' ? dt : 0);
  if (mode === 'playing' || mode === 'paused') minimap.render(game, world.getViewBounds?.());
  requestAnimationFrame(frame);
}
try {
  world = createWorld(canvas, game);
  renderHud();
  $('start').disabled = false;
  requestAnimationFrame(frame);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__fortressCannons = {
      get game() { return game; }, get mode() { return mode; },
      get audioState() { return audio?.state || 'unavailable'; },
      pointAt: (x, y) => world.pointAt(x, y),
      viewBounds: () => world.getViewBounds?.(),
    };
  }
} catch (error) {
  console.error('Fortress world could not start', error);
  $('welcome').hidden = true;
  $('error-screen').hidden = false;
}
