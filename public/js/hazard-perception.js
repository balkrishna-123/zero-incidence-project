import { levelJourneyPage } from "./learning-module.js";
export const hazardPerceptionPage = (ctx, requestedAttempt = null) =>
  levelJourneyPage(ctx, "hazard-perception", requestedAttempt);
