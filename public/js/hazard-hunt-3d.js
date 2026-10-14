// Spot the Hazard — 3D pre-shift safety walk (client requirement, Oct 2026).
// Same rules as the retired 2D aisle: 60 seconds, six hazards hidden along the
// walk, +100 per find, −10 per wrong click. The aisle is now a first-person
// Three.js scene: drag to look, walk with W A S D / arrows or the touch pad,
// click a hazard to report it. Falls back to the 2D walk when WebGL is
// unavailable (fun-games.js catches the constructor error).
import * as THREE from "../vendor/three.module.js";
import { icon } from "./icons.js";

const BEST_KEY = "zi.fun.hazard.best";
const TOTAL = 60;
const store = {
  get: (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode — best scores simply do not persist */
    }
  },
};

// ---------------------------------------------------------------------------
// Hazard definitions: identical names and debriefs to the 2D walk, drawn as
// small procedural 3D props. `slots` lists the scene spots each hazard fits.
// ---------------------------------------------------------------------------
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.04, ...extra });
const box = (w, h, d, color, x, y, z, parent, extra) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};
const cyl = (rt, rb, h, color, x, y, z, parent, seg = 14) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};
const carton = (w, h, d, x, y, z, parent, color = "#cf9f63") => box(w, h, d, color, x, y + h / 2, z, parent);

const HAZARDS = [
  {
    id: "spill",
    name: "Slippery spill",
    why: "A spill on the main aisle is a slip hazard. Clean it up, put up the wet-floor sign, and only then walk across.",
    slots: [4, 5, 6, 11],
    build: (g) => {
      const puddle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.02, 24),
        new THREE.MeshStandardMaterial({ color: "#f4d35e", roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 }),
      );
      puddle.position.y = 0.012;
      puddle.receiveShadow = true;
      g.add(puddle);
      const blob = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.024, 18), puddle.material);
      blob.position.set(0.34, 0.014, 0.18);
      g.add(blob);
      // Knocked-over wet-floor sign.
      const sign = box(0.34, 0.02, 0.5, "#e8b923", -0.55, 0.03, 0.25, g);
      sign.rotation.z = 0.18;
      box(0.3, 0.3, 0.02, "#e8b923", -0.62, 0.12, 0.25, g).rotation.z = 0.5;
    },
  },
  {
    id: "exit",
    name: "Blocked emergency exit",
    why: "Boxes stacked in front of the exit door. Egress routes must stay clear at all times — this is checked in every fire drill.",
    slots: [0],
    build: (g) => {
      carton(0.62, 0.44, 0.5, -0.34, 0, 0.1, g);
      carton(0.7, 0.52, 0.55, 0.3, 0, 0.05, g, "#d8b07c");
      carton(0.6, 0.42, 0.48, 0.05, 0.44, 0.08, g, "#b98d55");
    },
  },
  {
    id: "dangle",
    name: "Unsecured load",
    why: "A carton is hanging off the rack edge, above the walkway. One nudge and it is a falling object. Restow it immediately.",
    slots: [1, 3, 7, 9],
    build: (g) => {
      const c = carton(0.62, 0.5, 0.5, 0, 1.42, 0, g);
      c.rotation.z = 0.16;
      c.position.x = 0.28;
    },
  },
  {
    id: "cable",
    name: "Cable across the walkway",
    why: "A power cable trailing across the yellow line is a trip hazard. Route it overhead or tape it flat at the side of the aisle.",
    slots: [5, 6, 4],
    build: (g) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.1, 0.03, 0.25),
        new THREE.Vector3(-0.4, 0.05, -0.15),
        new THREE.Vector3(0.4, 0.04, 0.3),
        new THREE.Vector3(1.15, 0.06, -0.1),
      ]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.035, 8),
        mat("#3c4450", { roughness: 0.6 }),
      );
      tube.castShadow = true;
      g.add(tube);
      box(0.22, 0.16, 0.16, "#5a6472", 1.25, 0.08, -0.1, g);
    },
  },
  {
    id: "forklift",
    name: "Forklift in the pedestrian aisle",
    why: "A parked forklift is sitting in the middle of the pedestrian route. Move it to a laydown bay and switch it off with the key removed.",
    slots: [4, 6, 11],
    build: (g) => {
      box(0.95, 0.55, 1.5, "#f0a63c", 0, 0.62, 0.1, g);
      box(0.8, 0.62, 0.55, "#8a6a3f", 0, 1.1, 0.45, g);
      box(0.12, 1.5, 0.12, "#5a4a2f", -0.42, 0.75, -0.75, g);
      box(0.12, 1.5, 0.12, "#5a4a2f", 0.42, 0.75, -0.75, g);
      box(0.9, 0.08, 0.7, "#5a4a2f", 0, 0.28, -1.05, g);
      for (const [x, z] of [[-0.45, 0.55], [0.45, 0.55], [-0.4, -0.5], [0.4, -0.5]]) {
        const w = cyl(0.24, 0.24, 0.16, "#3c4450", x, 0.24, z, g, 12);
        w.rotation.z = Math.PI / 2;
      }
    },
  },
  {
    id: "worker",
    name: "No helmet under the racks",
    why: "Someone is working under the racking without a hard hat. Under the racks is a hard-hat zone — objects can drop from the bays above.",
    slots: [2, 8],
    build: (g) => {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), mat("#e9c9a8", { roughness: 0.7 }));
      head.position.y = 1.52;
      head.castShadow = true;
      g.add(head);
      const body = cyl(0.16, 0.22, 0.75, "#4a7fb5", 0, 1.05, 0, g, 12);
      body.castShadow = true;
      box(0.5, 0.06, 0.24, "#35618c", 0, 1.18, 0, g);
      box(0.16, 0.7, 0.16, "#2f4d63", -0.1, 0.35, 0, g);
      box(0.16, 0.7, 0.16, "#2f4d63", 0.1, 0.35, 0, g);
    },
  },
  {
    id: "extinguisher",
    name: "Blocked fire extinguisher",
    why: "The extinguisher is covered with stock. In a fire you have seconds — an obstructed extinguisher wastes them. Clear the access space.",
    slots: [10],
    build: (g) => {
      cyl(0.11, 0.11, 0.62, "#c23b30", 0, 0.62, 0, g, 16);
      cyl(0.06, 0.06, 0.16, "#7a241d", 0, 1.0, 0, g, 12);
      box(0.05, 0.05, 0.22, "#3c4450", 0.1, 1.02, 0.08, g);
      carton(0.62, 0.42, 0.5, 0.05, 0, 0.42, g);
    },
  },
  {
    id: "rack",
    name: "Bent rack upright",
    why: "The rack upright is visibly bent — the frame is taking damage. Tag it, move the pallets off, and report it before anyone loads it again.",
    slots: [1, 3, 7, 9],
    build: (g) => {
      const lower = box(0.09, 1.1, 0.09, "#c23b30", 0, 0.55, 0, g);
      const upper = box(0.09, 1.0, 0.09, "#c23b30", 0.16, 1.5, 0, g);
      upper.rotation.z = -0.28;
      lower.material = upper.material;
      box(0.16, 0.22, 0.02, "#f2b532", 0.24, 1.35, 0.06, g); // damage tag
    },
  },
];

