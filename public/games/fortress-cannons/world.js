import { MAP } from './model.js';

// All scenery and characters are original geometry built from Babylon primitives.
export function createWorld(canvas, initialGame) {
  const B = globalThis.BABYLON;
  if (!B) throw new Error('מנוע התלת־ממד לא נטען');
  const engine = new B.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  engine.setHardwareScalingLevel(Math.min(2, Math.max(1, (globalThis.devicePixelRatio || 1) / 1.5)));
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.67, 0.86, 0.96, 1);
  scene.fogMode = B.Scene.FOGMODE_LINEAR;
  scene.fogStart = 43;
  scene.fogEnd = 120;
  scene.fogColor = new B.Color3(0.67, 0.86, 0.96);
  const camera = new B.FreeCamera('eyes', new B.Vector3(0, 1.65, -31), scene);
  camera.minZ = 0.06;
  camera.maxZ = 190;
  camera.fov = 1.12;
  camera.inputs.clear();
  const light = new B.HemisphericLight('sky-light', new B.Vector3(0.3, 1, 0.2), scene);
  light.intensity = 0.75;
  light.groundColor = new B.Color3(0.43, 0.5, 0.39);
  const sun = new B.DirectionalLight('afternoon', new B.Vector3(-0.5, -1, 0.35), scene);
  sun.intensity = 0.35;
  const mats = {};
  function material(name, hex, emissive = 0) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.specularColor = new B.Color3(0.12, 0.12, 0.12);
    m.emissiveColor = m.diffuseColor.scale(emissive);
    mats[name] = m;
    return m;
  }
  const blue = material('blue', '#287CC9');
  const coral = material('coral', '#EF716A');
  const neutral = material('neutral', '#C8B6E6');
  const cream = material('cream', '#FFF1D1');
  const stone = material('stone', '#F0DFC2');
  const stoneDark = material('stone-dark', '#CAB994');
  const gold = material('gold', '#FFD45E', 0.35);
  const purple = material('purple', '#A47DF5', 0.25);
  const cyan = material('cyan', '#7BF2DE', 0.5);
  const leaf = material('leaf', '#71B894');
  const leafLight = material('leaf-light', '#99CBA0');
  const trunk = material('trunk', '#BE986F');
  const dark = material('dark', '#233C57');
  const skin = material('skin', '#F6C7A0');
  const hair = material('hair', '#5C3A31');
  const white = material('white', '#FFFCF3');
  const grass = material('grass', '#9ACB93');
  const path = material('path', '#EAD6A8');
  const water = material('water', '#74CEE2', 0.08);
  const mountain = material('mountain', '#A0B9BC');
  const distant = material('distant', '#B2CFD1');
  const pink = material('flower', '#F4A3B2');
  const heartTexture = new B.DynamicTexture('guard heart artwork', {width:128,height:128}, scene, false);
  heartTexture.hasAlpha = true;
  const heartCanvas = heartTexture.getContext();
  heartCanvas.clearRect(0,0,128,128);
  heartCanvas.fillStyle = '#EF516A';
  // Original heart silhouette: two rounded lobes and a pointed base.
  heartCanvas.beginPath();
  heartCanvas.moveTo(64,112);
  heartCanvas.bezierCurveTo(49,97,8,66,8,38);
  heartCanvas.bezierCurveTo(8,6,48,0,64,30);
  heartCanvas.bezierCurveTo(80,0,120,6,120,38);
  heartCanvas.bezierCurveTo(120,66,79,97,64,112);
  heartCanvas.fill();
  heartTexture.update();
  const heartMaterial = material('guard hearts', '#FFFFFF', 1);
  heartMaterial.diffuseTexture = heartTexture;
  heartMaterial.useAlphaFromDiffuseTexture = true;
  heartMaterial.disableLighting = true;
  heartMaterial.backFaceCulling = false;
  function put(mesh, x, y, z, mat, parent) {
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    if (parent) mesh.parent = parent;
    return mesh;
  }
  function box(name, x, y, z, w, h, d, mat, parent) {
    return put(B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), x, y, z, mat, parent);
  }
  function ball(name, x, y, z, size, mat, parent, segments = 8) {
    return put(B.MeshBuilder.CreateSphere(name, { diameter: size, segments }, scene), x, y, z, mat, parent);
  }
  function cylinder(name, x, y, z, diameter, height, mat, parent, top = diameter, tessellation = 12) {
    return put(B.MeshBuilder.CreateCylinder(name, { diameter, diameterTop: top, diameterBottom: diameter, height, tessellation }, scene), x, y, z, mat, parent);
  }
  function ring(name, x, y, z, diameter, thickness, mat, parent) {
    return put(B.MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 24 }, scene), x, y, z, mat, parent);
  }
  function flatPath(name, x1, z1, x2, z2, width) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const mesh = box(name, (x1+x2)/2, 0.018, (z1+z2)/2, width, 0.04, length, path);
    mesh.rotation.y = Math.atan2(x2-x1, z2-z1);
  }
  box('meadow', 0, -0.2, 0, 170, 0.4, 170, grass);
  // Low meadow rails explain the simulation's arena boundary.
  for (const side of [-1,1]) {
    box('boundary rail',side*MAP.halfSize,0.65,0,0.16,0.14,MAP.halfSize*2,cream);
    box('boundary rail',0,0.65,side*MAP.halfSize,MAP.halfSize*2,0.14,0.16,cream);
    for(let k=-36;k<=36;k+=6) {
      box('fence post',side*MAP.halfSize,0.48,k,0.22,0.96,0.22,trunk);
      box('fence post',k,0.48,side*MAP.halfSize,0.22,0.96,0.22,trunk);
    }
  }
  flatPath('main avenue', 0, -36, 0, 36, 5.5);
  flatPath('left trail', 0, -20, -20, 0, 3.1);
  flatPath('right trail', 0, -20, 20, 0, 3.1);
  flatPath('left trail north', -20, 0, 0, 26, 3.1);
  flatPath('right trail north', 20, 0, 0, 26, 3.1);
  flatPath('middle trail', -20, 0, 20, 0, 3.1);
  // A distant river and bridges sit outside the playable boundary.
  box('river', 0, -0.02, 45, 160, 0.08, 7, water);
  for (const x of [-23, 0, 23]) {
    box('distant bridge', x, 0.16, 45, 4, 0.32, 11, stoneDark);
    for (const side of [-1, 1]) box('bridge rail', x + side*1.8, 0.8, 45, 0.16, 0.8, 11, cream);
  }
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI * 2 / 24;
    const radius = 72 + (i % 4) * 5;
    const peak = cylinder('soft mountain', Math.sin(angle)*radius, 7, Math.cos(angle)*radius, 25 + i%3*5, 18+i%4*4, i%2 ? mountain : distant, null, 0, 5);
    peak.rotation.y = i;
  }
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const root = new B.TransformNode('cloud', scene);
    root.position.set(Math.sin(i*2.2)*65, 20+i%3*4, Math.cos(i*2.2)*65);
    for (let k = 0; k < 3; k++) {
      const puff = ball('cloud puff', (k-1)*3.3, k===1 ? 0.5 : 0, 0, 5, white, root);
      puff.scaling.y = 0.48;
    }
    clouds.push(root);
  }
  function tree(x, z, n) {
    cylinder('tree trunk', x, 1.05, z, 0.5, 2.1, trunk, null, 0.38, 7);
    const crown = ball('round tree crown', x, 3.3, z, 3.8, n%2 ? leaf : leafLight, null, 6);
    crown.scaling.y = 1.15;
  }
  for (let i = 0; i < 36; i++) {
    const side = i%2 ? 1 : -1;
    tree(side*(42+(i%4)*3), -39+Math.floor(i/2)*4.6, i);
  }
  // Meadow details remain low enough to walk through freely.
  for (let i = 0; i < 80; i++) {
    const x = Math.sin(i*17.31)*35;
    const z = Math.cos(i*9.73)*35;
    if (Math.abs(x) < 5 || initialGame.forts.some(f => Math.hypot(x-f.x,z-f.z)<7)) continue;
    const flower = ball('meadow blossom', x, 0.16, z, 0.22, i%3 ? cream : pink, null, 4);
    flower.scaling.y = 0.6;
  }
  const fortressViews = new Map();
  function teamMaterial(team) { return team === 'blue' ? blue : team === 'coral' ? coral : neutral; }
  // Wall footprints come directly from the simulation, keeping gateways open.
  for (const obstacle of MAP.obstacles) {
    const w = obstacle.w ?? obstacle.width;
    const d = obstacle.d ?? obstacle.depth;
    if (obstacle.kind === 'tower') continue;
    box('garden barricade', obstacle.x, 1.0, obstacle.z, w, 2.0, d, stoneDark);
    box('barricade top', obstacle.x, 2.03, obstacle.z, w, 0.12, d, cream);
    const horizontal = w > d;
    const count = Math.max(1, Math.floor((horizontal?w:d)/1.2));
    for (let k=0;k<count;k++) {
      const offset = (k-(count-1)/2)*1.2;
      box('crenellation', obstacle.x+(horizontal?offset:0), 2.35, obstacle.z+(horizontal?0:offset), horizontal?0.68:w, 0.6, horizontal?d:0.68, cream);
    }
  }
  for (const fort of initialGame.forts) {
    const root = new B.TransformNode(`fort ${fort.id}`, scene);
    root.position.set(fort.x, 0, fort.z);
    const colored = [];
    const mat = teamMaterial(fort.owner);
    for (const tx of [-4,4]) for (const tz of [-4,4]) {
      const h = tz > 0 ? 6.3 : 5.1;
      cylinder('ivory fortress tower',tx,h/2,tz,1.2,h,stone,root,1.2,12);
      colored.push(cylinder('tower team band',tx,h-0.3,tz,1.24,0.65,mat,root));
      cylinder('tower balcony',tx,h+0.08,tz,1.5,0.26,cream,root);
      colored.push(cylinder('pointed turret roof',tx,h+0.8,tz,1.65,1.3,mat,root,0,8));
      ball('turret tip',tx,h+1.48,tz,0.17,gold,root);
      box('tower window',tx,h-1.4,tz-0.605,0.34,0.7,0.03,dark,root);
      for(let k=0;k<6;k++) {
        const a=k*Math.PI/3;
        box('tower battlement',tx+Math.sin(a)*0.62,h+0.34,tz+Math.cos(a)*0.62,0.23,0.4,0.23,cream,root);
      }
    }
    // The elevated gateway is fully passable below its arch.
    colored.push(box('gate arch',0,3.9,-4,6.9,0.65,0.7,mat,root));
    box('arch crown',0,4.35,-4,2.1,0.28,0.75,cream,root);
    const emblem=ball('gate gold medallion',0,3.95,-4.39,0.55,gold,root);
    emblem.scaling.z=0.18;
    const gx = (fort.gateX ?? fort.x) - fort.x;
    const gz = (fort.gateZ ?? fort.z - 3.8) - fort.z;
    // Flags rise above the actual walls; entrance is marked by floor arrows.
    for (const side of [-1,1]) {
      cylinder('flagpole', gx+side*2, 4.8, gz, 0.11, 4, cream, root);
      colored.push(box('team flag', gx+side*2+0.65, 6.1, gz, 1.3, 0.8, 0.07, mat, root));
      ball('flag finial', gx+side*2, 6.85, gz, 0.22, gold, root);
    }
    const seal = cylinder('capture seal', gx, 0.06, gz, 2.5, 0.06, mat, root, 2.5, 24);
    colored.push(seal);
    const marking = ring('gate rim', gx, 0.10, gz, 2.7, 0.10, gold, root);
    marking.isPickable = false;
    fortressViews.set(fort.id, { colored, owner: fort.owner });
  }
  const actorViews = new Map();
  function makeActor(actor, isGuard) {
    const root = new B.TransformNode(`actor ${actor.id}`, scene);
    const suit = teamMaterial(actor.team);
    const leftLeg = box('left boot', -0.18, 0.3, 0, 0.28, 0.6, 0.34, dark, root);
    const rightLeg = box('right boot', 0.18, 0.3, 0, 0.28, 0.6, 0.34, dark, root);
    cylinder('suit body', 0, 0.96, 0, 0.76, 0.77, suit, root, 0.65);
    box('belt', 0, 0.67, 0, 0.77, 0.12, 0.44, white, root);
    ball('head', 0, 1.62, 0, 0.59, skin, root);
    const cap = ball('hair', 0, 1.81, -0.035, 0.61, hair, root);
    cap.scaling.y = 0.5;
    cylinder('helmet band', 0, 1.86, 0, 0.66, 0.13, suit, root);
    for (const side of [-1,1]) {
      ball('eye', side*0.105, 1.65, 0.272, 0.055, dark, root, 6);
      const arm = box('sleeve', side*0.46, 1.03, 0.12, 0.25, 0.51, 0.28, suit, root);
      arm.rotation.x = -0.4;
      ball('mitten', side*0.46, 0.83, 0.22, 0.23, skin, root);
    }
    const barrel = cylinder('toy cannon', 0.32, 1.02, 0.48, 0.21, 0.7, cream, root);
    barrel.rotation.x = Math.PI/2;
    const nozzle = cylinder('cannon nozzle', 0.32, 1.02, 0.86, 0.25, 0.10, suit, root);
    nozzle.rotation.x = Math.PI/2;
    ball('paint tank', 0.32, 1.23, 0.49, 0.25, suit, root);
    const pips = [];
    if (isGuard) {
      const shield = box('guard shield', -0.47, 1.0, 0.4, 0.52, 0.65, 0.12, gold, root);
      shield.rotation.z = -0.15;
      box('shield stripe', -0.47, 1.0, 0.48, 0.12, 0.5, 0.02, suit, root);
      for (let i=0;i<3;i++) {
        const heart = put(B.MeshBuilder.CreatePlane('guard heart', {size:0.25}, scene), (i-1)*0.28, 2.34, 0, heartMaterial, root);
        heart.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
        pips.push(heart);
      }
      cylinder('guard helmet', 0, 1.96, 0, 0.68, 0.18, gold, root, 0.5);
    }
    return { root, leftLeg, rightLeg, pips };
  }
  const keyViews = new Map();
  function makeKey(key) {
    const root = new B.TransformNode(`key ${key.id}`, scene);
    const loop = ring('key loop', 0, 0.25, 0, 0.6, 0.13, gold, root);
    loop.rotation.x = Math.PI/2;
    box('key shaft', 0, -0.25, 0, 0.14, 0.65, 0.14, gold, root);
    box('key tooth', 0.15, -0.48, 0, 0.32, 0.14, 0.14, gold, root);
    ring('key floor halo', 0, -1.15, 0, 1.5, 0.045, cream, root);
    return root;
  }
  const circleViews = new Map();
  const projectileViews = new Map();
  const spareProjectiles = [];
  const cannon = new B.TransformNode('your paint cannon', scene);
  cannon.parent = camera;
  cannon.position.set(0.40, -0.38, 0.72);
  cannon.scaling.setAll(0.65);
  box('cannon body', 0, 0, 0, 0.24, 0.24, 0.48, blue, cannon);
  const barrel = cylinder('your barrel', 0, 0.04, 0.29, 0.19, 0.56, cream, cannon);
  barrel.rotation.x = Math.PI/2;
  const muzzle = cylinder('your muzzle', 0, 0.04, 0.59, 0.23, 0.09, blue, cannon);
  muzzle.rotation.x = Math.PI/2;
  const tank = ball('your paint tank', 0, 0.21, -0.03, 0.29, cyan, cannon);
  tank.scaling.y = 1.1;
  cylinder('tank cap', 0, 0.38, -0.03, 0.14, 0.06, gold, cannon);
  box('your mitten', 0.0, -0.18, -0.10, 0.19, 0.21, 0.22, skin, cannon);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const paintPulse = ball('paint muzzle pulse', 0, 0.04, 0.69, 0.20, cyan, cannon);
  paintPulse.setEnabled(false);
  let previousShotCooldown = 0;
  let recoil = 0;
  let time = 0;
  function render(game, dt = 0.016) {
    time += Math.min(dt, 0.05);
    const p = game.player;
    if ((p.shotCooldown || 0) > previousShotCooldown + 0.1) recoil = 1;
    previousShotCooldown = p.shotCooldown || 0;
    recoil = Math.max(0, recoil - Math.min(dt, 0.05) * 9);
    paintPulse.setEnabled(recoil > 0.45);
    paintPulse.scaling.setAll(0.6 + recoil * 0.7);
    cannon.position.z = 0.72 - (reducedMotion ? 0 : recoil * 0.075);
    camera.position.set(p.x, 1.65, p.z);
    camera.rotation.set(0, p.yaw || 0, 0);
    cannon.position.y = -0.38 + (reducedMotion ? 0 : Math.sin(time*2)*0.006);
    for (const fort of game.forts) {
      const view = fortressViews.get(fort.id);
      if (view && view.owner !== fort.owner) {
        view.owner = fort.owner;
        for (const mesh of view.colored) mesh.material = teamMaterial(fort.owner);
      }
    }
    const activeActors = new Set();
    for (const actor of [...game.actors, ...game.guards]) {
      if (actor.id === p.id) continue;
      activeActors.add(actor.id);
      let view = actorViews.get(actor.id);
      if (!view) {
        view = makeActor(actor, game.guards.includes(actor));
        actorViews.set(actor.id, view);
      }
      view.root.position.set(actor.x, 0, actor.z);
      view.root.rotation.y = actor.yaw || 0;
      const step = reducedMotion || game.ended ? 0 : Math.sin(time*7+actor.x)*0.10;
      view.leftLeg.rotation.x = step;
      view.rightLeg.rotation.x = -step;
      view.pips.forEach((pip,i) => pip.setEnabled(i < actor.hp));
    }
    for (const [id,view] of actorViews) if (!activeActors.has(id)) { view.root.dispose(); actorViews.delete(id); }
    const activeKeys = new Set();
    for (const key of game.keys) {
      activeKeys.add(key.id);
      let view = keyViews.get(key.id);
      if (!view) { view=makeKey(key); keyViews.set(key.id,view); }
      view.position.set(key.x, 1.3+(reducedMotion?0:Math.sin(time*2.4)*0.12), key.z);
      view.rotation.y = reducedMotion ? 0.6 : time*0.8;
    }
    for (const [id,view] of keyViews) if (!activeKeys.has(id)) {view.dispose();keyViews.delete(id);}
    for (const circle of game.circles) {
      let view = circleViews.get(circle.id);
      if (!view) {
        const root = new B.TransformNode(`charge ${circle.id}`,scene);
        root.position.set(circle.x,0.08,circle.z);
        ring('charge outer',0,0,0,2.7,0.15,purple,root);
        ring('charge inner',0,0.015,0,2.1,0.07,cyan,root);
        for (let i=0;i<4;i++) {
          const a=i*Math.PI/2;
          const gem=ball('charge gem',Math.sin(a)*1.2,0.34,Math.cos(a)*1.2,0.23,cyan,root,4);
          gem.scaling.y=1.7;
        }
        view=root;circleViews.set(circle.id,view);
      }
      view.setEnabled(!circle.cooldown);
    }
    const activeProjectiles = new Set();
    for (const shot of game.projectiles) {
      activeProjectiles.add(shot.id);
      let mesh=projectileViews.get(shot.id);
      if (!mesh) {
        mesh=spareProjectiles.pop() || ball('paint splat',0,0,0,0.21,blue,null,6);
        mesh.setEnabled(true);projectileViews.set(shot.id,mesh);
      }
      mesh.material=teamMaterial(shot.team);
      mesh.position.set(shot.x,1.65,shot.z);
    }
    for (const [id,mesh] of projectileViews) if(!activeProjectiles.has(id)) {
      mesh.setEnabled(false);spareProjectiles.push(mesh);projectileViews.delete(id);
    }
    scene.render();
  }
  render(initialGame,0);
  return {
    render,
    resize() { engine.resize(); },
    dispose() { scene.dispose(); engine.dispose(); }
  };
}
