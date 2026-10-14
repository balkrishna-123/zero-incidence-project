import { moduleMeta } from "./ui.js";
const loadStudyScene = () =>
  import("./study-scene.js").then((m) => m.createStudyScene);
export const MODULE_VIEWS = {
  "hazard-perception": {
    number: "03",
    icon: moduleMeta["hazard-perception"].icon,
    scope:
      "The simulation does not approve a workplace or authorise repairs, vehicle operation or electrical work. Report uncertain conditions in real work — never hide a concern.",
    loadStudyScene,
  },
  "manual-handling": {
    number: "01",
    icon: moduleMeta["manual-handling"].icon,
    scope:
      "The app does not set a universal lifting weight or authorise equipment use. Follow your workplace’s assessed handling procedures.",
    loadStudyScene,
  },
  "working-at-height": {
    number: "02",
    icon: moduleMeta["working-at-height"].icon,
    scope:
      "This is a learning simulation, not practical competence training or permission to climb, use access equipment or carry out a rescue. Follow your site’s assessed procedures and authorisation requirements.",
    loadStudyScene,
  },
};