// Fixed scene spots: [x, z, yaw] — 0 faces the exit door, rack edges face the
// aisle, floor spots sit inside the walking lane.
const SLOTS = [
  [0, -8.1, 0],
  [-2.55, 2.0, Math.PI / 2],
  [-2.35, -2.0, Math.PI / 2],
  [2.55, 0.0, -Math.PI / 2],
  [-1.15, 4.0, 0.4],
  [0, 1.0, 0],
  [1.25, -3.0, -0.5],
  [-2.55, -5.0, Math.PI / 2],
  [2.35, -5.0, -Math.PI / 2],
  [2.55, 3.5, -Math.PI / 2],
  [2.75, 6.0, -Math.PI / 2],
  [-0.8, -6.0, 0.2],
];

function pickPlacement() {
  for (let attempt = 0; attempt < 24; attempt++) {
    const pool = [...HAZARDS].sort(() => Math.random() - 0.5);
    const chosen = [];
    const used = new Set();
    for (const hazard of pool) {
      const free = hazard.slots.filter((s) => !used.has(s));
      if (!free.length || chosen.length === 6) continue;
      const slot = free[Math.floor(Math.random() * free.length)];
      used.add(slot);
      chosen.push({ hazard, slot });
      if (chosen.length === 6) return chosen;
    }
  }
  // Deterministic fallback (never happens with these slot maps).
  return HAZARDS.slice(0, 6).map((hazard, i) => ({ hazard, slot: hazard.slots[i % hazard.slots.length] }));
}

