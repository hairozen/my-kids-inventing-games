/** Deterministic browser-only race simulation. All times are simulation seconds.
 * racers expose x, distance, jump (height), activeUntil, cooldownUntil,
 * slowedUntil, stunnedUntil, mode, battleHp, bossHp and bossAttack.
 * bossAttack = { lane:-1|0|1, firedAt, impactAt }; lane centers are -3,0,3.
 * Obstacles resolve independently per racer using racerIds; resolved is player-only.
 * mode is running, battle, finishing (8-unit exit), or finished.
 * Speed gates expose gateApproaches[racerId] = closing deadline in seconds.
 * events are transient per step, with type, text and optional racerId/lane.
 */
export const POWERS = [
  {id:'flight',name:'תעופה',icon:'🪽',description:'עפים מעל מכשולים למשך שלוש שניות',color:'#bda4ff'},
  {id:'speed',name:'מהירות',icon:'⚡',description:'מאיצים ועוברים שערים לפני סגירתם',color:'#ffd75e'},
  {id:'sand',name:'חול טובעני',icon:'🏜️',description:'עוברים בחול בלי לשקוע',color:'#e9b96f'},
  {id:'ice',name:'גשר קרח',icon:'❄️',description:'יוצרים גשר מעל בורות ומים',color:'#75dcff'},
  {id:'stun',name:'שתק',icon:'✨',description:'משתקים חוסם בדרך ורצים לידו',color:'#e997ff'},
];
export const CHARACTERS = [
  {id:'harry',name:'הארי פוטר',description:'משקפיים, צלקת וברק בשרביט',color:'#db5258'},
  {id:'hermione',name:'הרמיוני',description:'תלתלים חומים וקסמים חכמים',color:'#b578e3'},
  {id:'ron',name:'רון',description:'שיער ג׳ינג׳י ואומץ לב',color:'#ed984f'},
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function event(s,type,text,r,extra={}){s.events.push({type,text,racerId:r?.id,...extra});}
export function createRace({playerId='harry',power='flight',seed=12345,trackLength=1200,aiEnabled=true}={}){
  if(!CHARACTERS.some(c=>c.id===playerId)||!POWERS.some(p=>p.id===power))throw new Error('Unknown character or power');
  const s={phase:'countdown',power,time:0,countdown:3,trackLength:Math.max(10,trackLength),playerId,winnerId:null,lossReason:null,events:[],obstacles:[],projectiles:[],rng:seed>>>0,aiEnabled};
  s.racers=CHARACTERS.map((c,i)=>({...c,x:(i-1)*3,distance:0,jump:0,jumpVelocity:0,activeUntil:0,cooldownUntil:0,slowedUntil:0,stunnedUntil:0,battleHp:3,bossHp:3,mode:'running',battleStartedAt:null,nextBossAt:Infinity,nextShotAt:Infinity,bossAttack:null,finishAt:null,ai:{decisionAt:0,targetX:(i-1)*3}}));
  let id=0;
  for(let z=45;z<s.trackLength-15;z+=48){
    const lanes=random(s)<.25?[-1,0,1]:[Math.floor(random(s)*3)-1];
    for(const lane of lanes)s.obstacles.push({id:`obstacle-${id++}`,z,lane,type:power,resolved:false,racerIds:[],stunnedUntil:0,gateApproaches:{}});
  }
  return s;
}
function cast(s,r){
  if(s.time<r.cooldownUntil||r.mode==='finishing')return;
  if(r.mode==='battle'){
    r.cooldownUntil=s.time+1.1;
    // Aim at the boss in the center; moving aside dodges but shots then miss.
    const hit=Math.abs(r.x)<1.15;
    s.projectiles.push({racerId:r.id,lane:Math.round(r.x/3),firedAt:s.time,impactAt:s.time+.22,hit});
    event(s,hit?'boss-hit':'spell-miss',hit?'הקסם פגע בוולדמורט!':'כדי לפגוע כוונו אל המרכז',r);
    if(hit)r.bossHp=Math.max(0,r.bossHp-1);
  }else{
    r.cooldownUntil=s.time+4;
    r.activeUntil=s.time+(s.power==='flight'?3:2.5);
    if(s.power==='stun')for(const o of s.obstacles)if(o.z>=r.distance&&o.z-r.distance<38&&Math.abs(r.x-o.lane*3)<1.6)o.stunnedUntil=s.time+3;
    event(s,'power','הכוח הופעל!',r);
  }
}
function enterBattle(s,r){r.mode='battle';r.battleStartedAt=s.time;r.nextBossAt=s.time+1.3;r.nextShotAt=s.time+2.5;r.cooldownUntil=s.time+.4;event(s,'battle','הקרב מול וולדמורט מתחיל!',r);}
function battle(s,r,dt,player){
  if(!player&&s.aiEnabled){
    // Rivals fight in real time and need three distinct attacks (~8–11 seconds).
    const target=r.bossAttack?(r.bossAttack.lane===0?3:0):0;
    r.x+=clamp(target-r.x,-dt*7,dt*7);
    if(s.time>=r.nextShotAt&&Math.abs(r.x)<1.15){cast(s,r);r.nextShotAt=s.time+2.5+random(s);}
  }
  if(r.bossAttack&&s.time>=r.bossAttack.impactAt){
    const a=r.bossAttack;
    if(Math.abs(r.x-a.lane*3)<1.25&&r.jump<1){r.battleHp--;event(s,'player-hit','קללה פגעה!',r);}
    event(s,'curse-impact','הקללה נחתה',r,{lane:a.lane});
    r.bossAttack=null;r.nextBossAt=s.time+1.15;
  }
  if(!r.bossAttack&&s.time>=r.nextBossAt){
    r.bossAttack={lane:clamp(Math.round(r.x/3),-1,1),firedAt:s.time,impactAt:s.time+1.05};
    event(s,'curse-warning','התחמקו מהנתיב המסומן!',r,{lane:r.bossAttack.lane});
  }
  if(player&&r.battleHp<=0){s.phase='finished';s.lossReason='boss';return;}
  if(r.bossHp<=0){r.mode='finishing';r.bossAttack=null;event(s,'boss-defeated','הדרך לקו הסיום פתוחה!',r);}
}
export function getStandings(s){return [...s.racers].sort((a,b)=>{
  if(a.finishAt!==null||b.finishAt!==null)return (a.finishAt??Infinity)-(b.finishAt??Infinity);
  return b.distance-a.distance||a.bossHp-b.bossHp;
});}
export function stepRace(s,dt,input={}){
  if(s.phase==='finished')return s;
  dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
  s.events=[];s.time+=dt;s.projectiles=s.projectiles.filter(p=>s.time-p.firedAt<.6);
  if(s.phase==='countdown'){s.countdown=Math.max(0,3-s.time);if(s.time<3)return s;s.phase='running';return s;}
  for(const r of s.racers){
    if(r.mode==='finished')continue;
    if(r.mode==='finishing'){
      const remaining=s.trackLength+8-r.distance;
      r.distance=Math.min(s.trackLength+8,r.distance+10*dt);
      if(r.distance>=s.trackLength+8){r.mode='finished';r.finishAt=s.time-dt+Math.max(0,remaining)/10;}
      continue;
    }
    const player=r.id===s.playerId;
    if(player){
      r.x=clamp(r.x+((input.right?1:0)-(input.left?1:0))*7*dt,-4,4);
      if(input.jump&&r.jump===0)r.jumpVelocity=6;
      if(input.cast)cast(s,r);
    }else if(s.aiEnabled&&r.mode==='running'){
      if(s.time>=r.ai.decisionAt){
        r.ai.decisionAt=s.time+.25;
        const o=s.obstacles.find(o=>!o.racerIds.includes(r.id)&&o.z>r.distance&&o.z-r.distance<19&&Math.abs(o.lane*3-r.x)<1.4);
        if(o&&random(s)>.22)cast(s,r);
      }
    }
    if(r.jumpVelocity||r.jump){r.jump=Math.max(0,r.jump+r.jumpVelocity*dt);r.jumpVelocity-=14*dt;if(r.jump===0)r.jumpVelocity=0;}
    if(r.mode==='running'){
      const before=r.distance;
      if(s.power==='speed')for(const o of s.obstacles){
        o.gateApproaches??={};
        if(o.z>=before&&o.z-before<=20&&o.gateApproaches[r.id]===undefined)o.gateApproaches[r.id]=s.time+1.55;
      }
      const active=s.time<r.activeUntil;
      r.distance=Math.min(s.trackLength,r.distance+10*dt*(s.time<r.slowedUntil?.35:1)*(active&&s.power==='speed'?1.6:1));
      for(const o of s.obstacles){
        if(o.racerIds.includes(r.id)||o.z<before||o.z>r.distance)continue;
        o.racerIds.push(r.id);if(player)o.resolved=true;
        if(Math.abs(r.x-o.lane*3)>1.25)continue;
        const protectedByPower=s.power==='stun'?s.time<o.stunnedUntil:active&&(s.power!=='speed'||s.time<o.gateApproaches[r.id]);
        const jumped=r.jump>1.05&&s.power!=='ice'&&s.power!=='sand'&&s.power!=='speed';
        if(!protectedByPower&&!jumped){r.slowedUntil=s.time+2;event(s,'collision','מכשול האט את הריצה',r);}
        else event(s,'obstacle-cleared','המכשול מאחוריכם!',r);
      }
      if(r.distance>=s.trackLength)enterBattle(s,r);
    }else battle(s,r,dt,player);
  }
  if(s.phase==='finished')return s;
  const winner=getStandings(s).find(r=>r.mode==='finished');
  if(winner){s.winnerId=winner.id;s.phase='finished';s.lossReason=winner.id===s.playerId?null:'rival';event(s,'finish',winner.id===s.playerId?'ניצחתם במרוץ!':'מתחרה חצה ראשון את קו הסיום',winner);}
  else s.phase=s.racers.find(r=>r.id===s.playerId).mode!=='running'?'battle':'running';
  return s;
}
