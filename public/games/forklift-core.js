/*
 * Forklift — Warehouse Shift
 * Procedural 3D models registered as A-Frame components.
 * No downloaded models, textures, or runtime network requests are required.
 */
(() => {
  'use strict';
  const THREE = AFRAME.THREE;
  const palette = {
    steel: '#384944', steelLight: '#61756d', yellow: '#edb844', yellowLight: '#ffd372',
    rubber: '#293430', rim: '#d2d8c9', orange: '#cf864c', rack: '#627d79',
    wood: '#bca074', tape: '#e7dab5', cream: '#d6c49d', green: '#9cb577'
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map();
  let seed = 41;
  function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function material(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: .84, metalness: .03, ...extra }));
    return mats.get(key);
  }
  function box(parent, w, h, d, x, y, z, color, options = {}) {
    const m = new THREE.Mesh(boxGeometry, color?.isMaterial ? color : material(color));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    m.castShadow = options.shadow !== false; m.receiveShadow = true;
    if (options.ry) m.rotation.y = options.ry;
    if (options.rz) m.rotation.z = options.rz;
    if (options.rx) m.rotation.x = options.rx;
    parent.add(m); return m;
  }
  function cylinder(parent, rt, rb, h, x, y, z, color, segments = 16, rotation) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material(color));
    m.position.set(x, y, z); if (rotation) m.rotation.set(...rotation);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function sphere(parent, radius, x, y, z, color, scale = [1, 1, 1]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material(color));
    m.position.set(x, y, z); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function beam(parent, start, end, radius, color) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const mid = a.clone().add(b).multiplyScalar(.5);
    const m = cylinder(parent, radius, radius, a.distanceTo(b), ...mid.toArray(), color, 10);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return m;
  }
  function bevelBox(parent, w, h, d, x, y, z, color, r = .07) {
    const shape = new THREE.Shape(), a = w / 2 - r, b = h / 2 - r;
    shape.moveTo(-a, -b); shape.lineTo(a, -b); shape.lineTo(a, b); shape.lineTo(-a, b); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -d / 2 + r);
    const m = new THREE.Mesh(g, material(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function label(parent, text, x, y, z, width, height, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = options.resolution || 1024; canvas.height = Math.round(canvas.width * height / width);
    const ctx = canvas.getContext('2d');
    if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = options.color || '#617256';
    const lines = text.split('\n'), lineH = canvas.height / (lines.length + .5);
    ctx.font = `700 ${Math.round(lineH * (options.fontScale || .78))}px Arial, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * lineH, canvas.width * .93));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: !options.background, side: THREE.DoubleSide, depthWrite: !!options.background, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.position.set(x, y, z); if (options.floor) mesh.rotation.x = -Math.PI / 2;
    if (options.ry) mesh.rotation.y = options.ry;
    mesh.renderOrder = 1; parent.add(mesh); return mesh;
  }
  // Batch static architecture by material to keep the scene light on mobile GPUs.
  function batchBoxes(group, directOnly = false) {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map();
    group.traverse(mesh => {
      if (!mesh.isMesh || mesh.geometry !== boxGeometry || mesh.material.transparent || (directOnly && mesh.parent !== group)) return;
      const key = mesh.material.uuid + mesh.castShadow;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    });
    for (const meshes of batches.values()) {
      if (meshes.length < 3) continue;
      const instanced = new THREE.InstancedMesh(boxGeometry, meshes[0].material, meshes.length);
      instanced.castShadow = meshes[0].castShadow; instanced.receiveShadow = true;
      meshes.forEach((mesh, i) => { instanced.setMatrixAt(i, mesh.matrixWorld.clone().premultiply(inverse)); mesh.removeFromParent(); });
      instanced.instanceMatrix.needsUpdate = true; instanced.computeBoundingSphere(); group.add(instanced);
    }
  }
  function carton(parent, x, y, z, w, h, d, color = palette.cream, detailed = true) {
    box(parent, w, h, d, x, y + h / 2, z, color);
    box(parent, w * .16, .009, d + .008, x, y + h + .008, z, palette.tape, { shadow: false });
    box(parent, w * .16, h, .011, x, y + h / 2, z + d / 2 + .008, palette.tape, { shadow: false });
    if (detailed) {
      box(parent, w * .3, h * .25, .012, x - w * .19, y + h * .47, z + d / 2 + .016, '#eeedde', { shadow: false });
      box(parent, w * .18, .018, .016, x - w * .19, y + h * .5, z + d / 2 + .023, '#8e917a', { shadow: false });
      box(parent, w * .11, .012, .016, x - w * .22, y + h * .44, z + d / 2 + .023, '#8e917a', { shadow: false });
    }
  }
  function floorFrame(parent, x, z, w, d, color, cornerOnly = false) {
    const line = .06, y = .018;
    if (!cornerOnly) {
      box(parent, w, .025, line, x, y, z - d / 2, color, { shadow: false });
      box(parent, w, .025, line, x, y, z + d / 2, color, { shadow: false });
      box(parent, line, .025, d, x - w / 2, y, z, color, { shadow: false });
      box(parent, line, .025, d, x + w / 2, y, z, color, { shadow: false });
    } else {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(parent, .65, .025, line, x + sx * (w / 2 - .325), y, z + sz * d / 2, color, { shadow: false });
        box(parent, line, .025, .65, x + sx * w / 2, y, z + sz * (d / 2 - .325), color, { shadow: false });
      }
    }
  }
  function cone(parent, x, z) {
    box(parent, .52, .07, .52, x, .035, z, '#576255');
    cylinder(parent, .065, .22, .62, x, .37, z, '#d88c4a');
    cylinder(parent, .115, .15, .14, x, .42, z, '#f2f0dd');
  }
  function rack(parent, x, z, id, colliders) {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(g, .14, 4.3, .14, sx * 1.5, 2.15, sz * 1.7, palette.rack);
      box(g, .25, .5, .25, sx * 1.5, .25, sz * 1.7, '#dba24d');
      box(g, .34, .07, .34, sx * 1.5, .035, sz * 1.7, '#617062');
    }
    for (const level of [.22, 1.66, 3.1]) {
      box(g, 3.08, .11, 3.46, 0, level, 0, '#b2b9a7');
      for (const sz of [-1, 1]) box(g, 3.14, .19, .12, 0, level, sz * 1.71, palette.orange);
      for (const sx of [-1, 1]) box(g, .12, .19, 3.42, sx * 1.53, level, 0, palette.orange);
      for (const cx of [-.77, .73]) for (const cz of [-.86, .76]) {
        if (random() < .18) continue;
        const w = .85 + random() * .37, h = .48 + random() * .40, d = .85 + random() * .3;
        const colors = ['#c9b58f', '#d2c3a1', '#b9ad8d', '#c3ad86', '#9cab99'];
        carton(g, cx, level + .075, cz, w, h, d, colors[Math.floor(random() * colors.length)]);
        if (random() > .73 && h < .68) carton(g, cx, level + .075 + h, cz, w * .82, .33, d * .92, '#ded0af', false);
      }
    }
    beam(g, [-1.5, .6, -1.69], [-1.5, 3.95, 1.69], .026, '#8a9e90');
    beam(g, [-1.5, .6, 1.69], [-1.5, 3.95, -1.69], .026, '#8a9e90');
    label(g, `R · ${id}`, 0, 1.67, 1.795, .7, .18, { color: '#657762', background: '#f4f0d9' });
    colliders.push({ x, z, hw: 1.72, hd: 1.93, kind: 'rack' });
  }
  function pallet(id) {
    const g = new THREE.Group(); g.name = `Pallet ${id + 1}`;
    for (const x of [-.62, 0, .62]) {
      box(g, .18, .065, 1.36, x, .035, 0, '#ad8f60');
      for (const z of [-.52, 0, .52]) box(g, .18, .105, .19, x, .1, z, '#b5996c');
    }
    for (let i = 0; i < 5; i++) box(g, 1.67, .075, .20, 0, .18, -.56 + i * .28, '#cbb181');
    if (id === 1) {
      bevelBox(g, 1.43, .94, 1.13, 0, .70, 0, '#859e90', .035);
      for (const x of [-.58, -.3, .3, .58]) {
        box(g, .045, .84, 1.16, x, .70, 0, '#769184');
      }
      box(g, 1.48, .10, 1.17, 0, 1.21, 0, '#a5b6a4');
      box(g, 1.49, .11, 1.18, 0, .31, 0, '#718c7d');
      box(g, .18, 1.0, .01, 0, .73, .61, '#d9ddc4', { shadow: false });
      box(g, .18, .01, 1.18, 0, 1.275, 0, '#d9ddc4', { shadow: false });
    } else if (id === 2) {
      carton(g, -.37, .225, 0, .69, .73, 1.12, '#c8af85');
      carton(g, .37, .225, 0, .69, .73, 1.12, '#cfb98e');
      carton(g, -.17, .96, 0, 1.02, .42, .93, '#ded0ad');
    } else {
      carton(g, 0, .225, 0, 1.41, .87, 1.15, '#d4bd91');
      carton(g, -.30, 1.10, -.1, .72, .36, .87, '#dfcca8');
      carton(g, .43, 1.10, .01, .61, .36, .9, '#c8b087');
    }
    const tag = String(id + 1).padStart(2, '0');
    label(g, tag, .29, .80, .627, .43, .32, { color: '#74664a', background: '#f5efd9', resolution: 256 });
    label(g, tag, -.29, .80, -.627, .43, .32, { color: '#74664a', background: '#f5efd9', resolution: 256, ry: Math.PI });
    batchBoxes(g);
    return g;
  }

  AFRAME.registerComponent('warehouse-world', {
    init() {
      seed = 41;
      this.root = new THREE.Group(); this.el.setObject3D('mesh', this.root);
      this.static = new THREE.Group(); this.root.add(this.static);
      this.colliders = []; this.bays = []; this.pallets = [];
      this.createFloor(); this.createWalls(); this.createStorage(); this.createBays(); this.createPallets(); this.createWayfinding(); this.createLights();
      batchBoxes(this.static);
    },
    createFloor() {
      const g = this.static;
      box(g, 34.6, .38, 38.6, 0, -.23, -.5, '#bcc6b2');
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#d8ded0'; ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 15500; i++) {
        ctx.fillStyle = random() > .5 ? 'rgba(255,255,243,.075)' : 'rgba(66,85,54,.035)';
        ctx.fillRect(random() * 1024, random() * 1024, 1 + random() * 2, 1 + random() * 2);
      }
      ctx.strokeStyle = 'rgba(108,124,93,.09)'; ctx.lineWidth = 1.6;
      for (let i = 0; i <= 12; i++) { const n = i * 1024 / 12; ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n, 1024); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, n); ctx.lineTo(1024, n); ctx.stroke(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const floorMat = new THREE.MeshStandardMaterial({ map: tex, color: '#ffffff', roughness: 1 });
      box(g, 34, .10, 38, 0, -.05, -.5, floorMat, { shadow: false });
      for (const x of [-16.9, 16.9]) box(g, .17, .10, 37.8, x, .05, -.5, '#b4bea8');
      box(g, 34, .10, .17, 0, .05, 18.4, '#b4bea8');
      // Main traffic lane and stopping lines.
      for (const x of [-10.4, 10.4]) {
        box(g, .085, .016, 24.8, x, .012, 3.0, '#c7ae62', { shadow: false });
        box(g, .085, .016, 24.8, x + (x > 0 ? .17 : -.17), .012, 3.0, '#e5ddae', { shadow: false });
      }
      box(g, 20.9, .016, .085, 0, .012, 15.4, '#c7ae62', { shadow: false });
      for (let z = -7.9; z < 13; z += 2.2) box(g, .07, .018, .78, .1, .014, z, '#f0f1df', { shadow: false });
      label(g, 'RECEIVING', -5.2, .017, 13.9, 6.4, 1.0, { floor: true, color: '#aab398' });
      label(g, 'KEEP IT MOVING. KEEP IT SAFE.', 5.2, .017, 16.7, 8, .46, { floor: true, color: '#a2af90' });
      for (const z of [10.8, -5]) {
        // Simple lane arrows painted on the concrete.
        box(g, .16, .02, .90, 3.3, .018, z, '#eff0de', { shadow: false });
        box(g, .14, .02, .55, 3.14, .018, z - .35, '#eff0de', { shadow: false, ry: -.65 });
        box(g, .14, .02, .55, 3.46, .018, z - .35, '#eff0de', { shadow: false, ry: .65 });
      }
    },
    createWalls() {
      const g = this.static;
      box(g, 34.4, 4.9, .34, 0, 2.4, -19.0, '#d2dacb');
      box(g, 34.6, .15, .52, 0, 4.91, -19, '#aab9a3');
      box(g, .30, 3.5, 37.6, -17.15, 1.70, -.45, '#d7dfcf');
      box(g, .44, .14, 37.7, -17.15, 3.52, -.45, '#bac8af');
      box(g, 34, .38, .07, 0, .2, -18.78, '#b5c2a8');
      box(g, .07, .38, 37.4, -16.96, .2, -.4, '#b5c2a8');
      box(g, 34, .20, .045, 0, 1.3, -18.79, '#b2bc9c');
      box(g, .045, .20, 37.4, -16.96, 1.3, -.4, '#b2bc9c');
      for (let x = -16; x <= 16; x += 2) box(g, .04, 4.4, .045, x, 2.6, -18.80, '#c4cfbb', { shadow: false });
      for (const z of [-16, -7, 2, 11, 18]) {
        box(g, .37, 3.55, .35, -16.86, 1.77, z, '#bbc8b0');
        box(g, .4, .9, .4, -16.85, .45, z, '#cfb772');
      }
      // Loading door, shutter slats, rubber buffers and safety bollards.
      box(g, 7.3, 4.27, .22, 0, 2.14, -18.64, '#7d8f7b');
      box(g, 6.7, 3.87, .25, 0, 1.96, -18.47, '#9ba994');
      for (let y = .2; y < 3.9; y += .29) box(g, 6.66, .025, .045, 0, y, -18.32, '#849880', { shadow: false });
      box(g, 6.7, .17, .16, 0, .1, -18.25, '#72806d');
      box(g, .58, .07, .09, 0, 1.23, -18.25, '#5c6e5a');
      label(g, 'DISPATCH  /  01–03', 0, 4.5, -18.75, 6.7, .55, { color: '#eef0dc', background: '#6c8161' });
      for (const x of [-3.82, 3.82]) {
        box(g, .28, 1.0, .3, x, .55, -18.3, '#50614d');
        cylinder(g, .15, .15, 1.2, x, .60, -16.9, '#d5b55f');
        cylinder(g, .155, .155, .15, x, .93, -16.9, '#5e6b50');
        cylinder(g, .25, .25, .07, x, .04, -16.9, '#9aa886');
        this.colliders.push({ x, z: -16.9, hw: .22, hd: .22, kind: 'bollard' });
      }
      label(g, 'NORTHLINE', -10.1, 3.4, -18.76, 8.3, 1.15, { color: '#7f9170' });
      label(g, 'WAREHOUSING & GOOD WORK', -10.1, 2.63, -18.75, 6.6, .34, { color: '#92a183' });
      box(g, 5.3, 1.45, .12, 10.1, 3.45, -18.73, '#9cae99');
      box(g, 5.0, 1.19, .14, 10.1, 3.45, -18.63, '#c5d8cc');
      for (const x of [8.5, 10.1, 11.7]) box(g, .08, 1.25, .04, x, 3.45, -18.52, '#94a88f');
      box(g, 5.07, .07, .04, 10.1, 3.45, -18.51, '#94a88f');
      box(g, 1.3, 2.45, .14, 14.6, 1.25, -18.71, '#8ba48a');
      box(g, 1.06, 2.24, .17, 14.6, 1.18, -18.59, '#afbd9e');
      box(g, .62, .72, .02, 14.6, 1.77, -18.49, '#c9d8c5');
      box(g, .05, .16, .05, 14.98, 1.12, -18.44, '#758a69');
      label(g, 'EXIT', 14.6, 2.73, -18.69, .95, .29, { color: '#f6f8e9', background: '#7e9c70' });
      cylinder(g, .11, .11, .48, 5.2, .72, -18.56, '#b77462');
      box(g, .13, .06, .09, 5.2, 1.0, -18.56, '#5e675b');
      // A little bit of life in the back corner.
      cylinder(g, .45, .32, .55, -15.5, .28, -16.8, '#acb49b');
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.4, height = .55 + random() * .6;
        beam(g, [-15.5, .55, -16.8], [-15.5 + Math.cos(angle) * .40, height + .55, -16.8 + Math.sin(angle) * .4], .04, '#7c9868');
        sphere(g, .35, -15.5 + Math.cos(angle) * .32, height + .45, -16.8 + Math.sin(angle) * .32, '#8aa376', [.60, 1.0, .5]);
      }
      for (const x of [-10, 10]) {
        box(g, 4.8, .12, .55, x, 4.60, -16.7, '#9eae92');
        box(g, 4.25, .025, .34, x, 4.52, -16.7, '#f3f3dc', { shadow: false });
        beam(g, [x - 1.8, 4.67, -16.7], [x - 1.8, 4.83, -18.8], .034, '#a0ae95');
        beam(g, [x + 1.8, 4.67, -16.7], [x + 1.8, 4.83, -18.8], .034, '#a0ae95');
      }
    },
    createStorage() {
      const g = this.static;
      [-4.5, .2, 4.9, 9.6].forEach((z, i) => rack(g, -13.55, z, `0${i + 1}`, this.colliders));
      [-4.4, .4, 5.2].forEach((z, i) => rack(g, 13.35, z, `0${i + 5}`, this.colliders));
      carton(g, 13.1, .03, 12.0, 1.7, 1.02, 1.65, '#baa27b');
      carton(g, 13.0, 1.06, 12.0, 1.44, .79, 1.4, '#cdb994');
      carton(g, 14.7, .03, 10.7, 1.23, .9, 1.14, '#d2c5a2');
      this.colliders.push({ x: 13.45, z: 11.5, hw: 1.95, hd: 1.4, kind: 'boxes' });
      floorFrame(g, 13.6, 11.8, 4.6, 4.3, '#c2b26b', true);
      for (const [x, z] of [[-10.95, 13.9], [11.1, 9.35], [11.1, -7.3], [-11.0, -7.4]]) {
        cone(g, x, z); this.colliders.push({ x, z, hw: .23, hd: .23, kind: 'cone' });
      }
      // Parked empty wooden pallets.
      for (let h = 0; h < 4; h++) {
        for (let j = 0; j < 5; j++) box(g, 1.7, .075, .20, 13.6, .12 + h * .18, 15.4 - .56 + j * .28, '#baa47a');
        for (const x of [-.62, .62]) box(g, .18, .11, 1.3, 13.6 + x, .05 + h * .18, 15.4, '#ad966a');
      }
      this.colliders.push({ x: 13.6, z: 15.4, hw: .95, hd: .78, kind: 'pallet stack' });
    },
    createBays() {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 8, z = -12.8;
        const baseMat = new THREE.MeshStandardMaterial({ color: '#cdddb9', roughness: 1 });
        const base = box(this.root, 4.5, .017, 4.9, x, .012, z, baseMat, { shadow: false });
        floorFrame(this.static, x, z, 4.5, 4.9, '#a4b980');
        floorFrame(this.static, x, z, 4.72, 5.12, '#e8edd9', true);
        label(this.static, `0${i + 1}`, x, .032, z - .55, 2.7, 1.7, { floor: true, color: '#95aa75' });
        label(this.static, 'DELIVERY BAY', x, .031, z + 1.58, 3.8, .46, { floor: true, color: '#94a678' });
        box(this.static, 4.48, .08, .19, x, .04, z - 2.52, '#a8b390');
        for (let n = 0; n < 15; n++) box(this.static, .16, .025, .40, x - 2.12 + n * .302, .021, z + 2.86, n % 2 === 0 ? '#bdb26c' : '#7d8c68', { ry: -.55, shadow: false });
        this.bays.push({ x, z, base, material: baseMat });
      }
    },
    createPallets() {
      const starts = [{ x: -5.2, z: 4.4 }, { x: 5.5, z: 1.0 }, { x: -5.2, z: -5.5 }];
      starts.forEach((start, id) => {
        const group = pallet(id); group.position.set(start.x, 0, start.z); this.root.add(group);
        floorFrame(this.static, start.x, start.z, 3.25, 3.05, '#e2c383', true);
        label(this.static, `P 0${id + 1}`, start.x, .031, start.z + 1.8, 1.75, .42, { floor: true, color: '#b4b18b' });
        this.pallets.push({ id, group, start: { ...start }, delivered: false });
      });
    },
    createWayfinding() {
      this.ringMaterial = new THREE.MeshBasicMaterial({ color: '#e8b450', side: THREE.DoubleSide, transparent: true, opacity: .78, depthWrite: false });
      this.ring = new THREE.Mesh(new THREE.RingGeometry(1.38, 1.43, 64), this.ringMaterial);
      this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .046; this.root.add(this.ring);
      this.pathMaterial = new THREE.MeshBasicMaterial({ color: '#e3b252', transparent: true, opacity: .52, depthWrite: false });
      this.path = [];
      for (let i = 0; i < 24; i++) {
        const dash = new THREE.Mesh(boxGeometry, this.pathMaterial); dash.scale.set(.09, .012, .29); dash.position.y = .035;
        this.root.add(dash); this.path.push(dash);
      }
    },
    createLights() {
      const hemisphere = new THREE.HemisphereLight('#fff9e9', '#a7b69b', 1.4); this.root.add(hemisphere);
      const ambient = new THREE.AmbientLight('#fffce9', .25); this.root.add(ambient);
      const sun = new THREE.DirectionalLight('#fff5db', 2.25);
      sun.position.set(-10, 22, 15); sun.target.position.set(0, 0, -2); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
      sun.shadow.camera.top = 27; sun.shadow.camera.bottom = -27; sun.shadow.camera.near = 1; sun.shadow.camera.far = 75;
      sun.shadow.bias = -.0003; sun.shadow.normalBias = .045; sun.shadow.radius = 3;
      this.root.add(sun); this.root.add(sun.target); this.sun = sun;
    }
  });

  AFRAME.registerComponent('forklift-model', {
    init() {
      const g = new THREE.Group(); this.el.setObject3D('mesh', g); this.model = g; this.wheels = [];
      // Chassis and rounded counterweight. The front of the vehicle points along -Z.
      bevelBox(g, 1.50, .58, 2.16, 0, .62, .13, palette.yellow, .08);
      box(g, 1.35, .15, 1.85, 0, .32, .13, palette.steel);
      bevelBox(g, 1.53, .68, .72, 0, .95, .90, palette.yellow, .09);
      box(g, 1.38, .16, .64, 0, 1.34, .86, palette.yellowLight);
      box(g, 1.48, .16, .14, 0, .48, 1.32, palette.steel);
      box(g, 1.50, .14, .53, 0, .95, -.60, palette.yellowLight);
      box(g, 1.15, .05, .85, 0, .94, .03, '#526053');
      for (const s of [-1, 1]) {
        box(g, .22, .10, .57, s * .78, .58, .07, '#56604e');
        box(g, .24, .06, .57, s * .80, .78, .03, '#869077');
        for (let i = 0; i < 4; i++) box(g, .012, .045, .35, s * .772, .85 + i * .1, .93, '#99864d', { shadow: false });
        box(g, .016, .16, .44, s * .774, .69, -.37, '#f5d275', { shadow: false });
        // Wheel assemblies, with rear-wheel steering animated in game.js.
        for (const z of [-.71, .82]) {
          const pivot = new THREE.Group(); pivot.position.set(s * .78, .405, z); g.add(pivot);
          const spin = new THREE.Group(); pivot.add(spin);
          cylinder(spin, .405, .405, .25, 0, 0, 0, palette.rubber, 24, [0, 0, Math.PI / 2]);
          cylinder(spin, .27, .27, .264, 0, 0, 0, '#4b5448', 24, [0, 0, Math.PI / 2]);
          cylinder(spin, .20, .20, .279, 0, 0, 0, palette.rim, 16, [0, 0, Math.PI / 2]);
          cylinder(spin, .081, .081, .291, 0, 0, 0, '#788271', 12, [0, 0, Math.PI / 2]);
          for (let n = 0; n < 5; n++) {
            const a = n / 5 * Math.PI * 2;
            cylinder(spin, .021, .021, .29, 0, Math.cos(a) * .134, Math.sin(a) * .134, '#7e8676', 6, [0, 0, Math.PI / 2]);
          }
          this.wheels.push({ pivot, spin, rear: z > 0 });
        }
      }
      label(g, '01', 0, .98, 1.277, .43, .30, { color: '#8b7139', resolution: 256 });
      for (const x of [-.56, .56]) {
        box(g, .19, .12, .032, x, 1.16, 1.284, '#bd7357');
        box(g, .19, .10, .10, x, 1.03, -.9, '#f4ecd1');
      }
      // Operator's cage and slatted overhead guard.
      for (const x of [-.65, .65]) for (const z of [-.60, .79]) box(g, .085, 1.48, .085, x, 1.87, z, palette.steel);
      bevelBox(g, 1.66, .15, 1.70, 0, 2.65, .09, palette.yellow, .045);
      box(g, 1.52, .09, 1.55, 0, 2.53, .09, palette.steel);
      for (let i = 0; i < 5; i++) box(g, .075, .027, 1.41, -.57 + i * .285, 2.745, .09, '#d7a746', { shadow: false });
      // Seat, dash and wheel.
      bevelBox(g, .60, .16, .57, 0, 1.16, .28, '#3e4942', .055);
      const seat = bevelBox(g, .60, .64, .13, 0, 1.46, .53, '#3d4840', .04); seat.rotation.x = .14;
      box(g, .85, .2, .25, 0, 1.3, -.54, palette.steel);
      beam(g, [0, 1.04, -.44], [0, 1.56, -.33], .047, '#586557');
      const steering = new THREE.Mesh(new THREE.TorusGeometry(.21, .021, 7, 20), material('#34473d'));
      steering.position.set(0, 1.55, -.32); steering.rotation.x = -Math.PI / 2 + .38; g.add(steering);
      beam(g, [-.2, 1.55, -.32], [.2, 1.55, -.32], .014, '#526151');
      for (const x of [.42, .53]) { beam(g, [x, 1.05, -.03], [x, 1.40, -.08], .015, '#596451'); sphere(g, .043, x, 1.4, -.08, '#3d4f40'); }
      // A tiny, hard-hatted operator.
      bevelBox(g, .40, .49, .30, 0, 1.57, .18, '#5f7e74', .07);
      box(g, .43, .40, .025, 0, 1.59, .014, '#adc377');
      for (const x of [-.125, .125]) box(g, .048, .42, .034, x, 1.61, -.012, '#e2dfad');
      sphere(g, .16, 0, 1.98, .13, '#cbb093', [.90, 1.1, .88]);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(.21, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), material('#eac76b'));
      helmet.position.set(0, 2.08, .13); helmet.castShadow = true; g.add(helmet);
      cylinder(g, .24, .24, .035, 0, 2.08, .12, '#f0cf77');
      box(g, .04, .035, .29, 0, 2.267, .13, '#f0cf77');
      for (const s of [-1, 1]) {
        beam(g, [s * .19, 1.76, .11], [s * .26, 1.49, -.03], .075, '#65857a');
        beam(g, [s * .26, 1.49, -.03], [s * .17, 1.54, -.32], .061, '#65857a');
        sphere(g, .061, s * .17, 1.54, -.32, '#cbb093');
        beam(g, [s * .13, 1.3, .25], [s * .17, 1.11, -.10], .10, '#4f6662');
        beam(g, [s * .17, 1.11, -.10], [s * .19, .94, -.28], .08, '#4f6662');
        box(g, .17, .10, .29, s * .19, .96, -.29, '#3d4c3f');
      }
      // Telescopic mast, lift carriage and two long steel forks.
      for (const x of [-.54, .54]) {
        box(g, .14, 3.20, .17, x, 1.83, -1.045, palette.steel);
        box(g, .061, 2.98, .10, x - Math.sign(x) * .09, 1.78, -1.08, '#899487');
      }
      box(g, 1.22, .15, .2, 0, 3.41, -1.045, palette.steel);
      box(g, 1.19, .16, .20, 0, .51, -1.045, palette.steel);
      cylinder(g, .068, .068, 1.65, 0, 1.22, -.98, '#6e7e6c');
      cylinder(g, .041, .041, 1.16, 0, 2.40, -.98, '#c0c8b4');
      for (const x of [-.24, .24]) box(g, .024, 3.03, .028, x, 1.88, -1.14, '#9ba18b');
      this.liftGroup = new THREE.Group(); this.liftGroup.position.set(0, .12, -1.08); g.add(this.liftGroup);
      box(this.liftGroup, 1.24, .18, .14, 0, .35, -.14, '#46574b');
      box(this.liftGroup, 1.24, .075, .09, 0, .91, -.12, '#65745f');
      for (let i = 0; i < 6; i++) box(this.liftGroup, .036, .62, .08, -.55 + i * .22, .65, -.11, '#65745f');
      for (const x of [-.43, .43]) {
        box(this.liftGroup, .15, .59, .12, x, .34, -.15, '#5a6859');
        box(this.liftGroup, .15, .078, 1.41, x, .04, -.79, '#657364');
        box(this.liftGroup, .15, .04, .18, x, .02, -1.53, '#8b9882');
      }
      // Beacon and exhaust, animated independently of the chassis.
      cylinder(g, .09, .09, .05, .49, 2.76, .48, '#58654f');
      this.beacon = cylinder(g, .071, .086, .16, .49, 2.86, .48, '#f3c15b');
      this.beacon.material = new THREE.MeshStandardMaterial({ color: '#efbc50', emissive: '#e2a130', emissiveIntensity: .18, roughness: .4 });
      cylinder(g, .047, .047, 1.0, -.55, 1.72, 1.0, '#6f7766');
      cylinder(g, .064, .064, .11, -.55, 2.23, 1.0, '#50604f');
      batchBoxes(g, true);
      batchBoxes(this.liftGroup);
    },
    animate(speed, steering, liftHeight, time) {
      this.liftGroup.position.y = liftHeight;
      for (const wheel of this.wheels) {
        wheel.spin.rotation.x += speed / .405;
        wheel.pivot.rotation.y = wheel.rear ? -steering * .47 : 0;
      }
      this.beacon.material.emissiveIntensity = .12 + (Math.sin(time * 5.5) * .5 + .5) * .3;
    }
  });

  window.ForkliftModels = { palette, box, label };
})();

