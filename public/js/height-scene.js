import { createWarehouseScene } from "./warehouse-scene.js";

// Original low-poly props. The learner observes from ground level: no climbing controls.
function buildHeightTarget({
  data,
  group,
  THREE,
  box,
  cylinder,
  rail,
  material,
  textSign,
  steel,
  dark,
  white,
  wood,
  yellow,
}) {
  const blue = material("#4c80bd");
  const silver = material("#a7bbc6", { metalness: 0.45 });
  const red = material("#b74440");
  let markerHeight = 2.15,
    setResolved = () => {};
  group.rotation.y = Math.atan2(-data.position[0], -data.position[2]);
  const sign = (text, w, h, x, y, z, style = {}) =>
    textSign(text, w, h, x, y, z, {
      parent: group,
      bg: "#334f6c",
      size: 72,
      ...style,
    });
  const post = (x, z, height = 1.2, parent = group) =>
    cylinder(0.045, height, yellow, x, height / 2, z, parent);

  if (data.id === "ground-tool") {
    // A non-electrical sign-cleaning task that can be considered from ground level.
    box(2.1, 0.16, 1.25, blue, 0, 0.14, 0, group);
    for (const x of [-0.85, 0.85])
      cylinder(0.055, 3.2, steel, x, 1.68, -0.38, group);
    box(2.2, 0.8, 0.09, white, 0, 3.0, -0.38, group);
    sign("AISLE B  /  STORES", 2.12, 0.65, 0, 3.0, -0.325, {
      bg: "#e4ebdf",
      fg: "#36586b",
      size: 75,
    });
    const tool = new THREE.Group();
    group.add(tool);
    tool.position.set(0.05, 0.17, 0.3);
    tool.rotation.z = -0.08;
    cylinder(0.035, 2.65, silver, 0, 1.4, 0, tool);
    cylinder(0.047, 0.55, blue, 0, 0.45, 0, tool);
    cylinder(0.046, 0.1, dark, 0, 1.55, 0, tool);
    box(0.65, 0.13, 0.18, blue, 0, 2.79, 0, tool);
    for (let i = 0; i < 10; i++)
      box(0.04, 0.12, 0.18, white, -0.28 + i * 0.062, 2.91, 0, tool);
    const parked = sign(
      "ASSESS A GROUND-LEVEL METHOD",
      2.15,
      0.42,
      0,
      0.62,
      0.55,
      { size: 55 },
    );
    const reviewed = sign(
      "GROUND-LEVEL OPTION REVIEWED",
      2.15,
      0.42,
      0,
      0.62,
      0.552,
      { bg: "#236d79", size: 52 },
    );
    reviewed.visible = false;
    setResolved = (done) => {
      parked.visible = !done;
      reviewed.visible = done;
    };
    markerHeight = 3.75;
  } else if (data.id === "ladder") {
    // The damaged rung stays damaged after the response. A tag controls its use.
    const ladder = new THREE.Group();
    group.add(ladder);
    ladder.rotation.x = -0.12;
    for (const x of [-0.44, 0.44]) {
      box(0.095, 3.3, 0.11, silver, x, 1.65, 0, ladder);
      box(0.15, 0.17, 0.2, dark, x, 0.085, 0.025, ladder);
    }
    for (let i = 0; i < 10; i++) {
      const y = 0.28 + i * 0.285;
      if (i === 4) {
        box(0.3, 0.07, 0.1, red, -0.24, y, 0, ladder);
        const broken = box(0.25, 0.07, 0.1, red, 0.27, y - 0.04, 0, ladder);
        broken.rotation.z = -0.24;
      } else box(0.81, 0.065, 0.095, silver, 0, y, 0, ladder);
    }
    box(1.5, 0.1, 0.8, steel, 0, 0.045, -0.25, group);
    sign("ACCESS EQUIPMENT CHECK", 1.7, 0.33, 0, 0.42, 0.35, { size: 55 });
    const tag = new THREE.Group();
    group.add(tag);
    tag.visible = false;
    box(0.82, 0.52, 0.05, red, 0.38, 2.05, 0.22, tag);
    textSign("DO NOT USE\nREPORT THE DEFECT", 0.77, 0.47, 0.38, 2.05, 0.251, {
      parent: tag,
      bg: "#aa3536",
      size: 72,
    });
    const cord = cylinder(0.01, 0.32, white, 0.38, 2.43, 0.2, tag);
    cord.rotation.z = 0.2;
    const restriction = new THREE.Group();
    group.add(restriction);
    restriction.visible = false;
    for (const x of [-0.88, 0.88]) post(x, 0.86, 0.76, restriction);
    box(1.76, 0.12, 0.04, red, 0, 0.68, 0.86, restriction);
    setResolved = (done) => {
      tag.visible = done;
      restriction.visible = done;
    };
    markerHeight = 3.55;
  } else if (data.id === "platform") {
    const deckY = 1.85,
      halfW = 1.22,
      halfD = 0.87;
    // An unoccupied tower platform, with an obvious gap at the front edge.
    for (const x of [-halfW, halfW])
      for (const z of [-halfD, halfD]) {
        cylinder(
          0.055,
          deckY + 1.02,
          silver,
          x,
          (deckY + 1.02) / 2 + 0.15,
          z,
          group,
        );
        const wheel = cylinder(0.14, 0.13, dark, x, 0.14, z, group);
        wheel.rotation.z = Math.PI / 2;
        box(0.2, 0.05, 0.28, red, x, 0.26, z, group);
      }
    box(2.6, 0.15, 1.94, steel, 0, deckY, 0, group);
    box(2.47, 0.035, 1.81, material("#a8b7ba"), 0, deckY + 0.095, 0, group);
    for (const x of [-halfW, halfW])
      for (const y of [deckY + 0.54, deckY + 1.0])
        box(0.055, 0.055, 1.78, yellow, x, y, 0, group);
    for (const y of [deckY + 0.54, deckY + 1.0])
      box(2.49, 0.055, 0.055, yellow, 0, y, -halfD, group);
    // Cross-bracing and enclosed access geometry; no person is allowed onto it.
    for (const x of [-1.22, 1.22]) {
      for (const dir of [-1, 1]) {
        const brace = box(0.045, 2.35, 0.045, steel, x, 1.03, 0, group);
        brace.rotation.x = dir * 0.67;
      }
    }
    for (let i = 0; i < 6; i++)
      box(0.45, 0.05, 0.1, silver, -0.8, 0.35 + i * 0.26, -0.63, group);
    const edge = new THREE.Group();
    group.add(edge);
    edge.visible = false;
    for (const y of [deckY + 0.54, deckY + 1.0])
      box(2.49, 0.055, 0.055, yellow, 0, y, halfD, edge);
    for (const x of [-halfW, halfW])
      box(0.07, 0.17, 1.78, yellow, x, deckY + 0.2, 0, edge);
    for (const z of [-halfD, halfD])
      box(2.5, 0.17, 0.06, yellow, 0, deckY + 0.2, z, edge);
    const stop = sign(
      "STOP  /  EDGE PROTECTION MISSING",
      2.4,
      0.32,
      0,
      0.82,
      1.0,
      { bg: "#805135", size: 47 },
    );
    const review = sign(
      "CONTROLS SHOWN  /  INSPECTION REQUIRED",
      2.4,
      0.32,
      0,
      0.82,
      1.002,
      { bg: "#326686", size: 43 },
    );
    review.visible = false;
    setResolved = (done) => {
      edge.visible = done;
      stop.visible = !done;
      review.visible = done;
    };
    markerHeight = 3.3;
  } else if (data.id === "below") {
    // Keep the work area aligned with the warehouse pedestrian route.
    group.rotation.y = 0;
    for (const x of [-2.75, 2.75])
      for (const z of [-0.9, 0.9])
        box(0.11, 3.55, 0.11, steel, x, 1.77, z, group);
    box(5.65, 0.17, 2.0, wood, 0, 3.4, 0, group);
    box(0.75, 0.37, 0.42, blue, -0.6, 3.65, -0.25, group);
    box(0.08, 0.04, 0.68, dark, -0.05, 3.52, -0.1, group);
    box(0.27, 0.12, 0.12, silver, -0.05, 3.56, -0.37, group);
    textSign("OVERHEAD WORK AREA", 3.3, 0.35, 0, 3.56, -1.03, {
      parent: group,
      rotate: Math.PI,
      bg: "#344e65",
      size: 58,
    });
    const restricted = new THREE.Group();
    group.add(restricted);
    restricted.visible = false;
    rail(restricted, 5.65, 0, -1.38);
    rail(restricted, 5.65, 0, 1.38);
    rail(restricted, 2.75, -2.85, 0, Math.PI / 2);
    rail(restricted, 2.75, 2.85, 0, Math.PI / 2);
    textSign(
      "NO ACCESS\nUSE THE AGREED ALTERNATIVE ROUTE",
      2.6,
      0.56,
      0,
      0.77,
      -1.42,
      { parent: restricted, rotate: Math.PI, bg: "#9c3538", size: 61 },
    );
    const arrow = textSign(
      "← ALTERNATIVE ROUTE",
      2.4,
      0.36,
      -3.9,
      0.02,
      -0.35,
      { parent: restricted, bg: "#227a64", size: 66 },
    );
    arrow.rotation.x = -Math.PI / 2;
    setResolved = (done) => {
      restricted.visible = done;
    };
    markerHeight = 2.35;
  } else if (data.id === "permission") {
    // Referral for competent planning is a safe action; passing the quiz is not a permit.
    for (const x of [-1.15, 1.15]) {
      box(0.09, 2.6, 0.09, steel, x, 1.3, -0.1, group);
      box(0.38, 0.08, 0.65, steel, x, 0.04, -0.1, group);
    }
    box(2.55, 1.55, 0.12, blue, 0, 1.75, -0.1, group);
    sign(
      "WORK AT HEIGHT\nPLANNING & AUTHORISATION",
      2.38,
      0.37,
      0,
      2.26,
      -0.03,
      { bg: "#2f507c", size: 66 },
    );
    sign(
      "TASK ASSESSMENT\nCOMPETENT PEOPLE\nSUITABLE EQUIPMENT\nRESCUE ARRANGEMENTS",
      2.24,
      0.83,
      0,
      1.62,
      -0.028,
      { bg: "#e3e9dc", fg: "#3e5365", size: 51 },
    );
    box(2.65, 0.13, 0.8, wood, 0, 0.88, 0.3, group);
    box(0.7, 0.03, 0.5, white, -0.5, 0.97, 0.31, group);
    const pending = sign("NOT CLEARED TO START", 2.26, 0.28, 0, 0.64, 0.54, {
      bg: "#815a37",
      size: 60,
    });
    const referred = sign(
      "ON HOLD  /  SUPERVISOR REVIEW",
      2.26,
      0.28,
      0,
      0.64,
      0.542,
      { bg: "#9c373b", size: 50 },
    );
    referred.visible = false;
    setResolved = (done) => {
      pending.visible = !done;
      referred.visible = done;
    };
    markerHeight = 2.95;
  }
  return {
    markerHeight,
    focusHeight: data.id === "below" ? 2.1 : 1.7,
    setResolved,
  };
}
export function createHeightScene(host, objects, onInspect) {
  return createWarehouseScene(host, objects, onInspect, {
    buildTarget: buildHeightTarget,
    sceneName: "maintenance zone",
    leftBayLabel: "03  /  MAINTENANCE",
    rightBayLabel: "04  /  EQUIPMENT",
    highlight: "#b5d7ff",
  });
}
