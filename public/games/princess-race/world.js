import { TRACK_LENGTH } from './model.js';

const LANE = 3.2;
const EDGE = 4.75;
const TAU = 2 * Math.PI;

const costumes = {
  belle: { silk: '#e9a927', trim: '#ffe699', deep: '#b87318', hair: '#492721', sheen: '#885038', skin: '#eab382', gem: '#ffdc6c', shape: '♥' },
  felice: { silk: '#9f63bc', trim: '#f2caff', deep: '#653888', hair: '#7a3c22', sheen: '#b67749', skin: '#f4c49b', gem: '#eacaff', shape: '◆' },
  torres: { silk: '#267e83', trim: '#bbf0d9', deep: '#175260', hair: '#281a21', sheen: '#62433e', skin: '#b87b56', gem: '#8be2c1', shape: '▲' },
};

export function createWorld(canvas, initialRace) {
  const B = globalThis.BABYLON;
  const engine = new B.Engine(canvas, true, { stencil: false, powerPreference: 'high-performance' });
  const scene = new B.Scene(engine);
  scene.skipPointerMovePicking = true;
  scene.clearColor = new B.Color4(0.66, 0.82, 0.91, 1);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0105;
  scene.fogColor = B.Color3.FromHexString('#cddfe3');
  scene.ambientColor = B.Color3.FromHexString('#625953');

  const v = (x, y, z) => new B.Vector3(x, y, z);
  const camera = new B.FreeCamera('follow camera', v(0, 5, -11), scene);
  camera.minZ = 0.15;
  camera.maxZ = 950;
  const skyLight = new B.HemisphericLight('garden skylight', v(-0.1, 1, 0.1), scene);
  skyLight.intensity = 0.51;
  skyLight.groundColor = B.Color3.FromHexString('#9786a3');
  const sun = new B.DirectionalLight('late afternoon sun', v(0.60, -1, 0.50), scene);
  sun.diffuse = B.Color3.FromHexString('#fff0ca');
  sun.intensity = 0.92;

  function material(name, hex, shine = 0.08) {
    const m = new B.StandardMaterial(name, scene);
    m.diffuseColor = B.Color3.FromHexString(hex);
    m.ambientColor = new B.Color3(0.40, 0.35, 0.40);
    m.specularColor = new B.Color3(shine, shine, shine);
    m.specularPower = 27;
    return m;
  }

  function paint(name, width, height, draw, alpha = false) {
    const texture = new B.DynamicTexture(name, { width, height }, scene, true);
    draw(texture.getContext(), width, height);
    texture.hasAlpha = alpha;
    texture.update();
    return texture;
  }

  function brush(name, texture, alpha = false, unlit = false) {
    const m = material(name, '#ffffff', 0);
    m.diffuseTexture = texture;
    m.useAlphaFromDiffuseTexture = alpha;
    if (unlit) {
      m.emissiveTexture = texture;
      m.disableLighting = true;
    }
    return m;
  }

  let batch;
  let figureParts;
  function place(mesh, mat, x, y, z, parent) {
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    if (parent) {
      mesh.parent = parent;
      if (figureParts) {
        if (!figureParts.has(parent)) figureParts.set(parent, new Map());
        const parts = figureParts.get(parent);
        if (!parts.has(mat)) parts.set(mat, []);
        parts.get(mat).push(mesh);
      }
    }
    if (batch && !parent) {
      if (!batch.has(mat)) batch.set(mat, []);
      batch.get(mat).push(mesh);
    }
    return mesh;
  }
  function sphere(mat, x, y, z, a, b, c, parent, segments = 9) {
    const mesh = B.MeshBuilder.CreateSphere(mat.name, { diameter: 1, segments }, scene);
    mesh.scaling.set(a, b, c);
    return place(mesh, mat, x, y, z, parent);
  }
  function box(mat, x, y, z, width, height, depth, parent) {
    return place(B.MeshBuilder.CreateBox(mat.name, { width, height, depth }, scene), mat, x, y, z, parent);
  }
  function column(mat, x, y, z, height, diameter, top = diameter, parent, tessellation = 10) {
    const mesh = B.MeshBuilder.CreateCylinder(mat.name, {
      height, diameterBottom: diameter, diameterTop: top, tessellation,
    }, scene);
    return place(mesh, mat, x, y, z, parent);
  }
  function thread(mat, points, radius, parent, tessellation = 5) {
    const mesh = B.MeshBuilder.CreateTube(mat.name, {
      path: points.map(point => v(...point)), radius, tessellation, cap: B.Mesh.CAP_ALL,
    }, scene);
    return place(mesh, mat, 0, 0, 0, parent);
  }
  function group(name, parent, x = 0, y = 0, z = 0) {
    const node = new B.TransformNode(name, scene);
    node.parent = parent;
    node.position.set(x, y, z);
    return node;
  }
  function collect(z, build) {
    batch = new Map();
    build();
    const sector = [];
    for (const meshes of batch.values()) {
      const merged = meshes.length === 1 ? meshes[0] : B.Mesh.MergeMeshes(meshes, true, true);
      merged.freezeWorldMatrix();
      sector.push(merged);
    }
    sectors.push({ z, meshes: sector });
    batch = undefined;
  }

  const sectors = [];
  const cream = material('honey limestone', '#dbbf93');
  const stone = material('ivory carved stone', '#efd8ad');
  const clay = material('glazed terracotta', '#b95b55', 0.27);
  const bronze = material('burnished bronze', '#9e6546', 0.23);
  const gold = material('gilding', '#dda035', 0.38);
  const leaves = ['#283e32', '#38614b', '#497959', '#6f9052'].map((hex, i) => material('leaf ' + i, hex));
  const blossoms = ['#ac416a', '#da627e', '#f393a2', '#ffd0b2'].map((hex, i) => material('blossom ' + i, hex));
  const bark = material('weathered bark', '#685245');
  const water = material('reflecting pool', '#3596aa', 0.60);
  const ripples = material('surface glints', '#a7dce0', 0.36);
  const dark = material('palace blue enamel', '#294451');
  dark.backFaceCulling = false;

  let seed = 834572;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function ground(name, mat, x, z, width, depth, y = 0) {
    const mesh = B.MeshBuilder.CreateGround(name, { width, height: depth }, scene);
    return place(mesh, mat, x, y, z);
  }

  function groundTexture(name, colors, track = false) {
    return paint(name, 512, 512, (ctx, w, h) => {
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3600; i++) {
        ctx.fillStyle = colors[1 + (i % (colors.length - 1))];
        ctx.globalAlpha = 0.13 + random() * 0.40;
        ctx.fillRect(random() * w, random() * h, track ? 1 + random() * 5 : 3 + random() * 12, 1 + random() * 4);
      }
      ctx.globalAlpha = 1;
      if (track) {
        ctx.strokeStyle = '#f2d8ac';
        ctx.lineWidth = 9;
        for (const x of [12, w - 12]) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (const x of [w / 3, w * 2 / 3]) {
          ctx.strokeStyle = '#e8ba8c';
          ctx.lineWidth = 2;
          ctx.setLineDash([18, 24]);
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
      }
    });
  }

  const turf = brush('meadow', groundTexture('meadow stipple', ['#719453', '#3f6848', '#9ca95e', '#a8ad63']));
  turf.diffuseTexture.uScale = 19;
  turf.diffuseTexture.vScale = 145;
  ground('estate lawns', turf, 0, TRACK_LENGTH / 2, 250, TRACK_LENGTH + 160, -0.05);
  const trail = brush('garden gravel', groundTexture('fine rose gravel', ['#bd906b', '#9b6f58', '#e4b48b', '#c89a83'], true));

  const sky = brush('painted atmosphere', paint('sky gradient', 512, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#e1bf9f');
    gradient.addColorStop(0.47, '#cddde0');
    gradient.addColorStop(0.55, '#86b6d3');
    gradient.addColorStop(1, '#4b79ab');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }), false, true);
  sky.backFaceCulling = false;
  sky.fogEnabled = false;
  const dome = sphere(sky, 0, 0, 0, 1600, 1600, 1600, null, 30);
  dome.infiniteDistance = true;

  const peakMats = ['#879db0', '#a3b6c7', '#768f9d'].map((hex, i) => material('hill silhouette ' + i, hex, 0));
  peakMats.forEach(mat => {
    mat.fogEnabled = false;
    mat.disableLighting = true;
    mat.emissiveColor = mat.diffuseColor.clone();
  });
  const peaks = group('distant hills');
  for (let i = 0; i < 14; i++) {
    const x = -490 + i * 75;
    sphere(peakMats[i % 3], x, -24, 385 + random() * 55, 95 + random() * 90, 64 + random() * 52, 44, peaks, 10);
  }

  const cloudMat = material('sunlit cloud', '#eee5df', 0);
  cloudMat.emissiveColor = B.Color3.FromHexString('#726d68');
  cloudMat.fogEnabled = false;
  const clouds = group('cloud bank');
  for (const [x, y, z, scale] of [[-165, 49, 270, 1], [-65, 39, 340, 0.7], [88, 58, 300, 1], [163, 82, 360, 1.2]]) {
    sphere(cloudMat, x, y, z, 48 * scale, 6 * scale, 15 * scale, clouds, 12);
    for (let i = -1; i <= 1; i++) {
      sphere(cloudMat, x + i * 10 * scale, y + 2, z, (17 + random() * 8) * scale, (6 + random() * 6) * scale, 16 * scale, clouds);
    }
  }

  const contactTexture = paint('soft contact shadow', 64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, '#26181ab5');
    gradient.addColorStop(0.47, '#2f24265c');
    gradient.addColorStop(1, '#34252a00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, true);
  const contact = brush('contact shade', contactTexture, true);
  contact.disableLighting = true;
  contact.emissiveColor = B.Color3.FromHexString('#443138');

  function flower(x, y, z, size, variant, parent) {
    const petals = blossoms[variant % blossoms.length];
    sphere(petals, x, y, z, size, size * 0.80, size, parent, 6);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3;
      sphere(petals, x + Math.cos(a) * size * 0.36, y - size * 0.13, z + Math.sin(a) * size * 0.36,
        size * 0.68, size * 0.55, size * 0.66, parent, 5);
    }
    sphere(gold, x, y + size * 0.30, z, size * 0.24, size * 0.18, size * 0.24, parent, 5);
  }

  function flowerbed(x, z, pink) {
    sphere(cream, x, 0.11, z, 1.40, 0.38, 4.8);
    sphere(leaves[0], x, 0.30, z, 1.29, 0.42, 4.65);
    for (let i = 0; i < 12; i++) {
      const lateral = (random() - 0.5) * 0.9;
      const along = (random() - 0.5) * 4.1;
      const y = 0.43 + random() * 0.31;
      const size = (0.17 + random() * 0.19) * (pink ? 1 : 0.85);
      column(leaves[2], x + lateral, (y + 0.32) / 2, z + along, y - 0.32, 0.037);
      flower(x + lateral, y, z + along, size, pink ? i % 3 : 2 + i % 2);
    }
  }

  function tree(x, z, flowering, h) {
    column(bark, x, 1.45 * h, z, 2.9 * h, 0.64 * h, 0.27 * h);
    for (const side of [-1, 1]) {
      const branch = column(bark, x + side * 0.38 * h, 2.42 * h, z, 1.65 * h, 0.30 * h, 0.12 * h);
      branch.rotation.z = -side * 0.55;
    }
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39996, r = (i === 0 ? 0 : 0.7 + random() * 1.02) * h;
      const xx = x + Math.cos(a) * r;
      const zz = z + Math.sin(a) * r;
      const yy = (2.95 + random() * 1.60) * h;
      const tint = flowering ? blossoms[1 + i % 3] : leaves[1 + i % 3];
      const size = (1.70 + random() * 1.28) * h;
      const crown = sphere(tint, xx, yy, zz, size, size * 0.96, size * 0.96, undefined, 8);
      crown.rotation.y = a;
      if (flowering) {
        for (let j = 0; j < 4; j++) {
          const angle = j * TAU / 4 + a;
          sphere(blossoms[2 + j % 2], xx + Math.cos(angle) * size * 0.41, yy + h * (random() - 0.5),
            zz + Math.sin(angle) * size * 0.42, size * 0.38, size * 0.44, size * 0.36, undefined, 5);
        }
      }
    }
    ground('tree shade', contact, x + h * 0.90, z + h * 0.35, 5.7 * h, 5.1 * h, 0.006);
  }

  function hedge(x, z, depth) {
    box(stone, x, 0.12, z, 1.20, 0.25, depth);
    for (let i = 0; i < depth; i += 0.85) {
      sphere(leaves[1 + Math.floor(random() * 2)], x, 0.67, z + i - depth / 2 + 0.4, 1.16, 1.20, 1.33, undefined, 6);
    }
  }

  function arch(z, roses, final = false) {
    const width = EDGE + 0.35;
    for (const x of [-width, width]) {
      box(cream, x, 0.18, z, 0.93, 0.36, 0.91);
      column(stone, x, 2.07, z, 3.80, 0.57, 0.43);
      for (const y of [0.38, 0.55, 3.87, 4.04]) column(cream, x, y, z, 0.14, 0.75);
      if (!roses) continue;
      const vines = [];
      for (let i = 0; i <= 10; i++) {
        const y = i * 0.42;
        const xx = x + Math.cos(i * 0.97) * 0.37;
        const zz = z + Math.sin(i * 0.97) * 0.37;
        vines.push([xx, y, zz]);
        flower(xx, y + 0.10, zz - 0.17, 0.28, i % 3);
        sphere(leaves[2], xx, y, zz + 0.1, 0.45, 0.25, 0.3);
      }
      thread(leaves[1], vines, 0.052);
    }
    const points = [];
    const rim = [];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI * i / 24;
      const x = width * Math.cos(a);
      const y = 4 + Math.sin(a) * 2.5;
      points.push([x, y, z]);
      rim.push([x, y + 0.22, z - 0.04]);
      if (roses) {
        sphere(leaves[1 + i % 2], x, y + 0.13, z, 0.85, 0.58, 0.64);
        if (i % 2 === 0) flower(x, y + 0.24, z - 0.32, 0.44, i % 3);
      }
    }
    thread(stone, points, 0.20, undefined, 8);
    thread(gold, rim, 0.055);
    if (final) {
      const crown = [[-1.10, 6.2, z - 0.30], [-1.43, 7.29, z - 0.30], [-0.53, 6.94, z - 0.30],
        [0, 7.79, z - 0.30], [0.53, 6.94, z - 0.30], [1.43, 7.29, z - 0.30],
        [1.10, 6.2, z - 0.30], [-1.10, 6.2, z - 0.30]];
      thread(gold, crown, 0.115, undefined, 8);
      for (const [x, y] of [[-1.43, 7.29], [0, 7.79], [1.43, 7.29]]) sphere(gold, x, y, z - 0.30, 0.31, 0.31, 0.31);
      for (let i = 0; i < 18; i++) {
        for (let row = 0; row < 2; row++) box((i + row) % 2 ? dark : stone, (i - 8.5) * 0.52, 0.001, z + row * 0.34, 0.52, 0.009, 0.34);
      }
    }
  }

  function fountain(x, z, scale = 1) {
    column(cream, x, 0.27 * scale, z, 0.54 * scale, 5.2 * scale);
    column(stone, x, 0.53 * scale, z, 0.13 * scale, 5.35 * scale);
    column(water, x, 0.61 * scale, z, 0.04 * scale, 4.99 * scale, 4.99 * scale, undefined, 28);
    column(stone, x, 1.03 * scale, z, 1.05 * scale, 0.89 * scale, 0.58 * scale);
    column(cream, x, 1.58 * scale, z, 0.33 * scale, 0.85 * scale, 1.62 * scale);
    column(water, x, 1.77 * scale, z, 0.04 * scale, 1.49 * scale);
    const paths = [];
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7;
      paths.push(Array.from({ length: 9 }, (_, j) => {
        const t = j / 8;
        const r = t * 2.04 * scale;
        return [x + Math.cos(a) * r, (1.8 + 3 * t - 4.18 * t * t) * scale, z + Math.sin(a) * r];
      }));
    }
    paths.forEach(points => thread(ripples, points, 0.026 * scale));
  }

  function lake(x, z) {
    const shore = column(cream, x, -0.024, z, 0.07, 2, 2, undefined, 42);
    shore.scaling.set(16, 1, 37);
    const pool = column(water, x, 0.046, z, 0.024, 2, 2, undefined, 42);
    pool.scaling.set(15.5, 1, 36.3);
    for (let i = 0; i < 31; i++) {
      const a = random() * TAU;
      const r = Math.sqrt(random()) * 0.91;
      const ripple = sphere(ripples, x + Math.cos(a) * r * 15, 0.072, z + Math.sin(a) * r * 35, 0.55 + random() * 2, 0.007, 0.095);
      ripple.rotation.y = 0.18;
    }
    fountain(x + (x > 0 ? -7 : 7), z - 18, 0.83);
  }

  function tower(x, z, height, diameter) {
    column(cream, x, height / 2, z, height, diameter, diameter, undefined, 16);
    column(stone, x, height - 0.34, z, 0.34, diameter * 1.11, undefined, undefined, 16);
    column(stone, x, height + 0.16, z, 0.39, diameter * 1.17, undefined, undefined, 16);
    const roof = height * 0.35;
    column(clay, x, height + roof / 2, z, roof, diameter * 1.23, 0.10, undefined, 18);
    column(gold, x, height + roof + 1, z, 2.55, 0.082);
    sphere(gold, x, height + roof + 2.35, z, 0.25, 0.25, 0.25);
    const flag = box(x > 0 ? clay : dark, x + 0.65, height + roof + 1.64, z, 1.31, 0.67, 0.075);
    flag.rotation.y = 0.34;
    for (const factor of [0.45, 0.70, 0.87]) {
      const face = z - diameter / 2;
      box(dark, x, height * factor, face - 0.005, 0.43, 1.16, 0.09);
      sphere(dark, x, height * factor + 0.60, face - 0.02, 0.44, 0.51, 0.09);
      box(stone, x, height * factor - 0.61, face - 0.09, 0.70, 0.11, 0.27);
    }
  }

  function palace(z) {
    box(cream, 0, 4.7, z + 4, 29, 9.4, 12);
    box(stone, 0, 9.2, z + 4, 30, 0.75, 12.6);
    box(stone, 0, 0.55, z + 4, 30, 1.1, 12.6);
    box(stone, 0, 5.9, z - 2.3, 10, 11.8, 3.5);
    column(clay, 0, 13.80, z - 2.3, 4.01, 13.4, 0.10, undefined, 4).rotation.y = Math.PI / 4;
    const gateZ = z - 4.14;
    const doorway = Array.from({ length: 21 }, (_, i) => {
      const a = i * Math.PI / 20;
      return [2.17 * Math.cos(a), 3.70 + 2.13 * Math.sin(a), gateZ];
    });
    const outline = [[2.17, 0, gateZ], ...doorway, [-2.17, 0, gateZ]];
    const door = new B.Mesh('arched palace gates', scene);
    const doorwayData = new B.VertexData();
    const positions = [0, 2.9, gateZ, ...outline.flat()];
    const indices = outline.flatMap((_, i) => [0, i + 1, ((i + 1) % outline.length) + 1]);
    const normals = Array.from({ length: outline.length + 1 }, () => [0, 0, -1]).flat();
    const uvs = [0.5, 0.5, ...outline.flatMap(([x, y]) => [0.5 + x / 4.34, y / 5.83])];
    Object.assign(doorwayData, { positions, indices, normals, uvs });
    doorwayData.applyToMesh(door);
    place(door, dark, 0, 0, 0);
    thread(stone, outline.map(([x, y]) => [x, y, gateZ - 0.13]), 0.16, undefined, 9);
    for (const x of [-1.55, -0.78, 0, 0.78, 1.55]) {
      box(bronze, x, 2.16, gateZ - 0.075, x === 0 ? 0.098 : 0.046, 4.31, 0.055);
    }
    for (const x of [-0.30, 0.30]) sphere(gold, x, 2.17, gateZ - 0.14, 0.15, 0.19, 0.12);
    for (const x of [-12, -8.7, -4.8, 4.8, 8.7, 12]) {
      for (const y of [3.1, 6.5]) {
        const face = Math.abs(x) < 6 ? z - 4.09 : z - 2.07;
        box(dark, x, y, face, 0.92, 1.60, 0.14);
        sphere(dark, x, y + 0.81, face, 0.92, 1.08, 0.15);
        box(cream, x, y - 0.84, face - 0.11, 1.14, 0.19, 0.25);
        box(gold, x, y, face - 0.10, 0.065, 1.60, 0.08);
      }
    }
    tower(-13.5, z - 1, 12.5, 4.45);
    tower(13.5, z - 1, 12.5, 4.45);
    tower(-8.5, z + 6.1, 16.8, 4.8);
    tower(9.0, z + 6.1, 15.4, 4.4);
    tower(0, z + 7.4, 20.7, 5.7);
  }

  for (let start = -42; start <= TRACK_LENGTH + 35; start += 28) {
    const z = start + 14;
    collect(z, () => {
      ground('gravel promenade', trail, 0, z, EDGE * 2, 28, 0);
      for (const side of [-1, 1]) {
        const x = side * (EDGE + 0.14);
        box(cream, x, 0.099, z, 0.23, 0.205, 28);
        for (const offset of [-9, 0, 9]) {
          flowerbed(side * 5.77, z + offset, z < TRACK_LENGTH / 3);
        }
        const district = Math.max(0, Math.min(2, Math.floor(z / (TRACK_LENGTH / 3))));
        if (district === 0) {
          hedge(side * 7.18, z + 6.2, 7.3);
          tree(side * (9.1 + random() * 3), z + (side > 0 ? 6 : -5), true, 0.82 + random() * 0.27);
          tree(side * (16 + random() * 8), z + 10, random() > 0.54, 1.04);
        } else if (district === 1) {
          tree(side * (10 + random() * 5), z + (side > 0 ? 12 : -10), false, 0.95 + random() * 0.18);
          if ((start + 42) % 84 === 0) lake(side * 25, z + 10);
          if ((start + 42) % 56 === 0) fountain(side * 9.6, z - 4, 0.71);
        } else {
          hedge(side * 7.1, z + 7, 10);
          tree(side * (9.7 + random() * 2), z + 6, random() > 0.65, 1.14);
          if ((start + 42) % 56 === 0) {
            column(cream, side * 6.94, 0.76, z - 3, 1.52, 0.89, 0.68);
            flower(side * 6.94, 1.66, z - 3, 0.77, side > 0 ? 2 : 0);
          }
        }
      }
      if (z >= 0 && z < TRACK_LENGTH / 3 && (start + 42) % 56 === 0) arch(z + 5.2, true);
    });
  }

  collect(TRACK_LENGTH, () => arch(TRACK_LENGTH, false, true));
  collect(TRACK_LENGTH + 32, () => palace(TRACK_LENGTH + 22));

  for (const obstacle of initialRace.obstacles) {
    const x = obstacle.x * LANE;
    const z = obstacle.distance;
    collect(z, () => {
      ground('hurdle shade', contact, x + 0.17, z + 0.23, 3.10, 1.42, 0.006);
      for (const side of [-1, 1]) {
        const post = x + side * 1.10;
        box(cream, post, 0.09, z, 0.41, 0.18, 0.61);
        box(bronze, post, 0.39, z, 0.17, 0.62, 0.23);
        sphere(gold, post, 0.69, z, 0.21, 0.21, 0.21);
      }
      box(clay, x, 0.51, z, 2.36, 0.23, 0.17);
      for (let i = -2; i <= 2; i++) {
        const stripe = box(stone, x + i * 0.42, 0.51, z - 0.091, 0.10, 0.24, 0.025);
        stripe.rotation.z = -0.23;
      }
    });
  }

  function dressGeometry(name, mat, parent, levels, pleats, trim) {
    const positions = [];
    const indices = [];
    const colors = [];
    const tint = B.Color3.FromHexString(trim);
    const slices = 64;
    const vertices = slices + 1;

    function fold(angle, level) {
      const [y, width, depth, gather, tail] = level;
      const wave = Math.cos(angle * pleats);
      const r = 1 + gather * wave + gather * 0.31 * Math.cos(angle * pleats * 2 + 0.72);
      return [Math.sin(angle) * width * r, y + tail * Math.cos(angle) + gather * 0.13 * wave,
        Math.cos(angle) * depth * r];
    }

    for (const [j, level] of levels.entries()) {
      for (let i = 0; i <= slices; i++) {
        const a = i / slices * TAU;
        positions.push(...fold(a, level));
        const shade = 0.76 + 0.23 * (1 + Math.sin(a * pleats + 0.63)) / 2;
        const glint = Math.max(0, Math.cos(a * pleats + 0.15)) ** 8 * 0.20;
        colors.push(shade + glint * tint.r, shade + glint * tint.g, shade + glint * tint.b, 1);
        if (j > 0 && i < slices) {
          const k = (j - 1) * vertices + i;
          indices.push(k, k + 1, k + vertices, k + vertices, k + 1, k + vertices + 1);
        }
      }
    }
    const normals = [];
    B.VertexData.ComputeNormals(positions, indices, normals);
    const data = new B.VertexData();
    Object.assign(data, { positions, indices, normals, colors });
    const mesh = new B.Mesh(name, scene);
    data.applyToMesh(mesh);
    place(mesh, mat, 0, 0, 0, parent);
    return fold;
  }

  function jewel(mat, x, y, z, diameter, parent) {
    const gem = B.MeshBuilder.CreatePolyhedron('cut crystal', { type: 1, size: diameter / 2 }, scene);
    return place(gem, mat, x, y, z, parent);
  }

  function ring(mat, x, y, z, diameter, thickness, parent) {
    const mesh = B.MeshBuilder.CreateTorus(mat.name, { diameter, thickness, tessellation: 13 }, scene);
    return place(mesh, mat, x, y, z, parent);
  }

  function label(racer, parent) {
    const { shape } = costumes[racer.id];
    const belle = racer.id === 'belle';
    const plate = paint(racer.name, 256, 96, (ctx, w, h) => {
      ctx.beginPath();
      ctx.roundRect(15, 9, w - 30, 60, 22);
      ctx.moveTo(w / 2 - 10, 67);
      ctx.lineTo(w / 2, 85);
      ctx.lineTo(w / 2 + 10, 67);
      ctx.closePath();
      ctx.fillStyle = belle ? '#293732' : '#f7eddb';
      ctx.fill();
      ctx.strokeStyle = belle ? '#ffe8a0' : '#b28b74';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = belle ? '#fff6db' : '#452d3b';
      ctx.font = 'bold 37px Arial, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(racer.name, belle ? 112 : 118, 41);
      ctx.direction = 'ltr';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(shape, belle ? 165 : 186, 41);
    }, true);
    const mat = brush('racer name sign', plate, true);
    mat.disableLighting = true;
    mat.emissiveColor = new B.Color3(1, 1, 1);
    mat.backFaceCulling = false;
    mat.fogEnabled = false;
    const sign = place(B.MeshBuilder.CreatePlane(racer.name, { width: 1.62, height: 0.61 }, scene),
      mat, 0, 3.02, -0.05, parent);
    sign.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    sign.renderingGroupId = 1;
    return sign;
  }

  function princess(racer) {
    const c = costumes[racer.id];
    const belle = racer.id === 'belle';
    const torres = racer.id === 'torres';
    const silk = material(racer.id + ' silk', c.silk, 0.29);
    const trim = material(racer.id + ' embroidery', c.trim, 0.27);
    const deep = material(racer.id + ' lining', c.deep, 0.34);
    const hair = material(racer.id + ' hair', c.hair, 0.17);
    const highlight = material(racer.id + ' highlights', c.sheen, 0.16);
    const skin = material(racer.id + ' skin', c.skin, 0.13);
    const gem = material(racer.id + ' crystal', c.gem, 0.72);
    const white = material(racer.id + ' eye white', '#ffecd7', 0.21);
    const eye = material(racer.id + ' iris', torres ? '#392c32' : '#4f4433', 0.24);
    const lip = material(racer.id + ' lip', torres ? '#8b443b' : '#a15756');
    silk.backFaceCulling = false;
    deep.backFaceCulling = false;
    figureParts = new Map();
    const root = group(racer.id);
    const body = group('running pose', root);
    const skirt = group('silk skirt', body, 0, 1.32, 0);
    const layers = belle
      ? [[0, 0.34, 0.28, 0.02, 0], [-0.12, 0.47, 0.37, 0.055, 0.02], [-0.32, 0.65, 0.47, 0.105, 0.04],
        [-0.56, 0.76, 0.61, 0.128, 0.09], [-0.82, 0.82, 0.69, 0.15, 0.13], [-0.99, 0.81, 0.72, 0.12, 0.16]]
      : [[0, 0.33, 0.26, 0.018, 0], [-0.15, 0.46, 0.33, 0.055, 0.02], [-0.36, 0.50, 0.38, 0.087, 0.055],
        [-0.58, 0.58, 0.47, 0.10, 0.09], [-0.82, 0.67, 0.56, 0.13, 0.11], [-1.02, 0.74, 0.62, 0.11, 0.14]];
    const pleats = belle ? 9 : torres ? 8 : 10;
    const fold = dressGeometry('shaped satin and pleats', silk, skirt, layers, pleats, c.trim);
    const hem = layers.at(-1);
    dressGeometry('underskirt', deep, skirt, [hem, [hem[0] - 0.065, hem[1] * 0.89, hem[2] * 0.89, hem[3], hem[4]]], pleats, c.trim);

    function hemPoint(angle, lift, padding) {
      const beforeHem = layers.at(-2);
      const t = Math.min(1, lift / (beforeHem[0] - hem[0]));
      const surface = hem.map((value, index) => value + (beforeHem[index] - value) * t);
      surface[1] += padding;
      surface[2] += padding;
      return fold(angle, surface);
    }
    for (const offset of [0.035, 0.13]) {
      thread(trim, Array.from({ length: 97 }, (_, i) => hemPoint(i / 96 * TAU, offset, 0.010)),
        offset < 0.1 ? 0.018 : 0.009, skirt);
    }
    for (let i = 0; i < pleats; i++) {
      const points = Array.from({ length: 13 }, (_, j) => {
        const theta = (i + j / 12) / pleats * TAU;
        return hemPoint(theta, 0.059 + Math.sin(Math.PI * j / 12) * (belle ? 0.125 : 0.091), 0.014);
      });
      thread(trim, points, belle ? 0.014 : 0.011, skirt);
      const [x, y, z] = hemPoint((i + 0.5) / pleats * TAU, 0.151, 0.021);
      jewel(gem, x, y, z, 0.055, skirt);
    }

    dressGeometry('tailored bodice', silk, body, [[1.29, 0.34, 0.27, 0.018, 0], [1.45, 0.29, 0.24, 0.024, 0],
      [1.67, 0.35, 0.28, 0.019, 0], [1.87, 0.46, 0.28, 0.022, 0], [1.95, 0.33, 0.21, 0.022, 0.02]], 7, c.trim);
    thread(trim, Array.from({ length: 41 }, (_, i) => {
      const a = i / 40 * TAU;
      return [0.34 * Math.sin(a), 1.352 - 0.045 * Math.max(0, Math.cos(a)), 0.274 * Math.cos(a)];
    }), 0.030, body);
    thread(trim, [[-0.40, 1.91, 0.08], [-0.30, 1.91, 0.22], [-0.15, 1.85, 0.285],
      [0, 1.81, 0.30], [0.15, 1.85, 0.285], [0.30, 1.91, 0.22], [0.40, 1.91, 0.08]], 0.023, body);
    jewel(gem, 0, 1.80, 0.319, 0.125, body);

    const head = group('head', body, 0, 2.18, 0.028);
    sphere(skin, 0, -0.27, 0, 0.30, 0.40, 0.29, head, 13);
    sphere(hair, 0, 0.12, -0.105, 0.79, 0.76, 0.68, head, 16);
    sphere(skin, 0, 0.038, 0.071, 0.67, 0.70, 0.57, head, 18);
    sphere(skin, 0, -0.002, 0.348, 0.104, 0.121, 0.102, head, 10);

    for (const side of [-1, 1]) {
      sphere(skin, side * 0.317, 0, 0.063, 0.115, 0.16, 0.10, head);
      const brow = sphere(hair, side * 0.138, 0.136, 0.328, 0.134, 0.028, 0.025, head);
      brow.rotation.z = side * -0.13;
      sphere(white, side * 0.132, 0.085, 0.330, 0.141, 0.076, 0.039, head);
      sphere(eye, side * 0.131, 0.085, 0.352, 0.064, 0.066, 0.026, head);
      sphere(white, side * 0.131 - 0.012, 0.103, 0.365, 0.021, 0.021, 0.014, head, 5);
      const bang = sphere(hair, side * 0.19, 0.234, 0.205, 0.29, 0.43, 0.26, head, 15);
      bang.rotation.z = side * 0.64;
      const lock = sphere(highlight, side * 0.19, 0.287, 0.300, 0.045, 0.255, 0.028, head);
      lock.rotation.z = side * 0.76;
      if (torres) {
        const earring = ring(gold, side * 0.35, -0.142, 0.081, 0.105, 0.023, head);
        earring.rotation.x = Math.PI / 2;
        jewel(gem, side * 0.35, -0.208, 0.081, 0.075, head);
      }
    }
    thread(lip, [[-0.080, -0.103, 0.327], [-0.036, -0.123, 0.346], [0, -0.127, 0.350],
      [0.036, -0.123, 0.346], [0.080, -0.103, 0.327]], 0.013, head);
    const hairFlow = group('hair shape', head, 0, 0.08, -0.20);
    const hairLength = belle ? 0.77 : torres ? 1.12 : 1.25;
    sphere(hair, 0, -hairLength * 0.34, -0.092, 0.57, hairLength * 1.12, 0.33, hairFlow, 16);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.09;
      const length = hairLength - Math.abs(i - 3) * 0.075;
      const points = [[x * 0.83, 0.17, -0.06], [x, -0.20, -0.10],
        [x + 0.04, -length * 0.67, -0.17], [x - 0.016, -length, -0.12]];
      thread(i === 1 || i === 5 ? highlight : hair, points, 0.073, hairFlow, 7);
    }
    if (belle) {
      sphere(hair, 0.012, 0.47, -0.126, 0.41, 0.31, 0.34, head, 12);
      thread(gold, [[-0.23, 0.349, -0.19], [-0.14, 0.402, -0.28], [0, 0.419, -0.30],
        [0.14, 0.402, -0.28], [0.23, 0.349, -0.19]], 0.025, head);
    }
    const crown = [
      [-0.19, 0.365, 0.12], [-0.21, 0.47, 0.15], [-0.080, 0.435, 0.19], [0, 0.55, 0.206],
      [0.080, 0.435, 0.19], [0.21, 0.47, 0.15], [0.19, 0.365, 0.12], [0, 0.383, 0.22], [-0.19, 0.365, 0.12],
    ];
    thread(gold, crown, 0.021, head);
    jewel(gem, 0, 0.505, 0.208, 0.081, head);

    const arms = [];
    const steps = [];
    for (const side of [-1, 1]) {
      const shoulder = group('shoulder', body, side * 0.43, 1.84, 0.016);
      shoulder.rotation.z = side * 0.24;
      sphere(trim, 0, -0.018, 0, belle ? 0.30 : 0.26, 0.29, 0.31, shoulder, 12);
      sphere(skin, 0, -0.21, 0, 0.145, 0.34, 0.16, shoulder);
      const elbow = group('elbow', shoulder, 0, -0.329, 0);
      sphere(skin, 0, -0.113, 0, 0.130, 0.308, 0.123, elbow);
      sphere(skin, 0, -0.260, 0.008, 0.147, 0.186, 0.125, elbow, 10);
      if (!belle) {
        ring(gold, 0, -0.278, 0.009, 0.133, 0.018, elbow);
        jewel(gem, 0, -0.273, -0.065, 0.049, elbow);
      }
      arms.push({ shoulder, elbow });
      const hip = group('hip', body, side * 0.19, 1.074, 0);
      sphere(deep, 0, -0.219, 0, 0.20, 0.52, 0.201, hip);
      const knee = group('knee', hip, 0, -0.44, 0);
      sphere(skin, 0, -0.19, 0, 0.13, 0.43, 0.16, knee);
      sphere(deep, 0, -0.478, 0.081, 0.197, 0.145, 0.34, knee, 13);
      jewel(gem, 0, -0.422, 0.189, 0.045, knee);
      steps.push({ hip, knee });
    }
    const shade = ground('racer shade', contact, 0, 0, 2.55, 2.01, 0.012);
    const name = label(racer, root);
    for (const [parent, materials] of figureParts) {
      const inverse = parent.computeWorldMatrix(true).clone().invert();
      for (const parts of materials.values()) {
        if (parts.length < 2) continue;
        const merged = B.Mesh.MergeMeshes(parts, true, true);
        merged.bakeTransformIntoVertices(inverse);
        merged.parent = parent;
        merged.isPickable = false;
      }
    }
    figureParts = undefined;
    return { root, body, skirt, head, hairFlow, arms, steps, shade, name, previousX: racer.x, yaw: -2.73 };
  }

  const figures = new Map(initialRace.racers.map(racer => [racer.id, princess(racer)]));
  const sparkMat = material('sprint starlight', '#ffecae', 0);
  sparkMat.emissiveColor = B.Color3.FromHexString('#ffd868');
  const dustMat = material('sprint rose light', '#ffe1b8', 0);
  dustMat.emissiveColor = B.Color3.FromHexString('#f6a970');
  const sparkles = Array.from({ length: 24 }, (_, index) => {
    const mesh = jewel(index % 3 === 0 ? dustMat : sparkMat, 0, 0, 0, index % 3 === 0 ? 0.135 : 0.095);
    mesh.setEnabled(false);
    return mesh;
  });

  const ribbons = [-1, 1].map(side => {
    const path = Array.from({ length: 15 }, (_, i) => v(side * 0.57, 0.5, -i * 0.32));
    const mesh = B.MeshBuilder.CreateTube('sprint ribbon', {
      path, radiusFunction: i => 0.019 * Math.sin(Math.PI * i / 17), tessellation: 5, updatable: true,
    }, scene);
    mesh.material = dustMat;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return { side, path, mesh };
  });

  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let last = 0;
  let previousDistance = 0;
  let cameraX = 0;
  let motionClock = 0;

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    const aspect = width / Math.max(1, height);
    camera.fov = aspect < 0.87 ? 2 * Math.atan(0.39 / aspect) : 0.77;
    engine.setHardwareScalingLevel(1 / Math.min(globalThis.devicePixelRatio || 1, 1.6));
    engine.resize();
  }

  function animateFigure(racer, phase, dt, sprinting, active) {
    const f = figures.get(racer.id);
    const x = racer.x * LANE;
    const y = racer.jumpHeight || 0;
    const grounded = y < 0.008;
    const running = active && !preference.matches;
    const stride = racer.distance * 1.55 + (racer.id === 'torres' ? 2 : 0.5);
    const gait = running ? Math.sin(stride) : 0;
    const sidestep = active && dt > 0 ? Math.max(-0.38, Math.min(0.38, (racer.x - f.previousX) * 3)) : 0;
    f.previousX = racer.x;
    f.root.position.set(x, y, racer.distance);
    f.shade.position.x = x + 0.23 + y * 0.5;
    f.shade.position.z = racer.distance + 0.17 + y * 0.4;
    f.shade.scaling.x = 1 + y * 0.19;
    f.shade.scaling.z = 1 + y * 0.16;

    const targetYaw = phase === 'ready' ? (racer.id === 'felice' ? Math.PI : -2.73) : sidestep;
    let yawChange = targetYaw - f.yaw;
    yawChange = Math.atan2(Math.sin(yawChange), Math.cos(yawChange));
    f.yaw += yawChange * (dt ? Math.min(1, dt * 11) : 1);
    f.body.rotation.y = f.yaw;
    f.body.rotation.x = running ? (sprinting ? 0.22 : 0.10) : 0;
    f.body.rotation.z = running ? -sidestep * 0.43 + 0.033 * gait : 0;
    f.body.position.y = grounded && running ? 0.065 * Math.abs(gait) : 0;
    f.skirt.rotation.x = running ? gait * 0.079 - y * 0.04 : 0;
    f.skirt.rotation.z = running ? gait * 0.065 + sidestep * 0.14 : 0;
    f.skirt.scaling.z = sprinting && running ? 1.11 + 0.05 * gait : 1;
    f.hairFlow.rotation.x = running ? -0.16 + 0.083 * gait - (sprinting ? 0.27 : 0) : 0;
    f.hairFlow.rotation.z = running ? 0.090 * gait : 0;
    f.head.rotation.y = phase === 'ready' ? 0.10 : -sidestep * 0.29;
    f.arms.forEach(({ shoulder, elbow }, index) => {
      const swing = gait * (index === 0 ? -1 : 1);
      shoulder.rotation.x = grounded ? swing * 0.53 : -0.58 - 0.19 * swing;
      shoulder.rotation.z = (index === 0 ? -1 : 1) * (grounded ? 0.24 : 0.43);
      elbow.rotation.x = running ? -0.70 - 0.28 * swing : -0.06;
    });
    f.steps.forEach(({ hip, knee }, index) => {
      const swing = gait * (index === 0 ? 1 : -1);
      // A short stride keeps the trailing shoe below the flared skirt.
      hip.rotation.x = grounded ? swing * (sprinting ? 0.38 : 0.31) : -0.42 - 0.10 * swing;
      knee.rotation.x = grounded ? Math.max(0, swing * 0.34) : 0.65;
    });
  }

  function render(race, { now = 0, paused = false, sprinting = false } = {}) {
    const dt = last ? Math.max(0, Math.min(0.050, (now - last) / 1000)) : 0;
    last = now;
    const player = race.racers.find(racer => racer.id === 'belle');
    const active = race.phase === 'racing' && !paused;
    const fast = active && (player.sprinting ?? sprinting) && player.slowRemaining <= 0;
    const distance = player.distance;
    const reset = distance < previousDistance;
    if (active && !preference.matches) motionClock += dt;
    previousDistance = distance;
    const portrait = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()) < 0.87;
    const targetX = race.phase === 'ready' ? 0 : player.x * (portrait ? LANE * 0.20 : LANE * 0.44);
    cameraX += (targetX - cameraX) * (reset || !dt ? 1 : Math.min(1, dt * 8));
    const cameraDistance = race.phase === 'ready' ? (portrait ? 16.5 : 10.5) : (portrait ? 14 : 9.15);
    camera.position.set(cameraX, portrait ? 4.32 : 4.6, distance - cameraDistance);
    camera.setTarget(v(cameraX * 0.83, 1.76, distance + 9.8));
    clouds.position.set(motionClock * 0.33, 0, distance);
    peaks.position.z = distance;

    for (const sector of sectors) {
      const inView = sector.z > distance - 53 && sector.z < distance + 196;
      if (inView !== sector.visible) {
        sector.meshes.forEach(mesh => mesh.setEnabled(inView));
        sector.visible = inView;
      }
    }
    for (const racer of race.racers) {
      animateFigure(racer, race.phase, dt, racer.id === 'belle' && fast, active);
      const withBelle = racer.id !== 'belle' && Math.abs(racer.x - player.x) < 0.50
        && Math.abs(racer.distance - distance) < 6;
      figures.get(racer.id).name.position.y = withBelle ? (racer.id === 'felice' ? 3.48 : 3.89) : 3.02;
    }
    const showTrail = fast && !preference.matches;
    for (const { side, path, mesh } of ribbons) {
      mesh.setEnabled(showTrail);
      if (!showTrail) continue;
      path.forEach((point, index) => {
        const age = index / (path.length - 1);
        const wave = Math.sin(motionClock * 10 - age * 7 + side * 1.3);
        point.set(player.x * LANE + side * (0.52 + age * 0.63 + wave * age * 0.18),
          player.jumpHeight * (1 - age) + 0.38 - age * 0.23 + wave * 0.12, distance - 0.62 - age * 4.6);
      });
      B.MeshBuilder.CreateTube('sprint ribbon', {
        path, radiusFunction: i => 0.019 * Math.sin(Math.PI * i / 17), instance: mesh,
      }, scene);
    }
    for (const [index, spark] of sparkles.entries()) {
      spark.setEnabled(showTrail);
      if (!showTrail) continue;
      const side = index % 2 === 0 ? 1 : -1;
      const age = ((index * 0.041 + motionClock * 1.7) % 1);
      const trail = age * 4.7;
      const glimmer = Math.sin(motionClock * 8.5 + index * 1.45);
      spark.position.set(player.x * LANE + side * (0.43 + 0.75 * age + 0.21 * glimmer),
        player.jumpHeight * (1 - age) + 0.21 + 0.52 * (1 - age) + 0.17 * glimmer, distance - 0.55 - trail);
      spark.scaling.setAll((1 - age) * (0.85 + 0.52 * glimmer) + 0.03);
      spark.rotation.z = index + motionClock * 2.2;
    }
    scene.render();
  }

  resize();
  render(initialRace);
  scene.executeWhenReady(() => { if (!scene.isDisposed) scene.render(); });
  return { render, resize, dispose: () => engine.dispose() };
}
