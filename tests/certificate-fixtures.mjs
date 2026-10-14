// Test-only helpers: complete the real HTTP assessment flow, never inject totals.
import { COURSES } from "../server/training-content.js";

// Finish a full module journey over the live API.
// options.wrongs: [level][questionIndex] -> wrong attempts before the correct
// answer (0..4; each wrong attempt docks 25 marks on that question).
export async function finishModule(
  get,
  post,
  key,
  { wrongs = null } = {},
) {
  const c = COURSES[key];
  let r = await post(`/training/${key}/start`, { acknowledged: true });
  const id = r.attempt.id,
    base = `/training/attempts/${id}`;
  await post(base + "/advance", {}); // intro -> study
  for (let level = 0; level < c.levels.length; level++) {
    await post(base + "/advance", {}); // study -> quiz
    for (let qi = 0; qi < c.levels[level].questions.length; qi++) {
      const st = await get(base);
      const q = st.attempt.currentQuestion;
      const def = c.levels[level].questions.find((x) => x.id === q.id);
      const wrongsForQ = wrongs?.[level]?.[qi] ?? 0;
      const wrongOption = def.options.find((o) => o.id !== def.correctId).id;
      for (let w = 0; w < wrongsForQ; w++)
        await post(base + "/quiz/answer", {
          questionId: q.id,
          optionId: wrongOption,
        });
      await post(base + "/quiz/answer", {
        questionId: q.id,
        optionId: def.correctId,
      });
    }
    if (level < c.levels.length - 1) await post(base + "/advance", {});
  }
  return post(base + "/advance", {}); // last quiz -> completed
}
export const issueBody = (status) => ({
  recipientId: status.employeeId,
  reviewKey: status.reviewKey,
});