// ---------------------------------------------------------------------------
export function mountHazardHunt3D(stage, aliveCheck = () => true) {
  const best = store.get(BEST_KEY, null);
  stage.innerHTML = `<div class="fun-panel">
    <header class="fun-panel-head"><div><h2>Spot the Hazard</h2><p>You have 60 seconds to walk the aisle in 3D and click every hazard you can spot. Each find is worth 100 marks; wrong clicks cost 10.</p></div><span class="badge gray">${icon("search", 12)} PRACTICE ONLY</span></header>
    <div class="fun-hh-stats">
      <span class="fun-hh-stat"><span>TIME</span><strong data-hh-time>${TOTAL}</strong></span>
      <span class="fun-hh-stat"><span>FOUND</span><strong data-hh-found>0 / 6</strong></span>
      <span class="fun-hh-stat"><span>SCORE</span><strong data-hh-score>0</strong></span>
      <span class="fun-hh-stat"><span>BEST</span><strong data-hh-best>${best !== null ? best : "—"}</strong></span>
      <button type="button" class="btn btn-secondary btn-small" data-hh-reset>${icon("refresh", 14)} New walk</button>
    </div>
    <div class="fun-hh-stage hh3d" data-hh-stage>
      <div class="hh3d-host" data-hh-host></div>
      <div class="hh3d-overlay" data-hh-overlay>
        <div class="hh3d-overlay-card">
          <strong>3D safety walk</strong>
          <p>Drag to look around · walk with <b>W A S D</b> / arrows or the pad · click a hazard to report it.</p>
          <button type="button" class="btn btn-primary" data-hh-start>${icon("play", 15)} Start the walk</button>
        </div>
      </div>
      <div class="hh3d-pad" data-hh-pad aria-label="Walk controls">
        <button type="button" data-pad="f" aria-label="Walk forward">▲</button>
        <div><button type="button" data-pad="l" aria-label="Turn left">◀</button><button type="button" data-pad="b" aria-label="Walk back">▼</button><button type="button" data-pad="r" aria-label="Turn right">▶</button></div>
      </div>
      <div class="hh3d-hint" data-hh-hint><span>${icon("eye", 12)} drag to look</span><span>W A S D / arrows to walk</span><span>click hazards to report</span></div>
      <div class="fun-hh-toast" data-hh-toast hidden></div>
    </div>
    <div class="fun-hh-result" data-hh-result hidden></div>
  </div>`;

  const host = stage.querySelector("[data-hh-host]");
  const stageEl = stage.querySelector("[data-hh-stage]");
  const overlay = stage.querySelector("[data-hh-overlay]");
  const toastEl = stage.querySelector("[data-hh-toast]");
  const timeEl = stage.querySelector("[data-hh-time]");
  const foundEl = stage.querySelector("[data-hh-found]");
  const scoreEl = stage.querySelector("[data-hh-score]");
  const resultEl = stage.querySelector("[data-hh-result]");

  // Renderer first: if WebGL is missing the constructor throws and the caller
  // falls back to the 2D walk.
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "3D warehouse aisle. Drag to look, walk with W A S D or the pad, click hazards to report them.");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dfe6e0");
  scene.fog = new THREE.Fog("#dfe6e0", 18, 34);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);

  // ---- environment ---------------------------------------------------------
  const world = new THREE.Group();
  scene.add(world);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 24), mat("#e7e2d2", { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1);
  floor.receiveShadow = true;
  world.add(floor);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 20), mat("#efe9d6", { roughness: 1 }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.005, -0.5);
  lane.receiveShadow = true;
  world.add(lane);
  for (const x of [-1.7, 1.7]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 20), mat("#e8b923", { roughness: 1 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.01, -0.5);
    world.add(line);
  }
  // Side racking with a little stock on it.
  const rackFrame = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0, -1);
    for (const z of [-8, -4, 0, 4, 8]) {
      box(0.12, 3.1, 0.12, "#8a7f66", 0, 1.55, z, g);
    }
    for (const y of [0.9, 1.9, 2.9]) {
      box(0.5, 0.08, 16.4, "#b3a486", 0, y, 0, g);
    }
    for (let i = 0; i < 9; i++) {
      const z = -7.4 + i * 1.85 + Math.random() * 0.4;
      carton(0.42 + Math.random() * 0.12, 0.34 + Math.random() * 0.14, 0.42, (x > 0 ? -0.02 : 0.02), 1.94, z, g, Math.random() > 0.5 ? "#cf9f63" : "#d8b07c");
      if (Math.random() > 0.4) carton(0.4, 0.3, 0.4, 0, 0.94, z + 0.3, g, "#c9a06a");
    }
    world.add(g);
  };
  rackFrame(-2.95);
  rackFrame(2.95);
  // End wall with the emergency exit door.
  const wall = box(9, 4.2, 0.2, "#f3efe3", 0, 2.1, -9.35, world);
  wall.receiveShadow = true;
  const door = box(1.5, 2.5, 0.1, "#4c6a49", 0, 1.25, -9.22, world);
  const exitSign = box(0.9, 0.3, 0.06, "#5f7d5a", 0, 2.85, -9.2, world);
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 256;
  signCanvas.height = 96;
  const sctx = signCanvas.getContext("2d");
  sctx.fillStyle = "#4c6a49";
  sctx.fillRect(0, 0, 256, 96);
  sctx.fillStyle = "#eef4e6";
  sctx.font = "bold 56px Arial";
  sctx.textAlign = "center";
  sctx.textBaseline = "middle";
  sctx.fillText("EXIT", 128, 52);
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  door.material = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 });
  exitSign.material = new THREE.MeshStandardMaterial({ color: "#9fd08c", roughness: 0.6 });
  // Start-side wall keeps the aisle enclosed behind the walker.
  box(9, 4.2, 0.2, "#f3efe3", 0, 2.1, 10.4, world);
  // Lights.
  scene.add(new THREE.HemisphereLight("#fff8ea", "#a9b39c", 1.25));
  const sun = new THREE.DirectionalLight("#fff3d8", 1.9);
  sun.position.set(-6, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  scene.add(sun);

  // ---- game state ----------------------------------------------------------
  const state = { hazards: [], found: new Set(), misses: 0, timeLeft: TOTAL, over: false, started: false, timer: null };
  const keys = new Set();
  const pad = new Set();
  let yaw = 0;
  let pitch = -0.05;
  const pos = new THREE.Vector3(0, 1.6, 8.4);
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let toastTimer = null;
  let raf = 0;
  let last = performance.now();
  let disposed = false;

  const score = () => Math.max(0, state.found.size * 100 - state.misses * 10);
  const toast = (text, kind) => {
    toastEl.textContent = text;
    toastEl.className = `fun-hh-toast ${kind}`;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 1700);
  };

  const clearHazards = () => {
    for (const entry of state.hazards) {
      world.remove(entry.group);
      entry.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    state.hazards = [];
  };

  const ring = (color, y) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 10, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    return mesh;
  };

  const start = () => {
    if (state.timer) clearInterval(state.timer);
    clearHazards();
    state.found = new Set();
    state.misses = 0;
    state.timeLeft = TOTAL;
    state.over = false;
    state.started = false;
    resultEl.hidden = true;
    overlay.hidden = false;
    pos.set(0, 1.6, 8.4);
    yaw = 0;
    pitch = -0.05;
    for (const { hazard, slot } of pickPlacement()) {
      const [x, z, ry] = SLOTS[slot];
      const group = new THREE.Group();
      hazard.build(group);
      group.position.set(x, 0, z);
      group.rotation.y = ry;
      group.userData.hazard = true;
      world.add(group);
      state.hazards.push({ ...hazard, group, slot, foundMark: null });
    }
    timeEl.textContent = TOTAL;
    foundEl.textContent = "0 / 6";
    scoreEl.textContent = "0";
  };

  const begin = () => {
    if (state.started || state.over) return;
    state.started = true;
    overlay.hidden = true;
    state.timer = setInterval(() => {
      if (state.over) return;
      state.timeLeft -= 1;
      timeEl.textContent = state.timeLeft;
      if (state.timeLeft <= 0) finish();
    }, 1000);
  };

  const finish = () => {
    state.over = true;
    if (state.timer) clearInterval(state.timer);
    const s = score();
    const prev = store.get(BEST_KEY, null);
    if (prev === null || s > prev) {
      store.set(BEST_KEY, s);
      stage.querySelector("[data-hh-best]").textContent = s;
    }
    state.hazards.forEach((h, i) => {
      const foundIt = state.found.has(i);
      if (!foundIt) h.group.add(ring("#c23b30", 0.06));
    });
    resultEl.innerHTML = `
      <div class="fun-hh-result-head">
        <div><span>${state.found.size}/6 hazards found</span><h3>${s} points</h3></div>
        <button type="button" class="btn btn-primary btn-small" data-hh-again>${icon("refresh", 14)} Walk it again</button>
      </div>
      <div class="fun-hh-brief">${state.hazards
        .map((h, i) => {
          const foundIt = state.found.has(i);
          return `<div class="fun-hh-brief-row ${foundIt ? "ok" : "no"}"><span class="fun-hh-brief-mark">${icon(foundIt ? "checkCircle" : "close", 15)}</span><div><strong>${h.name}</strong><p>${h.why}</p></div></div>`;
        })
        .join("")}</div>`;
    resultEl.hidden = false;
    resultEl.querySelector("[data-hh-again]").addEventListener("click", start);
  };

  const clickAt = (event) => {
    if (state.over || !state.started) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(state.hazards.map((h) => h.group), true);
    if (hits.length) {
      let node = hits[0].object;
      while (node && !node.userData.hazard) node = node.parent;
      const index = state.hazards.findIndex((h) => h.group === node);
      if (index >= 0 && !state.found.has(index)) {
        state.found.add(index);
        const entry = state.hazards[index];
        const mark = ring("#2e7d32", 0.06);
        entry.group.add(mark);
        entry.foundMark = mark;
        foundEl.textContent = `${state.found.size} / 6`;
        scoreEl.textContent = score();
        toast(`${entry.name} — found. +100`, "good");
        if (state.found.size === 6) finish();
        return;
      }
      if (index >= 0) return; // already reported
    }
    state.misses += 1;
    scoreEl.textContent = score();
    toast("Nothing there — keep walking. −10", "bad");
  };

  // ---- input ---------------------------------------------------------------
  let drag = null;
  let downAt = null;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  const onDown = (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    yaw -= (e.clientX - drag.x) * 0.0042;
    pitch = Math.max(-0.55, Math.min(0.6, pitch + (e.clientY - drag.y) * 0.0032));
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const onUp = (e) => {
    const wasClick =
      downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 7;
    drag = null;
    downAt = null;
    if (wasClick) clickAt(e);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", () => {
    drag = null;
    downAt = null;
  });

  const KEYMAP = { KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const onKeyDown = (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    keys.add(k);
  };
  const onKeyUp = (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const padButtons = stage.querySelectorAll("[data-pad]");
  const padDown = (e) => {
    e.preventDefault();
    pad.add(e.currentTarget.dataset.pad);
  };
  const padUp = (e) => pad.delete(e.currentTarget.dataset.pad);
  padButtons.forEach((b) => {
    b.addEventListener("pointerdown", padDown);
    b.addEventListener("pointerup", padUp);
    b.addEventListener("pointercancel", padUp);
    b.addEventListener("pointerleave", padUp);
  });

  stage.querySelector("[data-hh-start]").addEventListener("click", begin);
  stage.querySelector("[data-hh-reset]").addEventListener("click", start);

  // ---- loop ----------------------------------------------------------------
  const resize = () => {
    const w = stageEl.clientWidth || 640;
    const h = stageEl.clientHeight || 420;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stageEl);
  resize();

  const tick = (now) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state.started && !state.over) {
      const held = (k) => keys.has(k) || pad.has(k);
      const move = Number(held("f")) - Number(held("b"));
      const turn = Number(held("l")) - Number(held("r"));
      yaw += turn * dt * 1.7;
      if (move) {
        const speed = 2.7 * dt * move;
        pos.x -= Math.sin(yaw) * speed;
        pos.z -= Math.cos(yaw) * speed;
        pos.x = Math.max(-2.1, Math.min(2.1, pos.x));
        pos.z = Math.max(-8.4, Math.min(9.4, pos.z));
      }
    }
    camera.position.copy(pos);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
    // Gentle bob on found rings so they read as markers.
    const t = now / 1000;
    for (const h of state.hazards)
      if (h.foundMark) h.foundMark.position.y = 0.06 + Math.sin(t * 3) * 0.02;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  start();

  // Small debug/test handle (also handy in the console while playtesting).
  window.__hh3d = {
    state,
    camera,
    renderer,
    count: () => state.hazards.length,
    project(index) {
      const entry = state.hazards[index];
      if (!entry) return null;
      const v = new THREE.Vector3();
      entry.group.getWorldPosition(v);
      v.y += 0.6;
      v.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
      };
    },
  };

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    if (state.timer) clearInterval(state.timer);
    clearTimeout(toastTimer);
    ro.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    clearHazards();
    renderer.dispose();
    canvas.remove();
    if (window.__hh3d?.renderer === renderer) delete window.__hh3d;
  };
}
