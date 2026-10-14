import { icon } from "./icons.js";
import { esc, notify, formatDate, moduleMeta } from "./ui.js";
import { MODULE_VIEWS } from "./module-views.js";
import { createStudyScene } from "./study-scene.js";

const starRow = (n) =>
  `<span class="training-stars" aria-label="${n} of 3 stars">${[1, 2, 3].map((i) => `<span class="${i <= n ? "earned" : ""}" aria-hidden="true">★</span>`).join("")}</span>`;
const source = (ref) =>
  `<a class="training-source" href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.title)} ${icon("arrow", 12)}</a>`;
const guideImage = (trainer, size = 40) =>
  trainer?.imageUrl
    ? `<img class="guide-avatar" style="width:${size}px;height:${size}px" src="${esc(trainer.imageUrl)}" alt="${esc(trainer.nickname)}" title="${esc(trainer.nickname)}, your virtual trainer">`
    : `<span class="guide-avatar guide-avatar-fallback" style="width:${size}px;height:${size}px">${icon("shield", Math.round(size * 0.5))}</span>`;

// Journey map: nine teardrop nodes from Welcome to Final result.
const JOURNEY_PHASES = ["intro", "study", "quiz", "completed"];
function journeyMapHTML(c, attempt) {
  const states = [];
  const push = (s) => states.push(s);
  const live = attempt && JOURNEY_PHASES.includes(attempt.phase) ? attempt : null;
  if (!live) {
    push("active");
    for (let i = 0; i < 8; i++) push("locked");
  } else {
    push("done");
    push(attempt.phase === "intro" ? "active" : "done");
    c.levels.forEach((l, i) => {
      const quizDone = attempt.levels[i].quizComplete;
      push(
        quizDone ||
          attempt.phase === "completed" ||
          (attempt.phase === "quiz" && attempt.levelIndex === i)
          ? "done"
          : attempt.phase === "study" && attempt.levelIndex === i
            ? "active"
            : "locked",
      );
      push(
        quizDone || attempt.phase === "completed"
          ? "done"
          : attempt.phase === "quiz" && attempt.levelIndex === i
            ? "active"
            : "locked",
      );
    });
    push(attempt.phase === "completed" ? "done-score" : "locked");
  }

  const nodes = [
    { label: "Welcome", icon: "grid" },
    { label: "Introduction", icon: "book" },
    ...c.levels.flatMap((l, i) => [
      { label: `Level ${i + 1}`, icon: "book", title: l.title },
      { label: `Quiz ${i + 1}`, icon: "checkCircle", title: l.title },
    ]),
    {
      label: "Final result",
      icon: attempt?.phase === "completed" ? "award" : "lock",
      score: attempt?.phase === "completed" ? attempt.score : null,
    },
  ];
  return nodes
    .map((n, i) => {
      const st = states[i];
      const iconEl =
        st === "done-score"
          ? icon("award", 17)
          : st === "locked" && i === states.length - 1
            ? icon("lock", 15)
            : icon(n.icon, 17);
      const scoreEl =
        st === "done-score" ? `<strong class="node-score">${n.score}</strong>` : "";
      const inner = `<span class="jn-inner">${iconEl}<small>${n.label}</small>${scoreEl}</span>`;
      return `<li class="journey-node-row">
        <button type="button" class="journey-node ${st}" data-journey-node="${i}" ${n.title ? `title="${esc(n.title)}"` : ""} aria-label="${esc(n.label)} — ${st === "active" ? "current stage" : st === "done" || st === "done-score" ? "completed" : "locked"}">${inner}</button>
        ${i < nodes.length - 1 ? '<span class="journey-link" aria-hidden="true"></span>' : ""}
      </li>`;
    })
    .join("");
}

