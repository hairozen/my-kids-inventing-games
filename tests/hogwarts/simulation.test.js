import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,stepRace,POWERS,getStandings} from '../../public/games/hogwarts/simulation.js';
const tick=(s,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds/.05);i++)stepRace(s,.05,input);};
function running(power='flight',playerId='harry'){const s=createRace({power,playerId,aiEnabled:false});tick(s,3.05);return s;}
function hazard(s){s.obstacles=[{id:'test',z:1,lane:0,type:s.power,resolved:false,racerIds:[],stunnedUntil:0}];s.racers.forEach(r=>r.x=0);}
test('all powers generate their own course and protect their corresponding hazard',()=>{
 for(const p of POWERS){const s=running(p.id);assert.ok(s.obstacles.every(o=>o.type===p.id));hazard(s);stepRace(s,.05,{cast:true});tick(s,.2);assert.equal(s.racers[0].slowedUntil,0,p.id);}
});
test('unprotected collisions slow each racer independently and never eliminate',()=>{const s=running('ice');hazard(s);tick(s,.2);assert.ok(s.racers.every(r=>r.slowedUntil>s.time));assert.equal(s.obstacles[0].racerIds.length,3);assert.notEqual(s.phase,'finished');});
test('power cooldown expires and a new game resets state',()=>{const s=running();stepRace(s,.05,{cast:true});const until=s.racers[0].activeUntil;stepRace(s,.05,{cast:true});assert.equal(s.racers[0].activeUntil,until);tick(s,4);stepRace(s,.05,{cast:true});assert.ok(s.racers[0].activeUntil>until);assert.equal(createRace().racers[0].activeUntil,0);});
function battleState(){const s=running();s.obstacles=[];const p=s.racers[0];p.distance=s.trackLength-.1;p.x=0;stepRace(s,.05);tick(s,.5);return s;}
test('all character choices defeat boss then physically cross finish',()=>{
 for(const playerId of ['harry','hermione','ron']){
  const s=running('flight',playerId);s.obstacles=[];
  const p=s.racers.find(r=>r.id===playerId);p.distance=s.trackLength-.1;p.x=0;
  stepRace(s,.05);tick(s,.5);
  stepRace(s,.05,{cast:true});tick(s,1.15);
  stepRace(s,.05,{cast:true});tick(s,1.15);
  stepRace(s,.05,{cast:true});
  assert.equal(p.mode,'finishing');assert.equal(s.winnerId,null);assert.equal(s.phase,'battle');
  assert.equal(getStandings(s)[0].id,playerId);
  tick(s,.4);assert.equal(s.winnerId,null);assert.ok(p.distance>s.trackLength);
  tick(s,.45);assert.equal(s.winnerId,playerId);assert.equal(p.distance,s.trackLength+8);
 }
});
test('boss spells require centered aim and obey cooldown',()=>{
 const s=battleState();const p=s.racers[0];p.x=3;
 stepRace(s,.05,{cast:true});assert.equal(p.bossHp,3);
 p.x=0;stepRace(s,.05,{cast:true});assert.equal(p.bossHp,3);
 tick(s,1.15);stepRace(s,.05,{cast:true});assert.equal(p.bossHp,2);
});
test('speed gates close on individual approach deadlines and late acceleration fails',()=>{
 const fast=running('speed');hazard(fast);fast.obstacles[0].z=20;
 stepRace(fast,.05,{cast:true});tick(fast,1.3);assert.equal(fast.racers[0].slowedUntil,0);
 assert.ok(fast.obstacles[0].racerIds.includes('harry'));
 const late=running('speed');hazard(late);late.obstacles[0].z=20;
 tick(late,1.45);stepRace(late,.05,{cast:true});tick(late,.5);
 assert.ok(late.racers[0].slowedUntil>late.time);
 assert.ok(late.obstacles[0].gateApproaches.harry<late.time);
});
test('three telegraphed curses lose; dodging avoids one',()=>{const s=battleState();const p=s.racers[0];p.bossAttack={lane:0,firedAt:s.time,impactAt:s.time+.2};tick(s,.3,{right:true});assert.equal(p.battleHp,3);p.x=0;for(let i=0;i<3;i++){p.bossAttack={lane:0,firedAt:s.time,impactAt:s.time+.05};tick(s,.1);}assert.equal(s.lossReason,'boss');assert.equal(s.winnerId,null);});
test('rival wins only after its own real battle',()=>{const s=running();s.aiEnabled=true;s.obstacles=[];s.racers[1].distance=s.trackLength-.1;stepRace(s,.05);assert.equal(s.phase,'running');tick(s,6);assert.notEqual(s.phase,'finished');tick(s,6);assert.equal(s.lossReason,'rival');assert.equal(s.winnerId,'hermione');assert.equal(getStandings(s)[0].id,'hermione');});
test('large frame gaps and invalid dt cannot skip track',()=>{const s=running();const before=s.racers[0].distance;stepRace(s,100);assert.ok(s.racers[0].distance-before<=.501);const time=s.time;stepRace(s,NaN);assert.equal(s.time,time);});

test('a frozen blocker stays passable after caster aura expires',()=>{const s=running('stun');hazard(s);s.obstacles[0].z=27;stepRace(s,.05,{cast:true});tick(s,2.75);assert.ok(s.time>s.racers[0].activeUntil);assert.ok(s.obstacles[0].stunnedUntil>s.time);assert.equal(s.racers[0].slowedUntil,0);});
