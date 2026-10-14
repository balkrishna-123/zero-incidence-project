import { icon } from "./icons.js";
import { esc, notify } from "./ui.js";

// Practice-only corner behind the FUN GAMES door. Nothing on this page
// touches the assessment system: no attempts, no scores on record.
const GAMES = [
  {
    key: "forklift",
    title: "Forklift Shift",
    icon: "package",
    blurb: "Drive the lift, stack the pallets, find the matching bays.",
  },
  {
    key: "quiz",
    title: "Quiz Challenge",
    icon: "star",
    blurb: "Ten lightning questions from all three modules — 20 seconds each.",
  },
  {
    key: "hazard-hunt",
    title: "Spot the Hazard",
    icon: "search",
    blurb: "Walk the aisle and find every hazard before the shift starts.",
  },
  {
    key: "ppe",
    title: "PPE Load-Out",
    icon: "helmet",
    blurb: "Pick the right kit for the job before you clock on.",
  },
];

const store = {
  get: (k, fallback) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode — best scores simply don't persist */
    }
  },
};

export function funGamesPage(ctx) {
  const html = `<div class="fun-games" data-fun-games>
    <a href="#/employee/hub" class="training-back">${icon("arrow", 14)} Back to training hub</a>
    <header class="training-heading"><div class="training-heading-title"><span class="training-module-icon fun-games-icon">${icon("sparkles", 24)}</span><div><div class="page-eyebrow">PRACTICE CORNER · NO CERTIFICATION STAKES</div><h1>Fun Games</h1><p>Warming up the safety reflexes between shifts. Nothing here counts toward your modules — mistakes are free.</p></div></div></header>
    <div class="fun-games-tabs" role="tablist" aria-label="Choose a game">${GAMES.map(
      (g, i) =>
        `<button type="button" class="fun-game-tab ${i === 0 ? "active" : ""}" role="tab" aria-selected="${i === 0}" data-game="${g.key}"><span class="fun-game-tab-icon">${icon(g.icon, 17)}</span><strong>${esc(g.title)}</strong><small>${esc(g.blurb)}</small></button>`,
    ).join("")}</div>
    <div class="fun-games-stage panel" data-fun-stage></div>
  </div>`;
  return {
    title: "Fun games",
    html,
    mount(root) {
      const stage = root.querySelector("[data-fun-stage]");
      let alive = true;
      let cleanup = null;
      const mountGame = (key) => {
        if (cleanup) cleanup();
        cleanup = null;
        stage.innerHTML = "";
        if (!alive) return;
        if (key === "quiz") cleanup = mountQuiz(stage, ctx, alive);
        else if (key === "hazard-hunt") cleanup = mountHazardHunt(stage, alive);
        else if (key === "ppe") cleanup = mountPpe(stage, alive);
        else mountForklift(stage);
      };
      root
        .querySelectorAll("[data-game]")
        .forEach((b) =>
          b.addEventListener("click", () => {
            root
              .querySelectorAll("[data-game]")
              .forEach((x) => {
                x.classList.toggle("active", x === b);
                x.setAttribute("aria-selected", x === b ? "true" : "false");
              });
            mountGame(b.dataset.game);
          }),
        );
      mountGame("forklift");
      return () => {
        alive = false;
        if (cleanup) cleanup();
      };
    },
  };
}

// --------------------------------------------------------------------------
// 1 · Forklift Shift — the client's A-Frame game, embedded untouched.
// --------------------------------------------------------------------------
function mountForklift(stage) {
  stage.innerHTML = `<div class="fun-panel">
    <header class="fun-panel-head"><div><h2>Forklift Shift</h2><p>Pick up each pallet and deliver it to its matching bay. Drive with the on-screen or keyboard controls inside the game.</p></div><span class="badge gray">${icon("package", 12)} PRACTICE ONLY</span></header>
    <div class="fun-forklift-frame"><iframe src="/games/forklift.html" title="Forklift — Warehouse Shift game" loading="lazy"></iframe></div>
  </div>`;
  return null;
}

