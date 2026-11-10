import { createWorld } from './world.js';
import { POWERS, CHARACTERS, createRace, stepRace, getStandings } from './simulation.js';

const $ = id => document.getElementById(id);
const show = (id, yes) => $(id).classList.toggle('hidden', !yes);
const names = Object.fromEntries(CHARACTERS.map(c => [c.id, c.name]));
const powerById = Object.fromEntries(POWERS.map(p => [p.id, p]));
const symbols = {flight:'🪽',speed:'ϟ',sand:'≋',ice:'❄',stun:'✧'};
const hints = {
  flight:'קיר בדרך? רווח כדי לעוף מעליו',
  speed:'השער נסגר! רווח כדי להאיץ דרכו',
  sand:'חול טובעני לפניכם · רווח למעבר בטוח',
  ice:'מים בדרך · רווח ליצירת גשר קרח',
  stun:'מישהו חוסם את הדרך · רווח לקסם ״שתק״'
};
let world, state = null, selected = 'harry', drawn = null, paused = false, screen = 'menu';
let drawGeneration = 0, toastUntil = 0, lastTime = performance.now(), lastHud = 0, lastPhase = '';
const held = {left:false, right:false}, pulses = {jump:false, cast:false};
let audio = null, soundOn = true;

// Portraits share the same recognizable silhouette as the original 3D models.
function portrait(id) {
  const hair = id==='harry'?'#1c2230':id==='ron'?'#bd602c':'#775038';
  if(id==='hermione')return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="48" r="43" fill="#e8c68d" opacity=".08"/>
    <path d="M27 23Q16 30 19 44Q9 52 17 63Q10 74 23 82Q17 95 35 96H68Q84 90 77 79Q91 71 82 59Q91 47 80 38Q82 18 60 13Q38 7 27 23Z" fill="#63432f"/>
    <path d="M19 100Q23 76 50 75Q77 76 81 100" fill="#252b3d"/>
    <path d="M36 76L50 86L64 76L58 99H41Z" fill="#e2d7c3"/>
    <ellipse cx="50" cy="46" rx="21" ry="27" fill="#edbc99"/>
    <path d="M27 44Q20 24 38 16Q57 7 72 23Q80 35 72 47L65 36Q62 24 54 22Q47 35 29 39Z" fill="#775038"/>
    <path d="M29 35Q22 44 27 55Q20 64 28 73Q21 81 30 90M72 35Q80 46 74 57Q82 66 74 76Q80 85 71 93" fill="none" stroke="#956747" stroke-width="8" stroke-linecap="round"/>
    <path d="M34 43Q39 39 44 42M56 42Q61 39 66 43" fill="none" stroke="#71503c" stroke-width="1.8" stroke-linecap="round"/>
    <g fill="#573b2c"><ellipse cx="40" cy="48" rx="3" ry="3.5"/><ellipse cx="60" cy="48" rx="3" ry="3.5"/></g>
    <g fill="#fff1db"><circle cx="40.9" cy="46.8" r="1"/><circle cx="60.9" cy="46.8" r="1"/></g>
    <path d="M36 47L34 45M64 47L66 45M44 60Q50 66 56 60" fill="none" stroke="#7d5140" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M32 75Q50 86 68 75L65 85Q48 96 32 84Z" fill="#8c3548"/>
    <path d="M39 79L41 87M49 82L51 90M59 80L61 88" stroke="#d6ac63" stroke-width="4"/>
  </svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="48" r="43" fill="#e8c68d" opacity=".08"/><path d="M17 98q3-30 33-30t33 30" fill="#202638"/><path d="m37 71 13 13 13-13-3 27H40z" fill="#ddd1b8"/><path d="m45 78 5 7-4 13h10l-4-13 4-7" fill="#87384a"/><path d="M27 67q-9-30 6-46t35 0q14 15 5 46" fill="${hair}"/><ellipse cx="50" cy="45" rx="24" ry="29" fill="#edbc99"/><path d="M26 35q-3-22 24-24 31 0 25 29L64 29l-8 7-9-8-9 8-3-6z" fill="${hair}"/>${id==='hermione'?'<path d="M29 19q-20 4-14 22-12 16 2 21-7 18 13 19l6-16-8-15 5-18M70 19q20 4 14 22 12 16-2 21 7 18-13 19l-6-16 8-15-5-18" fill="#775038"/>':''}<circle cx="41" cy="46" r="2.5" fill="#29303b"/><circle cx="59" cy="46" r="2.5" fill="#29303b"/><path d="M44 59q6 5 12 0" fill="none" stroke="#a36d57" stroke-width="2" stroke-linecap="round"/>${id==='harry'?'<g fill="none" stroke="#303039" stroke-width="2.3"><circle cx="39" cy="46" r="9"/><circle cx="61" cy="46" r="9"/><path d="M48 45h4m-22-1-5-2m45 2 5-2"/></g><path d="m59 25-4 7h5l-5 7" fill="none" stroke="#a15e50" stroke-width="1.8"/>':''}${id==='ron'?'<g fill="#b97546"><circle cx="31" cy="52" r="1"/><circle cx="35" cy="54" r="1"/><circle cx="39" cy="53" r="1"/><circle cx="61" cy="53" r="1"/><circle cx="65" cy="54" r="1"/><circle cx="69" cy="52" r="1"/></g>':''}<path d="M32 74q18 13 36 0l-3 10q-16 11-33-2z" fill="#8c3548"/><path d="m39 78 2 8m8-5 2 8m8-10 2 8" stroke="#d6ac63" stroke-width="4"/></svg>`;
}

$('characters').innerHTML = CHARACTERS.map((c,i) => `<button class="character-card" data-character="${c.id}" aria-pressed="${c.id===selected}" aria-label="בחירה ב${c.name}"><span class="selected-check">✓</span>${portrait(c.id)}<strong>${c.name}</strong><small>${['האומץ שבקסם','הקסם שבחוכמה','הלב שבהרפתקה'][i]}</small></button>`).join('');
$('characters').addEventListener('click', e => {
  const button = e.target.closest('[data-character]');
  if (!button) return;
  selected = button.dataset.character;
  document.querySelectorAll('[data-character]').forEach(b => b.setAttribute('aria-pressed', b===button));
  unlockAudio(); tone(440,.07,.025);
});

function unlockAudio() {
  if (!soundOn) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if(audio.state==='suspended') audio.resume(); } catch { /* Audio is optional. */ }
}
function tone(frequency=600, duration=.13, volume=.035, type='sine') {
  if (!soundOn || !audio || audio.state!=='running') return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency*1.4,audio.currentTime+duration);
  gain.gain.setValueAtTime(volume,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime+duration);
}
$('sound').onclick = () => { soundOn=!soundOn; $('sound').textContent=soundOn?'♫':'♪'; $('sound').setAttribute('aria-label',soundOn?'השתקת צלילים':'הפעלת צלילים'); $('sound').style.opacity=soundOn?'1':'.45'; if(soundOn){unlockAudio();tone();} };

function clearInput() { held.left=held.right=pulses.jump=pulses.cast=false; }
function resetMenu() {
  drawGeneration++; state=null; drawn=null; paused=false; screen='menu'; clearInput();
  document.body.classList.remove('playing');
  ['hud','power-screen','result-screen','pause-screen','countdown','pause','toast','battle-panel'].forEach(id=>show(id,false));
  show('menu',true); show('footer',true); $('chapter').textContent='ההרפתקה מתחילה כאן'; lastPhase='';
  $('draw').focus({preventScroll:true});
}
function setPowerPreview(power) {
  $('power-orbit').textContent=symbols[power.id]; $('power-orbit').style.color=power.color;
  $('power-title').textContent=power.name; $('power-description').textContent=power.description;
}
$('draw').onclick = () => {
  unlockAudio(); screen='draw'; show('menu',false); show('power-screen',true); show('footer',false);
  show('start',false); show('power-note',false); $('power-orbit').classList.add('drawing');
  const generation=++drawGeneration;
  drawn=POWERS[Math.floor(Math.random()*POWERS.length)];
  let n=0;
  function roll(){
    if(generation!==drawGeneration)return;
    setPowerPreview(POWERS[n++%POWERS.length]);tone(350+n*20,.05,.02);
    if(n<13)setTimeout(roll,55+n*6);
    else {setPowerPreview(drawn);$('power-orbit').classList.remove('drawing');show('start',true);show('power-note',true);tone(720,.35,.045);$('start').focus();}
  }
  roll();
};
$('back-menu').onclick=resetMenu;
$('start').onclick=()=>{
  if(!drawn)return;
  state=createRace({playerId:selected,power:drawn.id,seed:Math.floor(Math.random()*2**32)});
  screen='race'; paused=false; clearInput(); lastTime=performance.now();
  show('power-screen',false);show('hud',true);show('pause',true);show('countdown',true);
  document.body.classList.add('playing');$('chapter').textContent='המרוץ אל שערי הטירה';
  $('hud-power-icon').textContent=symbols[drawn.id];$('hud-power-icon').style.color=drawn.color;$('hud-power-name').textContent=drawn.name;
  $('race-markers').innerHTML=CHARACTERS.map(c=>`<span id="marker-${c.id}" class="race-marker ${c.id===selected?'player':''}" title="${c.name}" style="background:${c.color}"></span>`).join('');
  document.activeElement?.blur();
};
function togglePause(force) {
  if(!state||state.phase==='finished')return;
  paused=typeof force==='boolean'?force:!paused;clearInput();show('pause-screen',paused);
  $('pause').setAttribute('aria-label',paused?'המשך משחק':'השהיית המשחק');lastTime=performance.now();
  if(paused)$('resume').focus();else document.activeElement?.blur();
}
$('pause').onclick=()=>togglePause();$('resume').onclick=()=>togglePause(false);$('restart').onclick=resetMenu;$('again').onclick=resetMenu;
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){if(state&&state.phase!=='finished'){e.preventDefault();if(!e.repeat)togglePause();}return;}
  if(screen!=='race'||paused||!state||state.phase==='finished')return;
  if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();
  if(e.code==='ArrowLeft')held.left=true;if(e.code==='ArrowRight')held.right=true;
  if(!e.repeat&&e.code==='ArrowUp')pulses.jump=true;if(!e.repeat&&e.code==='Space')pulses.cast=true;
});
window.addEventListener('keyup',e=>{if(e.code==='ArrowLeft')held.left=false;if(e.code==='ArrowRight')held.right=false;});
window.addEventListener('blur',()=>{clearInput();if(screen==='race')togglePause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='race')togglePause(true);});
for(const button of document.querySelectorAll('[data-control]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||screen!=='race')return;button.setPointerCapture(e.pointerId);const c=button.dataset.control;if(c in held)held[c]=true;else pulses[c]=true;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>{const c=button.dataset.control;if(c in held)held[c]=false;});
}

function toast(text,seconds=1.4) { $('toast').textContent=text;toastUntil=performance.now()+seconds*1000;show('toast',true); }
const formatTime = seconds => `${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
function finish() {
  const won=state.winnerId===state.playerId;screen='result';clearInput();
  show('result-screen',true);show('countdown',false);show('pause',false);show('toast',false);
  $('result-eyebrow').textContent=won?'הקסם שלכם ניצח':'כל מרוץ הוא הרפתקה חדשה';
  $('result-symbol').textContent=won?'♛':'✧';$('result-title').textContent=won?'הניצחון שלכם!':'עוד קצת קסם, ונצליח.';
  $('result-copy').textContent=won?'הדמות שלכם ניצחה את וולדמורט וחצתה ראשונה את קו הסיום!':state.lossReason==='boss'?'וולדמורט ניצח הפעם. נסו להתחמק מהקללות ולירות מהנתיב המרכזי.':`${names[state.winnerId]} הגיע${state.winnerId==='hermione'?'ה':''} לקו הסיום לפניכם. מוכנים למרוץ חוזר?`;
  $('result-time').textContent=formatTime(state.time-3);$('result-power').textContent=powerById[state.power].name;
  $('chapter').textContent=won?'הטירה חוגגת איתכם':'נתראה במרוץ הבא';tone(won?880:260,.6,.05);$('again').focus();
}
function updateHud(now){
  if(!state)return;
  const player=state.racers.find(r=>r.id===state.playerId), standings=getStandings(state), battle=player.mode==='battle';
  $('place').textContent=standings.findIndex(r=>r.id===player.id)+1;
  $('timer').textContent=formatTime(state.time-3);
  $('progress-fill').style.width=`${Math.min(100,player.distance/state.trackLength*100)}%`;
  $('remaining').textContent=`${Math.min(100,Math.round(player.distance/state.trackLength*100))}% מהדרך`;
  for(const racer of state.racers)$('marker-'+racer.id).style.right=`${Math.min(100,racer.distance/state.trackLength*100)}%`;
    $('standings').innerHTML=standings.map((r,i)=>`<div class="standing ${r.id===selected?'you':''}"><b>${i+1}</b><span>${r.name}${r.id===selected?' · אתם':''}</span><small>${r.mode==='battle'?'בקרב':r.mode==='finishing'?'לקו הסיום':r.mode==='finished'?'סיים':''}</small></div>`).join('');
  show('battle-panel',battle);show('countdown',state.phase==='countdown');
  if(state.phase==='countdown')$('countdown').textContent=Math.max(1,Math.ceil(state.countdown));
  const active=player.activeUntil>state.time&&!battle,cooldown=Math.max(0,player.cooldownUntil-state.time);
  $('power-status').textContent=battle?'רווח לירי קסם':active?'הכוח פועל עכשיו!':cooldown>0?`מוכן שוב בעוד ${Math.ceil(cooldown)} שנ׳`:'רווח להפעלה';
  $('cooldown-ring').textContent=cooldown>0?Math.ceil(cooldown):'␣';
  if(battle){
    $('boss-hp').textContent='● '.repeat(player.bossHp)+'○ '.repeat(3-player.bossHp);
    $('player-hp').textContent='♥ '.repeat(player.battleHp)+'♡ '.repeat(3-player.battleHp);
    $('battle-warning').textContent=player.bossAttack?`קללה בדרך לנתיב ${player.bossAttack.lane===0?'המרכזי':player.bossAttack.lane===1?'הימני':'השמאלי'} — זוזו הצדה!`:'חזרו למרכז וירו ברווח';
    $('task-prompt').textContent=Math.abs(player.x)<1.15?'רווח לירי על וולדמורט':'עברו למרכז כדי לפגוע בוולדמורט';
  }else if(player.mode==='finishing'){
    $('task-prompt').textContent='וולדמורט הובס! קדימה, מעבר לקו הסיום!';
    $('power-status').textContent='הדרך פנויה!';
  }else{
    const upcoming=state.obstacles.find(o=>o.z>player.distance&&o.z-player.distance<35&&Math.abs(player.x-o.lane*3)<1.6);
    $('task-prompt').textContent=state.phase==='countdown'?'מוכנים? הקסם מתחיל…':player.slowedUntil>state.time?'המכשול האט אתכם — המרוץ ממשיך!':upcoming?hints[state.power]:active?'הכוח הופעל · קדימה אל הטירה!':'כוונו את הקסם לפני המכשול הבא';
  }
  lastHud=now;
}
function handleEvents(){
  for(const e of state.events||[]){
    if(e.racerId!==state.playerId)continue;
    if(e.type==='power'){tone(620,.2);toast(powerById[state.power].name+' · הכוח הופעל!');}
    if(e.type==='collision'){tone(130,.2,.04,'triangle');toast('נתקלתם במכשול · האטה קצרה');}
    if(e.type==='boss-hit')tone(800,.14,.04);
    if(e.type==='spell-miss')toast('כדי לפגוע — חזרו לנתיב המרכזי');
    if(e.type==='player-hit'){tone(120,.25,.05,'triangle');toast('קללה פגעה! התחמקו מהנתיב המסומן');}
    if(e.type==='battle'){toast('וולדמורט מחכה! חצים להתחמקות, רווח לירי',3);$('chapter').textContent='הקרב על קו הסיום';}
  }
}
function fail(error) {console.error(error);show('error-screen',true);$('error-copy').textContent='לא הצלחנו להפעיל את המשחק בתלת־ממד. נסו לרענן, או לפתוח בדפדפן מעודכן עם האצת חומרה.';}
try {
  if(!globalThis.BABYLON?.Engine?.isSupported())throw new Error('WebGL unavailable');
  world=createWorld($('world'));
  window.addEventListener('resize',()=>world.resize());
  world.engine.runRenderLoop(()=>{
    const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    try {
      if(state&&screen==='race'&&!paused){
        stepRace(state,dt,{...held,...pulses});pulses.jump=pulses.cast=false;handleEvents();
        if(state.phase!==lastPhase){if(state.phase==='running'&&lastPhase==='countdown'){tone(880,.3);toast('צאו לדרך!');}lastPhase=state.phase;}
        if(now-lastHud>60)updateHud(now);
        if(state.phase==='finished')finish();
      }
      if(now>toastUntil)show('toast',false);
      world.render(state,paused?0:dt);
    }catch(error){world.engine.stopRenderLoop();fail(error);}
  });
} catch(error){fail(error);}

// Read-only QA snapshot: does not advance time or alter the race.
Object.defineProperty(window,'magicRace',{get:()=>({screen,paused,selected,power:drawn?.id,state:state?structuredClone(state):null,engineVersion:globalThis.BABYLON?.Engine?.Version})});
