import { levelJourneyPage } from "./learning-module.js";
export const workingAtHeightPage = (ctx, requestedAttempt = null) =>
  levelJourneyPage(ctx, "working-at-height", requestedAttempt);
