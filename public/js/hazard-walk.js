import { esc } from "./ui.js";
import { icon } from "./icons.js";

export function hazardSceneStates(a) {
  if (!a) return [];
  const comparisons = (a.classifications || [])
    .filter((x) => !x.isHazard)
    .map((x) => ({ objectId: x.objectId, correct: x.correct }));
  return [...a.activityAnswers, ...comparisons];
}
export function hazardBreakdown(a) {
  const b = a.activityBreakdown;
  if (!b) return "";
  return `<div class="hunt-breakdown"><div><span>Identification</span><strong>${b.identificationScore}<small>/35</small></strong></div><div><span>Safer responses</span><strong>${b.responseScore}<small>/35</small></strong></div><div><span>Incorrect flags</span><strong>${b.falseFlagPenalty ? "−" + b.falseFlagPenalty : "0"}</strong></div></div>`;
}
export function hazardPanel(c, a, overview = false) {
  const inspected = a.inspection;
  const meter = `<div class="hunt-meters"><div><strong>${a.areasReviewed}<small>/8</small></strong><span>Areas reviewed</span></div><div><strong>${a.activityDone}<small>/5</small></strong><span>Hazards responded to</span></div></div>`;
  if (!inspected || overview) {
    return `<div class="lesson-eyebrow">YOUR SAFETY WALK</div><h2>Observe. Decide. Act safely.</h2>${meter}<p>${a.activityDone === 5 ? "All five hazards have a recorded response. Finish the remaining area reviews before starting the quiz." : "Inspect an area in the scene or use the area list. Decide whether a hazard is shown, then choose a suitable control when one is needed."}</p><div class="hunt-score-note">${icon("eye", 18)}<p><strong>Inspecting is free.</strong><br>Review all eight areas in any order. Your first classification and first control response count.</p></div>${hazardBreakdown(a)}<p class="lesson-small">In real work, report uncertain risks. Do not let an exercise score discourage a genuine safety concern.</p>`;
  }
  const entry = inspected.classification;
  const heading = `<button class="hunt-back" type="button" data-walk-overview>← Safety walk overview</button><div class="lesson-eyebrow">INSPECTED AREA</div><h2>${esc(inspected.label)}</h2><div class="hunt-observation"><strong>${entry ? "Recorded observation" : "What you can observe"}</strong><p>${esc(inspected.observation)}</p></div>`;
  if (!entry) {
    return `${heading}<h3 class="hunt-question">Does this area need hazard-control action?</h3><div class="activity-options"><button class="training-choice" data-classify="hazard"><span>${icon("alert", 15)}</span><div><strong>Hazard — needs action</strong><small>Identify a condition that could cause harm.</small></div></button><button class="training-choice" data-classify="clear"><span>${icon("checkCircle", 15)}</span><div><strong>No hazard shown here</strong><small>This comparison area shows no unsafe condition.</small></div></button></div><p class="lesson-small">Classifying records your first decision. Simply inspecting an area does not deduct marks.</p>`;
  }
  if (entry.isHazard && !inspected.controlDone && a.task) {
    return `${heading}<div class="hunt-identification ${entry.correct ? "correct" : "missed"}">${entry.correct ? "Hazard identified · 7/7 marks" : "Identification reviewed · 0/7 marks"}<small>You can still earn 7 marks for a suitable response.</small></div><h3 class="hunt-question">${esc(a.task.prompt)}</h3><div class="activity-options">${a.task.options.map((o, i) => `<button class="training-choice" data-activity-option="${o.id}"><span>${String.fromCharCode(65 + i)}</span><div>${esc(o.text)}</div></button>`).join("")}</div><p class="lesson-small">Your first control response counts. The full checkpoint combines identification and response, up to 14 marks.</p>`;
  }
  const f = inspected.controlFeedback || entry.feedback;
  return `${heading}<div class="hunt-identification ${f.correct ? "correct" : "missed"}">Already reviewed<small>${inspected.controlDone ? `Checkpoint total: ${f.points}/14 marks` : entry.correct ? "No hazard shown · no deduction" : "Incorrect flag · 2 activity marks deducted once"}</small></div><p>${esc(f.explanation)}</p><button class="btn btn-primary training-start" data-walk-overview>Continue safety walk ${icon("arrow", 15)}</button>`;
}
export function inspectionReviewHTML(result) {
  if (!result.inspectionReview) return "";
  return `<section class="hunt-inspection-review"><h3>All eight area judgements</h3><p class="lesson-small">Hazard identification marks are included in the checkpoint totals below. Only incorrect flags on the three comparison areas create deductions.</p>${result.inspectionReview.map((f) => `<details class="answer-review"><summary><span class="review-status ${f.correct ? "correct" : "incorrect"}">${icon(f.correct ? "checkCircle" : "info", 15)}</span><span>${esc(f.title)}</span><strong>${f.isHazard ? `${f.points}/7` : f.correct ? "Clear" : "−2"}</strong></summary><div><p><strong>Your judgement:</strong> ${esc(f.selected)}</p><p><strong>Assessment:</strong> ${esc(f.correctAnswer)}</p><p>${esc(f.explanation)}</p></div></details>`).join("")}</section>`;
}
