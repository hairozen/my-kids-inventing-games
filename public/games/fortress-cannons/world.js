import { MAP, TEAMS } from './model.js';

// The arena is built from original geometry and canvas artwork.
export function createWorld(canvas, initialGame) {
  const B = globalThis.BABYLON;
  if (!B) throw new Error('מנוע התלת־ממד לא נטען');
  const engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false });
  engine.setHardwareScalingLevel(Math.max(1, (globalThis.devicePixelRatio || 1) / 1.5));
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.135, 0.33, 0.43, 1);
  const rise = 43;
  const setback = 45;
  const groundProjection = rise / Math.hypot(rise, setback);
  const camera = new B.FreeCamera('arena camera', new B.Vector3(0, rise, -setback), scene);
  camera.setTarget(B.Vector3.Zero());
  camera.mode = B.Camera.ORTHOGRAPHIC_CAMERA;
  camera.inputs.clear();
  camera.minZ = 0.1;
  camera.maxZ = 210;

  const sky = new B.HemisphericLight('soft sky', new B.Vector3(0, 1, 0), scene);
  sky.intensity = 0.73;
  sky.diffuse = new B.Color3(0.84, 0.92, 1);
  sky.groundColor = new B.Color3(0.39, 0.49, 0.62);
  const sun = new B.DirectionalLight('morning light', new B.Vector3(0.67, -1.22, 0.51), scene);
  sun.intensity = 0.48;
  sun.diffuse = new B.Color3(1, 0.89, 0.75);
  sun.position.set(-38, 69, -29);
  sun.autoUpdateExtends = false;
  sun.shadowFrustumSize = 78;
  sun.shadowMinZ = 18;
  sun.shadowMaxZ = 150;
  const shadows = new B.ShadowGenerator(1536, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.001;
  shadows.normalBias = 0.04;
  shadows.darkness = 0.29;
  function addShadows(meshes) {
    for (const mesh of meshes) shadows.addShadowCaster(mesh, false);
  }

  function material(name, hex, glow = 0) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.specularColor = new B.Color3(0.08, 0.08, 0.08);
    m.emissiveColor = m.diffuseColor.scale(glow);
    return m;
  }

  const ink = material('deep navy', '#16344A');
  const shell = material('white character shell', '#F5FAFF', 0.17);
  const arenaEdge = material('ivory arena edge', '#D9DCD5');
  const cream = material('porcelain', '#F9F2E5');
  const white = material('pure light', '#FFFEFC', 0.25);
  const stone = material('limestone', '#DDDDD3');
  const stoneShade = material('weathered limestone', '#8B9B9E');
  const stoneVariants = ['#E8E9E1', '#F3F1E7', '#DCE4E1', '#D4DAD4', '#FAF7EC']
    .map((hex, i) => material('carved block ' + i, hex));
  const gold = material('brass', '#D8A854');
  const terracotta = material('terracotta mosaic', '#526E76');
  const projectileShade = material('projectile shadow', '#A6AAA5');
  const cliff = material('island cliffs', '#586F79');
  const sand = material('shore sand', '#B1C2BA');
  const shallows = material('shallows', '#659EAC');
  const foam = material('sea foam', '#A0D3CF');
  const wood = material('bark', '#755849');
  const foliage = ['#275C51', '#47805A', '#70A062', '#A9B46B', '#C59768']
    .map((hex, i) => material('foliage ' + i, hex));
  const neutral = material('unclaimed paint', '#647B8C');
  const teamMaterials = Object.fromEntries(Object.entries(TEAMS).map(([team, data]) => [
    team, {
      suit: material(team + ' suit', data.color),
      paint: material(team + ' paint', data.color, 0.23),
    },
  ]));
  const suitFor = (team) => teamMaterials[team]?.suit ?? neutral;
  const paintFor = (team) => teamMaterials[team]?.paint ?? neutral;
  const facets = { green: 32, red: 4, yellow: 3 };

  let scenery = new Map();
  function place(mesh, x, y, z, mat, parent, batch = true) {
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    if (parent) mesh.parent = parent;
    if (scenery && !parent && batch) {
      if (!scenery.has(mat)) scenery.set(mat, []);
      scenery.get(mat).push(mesh);
    }
    return mesh;
  }

  function box(name, x, y, z, w, h, d, mat, parent) {
    return place(B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene), x, y, z, mat, parent);
  }

  function sphere(name, x, y, z, size, mat, parent, segments = 7) {
    return place(B.MeshBuilder.CreateSphere(name, { diameter: size, segments }, scene), x, y, z, mat, parent);
  }

  function disc(name, x, y, z, diameter, height, mat, parent, sides = 24, top = diameter) {
    const mesh = B.MeshBuilder.CreateCylinder(name, {
      diameterTop: top, diameterBottom: diameter, height, tessellation: sides,
    }, scene);
    return place(mesh, x, y, z, mat, parent);
  }

  function ring(name, x, y, z, diameter, thickness, mat, parent) {
    return place(B.MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 32 }, scene), x, y, z, mat, parent);
  }

  function teamShape(team, x, y, z, size, mat, parent) {
    const badge = disc('team ' + (TEAMS[team]?.symbol ?? '—'), x, y, z, size, 0.10, mat, parent, facets[team] ?? 6);
    if (team === 'red') badge.rotation.y = Math.PI / 4;
    if (team === 'yellow') badge.rotation.y = -Math.PI / 2;
    return badge;
  }

  const edge = MAP.halfSize;
  const waterWidth = 250;

  function noise(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function illustratedGround(name, size, resolution, draw) {
    const texture = new B.DynamicTexture(name, resolution, scene, true);
    const ctx = texture.getContext();
    ctx.scale(resolution / size, resolution / size);
    ctx.translate(size / 2, size / 2);
    draw(ctx);
    texture.update();
    texture.anisotropicFilteringLevel = 8;
    const mat = material(name, '#FFFFFF');
    mat.diffuseTexture = texture;
    return mat;
  }

  function route(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], -points[0][1]);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, z] = points[i];
      const [nextX, nextZ] = points[i + 1];
      ctx.quadraticCurveTo(x, -z, (x + nextX) / 2, -(z + nextZ) / 2);
    }
    ctx.lineTo(points.at(-1)[0], -points.at(-1)[1]);
  }

  const [west, east] = initialGame.cannons;
  const routes = [
    ...initialGame.forts.map(fort => [[fort.x, fort.z], [fort.x * 0.55, fort.z * 0.62], [0, 0]]),
    initialGame.forts.map(fort => [fort.x, fort.z]).concat([[initialGame.forts[0].x, initialGame.forts[0].z]]),
    [[west.x, west.z], [0, 0], [east.x, east.z]],
  ];
  const floorWidth = edge * 2 + 7;
  const floor = illustratedGround('porcelain arena paving', floorWidth, 3072, ctx => {
    const half = floorWidth / 2;
    ctx.fillStyle = '#f9fbfa';
    ctx.fillRect(-half, -half, floorWidth, floorWidth);

    // Skew-brick joints are lightly sunk into the white porcelain.
    const tileWidth = 3.8;
    const tileHeight = 2.32;
    const tiles = ['#f6f8f5', '#fdfcf7', '#fcfaf7', '#f8f9f7', '#f2f5f4', '#fcfcf9'];
    for (let row = -29; row <= 29; row++) {
      for (let column = -18; column <= 18; column++) {
        const x = (column + (Math.abs(row) % 2) * 0.5) * tileWidth;
        const z = row * tileHeight;
        const seed = row * 109 + column * 17;
        ctx.fillStyle = '#dce5e4';
        ctx.fillRect(x, z, tileWidth, tileHeight);
        ctx.beginPath();
        ctx.roundRect(x + 0.035, z + 0.035, tileWidth - 0.07, tileHeight - 0.07, 0.15);
        ctx.fillStyle = tiles[Math.floor(noise(seed) * tiles.length)];
        ctx.fill();
        ctx.fillStyle = '#ffffffb5';
        ctx.fillRect(x + 0.17, z + 0.07, tileWidth - 0.34, 0.055);
        if (noise(seed + 7) > 0.91) {
          ctx.beginPath();
          ctx.moveTo(x + tileWidth * 0.59, z + tileHeight);
          ctx.lineTo(x + tileWidth * 0.71, z + tileHeight * 0.73);
          ctx.lineTo(x + tileWidth * 0.87, z + tileHeight * 0.56);
          ctx.lineTo(x + tileWidth, z + tileHeight * 0.47);
          ctx.strokeStyle = '#90a4a445';
          ctx.lineWidth = 0.028;
          ctx.stroke();
        }
      }
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, color] of [[5.7, '#bac9c9'], [5.51, '#fffefa'], [5.16, '#afc7c4'], [4.72, '#f6f4eb']]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      for (const points of routes) {
        route(ctx, points);
        ctx.stroke();
      }
    }

    // Mosaic accents link each courtyard without introducing collision geometry.
    function tileDiamond(x, y, radius, fill, border) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = border;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(x, y - radius);
      ctx.quadraticCurveTo(x + radius * 0.35, y - radius * 0.35, x + radius, y);
      ctx.quadraticCurveTo(x + radius * 0.35, y + radius * 0.35, x, y + radius);
      ctx.quadraticCurveTo(x - radius * 0.35, y + radius * 0.35, x - radius, y);
      ctx.quadraticCurveTo(x - radius * 0.35, y - radius * 0.35, x, y - radius);
      ctx.fill();
      ctx.stroke();
    }
    for (const fort of initialGame.forts) {
      for (let i = 0; i < 8; i++) {
        const angle = (i + 0.5) * Math.PI / 4;
        const x = fort.x + Math.cos(angle) * 11.7;
        const y = -fort.z + Math.sin(angle) * 11.7;
        tileDiamond(x, y, 1.21, '#dae7e4', '#91b0ad');
        tileDiamond(x, y, 0.49, '#f9f6e7', '#a3b8b3');
      }
    }

    function court(x, z, radius, color) {
      const y = -z;
      for (const [r, fill] of [[radius, '#bdcfcd'], [radius - 0.14, '#ffffff'], [radius - 0.36, '#e6eeeb'], [radius - 0.78, color], [radius - 0.91, '#f9f9f4']]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = '#c3d2d0';
      ctx.lineWidth = 0.055;
      for (let i = 0; i < 32; i++) {
        const angle = i * Math.PI / 16;
        const inner = radius - (i % 4 === 0 ? 2.25 : 1.07);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * (radius - 0.11), y + Math.sin(angle) * (radius - 0.11));
        ctx.stroke();
      }
    }

    for (const fort of initialGame.forts) court(fort.x, fort.z, 8.25, '#9bb5b3');
    for (const cannon of initialGame.cannons) court(cannon.x, cannon.z, 4.6, '#92b7bf');
    court(0, 0, 9.3, '#6d939c');

    // The low contrast petals make the centre recognizable at a glance.
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -7.4);
      ctx.quadraticCurveTo(3.1, -3.0, 0, -0.9);
      ctx.quadraticCurveTo(-3.1, -3.0, 0, -7.4);
      ctx.fillStyle = i % 3 === 0 ? '#b7d5d4' : '#d3e5e4';
      ctx.fill();
      ctx.strokeStyle = '#a3bcbb';
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = '#8fabae';
    ctx.lineWidth = 0.10;
    ctx.strokeRect(-edge, -edge, 2 * edge, 2 * edge);
  });

  const lagoon = illustratedGround('illustrated lagoon', waterWidth, 2048, ctx => {
    const shore = ctx.createRadialGradient(0, 0, 18, 0, 0, 115);
    shore.addColorStop(0, '#81c9be');
    shore.addColorStop(0.45, '#4eacb1');
    shore.addColorStop(1, '#235d7e');
    ctx.fillStyle = shore;
    ctx.fillRect(-waterWidth / 2, -waterWidth / 2, waterWidth, waterWidth);
    ctx.lineCap = 'round';
    for (let i = 0; i < 650; i++) {
      const x = (noise(i * 9) - 0.5) * waterWidth;
      const y = (noise(i * 9 + 1) - 0.5) * waterWidth;
      const length = 0.7 + noise(i * 9 + 2) * 5.4;
      ctx.strokeStyle = ['#c7f0dc47', '#edf7db5d', '#327c943f', '#8ed2cf78'][i % 4];
      ctx.lineWidth = 0.08 + noise(i * 9 + 3) * 0.14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + length * 0.55, y + 0.47, x + length, y + 0.12);
      ctx.stroke();
    }
  });
  place(B.MeshBuilder.CreateGround('lagoon', { width: waterWidth, height: waterWidth }, scene), 0, -4.7, 0, lagoon);

  const shoreline = Array.from({ length: 64 }, (_, i) => {
    const angle = i * Math.PI / 32 + Math.PI / 64;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    const radius = (Math.abs(x) ** 12 + Math.abs(z) ** 12) ** (-1 / 12);
    return [x * radius, z * radius, 0.21 * Math.sin(i * 1.35) + 0.13 * Math.cos(i * 2.65)];
  });

  function islandBand(name, upperHeight, upperInset, lowerHeight, lowerInset, mat) {
    const outline = (y, inset) => shoreline.map(([x, z, wobble]) =>
      new B.Vector3(x * (edge + inset + wobble), y, z * (edge + inset + wobble)));
    const mesh = B.MeshBuilder.CreateRibbon(name, {
      pathArray: [outline(lowerHeight, lowerInset), outline(upperHeight, upperInset)],
      closePath: true,
      sideOrientation: B.Mesh.DOUBLESIDE,
    }, scene);
    const positions = mesh.getVerticesData(B.VertexBuffer.PositionKind);
    const colors = new Float32Array(positions.length / 3 * 4);
    for (let i = 0; i < positions.length; i += 3) {
      const angle = Math.atan2(positions[i + 2], positions[i]);
      const height = positions[i + 1];
      const upper = height === Math.fround(upperHeight);
      const tint = 0.89 + (upper ? 0.09 : 0) + 0.07 * Math.sin(angle * 23 + height * 1.8);
      const offset = i / 3 * 4;
      colors.set([tint, tint, tint, 1], offset);
    }
    mesh.setVerticesData(B.VertexBuffer.ColorKind, colors);
    return place(mesh, 0, 0, 0, mat, null, false);
  }

  islandBand('transparent wash at the shore', -4.60, 6.7, -4.69, 7.2, foam);
  islandBand('sand beneath water', -4.27, 5.2, -4.60, 6.7, shallows);
  islandBand('pebbled beach', -3.82, 3.4, -4.27, 5.2, sand);
  islandBand('weathered rock base', -2.42, 2.4, -3.82, 3.4, cliff);
  islandBand('stratified cliff', -0.71, 2.2, -2.42, 2.4, stoneShade);
  islandBand('arena edge', 0.001, 2.5, -0.71, 2.2, arenaEdge);

  const field = place(B.MeshBuilder.CreateGround('playing field', {
    width: floorWidth, height: floorWidth,
  }, scene), 0, 0, 0, floor);
  field.receiveShadows = true;
  // Match the ground silhouette to the cliff and keep the play surface flat.
  const mask = floor.diffuseTexture.getContext();
  mask.save();
  mask.globalCompositeOperation = 'destination-in';
  mask.fillStyle = '#FFFFFF';
  mask.beginPath();
  shoreline.forEach(([x, z, wobble], i) => {
    const radius = edge + 2.5 + wobble;
    if (i === 0) mask.moveTo(x * radius, -z * radius);
    else mask.lineTo(x * radius, -z * radius);
  });
  mask.closePath();
  mask.fill();
  mask.restore();
  floor.diffuseTexture.hasAlpha = true;
  floor.useAlphaFromDiffuseTexture = true;
  floor.transparencyMode = B.Material.MATERIAL_ALPHATEST;
  floor.diffuseTexture.update();

  function trees(x, z, size, seed) {
    const height = size * (0.8 + 0.45 * noise(seed + 1));
    const palette = seed % 5 < 2 ? [foliage[0], foliage[1], foliage[2]]
      : [foliage[1], foliage[2], foliage[3]];
    disc('bent tree trunk', x, height * 0.42, z, size * 0.18, height * 0.9, wood, null, 7, size * 0.10);
    for (let i = 0; i < 6; i++) {
      const angle = i * 2.4 + seed;
      const offset = (i === 0 ? 0 : 0.26 + noise(seed * 4 + i) * 0.12) * size;
      const crown = sphere('clustered crown', x + Math.cos(angle) * offset, height * (1.03 - i * 0.043),
        z + Math.sin(angle) * offset, size * (i === 0 ? 0.87 : 0.51 + noise(seed + i) * 0.22), palette[i % 3], null, 8);
      crown.scaling.y = 0.84 + noise(seed + i * 10) * 0.50;
      if (i < 3) addShadows([crown]);
    }
  }

  for (let i = -5; i <= 5; i++) {
    const offset = i * 10.7;
    for (const side of [-1, 1]) {
      const seed = 13 * i + 5 * side;
      trees(offset, side * (edge + 1.4), 2.1 + noise(seed) * 2.5, Math.abs(seed));
      trees(side * (edge + 1.35), offset, 1.9 + noise(seed + 46) * 2.6, Math.abs(seed + 88));
    }
  }

  for (let i = 0; i < 64; i++) {
    const [x, z] = shoreline[i];
    const inset = edge + 3.35 + noise(i * 5) * 1.4;
    if (i % 3 !== 0) {
      const rock = sphere('cliff outcrop', x * (edge + 2.38), -2.73 + noise(i) * 1.2, z * (edge + 2.38),
        0.94 + noise(i * 3) * 1.6, i % 4 ? stoneShade : cliff, null, 5);
      rock.scaling.set(0.9, 1.3, 0.74);
      rock.rotation.y = i * 1.17;
    }
    const pebble = sphere('worn beach stone', x * inset, -3.87, z * inset,
      0.36 + noise(i + 4) * 0.96, i % 3 ? stoneShade : stone, null, 5);
    pebble.scaling.set(1, 0.5, 0.68);
    pebble.rotation.y = i * 2.39;
  }

  for (const { x, z, w, d } of MAP.obstacles) {
    const height = 1.21 + noise(x * 2 + z) * 0.33;
    const base = box('garden barrier base', x, 0.17, z, w, 0.34, d, stoneShade);
    box('recessed mortar', x, height / 2, z, w - 0.22, height, d - 0.22, stoneShade);
    const rows = 4;
    const columns = Math.round(w / 0.85);
    for (let row = 0; row < rows; row++) {
      const tileHeight = (height - 0.24) / rows;
      const count = columns + (row % 2);
      for (let j = 0; j < count; j++) {
        const width = (w - 0.12) / count;
        box('porcelain wall block', x - (w - 0.12) / 2 + width * (j + 0.5), 0.24 + (row + 0.5) * tileHeight, z,
          width - 0.043, tileHeight - 0.037, d - 0.10, stoneVariants[(row * 3 + j) % stoneVariants.length]);
      }
    }
    const ledge = box('painted coping', x, height + 0.03, z, w, 0.19, d, cream);
    const bed = box('garden barrier soil', x, height + 0.145, z, w - 0.38, 0.09, d - 0.38, stoneShade);
    const shrubs = Math.floor(w / 0.82);
    for (let i = 0; i < shrubs * 3; i++) {
      const seed = x * 39 + i * 13 + z;
      const px = x + ((i % shrubs + 0.5) / shrubs - 0.5) * (w - 0.54);
      const pz = z + (Math.floor(i / shrubs) - 1) * (d - 1.45) / 2 + (noise(seed + 1) - 0.5) * 0.26;
      const leaf = sphere('pruned foliage', px, height + 0.37, pz, 0.57 + noise(seed + 2) * 0.46, foliage[i % 4]);
      leaf.scaling.y = 0.74 + noise(seed + 3) * 0.5;
      if (i % 4 === 0) {
        const bloom = sphere('garden blossom', px + 0.1, height + 0.77, pz - 0.15, 0.29, i % 8 ? white : gold);
        bloom.scaling.y = 0.59;
      }
    }
    addShadows([base, ledge, bed]);
  }

  // Batch immutable scenery while keeping the ground receiver and water as separate meshes.
  for (const meshes of scenery.values()) {
    if (meshes.length < 2) continue;
    const castsShadow = meshes.some(mesh => shadows.getShadowMap().renderList.includes(mesh));
    const mesh = B.Mesh.MergeMeshes(meshes, true, true);
    if (mesh) {
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      if (castsShadow) addShadows([mesh]);
    }
  }
  scenery = null;

  function makeSign(name, width, height, parent, y, z, pointer = false) {
    const tex = new B.DynamicTexture(name, { width: 512, height: 128 }, scene, false);
    tex.hasAlpha = true;
    const mat = material(name, '#FFFFFF', 1);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    const sign = place(B.MeshBuilder.CreatePlane(name, { width, height }, scene), 0, y, z, mat, parent);
    sign.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    sign.renderingGroupId = pointer ? 1 : 0;
    const ctx = tex.getContext();
    return (label, symbol, fill) => {
      ctx.clearRect(0, 0, 512, 128);
      ctx.beginPath();
      if (pointer) {
        ctx.lineJoin = 'round';
        ctx.roundRect(71, 5, 370, 83, 22);
        ctx.moveTo(202, 86);
        ctx.lineTo(256, 121);
        ctx.lineTo(310, 86);
        ctx.closePath();
      } else {
        ctx.roundRect(5, 9, 502, 110, 32);
      }
      ctx.fillStyle = '#16344A';
      ctx.fill();
      ctx.lineWidth = pointer ? 9 : 6;
      ctx.strokeStyle = '#FFEDCA';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (symbol) {
        ctx.beginPath();
        ctx.roundRect(408, 22, 80, 84, 19);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.font = 'bold 58px Arial, sans-serif';
        ctx.fillStyle = '#FFFDF1';
        ctx.fillText(symbol, 448, 67, 65);
      }
      ctx.fillStyle = '#FFFDF1';
      ctx.direction = 'rtl';
      ctx.font = pointer ? 'bold 79px Arial, sans-serif'
        : symbol ? 'bold 57px Arial, sans-serif' : 'bold 87px Arial, sans-serif';
      ctx.fillText(label, symbol ? 207 : 256, pointer ? 49 : 67, symbol ? 385 : 483);
      tex.update();
    };
  }

  function meter(parent, name, width, y, z) {
    const track = new B.TransformNode(name, scene);
    track.parent = parent;
    track.position.set(0, y, z);
    track.rotation.x = 0.43;
    box(name + ' case', 0, 0, 0, width + 0.14, 0.36, 0.10, ink, track);
    const fill = box(name + ' fill', 0, 0, -0.065, width, 0.22, 0.05, white, track);
    return (amount, mat, show = true) => {
      track.setEnabled(show);
      const proportion = Math.max(0, Math.min(1, amount));
      fill.setEnabled(proportion > 0);
      fill.scaling.x = proportion;
      fill.position.x = -width * (1 - proportion) / 2;
      fill.material = mat;
    };
  }

  function ownership(parent, colored, x, y, z, size) {
    const marks = Object.keys(TEAMS).map(team => [team, teamShape(team, x, y, z, size, white, parent)]);
    const neutralMark = teamShape(null, x, y, z, size * 0.62, stone, parent);
    return (team) => {
      for (const mesh of colored) mesh.material = suitFor(team);
      for (const [key, mesh] of marks) mesh.setEnabled(key === team);
      neutralMark.setEnabled(!team);
    };
  }

  function fortView(fort) {
    const root = new B.TransformNode(fort.id, scene);
    root.position.set(fort.x, 0, fort.z);
    disc('tower cobble footing', 0, 0.059, 0, 7.20, 0.11, stoneShade, root, 32);
    disc('tower cobble court', 0, 0.131, 0, 6.91, 0.060, cream, root, 32);
    for (let i = 0; i < 26; i++) {
      const angle = i * Math.PI / 13;
      const tile = box('flagstone inlay', Math.sin(angle) * 2.95, 0.17, Math.cos(angle) * 2.95,
        0.65, 0.02, 0.37, stoneVariants[i % stoneVariants.length], root);
      tile.rotation.y = angle;
    }

    const form = { 'fort-green': 20, 'fort-red': 8, 'fort-yellow': 6 }[fort.id] ?? 20;
    const plinth = disc('stone tower plinth', 0, 0.32, 0, 4.95, 0.55, stoneShade, root, form, 4.74);
    disc('plinth coping', 0, 0.61, 0, 4.77, 0.17, cream, root, form, 4.45);
    const wall = disc('tower mortar core', 0, 2.37, 0, 4.28, 3.54, stoneShade, root, 24, 4.11);
    const bricks = [];
    for (let row = 0; row < 9; row++) {
      const count = 16;
      for (let i = 0; i < count; i++) {
        const angle = (i + (row % 2) / 2) * Math.PI * 2 / count;
        const radius = 2.14 - 0.006 * row;
        const brick = box('porcelain ashlar', Math.sin(angle) * radius, 0.84 + row * 0.365,
          Math.cos(angle) * radius, 12.55 / count - 0.035, 0.341, 0.19,
          stoneVariants[Math.floor(noise(row * 37 + i * 3) * stoneVariants.length)], root);
        brick.rotation.y = angle;
        bricks.push(brick);
      }
    }

    const fascia = disc('overhanging roof band', 0, 4.27, 0, 4.02, 0.46, stone, root, form, 4.92);
    const ledge = disc('white roof ledge', 0, 4.55, 0, 4.98, 0.19, cream, root, form);
    const colored = [
      disc('owner enamel inset', 0, 4.71, 0, 4.67, 0.15, neutral, root, form),
      ring('owner courtyard ring', 0, 0.052, 0, 11.2, 0.11, neutral, root),
    ];
    const casters = [plinth, wall, fascia, ledge];
    const columns = form === 20 ? 12 : form;
    for (let i = 0; i < columns; i++) {
      const angle = (i + 0.02) * Math.PI * 2 / columns;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const support = box('white carved corbel', sin * 2.09, 4.17, cos * 2.09, 0.33, 0.62, 0.58, cream, root);
      support.rotation.y = angle;
      const merlon = box('battlement pier', sin * 2.27, 4.97, cos * 2.27, 0.47, 0.71, 0.39, cream, root);
      merlon.rotation.y = angle;
      const cap = box('battlement cap', sin * 2.27, 5.34, cos * 2.27, 0.51, 0.12, 0.44, stone, root);
      cap.rotation.y = angle;
      casters.push(merlon);
    }

    // String courses and larger stone piers give shadow edges to the keep.
    for (const [y, h, d] of [[1.15, 0.11, 4.50], [3.54, 0.14, 4.46], [3.63, 0.05, 4.57]]) {
      disc('projecting ashlar course', 0, y, 0, d, h, cream, root, 24);
    }
    const frontZ = 2.32;
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const facade = new B.TransformNode('tower facade', scene);
      facade.parent = root;
      facade.rotation.y = angle;
      const hasDoor = angle === Math.PI || angle === 0;
      const w = hasDoor ? 0.79 : 0.42;
      const y = hasDoor ? 0.65 : 2.05;
      const h = hasDoor ? 0.94 : 0.57;
      for (const [width, front, mat] of [[w + 0.26, frontZ - 0.07, cream], [w, frontZ, ink]]) {
        box('arch vertical', 0, y + h / 2, front, width, h, 0.08, mat, facade);
        const arch = disc('arch cap', 0, y + h, front, width, 0.08, mat, facade, 20);
        arch.rotation.x = Math.PI / 2;
      }
      box('stone sill', 0, y - 0.04, frontZ + 0.025, w + 0.35, 0.12, 0.25, cream, facade);
      if (hasDoor) box('door plate', 0, y + h * 0.36, frontZ + 0.05, 0.40, 0.055, 0.05, gold, facade);
      for (const side of [-1, 1]) {
        if (!hasDoor) continue;
        const pin = box('banner rail', side * 1.16, 3.8, frontZ - 0.30, 0.82, 0.095, 0.18, gold, facade);
        const banner = place(B.MeshBuilder.CreateRibbon('swallowtail team banner', {
          pathArray: [
            [-0.34, 0, 0.34].map(x => new B.Vector3(x, 3.74, frontZ - 0.19)),
            [-0.34, 0, 0.34].map((x, i) => new B.Vector3(x, i === 1 ? 2.53 : 2.23, frontZ - 0.08)),
          ],
          sideOrientation: B.Mesh.DOUBLESIDE,
        }, scene), pin.position.x, 0, 0, neutral, facade);
        colored.push(banner);
      }
    }

    // Each landmark keeps its silhouette after a change of ownership.
    const crown = form === 20 ? [4.97, 1.65, 2.57] : form === 8 ? [5.02, 2.25, 2.98] : [5.01, 2.29, 2.76];
    const roof = disc('glazed landmark crown', 0, crown[0] + crown[1] / 2, 0,
      crown[2], crown[1], neutral, root, form, form === 6 ? 0.83 : 1.90);
    colored.push(roof);
    casters.push(roof);
    for (let i = 1; i <= 4; i++) {
      const step = i / 5;
      const capWidth = form === 6 ? 0.83 : 1.90;
      const diameter = crown[2] * (1 - step) + capWidth * step + 0.075;
      disc('glazed roof tile course', 0, crown[0] + crown[1] * step, 0,
        diameter, 0.045, form === 6 ? gold : stone, root, form);
    }
    const top = crown[0] + crown[1];
    disc('crown golden lip', 0, top + 0.015, 0, form === 6 ? 0.95 : 2.16, 0.16, gold, root, form);
    disc('crown dark seal plate', 0, top + 0.12, 0, form === 6 ? 0.86 : 1.88, 0.10, ink, root, 28);
    const setOwner = ownership(root, colored, 0, top + 0.20, 0, form === 6 ? 0.65 : 1.61);
    addShadows(casters);
    for (const mat of stoneVariants) {
      const group = bricks.filter(brick => brick.material === mat);
      for (const brick of group) brick.parent = null;
      const merged = B.Mesh.MergeMeshes(group, true, true);
      merged.parent = root;
      merged.isPickable = false;
    }
    wall.receiveShadows = true;
    const sign = makeSign('fort title', 8.8, 2.20, root, 1.35, -4.05);
    const setProgress = meter(root, 'fort capture', 4.6, 0.36, -3.56);
    let lastOwner;
    return (current) => {
      if (lastOwner !== current.owner) {
        lastOwner = current.owner;
        setOwner(current.owner);
        sign(current.name, TEAMS[current.owner]?.symbol ?? '—', TEAMS[current.owner]?.color ?? '#647B8C');
      }
      setProgress(current.captureProgress, paintFor(current.captureTeam), current.captureProgress > 0);
    };
  }

  function tube(name, x, y, z, width, length, mat, parent) {
    const mesh = disc(name, x, y, z, width, length, mat, parent, 12);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  function cannonView(cannon) {
    const root = new B.TransformNode(cannon.id, scene);
    root.position.set(cannon.x, 0, cannon.z);
    disc('cannon stone apron', 0, 0.09, 0, 4.0, 0.15, stoneShade, root, 8);
    disc('cannon porch', 0, 0.18, 0, 3.63, 0.10, cream, root, 16);
    ring('cannon plinth brass rim', 0, 0.25, 0, 2.84, 0.12, terracotta, root);
    disc('turntable', 0, 0.46, 0, 2.36, 0.51, ink, root, 16, 2.12);
    const colored = [
      ring('turntable team stripe', 0, 0.69, 0, 2.32, 0.18, neutral, root),
      disc('cannon ownership seal', 0, 0.20, -1.64, 1.18, 0.13, neutral, root, 16),
    ];
    const turret = new B.TransformNode('swivel', scene);
    turret.position.y = 1.4;
    turret.parent = root;
    disc('cannon bearing', 0, -0.58, 0, 1.2, 0.50, gold, turret, 10);
    const barrel = new B.TransformNode('recoiling barrel', scene);
    barrel.parent = turret;
    barrel.rotation.x = -0.13;
    const housing = tube('main paint barrel', 0, 0, 0.42, 1.13, 2.12, ink, barrel);
    addShadows([housing]);
    for (const side of [-1, 1]) {
      const hub = disc('paint roller brass hub', side * 0.64, -0.25, 0.17, 0.87, 0.25, gold, barrel, 16);
      hub.rotation.z = Math.PI / 2;
      const inset = disc('paint roller hub enamel', side * 0.79, -0.25, 0.17, 0.61, 0.08, ink, barrel, 16);
      inset.rotation.z = Math.PI / 2;
    }
    colored.push(tube('paint barrel sleeve', 0, 0, 0.44, 1.18, 1.08, neutral, barrel));
    tube('nozzle trim', 0, 0, 1.42, 1.38, 0.35, cream, barrel);
    tube('nozzle brass lip', 0, 0, 1.60, 1.27, 0.15, gold, barrel);
    tube('paint nozzle', 0, 0, 1.61, 0.86, 0.12, ink, barrel);
    colored.push(sphere('cannon paint canister', 0, 0.40, -0.84, 1.44, neutral, barrel, 12));
    disc('canister cap', 0, 1.12, -0.84, 0.46, 0.15, gold, barrel, 8);
    const flash = sphere('cannon paint burst', 0, 0, 1.8, 0.92, neutral, barrel);
    colored.push(flash);
    const setOwner = ownership(root, colored, 0, 0.32, -1.65, 0.83);
    const setAmmo = meter(root, 'cannon ammo', 2.9, 0.44, -2.43);
    const setProgress = meter(root, 'cannon capture', 3.1, 2.1, 1.05);
    let lastOwner;
    let previousCooldown = 0;
    let recoil = 0;
    return (current, dt) => {
      if (lastOwner !== current.owner) {
        lastOwner = current.owner;
        setOwner(current.owner);
      }
      if (current.shotCooldown > previousCooldown + 0.04 && current.owner) recoil = 1;
      previousCooldown = current.shotCooldown;
      recoil = Math.max(0, recoil - dt * 6);
      turret.rotation.y = current.yaw;
      barrel.position.z = -recoil * 0.36;
      flash.setEnabled(recoil > 0.56);
      flash.scaling.setAll(0.5 + recoil * 0.42);
      setAmmo(current.ammo / 100, white);
      setProgress(current.captureProgress, paintFor(current.captureTeam), current.captureProgress > 0);
    };
  }

  const contactShadow = material('character contact shadow', '#FFFFFF');
  contactShadow.disableLighting = true;
  contactShadow.emissiveColor = B.Color3.White();
  const shadowTexture = new B.DynamicTexture('soft character shadow', 64, scene, true);
  const shade = shadowTexture.getContext();
  const falloff = shade.createRadialGradient(32, 32, 0, 32, 32, 32);
  falloff.addColorStop(0, '#19242aa0');
  falloff.addColorStop(0.52, '#19242a76');
  falloff.addColorStop(1, '#19242a00');
  shade.fillStyle = falloff;
  shade.fillRect(0, 0, 64, 64);
  shadowTexture.hasAlpha = true;
  shadowTexture.update();
  contactShadow.diffuseTexture = shadowTexture;
  contactShadow.useAlphaFromDiffuseTexture = true;
  contactShadow.emissiveTexture = shadowTexture;

  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function actorView(actor) {
    const root = new B.TransformNode(actor.id, scene);
    root.position.set(actor.x, 0, actor.z);
    const body = new B.TransformNode('paint player rotation', scene);
    body.parent = root;
    const suit = suitFor(actor.team);
    const paint = paintFor(actor.team);
    const controlled = actor.id === 'player';
    const scale = controlled ? 1.35 : 1.04;
    body.scaling.setAll(scale);
    const contact = place(B.MeshBuilder.CreateGround('character contact shade', {
      width: 3.25 * scale, height: 2.35 * scale,
    }, scene), 0.19, 0.19, 0.15, contactShadow, root);
    contact.alphaIndex = 0;

    if (controlled) {
      ring('player location dark outline', 0, 0.16, 0, 3.46, 0.33, ink, root);
      ring('player location light outline', 0, 0.29, 0, 3.46, 0.092, white, root);
      const sign = makeSign('your location', 4.6, 1.35, root, 4.55, 1.23, true);
      sign('אני');
    }
    const shield = ring('respawn protection', 0, 0.15, 0, controlled ? 3.91 : 2.68, 0.084, gold, root);
    const left = sphere('boot left', -0.45, 0.36, 0.12, 0.88, shell, body);
    const right = sphere('boot right', 0.45, 0.36, 0.12, 0.88, shell, body);
    for (const boot of [left, right]) boot.scaling.set(0.75, 0.70, 1.3);
    const torso = sphere('paint suit body', 0, 1.07, 0, 1.57, shell, body, 14);
    torso.scaling.set(0.95, 1.02, 0.74);
    const undersuit = sphere('white legs and lower body', 0, 0.61, -0.06, 1.34, suit, body, 10);
    undersuit.scaling.set(0.89, 0.75, 0.74);
    const chest = sphere('paint bib with colored overalls', 0, 1.02, 0.43, 1.06, suit, body, 10);
    chest.scaling.set(0.96, 0.85, 0.34);
    for (const side of [-1, 1]) {
      const strap = box('paint overalls shoulder strap', side * 0.32, 1.43, 0.30, 0.21, 0.56, 0.16, suit, body);
      strap.rotation.x = -0.35;
      sphere('paint overalls brass button', side * 0.32, 1.27, 0.51, 0.13, gold, body, 8);
    }
    const collar = disc('collar', 0, 1.63, 0, 1.15, 0.22, suit, body, 12);
    collar.scaling.z = 0.89;
    const helmet = sphere('rounded paint helmet', 0, 2.12, 0, 1.56, shell, body, 16);
    helmet.scaling.z = 0.95;
    const hood = sphere('colored hood lining', 0, 1.92, -0.14, 1.54, suit, body, 12);
    hood.scaling.set(0.99, 0.54, 0.94);
    addShadows([helmet, torso]);
    const pack = sphere('backpack casing', 0, 1.13, -0.57, 1.15, ink, body, 10);
    pack.scaling.set(0.84, 1.08, 0.55);
    for (const side of [-1, 1]) {
      const tank = disc('backpack paint tank', side * 0.23, 1.07, -0.79, 0.32, 0.82, paint, body, 10);
      tank.rotation.z = side * 0.08;
      sphere('tank cap', side * 0.23, 1.48, -0.79, 0.34, cream, body, 8);
      const strap = sphere('suit cuff', side * 0.63, 1.29, 0.37, 0.45, suit, body, 9);
      strap.scaling.x = 1.20;
    }
    const visorFrame = sphere('visor rim', 0, 2.08, 0.60, 1.38, cream, body, 12);
    visorFrame.scaling.set(0.96, 0.52, 0.46);
    const goggles = sphere('protective visor', 0, 2.08, 0.67, 1.28, ink, body, 12);
    goggles.scaling.set(0.93, 0.46, 0.41);
    for (const side of [-1, 1]) {
      const glint = sphere('visor reflection', side * 0.23, 2.15, 0.914, 0.17, white, body);
      glint.scaling.set(0.56, 0.77, 0.65);
      sphere('paint glove', side * 0.8, 1.14, 0.45, 0.54, shell, body);
    }
    const helmetLining = disc('helmet badge shadow', 0, 2.90 * scale, 0, 0.94 * scale, 0.10, ink, root, 14);
    const helmetBadge = teamShape(actor.team, 0, 2.962 * scale, 0, 0.67 * scale, white, root);
    if (controlled) {
      helmetLining.renderingGroupId = 1;
      helmetBadge.renderingGroupId = 1;
    }
    const blaster = new B.TransformNode('hand blaster', scene);
    blaster.parent = body;
    blaster.position.set(0.52, 1.30, 0);
    tube('blaster body', 0, -0.06, 0.77, 0.57, 1.43, ink, blaster);
    tube('blaster sleeve', 0, -0.06, 1.08, 0.67, 0.70, cream, blaster);
    tube('blaster muzzle', 0, -0.06, 1.44, 0.70, 0.19, suit, blaster);
    tube('muzzle inner well', 0, -0.06, 1.541, 0.43, 0.036, ink, blaster);
    const reservoir = sphere('paint reservoir', 0, 0.39, 0.50, 0.65, paint, blaster, 12);
    reservoir.scaling.set(0.80, 0.85, 1.20);
    disc('reservoir valve', 0, 0.68, 0.50, 0.29, 0.07, gold, blaster, 12);
    const flash = sphere('blaster paint burst', 0, 0, 1.62, 0.47, paint, blaster);
    const healthZ = controlled ? -1.83 : -1.29;
    const healthSpacing = controlled ? 0.51 : 0.42;
    box('paint hit meter backing', 0, 0.24, healthZ, actor.maxHp * healthSpacing + 0.16, 0.11, 0.50, ink, root);
    const pips = Array.from({ length: actor.maxHp }, (_, i) =>
      box('paint hit meter pip', (i - (actor.maxHp - 1) / 2) * healthSpacing, 0.33, healthZ, healthSpacing - 0.08, 0.11, 0.32, white, root));
    let previousCooldown = 0;
    let recoil = 0;
    let stridePhase = 0;
    return (current, dt) => {
      const travel = Math.hypot(current.x - root.position.x, current.z - root.position.z);
      root.position.set(current.x, 0, current.z);
      body.rotation.y = current.yaw;
      if (current.shotCooldown > previousCooldown + 0.04) recoil = 1;
      previousCooldown = current.shotCooldown;
      recoil = Math.max(0, recoil - dt * 9);
      stridePhase += travel * 3.3;
      const stride = reducedMotion || travel < 0.007 ? 0 : Math.sin(stridePhase) * 0.19;
      left.position.z = 0.12 + stride;
      right.position.z = 0.12 - stride;
      blaster.position.z = -recoil * 0.21;
      flash.setEnabled(recoil > 0.55);
      shield.setEnabled(current.invulnerable > 0);
      pips.forEach((pip, i) => { pip.material = i < current.hp ? white : ink; });
    };
  }

  function projectileView() {
    const root = new B.TransformNode('paint in flight', scene);
    const shadow = disc('paint shadow', 0, 0.10, 0, 0.52, 0.012, projectileShade, root, 10);
    const blobs = [0.73, 0.43, 0.24].map(size => sphere('paint drop', 0, 0, 0, size, neutral, root));
    return {
      root,
      update(shot) {
        root.position.set(shot.x, 0, shot.z);
        shadow.scaling.setAll(1 + shot.y * 0.10);
        blobs.forEach((blob, i) => {
          const offset = 0.026 * i;
          blob.position.set(-shot.vx * offset, Math.max(0.24, shot.y - shot.vy * offset), -shot.vz * offset);
          blob.material = paintFor(shot.team);
        });
      },
    };
  }

  function splatView() {
    const root = new B.TransformNode('paint splash', scene);
    const central = disc('paint pool', 0, 0, 0, 1.34, 0.016, neutral, null, 12);
    const spots = [central];
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.40;
      const d = 0.54 + (i % 5) * 0.19;
      const lobe = disc('paint spatter', Math.cos(angle) * d, 0.01, Math.sin(angle) * d, 0.14 + (i % 4) * 0.15, 0.014, neutral, null, 8);
      lobe.scaling.z = 1.23;
      lobe.rotation.y = angle;
      spots.push(lobe);
    }
    const paint = B.Mesh.MergeMeshes(spots, true);
    paint.parent = root;
    paint.isPickable = false;
    return {
      root,
      update(splat) {
        const remaining = Math.max(0, Math.min(1, splat.life / splat.maxLife));
        const radius = splat.radius * (0.61 + Math.min(remaining * 3, 1) * 0.39);
        root.position.set(splat.x, 0.17 + Math.abs(Math.sin(splat.x * 31 + splat.z)) * 0.07, splat.z);
        root.rotation.y = splat.x * 2.37 + splat.z;
        root.scaling.set(radius, 1, radius);
        paint.material = paintFor(splat.team);
      },
    };
  }

  function effectPool(make, maximum) {
    const active = new Map();
    const unused = [];
    return (items) => {
      const visible = items.length > maximum ? items.slice(-maximum) : items;
      const ids = new Set(visible.map(item => item.id));
      for (const [id, view] of active) {
        if (ids.has(id)) continue;
        active.delete(id);
        view.root.setEnabled(false);
        unused.push(view);
      }
      for (const item of visible) {
        let view = active.get(item.id);
        if (!view) {
          view = unused.pop() ?? make();
          active.set(item.id, view);
          view.root.setEnabled(true);
        }
        view.update(item);
      }
    };
  }

  const forts = new Map(initialGame.forts.map(fort => [fort.id, fortView(fort)]));
  const cannons = new Map(initialGame.cannons.map(cannon => [cannon.id, cannonView(cannon)]));
  const actors = new Map(initialGame.actors.map(actor => [actor.id, actorView(actor)]));
  const showSplats = effectPool(splatView, 36);
  const showProjectiles = effectPool(projectileView, 48);

  let halfHeight;
  let halfWidth;
  const focus = new B.Vector3(initialGame.player.x, 0, initialGame.player.z + 2.75);

  function render(game, dt = 0.016) {
    const targetX = game.player.x;
    const targetZ = game.player.z + 2.75;
    const gap = Math.hypot(targetX - focus.x, targetZ - focus.z);
    const blend = reducedMotion || gap > 12 || dt === 0 ? 1 : 1 - Math.exp(-11 * dt);
    focus.x += (targetX - focus.x) * blend;
    focus.z += (targetZ - focus.z) * blend;
    camera.position.set(focus.x, rise, focus.z - setback);
    camera.setTarget(focus);
    sun.position.set(focus.x - 28, 51, focus.z - 22);
    for (const fort of game.forts) forts.get(fort.id)(fort);
    for (const cannon of game.cannons) cannons.get(cannon.id)(cannon, dt);
    for (const actor of game.actors) actors.get(actor.id)(actor, dt);
    showSplats(game.splats);
    showProjectiles(game.projectiles);
    scene.render();
  }

  function resize() {
    engine.resize();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const readableHeight = Math.max(12, Math.min(19, canvas.clientHeight / 30));
    halfHeight = Math.max(readableHeight, 13 / aspect);
    halfWidth = halfHeight * aspect;
    camera.orthoLeft = -halfWidth;
    camera.orthoRight = halfWidth;
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
  }

  resize();
  render(initialGame, 0);
  return {
    render,
    resize,
    getViewBounds() {
      const depth = halfHeight / groundProjection;
      return { minX: focus.x - halfWidth, maxX: focus.x + halfWidth, minZ: focus.z - depth, maxZ: focus.z + depth };
    },
    pointAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      // Parallel orthographic rays intersect the floor at these offsets from the camera target.
      const x = focus.x + (2 * (clientX - rect.left) / rect.width - 1) * halfWidth;
      const z = focus.z + (1 - 2 * (clientY - rect.top) / rect.height) * halfHeight / groundProjection;
      return { x, z };
    },
    dispose() {
      scene.dispose();
      engine.dispose();
    },
  };
}