// --------------------------------------------------------------------------
// 2 · Quiz Challenge — ten random questions across all three modules.
// --------------------------------------------------------------------------
function mountQuiz(stage, ctx, alive) {
  const state = {
    questions: [],
    index: 0,
    score: 0,
    answered: false,
    timer: null,
    deadline: 0,
    limit: 20,
  };
  const best = store.get("zi.fun.quiz.best", null);
  stage.innerHTML = `<div class="fun-panel">
    <header class="fun-panel-head"><div><h2>Quiz Challenge</h2><p>Ten questions drawn at random from all three modules — manual handling, working at height and hazard perception. Twenty seconds per question; the clock is on you, not your record.</p></div><span class="badge gray">${icon("trophy", 12)} PRACTICE ONLY</span></header>
    <div data-quiz-body></div>
  </div>`;
  const body = stage.querySelector("[data-quiz-body]");

  async function act(path, b, isGet) {
    try {
      return isGet ? await ctx.api.get(path) : await ctx.api.post(path, b);
    } catch (e) {
      if (e.code !== "CSRF_INVALID") throw e;
      await ctx.refreshSession();
      return isGet ? await ctx.api.get(path) : await ctx.api.post(path, b);
    }
  }
  const stopClock = () => {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  };
  function renderIdle() {
    body.innerHTML = `<div class="fun-quiz-idle">
      <p>${best !== null ? `Your best challenge score: <strong>${best}/10</strong>.` : "No challenge score yet — beat it after your first run."}</p>
      <button type="button" class="btn btn-primary" data-quiz-start>${icon("play", 15)} Start the challenge</button>
    </div>`;
    body.querySelector("[data-quiz-start]").addEventListener("click", start);
  }
  async function start() {
    try {
      const data = await act("/training/fun-quiz", null, true);
      if (!alive) return;
      state.questions = data.questions;
      state.limit = data.questionTimeLimit || 20;
      state.index = 0;
      state.score = 0;
      renderQuestion();
    } catch (e) {
      if (!alive) return;
      notify(e.message || "Couldn't load the quiz.", "error");
      renderIdle();
    }
  }
  function startClock() {
    stopClock();
    state.deadline = Date.now() + state.limit * 1000;
    const tick = () => {
      const remaining = Math.max(0, state.deadline - Date.now());
      const bar = body.querySelector("[data-quiz-clock-bar]");
      const sec = body.querySelector("[data-quiz-clock-sec]");
      if (bar) bar.style.width = `${(remaining / (state.limit * 1000)) * 100}%`;
      if (sec) sec.textContent = Math.ceil(remaining / 1000);
      if (remaining <= 0 && !state.answered) {
        stopClock();
        answer(null);
      }
    };
    tick();
    state.timer = setInterval(tick, 250);
  }
  function renderQuestion() {
    const q = state.questions[state.index];
    state.answered = false;
    body.innerHTML = `<div class="fun-quiz-q">
      <div class="fun-quiz-top"><span>QUESTION ${state.index + 1} OF ${state.questions.length}</span><span class="fun-quiz-clock">${icon("clock", 12)} <strong data-quiz-clock-sec>${state.limit}</strong> s<span class="fun-quiz-clock-track"><i data-quiz-clock-bar style="width:100%"></i></span></span></div>
      <h3>${esc(q.prompt)}</h3>
      <div class="quiz-options">${q.options
        .map(
          (o, i) =>
            `<button type="button" class="training-choice" data-quiz-choice="${i}"><span>${String.fromCharCode(65 + i)}</span><div>${esc(o.text)}</div></button>`,
        )
        .join("")}</div>
    </div>`;
    body.querySelectorAll("[data-quiz-choice]").forEach((b) =>
      b.addEventListener("click", () => answer(Number(b.dataset.quizChoice))),
    );
    startClock();
  }
  async function answer(optionIndex) {
    if (state.answered) return;
    state.answered = true;
    stopClock();
    const q = state.questions[state.index];
    let result;
    try {
      result =
        optionIndex === null
          ? { correct: false, correctText: null, explanation: "", reference: null, timedOut: true }
          : await act("/training/fun-quiz/answer", {
              questionId: q.id,
              optionId: q.options[optionIndex].id,
            });
    } catch (e) {
      if (!alive) return;
      notify(e.message || "Couldn't check that answer.", "error");
      state.answered = false;
      startClock();
      return;
    }
    if (!alive) return;
    if (result.correct) state.score += 1;
    const nextIsLast = state.index + 1 >= state.questions.length;
    body.innerHTML = `<div class="fun-quiz-feedback ${result.correct ? "correct" : "wrong"}">
      <span class="feedback-mark">${icon(result.correct ? "checkCircle" : result.timedOut ? "clock" : "info", 24)}</span>
      <div class="fun-quiz-feedback-body">
        <h3>${result.correct ? "Correct!" : result.timedOut ? "Time's up." : "Not that one."}</h3>
        ${!result.correct && result.correctText ? `<p class="fun-quiz-safer"><strong>Safer answer:</strong> ${esc(result.correctText)}</p>` : ""}
        ${result.explanation ? `<p>${esc(result.explanation)}</p>` : ""}
        ${result.reference ? `<a class="training-source" href="${esc(result.reference.url)}" target="_blank" rel="noopener noreferrer">${esc(result.reference.title)} ${icon("arrow", 12)}</a>` : ""}
        <div class="quiz-actions"><button type="button" class="btn btn-primary" data-quiz-next>${icon(nextIsLast ? "award" : "arrow", 15)} ${nextIsLast ? "See my score" : "Next question"}</button></div>
      </div>
    </div>`;
    body.querySelector("[data-quiz-next]").addEventListener("click", () => {
      state.index += 1;
      if (state.index >= state.questions.length) renderDone();
      else renderQuestion();
    });
  }
  function renderDone() {
    const prevBest = store.get("zi.fun.quiz.best", null);
    const isRecord = prevBest === null || state.score > prevBest;
    if (isRecord) store.set("zi.fun.quiz.best", state.score);
    body.innerHTML = `<div class="fun-quiz-done">
      <div class="fun-quiz-score-ring">${state.score}<small>/ ${state.questions.length}</small></div>
      <h3>${state.score >= 8 ? "Sharp eyes!" : state.score >= 5 ? "Solid round." : "Good warm-up."}</h3>
      <p>${isRecord ? "New personal best — the record is yours." : `Your best stays at ${prevBest}/10.`} None of this touched your training record.</p>
      <button type="button" class="btn btn-primary" data-quiz-again>${icon("refresh", 15)} Play again</button>
    </div>`;
    body.querySelector("[data-quiz-again]").addEventListener("click", start);
  }
  renderIdle();
  return () => stopClock();
}

