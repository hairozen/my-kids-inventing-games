import { RACERS, TRACK_LENGTH, createRace, startRace, stepRace } from './model.js';
const $ = (id) => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const fireworksCanvas = $('fireworks'), fx = fireworksCanvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const controls = { left: false, right: false, jump: false, sprint: false };
let race = createRace(), paused = false, last = 0, width = 1000, height = 650, finishedAt = 0;
const looks = {
  belle: { dress: '#edbf42', light: '#ffe793', dark: '#bc7d25', hair: '#633c26', skin: '#f2c49e' },
  felice: { dress: '#bc8cc9', light: '#eed4ef', dark: '#8557a5', hair: '#9e5c35', skin: '#f5cfae' },
  torres: { dress: '#639f98', light: '#b8e0d2', dark: '#36776d', hair: '#352921', skin: '#bb825c' }
};
function princessSvg(id) {
 const c = looks[id];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 145" aria-hidden="true"><ellipse cx="50" cy="137" rx="34" ry="5" fill="#244e43" opacity=".12"/><path d="M32 31Q25 2 51 5Q78 3 72 35L78 83L57 74L28 85Z" fill="${c.hair}"/>${id==='belle'?`<ellipse cx="50" cy="9" rx="15" ry="9" fill="${c.hair}"/><path d="M37 13Q50 6 64 13" fill="none" stroke="#e5bd4b" stroke-width="3"/>`:''}<path d="M37 59L26 85L20 111M63 59L75 82L81 107" fill="none" stroke="${c.skin}" stroke-width="8" stroke-linecap="round"/><path d="M40 47L39 60L61 60L60 47" fill="${c.skin}"/><ellipse cx="50" cy="33" rx="18" ry="23" fill="${c.skin}"/><path d="M31 30Q31 8 53 11Q71 11 70 31Q59 29 51 16Q43 29 31 30" fill="${c.hair}"/><path d="M39 35h3m16 0h3" stroke="#44362d" stroke-width="2.5" stroke-linecap="round"/><path d="M46 44q4 4 8 0" fill="none" stroke="#a85c63" stroke-width="1.5" stroke-linecap="round"/><circle cx="37" cy="41" r="3" fill="#e7a4a0" opacity=".7"/><circle cx="63" cy="41" r="3" fill="#e7a4a0" opacity=".7"/><path d="M34 57Q50 66 66 57L61 82Q77 103 88 133Q51 144 12 133Q23 103 39 82Z" fill="${c.dress}" stroke="${c.dark}" stroke-width="1.5"/><path d="M39 82Q35 106 25 134M50 84v53M61 82q4 24 14 52" fill="none" stroke="${c.light}" stroke-width="3"/><path d="M15 125Q31 106 50 123Q68 106 84 125" fill="none" stroke="${c.light}" stroke-width="5"/><path d="M32 58L40 64M68 58L60 64" stroke="${c.light}" stroke-width="7" stroke-linecap="round"/><path d="M41 56q9 10 18 0" fill="none" stroke="#e6be59" stroke-width="2"/><circle cx="50" cy="62" r="3" fill="#fff5b8"/>${id!=='belle'?'<circle cx="22" cy="108" r="3" fill="none" stroke="#edc84f" stroke-width="2"/><circle cx="80" cy="104" r="3" fill="none" stroke="#edc84f" stroke-width="2"/>':''}${id==='torres'?'<circle cx="32" cy="40" r="4" fill="none" stroke="#f2d467" stroke-width="2"/><circle cx="68" cy="40" r="4" fill="none" stroke="#f2d467" stroke-width="2"/>':''}</svg>`;
}
const images = {};
for (const r of RACERS) { const img = new Image(); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(princessSvg(r.id))}`; images[r.id] = img; }
$('portraits').innerHTML = RACERS.map(r => `<div class="portrait">${princessSvg(r.id)}<b>${r.name}</b><small>${r.id === 'belle' ? 'זאת את ♡' : 'חברה למרוץ'}</small></div>`).join('');
function resize() { const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); fireworksCanvas.width = canvas.width; fireworksCanvas.height = canvas.height; fx.setTransform(dpr,0,0,dpr,0,0); }
new ResizeObserver(resize).observe(canvas);
function clearControls() { pointers.clear(); for (const key in controls) controls[key] = false; document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed')); }
function begin() { clearControls(); race = createRace(); startRace(race); paused = false; finishedAt = 0; $('intro').hidden = true; $('finish').hidden = true; $('paused').hidden = true; document.querySelector('.hud').hidden = false; $('announcement').textContent = 'המרוץ התחיל! את משחקת בתור בל.'; last = 0; }
function pause() { if (race.phase !== 'racing') return; clearControls(); paused = true; $('paused').hidden = false; $('resume').focus(); }
$('start').onclick = begin; $('replay').onclick = begin; $('pause').onclick = pause;
$('resume').onclick = () => { paused = false; $('paused').hidden = true; last = 0; $('pause').focus(); };
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
const keyMap = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'jump', ' ':'sprint' };
window.addEventListener('keydown', e => { if (e.key === 'Escape') { pause(); return; } if (race.phase !== 'racing' || paused || !(e.key in keyMap)) return; e.preventDefault(); controls[keyMap[e.key]] = true; });
window.addEventListener('keyup', e => { if (!(e.key in keyMap)) return; controls[keyMap[e.key]] = false; if(race.phase === 'racing' && !paused) e.preventDefault(); });
const pointers = new Map();
for (const button of document.querySelectorAll('[data-control]')) {
 button.addEventListener('pointerdown', e => { if(race.phase !== 'racing' || paused) return; e.preventDefault(); button.setPointerCapture(e.pointerId); pointers.set(e.pointerId, button.dataset.control); controls[button.dataset.control] = true; button.classList.add('pressed'); });
 const release = e => { const key = pointers.get(e.pointerId); pointers.delete(e.pointerId); if(key && ![...pointers.values()].includes(key)) { controls[key] = false; button.classList.remove('pressed'); } };
 button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('lostpointercapture',release);
}
function path(points, fill, stroke, lineWidth=1) { ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();} }
function ellipse(x,y,rx,ry,color) { ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill(); }
function project(x, distance, playerDistance) { const z = Math.max(-10, distance-playerDistance); const t = 1 / (1 + Math.max(0,z)/32); return { x: width/2 + x*width*.35*t, y: height*.3 + height*.57*t, s:t }; }
function castle() {
 const cx=width*.5, cy=height*.29, scale=Math.min(width/1000,height/600);ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);
 path([[-100,8],[-100,-85],[-72,-85],[-72,-120],[-55,-120],[-55,-60],[-35,-60],[-35,-140],[0,-168],[35,-140],[35,-60],[55,-60],[55,-120],[72,-120],[72,-85],[100,-85],[100,8]],'#f6e5d3','#ceb593',2);
 for(const [x,y] of [[-86,-87],[0,-142],[64,-120]]) { path([[x-20,y],[x,y-31],[x+20,y]],'#c78795');ctx.fillStyle='#b89457';ctx.fillRect(x-1,y-51,2,22);path([[x+1,y-51],[x+22,y-44],[x+1,y-37]],'#e7bb52'); }
 ctx.fillStyle='#897968';ctx.beginPath();ctx.roundRect(-15,-29,30,38,[15,15,0,0]);ctx.fill();for(const x of [-72,-44,44,72]){ctx.fillStyle='#9fafa5';ctx.beginPath();ctx.roundRect(x-4,-45,8,16,[4,4,0,0]);ctx.fill();} ctx.restore();
}
function tree(x,y,s) { ctx.fillStyle='#8f8060';ctx.fillRect(x-3*s,y-35*s,6*s,37*s);ellipse(x,y-48*s,24*s,37*s,'#437d62');ellipse(x-12*s,y-38*s,19*s,26*s,'#548b68');ellipse(x+13*s,y-43*s,18*s,28*s,'#649778'); }
function drawScene(now) {
 const player = race.racers.find(r=>r.id==='belle'); const d=player.distance;
 const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#d9e9e4');sky.addColorStop(.5,'#f9ecd7');sky.addColorStop(1,'#b0c994');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
 ellipse(width*.78,height*.12,30,30,'#fff6d4');ellipse(width*.13,height*.16,70,15,'#ffffff70');ellipse(width*.7,height*.22,90,12,'#ffffff50');
 ellipse(width*.1,height*.45,width*.6,height*.2,'#aac5a0');ellipse(width*.87,height*.45,width*.65,height*.17,'#bdd0a6');castle();
 path([[width*.46,height*.3],[width*.54,height*.3],[width*.96,height],[width*.04,height]],'#ead6b4');
 path([[width*.46,height*.3],[width*.465,height*.3],[width*.065,height],[width*.04,height]],'#ffedce');path([[width*.535,height*.3],[width*.54,height*.3],[width*.96,height],[width*.935,height]],'#ffedce');
 for(let k=0;k<16;k++){const z=k*12-(d%12);if(z<0)continue;const a=project(-1,z,d-d),b=project(1,z,0);ctx.strokeStyle='#c9b58b35';ctx.lineWidth=1+3*a.s;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 for(let i=17;i>=0;i--){const z=i*15-(d%15);if(z<0)continue;const a=project(-1.45,z,0),b=project(1.45,z,0);tree(a.x,a.y,a.s*1.7);tree(b.x,b.y,b.s*1.6);}
 for(let i=30;i>=0;i--){const z=i*7-(d%7);if(z<0)continue;for(const side of [-1,1]){const p=project(side*(1.15+(i%3)*.12),z,0);ellipse(p.x,p.y,7*p.s,3*p.s,'#7f9e6c');const colors=['#d78da5','#f9e1a3','#f2b4c4'];for(let petal=0;petal<5;petal++){const a=petal*Math.PI*.4;ellipse(p.x+Math.cos(a)*4*p.s,p.y-7*p.s+Math.sin(a)*4*p.s,3.4*p.s,3.4*p.s,colors[i%3]);}ellipse(p.x,p.y-7*p.s,2*p.s,2*p.s,'#e7b952');}}
 const objects=[];
 for(const o of race.obstacles){if(o.distance-d < -5 || o.distance-d>200)continue;objects.push({type:'obstacle',obj:o,d:o.distance});}
 for(const r of race.racers) if(r.distance-d>-12 && r.distance-d<190) objects.push({type:'racer',obj:r,d:r.distance});
 if(TRACK_LENGTH-d<220) objects.push({type:'finish',d:TRACK_LENGTH});
 objects.sort((a,b)=>b.d-a.d);
 for(const item of objects) {
  if(item.type==='finish'){const l=project(-1.03,item.d,d),r=project(1.03,item.d,d);ctx.fillStyle='#aa8965';ctx.fillRect(l.x,l.y-110*l.s,6*l.s,110*l.s);ctx.fillRect(r.x-6*r.s,r.y-110*r.s,6*r.s,110*r.s);ctx.fillStyle='#fff9e9';ctx.fillRect(l.x,l.y-115*l.s,r.x-l.x,26*l.s);ctx.fillStyle='#244e43';ctx.font=`bold ${Math.max(8,16*l.s)}px Arial`;ctx.textAlign='center';ctx.fillText('הארמון • קו הסיום',(l.x+r.x)/2,l.y-97*l.s);continue;}
  const o=item.obj,p=project(o.x,item.d,d);
  if(item.type==='obstacle'){const w=width*.105*p.s,h=29*p.s;ctx.fillStyle='#b38962';ctx.fillRect(p.x-w/2,p.y-h,w,h*.3);ctx.fillRect(p.x-w*.46,p.y-h-5*p.s,5*p.s,h+5*p.s);ctx.fillRect(p.x+w*.4,p.y-h-5*p.s,5*p.s,h+5*p.s);ctx.fillStyle='#e2c499';ctx.fillRect(p.x-w/2,p.y-h*.55,w,h*.16);ellipse(p.x,p.y+2*p.s,w*.6,4*p.s,'#796b4b30');}
  else {const isPlayer=o.id==='belle';const scale = p.s*(isPlayer?1:1.02);const charHeight=Math.min(height*.34,176)*scale;const charWidth=charHeight*100/145;const jump=(o.jumpHeight||0)*height*.065;const bob=!reducedMotion && race.phase==='racing'&&!paused?Math.sin(now*.013+o.distance)*2*scale:0;ellipse(p.x,p.y,charWidth*.3,5*scale,'#53694f36');ctx.save();ctx.translate(p.x,p.y-charHeight-jump+bob);if(o.slowRemaining>0 && Math.floor(now/90)%2)ctx.globalAlpha=.65;if(images[o.id]?.complete)ctx.drawImage(images[o.id],-charWidth/2,0,charWidth,charHeight);ctx.restore();const labelY=p.y-charHeight-jump-12*scale;ctx.font=`700 ${Math.max(10,14*scale)}px Arial`;ctx.textAlign='center';const label=o.name+(isPlayer?' ♡':'');const tw=ctx.measureText(label).width;ctx.fillStyle=isPlayer?'#244e43':'#fffcf0e8';ctx.beginPath();ctx.roundRect(p.x-tw/2-10,labelY-15,tw+20,23,11);ctx.fill();ctx.fillStyle=isPlayer?'#fff9e8':'#365649';ctx.fillText(label,p.x,labelY+1);}
 }
 if(controls.sprint&&race.phase==='racing'&&!paused&&!reducedMotion){ctx.strokeStyle='#fff8dd88';ctx.lineWidth=2;for(let i=0;i<9;i++){const x=((i*137+now*.9)%width),y=height*.55+(i%4)*height*.09;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-14,y+25);ctx.stroke();}}
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
function updateHud() { const player=race.racers.find(r=>r.id==='belle');const ranking=[...race.racers].sort((a,b)=>b.distance-a.distance);$('rank').innerHTML=`${ranking.findIndex(r=>r.id==='belle')+1} <span>/ 3</span>`;const pct=Math.min(100,Math.floor(player.distance/TRACK_LENGTH*100));$('percent').textContent=`${pct}%`;$('progress').style.width=`${pct}%`;const status=player.slowRemaining>0?'אופס! עוד רגע חוזרת למהירות':controls.sprint?'✦ קדימה בל, ריצה מהירה!':'';$('status').hidden=!status;$('status').textContent=status; }
function finish(now) { clearControls(); finishedAt=now;const winner=typeof race.winner==='string'?race.racers.find(r=>r.id===race.winner):race.winner;if(!winner)return;$('winner-name').textContent=`${winner.name} ניצחה!`;$('winner-message').textContent=winner.id==='belle'?'הגעת ראשונה לארמון! איזה מרוץ נפלא ♡':'מחיאות כפיים למנצחת! ננסה שוב להגיע ראשונה?';$('winner-art').innerHTML=princessSvg(winner.id);$('finish').hidden=false;$('status').hidden=true;document.querySelector('.hud').hidden=true;$('announcement').textContent=`${winner.name} ניצחה!`;$('replay').focus(); }
function frame(now) {const dt=last?Math.min((now-last)/1000,.045):0;last=now;if(race.phase==='racing'&&!paused){stepRace(race,controls,dt);updateHud();if(race.phase==='finished')finish(now);}drawScene(now);if(race.phase==='finished')fireworks(now);requestAnimationFrame(frame);}
resize();requestAnimationFrame(frame);
