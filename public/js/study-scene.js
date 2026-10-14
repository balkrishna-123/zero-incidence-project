import * as THREE from "../vendor/three.module.js";
import { createWarehouseScene } from "./warehouse-scene.js";

// A 360° study room: the shared warehouse shell plus floating key-point
// boards around the space. Drag to look around (or use the rotate buttons);
// click a numbered board to open its key point. The same scene supports
// full-screen mode through the surrounding frame element.
function buildBoardTarget({ data, group, textSign, box, material, steel, dark }) {
  // Face the board toward the room centre where the camera starts.
  const facing = Math.atan2(-data.position[0], -data.position[2]);
  group.rotation.y = facing;
  box(0.14, 1.5, 0.14, steel, -1.1, 0.75, -0.1, group);
  box(0.14, 1.5, 0.14, steel, 1.1, 0.75, -0.1, group);
  box(2.5, 0.1, 0.1, steel, 0, 1.6, -0.1, group);
  const lines = data.text.split("\n");
  const heading = lines[0];
  const rest = lines.slice(1).join(" · ");
  // Lesson boards carry the study sections into the 360° view; a teal
  // header with the section number keeps them distinct from key-point
  // boards. The full section text opens in the click card.
  const isLesson = data.kind === "lesson";
  const headerBg = isLesson ? "#0e8f84" : "#227b66";
  const headerFg = isLesson ? "#e8fbf7" : "#eafaf3";
  const board = box(2.5, 1.5, 0.08, material("#f6f1e4", { roughness: 0.6 }), 0, 2.35, 0, group);
  board.castShadow = false;
  box(2.5, 0.3, 0.09, material(headerBg, { roughness: 0.5 }), 0, 2.98, 0, group).castShadow = false;
  textSign(isLesson ? `${heading}  ·  ${data.id.replace("lesson-", "LESSON ")}` : heading, 2.3, 0.3, 0, 2.98, 0.055, {
    parent: group,
    bg: headerBg,
    fg: headerFg,
    size: isLesson ? 58 : 74,
  });
  textSign(rest || " ", 2.2, 1.05, 0, 2.2, 0.055, {
    parent: group,
    bg: "#f6f1e4",
    fg: "#41505a",
    size: 56,
  });
  return {
    setResolved: () => {},
    markerHeight: 2.6,
    focusHeight: 2.3,
  };
}
export function createStudyScene(host, boardDefs, onBoard, options = {}) {
  const objects = boardDefs.map((b) => ({
    id: b.id,
    kind: b.kind || "key",
    label: b.label,
    position: b.position,
    text: b.text,
  }));
  return createWarehouseScene(host, objects, onBoard, {
    sceneName: options.sceneName || "study area",
    buildTarget: buildBoardTarget,
    lighting: 1.12,
    spawnYaw: 0.4,
    leftBayLabel: options.leftBayLabel || "STUDY  /  360° VIEW",
    rightBayLabel: options.rightBayLabel || (objects.length ? "LESSON BOARDS  /  CLICK TO READ" : "TAKE YOUR TIME"),
  });
}