// --------------------------------------------------------------------------
// 3 · Spot the Hazard — walk the aisle, click every hazard before time runs
//    out. A pre-shift safety walk: exactly the job of the person on the floor.
// --------------------------------------------------------------------------
const HHAZARDS = [
  {
    id: "spill",
    name: "Slippery spill",
    why: "A spill on the main aisle is a slip hazard. Clean it up, put up the wet-floor sign, and only then walk across.",
    draw: () => `
      <ellipse cx="0" cy="6" rx="34" ry="12" fill="#f4d35e" opacity="0.85"/>
      <ellipse cx="10" cy="3" rx="16" ry="6" fill="#f7dd7d" opacity="0.9"/>
      <path d="M-20 2 l6 -20 l6 20 z" fill="#e8b923"/>
      <circle cx="-17" cy="-24" r="6" fill="#fff" stroke="#e8b923" stroke-width="2.5"/>`,
  },
  {
    id: "exit",
    name: "Blocked emergency exit",
    why: "Boxes stacked in front of the exit door. Egress routes must stay clear at all times — this is checked in every fire drill.",
    draw: () => `
      <rect x="-22" y="-8" width="20" height="14" rx="2" fill="#c9a06a"/>
      <rect x="-4" y="-20" width="24" height="16" rx="2" fill="#d8b07c"/>
      <rect x="2" y="-8" width="20" height="14" rx="2" fill="#b98d55"/>
      <path d="M-14 -8 v14 M10 -20 v16 M12 -8 v14" stroke="#8a6a3f" stroke-width="1.5" fill="none"/>`,
  },
  {
    id: "dangle",
    name: "Unsecured load",
    why: "A carton is hanging off the rack edge, above the walkway. One nudge and it is a falling object. Restow it immediately.",
    draw: () => `
      <rect x="-16" y="-2" width="30" height="24" rx="2" fill="#cf9f63"/>
      <path d="M-16 -2 l30 24 M14 -2 l-30 24" stroke="#8a6a3f" stroke-width="1.5"/>
      <path d="M-2 22 v10 M-6 26 l4 6 l4 -6" stroke="#b4552d" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  },
  {
    id: "cable",
    name: "Cable across the walkway",
    why: "A power cable trailing across the yellow line is a trip hazard. Route it overhead or tape it flat at the side of the aisle.",
    draw: () => `
      <path d="M-40 8 C -20 -6, 18 16, 42 -4" stroke="#3c4450" stroke-width="5" fill="none" stroke-linecap="round"/>
      <rect x="38" y="-12" width="12" height="10" rx="2" fill="#5a6472"/>`,
  },
  {
    id: "forklift",
    name: "Forklift in the pedestrian aisle",
    why: "A parked forklift is sitting in the middle of the pedestrian route. Move it to a laydown bay and switch it off with the key removed.",
    draw: () => `
      <rect x="-24" y="-10" width="34" height="16" rx="3" fill="#f0a63c"/>
      <rect x="-18" y="-22" width="14" height="14" rx="2" fill="#8a6a3f"/>
      <rect x="10" y="-24" width="4" height="24" fill="#5a4a2f"/>
      <rect x="14" y="-16" width="16" height="4" fill="#5a4a2f"/>
      <circle cx="-14" cy="8" r="7" fill="#3c4450"/>
      <circle cx="2" cy="8" r="7" fill="#3c4450"/>
      <circle cx="-14" cy="8" r="3" fill="#9aa4b2"/>
      <circle cx="2" cy="8" r="3" fill="#9aa4b2"/>`,
  },
  {
    id: "worker",
    name: "No helmet under the racks",
    why: "Someone is working under the racking without a hard hat. Under the racks is a hard-hat zone — objects can drop from the bays above.",
    draw: () => `
      <circle cx="0" cy="-18" r="9" fill="#e9c9a8"/>
      <path d="M-12 16 v-20 a12 10 0 0 1 24 0 v20 z" fill="#4a7fb5"/>
      <path d="M-12 -2 h24" stroke="#35618c" stroke-width="2"/>`,
  },
  {
    id: "extinguisher",
    name: "Blocked fire extinguisher",
    why: "The extinguisher is covered with stock. In a fire you have seconds — an obstructed extinguisher wastes them. Clear the access space.",
    draw: () => `
      <rect x="-9" y="-18" width="18" height="30" rx="7" fill="#c23b30"/>
      <rect x="-5" y="-24" width="10" height="8" rx="2" fill="#7a241d"/>
      <path d="M4 -22 q10 -4 12 4" stroke="#3c4450" stroke-width="2.5" fill="none"/>
      <rect x="-14" y="6" width="28" height="12" rx="2" fill="#c9a06a"/>`,
  },
  {
    id: "rack",
    name: "Bent rack upright",
    why: "The rack upright is visibly bent — the frame is taking damage. Tag it, move the pallets off, and report it before anyone loads it again.",
    draw: () => `
      <path d="M-8 20 L-8 -14 L4 -22 L4 20" stroke="#c23b30" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M-14 20 h24" stroke="#8a6a3f" stroke-width="3"/>
      <path d="M10 -18 l8 -6 M12 -12 l10 -2" stroke="#b4552d" stroke-width="2" stroke-linecap="round"/>`,
  },
];
// Fixed scene slots (x, y in the 900x440 viewBox) — open floor areas only.
const HH_SLOTS = [
  [120, 330], [300, 300], [460, 340], [620, 300], [780, 330],
  [210, 390], [390, 395], [560, 390], [720, 385], [90, 260],
  [820, 255], [460, 265],
];
function mountHazardHunt(stage, alive) {
  const TOTAL = 60;
  const state = {
    hazards: [],
    found: new Set(),
    misses: 0,
    timeLeft: TOTAL,
    over: false,
    timer: null,
  };
  const best = store.get("zi.fun.hazard.best", null);
  stage.innerHTML = `<div class="fun-panel">
    <header class="fun-panel-head"><div><h2>Spot the Hazard</h2><p>You have 60 seconds to walk the aisle and click every hazard you can spot. Each find is worth 100 marks; wrong clicks cost 10.</p></div><span class="badge gray">${icon("search", 12)} PRACTICE ONLY</span></header>
    <div class="fun-hh-stats">
      <span class="fun-hh-stat"><span>TIME</span><strong data-hh-time>${TOTAL}</strong></span>
      <span class="fun-hh-stat"><span>FOUND</span><strong data-hh-found>0 / 6</strong></span>
      <span class="fun-hh-stat"><span>SCORE</span><strong data-hh-score>0</strong></span>
      <span class="fun-hh-stat"><span>BEST</span><strong data-hh-best>${best !== null ? best : "—"}</strong></span>
      <button type="button" class="btn btn-secondary btn-small" data-hh-reset>${icon("refresh", 14)} New walk</button>
    </div>
    <div class="fun-hh-stage" data-hh-stage>
      <svg viewBox="0 0 900 440" role="img" aria-label="Warehouse aisle with hidden hazards to find">
        <rect x="0" y="0" width="900" height="250" fill="#f3efe3"/>
        <rect x="0" y="250" width="900" height="190" fill="#e7e2d2"/>
        <rect x="395" y="60" width="110" height="150" rx="4" fill="#5f7d5a"/>
        <rect x="405" y="70" width="90" height="130" fill="#4c6a49"/>
        <text x="450" y="130" text-anchor="middle" font-size="22" font-weight="700" fill="#eef4e6" font-family="Arial, sans-serif">EXIT</text>
        <rect x="420" y="100" width="60" height="10" rx="3" fill="#9fd08c"/>
        <rect x="150" y="20" width="120" height="10" rx="3" fill="#d9d2bd"/>
        <rect x="620" y="20" width="120" height="10" rx="3" fill="#d9d2bd"/>
        <g stroke="#8a7f66" stroke-width="4" fill="none">
          <path d="M40 60 V 240 M230 60 V 240"/>
          <path d="M670 60 V 240 M860 60 V 240"/>
        </g>
        <g fill="#b3a486">
          <rect x="40" y="95" width="190" height="8"/><rect x="40" y="160" width="190" height="8"/><rect x="40" y="225" width="190" height="8"/>
          <rect x="670" y="95" width="190" height="8"/><rect x="670" y="160" width="190" height="8"/><rect x="670" y="225" width="190" height="8"/>
        </g>
        <g fill="#cf9f63">
          <rect x="55" y="70" width="40" height="25"/><rect x="105" y="74" width="34" height="21"/><rect x="160" y="68" width="44" height="27"/>
          <rect x="685" y="72" width="38" height="23"/><rect x="740" y="68" width="46" height="27"/><rect x="800" y="74" width="34" height="21"/>
          <rect x="60" y="136" width="44" height="24"/><rect x="130" y="140" width="36" height="20"/>
          <rect x="690" y="138" width="40" height="22"/><rect x="760" y="134" width="46" height="26"/>
        </g>
        <path d="M320 250 L360 440 M580 250 L540 440" stroke="#e8b923" stroke-width="6" opacity="0.8"/>
        <rect x="380" y="330" width="140" height="26" rx="4" fill="#efe9d6"/>
        <text x="450" y="348" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="2" fill="#a09474" font-family="Arial, sans-serif">SAFE AISLE</text>
        <g data-hh-hazards></g>
      </svg>
      <div class="fun-hh-toast" data-hh-toast hidden></div>
    </div>
    <div class="fun-hh-result" data-hh-result hidden></div>
  </div>`;
  const stageEl = stage.querySelector("[data-hh-stage]");
  const toastEl = stage.querySelector("[data-hh-toast]");
  const timeEl = stage.querySelector("[data-hh-time]");
  const foundEl = stage.querySelector("[data-hh-found]");
  const scoreEl = stage.querySelector("[data-hh-score]");
  const resultEl = stage.querySelector("[data-hh-result]");
  const svgRoot = stage.querySelector("[data-hh-hazards]");

  const score = () => Math.max(0, state.found.size * 100 - state.misses * 10);
  let toastTimer = null;
  const toast = (text, kind) => {
    toastEl.textContent = text;
    toastEl.className = `fun-hh-toast ${kind}`;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 1600);
  };

  const start = () => {
    if (state.timer) clearInterval(state.timer);
    const pool = [...HHAZARDS].sort(() => Math.random() - 0.5).slice(0, 6);
    const slots = [...HH_SLOTS].sort(() => Math.random() - 0.5).slice(0, 6);
    state.hazards = pool.map((h, i) => ({ ...h, x: slots[i][0], y: slots[i][1] }));
    state.found = new Set();
    state.misses = 0;
    state.timeLeft = TOTAL;
    state.over = false;
    resultEl.hidden = true;
    svgRoot.innerHTML = state.hazards
      .map(
        (h, i) =>
          `<g class="hh-hazard" data-hh-i="${i}" transform="translate(${h.x} ${h.y})" role="button" aria-label="Hazard spot">${h.draw()}<circle r="34" fill="transparent"/></g>`,
      )
      .join("");
    timeEl.textContent = TOTAL;
    foundEl.textContent = "0 / 6";
    scoreEl.textContent = "0";
    state.timer = setInterval(() => {
      if (state.over) return;
      state.timeLeft -= 1;
      timeEl.textContent = state.timeLeft;
      if (state.timeLeft <= 0) finish();
    }, 1000);
  };

  const finish = () => {
    state.over = true;
    if (state.timer) clearInterval(state.timer);
    const s = score();
    const prev = store.get("zi.fun.hazard.best", null);
    if (prev === null || s > prev) {
      store.set("zi.fun.hazard.best", s);
      stage.querySelector("[data-hh-best]").textContent = s;
    }
    svgRoot.querySelectorAll(".hh-hazard").forEach((g) => {
      const i = Number(g.dataset.hhI);
      g.classList.add(state.found.has(i) ? "hh-found" : "hh-missed");
      g.querySelector("circle").setAttribute("fill", state.found.has(i) ? "#2e7d3222" : "#c23b3022");
    });
    resultEl.innerHTML = `
      <div class="fun-hh-result-head">
        <div><span>${state.found.size}/6 hazards found</span><h3>${s} points</h3></div>
        <button type="button" class="btn btn-primary btn-small" data-hh-again>${icon("refresh", 14)} Walk it again</button>
      </div>
      <div class="fun-hh-brief">${state.hazards
        .map((h, i) => {
          const foundIt = state.found.has(i);
          return `<div class="fun-hh-brief-row ${foundIt ? "ok" : "no"}"><span class="fun-hh-brief-mark">${icon(foundIt ? "checkCircle" : "close", 15)}</span><div><strong>${h.name}</strong><p>${h.why}</p></div></div>`;
        })
        .join("")}</div>`;
    resultEl.hidden = false;
    resultEl.querySelector("[data-hh-again]").addEventListener("click", start);
  };

  stageEl.addEventListener("click", (e) => {
    if (state.over) return;
    const g = e.target.closest(".hh-hazard");
    if (g) {
      const i = Number(g.dataset.hhI);
      if (state.found.has(i)) return;
      state.found.add(i);
      g.classList.add("hh-found");
      foundEl.textContent = `${state.found.size} / 6`;
      scoreEl.textContent = score();
      toast(`${state.hazards[i].name} — found. +100`, "good");
      if (state.found.size === 6) finish();
    } else {
      state.misses += 1;
      scoreEl.textContent = score();
      toast("Nothing there — keep walking. −10", "bad");
    }
  });
  stage.querySelector("[data-hh-reset]").addEventListener("click", start);
  start();
  return () => { if (state.timer) clearInterval(state.timer); };
}

// --------------------------------------------------------------------------
// 4 · PPE Load-Out — pick the exact personal protective equipment for each
//    task. The right kit, the right job: every employee's first decision.
// --------------------------------------------------------------------------
const PPE_ITEMS = [
  { id: "helmet", label: "Hard hat", svg: '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M2 15h20v3H2z"/><path d="M10 7V4h4v3"/>' },
  { id: "vest", label: "Hi-vis vest", svg: '<path d="M8 3h3l1 3 1-3h3l2 4v11H6V7z"/><path d="M6 12h12M6 16h12"/>' },
  { id: "boots", label: "Safety boots", svg: '<path d="M6 4h6v8l8 4v4H6z"/><path d="M6 16h12"/>' },
  { id: "gloves", label: "Work gloves", svg: '<path d="M7 13V5a1.5 1.5 0 0 1 3 0v6V4a1.5 1.5 0 0 1 3 0v7V5a1.5 1.5 0 0 1 3 0v8l2-2a1.5 1.5 0 0 1 2 2l-4 7a5 5 0 0 1-4.5 3H10a3 3 0 0 1-3-3z"/>' },
  { id: "harness", label: "Safety harness", svg: '<circle cx="12" cy="5" r="3"/><path d="M5 21v-6a7 7 0 0 1 14 0v6"/><path d="M9 12l6 7M15 12l-6 7"/>' },
  { id: "glasses", label: "Safety glasses", svg: '<circle cx="7" cy="12" r="3.5"/><circle cx="17" cy="12" r="3.5"/><path d="M10.5 12h3M3.5 11L2 8M20.5 11L22 8"/>' },
  { id: "shield", label: "Face shield", svg: '<path d="M4 4h16v8a8 8 0 0 1-16 0z"/><path d="M4 8h16"/>' },
  { id: "ears", label: "Ear defenders", svg: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="13" width="5" height="7" rx="2"/><rect x="17" y="13" width="5" height="7" rx="2"/>' },
  { id: "apron", label: "Chemical apron", svg: '<path d="M8 3h8v4l2 2v12H6V9l2-2z"/><path d="M8 3l-1 4M16 3l1 4"/>' },
];
const PPE_TASKS = [
  {
    task: "Repainting the mezzanine beams — 6 m up on a mobile elevated work platform.",
    required: ["harness", "helmet", "vest", "boots"],
    notes: {
      harness: "Required — a fall from height means the harness is non-negotiable.",
      helmet: "Required — overhead work: tools and drips fall straight down.",
      vest: "Required — the platform sits in a live traffic area; be seen.",
      boots: "Required — steel decking needs puncture and impact protection.",
      glasses: "Not needed here — no spray or flying debris at eye level.",
      shield: "Not needed here — that's for chemical splash and grinding.",
      ears: "Not needed here — no sustained noise source on the platform.",
      gloves: "Not needed here — painting needs dexterity; nitrile for the brush is the job's kit.",
      apron: "Not needed here — no chemical handling at eye level.",
    },
  },
  {
    task: "Stacking wet beverage cartons at the dock while forklifts run the yard.",
    required: ["vest", "boots", "gloves"],
    notes: {
      vest: "Required — forklift traffic: high visibility is your first defence.",
      boots: "Required — wet cartons mean wet floors; slip and crush protection.",
      gloves: "Required — wet cardboard cuts and the carton weight need grip.",
      helmet: "Not needed here — you stay in the pallet bay, not under loads.",
      harness: "Not needed here — no work at height in this task.",
      glasses: "Not needed here — no eye-level hazard in manual stacking.",
      shield: "Not needed here — no splash or grinding exposure.",
      ears: "Not needed here — ambient yard noise, below the limit.",
      apron: "Not needed here — beverage cartons, not chemicals.",
    },
  },
  {
    task: "Cutting a damaged pallet corner with a jigsaw in the repair bay.",
    required: ["glasses", "gloves", "boots"],
    notes: {
      glasses: "Required — sawdust and off-cuts fly straight at the eyes.",
      gloves: "Required — the blade path and the rough timber need grip and protection.",
      boots: "Required — dropped off-cuts and the saw itself are foot hazards.",
      helmet: "Not needed here — you are at standing height, not under loads.",
      harness: "Not needed here — no fall from height in the repair bay.",
      shield: "Not needed here — a jigsaw is a dust risk, not a splash risk.",
      ears: "Not needed here — a handheld jigsaw stays below the exposure limit.",
      apron: "Not needed here — timber dust, not chemicals.",
    },
  },
  {
    task: "Topping up the forklift battery electrolyte in the charge bay.",
    required: ["shield", "gloves", "apron"],
    notes: {
      shield: "Required — electrolyte is sulphuric acid: the face shield protects eyes and face.",
      gloves: "Required — acid-rated gloves stop the splash at the skin.",
      apron: "Required — the chemical apron keeps the acid off the body and clothes.",
      helmet: "Not needed here — no overhead hazard in the charge bay.",
      vest: "Not needed here — the bay is fenced off from live traffic.",
      boots: "Not needed here — the bay floor is sealed; acid-rated footwear is for the spill route.",
      glasses: "Not needed here — the face shield already covers the eyes.",
      ears: "Not needed here — battery rooms are quiet work.",
    },
  },
  {
    task: "Pressure-washing the mezzanine walkway at the start of the shift.",
    required: ["glasses", "boots", "ears"],
    notes: {
      glasses: "Required — the spray recoils straight back at the operator's eyes.",
      boots: "Required — a wet walkway and a nozzle on the floor need grip.",
      ears: "Required — the pressure washer stays above the noise limit; defenders protect the hearing.",
      helmet: "Not needed here — you are on an open walkway, not under racking.",
      vest: "Not needed here — the walkway is a pedestrian-only deck at shift start.",
      gloves: "Not needed here — the hose couplings are the only grip risk; dry hands are safer.",
      shield: "Not needed here — glasses cover the eye exposure; a shield is overkill for spray.",
      apron: "Not needed here — water, not chemicals.",
    },
  },
];
function mountPpe(stage, alive) {
  const state = {
    task: 0,
    picked: new Set(),
    checked: false,
    score: 0,
  };
  const best = store.get("zi.fun.ppe.best", null);
  const itemSvg = (id) => {
    const it = PPE_ITEMS.find((x) => x.id === id);
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${it.svg}</svg>`;
  };
  stage.innerHTML = `<div class="fun-panel">
    <header class="fun-panel-head"><div><h2>PPE Load-Out</h2><p>Read the job, pick exactly the kit it needs, then check your load-out. Extras and omissions both cost marks — the right kit, the right job.</p></div><span class="badge gray">${icon("helmet", 12)} PRACTICE ONLY</span></header>
    <div class="fun-ppe-stats">
      <span class="fun-ppe-stat"><span>TASK</span><strong data-ppe-task>1 / ${PPE_TASKS.length}</strong></span>
      <span class="fun-ppe-stat"><span>SCORE</span><strong data-ppe-score>0</strong></span>
      <span class="fun-ppe-stat"><span>BEST</span><strong data-ppe-best>${best !== null ? best : "—"}</strong></span>
    </div>
    <div class="fun-ppe-task" data-ppe-task-text></div>
    <div class="fun-ppe-grid" data-ppe-grid></div>
    <div class="fun-ppe-actions">
      <button type="button" class="btn btn-primary" data-ppe-check>${icon("check", 15)} Check my load-out</button>
      <button type="button" class="btn btn-secondary" data-ppe-next hidden>Next task ${icon("arrow", 15)}</button>
    </div>
    <div class="fun-ppe-feedback" data-ppe-feedback hidden></div>
  </div>`;
  const taskEl = stage.querySelector("[data-ppe-task-text]");
  const gridEl = stage.querySelector("[data-ppe-grid]");
  const checkBtn = stage.querySelector("[data-ppe-check]");
  const nextBtn = stage.querySelector("[data-ppe-next]");
  const feedbackEl = stage.querySelector("[data-ppe-feedback]");
  const scoreEl = stage.querySelector("[data-ppe-score]");

  const renderTask = () => {
    const t = PPE_TASKS[state.task];
    state.picked = new Set();
    state.checked = false;
    taskEl.textContent = t.task;
    stage.querySelector("[data-ppe-task]").textContent = `${state.task + 1} / ${PPE_TASKS.length}`;
    feedbackEl.hidden = true;
    checkBtn.hidden = false;
    nextBtn.hidden = true;
    gridEl.innerHTML = PPE_ITEMS.map(
      (it) =>
        `<button type="button" class="fun-ppe-item" data-ppe-item="${it.id}" aria-pressed="false">${itemSvg(it.id)}<span>${it.label}</span></button>`,
    ).join("");
  };
  gridEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ppe-item]");
    if (!b || state.checked) return;
    const id = b.dataset.ppeItem;
    if (state.picked.has(id)) state.picked.delete(id);
    else state.picked.add(id);
    b.setAttribute("aria-pressed", state.picked.has(id) ? "true" : "false");
  });
  checkBtn.addEventListener("click", () => {
    const t = PPE_TASKS[state.task];
    if (!state.picked.size) {
      notify("Pick some kit first — even empty hands need a decision.", "error");
      return;
    }
    state.checked = true;
    let pts = 100;
    const rows = PPE_ITEMS.map((it) => {
      const required = t.required.includes(it.id);
      const picked = state.picked.has(it.id);
      const ok = required === picked;
      if (!ok) pts -= 15;
      gridEl.querySelector(`[data-ppe-item="${it.id}"]`).classList.add(ok ? "ppe-ok" : "ppe-bad");
      return `<div class="fun-ppe-row ${ok ? "ok" : "no"}"><span class="fun-ppe-row-mark">${icon(ok ? "checkCircle" : "close", 15)}</span><div><strong>${it.label}</strong> — ${required ? "needed" : "not needed"}<p>${t.notes[it.id]}</p></div></div>`;
    });
    pts = Math.max(0, pts);
    state.score += pts;
    scoreEl.textContent = state.score;
    feedbackEl.innerHTML = `<div class="fun-ppe-score-line"><span>Load-out</span><strong>${pts}/100</strong></div>${rows.join("")}`;
    feedbackEl.hidden = false;
    checkBtn.hidden = true;
    nextBtn.hidden = false;
  });
  nextBtn.addEventListener("click", () => {
    if (state.task < PPE_TASKS.length - 1) {
      state.task += 1;
      renderTask();
    } else {
      const prev = store.get("zi.fun.ppe.best", null);
      if (prev === null || state.score > prev) {
        store.set("zi.fun.ppe.best", state.score);
        stage.querySelector("[data-ppe-best]").textContent = state.score;
      }
      const avg = Math.round(state.score / PPE_TASKS.length);
      taskEl.textContent = "Shift complete — that's your load-out record for today.";
      stage.querySelector("[data-ppe-task]").textContent = `DONE`;
      gridEl.innerHTML = "";
      nextBtn.hidden = true;
      checkBtn.hidden = false;
      checkBtn.textContent = "Run the shift again";
      feedbackEl.innerHTML = `<div class="fun-ppe-score-line"><span>Total</span><strong>${state.score}/500 · ${avg} average</strong></div><p class="lesson-small">A clean load-out every shift is what keeps the incident count at zero.</p><button type="button" class="btn btn-primary btn-small" data-ppe-restart>${icon("refresh", 14)} Start again</button>`;
      feedbackEl.hidden = false;
      feedbackEl.querySelector("[data-ppe-restart]").addEventListener("click", () => {
        state.task = 0;
        state.score = 0;
        scoreEl.textContent = "0";
        checkBtn.textContent = "Check my load-out";
        renderTask();
      });
    }
  });
  renderTask();
  return null;
}
