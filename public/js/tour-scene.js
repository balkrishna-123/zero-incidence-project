import * as THREE from "../vendor/three.module.js";
import { createWarehouseScene } from "./warehouse-scene.js";

// Training doors around the 360° warehouse. The three module doors sit on
// the back wall (z = -11.42, facing +z); the Fun Games door is separate, on
// the right wall (x = 11.42), rotated to face into the room. Each door
// carries its own centre (x, z) and inward rotation so the lobby loop can
// treat every door the same way.
export const TOUR_DOORS = [
  {
    key: "manual-handling",
    label: "Manual handling",
    sign: "MANUAL\nHANDLING",
    x: -2.1,
    z: -11.42,
    rot: 0,
    accent: "#21aa79",
    glass: "#b8d3da",
    muted: "#8fb8ab",
    guide: (name) =>
      `Hi ${name}! Manual Handling is through this door — grip, path and how close the load sits to your body. Walk through when you're ready.`,
  },
  {
    key: "working-at-height",
    label: "Working at height",
    sign: "WORKING AT\nHEIGHT",
    x: 0,
    z: -11.42,
    rot: 0,
    accent: "#508bec",
    glass: "#bcd0ec",
    muted: "#93a9c9",
    guide: (name) =>
      `This one is Working at Height, ${name}. Ladders, harnesses and fall protection — the small checks that keep you on the ground. Step inside whenever you like.`,
  },
  {
    key: "hazard-perception",
    label: "Hazard perception",
    sign: "HAZARD\nPERCEPTION",
    x: 2.1,
    z: -11.42,
    rot: 0,
    accent: "#daa01f",
    glass: "#e9d5a3",
    muted: "#c2a86e",
    guide: (name) =>
      `Last stop: Hazard Perception, ${name}. Trained eyes spot risks before they turn into incidents. Walk through the amber door and show me what you see.`,
  },
  {
    key: "fun-games",
    label: "Fun games",
    sign: "FUN\nGAMES",
    x: 11.42,
    z: 9.9,
    rot: -Math.PI / 2,
    accent: "#c2418f",
    glass: "#eec3dd",
    muted: "#c392b0",
    guide: (name) =>
      `And this one, ${name}, is the Fun Games door — a forklift challenge, a lightning quiz from all three modules, a hazard spotter round, and a PPE load-out. It's practice only, nothing here counts toward certification. Come have a go.`,
  },
];
const WALK = { minX: -10.9, maxX: 10.9, minZ: -10.62, maxZ: 10.9, radius: 0.38 };
const WALK_SPEED = 2.4; // metres per second

// Obstacles the employee cannot walk through (racks, forklift, trainers).
const OBSTACLES = [
  // Racking (rotated 90°, so the footprint is 1.45 wide × 3.8 deep)
  ...[-9.8, 9.8].flatMap((x) =>
    [-6.7, -0.8, 6].map((z) => ({
      minX: x - 1.05,
      maxX: x + 1.05,
      minZ: z - 2.15,
      maxZ: z + 2.15,
    })),
  ),
  // Forklift and its pallet load
  { minX: 5.6, maxX: 8.4, minZ: -4.6, maxZ: -2.9 },
];