export async function levelJourneyPage(
  ctx,
  moduleKey,
  requestedAttempt = null,
) {
  const view = MODULE_VIEWS[moduleKey];
  if (!view) throw new Error("This training module is not available.");
  const data = await ctx.api.get(`/training/${moduleKey}`);
  const c = data.course;
  const guideName = data.trainer?.nickname || "Your safety guide";
  return {
    title: c.title,
    html: `<div class="learning-module journey-module" data-course="${esc(moduleKey)}" data-accent="${esc(c.color)}">
      <a href="#/employee/hub" class="training-back">${icon("arrow", 14)} Back to training hub</a>
      <header class="training-heading"><div class="training-heading-title"><span class="training-module-icon">${icon(view.icon, 24)}</span><div><div class="page-eyebrow">MODULE ${esc(view.number)} · ${esc(c.zone.toUpperCase())}</div><h1>${esc(c.title)}</h1><p>${esc(c.subtitle)}</p></div></div><span class="training-save-status">${icon("shield", 13)} <span data-save-label>Progress saves automatically</span></span></header>
      <div class="module-progress-top" role="status" aria-label="Module completion">
        <span class="module-progress-label">${icon("chart", 14)}<span>Module completion</span></span>
        <span class="module-percent-bar big"><i data-progress-fill style="width:${data.percent ?? 0}%"></i></span>
        <strong class="module-percent" data-progress-pct>${data.percent ?? 0}%</strong>
        <small class="muted" data-progress-note>${(data.percent ?? 0) >= 100 ? "finished — verified" : "of this module finished so far"}</small>
      </div>
      <div class="training-error" role="alert" hidden><span data-error-text></span><button class="btn btn-secondary btn-small" data-reconnect>Reconnect</button></div>
      <div class="journey-layout">
        <aside class="journey-map" aria-label="Module journey map"><ol class="journey-nodes" data-journey-map>${journeyMapHTML(c, null)}</ol></aside>
        <div class="journey-stage" data-stage></div>
      </div>
      <section class="panel training-history" data-history-panel ${data.history.length ? "" : "hidden"}><header class="panel-head"><div><h2>Your previous attempts</h2><p>Real assessment history. Your best assessed score is retained.</p></div>${icon("clock", 18)}</header><div data-history-list></div></section>
      <details class="training-references"><summary>Sources, scope and important safety information</summary><p>${esc(c.notice)}</p><p>${esc(view.scope)}</p><div>${c.references.map(source).join("")}</div></details>
      <div class="training-announcement sr-only" aria-live="polite" data-announcement></div>
    </div>`,
    mount(root) {
      const wrap = root.querySelector("[data-course]");
      const stage = wrap.querySelector("[data-stage]");
      const errorBox = wrap.querySelector(".training-error");
      let alive = true,
        busy = false,
        attempt = null,
        scene = null,
        heldFeedback = null,
        hintText = null,
        visitedBoards = new Set();
      // Server clock offset (ms) so the 20-second quiz timer stays accurate
      // across reloads: openedAt is server time, Date.now() is client time.
      let serverClock = 0;
      let timerHandle = null;
      const stopTimer = () => {
        if (timerHandle) clearInterval(timerHandle);
        timerHandle = null;
      };
      let bestScore = data.bestScore;
      let history = [...data.history];
      let finalCompletion = null;
      let sceneUnavailable = false;
      if (data.serverNow) serverClock = data.serverNow - Date.now();
      const announce = (text) => {
        if (alive) wrap.querySelector("[data-announcement]").textContent = text;
      };
      const status = (text) => {
        wrap.querySelector("[data-save-label]").textContent = text;
      };
      function showError(e) {
        if (!alive) return;
        wrap.querySelector("[data-error-text]").textContent =
          e.status === 0
            ? "Connection lost. Your progress is saved on the server — reconnect to continue."
            : e.message;
        errorBox.hidden = false;
        status("Check connection");
      }
      async function action(path, body, { get = false, feedback = false } = {}) {
        if (busy || !alive) return null;
        busy = true;
        errorBox.hidden = true;
        status("Saving…");
        wrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
        try {
          let response;
          try {
            response = get
              ? await ctx.api.get(path)
              : await ctx.api.post(path, body);
          } catch (error) {
            if (error.code !== "CSRF_INVALID") throw error;
            await ctx.refreshSession();
            response = get
              ? await ctx.api.get(path)
              : await ctx.api.post(path, body);
          }
          if (!alive) return response;
          if (response.attempt?.moduleKey !== moduleKey)
            throw new Error(
              "This attempt belongs to a different module. Return to the training hub and open the matching module.",
            );
          attempt = response.attempt;
          bestScore = response.bestScore;
          finalCompletion = response.completion || null;
          if (response.serverNow) serverClock = response.serverNow - Date.now();
          heldFeedback = feedback ? response.feedback || null : null;
          if (attempt)
            window.history.replaceState(
              null,
              "",
              `#/employee/module/${moduleKey}?attempt=${encodeURIComponent(attempt.id)}`,
            );
          status("All progress saved");
          render();
          return response;
        } catch (error) {
          console.error("[journey-action] failed:", error);
          showError(error);
          return null;
        } finally {
          busy = false;
          if (alive)
            wrap
              .querySelectorAll("button")
              .forEach((b) => (b.disabled = false));
        }
      }
      function renderMap() {
        wrap
          .querySelector("[data-journey-map]")
          .innerHTML = journeyMapHTML(c, attempt);
      }
      function renderHistory() {
        const h = wrap.querySelector("[data-history-panel]");
        h.hidden = !history.length;
        wrap.querySelector("[data-history-list]").innerHTML = history
          .map(
            (a) =>
              `<div class="attempt-history-row"><span>${formatDate(a.completedAt)}</span><strong>${a.score}/100</strong><span class="badge ${a.passed ? "green" : "amber"}">${esc(a.classification)}</span><button class="btn btn-secondary btn-small" data-history-id="${esc(a.id)}">Review result</button></div>`,
          )
          .join("");
      }
      const trainerBubble = (text, extraClass = "") =>
        `<div class="trainer-bubble ${extraClass}"><span class="guide-avatar">${data.trainer ? guideImage(data.trainer, 40) : guideImage(null, 40)}</span><div class="trainer-bubble-text"><small>${esc(guideName)} · YOUR VIRTUAL TRAINER</small><p>${text}</p></div></div>`;

      const syncPercent = () => {
        const pct = attempt?.percent ?? data.percent ?? 0;
        const fill = wrap.querySelector("[data-progress-fill]");
        const label = wrap.querySelector("[data-progress-pct]");
        const note = wrap.querySelector("[data-progress-note]");
        if (!fill) return;
        fill.style.width = `${pct}%`;
        label.textContent = `${pct}%`;
        note.textContent =
          pct >= 100 ? "finished — verified" : "of this module finished so far";
      };
      function render() {
        if (!alive) return;
        syncPercent();
        stopTimer();
        scene?.dispose();
        scene = null;
        visitedBoards = new Set();
        try {
          renderMap();
        } catch (e) {
          console.error("[journey] map render failed:", e);
        }
        try {
          if (!attempt) return renderWelcome();
          // Legacy attempt from an older release (previous journey format):
          // it can’t be continued in the current flow.
          if (attempt.legacy)
            return attempt.phase === "completed"
              ? renderResult()
              : renderLegacy();
          if (heldFeedback) return renderQuizFeedback();
          if (attempt.phase === "intro") return renderIntro();
          if (attempt.phase === "study") return renderStudy();
          if (attempt.phase === "quiz") {
            if (!attempt.currentQuestion) return renderLevelComplete();
            return renderQuiz();
          }
          if (attempt.phase === "completed") return renderResult();
          stage.innerHTML = `<section class="panel journey-intro"><div class="lesson-eyebrow">UNKNOWN STAGE</div><h2>This stage can’t be shown right now.</h2><p>Your progress is saved on the server. Reconnect to reload the current stage.</p><button class="btn btn-primary" data-reconnect>${icon("refresh", 15)} Reconnect</button></section>`;
        } catch (e) {
          console.error("[journey] stage render failed:", e);
          stage.innerHTML = `<section class="panel journey-intro"><div class="lesson-eyebrow">NEEDS A FRESH PAGE</div><h2>Couldn’t restore this stage.</h2><p>Your progress is saved on the server, but this page can’t display that stage right now. Reconnect to reload it — nothing is lost.</p><button class="btn btn-primary" data-reconnect>${icon("refresh", 15)} Reconnect</button></section>`;
          showError(e);
        }
      }
      function renderLegacy() {
        stage.innerHTML = `<section class="panel journey-intro"><div class="lesson-eyebrow">PREVIOUS FORMAT</div><h2>This in-progress attempt started with an earlier release.</h2><p>The module journey now runs ${c.questionsPerLevel} questions per level with a ${c.questionTimeLimit}-second clock, so this attempt can’t be continued in the new flow. Start the journey to begin fresh — any completed results from the earlier format stay in your history.</p><button class="btn btn-primary" data-start-journey>${icon("play", 15)} Start the module journey</button></section>`;
      }
      function renderWelcome() {
        stage.innerHTML = `<section class="panel journey-welcome"><div class="journey-welcome-grid">
          <div>
            <div class="lesson-eyebrow">YOUR MISSION</div>
            <h2>${esc(c.title)} — the module journey</h2>
            <p>${esc(c.description)}</p>
            ${data.trainer?.introduction ? trainerBubble(esc(data.trainer.introduction), "welcome-bubble") : ""}
            <ul class="journey-format">
              <li>${icon("book", 16)}<div><strong>3 levels of study</strong><small>Every lesson section is a board in the rotatable 360° view — click it to read, full-screen available. The text is also in the side panel.</small></div></li>
              <li>${icon("checkCircle", 16)}<div><strong>A quiz after each level</strong><small>${c.questionsPerLevel} questions per level, ${c.questionCount} in total — answer every one correctly to move on. You have ${c.questionTimeLimit} seconds per question, and your guide can give you a hint.</small></div></li>
              <li>${icon("award", 16)}<div><strong>One final result</strong><small>The average of all ${c.questionCount} question scores, 70/100 to pass. It unlocks only after the last quiz.</small></div></li>
            </ul>
            ${bestScore !== null ? `<div class="training-best">Your assessed best: <strong>${bestScore}/100</strong></div>` : ""}
            <label class="training-ack"><input type="checkbox" id="training-ack"><span>I’ve read the briefing. I understand this simulation does not replace workplace instruction.</span></label>
            <button class="btn btn-primary training-start" data-start-journey disabled>${icon("play", 15)} Start module journey</button>
          </div>
          <div class="journey-preview" aria-hidden="true"><div class="journey-preview-card">${icon(view.icon, 30)}<h3>${esc(c.subtitle)}</h3><ol>${c.levels.map((l, i) => `<li><span>${i + 1}</span>${esc(l.title)}</li>`).join("")}</ol></div></div>
        </div></section>`;
        stage.querySelector("#training-ack").addEventListener("change", (e) => {
          stage.querySelector("[data-start-journey]").disabled =
            !e.target.checked || busy;
        });
      }
      function renderIntro() {
        stage.innerHTML = `<section class="panel journey-intro"><div class="lesson-eyebrow">INTRODUCTION · MEET YOUR TRAINER</div>
          ${trainerBubble(esc(c.intro.about))}
          <h3 class="intro-learn-title">${icon("sparkles", 15)} What we will study and learn</h3>
          <ul class="intro-learn">${c.intro.learn.map((l) => `<li>${icon("check", 14)}${esc(l)}</li>`).join("")}</ul>
          <div class="intro-actions"><button class="btn btn-primary training-start" data-advance>${icon("play", 15)} Begin Level 1 — ${esc(c.levels[0].title)}</button><span class="lesson-small">Three levels ahead. The study view is 360° — drag it around, and go full-screen when you want to study closely.</span></div>
        </section>`;
      }
      function renderStudy() {
        const li = attempt.levelIndex;
        const level = c.levels[li];
        const sections = level.study.sections
          .map(
            (s, i) =>
              `<article class="study-section" data-board-section="${i}"><span class="study-section-num">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div></article>`,
          )
          .join("");
        stage.innerHTML = `<div class="study-wrap">
          <section class="warehouse-frame study-frame" aria-label="360 degree study view" data-study-frame>
            <header class="warehouse-topline"><span><i></i> ${esc(c.zone.toUpperCase())} · LEVEL ${li + 1} STUDY</span><span class="scene-360">360° STUDY VIEW</span></header>
            <div class="warehouse-view" data-warehouse><div class="scene-loading">${icon(view.icon, 28)}<span>Preparing your study area…</span></div></div>
            <div class="warehouse-controls"><span>${icon("eye", 14)} Drag to look around · click a board to read it</span><div>
              <button type="button" data-look="left" title="Rotate left" aria-label="Rotate left">←</button>
              <button type="button" data-look="right" title="Rotate right" aria-label="Rotate right">→</button>
              <button type="button" data-look="in" title="Zoom in" aria-label="Zoom in">+</button>
              <button type="button" data-look="out" title="Zoom out" aria-label="Zoom out">−</button>
              <button type="button" data-study-fullscreen class="fullscreen-btn" title="Full-screen mode" aria-label="Full-screen mode">${'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'} Full screen</button>
            </div></div>
          </section>
          <aside class="training-side panel study-panel">
            <div class="training-coach">${guideImage(data.trainer, 40)}<div><strong>${esc(guideName)}</strong><small>YOUR SAFETY GUIDE</small></div><span class="coach-dot"></span></div>
            <div class="lesson-eyebrow">LEVEL ${li + 1} OF ${c.levelCount} · ${esc(level.title.toUpperCase())}</div>
            <h2>${esc(level.title)}</h2>
            <p class="study-intro">${esc(level.study.intro)}</p>
            <div class="study-sections">${sections}</div>
            <p class="lesson-small">Every section is also a board in the 360° view — turn around, click one to read it, and go full-screen if you like. Read at your own pace; the quiz waits for you.</p>
            <button class="btn btn-primary training-start" data-advance>${icon("checkCircle", 15)} I’m ready — start Level ${li + 1} quiz</button>
          </aside>
        </div>`;
        const frame = stage.querySelector("[data-study-frame]");
        const host = stage.querySelector("[data-warehouse]");
        // The 360° view carries the whole lesson: the short key-point signs
        // plus one board per lesson section, arranged around the training
        // area. Clicking a board opens its full text; the side panel keeps
        // the same content for reading without turning around.
        const keyBoards = level.study.boards || [];
        const lessonBoards = level.study.lessonBoards || [];
        const allBoards = [...keyBoards, ...lessonBoards];
        const openBoard = (boardId) => {
          const board = allBoards.find((b) => b.id === boardId);
          if (!board) return;
          visitedBoards.add(board.id);
          scene?.update(
            [...visitedBoards].map((id) => ({ objectId: id, correct: true })),
            boardId,
          );
          host.querySelector("[data-board-card]")?.remove();
          const card = document.createElement("div");
          card.className = "board-card";
          card.dataset.boardCard = "1";
          if (board.kind === "lesson") {
            const num = board.id.replace("lesson-", "");
            card.innerHTML = `<button type="button" data-board-close aria-label="Close lesson section">${icon("close", 13)}</button><small>SECTION ${esc(num)} OF ${lessonBoards.length}</small><h4>${esc(board.label)}</h4><p>${esc(board.body)}</p>`;
          } else {
            card.innerHTML = `<button type="button" data-board-close aria-label="Close key point">${icon("close", 13)}</button><small>KEY POINT</small><p>${board.text.split("\n").map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : esc(l))).join("<br>")}</p>`;
          }
          host.append(card);
          card.querySelector("[data-board-close]").addEventListener("click", () =>
            card.remove(),
          );
        };
        view.loadStudyScene
          ? view
              .loadStudyScene()
              .then((create) => {
                if (!alive) return;
                host.querySelector(".scene-loading")?.remove();
                try {
                  scene = create(host, allBoards, openBoard, {
                    sceneName: `${c.zone} study area`,
                    accent: c.color,
                  });
                  scene.setVisible(true);
                } catch (e) {
                  console.error("[study-scene] failed to build 360° view:", e);
                  studyFallback();
                }
              })
              .catch(studyFallback)
          : studyFallback();
        function studyFallback() {
          if (!alive) return;
          sceneUnavailable = true;
          host.innerHTML = `<div class="scene-fallback">${icon(view.icon, 40)}<h3>360° view unavailable</h3><p>The full study material remains available in the panel. For the 3D view, try Chrome or Edge with hardware acceleration enabled.</p></div>`;
          wrap.querySelectorAll("[data-look]").forEach((b) => (b.disabled = true));
        }
        const toggleFullscreen = () => {
          if (!document.fullscreenElement)
            frame.requestFullscreen?.().catch(() =>
              notify("Full-screen is not available here.", "error"),
            );
          else document.exitFullscreen?.();
        };
        stage.querySelector("[data-study-fullscreen]")?.addEventListener(
          "click",
          toggleFullscreen,
        );
      }
      function renderLevelComplete() {
        const li = attempt.levelIndex;
        const last = li === attempt.levelCount - 1;
        stage.innerHTML = `<section class="panel quiz-journey"><div class="quiz-top"><span>LEVEL ${li + 1} QUIZ · COMPLETE</span><span class="quiz-dots">${attempt.levels[li].questions
          .map(
            (st) => `<span class="quiz-dot ${st.done ? "done" : ""}"></span>`,
          )
          .join("")}</span></div>
          <div class="feedback-inline correct"><span class="feedback-mark">${icon("checkCircle", 24)}</span><div><h2>Level ${li + 1} quiz complete!</h2><p>Every question answered correctly. ${last ? "One more click and your final result is ready." : `Level ${li + 2} — ${esc(c.levels[li + 1].title)} — is next.`}</p></div></div>
          <div class="quiz-actions"><button class="btn btn-primary training-start" data-advance>${icon("arrow", 15)} ${last ? "See my final result" : `Continue to Level ${li + 2}`}</button></div>
        </section>`;
      }
      function renderQuiz() {
        const q = attempt.currentQuestion;
        const li = attempt.levelIndex;
        const level = c.levels[li];
        // Question progress comes from the attempt's own level state; the
        // course overview only carries a question count.
        const levelState = attempt.levels?.[li]?.questions;
        const qstate = Array.isArray(levelState)
          ? levelState
              .map(
                (st, i) =>
                  `<span class="quiz-dot ${st.done ? "done" : ""} ${q && st.id === q.id ? "current" : ""}" title="Question ${i + 1}"></span>`,
              )
              .join("")
          : "";
        const qTotal =
          (Array.isArray(levelState) && levelState.length) ||
          level.questionCount ||
          0;
        const timeLimit = q.timeLimit || 0;
        stage.innerHTML = `<section class="panel quiz-journey"><div class="quiz-top"><span>LEVEL ${li + 1} QUIZ · ${esc(level.title.toUpperCase())}</span><span class="quiz-dots">${qstate}</span></div>
          ${hintText ? trainerBubble(esc(hintText), "hint-bubble") : ""}
          <div class="quiz-body"><span class="quiz-mark-note">QUESTION ${q.number} OF ${qTotal} · ANSWER CORRECTLY TO CONTINUE</span>
          ${timeLimit ? `<div class="quiz-timer" data-quiz-timer role="timer" aria-label="Time remaining"><span class="quiz-timer-label">${icon("clock", 13)} <strong data-timer-sec>${timeLimit}</strong> s LEFT — ANSWER BEFORE THE CLOCK RUNS OUT</span><span class="quiz-timer-track"><i data-timer-fill style="width:100%"></i></span></div>` : ""}
          <h2>${esc(q.prompt)}</h2>
          <div class="quiz-options">${q.options.map((o, i) => `<button class="training-choice" data-quiz-option="${o.id}"><span>${String.fromCharCode(65 + i)}</span><div>${esc(o.text)}</div></button>`).join("")}</div>
          <div class="quiz-hint-row"><span class="lesson-small">Stuck? Your guide can help.</span><button type="button" class="btn btn-secondary btn-small" data-hint>${icon("help", 14)} Ask ${esc(guideName)} for a hint</button></div>
          </div>
        </section>`;
        // Countdown synced to the server's openedAt so a reload never resets
        // the 20-second window; at zero the client reports the timeout.
        if (timeLimit && q.openedAt) {
          const openedMs = new Date(q.openedAt).getTime();
          const tick = () => {
            const remaining = timeLimit * 1000 - (Date.now() + serverClock - openedMs);
            const timerEl = stage.querySelector("[data-quiz-timer]");
            const secEl = stage.querySelector("[data-timer-sec]");
            const fillEl = stage.querySelector("[data-timer-fill]");
            if (!timerEl || !secEl || !fillEl || busy) return;
            const sec = Math.max(0, Math.ceil(remaining / 1000));
            secEl.textContent = sec;
            fillEl.style.width = `${Math.max(0, Math.min(1, remaining / (timeLimit * 1000))) * 100}%`;
            timerEl.classList.toggle("warn", sec <= 10 && sec > 5);
            timerEl.classList.toggle("danger", sec <= 5);
            if (remaining <= 0) {
              stopTimer();
              action(
                `/training/attempts/${attempt.id}/quiz/timeout`,
                { questionId: q.id },
                { feedback: true },
              );
            }
          };
          tick();
          timerHandle = setInterval(tick, 250);
        }
      }
      function renderQuizFeedback() {
        const f = heldFeedback;
        const li = attempt.levelIndex;
        const isLast = attempt.levelQuizComplete;
        const nextLabel = isLast
          ? li === attempt.levelCount - 1
            ? "See my final result"
            : `Continue to Level ${li + 2}`
          : "Next question";
        stage.innerHTML = `<section class="panel quiz-journey"><div class="quiz-top"><span>LEVEL ${li + 1} QUIZ · FEEDBACK</span><span class="quiz-dots">${(attempt.levels?.[li]?.questions || [])
          .map(
            (st) => `<span class="quiz-dot ${st.done ? "done" : ""}"></span>`,
          )
          .join("")}</span></div>
          <div class="feedback-inline ${f.correct ? "correct" : "needs-review"}">
            <span class="feedback-mark">${icon(f.correct ? "checkCircle" : f.timedOut ? "clock" : "info", 24)}</span>
            <div><h2>${f.correct ? "Correct — well done." : f.timedOut ? "Time’s up." : "Not quite yet."}</h2><p>${f.correct
              ? `This question is now worth <strong>${f.questionScore}/100</strong> in your average.`
              : f.timedOut
                ? `The ${attempt.currentQuestion?.timeLimit || 20}-second window closed before your answer, so it counts as one attempt (now <strong>${f.questionScore}/100</strong> if you answer it correctly). The clock has restarted — read the safer answer below, then try again.`
                : `This attempt costs 25 marks on the question (now <strong>${f.questionScore}/100</strong> if you answer it correctly). Try again — you know more than before. The clock restarts with the question.`}</p></div>
          </div>
          ${!f.correct ? `<div class="correct-response"><strong>Safer answer</strong><p>${esc(f.correctAnswer)}</p></div>` : ""}
          <p class="feedback-explanation">${esc(f.explanation)}</p>
          ${source(f.reference)}
          <div class="quiz-actions"><button class="btn btn-primary training-start" data-advance>${icon(f.correct ? "arrow" : "refresh", 15)} ${f.correct ? nextLabel : "Try again"}</button></div>
        </section>`;
        if (f.correct)
          announce(
            isLast
              ? `Level ${li + 1} quiz complete.`
              : `Question answered correctly.`,
          );
      }
      function renderResult() {
        const r = attempt.result;
        if (!r) {
          stage.innerHTML = `<section class="panel journey-intro"><div class="lesson-eyebrow">PREVIOUS FORMAT</div><h2>This completed attempt predates the module journey.</h2><p>Its score can’t be shown in the new flow. Start the journey to earn a new final result.</p><button class="btn btn-primary" data-start-journey>${icon("play", 15)} Start the module journey</button></section>`;
          return;
        }
        if (r.legacy) {
          stage.innerHTML = `<section class="panel journey-intro"><div class="lesson-eyebrow">PREVIOUS FORMAT</div><h2>Completed with an earlier release.</h2><p>This result was recorded in the previous format${r.score != null ? ` — <strong>${r.score}/100</strong>` : ""}. It stays in your history. The current journey runs ${c.questionsPerLevel} questions per level with a ${c.questionTimeLimit}-second clock — start it to earn a result in the new format.</p><button class="btn btn-primary" data-start-journey>${icon("play", 15)} Start the module journey</button></section>`;
          return;
        }
        const priorPassRetained = !r.passed && bestScore >= 70;
        if (!history.some((h) => h.id === attempt.id))
          history.unshift({
            id: attempt.id,
            completedAt: attempt.completedAt,
            score: r.score,
            passed: r.passed,
            stars: r.stars,
            classification: r.classification,
          });
        const levelBars = r.perLevel
          .map(
            (l, i) =>
              `<div class="result-level-row"><span>Level ${i + 1} · ${esc(l.title)}</span><div class="level-bar"><i style="width:${l.average}%"></i></div><strong>${l.average}</strong></div>`,
          )
          .join("");
        stage.innerHTML = `<section class="module-result" data-module-result>
          <section class="result-summary panel"><span class="result-kicker">${esc(c.title.toUpperCase())} · FINAL RESULT · AVERAGE OF ALL ${c.questionCount} QUESTIONS</span>
            <div class="result-ring ${r.passed ? "pass" : "retake"}" style="--result:${r.score}"><div><strong>${r.score}</strong><span>OUT OF 100</span></div></div>
            ${starRow(r.stars)}
            <h2>${r.passed ? (r.score >= 85 ? "Excellent work." : "Module passed.") : "Let’s build on this."}</h2>
            <span class="badge ${r.passed ? "green" : "amber"}">${priorPassRetained ? "Practice result" : r.classification} · ${r.passed ? "70+ achieved" : priorPassRetained ? "Earlier pass kept" : "Retake required"}</span>
            <div class="result-levels">${levelBars}</div>
            <div class="training-best">Your assessed best: <strong>${bestScore}/100</strong></div>
            <div class="result-actions">
              <button class="btn btn-primary training-start" data-retry-journey>${icon("refresh", 15)} ${r.passed || priorPassRetained ? "Practise again" : "Retake module"}</button>
              <a class="btn btn-secondary training-start" href="#/employee/progress">View my progress ${icon("arrow", 15)}</a>
              <a class="btn btn-secondary training-start" href="#/employee/certificates">${icon("award", 15)}${finalCompletion?.eligible ? "Completion & certificate" : "Completion summary"}</a>
            </div>
          </section>
          <section class="result-review panel"><div class="training-coach">${guideImage(data.trainer, 40)}<div><strong>${esc(guideName)}</strong><small>YOUR TRAINER’S FEEDBACK</small></div></div>
            <div class="result-feedback"><h3>${r.passed ? "Keep making safer decisions." : "Review. Reassess. Try again."}</h3><p>${esc(priorPassRetained ? "This practice attempt was below the pass mark, but your earlier passing best still counts. Practise again whenever you are ready." : r.feedback)}</p>
              <div class="result-scope">This is your ${esc(c.title)} result only. All three modules must be passed individually at 70/100 or higher. ${finalCompletion?.eligible ? "Your genuine assessments meet the certificate requirement. Open the completion summary to generate or download your PDF." : "Open the completion summary to see which genuine passes are still required for your certificate."} ${esc(view.scope)}</div>
              <h3 class="review-title">Your ${c.questionCount} answers, explained</h3>
              ${r.review.map((f, i) => `<details class="answer-review"><summary><span class="review-status ${f.wrongAttempts === 0 ? "correct" : "incorrect"}">${icon(f.wrongAttempts === 0 ? "checkCircle" : "refresh", 15)}</span><span>${esc(f.levelTitle)} · Q${i + 1} — ${esc(f.title.slice(0, 60))}${f.title.length > 60 ? "…" : ""}</span><strong>${f.score}/100</strong></summary><div>${f.selected ? `<p><strong>Your answer:</strong> ${esc(f.selected)}</p>` : ""}<p><strong>Correct answer:</strong> ${esc(f.correctAnswer)}</p><p>${esc(f.explanation)}</p><p class="review-meta">${f.wrongAttempts ? `${f.wrongAttempts} wrong attempt${f.wrongAttempts === 1 ? "" : "s"} · ` : "First-time correct · "}${f.hintUsed ? "used a hint" : "no hint used"}</p>${source(f.reference)}</div></details>`).join("")}
              <p class="lesson-small">Each question is worth 100. Every wrong attempt before the correct answer costs 25 (minimum 0) — the same applies when the ${c.questionTimeLimit}-second clock runs out. Your final result is the average of all ${c.questionCount} questions. Later retakes cannot reduce a genuine assessed best score.</p></div></section></section>`;
        announce(`${c.title} final result: ${r.score} out of 100. ${r.classification}.`);
      }
      const click = (event) => {
        const b = event.target.closest("button");
        if (!b || !wrap.contains(b)) return;
        if (b.hasAttribute("data-start-journey")) {
          action(`/training/${moduleKey}/start`, { acknowledged: true });
        } else if (b.hasAttribute("data-advance")) {
          if (heldFeedback) {
            if (heldFeedback.correct && attempt.levelQuizComplete)
              heldFeedback = null;
            else if (!heldFeedback.correct) {
              // retry: reload the same question state
              action(`/training/attempts/${attempt.id}`, null, { get: true });
              return;
            }
            heldFeedback = null;
            render();
            return;
          }
          action(`/training/attempts/${attempt.id}/advance`, {});
        } else if (b.hasAttribute("data-quiz-option")) {
          action(
            `/training/attempts/${attempt.id}/quiz/answer`,
            {
              questionId: attempt.currentQuestion.id,
              optionId: b.dataset.quizOption,
            },
            { feedback: true },
          );
        } else if (b.hasAttribute("data-hint")) {
          action(
            `/training/attempts/${attempt.id}/hint`,
            { questionId: attempt.currentQuestion.id },
          ).then((response) => {
            if (response?.hint && alive) {
              hintText = response.hint;
              renderQuiz();
            }
          });
        } else if (b.hasAttribute("data-retry-journey")) {
          heldFeedback = null;
          hintText = null;
          action(`/training/${moduleKey}/start`, { acknowledged: true });
        } else if (b.hasAttribute("data-history-id")) {
          heldFeedback = null;
          action(`/training/attempts/${b.dataset.historyId}`, null, { get: true });
        } else if (b.hasAttribute("data-reconnect")) {
          heldFeedback = null;
          if (attempt) action(`/training/attempts/${attempt.id}`, null, { get: true });
          else {
            errorBox.hidden = true;
            status("Ready to start");
          }
        } else if (b.hasAttribute("data-look")) {
          const mode = b.dataset.look;
          if (mode === "left" || mode === "right")
            scene?.rotate(mode === "left" ? 0.4 : -0.4);
          else scene?.zoom(mode === "in" ? -7 : 7);
        } else if (b.hasAttribute("data-journey-node")) {
          const i = Number(b.dataset.journeyNode);
          const st = b.className.replace("journey-node", "").trim();
          if (st === "active")
            stage.scrollIntoView({ behavior: "smooth", block: "start" });
          else if (st === "locked" || st === "")
            notify("Complete the previous stages to unlock this one.", "error");
        }
      };
      wrap.addEventListener("click", click);
      const onVisibility = () => {
        if (!document.hidden && attempt && !busy)
          action(`/training/attempts/${attempt.id}`, null, { get: true });
      };
      document.addEventListener("visibilitychange", onVisibility);
      render();
      renderHistory();
      const initial = requestedAttempt || data.activeAttemptId;
      if (initial)
        action(`/training/attempts/${encodeURIComponent(initial)}`, null, {
          get: true,
        });
      return () => {
        alive = false;
        scene?.dispose();
        wrap.removeEventListener("click", click);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    },
  };
}
