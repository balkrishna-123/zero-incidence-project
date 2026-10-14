import * as THREE from "../vendor/three.module.js";

// Original, procedural 360-degree scene. No CDN, remote model or photo is needed.
export function createWarehouseScene(host, objects, onInspect, options) {
  let destroyed = false,
    visible = true,
    frame = 0,
    lastFrame = 0;
  const scene = new THREE.Scene();
  const bright = options.lighting || 1;
  scene.background = new THREE.Color(bright > 1 ? "#c7d4d8" : "#bdcbd0");
  scene.fog = new THREE.Fog(
    bright > 1 ? "#c7d4d8" : "#bdcbd0",
    bright > 1 ? 21 : 17,
    bright > 1 ? 42 : 36,
  );
  const camera = new THREE.PerspectiveCamera(67, 1, 0.1, 60);
  camera.position.set(
    options.spawn?.[0] ?? 0,
    options.spawn?.[1] ?? 1.85,
    options.spawn?.[2] ?? 0,
  );
  camera.rotation.order = "YXZ";
  let yaw = options.spawnYaw ?? 0.46,
    pitch = options.spawnPitch ?? -0.08,
    goal = null;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  // By default geometry changes only after a decision, so looking around
  // does not need new shadows. The tour lobby animates doors, so it opts in.
  renderer.shadowMap.autoUpdate = Boolean(options.dynamicShadows);
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    options.ariaLabel ||
      `Interactive 3D ${options.sceneName || "warehouse"}. Drag or use arrow keys to look around.` +
        (objects.length
          ? " Use the numbered scene checkpoints to inspect objects."
          : ""),
  );
  canvas.className = "warehouse-canvas";
  host.append(canvas);
  const pinsLayer = document.createElement("div");
  pinsLayer.className = "scene-pins";
  host.append(pinsLayer);
  const materials = new Set();
  const textures = new Set();
  const material = (color, options = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.84,
      ...options,
    });
    materials.add(m);
    return m;
  };
  const steel = material("#40566a", { metalness: 0.35 });
  const orange = material("#d57539");
  const wood = material("#b39169");
  const carton = material("#bd9365");
  const dark = material("#283640");
  const white = material("#e1e5df");
  const mint = material("#13a487");
  const yellow = material("#edbc45");
  function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(radius, height, mat, x, y, z, parent = scene, sides = 12) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, sides),
      mat,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function textSign(
    text,
    width,
    height,
    x,
    y,
    z,
    {
      bg = "#263e50",
      fg = "#f2f5ef",
      size = 45,
      rotate = 0,
      parent = scene,
    } = {},
  ) {
    const c = document.createElement("canvas");
    c.width = 768;
    c.height = Math.round((768 * height) / width);
    const ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${size}px Arial`;
    const lines = text.split("\n");
    lines.forEach((line, i) =>
      ctx.fillText(
        line,
        c.width / 2,
        c.height / 2 + (i - (lines.length - 1) / 2) * (size + 10),
        c.width - 42,
      ),
    );
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    materials.add(mat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    sign.position.set(x, y, z);
    sign.rotation.y = rotate;
    parent.add(sign);
    return sign;
  }
  function pallet(parent, x = 0, z = 0, scale = 1) {
    for (let i = 0; i < 5; i++)
      box(
        0.27 * scale,
        0.07,
        1.15 * scale,
        wood,
        x + (i - 2) * 0.3 * scale,
        0.2,
        z,
        parent,
      );
    for (let i = 0; i < 3; i++)
      box(
        1.5 * scale,
        0.13,
        0.14 * scale,
        wood,
        x,
        0.1,
        z + (i - 1) * 0.45 * scale,
        parent,
      );
  }
  function cargo(parent, x, y, z, scale = 1) {
    const g = new THREE.Group();
    parent.add(g);
    g.position.set(x, y, z);
    box(
      1.12 * scale,
      0.77 * scale,
      0.86 * scale,
      carton,
      0,
      0.385 * scale,
      0,
      g,
    );
    box(
      0.075 * scale,
      0.775 * scale,
      0.87 * scale,
      material("#785d40"),
      0,
      0.385 * scale,
      0,
      g,
    );
    textSign(
      "PARTS\nHANDLE WITH CARE",
      0.62 * scale,
      0.25 * scale,
      0,
      0.43 * scale,
      0.432 * scale,
      { parent: g, bg: "#e9e4d4", fg: "#4f514a", size: 70 },
    );
    return g;
  }
  function rail(parent, length, x, z, rotate = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotate;
    parent.add(g);
    for (const px of [-length / 2, 0, length / 2])
      cylinder(0.05, 1.1, yellow, px, 0.55, 0, g);
    box(length, 0.065, 0.065, yellow, 0, 0.9, 0, g);
    box(length, 0.05, 0.05, yellow, 0, 0.5, 0, g);
  }
  // Warehouse shell and a marked pedestrian route.
  const floor = box(24, 0.1, 24, material("#9faeaf"), 0, -0.08, 0);
  floor.castShadow = false;
  const grid = new THREE.GridHelper(24, 24, "#87999b", "#a6b3b4");
  grid.position.y = -0.022;
  scene.add(grid);
  const routeMat = material("#739b8b");
  box(2.3, 0.014, 20, routeMat, 1.05, -0.012, 0);
  box(0.055, 0.016, 20, yellow, -0.12, -0.01, 0);
  box(0.055, 0.016, 20, yellow, 2.22, -0.01, 0);
  for (let z = -9; z <= 9; z += 3) {
    const arrow = textSign("↑", 0.65, 0.65, 1.05, 0.007, z, {
      bg: "#739b8b",
      fg: "#e3e8d4",
      size: 420,
    });
    arrow.rotation.x = -Math.PI / 2;
  }
  const wallMat = material("#c4cdd0");
  box(24, 7.8, 0.18, wallMat, 0, 3.8, -11.7);
  box(24, 7.8, 0.18, wallMat, 0, 3.8, 11.7);
  box(0.18, 7.8, 24, wallMat, -11.7, 3.8, 0);
  box(0.18, 7.8, 24, wallMat, 11.7, 3.8, 0);
  box(24, 0.12, 24, material("#bcc5c7"), 0, 7.75, 0);
  for (let z = -10; z <= 10; z += 5) {
    for (const x of [-10.8, 10.8]) box(0.19, 7.7, 0.23, steel, x, 3.82, z);
    box(22, 0.23, 0.18, steel, 0, 6.9, z);
    box(
      3.5,
      0.055,
      0.52,
      material("#f3f4dc", { emissive: "#eee9ca", emissiveIntensity: 0.5 }),
      0,
      6.74,
      z,
    );
  }
  for (const x of [-5, 5]) {
    box(3.8, 4.3, 0.15, material("#849aa3"), x, 2.15, -11.48);
    for (let y = 0.22; y < 4.3; y += 0.23)
      box(3.75, 0.025, 0.1, material("#6c838d"), x, y, -11.35);
    textSign(
      x < 0
        ? options.leftBayLabel || "01  /  DISPATCH"
        : options.rightBayLabel || "02  /  RECEIVING",
      3.8,
      0.6,
      x,
      4.85,
      -11.35,
      { size: 76 },
    );
  }
  textSign("ZERO INCIDENT  /  SAFETY FIRST", 5.6, 0.55, 0, 6.1, -11.35, {
    bg: "#355b62",
    size: 54,
  });
  textSign("PEDESTRIAN ROUTE", 3, 0.42, 1, 2.9, 11.35, {
    rotate: Math.PI,
    bg: "#227b66",
    size: 64,
  });
  // Racking creates depth without blocking the five learning stations.
  function rack(x, z, rotate = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotate;
    scene.add(g);
    for (const px of [-1.8, 1.8])
      for (const pz of [-0.65, 0.65])
        box(0.09, 4.7, 0.09, steel, px, 2.35, pz, g);
    for (const y of [0.4, 2.1, 3.8]) {
      box(3.8, 0.14, 1.45, wood, 0, y, 0, g);
      for (const zz of [-0.73, 0.73]) box(3.8, 0.18, 0.08, orange, 0, y, zz, g);
      cargo(g, -1.07, y + 0.08, 0, 0.82);
      cargo(g, 0.12, y + 0.08, 0, 0.8);
      cargo(g, 1.2, y + 0.08, 0, 0.65);
    }
  }
  for (const x of [-9.8, 9.8])
    for (const z of [-6.7, -0.8, 6]) rack(x, z, Math.PI / 2);
  scene.add(new THREE.HemisphereLight("#f4f6f0", "#6e848b", 2.8 * bright));
  const sun = new THREE.DirectionalLight("#fff3d3", 3.1 * bright);
  sun.position.set(-7, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    near: 1,
    far: 35,
  });
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d9edff", 1.1 * bright);
  fill.position.set(6, 7, -6);
  scene.add(fill);
  if (bright > 1) {
    renderer.toneMappingExposure = 1.28 * bright;
  }

  const targets = new Map();
  const pickable = [];
  const pins = [];
  for (const [index, data] of objects.entries()) {
    const group = new THREE.Group();
    group.position.set(...data.position);
    group.userData.objectId = data.id;
    scene.add(group);
    pickable.push(group);
    const {
      setResolved = () => {},
      markerHeight = 1.9,
      focusHeight = markerHeight,
    } = options.buildTarget({
      data,
      group,
      THREE,
      scene,
      camera,
      pallet,
      cargo,
      textSign,
      box,
      cylinder,
      rail,
      material,
      steel,
      orange,
      wood,
      carton,
      dark,
      white,
      mint,
      yellow,
    });
    const base = data.noPin
      ? null
      : (() => {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.67, 0.72, 40),
            new THREE.MeshBasicMaterial({
              color: "#9bede0",
              transparent: true,
              opacity: 0.55,
              side: THREE.DoubleSide,
            }),
          );
          materials.add(ring.material);
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.015;
          group.add(ring);
          return ring;
        })();
    let button = null;
    if (!data.noPin) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "scene-pin";
      button.innerHTML = "<span></span><strong></strong>";
      button.firstElementChild.textContent = index + 1;
      button.lastElementChild.textContent = data.label;
      button.setAttribute(
        "aria-label",
        `Inspect checkpoint ${index + 1}: ${data.label}`,
      );
      button.dataset.sceneObject = data.id;
      button.addEventListener("click", () => onInspect(data.id));
      pinsLayer.append(button);
    }
    const anchor = new THREE.Vector3(
      data.position[0],
      markerHeight,
      data.position[2],
    );
    const focusPoint = anchor.clone();
    focusPoint.y = focusHeight;
    targets.set(data.id, {
      group,
      anchor,
      focusPoint,
      button,
      setResolved,
      base,
    });
    if (button) pins.push({ button, anchor });
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let dragging = null;
  function pointerDown(event) {
    if (event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY, distance: 0 };
    goal = null;
  }
  function pointerMove(event) {
    if (!dragging) return;
    const dx = event.clientX - dragging.x,
      dy = event.clientY - dragging.y;
    dragging.distance += Math.abs(dx) + Math.abs(dy);
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    yaw += dx * 0.004;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -0.9, 0.75);
  }
  function pointerUp(event) {
    if (!dragging) return;
    const moved = dragging.distance;
    dragging = null;
    if (moved > 7) return;
    const r = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, true)[0];
    let object = hit?.object;
    while (object && !object.userData.objectId) object = object.parent;
    if (object?.userData.objectId) onInspect(object.userData.objectId);
  }
  function keydown(e) {
    const actions = {
      ArrowLeft: () => (yaw += 0.14),
      ArrowRight: () => (yaw -= 0.14),
      ArrowUp: () => (pitch = Math.min(0.75, pitch + 0.08)),
      ArrowDown: () => (pitch = Math.max(-0.9, pitch - 0.08)),
    };
    if (actions[e.key]) {
      e.preventDefault();
      goal = null;
      actions[e.key]();
    }
  }
  if (options.noArrowLook) canvas.removeEventListener("keydown", keydown);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", () => (dragging = null));
  canvas.addEventListener("keydown", keydown);
  const resize = () => {
    if (destroyed || !host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const direction = new THREE.Vector3(),
    temp = new THREE.Vector3(),
    projected = new THREE.Vector3();
  function render(now) {
    if (destroyed || !visible) return;
    frame = requestAnimationFrame(render);
    if (now - lastFrame < 30) return;
    const smoothing =
      1 - Math.exp(-7.5 * Math.min((now - lastFrame) / 1000, 0.2));
    lastFrame = now;
    if (goal) {
      const diff = Math.atan2(
        Math.sin(goal.yaw - yaw),
        Math.cos(goal.yaw - yaw),
      );
      yaw += diff * smoothing;
      pitch += (goal.pitch - pitch) * smoothing;
      if (Math.abs(diff) < 0.001 && Math.abs(goal.pitch - pitch) < 0.001)
        goal = null;
    }
    camera.rotation.set(pitch, yaw, 0);
    camera.updateMatrixWorld();
    camera.getWorldDirection(direction);
    for (const pin of pins) {
      temp.copy(pin.anchor).sub(camera.position);
      projected.copy(pin.anchor).project(camera);
      const shown =
        temp.dot(direction) > 0 &&
        Math.abs(projected.x) < 1.04 &&
        Math.abs(projected.y) < 0.94;
      pin.button.hidden = !shown;
      if (shown) {
        pin.button.style.left = `${(projected.x * 0.5 + 0.5) * host.clientWidth}px`;
        pin.button.style.top = `${(-projected.y * 0.5 + 0.5) * host.clientHeight}px`;
      }
    }
    host.dataset.cameraSettled = goal ? "false" : "true";
    renderer.render(scene, camera);
    host.dataset.sceneReady = "true";
  }
  frame = requestAnimationFrame(render);
  return {
    focus(id) {
      const t = targets.get(id);
      if (!t) return;
      const d = t.focusPoint.clone().sub(camera.position);
      goal = {
        yaw: Math.atan2(-d.x, -d.z),
        pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)),
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        yaw = goal.yaw;
        pitch = goal.pitch;
        goal = null;
      }
    },
    rotate(delta) {
      goal = null;
      yaw += delta;
    },
    zoom(delta) {
      camera.fov = THREE.MathUtils.clamp(camera.fov + delta, 43, 83);
      camera.updateProjectionMatrix();
    },
    update(answers = [], active = objects.length ? objects[0].id : null) {
      renderer.shadowMap.needsUpdate = true;
      host.dataset.resolvedCount = answers.length;
      for (const [id, t] of targets) {
        const answer = answers.find((a) => a.objectId === id);
        t.setResolved(Boolean(answer));
        if (t.button) {
          t.button.dataset.resolved = answer ? "true" : "false";
          t.button.classList.toggle("is-active", id === active);
          t.button.classList.toggle("is-complete", Boolean(answer?.correct));
          t.button.classList.toggle(
            "is-reviewed",
            Boolean(answer && !answer.correct),
          );
        }
        if (t.base)
          t.base.material.color.set(
            answer
              ? "#27b39a"
              : id === active
                ? options.highlight || "#b6fff0"
                : "#bdced1",
          );
      }
    },
    setVisible(value) {
      if (destroyed || visible === value) return;
      visible = value;
      cancelAnimationFrame(frame);
      if (value) {
        resize();
        frame = requestAnimationFrame(render);
      }
    },
    dispose() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      pinsLayer.remove();
    },
  };
}