function buildDoor(tk, data) {
  const { group, box, textSign, material, steel, dark, THREE: T } = tk;
  // Doors on side walls are rotated so their local +z faces into the room.
  group.rotation.y = data.rot || 0;
  const accent = material(data.accent, {
    emissive: data.accent,
    emissiveIntensity: 0.22,
  });
  const wood = material("#8a5a33", { roughness: 0.8 });
  const woodDark = material("#6e4526", { roughness: 0.8 });
  const glass = material(data.glass, {
    transparent: true,
    opacity: 0.45,
    roughness: 0.2,
    metalness: 0.05,
    side: T.DoubleSide,
  });
  const muted = material(data.muted);
  // Frame
  box(0.2, 2.5, 0.24, steel, -1.1, 1.25, -0.08, group);
  box(0.2, 2.5, 0.24, steel, 1.1, 1.25, -0.08, group);
  box(2.4, 0.22, 0.24, steel, 0, 2.6, -0.08, group);
  box(2.0, 0.06, 0.06, accent, 0, 2.62, -0.02, group);
  box(2.0, 0.07, 0.02, accent, 0, 2.8, -0.04, group);
  // Module name above the door
  textSign(data.sign, 2.0, 0.56, 0, 3.14, -0.05, { parent: group, size: 64 });
  // Two wooden panels (window, push bar, kick plate) hinged on the outer edges
  function panel(side) {
    const hinge = new T.Group();
    hinge.position.set(1.0 * side, 0, -0.08);
    hinge.rotation.y = -0.12 * side; // slightly ajar at rest
    group.add(hinge);
    box(0.9, 2.32, 0.07, wood, -0.45 * side, 1.18, 0, hinge);
    // Vertical window
    box(0.3, 0.85, 0.08, glass, -0.45 * side, 1.72, 0, hinge);
    box(0.38, 0.06, 0.08, woodDark, -0.45 * side, 2.19, 0, hinge);
    box(0.38, 0.06, 0.08, woodDark, -0.45 * side, 1.25, 0, hinge);
    // Push bar
    box(0.78, 0.08, 0.1, dark, -0.45 * side, 1.05, 0.03, hinge);
    // Kick plate
    box(0.9, 0.4, 0.08, steel, -0.45 * side, 0.2, 0, hinge);
    return hinge;
  }
  const hingeL = panel(-1);
  const hingeR = panel(1);
  // Entry mat
  box(2.3, 0.02, 0.9, muted, 0, 0.01, 0.78, group);
  // Invisible click catcher spanning the whole opening
  const catcher = new T.Mesh(
    new T.PlaneGeometry(2.0, 2.45),
    material("#ffffff", {
      transparent: true,
      opacity: 0,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  catcher.position.set(0, 1.25, -0.05);
  group.add(catcher);
  return {
    markerHeight: 2.4,
    focusHeight: 1.5,
    hinges: { left: hingeL, right: hingeR },
  };
}

function buildForklift(tk) {
  const { scene, box, cylinder, material, THREE: T } = tk;
  const g = new T.Group();
  g.position.set(7.0, 0, -3.75);
  g.rotation.y = Math.PI / 2 + 0.35;
  scene.add(g);
  const body = material("#e8b32c", { roughness: 0.55 });
  const cage = material("#3a4a55");
  // Counterweight + body
  box(0.95, 0.75, 1.5, body, 0.28, 0.5, 0, g);
  box(1.15, 0.42, 1.3, body, -0.45, 0.42, 0, g);
  // Roll cage
  for (const zz of [-0.5, 0.5]) {
    box(0.07, 0.95, 0.07, cage, -0.45, 1.1, zz, g);
    box(0.07, 0.95, 0.07, cage, -0.95, 1.1, zz, g);
  }
  box(0.58, 0.07, 1.1, cage, -0.7, 1.58, 0, g);
  // Mast + forks
  box(0.1, 1.9, 0.12, cage, -1.15, 0.95, -0.42, g);
  box(0.1, 1.9, 0.12, cage, -1.15, 0.95, 0.42, g);
  box(0.14, 0.1, 1.0, cage, -1.05, 1.86, 0, g);
  box(1.15, 0.06, 0.09, cage, -1.7, 0.28, -0.42, g);
  box(1.15, 0.06, 0.09, cage, -1.7, 0.28, 0.42, g);
  box(0.08, 0.5, 0.9, cage, -2.25, 0.53, 0, g);
  // Wheels
  for (const [wx, wz] of [
    [0.6, -0.75],
    [0.6, 0.75],
    [-0.7, -0.75],
    [-0.7, 0.75],
  ]) {
    const wheel = cylinder(0.3, 0.18, material("#20262b"), wx, 0.3, wz, g, 14);
    wheel.rotation.x = Math.PI / 2;
  }
  // Pallet of boxes on the forks
  box(1.05, 0.14, 1.1, material("#b39169"), -1.62, 0.37, 0, g);
  box(0.9, 0.5, 0.9, material("#bd9365"), -1.62, 0.7, 0, g);
  box(0.7, 0.4, 0.75, material("#a97f52"), -1.6, 1.1, 0.05, g);
}

function buildTrainer(tk, door, firstName) {
  const { scene: parent, box, cylinder, material, dark, THREE: T } = tk;
  // Stand beside the door's entry mat: 3.12 m in front of the door plane
  // (along its inward axis) and 1.15 m to the side, for any wall the door
  // is mounted on.
  const rot = door.rot || 0;
  const inwardX = Math.sin(rot);
  const inwardZ = Math.cos(rot);
  const alongX = Math.cos(rot);
  const alongZ = -Math.sin(rot);
  const standX = door.x + inwardX * 3.12 + alongX * 1.15;
  const standZ = door.z + inwardZ * 3.12 + alongZ * 1.15;
  const g = new T.Group();
  g.position.set(standX, 0, standZ);
  g.rotation.y = Math.atan2(0 - standX, 0 - standZ);
  parent.add(g);
  const hiVis = material("#e8842c");
  const strap = material("#f5f7f0", {
    emissive: "#e9efdf",
    emissiveIntensity: 0.4,
  });
  const skin = material("#c9906b");
  const helmet = material("#f2f4ee", { roughness: 0.4 });
  const accent = material(door.accent, {
    emissive: door.accent,
    emissiveIntensity: 0.3,
  });
  const glove = material("#edbc45");
  box(0.2, 0.72, 0.24, dark, -0.14, 0.44, 0, g);
  box(0.2, 0.72, 0.24, dark, 0.14, 0.44, 0, g);
  box(0.22, 0.1, 0.32, material("#1c262e"), -0.14, 0.05, 0.03, g);
  box(0.22, 0.1, 0.32, material("#1c262e"), 0.14, 0.05, 0.03, g);
  box(0.6, 0.62, 0.32, hiVis, 0, 1.12, 0, g);
  box(0.61, 0.09, 0.33, strap, 0, 1.24, 0, g);
  box(0.61, 0.09, 0.33, strap, 0, 0.98, 0, g);
  box(0.14, 0.5, 0.16, hiVis, -0.38, 1.1, 0, g);
  box(0.13, 0.1, 0.14, glove, -0.38, 0.78, 0, g);
  const armR = new T.Group();
  armR.position.set(0.38, 1.32, 0);
  g.add(armR);
  box(0.14, 0.5, 0.16, hiVis, 0, -0.25, 0, armR);
  box(0.13, 0.1, 0.14, glove, 0, -0.53, 0, armR);
  armR.rotation.z = -0.12;
  const head = new T.Mesh(new T.SphereGeometry(0.17, 18, 14), skin);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  g.add(head);
  const eye = material("#1f2a33");
  box(0.032, 0.05, 0.02, eye, -0.06, 1.64, 0.155, g);
  box(0.032, 0.05, 0.02, eye, 0.06, 1.64, 0.155, g);
  const dome = new T.Mesh(
    new T.SphereGeometry(0.195, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    helmet,
  );
  dome.position.set(0, 1.66, 0);
  dome.castShadow = true;
  g.add(dome);
  cylinder(0.225, 0.035, helmet, 0, 1.655, 0.012, g, 20);
  box(0.12, 0.055, 0.02, accent, 0, 1.73, 0.185, g);
  return { group: g, arm: armR, phase: Math.random() * 6.28 };
}

// First-person presence: a pair of arms at the bottom of the view,
// horror-game style, so the employee feels like a body in the space.
function buildHands(tk) {
  const { scene, camera, box, material, THREE: T } = tk;
  scene.add(camera);
  const sleeve = material("#283640");
  const glove = material("#edbc45");
  const hands = new T.Group();
  for (const side of [-1, 1]) {
    const a = new T.Group();
    a.position.set(0.42 * side, -0.45, -0.4);
    a.rotation.y = -0.45 * side;
    a.rotation.x = 0.28;
    box(0.15, 0.15, 0.42, sleeve, 0, 0, -0.2, a);
    box(0.13, 0.13, 0.4, sleeve, 0, -0.04, -0.58, a);
    box(0.14, 0.1, 0.18, glove, 0, -0.08, -0.8, a);
    hands.add(a);
  }
  hands.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });
  camera.add(hands);
  return hands;
}

export function createTourScene(host, opts = {}) {
  const {
    onEnterDoor,
    onDoorFocus,
    onEnterStart,
    onNearDoor,
    trainerName = "Your guide",
    firstName = "there",
  } = opts;
  let destroyed = false;
  let entering = false;
  let movementEnabled = false;
  let started = false;
  let greeting = 0; // timestamp until which the centre trainer waves
  let currentDoor = null;
  let nearDoor = null;
  let entryStep = null;
  let lastYaw = 0;
  let lastTick = 0;

  const objects = TOUR_DOORS.map((d) => ({
    id: `door-${d.key}`,
    label: d.label,
    position: [d.x, 0, d.z],
    noPin: true,
  }));

  let tk = null;
  const hinges = {};
  const sceneCtrl = createWarehouseScene(host, objects, (id) => {
    const door = TOUR_DOORS.find((d) => `door-${d.key}` === id);
    if (door && !entering && started) startEntry(door);
  }, {
    sceneName: "training lobby",
    lighting: 1.15,
    dynamicShadows: true,
    noArrowLook: true,
    spawn: [0, 1.85, 5.2],
    spawnYaw: 0.16,
    spawnPitch: -0.03,
    ariaLabel:
      "Interactive 3D training lobby. Press W A S D or the arrow keys to walk, drag to look around. Walk up to a door to open it and step inside its training module.",
    buildTarget: (toolkit) => {
      tk = toolkit;
      const door = TOUR_DOORS.find((d) => `door-${d.key}` === toolkit.data.id);
      const res = buildDoor(toolkit, door);
      hinges[door.key] = res.hinges;
      return res;
    },
  });
  const { THREE: T } = tk;
  buildForklift(tk);
  const trainers = TOUR_DOORS.map((d) => buildTrainer(tk, d, firstName));
  const hands = buildHands(tk);

  // Speech bubble (single, re-anchored to the trainer the employee faces)
  const pinsLayer = host.querySelector(".scene-pins");
  const bubble = document.createElement("div");
  bubble.className = "scene-bubble";
  bubble.hidden = true;
  bubble.innerHTML =
    '<span class="scene-bubble-name"></span><p class="scene-bubble-text"></p>';
  pinsLayer.append(bubble);
  const bubbleName = bubble.querySelector(".scene-bubble-name");
  const bubbleText = bubble.querySelector(".scene-bubble-text");
  bubbleName.textContent = `${trainerName.toUpperCase()} · GUIDE`;

  // Door-entry fade overlay
  const fade = document.createElement("div");
  fade.className = "tour-enter-fade";
  fade.hidden = true;
  host.append(fade);

  const camera = tk.camera;
  const viewDir = new T.Vector3();
  const toDoor = new T.Vector3();
  const toBubble = new T.Vector3();
  const anchor = new T.Vector3();
  const camPos = new T.Vector3();

  const wrapPi = (a) => {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  };

  // ---- Walking -------------------------------------------------------
  const keys = new Set();
  const KEYMAP = {
    w: "f",
    arrowup: "f",
    s: "b",
    arrowdown: "b",
    a: "l",
    arrowleft: "l",
    d: "r",
    arrowright: "r",
  };
  const keydown = (e) => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (!m || !started) return;
    e.preventDefault();
    keys.add(m);
  };
  const keyup = (e) => keys.delete(KEYMAP[e.key.toLowerCase()]);
  const blur = () => keys.clear();
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", blur);
  const touch = { f: false, b: false, l: false, r: false };

  function collide(pos) {
    for (const o of OBSTACLES) {
      const cx = Math.max(o.minX, Math.min(pos.x, o.maxX));
      const cz = Math.max(o.minZ, Math.min(pos.z, o.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= WALK.radius * WALK.radius) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * WALK.radius;
        pos.z = cz + (dz / d) * WALK.radius;
      } else {
        // Centre is inside the box — push out along the shallowest axis
        const left = pos.x - o.minX, right = o.maxX - pos.x;
        const back = pos.z - o.minZ, front = o.maxZ - pos.z;
        const m = Math.min(left, right, back, front);
        if (m === left) pos.x = o.minX - WALK.radius;
        else if (m === right) pos.x = o.maxX + WALK.radius;
        else if (m === back) pos.z = o.minZ - WALK.radius;
        else pos.z = o.maxZ + WALK.radius;
      }
    }
    pos.x = T.MathUtils.clamp(pos.x, WALK.minX, WALK.maxX);
    pos.z = T.MathUtils.clamp(pos.z, WALK.minZ, WALK.maxZ);
  }

  // ---- Door entry ----------------------------------------------------
  function startEntry(door) {
    if (entering || destroyed) return;
    entering = true;
    bubble.hidden = true;
    fade.hidden = false;
    requestAnimationFrame(() => fade.classList.add("is-on"));
    onEnterStart?.();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const from = camera.position.clone();
    // Step to just inside the doorway: the door centre shifted 1.75 m along
    // its inward axis, whatever wall the door is on.
    const rot = door.rot || 0;
    const to = new T.Vector3(
      door.x + Math.sin(rot) * 1.75,
      1.55,
      door.z + Math.cos(rot) * 1.75,
    );
    const dist = from.distanceTo(to);
    const start = performance.now();
    const dur = reduced ? 450 : T.MathUtils.clamp(dist * 240, 700, 2600);
    sceneCtrl.focus(`door-${door.key}`);
    let renderPaused = false;
    entryStep = (now) => {
      const k = reduced ? 1 : Math.min(1, (now - start) / dur);
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(from, to, e);
      // Once the fade is opaque, stop rendering so the module page loads fast
      if (!renderPaused && k >= 0.55) {
        renderPaused = true;
        sceneCtrl.setVisible(false);
      }
      if (k >= 1) {
        entryStep = null;
        onEnterDoor?.(door.key);
      }
    };
  }

  // ---- Per-frame loop ------------------------------------------------
  let raf = 0;
  function tick(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(tick);
    const t = now / 1000;
    const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (entryStep) entryStep(now);

    // Walking (only after the employee started, and not mid-entry)
    if (movementEnabled && !entering) {
      let ix = 0;
      let iz = 0;
      if (keys.has("f") || touch.f) iz += 1;
      if (keys.has("b") || touch.b) iz -= 1;
      if (keys.has("r") || touch.r) ix += 1;
      if (keys.has("l") || touch.l) ix -= 1;
      if (ix || iz) {
        const yaw = camera.rotation.y;
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        let mx = fx * iz + rx * ix;
        let mz = fz * iz + rz * ix;
        const len = Math.hypot(mx, mz);
        mx = (mx / len) * WALK_SPEED * dt;
        mz = (mz / len) * WALK_SPEED * dt;
        camera.position.x += mx;
        camera.position.z += mz;
        collide(camera.position);
      }
    }

    camera.getWorldPosition(camPos);
    camera.updateMatrixWorld();
    camera.getWorldDirection(viewDir);

    // Which door is the employee looking at?
    let best = null;
    let bestScore = 0.55;
    for (const d of TOUR_DOORS) {
      toDoor.set(d.x, 1.35, d.z).sub(camPos);
      toDoor.normalize();
      const score = toDoor.dot(viewDir);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    if ((best?.key ?? null) !== currentDoor) {
      currentDoor = best?.key ?? null;
      if (currentDoor) {
        const door = TOUR_DOORS.find((d) => d.key === currentDoor);
        bubbleText.textContent = door.guide(firstName);
      }
      onDoorFocus?.(currentDoor);
    }

    // Which door is the employee standing near?
    let close = null;
    let closeDist = 2.4;
    for (const d of TOUR_DOORS) {
      const dist = Math.hypot(camPos.x - d.x, camPos.z - d.z);
      if (dist < closeDist) {
        closeDist = dist;
        close = d;
      }
    }
    if ((close?.key ?? null) !== (nearDoor?.key ?? null)) {
      nearDoor = close;
      onNearDoor?.(nearDoor);
    }
    // Stepping through an open door starts the module
    if (close && !entering && started && closeDist < 1.05) startEntry(close);

    // Door swing: open as the employee approaches
    for (const d of TOUR_DOORS) {
      const dist = Math.hypot(camPos.x - d.x, camPos.z - d.z);
      const want = dist < 1.9 ? 1 : 0;
      const h = hinges[d.key];
      if (!h) continue;
      const targetL = want ? 1.62 : -0.12;
      h.left.rotation.y += (targetL - h.left.rotation.y) * Math.min(1, dt * 6);
      const targetR = want ? -1.62 : 0.12;
      h.right.rotation.y += (targetR - h.right.rotation.y) * Math.min(1, dt * 6);
    }

    // Trainer idle: bob; wave while greeting or when the employee faces them
    trainers.forEach((tr, i) => {
      const active =
        started && !entering && (t * 1000 < greeting || TOUR_DOORS[i].key === currentDoor);
      tr.group.position.y = 0.02 * Math.sin(t * 1.6 + tr.phase);
      const target = active ? 1.9 + 0.18 * Math.sin(t * 2.6 + tr.phase) : -0.12;
      tr.arm.rotation.z += (target - tr.arm.rotation.z) * 0.12;
    });

    // First-person arms: gentle sway plus a lag against the camera turn
    const yawDelta = wrapPi(camera.rotation.y - lastYaw);
    lastYaw = camera.rotation.y;
    hands.rotation.z =
      T.MathUtils.clamp(-yawDelta * 1.6, -0.1, 0.1) +
      0.02 * Math.sin(t * 0.8);
    hands.position.y = 0.012 * Math.sin(t * 1.4);

    // Speech bubble follows the focused trainer's head
    if (started && currentDoor && !entering) {
      const doorIndex = TOUR_DOORS.findIndex((d) => d.key === currentDoor);
      anchor.copy(trainers[doorIndex].group.position);
      anchor.y += 2.12;
      toBubble.copy(anchor).sub(camPos);
      const inFront = toBubble.dot(viewDir) > 0;
      anchor.project(camera);
      const onScreen =
        Math.abs(anchor.x) < 1.02 && Math.abs(anchor.y) < 0.92;
      bubble.hidden = !(inFront && onScreen);
      if (!bubble.hidden) {
        bubble.style.left = `${(anchor.x * 0.5 + 0.5) * host.clientWidth}px`;
        bubble.style.top = `${(-anchor.y * 0.5 + 0.5) * host.clientHeight}px`;
      }
    } else {
      bubble.hidden = true;
    }

    host.dataset.playerX = camera.position.x.toFixed(1);
    host.dataset.playerZ = camera.position.z.toFixed(1);
    host.dataset.playerYaw = camera.rotation.y.toFixed(2);
    host.dataset.playerPitch = camera.rotation.x.toFixed(2);
  }
  raf = requestAnimationFrame(tick);

  return {
    focus(id) {
      sceneCtrl.focus(id);
    },
    rotate(delta) {
      sceneCtrl.rotate(delta);
    },
    zoom(delta) {
      sceneCtrl.zoom(delta);
    },
    setStarted(value) {
      started = Boolean(value);
      if (!started) keys.clear();
    },
    setMovement(value) {
      movementEnabled = Boolean(value);
      if (!movementEnabled) keys.clear();
    },
    greet(ms = 6000) {
      greeting = performance.now() + ms;
    },
    enterDoor(key) {
      const door = TOUR_DOORS.find((d) => d.key === key);
      if (door && started) startEntry(door);
    },
    setTouch(dir, down) {
      if (dir in touch) touch[dir] = Boolean(down);
    },
    setVisible(value) {
      sceneCtrl.setVisible(value);
    },
    dispose() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      fade.remove();
      sceneCtrl.dispose();
    },
  };
}
