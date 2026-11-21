import { RACERS, TRACK_LENGTH, createRace, startRace, stepRace } from './model.js';
import { createWorld } from './world.js';
import { princessSvg } from './portraits.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const fireworksCanvas = $('fireworks');
const fx = fireworksCanvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const controls = { left: false, right: false, jump: false, sprint: false };
const keys = new Set();
const pointers = new Map();
const codeMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', Space: 'sprint' };
let race = createRace();
let world;
let paused = false;
let last = 0;
let width = 1000;
let height = 650;
let finishedAt = 0;
let pendingJump = false;

$('portraits').innerHTML = RACERS.map(racer => '<div class="portrait">' + princessSvg(racer.id) + '<b>' + racer.name + '</b><small>' + (racer.id === 'belle' ? 'זאת את ♡' : 'חברה למרוץ') + '</small></div>').join('');

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  fireworksCanvas.width = Math.round(width * dpr);
  fireworksCanvas.height = Math.round(height * dpr);
  fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  world?.resize();
}
function syncControls() {
  const held = new Set([...keys, ...pointers.values()]);
  for (const name of Object.keys(controls)) controls[name] = held.has(name);
  document.querySelectorAll('[data-control]').forEach(button => {
    const active = controls[button.dataset.control];
    button.classList.toggle('pressed', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function clearControls() {
  keys.clear();
  pointers.clear();
  pendingJump = false;
  race.jumpHeld = false;
  syncControls();
  for (const racer of race.racers) racer.sprinting = false;
}
function focusWorld() { canvas.focus({ preventScroll: true }); }
function begin() {
  if (!world) return;
  clearControls();
  race = createRace();
  startRace(race);
  paused = false;
  finishedAt = 0;
  last = 0;
  fx.clearRect(0, 0, width, height);
  $('intro').hidden = true;
  $('finish').hidden = true;
  $('paused').hidden = true;
  document.querySelector('.hud').hidden = false;
  document.body.dataset.phase = 'racing';
  $('announcement').textContent = 'המרוץ התחיל! חיצים לתנועה ורווח לספרינט.';
  updateHud();
  focusWorld();
}
function pause() {
  if (race.phase !== 'racing' || paused) return;
  clearControls();
  paused = true;
  document.body.dataset.phase = 'paused';
  updateHud();
  $('paused').hidden = false;
  $('status').hidden = true;
  $('resume').focus({ preventScroll: true });
}
function resume() {
  if (!paused || race.phase !== 'racing') return;
  clearControls();
  paused = false;
  document.body.dataset.phase = 'racing';
  $('paused').hidden = true;
  last = 0;
  focusWorld();
}
$('start').addEventListener('click', begin);
$('replay').addEventListener('click', begin);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('restart').addEventListener('click', begin);
$('retry').addEventListener('click', () => location.reload());
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

window.addEventListener('keydown', event => {
  if (event.code === 'Escape') { if (paused) resume(); else pause(); return; }
  if (race.phase !== 'racing' || paused || !(event.code in codeMap)) return;
  if (/^(BUTTON|INPUT|A)$/.test(event.target.tagName)) return;
  event.preventDefault();
  const control = codeMap[event.code];
  keys.add(control);
  if (control === 'jump' && !event.repeat) pendingJump = true;
  syncControls();
});
window.addEventListener('keyup', event => {
  if (!(event.code in codeMap)) return;
  keys.delete(codeMap[event.code]);
  syncControls();
  if (race.phase === 'racing' && !paused) event.preventDefault();
});
for (const button of document.querySelectorAll('[data-control]')) {
  button.addEventListener('pointerdown', event => {
    if (race.phase !== 'racing' || paused) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button.dataset.control);
    if (button.dataset.control === 'jump') pendingJump = true;
    syncControls();
    focusWorld();
  });
  const release = event => { pointers.delete(event.pointerId); syncControls(); };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('keydown', event => {
    if (race.phase !== 'racing' || paused || !['Enter', 'Space'].includes(event.code)) return;
    event.preventDefault();
    pointers.set(button, button.dataset.control);
    if (button.dataset.control === 'jump' && !event.repeat) pendingJump = true;
    syncControls();
  });
  button.addEventListener('keyup', () => { pointers.delete(button); syncControls(); });
  button.addEventListener('blur', () => { pointers.delete(button); syncControls(); });
}

function updateHud() {
  const player = race.racers.find(racer => racer.id === 'belle');
  const ranking = [...race.racers].sort((a, b) => b.distance - a.distance);
  $('rank-number').textContent = ranking.findIndex(racer => racer.id === 'belle') + 1;
  const pct = Math.min(100, Math.floor(player.distance / TRACK_LENGTH * 100));
  $('percent').textContent = pct + '%';
  $('progress').style.width = pct + '%';
  const elapsed = Math.floor(race.elapsed);
  $('race-time').textContent = Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0');
  $('distance-left').textContent = Math.ceil(TRACK_LENGTH - player.distance).toLocaleString('he-IL') + ' מטר לארמון';
  $('district').textContent = player.distance < 400 ? 'גני הוורדים' : player.distance < 800 ? 'הטיילת ליד האגם' : 'שדרת הארמון';
  $('boost-state').textContent = player.sprinting ? '✦ ספרינט!' : 'רווח · ספרינט';
  $('boost-state').classList.toggle('boosting', player.sprinting);
  const status = player.slowRemaining > 0 ? 'אופס! עוד רגע חוזרת לרוץ' : player.sprinting ? '✦ ריצה מהירה! קדימה לארמון!' : '';
  $('status').hidden = !status;
  $('status').textContent = status;
}
function finish(now) {
  clearControls();
  finishedAt = now;
  const winner = race.winner;
  if (!winner) return;
  $('winner-name').textContent = winner.name + ' ניצחה!';
  const elapsed = Math.floor(race.elapsed);
  $('winner-message').textContent = winner.id === 'belle' ? 'הגעת ראשונה אחרי מרוץ שלם בגני הארמון!' : 'מחיאות כפיים למנצחת! במרוץ הבא אפשר לעקוף בעזרת ספרינט.';
  $('finish-time').textContent = 'זמן המרוץ ' + Math.floor(elapsed / 60) + ':' + String(elapsed % 60).padStart(2, '0') + ' · מסלול של 1,200 מטר';
  $('winner-art').innerHTML = princessSvg(winner.id);
  $('finish').hidden = false;
  $('status').hidden = true;
  document.querySelector('.hud').hidden = true;
  document.body.dataset.phase = 'finished';
  $('announcement').textContent = winner.name + ' ניצחה!';
  $('replay').focus({ preventScroll: true });
}
function fireworks(now) {
 fx.clearRect(0,0,width,height);
 const t=(now-finishedAt)/1000;
 const centers=[[.12,.2],[.86,.18],[.07,.65],[.94,.64],[.3,.08],[.69,.09],[.22,.88],[.78,.87]];
 for(let n=0;n<centers.length;n++) {
  const [px,py]=centers[n], cx=width*px,cy=height*py;
  const local=reducedMotion?.8:((t+n*.37)%2.6);
  if(local>1.8)continue;
  const radius=Math.min(width*.16,95)*(reducedMotion?.8:Math.min(1,local/.65));
  const alpha=reducedMotion?.85:Math.max(0,1-local/1.8);
  const colors=['#dc6d9a','#d5a12f','#388f73','#9975c8','#e59058'];
  fx.globalAlpha=alpha;fx.lineCap='round';
  for(let j=0;j<22;j++) {
   const angle=j/22*Math.PI*2, outer=radius*(j%2?.85:1),inner=outer*(reducedMotion?.72:.65);
   const drop=reducedMotion?0:local*local*12;
   fx.strokeStyle=colors[(n+j%2)%colors.length];fx.lineWidth=j%2?2:3;
   fx.beginPath();fx.moveTo(cx+Math.cos(angle)*inner,cy+Math.sin(angle)*inner+drop);fx.lineTo(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer+drop);fx.stroke();
   fx.fillStyle='#fff1b0';fx.beginPath();fx.arc(cx+Math.cos(angle)*outer,cy+Math.sin(angle)*outer+drop,2,0,Math.PI*2);fx.fill();
  }
  if(local<.3||reducedMotion){fx.fillStyle='#ffe8a0';fx.beginPath();fx.arc(cx,cy,3,0,Math.PI*2);fx.fill();}
 }
 fx.globalAlpha=1;
}
function frame(now) {
  const dt = last ? Math.max(0, Math.min((now - last) / 1000, .08)) : 0;
  last = now;
  if (race.phase === 'racing' && !paused) {
    const elapsed = race.elapsed;
    stepRace(race, { ...controls, jump: controls.jump || pendingJump }, dt);
    if (race.elapsed > elapsed) pendingJump = false;
    updateHud();
    if (race.phase === 'finished') finish(now);
  }
  world.render(race, { now, paused, sprinting: controls.sprint && race.phase === 'racing' && !paused });
  if (race.phase === 'finished') fireworks(now);
  requestAnimationFrame(frame);
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('pagehide', event => {
  pause();
  if (!event.persisted) world?.dispose();
});
window.addEventListener('pageshow', event => { if (event.persisted) { last = 0; resize(); } });
try {
  world = createWorld(canvas, race);
  resize();
  $('start').disabled = false;
  requestAnimationFrame(frame);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__princessRace = {
      get race() { return race; },
      get paused() { return paused; },
      get controls() { return { ...controls }; },
    };
  }
} catch (error) {
  console.error('Princess race could not start', error);
  $('intro').hidden = true;
  $('error').hidden = false;
}
