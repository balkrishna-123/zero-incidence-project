import { createWarehouseScene } from "./warehouse-scene.js";

// The original Manual Handling props are unchanged; the camera/warehouse is shared.
function buildManualTarget({
  data,
  group,
  THREE,
  pallet,
  cargo,
  textSign,
  box,
  material,
  mint,
  cylinder,
  dark,
  steel,
  yellow,
  white,
  wood,
}) {
  let setResolved = () => {};
  let markerHeight = 1.9;
  if (data.id === "load") {
    pallet(group);
    cargo(group, 0, 0.235, 0, 1.1);
    const checked = textSign("LOAD ASSESSED", 1.08, 0.22, 0, 1.22, 0.48, {
      bg: "#177f69",
      parent: group,
      size: 72,
    });
    checked.visible = false;
    setResolved = (done) => {
      checked.visible = done;
    };
  } else if (data.id === "route") {
    const obstruction = new THREE.Group();
    group.add(obstruction);
    cargo(obstruction, 0.1, 0, 0, 0.6);
    const wrap = box(
      1.6,
      0.024,
      0.35,
      material("#d9dadd", { transparent: true, opacity: 0.65 }),
      -0.25,
      0.018,
      0.65,
      obstruction,
    );
    wrap.rotation.y = -0.3;
    const sheet = box(
      0.5,
      0.017,
      0.45,
      material("#d1bf97"),
      0.55,
      0.022,
      -0.55,
      obstruction,
    );
    sheet.rotation.y = 0.5;
    setResolved = (done) => {
      obstruction.visible = !done;
    };
    markerHeight = 1.05;
  } else if (data.id === "aid") {
    group.rotation.y = -0.5;
    box(1.3, 0.16, 1.75, mint, 0, 0.28, 0, group);
    for (const x of [-0.52, 0.52])
      for (const z of [-0.66, 0.66]) {
        const wheel = cylinder(0.16, 0.14, dark, x, 0.16, z, group);
        wheel.rotation.z = Math.PI / 2;
      }
    for (const x of [-0.54, 0.54])
      cylinder(0.035, 1.15, steel, x, 0.85, 0.78, group);
    box(1.14, 0.055, 0.06, steel, 0, 1.42, 0.78, group);
    const carried = cargo(group, 0, 0.37, 0, 0.84);
    carried.visible = false;
    setResolved = (done) => {
      carried.visible = done;
    };
  } else if (data.id === "move") {
    const worker = new THREE.Group();
    group.add(worker);
    worker.rotation.y = -2;
    for (const x of [-0.13, 0.13]) {
      box(0.17, 0.62, 0.22, steel, x, 0.4, 0, worker);
      box(0.2, 0.12, 0.33, dark, x, 0.1, 0.055, worker);
    }
    box(0.48, 0.57, 0.26, yellow, 0, 1.0, 0, worker);
    box(0.485, 0.08, 0.275, white, 0, 0.98, 0, worker);
    const skin = material("#c7a17c");
    cylinder(0.14, 0.25, skin, 0, 1.46, 0, worker);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      yellow,
    );
    helmet.position.set(0, 1.56, 0);
    worker.add(helmet);
    for (const x of [-0.31, 0.31]) {
      box(0.13, 0.33, 0.15, yellow, x, 1.1, 0.08, worker);
      box(0.13, 0.13, 0.34, skin, x, 0.99, 0.24, worker);
    }
    cargo(worker, 0, 0.84, 0.39, 0.45);
    textSign("MOVE WITH CONTROL", 2.1, 0.35, 0, 2.0, -0.35, {
      parent: group,
      rotate: -2.35,
      bg: "#426476",
      size: 65,
    });
    setResolved = (done) => {
      worker.rotation.y = done ? -1.35 : -2;
    };
    markerHeight = 2.5;
  } else if (data.id === "destination") {
    box(2.3, 0.13, 1.22, wood, 0, 1.0, 0, group);
    for (const x of [-0.92, 0.92])
      for (const z of [-0.43, 0.43])
        box(0.08, 0.93, 0.08, steel, x, 0.46, z, group);
    const placed = cargo(group, 0, 1.08, 0, 0.82);
    placed.visible = false;
    textSign("PREPARED DESTINATION", 1.9, 0.27, 0, 0.75, -0.62, {
      parent: group,
      rotate: Math.PI,
      bg: "#355b62",
      size: 56,
    });
    setResolved = (done) => {
      placed.visible = done;
    };
    markerHeight = 2.0;
  }
  return { setResolved, markerHeight };
}
export function createManualScene(host, objects, onInspect) {
  return createWarehouseScene(host, objects, onInspect, {
    buildTarget: buildManualTarget,
    sceneName: "dispatch bay",
  });
}
