import { levelJourneyPage } from "./learning-module.js";
export const manualHandlingPage = (ctx, requestedAttempt = null) =>
  levelJourneyPage(ctx, "manual-handling", requestedAttempt);
