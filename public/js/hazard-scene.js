import { createWarehouseScene } from "./warehouse-scene.js";

// Original, non-operational props. Controls illustrate restriction/reporting, not permission to work.
function buildHazardArea({
  data,
  group,
  THREE,
  box,
  cylinder,
  rail,
  material,
  pallet,
  cargo,
  textSign,
  steel,
  dark,
  white,
  wood,
  yellow,
}) {
  const red = material("#b94b42");
  const green = material("#2f9173");
  const grey = material("#a1b0b5");
  const orange = material("#dba644");
  const facing = Math.atan2(-data.position[0], -data.position[2]);
  let markerHeight = 2.0,
    focusHeight = 1.25,
    setResolved = () => {};
  const sign = (text, w, h, x, y, z, options = {}) =>
    textSign(text, w, h, x, y, z, {
      parent: group,
      bg: "#3a4c57",
      size: 64,
      ...options,
    });
  const restricted = (width, depth, message, options = {}) => {
    const g = new THREE.Group();
    group.add(g);
    g.visible = false;
    rail(g, width, 0, -depth / 2);
    rail(g, width, 0, depth / 2);
    rail(g, depth, -width / 2, 0, Math.PI / 2);
    rail(g, depth, width / 2, 0, Math.PI / 2);
    textSign(
      message,
      Math.min(width - 0.15, 2.6),
      0.4,
      0,
      0.72,
      depth / 2 + 0.045,
      { parent: g, bg: options.bg || "#9c3c3a", size: 53 },
    );
    return g;
  };
  const cone = (x, z, parent = group) => {
    box(0.38, 0.045, 0.38, dark, x, 0.025, z, parent);
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.58, 12), orange);
    mesh.position.set(x, 0.33, z);
    mesh.castShadow = true;
    parent.add(mesh);
    cylinder(0.1, 0.1, white, x, 0.37, z, parent);
  };
  if (data.kind === "floor") {
    group.rotation.y = facing;
    // Irregular contamination on the floor, not just an alert symbol.
    const shape = new THREE.Shape();
    const points = [
      [-1.25, -0.15],
      [-1, -0.68],
      [-0.4, -0.82],
      [0.12, -0.57],
      [0.6, -0.8],
      [1.24, -0.3],
      [0.93, 0.16],
      [1.2, 0.6],
      [0.45, 0.81],
      [-0.12, 0.53],
      [-0.81, 0.68],
      [-1.1, 0.26],
    ];
    shape.moveTo(...points[0]);
    points.slice(1).forEach((p) => shape.lineTo(...p));
    shape.closePath();
    const spill = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      material("#405355", {
        roughness: 0.18,
        metalness: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    spill.rotation.x = -Math.PI / 2;
    spill.position.y = 0.018;
    group.add(spill);
    const drum = cylinder(0.28, 0.63, grey, -1.55, 0.32, -0.85, group);
    drum.rotation.z = 0.28;
    const cordon = restricted(3.7, 2.65, "KEEP CLEAR / CLEANUP REQUESTED");
    cone(1.55, 1.12, cordon);
    setResolved = (done) => {
      cordon.visible = done;
    };
    markerHeight = 1.42;
    focusHeight = 0.65;
  } else if (data.kind === "vehicle") {
    group.rotation.y = facing;
    const truck = new THREE.Group();
    group.add(truck);
    truck.position.x = 0.5;
    box(1.25, 0.64, 1.85, orange, 0, 0.65, 0, truck);
    box(1.3, 0.5, 0.5, orange, 0, 0.65, -0.78, truck);
    for (const x of [-0.67, 0.67])
      for (const z of [-0.61, 0.6]) {
        const wheel = cylinder(0.28, 0.18, dark, x, 0.29, z, truck);
        wheel.rotation.z = Math.PI / 2;
        const hub = cylinder(0.105, 0.19, grey, x, 0.29, z, truck);
        hub.rotation.z = Math.PI / 2;
      }
    for (const x of [-0.52, 0.52])
      for (const z of [-0.57, 0.43])
        box(0.075, 1.37, 0.075, steel, x, 1.53, z, truck);
    box(1.32, 0.095, 1.2, steel, 0, 2.23, -0.04, truck);
    box(0.55, 0.46, 0.42, dark, 0, 1.12, -0.21, truck);
    box(0.56, 0.12, 0.57, dark, 0, 0.91, 0.06, truck);
    for (const x of [-0.47, 0.47])
      box(0.09, 2.12, 0.11, steel, x, 1.13, 1.05, truck);
    box(1.02, 0.12, 0.12, steel, 0, 2.16, 1.05, truck);
    box(1.08, 0.27, 0.1, grey, 0, 0.32, 1.15, truck);
    for (const x of [-0.39, 0.39])
      box(0.13, 0.07, 0.92, steel, x, 0.17, 1.53, truck);
    cylinder(0.065, 0.12, orange, 0.43, 2.33, -0.15, truck);
    // A pedestrian at an unseparated approach; no one rides the forks.
    const person = new THREE.Group();
    group.add(person);
    person.position.set(-1.25, 0, 1.1);
    person.rotation.y = 0.5;
    for (const x of [-0.13, 0.13]) {
      box(0.17, 0.64, 0.2, steel, x, 0.41, 0, person);
      box(0.2, 0.12, 0.31, dark, x, 0.11, 0.05, person);
    }
    box(0.44, 0.55, 0.26, yellow, 0, 1.0, 0, person);
    box(0.45, 0.07, 0.27, white, 0, 1.05, 0, person);
    cylinder(0.14, 0.25, material("#c8a179"), 0, 1.46, 0, person);
    for (const x of [-0.3, 0.3])
      box(0.14, 0.5, 0.15, yellow, x, 0.96, 0, person);
    const controls = new THREE.Group();
    group.add(controls);
    controls.visible = false;
    rail(controls, 3.8, 0, 2.25);
    rail(controls, 3.3, -1.95, 0.65, Math.PI / 2);
    textSign("CONTROLLED ACCESS ONLY", 2.5, 0.35, 0, 0.7, 2.29, {
      parent: controls,
      bg: "#875f25",
      size: 62,
    });
    setResolved = (done) => {
      controls.visible = done;
      person.position.x = done ? -2.45 : -1.25;
      person.position.z = done ? 2.55 : 1.1;
    };
    markerHeight = 2.8;
    focusHeight = 1.0;
  } else if (data.kind === "storage") {
    group.rotation.y = facing;
    for (const x of [-1.05, 1.05])
      for (const z of [-0.6, 0.6])
        box(0.085, 3.75, 0.085, steel, x, 1.88, z, group);
    for (const y of [0.38, 2.23]) {
      box(2.3, 0.14, 1.4, wood, 0, y, 0, group);
      box(2.35, 0.14, 0.075, orange, 0, y, 0.72, group);
    }
    cargo(group, -0.5, 0.46, 0, 0.67);
    cargo(group, 0.46, 0.46, 0, 0.67);
    const leaning = cargo(group, 0.55, 2.31, 0.38, 1.12);
    leaning.rotation.z = -0.21;
    const top = cargo(group, 0.77, 3.17, 0.48, 0.69);
    top.rotation.z = -0.23;
    const controls = restricted(3.2, 2.5, "KEEP CLEAR / TRAINED RESPONSE");
    setResolved = (done) => {
      controls.visible = done;
    };
    markerHeight = 4.25;
    focusHeight = 1.9;
  } else if (data.kind === "electrical") {
    group.rotation.y = facing;
    for (const x of [-0.85, 0.85])
      for (const z of [-0.43, 0.43])
        box(0.07, 0.9, 0.07, steel, x, 0.46, z, group);
    box(2.05, 0.13, 1.1, wood, 0, 0.95, 0, group);
    box(0.76, 0.46, 0.49, grey, 0, 1.23, 0, group);
    box(0.09, 0.18, 0.05, red, 0.23, 1.27, 0.26, group);
    sign("PORTABLE EQUIPMENT", 1.35, 0.2, 0, 0.67, 0.56, { size: 63 });
    const cableMat = material("#263238");
    function cable(points, mat = cableMat, r = 0.028) {
      const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
      );
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, r, 8, false),
        mat,
      );
      mesh.castShadow = true;
      group.add(mesh);
    }
    cable([
      [0.24, 1.11, 0.18],
      [0.9, 0.87, 0.2],
      [1.2, 0.08, 0.7],
      [0.6, 0.05, 1.18],
      [0.12, 0.045, 1.43],
    ]);
    cable([
      [-0.13, 0.045, 1.43],
      [-0.62, 0.045, 1.15],
      [-1.2, 0.045, 1.75],
      [-1.6, 0.045, 1.58],
    ]);
    const copper = material("#c6824f");
    for (let i = 0; i < 3; i++)
      cable(
        [
          [0.12, 0.06 + i * 0.018, 1.43],
          [-0.01, 0.08 + i * 0.015, 1.43 + i * 0.04],
          [-0.12, 0.06 + i * 0.018, 1.43],
        ],
        copper,
        0.009,
      );
    const tag = sign(
      "DO NOT USE / COMPETENT ATTENTION",
      2.1,
      0.26,
      0,
      1.71,
      0.26,
      { bg: "#a13d3b", size: 46 },
    );
    tag.visible = false;
    const controls = new THREE.Group();
    group.add(controls);
    controls.visible = false;
    rail(controls, 3.7, 0, 2.12);
    cone(-1.7, 1.96, controls);
    setResolved = (done) => {
      tag.visible = done;
      controls.visible = done;
    };
    markerHeight = 2.1;
    focusHeight = 0.9;
  } else if (data.kind === "exit") {
    group.rotation.y = facing;
    box(3.4, 3.05, 0.17, grey, 0, 1.525, -0.5, group);
    box(1.55, 2.32, 0.075, green, 0, 1.2, -0.38, group);
    for (const x of [-0.83, 0.83])
      box(0.075, 2.45, 0.1, white, x, 1.24, -0.31, group);
    box(1.74, 0.075, 0.1, white, 0, 2.49, -0.31, group);
    box(0.86, 0.055, 0.09, steel, 0, 1.11, -0.32, group);
    sign("EXIT →", 1.7, 0.36, 0, 2.78, -0.39, { bg: "#227c59", size: 112 });
    const packaging = new THREE.Group();
    group.add(packaging);
    cargo(packaging, -0.47, 0, 0.32, 0.85);
    cargo(packaging, 0.38, 0, 0.55, 0.8);
    cargo(packaging, -0.1, 0.66, 0.37, 0.68);
    box(1.9, 0.02, 0.42, material("#ddd9ce"), 0, 0.02, 1.02, packaging);
    const clear = sign("KEEP THIS ROUTE CLEAR", 2.45, 0.3, 0, 0.18, 1.03, {
      bg: "#227c59",
      size: 62,
    });
    clear.visible = false;
    setResolved = (done) => {
      packaging.visible = !done;
      clear.visible = done;
    };
    markerHeight = 3.28;
    focusHeight = 1.4;
  } else if (data.kind === "station") {
    group.rotation.y = facing;
    box(2.2, 2.6, 0.16, grey, 0, 1.3, -0.2, group);
    sign("SAFETY STATION", 2, 0.35, 0, 2.25, -0.105, {
      bg: "#2e755f",
      size: 76,
    });
    cylinder(0.17, 0.65, red, -0.49, 0.85, 0.02, group);
    cylinder(0.045, 0.18, steel, -0.49, 1.25, 0.02, group);
    box(0.27, 0.06, 0.13, dark, -0.43, 1.38, 0.02, group);
    box(0.64, 0.46, 0.13, green, 0.46, 1.25, -0.02, group);
    box(0.08, 0.28, 0.02, white, 0.46, 1.25, 0.055, group);
    box(0.31, 0.075, 0.02, white, 0.46, 1.25, 0.065, group);
    box(0.7, 0.05, 0.37, steel, -0.5, 0.46, -0.04, group);
    markerHeight = 2.85;
    focusHeight = 1.3;
  } else if (data.kind === "pallet") {
    group.rotation.y = facing;
    const bay = box(2.5, 0.012, 2.15, material("#90a591"), 0, 0.007, 0, group);
    bay.castShadow = false;
    for (const x of [-1.27, 1.27])
      box(0.045, 0.013, 2.18, yellow, x, 0.013, 0, group);
    for (const z of [-1.1, 1.1])
      box(2.58, 0.013, 0.045, yellow, 0, 0.013, z, group);
    pallet(group);
    cargo(group, -0.35, 0.24, 0, 0.62);
    cargo(group, 0.39, 0.24, 0, 0.62);
    sign("PALLET BAY", 1.55, 0.25, 0, 0.16, 0.99, { bg: "#526a5b", size: 83 });
    markerHeight = 1.75;
    focusHeight = 0.7;
  } else if (data.kind === "walkway") {
    group.rotation.y = facing;
    box(1.65, 0.012, 2.95, material("#759d8b"), 0, 0.008, 0, group);
    for (const x of [-0.88, 0.88]) {
      box(0.045, 0.014, 3.0, yellow, x, 0.014, 0, group);
      rail(group, 3.0, x, 0, Math.PI / 2);
    }
    const arrow = sign("PEDESTRIAN ROUTE  ↑", 1.52, 0.43, 0, 0.02, 0, {
      bg: "#759d8b",
      fg: "#eff5e8",
      size: 52,
    });
    arrow.rotation.x = -Math.PI / 2;
    markerHeight = 1.6;
    focusHeight = 0.55;
  }
  return { markerHeight, focusHeight, setResolved };
}
export function createHazardScene(host, objects, onInspect) {
  return createWarehouseScene(host, objects, onInspect, {
    buildTarget: buildHazardArea,
    sceneName: "warehouse safety walk",
    leftBayLabel: "05  /  WAREHOUSE WALK",
    rightBayLabel: "06  /  OPERATIONS",
    highlight: "#ffe3a5",
  });
}
