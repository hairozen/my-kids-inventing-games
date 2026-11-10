const B = globalThis.BABYLON;
export function createWorld(canvas) {
  const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  engine.setHardwareScalingLevel(Math.min(1.5, Math.max(1, (globalThis.devicePixelRatio || 1) / 1.5)));
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(.20,.18,.34,1);
  scene.fogMode = B.Scene.FOGMODE_EXP2; scene.fogDensity=.008; scene.fogColor=new B.Color3(.43,.35,.46);
  const camera=new B.FreeCamera('camera',new B.Vector3(0,5, -13),scene); camera.minZ=.1; camera.maxZ=400; camera.fov=.85;
  const hemi=new B.HemisphericLight('sky',new B.Vector3(.2,1,.1),scene); hemi.intensity=1.1; hemi.groundColor=new B.Color3(.24,.18,.29);
  const sun=new B.DirectionalLight('sun',new B.Vector3(-.7,-1,.4),scene); sun.intensity=2.0; sun.diffuse=new B.Color3(1,.72,.42);
  const glow=new B.GlowLayer('magic-glow',scene,{blurKernelSize:32}); glow.intensity=.45;
  const mat=(name,color,emission)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.12,.12);if(emission)m.emissiveColor=B.Color3.FromHexString(emission);return m;};
  const stone=mat('warm limestone','#a9a0a1'), edge=mat('carved sandstone','#d0b7a0'), roof=mat('oxidized teal roofs','#27525b'), dark=mat('iron charcoal','#252738'), gold=mat('antique gold','#d7aa59'), burgundy=mat('Gryffindor burgundy','#842d43'), robe=mat('midnight school robes','#292938'), green=mat('dark emerald robes','#153b35'), skin=mat('warm skin','#edb594'), amber=mat('lit castle windows','#eec879','#ffb44b'), aqua=mat('ice bridge','#85e3ef','#287eaa'), magic=mat('gold magic','#ffe19a','#ffbf52'), curse=mat('green curses','#78ff9a','#37ff71');
  const box=(n,x,y,z,w,h,d,m,parent)=>{const o=B.MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene);o.position.set(x,y,z);o.material=m;if(parent)o.parent=parent;return o;};
  const ball=(n,x,y,z,s,m,parent)=>{const o=B.MeshBuilder.CreateSphere(n,{diameter:s,segments:10},scene);o.position.set(x,y,z);o.material=m;if(parent)o.parent=parent;return o;};
  const cyl=(n,x,y,z,r,h,m,parent,top=r,vertices=12)=>{const o=B.MeshBuilder.CreateCylinder(n,{diameter:r*2,diameterTop:top*2,height:h,tessellation:vertices},scene);o.position.set(x,y,z);o.material=m;if(parent)o.parent=parent;return o;};
  const faceMaterials=new Map();
  const hermioneFace=(c)=>{
    c.clearRect(0,0,512,512);c.lineCap='round';
    for(const x of [190,322]){
      c.fillStyle='#65432e';c.beginPath();c.ellipse(x,245,17,21,0,0,Math.PI*2);c.fill();
      c.fillStyle='#211c1b';c.beginPath();c.ellipse(x,246,8,13,0,0,Math.PI*2);c.fill();
      c.fillStyle='#fff5df';c.beginPath();c.arc(x-5,238,4,0,Math.PI*2);c.fill();
      c.strokeStyle='#493025';c.lineWidth=5;c.beginPath();c.ellipse(x,244,18,21,0,Math.PI,Math.PI*2);c.stroke();
      c.beginPath();c.moveTo(x+16,234);c.lineTo(x+21,229);c.stroke();
      c.lineWidth=6;c.beginPath();c.moveTo(x-18,207);c.quadraticCurveTo(x,197,x+19,206);c.stroke();
    }
    c.strokeStyle='#a66752';c.lineWidth=4;c.beginPath();c.moveTo(254,264);c.quadraticCurveTo(248,275,259,276);c.stroke();
    c.strokeStyle='#874f43';c.lineWidth=5;c.beginPath();c.moveTo(233,300);c.quadraticCurveTo(256,319,280,298);c.stroke();
  };
  const faceTexture=(id)=>{if(faceMaterials.has(id))return faceMaterials.get(id);const t=new B.DynamicTexture(id+' face',{width:512,height:512},scene,false);const c=t.getContext();c.clearRect(0,0,512,512);c.fillStyle='#24303a';for(const x of [190,322]){c.beginPath();c.ellipse(x,245,14,19,0,0,7);c.fill();}c.strokeStyle='#714236';c.lineWidth=5;c.beginPath();c.arc(256,294,29,.18,Math.PI-.18);c.stroke();if(id==='harry'){c.strokeStyle='#292530';c.lineWidth=8;for(const x of [190,322]){c.beginPath();c.arc(x,244,52,0,7);c.stroke();}c.beginPath();c.moveTo(238,242);c.lineTo(274,242);c.stroke();c.strokeStyle='#ad645a';c.lineWidth=7;c.beginPath();c.moveTo(286,102);c.lineTo(262,142);c.lineTo(281,141);c.lineTo(262,174);c.stroke();}if(id==='ron'){c.fillStyle='#a86539';for(let i=0;i<18;i++){c.beginPath();c.arc(165+(i*37)%186,268+(i%3)*8,3,0,7);c.fill();}}if(id==='voldemort'){c.fillStyle='#5c7771';c.fillRect(244,260,5,17);c.fillRect(261,260,5,17);c.strokeStyle='#56675d';c.beginPath();c.moveTo(230,307);c.lineTo(282,307);c.stroke();}if(id==='hermione')hermioneFace(c);t.update();const m=new B.StandardMaterial(id+' portrait',scene);t.hasAlpha=true;m.diffuseTexture=t;m.useAlphaFromDiffuseTexture=true;m.backFaceCulling=false;m.specularColor=B.Color3.Black();faceMaterials.set(id,m);return m;};
  function wizard(id,x=0){const root=new B.TransformNode(id,scene);root.position.x=x;const limbs=[];const pale=id==='voldemort';const body=cyl(id+' flowing robe',0,1.05,0,.43,1.75,pale?green:robe,root,.29);body.scaling.z=.7;box('shirt front',0,1.56,.245,.33,.6,.055,edge,root);if(!pale){box('house scarf',-.10,1.70,.285,.17,.7,.06,burgundy,root);for(let i=0;i<4;i++)box('scarf gold stripe',-.10,1.43+i*.15,.323,.17,.048,.015,gold,root);}
    const head=ball('head',0,2.30,0,.78,pale?edge:skin,root);head.rotation.y=Math.PI;head.scaling.z=.88;if(id==='hermione'){head.scaling.x=.92;head.scaling.y=1.04;}
    // An illustrated face plane keeps signature details crisp from the selection camera.
    const face=B.MeshBuilder.CreatePlane('recognizable face',{width:.65,height:.70},scene);face.parent=root;face.position.set(0,2.31,.355);face.rotation.y=Math.PI;face.material=faceTexture(id);
    if(!pale){const hair=mat(id+' hair',id==='harry'?'#171b24':id==='ron'?'#b75a29':'#61412f');
      if(id==='hermione'){
        // A side part leaves her face clear; layered waves reach below the shoulders
        // and retain Hermione's bushy silhouette from the rear racing camera.
        const highlights=mat('Hermione chestnut waves','#805537');
        const crown=ball('Hermione parted crown',-.035,2.61,-.07,.84,hair,root);crown.scaling.set(1.08,.63,.98);
        const back=ball('Hermione long back hair',0,2.12,-.25,.84,hair,root);back.scaling.set(1.12,1.42,.66);
        for(let strand=0;strand<7;strand++){
          const x=(strand-3)*.135;
          for(let tier=0;tier<3;tier++){
            const wave=ball('Hermione layered back wave',x+Math.sin(strand*1.8+tier)*.045,2.47-tier*.32,-.38-(strand%2)*.025,.32,tier%2&&strand%2?highlights:hair,root);
            wave.scaling.set(1,1.65,.85);wave.rotation.z=Math.sin(strand+tier)*.15;
          }
        }
        for(const side of [-1,1])for(let tier=0;tier<3;tier++){
          const curl=ball('Hermione face framing curl',side*(.36+(tier%2)*.06),2.48-tier*.28,.035,.34,tier===1?highlights:hair,root);
          curl.scaling.set(.92,1.5,1);curl.rotation.z=side*(.16-tier*.12);
        }
        for(let i=0;i<3;i++){
          const sweep=ball('Hermione side swept part',-.25+i*.13,2.66+i*.035,.22,.27,hair,root);
          sweep.scaling.set(1.25,.68,.8);sweep.rotation.z=-.32;
        }
        body.scaling.x=1.12;body.scaling.y=1.32/1.75;body.position.y=1.265;
        const skirt=cyl('Hermione school skirt',0,.56,.015,.43,.47,dark,root,.31,16);skirt.scaling.z=.75;
        for(let i=0;i<10;i++){const angle=i/10*Math.PI*2;const pleat=box('Hermione skirt pleat',Math.cos(angle)*.36,.54,Math.sin(angle)*.26,.035,.34,.035,robe,root);pleat.rotation.y=-angle;}
      }else{
        ball('hair crown',0,2.60,-.025,.82,hair,root).scaling.y=.65;for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ball('hair curl',Math.cos(a)*.34,2.43+(i%3)*.075,Math.sin(a)*.28,.25,hair,root);}for(let i=0;i<4;i++)ball('fringe',-.27+i*.17,2.65,.19,.21,hair,root);
      }
    }
    for(const side of [-1,1]){const arm=new B.TransformNode('arm',scene);arm.parent=root;arm.position.set(side*.35,1.67,0);const sleeve=cyl('robe sleeve',side*.13,-.25,0,.14,.63,pale?green:robe,arm,.17);sleeve.rotation.z=side*.24;ball('hand',side*.20,-.59,.03,.20,pale?edge:skin,arm);limbs.push(arm);const leg=new B.TransformNode('leg',scene);leg.parent=root;leg.position.set(side*.18,.49,0);box('shoe',0,-.30,.08,.25,.29,.43,dark,leg);limbs.push(leg);if(side===1){const wand=cyl('wand',.2,-.48,.30,.026,.78,gold,arm,.014);wand.rotation.x=Math.PI/2;ball('wand light',.2,-.48,.70,.08,magic,arm);}}
    if(id==='hermione')for(const leg of [limbs[1],limbs[3]])cyl('Hermione knee sock',0,-.06,0,.092,.30,edge,leg,.095);
    return {root,limbs};
  }
  const racers={harry:wizard('harry',-2.5),hermione:wizard('hermione',0),ron:wizard('ron',2.5)};
  const boss=wizard('voldemort');boss.root.setEnabled(false);
  const finish=new B.TransformNode('finish line',scene);for(let row=0;row<2;row++)for(let col=0;col<12;col++)box('finish checker',-5.5+col,.13,row*.7,1,.035,.7,(row+col)%2?gold:dark,finish);
  for(const side of [-1,1]){cyl('finish flag pole',side*6,3,0,.075,6,gold,finish);box('finish pennant',side*5.45,5.25,0,1.1,1.25,.06,burgundy,finish);}
  const landscape=new B.TransformNode('castle campus',scene);
  box('endless lawn',0,-.4,75,360,.6,420,mat('velvet lawn','#3a5751'),landscape);
  box('courtyard causeway',0,-.06,66,12,.3,210,stone,landscape);
  const paving=mat('paving seams','#827d84');for(let i=0;i<45;i++)box('paving cross-joint',0,.102,i*4-15,11.6,.018,.035,paving,landscape);
  for(const side of [-1,1]){box('bridge parapet',side*6.3,.45,60,.65,1.1,190,edge,landscape);for(let i=0;i<22;i++){box('parapet pier',side*6.3,.88,i*9-22,1,1.8,1,stone,landscape);if(i%2===0){cyl('lantern pedestal',side*6.3,1.95,i*9-22,.15,.7,dark,landscape);ball('amber lantern',side*6.3,2.4,i*9-22,.43,amber,landscape);}}}
  function tower(x,z,r,h){cyl('castle tower',x,h/2,z,r,h,stone,landscape,r,14);cyl('tower rim',x,h-.15,z,r*1.1,.6,edge,landscape,r*1.1,14);cyl('teal conical roof',x,h+3,z,r*1.32,6,roof,landscape,0,14);cyl('gold roof spire',x,h+6.5,z,.09,1.5,gold,landscape,0);for(let y=4;y<h-1;y+=4){box('tall amber window',x,y,z-r-.02,.65,1.75,.08,amber,landscape);box('window lintel',x,y+1,z-r-.08,1,.17,.15,edge,landscape);} }
  box('great hall',-18,8,112,22,16,20,stone,landscape);const hallRoof=box('great hall pitched roof',-18,17,112,25,4,23,roof,landscape);hallRoof.rotation.z=.05;
  box('castle gatehouse',0,6,118,15,12,10,stone,landscape);box('shadowed entrance',0,3.2,112.94,4.8,6.4,.13,dark,landscape);cyl('entrance arch glow',0,6,112.8,2.45,.12,amber,landscape,2.45,20).rotation.x=Math.PI/2;
  for(let i=0;i<7;i++)box('great hall windows',-27+i*3,9,101.9,1.2,5,.1,amber,landscape);
  tower(-10,112,3.4,23);tower(10,116,3.5,28);tower(-29,118,3.7,31);tower(-19,135,4.4,39);tower(23,133,4.5,34);tower(3,142,5,46);tower(32,115,2.8,21);
  for(const side of [-1,1])for(let i=0;i<17;i++){const x=side*(12+(i%3)*5),z=i*11-28;cyl('cypress trunk',x,1,z,.20,2,edge,landscape);cyl('cypress foliage',x,3.6,z,1.5,6,mat('pine '+side+i,i%2?'#294b48':'#355b50'),landscape,.09,7);}
  for(const side of [-1,1])for(let i=0;i<5;i++){const z=i*24+8;cyl('banner pole',side*8.1,3.4,z,.06,6.8,gold,landscape);box('house banner',side*8.1,5.4,z,1.4,2.2,.08,burgundy,landscape);box('banner emblem',side*8.1,5.45,z-.06,.44,.65,.04,gold,landscape);}
  // Foreground arrival arch, with masonry piers and a curved crown.
  for(const side of [-1,1]){box('arrival arch pier',side*6,3,-8,2,6,2.5,stone,landscape);cyl('arrival turret',side*6,7,-8,1.35,3,stone,landscape);cyl('arrival roof',side*6,9.3,-8,1.7,2.4,roof,landscape,0);}
  const arch=B.MeshBuilder.CreateTorus('courtyard arch',{diameter:12,thickness:1.05,tessellation:28},scene);arch.parent=landscape;arch.position.set(0,3,-8);arch.rotation.x=Math.PI/2;arch.material=edge;
  const motes=[];for(let i=0;i<45;i++){const m=ball('floating golden mote',Math.sin(i*7)*16,1+(i%7),i*3-12,.045+(i%3)*.025,magic,landscape);motes.push(m);}
  const water=mat('deep blue water','#163f68','#0d3458');
  const obstacles=new Map(); let racePower='';
  function obstacle(o){const r=new B.TransformNode('obstacle '+o.type,scene);r.position.set(o.lane*3,0,o.z);if(o.type==='sand'){box('sunken sand basin',0,.15,0,2.9,.13,5,gold,r);for(let i=0;i<3;i++){const t=B.MeshBuilder.CreateTorus('sand ripple',{diameter:1+i*.5,thickness:.035,tessellation:20},scene);t.parent=r;t.material=edge;t.position.set(0,.24,0);}}else if(o.type==='ice'){box('water chasm',0,.13,0,2.9,.15,5,water,r);for(const z of [-2.7,2.7])box('broken bank',0,.15,z,3.1,.4,.4,edge,r);}else if(o.type==='flight'){box('ruined wall',0,1.15,0,2.8,2.3,.9,stone,r);for(let i=0;i<3;i++)box('broken crenellation',i-1,2.4,0,.55,.45,1,edge,r);}else if(o.type==='speed'){for(const x of [-1.35,1.35])box('portcullis pier',x,2,0,.4,4,.7,stone,r);box('gate lintel',0,4,0,3.1,.5,.9,edge,r);for(let i=0;i<6;i++)box('iron gate bar',-1.1+i*.44,2.3,0,.09,3.2,.13,dark,r);for(const y of [1.3,2.6,3.5])box('gate crossbar',0,y,0,2.7,.10,.15,gold,r);}else {const w=wizard('voldemort');w.root.parent=r;w.root.rotation.y=Math.PI;ball('blocker stun marker',0,3,0,.3,curse,r);}return r;}
  const aura=B.MeshBuilder.CreateTorus('active power ring',{diameter:1.5,thickness:.08,tessellation:24},scene);aura.material=aqua;aura.setEnabled(false);
  const warning=box('curse danger lane',0,.15,0,2.6,.045,5,curse);warning.visibility=.45;warning.setEnabled(false);
  const enemyBolt=ball('incoming killing curse',0,2,0,.48,curse);enemyBolt.setEnabled(false);
  const bolts=Array.from({length:12},(_,i)=>{const m=ball('spell bolt',0,0,0,.3,i%2?curse:magic);m.setEnabled(false);return m;});
  let elapsed=0, lastPhase='',camZ=-13;const target=new B.Vector3();
  function render(state,dt=.016){elapsed+=Math.min(dt,.1);const menu=!state;const player=state?.racers?.find(r=>r.id===state.playerId)||state?.racers?.[0];const z=player?.distance||0;const battle=state?.phase==='battle';
    for(const m of landscape.getChildMeshes()){if(m.name.startsWith('arrival ')||m.name==='courtyard arch')m.setEnabled(!menu&&z>30);}
    landscape.position.z=menu?0:Math.floor(z/72)*72; // Reuse one detailed campus as the race passes through its grounds.
    for(const [id,c] of Object.entries(racers)){const r=state?.racers?.find(v=>v.id===id);c.root.setEnabled(!state||!!r);if(!r){c.root.position.set(id==='harry'?-1.8:id==='ron'?1.8:0,0,0);c.root.rotation.y=Math.PI;}else{c.root.position.set(r.x,(r.jump||0)+(state.power==='flight'&&r.activeUntil>state.time?1.7:0),r.distance);c.root.rotation.y=0;}
      const run=state&&state.phase!=='countdown'&&(r?.mode==='running'||r?.mode==='finishing');for(let i=0;i<c.limbs.length;i++)c.limbs[i].rotation.x=run?Math.sin(elapsed*12+(i%2)*Math.PI)*.50:Math.sin(elapsed*1.8+i)*.06;
      c.root.position.y+=Math.sin(elapsed*3)*.025;
    }
    if(menu){const narrow=engine.getRenderWidth()<600;camera.position.set(narrow?0:2, narrow?4:3.6,narrow?-16:-9);target.set(narrow?0:2,1.9,1);camera.setTarget(target);}else{const desired=new B.Vector3((player?.x||0)*.43,battle?4.8:5.1,z-(battle?10:11));camera.position=B.Vector3.Lerp(camera.position,desired,lastPhase!==state.phase?1:Math.min(1,dt*5));target.set((player?.x||0)*.2,1.8,z+(battle?10:14));camera.setTarget(target);}
    if(!state||racePower!==state.power){for(const m of obstacles.values())m.dispose(false,false);obstacles.clear();racePower=state?.power||'';}
    const active=!!player&&player.activeUntil>state.time; aura.setEnabled(active);if(active){aura.position.set(player.x,.18+(player.jump||0)+(state.power==='flight'?1.7:0),z);aura.rotation.y=elapsed*2;aura.scaling.setAll(1+Math.sin(elapsed*9)*.1);aura.material=state.power==='ice'?aqua:magic;}
    const visible=new Set();for(const o of state?.obstacles||[]){if(o.z<z-16||o.z>z+100)continue;visible.add(o.id);let m=obstacles.get(o.id);if(!m){m=obstacle(o);obstacles.set(o.id,m);}m.setEnabled(!o.resolved);if(o.type==='stun'){const frozen=o.stunnedUntil>state.time;const blocker=m.getChildren()[0];if(blocker)blocker.rotation.z=frozen?.35:0;m.getChildMeshes().forEach(v=>{if(v.name==='blocker stun marker'){v.material=frozen?aqua:curse;v.scaling.setAll(frozen?1.8:1);}});}if(o.type==='speed'){const deadline=o.gateApproaches?.[state.playerId];const gateProgress=deadline===undefined?0:Math.max(0,Math.min(1,1-(deadline-state.time)/1.55));const opening=gateProgress<1;for(const part of m.getChildMeshes()){if(part.name==='iron gate bar')part.position.y=4.7-gateProgress*2.4;if(part.name==='gate crossbar')part.position.y=part.name==='gate crossbar'?(part._originalY??(part._originalY=part.position.y))+2.4*(1-gateProgress):part.position.y;}}if(o.type==='ice'&&player&&state.power==='ice'&&player.activeUntil>state.time&&Math.abs(o.z-z)<17){m.getChildMeshes()[0].material=aqua;m.getChildMeshes()[0].position.y=.18;}}
    for(const [id,m]of obstacles)if(!visible.has(id)){m.dispose(false,false);obstacles.delete(id);}
    finish.setEnabled(!!state);finish.position.z=(state?.trackLength||1200)+8;
    boss.root.setEnabled((battle||state?.phase==='finished')&&(player?.bossHp??3)>0);boss.root.position.set(0,0,(state?.trackLength||1200)+12);boss.root.rotation.y=Math.PI;
    bolts.forEach((m,i)=>{const p=state?.projectiles?.[i];const source=p&&state.racers.find(r=>r.id===p.racerId);m.setEnabled(!!source&&state.time<p.impactAt+.08);if(source){const progress=Math.max(0,Math.min(1,(state.time-p.firedAt)/(p.impactAt-p.firedAt)));const endX=p.hit?0:p.lane*3; m.material=magic;m.position.set(source.x+(endX-source.x)*progress,1.65+(Math.sin(progress*Math.PI)*.35),source.distance+1.5+((state.trackLength+12)-(source.distance+1.5))*progress);m.scaling.set(1,1,2.6);}});
    const attack=player?.bossAttack;warning.setEnabled(!!attack);enemyBolt.setEnabled(!!attack);if(attack){const progress=Math.max(0,Math.min(1,(state.time-attack.firedAt)/(attack.impactAt-attack.firedAt)));warning.position.set(attack.lane*3,.16,z);warning.visibility=.25+.25*Math.sin(elapsed*15)**2;enemyBolt.position.set(attack.lane*3,1.6,state.trackLength+11-((state.trackLength+11)-z)*progress);enemyBolt.scaling.set(1,1,2.4);}
    motes.forEach((m,i)=>{m.position.y=2+(i%6)+Math.sin(elapsed+i)*.6;});lastPhase=state?.phase||'';scene.render();
  }
  return {engine,scene,render,resize(){engine.resize();},dispose(){scene.dispose();engine.dispose();}};
}
