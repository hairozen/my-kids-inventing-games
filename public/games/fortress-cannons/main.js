import { createGame, step, score } from './model.js';
import { createWorld } from './world.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
let game = createGame();
let world;
let mode = 'welcome';
let pendingYaw = 0;
let pendingGuard = false;
let dragging = false;
let lastPointerX = 0;
let lastEvent = 0;
let lastFrame = performance.now();
let toastUntil = 0;
let hitUntil = 0;
let musicOn = true;
const pressed = new Set();
let audio;
let musicTimer;
let noteIndex = 0;
const melody = [60, 64, 67, 72, 69, 67, 64, 62, 60, 64, 67, 76, 72, 69, 67, 64];

function note(midi, duration, volume, delay = 0) {
  if (!audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = 'sine';
  oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function updateMusic() {
  clearInterval(musicTimer);
  if (!musicOn || mode !== 'playing' || !audio) return;
  const playNote = () => {
    note(melody[noteIndex % melody.length], 1.2, 0.055);
    if (noteIndex % 4 === 0) note([48, 53, 45, 55][Math.floor(noteIndex / 4) % 4], 2.4, 0.028);
    noteIndex++;
  };
  playNote();
  musicTimer = setInterval(playNote, 560);
}
function enableAudio() {
  if (!musicOn) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio && !audio) audio = new Audio();
    audio?.resume().then(updateMusic).catch(() => {});
  } catch { /* Audio is optional; the game remains playable without it. */ }
}
function toast(text) {
  $('toast').textContent = text;
  toastUntil = performance.now() + 3400;
}
function clearInput() { pressed.clear(); pendingYaw = 0; pendingGuard = false; dragging = false; }
function setMode(next) {
  mode = next;
  $('welcome').hidden = next !== 'welcome';
  $('hud').hidden = !['playing', 'paused'].includes(next);
  $('pause').hidden = next !== 'playing';
  $('pause-screen').hidden = next !== 'paused';
  $('result-screen').hidden = next !== 'ended';
  clearInput();
  updateMusic();
}
function releaseMouse() { if (document.pointerLockElement === canvas) document.exitPointerLock(); }
function captureMouse() {
  canvas.focus({ preventScroll: true });
  try {
    const request = canvas.requestPointerLock?.();
    request?.catch(() => toast('אפשר לגרור את העכבר על העולם כדי להסתכל לצדדים'));
  } catch { toast('אפשר לגרור את העכבר על העולם כדי להסתכל לצדדים'); }
}
function startRound() {
  if (!world) return;
  game = createGame({ difficulty: document.querySelector('[name=difficulty]:checked').value });
  lastEvent = 0;
  noteIndex = 0;
  lastFrame = performance.now();
  setMode('playing');
  enableAudio();
  captureMouse();
  toast('אתה בכחולים! אסוף מפתח זהוב והבא אותו לשער מבצר.');
  renderHud();
}
function pause() {
  if (mode !== 'playing') return;
  setMode('paused');
  releaseMouse();
  audio?.suspend().catch(() => {});
  $('resume').focus();
}
function resume() {
  if (mode !== 'paused') return;
  setMode('playing');
  lastFrame = performance.now();
  enableAudio();
  captureMouse();
}
function finish() {
  setMode('ended');
  releaseMouse();
  const s = score(game);
  $('result-title').textContent = game.winner === 'draw' ? 'תיקו צבעוני!' : game.winner === 'blue' ? 'הכחולים ניצחו!' : 'האלמוגים ניצחו!';
  $('result-copy').textContent = game.winner === 'blue' ? 'הצלחתם לשמור על הכי הרבה מבצרים. כל הכבוד, צוות!' : game.winner === 'draw' ? 'לשתי הקבוצות אותו מספר מבצרים. עוד סיבוב?' : 'קרב הצבע נגמר. בסיבוב הבא אפשר לנסות דרך חדשה!';
  $('result-score').textContent = `כחולים ${s.blue} — ${s.coral} אלמוגים`;
  $('again').focus();
}
function renderHud() {
  const s = score(game);
  $('blue-score').textContent = s.blue;
  $('coral-score').textContent = s.coral;
  const seconds = Math.ceil(game.timeLeft);
  $('time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('heart-fill').style.clipPath = `inset(${100 * (1 - game.player.hp / game.player.maxHp)}% 0 0 0)`;
  $('health-value').textContent = `${game.player.hp} מתוך ${game.player.maxHp}`;
  $('health-label').textContent = game.player.invulnerable > 0 ? 'מוגן לרגע' : 'הלב שלך';
  $('key-status').textContent = game.player.hasKey ? '⚿ יש מפתח! אל שער המבצר' : '⚿ צריך מפתח';
  $('key-status').classList.toggle('ready', game.player.hasKey);
  const guardCount = game.guards.filter(g => g.team === 'blue').length;
  $('guard-status').textContent = guardCount >= 6 ? '♜ יש כבר 6 שומרים' : game.player.guardCharge ? '♜ Enter להצבת שומר' : '◎ עיגול זוהר נותן שומר';
  $('guard-status').classList.toggle('ready', Boolean(game.player.guardCharge));
  for (const fort of game.forts.filter(f => !f.home)) {
    let pill = document.getElementById(`status-${fort.id}`);
    if (!pill) { pill = document.createElement('span'); pill.id = `status-${fort.id}`; pill.className = 'fort-pill'; $('fort-status').append(pill); }
    pill.dataset.owner = fort.owner || 'neutral';
    pill.textContent = `${fort.owner === 'blue' ? '⚑' : fort.owner === 'coral' ? '⚑' : '◇'} ${fort.name}`;
    pill.setAttribute('aria-label', `${fort.name}: ${fort.owner === 'blue' ? 'כחול' : fort.owner === 'coral' ? 'אלמוג' : 'פנוי'}`);
  }
  const goals = game.player.hasKey ? game.forts.filter(f => !f.home && f.owner !== 'blue').map(f => ({ ...f, x: f.gateX, z: f.gateZ })) : game.keys;
  const target = [...goals].sort((a, b) => Math.hypot(a.x - game.player.x, a.z - game.player.z) - Math.hypot(b.x - game.player.x, b.z - game.player.z))[0];
  if (target) {
    const distance = Math.round(Math.hypot(target.x - game.player.x, target.z - game.player.z));
    const angle = Math.atan2(target.x - game.player.x, target.z - game.player.z) - game.player.yaw;
    $('objective-arrow').style.transform = `rotate(${angle}rad)`;
    $('objective-arrow').hidden = false;
    $('objective-text').textContent = `${game.player.hasKey ? `אל השער של ${target.name}` : 'אל המפתח הזהוב'} · ${distance} מטר`;
  } else {
    $('objective-arrow').hidden = true;
    $('objective-text').textContent = game.player.hasKey ? 'כל המבצרים כחולים! הגן עליהם עם הצוות.' : 'המפתחות אצל השחקנים. הגן על המבצרים עד שיופיע מפתח חדש.';
  }
}
function handleEvents() {
  for (const event of game.events) {
    if (event.id <= lastEvent) continue;
    lastEvent = event.id;
    if (event.type === 'key' && event.actorId === 'player') toast('מצאת מפתח! התקרב לשער של מבצר פנוי או יריב.');
    if (event.type === 'charge') toast('קיבלת שומר! לחץ Enter במקום שתרצה לשמור עליו.');
    if (event.type === 'guard') toast('השומר הוצב כאן. יש לו שלושה לבבות.');
    if (event.type === 'capture') {
      const fort = game.forts.find(f => f.id === event.fortId);
      toast(`${fort.name} ${event.team === 'blue' ? 'נצבע בכחול!' : 'עבר לאלמוגים!'}`);
      if (musicOn && event.team === 'blue') { note(72, .5, .07); note(79, .7, .05, .15); }
    }
    if (event.type === 'hit' && event.actorId === 'player') hitUntil = performance.now() + 180;
    if (event.type === 'respawn' && event.actorId === 'player') toast('חזרת הביתה והלב מלא. יוצאים שוב למבצרים!');
  }
}

$('start').addEventListener('click', startRound);
$('again').addEventListener('click', startRound);
$('restart-paused').addEventListener('click', startRound);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('change-difficulty').addEventListener('click', () => { setMode('welcome'); $('start').focus(); });
$('sound').addEventListener('click', () => {
  musicOn = !musicOn;
  $('sound').setAttribute('aria-pressed', String(musicOn));
  $('sound').setAttribute('aria-label', musicOn ? 'כיבוי מוזיקה' : 'הפעלת מוזיקה');
  $('sound').textContent = musicOn ? '♫ מוזיקה' : '♫ ללא מוזיקה';
  if (musicOn && mode === 'playing') enableAudio();
  else { clearInterval(musicTimer); audio?.suspend().catch(() => {}); }
  if (mode === 'playing') canvas.focus({ preventScroll: true });
});
document.addEventListener('keydown', event => {
  if (event.code === 'Escape') { if (mode === 'playing') pause(); return; }
  if (mode !== 'playing' || /^(BUTTON|INPUT|A)$/.test(event.target.tagName)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)) {
    event.preventDefault();
    pressed.add(event.code);
    if (event.code === 'Enter' && !event.repeat) {
      pendingGuard = true;
      if (!game.player.guardCharge) toast('קודם נכנסים לעיגול הזוהר כדי לקבל שומר.');
      else if (game.guards.filter(g => g.team === 'blue').length >= 6) toast('יש כבר שישה שומרים בקבוצה.');
    }
  }
});
document.addEventListener('keyup', event => pressed.delete(event.code));
canvas.addEventListener('pointerdown', event => {
  if (mode !== 'playing' || event.button !== 0) return;
  canvas.focus({ preventScroll: true });
  dragging = true;
  lastPointerX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
});
document.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
document.addEventListener('pointermove', event => {
  if (mode === 'playing' && dragging && document.pointerLockElement !== canvas) {
    pendingYaw += (event.clientX - lastPointerX) * 0.0027;
    lastPointerX = event.clientX;
  }
});
document.addEventListener('mousemove', event => { if (mode === 'playing' && document.pointerLockElement === canvas) pendingYaw += event.movementX * 0.0027; });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && mode === 'playing') pause(); });
document.addEventListener('pointerlockerror', () => { if (mode === 'playing') toast('גרור את העכבר על העולם כדי להסתכל לצדדים.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('resize', () => world?.resize());
window.addEventListener('pagehide', event => {
  pause();
  clearInterval(musicTimer);
  if (!event.persisted) { audio?.close(); world?.dispose(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) { lastFrame = performance.now(); world?.resize(); } });

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, .08);
  lastFrame = now;
  if (mode === 'playing') {
    step(game, dt, { forward: Number(pressed.has('ArrowUp')) - Number(pressed.has('ArrowDown')), strafe: Number(pressed.has('ArrowRight')) - Number(pressed.has('ArrowLeft')), yaw: pendingYaw, fire: pressed.has('Space'), placeGuard: pendingGuard });
    pendingYaw = 0;
    pendingGuard = false;
    handleEvents();
    renderHud();
    if (game.ended) finish();
  }
  $('toast').classList.toggle('visible', now < toastUntil && mode === 'playing');
  $('hit-flash').classList.toggle('active', now < hitUntil && mode === 'playing');
  world.render(game, mode === 'playing' ? dt : 0);
  requestAnimationFrame(frame);
}
try {
  world = createWorld(canvas, game);
  renderHud();
  requestAnimationFrame(frame);
} catch (error) {
  console.error('Fortress world could not start', error);
  $('welcome').hidden = true;
  $('error-screen').hidden = false;
}
