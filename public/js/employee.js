import { icon } from "./icons.js";
import {
  esc,
  modal,
  closeModal,
  moduleMeta,
  progressBadge,
  empty,
  formatDate,
  notify,
  busy,
  formError,
} from "./ui.js";
import { settingsPage } from "./admin.js";

function showModule(module) {
  modal({
    title: module.title,
    subtitle: "Your learning overview",
    className: "wide",
    content: `${module.trainer ? `<div class="module-modal-guide"><img src="${esc(module.trainer.imageUrl)}" alt="${esc(module.trainer.nickname)}"><p><strong>${esc(module.trainer.nickname)}, your safety guide</strong><br>${esc(module.trainer.introduction)}</p></div>` : `<div class="info-callout mb-24">${icon("trainer", 17)}<span>Your administrator has not assigned an active virtual trainer to this module yet.</span></div>`}<h3 style="font-size:13px">What you’ll learn</h3><ul class="learning-list">${module.objectives.map((o) => `<li>${icon("checkCircle", 15)}<span>${esc(o)}</span></li>`).join("")}</ul><h3 style="font-size:13px">Before you begin</h3><ul class="learning-list">${module.rules.map((r) => `<li>${icon("shield", 15)}<span>${esc(r)}</span></li>`).join("")}</ul><div class="info-callout blue-callout">${icon("info", 17)}<span><strong>Preview only — assessments are not available yet.</strong><br>Phase 2 will add interactive 360° activities and quizzes with a 20-second question timer. You’ll need at least 70/100 in every module. These introductory notes do not replace site-specific safety training or authorisation.</span></div>`,
    footer:
      '<button class="btn btn-secondary" data-close-modal>Back to training hub</button><button class="btn btn-primary" disabled>Assessment available in Phase 2</button>',
  });
}
function verifiedLearning(data) {
  const completion = data.completion;
  if (!completion) return data;
  const modules = completion.modules.map((m) => {
    const raw = data.progress.modules.find((r) => r.key === m.key);
    if (m.verified)
      return {
        ...raw,
        ...m,
        source: "assessment",
        bestAttemptId: m.attemptId,
        status: m.passed ? "passed" : "retake",
      };
    if (raw?.source === "demo")
      return { ...raw, status: "not-started", classification: "Sample" };
    return {
      ...raw,
      score: null,
      status: "not-started",
      classification: "Not verified",
      attempts: 0,
    };
  });
  const status = completion.eligible
    ? "complete"
    : completion.modules.some((m) => m.verified && !m.passed)
      ? "retake"
      : completion.modules.some((m) => m.verified || m.activeAttemptId)
        ? "in-progress"
        : "not-started";
  return {
    ...data,
    progress: {
      ...data.progress,
      modules,
      passed: completion.passed,
      percent: completion.percent,
      eligible: completion.eligible,
      overallScore: completion.overallScore,
      status,
      hasDemoScores: modules.some((m) => m.source === "demo"),
    },
  };
}
function moduleCards(data) {
  return data.modules
    .map((m) => {
      const meta = moduleMeta[m.key];
      const progress = data.progress.modules.find((p) => p.key === m.key);
      return `<article class="module-card"><span class="module-icon ${meta.color}">${icon(meta.icon, 23)}</span><span class="badge ${progress.status === "passed" ? "green" : progress.status === "retake" ? "amber" : "gray"}">${progress.score === null ? (m.assessmentAvailable ? (data.activeTraining?.[m.key] ? "In progress" : "Training available") : "Overview available") : `${progress.score}/100 · ${progress.classification}`}</span><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><div class="module-card-meta"><span>${m.trainer ? `Guide: ${esc(m.trainer.nickname)}` : "Guide not assigned"}</span><span>70% to pass</span></div><button class="btn ${meta.color}" data-module="${m.key}">${m.assessmentAvailable ? (data.activeTraining?.[m.key] ? "Continue training" : progress.source === "assessment" ? "Open module" : "Start training") : "View module overview"} ${icon("arrow", 14)}</button></article>`;
    })
    .join("");
}
function hub(ctx, data) {
  const trainer = data.modules.find((m) => m.trainer)?.trainer;
  return {
    title: "Training hub",
    standalone: true,
    html: `<main class="game-hub"><div class="game-hub-scene" data-tour-scene><div class="scene-loading">${icon("eye", 28)}<span>Preparing your 360° warehouse…</span></div></div><div class="game-brand"><span class="game-brand-logo">${icon("shield", 15)}ZERO&nbsp;INCIDENT</span><span class="game-brand-tag">YOUR WAREHOUSE · 360°</span></div><nav class="game-hud" aria-label="Menu"><button type="button" data-goto="/employee/progress">${icon("chart", 15)}<span>My progress</span></button><button type="button" data-goto="/employee/certificates">${icon("award", 15)}<span>Certificates</span></button><button type="button" data-goto="/employee/settings">${icon("user", 15)}<span>Profile</span></button><button type="button" data-game-logout>${icon("logout", 15)}<span>Sign out</span></button></nav><button type="button" class="game-start" data-game-start><span class="game-start-play">${icon("play", 20)}</span>Start Training Hub</button><div class="game-intro" data-game-intro hidden><img src="${esc(trainer?.imageUrl || "")}" alt="" ${trainer ? "" : "hidden"}><div class="game-intro-body"><span class="game-intro-name">${esc((trainer?.nickname || "Your guide").toUpperCase())} · YOUR SAFETY GUIDE</span><p>${esc(trainer?.introduction || `Welcome, ${esc(ctx.state.user.firstName)}! I'm your safety guide. Head to a door and step inside to start your first training.`)}</p><p class="game-intro-hint">Walk with <b>W A S D</b> or the on-screen pad · drag to look around · the sign above each door names the skill inside — step through to begin.</p></div><button type="button" class="btn btn-primary" data-intro-done>Let’s go ${icon("arrow", 14)}</button></div><div class="game-door-plate" data-door-plate hidden><span class="game-door-plate-index" data-plate-index>1</span><div class="game-door-plate-body"><strong data-plate-title>Module</strong><p>The door is open — walk through to begin</p></div><button type="button" class="btn btn-primary" data-door-enter>Enter training ${icon("arrow", 13)}</button></div><div class="game-hint" data-game-hint hidden><span>Walk: W A S D / arrows or the pad</span><span>${icon("eye", 12)}Look: drag</span><span>${icon("arrow", 12)}Enter: walk through a door</span></div><div class="game-dpad" data-dpad aria-label="Movement pad"><button type="button" data-dpad="f" aria-label="Walk forward">▲</button><div class="game-dpad-mid"><button type="button" data-dpad="l" aria-label="Walk left">◀</button><button type="button" data-dpad="b" aria-label="Walk back">▼</button><button type="button" data-dpad="r" aria-label="Walk right">▶</button></div></div></main>`,
    mount(root) {
      const host = root.querySelector("[data-tour-scene]");
      const startBtn = root.querySelector("[data-game-start]");
      const intro = root.querySelector("[data-game-intro]");
      const hint = root.querySelector("[data-game-hint]");
      const plate = root.querySelector("[data-door-plate]");
      let scene = null;
      let alive = true;
      let started = false;
      let ambientFrame = 0;
      let doorList = null;
      const openModule = (key) => {
        // The Fun Games door is practice, not an assessed module.
        if (key === "fun-games") return ctx.navigate("/employee/fun-games");
        const module = data.modules.find((m) => m.key === key);
        if (!module) return;
        if (module.assessmentAvailable) ctx.navigate(`/employee/module/${key}`);
        else showModule(module);
      };
      const showPlate = (door) => {
        if (!door) {
          plate.hidden = true;
          return;
        }
        const i = doorList.findIndex((d) => d.key === door.key);
        root.querySelector("[data-plate-index]").textContent = i + 1;
        root.querySelector("[data-plate-title]").textContent = door.label;
        const enterBtn = plate.querySelector("[data-door-enter]");
        enterBtn.dataset.doorEnter = door.key;
        plate.hidden = false;
      };
      const startGame = () => {
        if (started) return;
        started = true;
        sessionStorage.setItem("zi.gameStarted", "1");
        startBtn.classList.add("is-hidden");
        scene?.setStarted(true);
        scene?.setMovement(true);
        scene?.greet(6500);
        hint.hidden = false;
        intro.hidden = false;
      };
      import("./tour-scene.js")
        .then(({ createTourScene, TOUR_DOORS }) => {
          if (!alive) return;
          doorList = TOUR_DOORS;
          // Warm the module chunks in the background so opening a door never
          // waits on a network fetch or module parse to enter a training room.
          [
            "./manual-handling.js",
            "./working-at-height.js",
            "./hazard-perception.js",
            "./fun-games.js",
          ].forEach((chunk) => {
            import(chunk).catch(() => {});
          });
          host.querySelector(".scene-loading")?.remove();
          scene = createTourScene(host, {
            trainerName: trainer?.nickname || "Your guide",
            firstName: ctx.state.user.firstName,
            onNearDoor: showPlate,
            onEnterStart: () => {},
            onEnterDoor: openModule,
          });
          if (sessionStorage.getItem("zi.gameStarted") === "1") {
            started = true;
            startBtn.classList.add("is-hidden");
            scene.setStarted(true);
            scene.setMovement(true);
            hint.hidden = false;
          } else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const tick = () => {
              if (!alive || started) return;
              if (scene && !document.hidden) scene.rotate(0.0016);
              ambientFrame = requestAnimationFrame(tick);
            };
            tick();
          }
        })
        .catch((e) => {
          console.error("360° tour unavailable:", e);
          if (!alive) return;
          host.innerHTML = `<div class="scene-fallback">${icon("eye", 40)}<h3>3D preview unavailable</h3><p>3D rendering is not available in this browser. Your modules still include the full interactive 3D activities — try Chrome or Edge with hardware acceleration enabled.</p></div>`;
        });
      root.querySelectorAll("[data-goto]").forEach((b) => {
        b.onclick = () => ctx.navigate(b.dataset.goto);
      });
      root.querySelector("[data-game-logout]")?.addEventListener("click", () => ctx.logout());
      startBtn.addEventListener("click", startGame);
      root.querySelector("[data-intro-done]")?.addEventListener("click", () => {
        intro.classList.add("is-hidden");
      });
      root.querySelectorAll("[data-dpad]").forEach((b) => {
        const dir = b.dataset.dpad;
        const down = (e) => {
          e.preventDefault();
          b.setPointerCapture?.(e.pointerId);
          scene?.setTouch(dir, true);
        };
        const up = (e) => {
          e.preventDefault();
          scene?.setTouch(dir, false);
        };
        b.addEventListener("pointerdown", down);
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("lostpointercapture", () => scene?.setTouch(dir, false));
      });
      plate.querySelector("[data-door-enter]")?.addEventListener("click", (e) => {
        scene?.enterDoor(e.currentTarget.dataset.doorEnter);
      });
      return () => {
        alive = false;
        cancelAnimationFrame(ambientFrame);
        scene?.dispose();
      };
    },
  };
}
function progress(ctx, data) {
  const p = data.progress;
  const rated = data.ratedModules || [];
  const ratable = p.modules
    .filter((m) => m.status === "passed")
    .map((m) => {
      const source = data.modules.find((x) => x.key === m.key);
      return { key: m.key, trainer: source?.trainer, score: m.score };
    })
    .filter((r) => r.trainer && !rated.includes(r.key));
  const ninety = p.modules.filter((m) => m.score >= 90).length;
  const application = data.trainerApplication;
  let promotion;
  if (application?.status === "pending")
    promotion = `<div class="info-callout blue-callout">${icon("clock", 17)}<span><strong>Your trainer application is under review.</strong> Sent on ${formatDate(application.createdAt)} — your administrator will approve or decline it.</span></div>`;
  else if (application?.status === "rejected")
    promotion = `<div class="info-callout red-callout">${icon("alert", 17)}<span><strong>Your last trainer application was declined.</strong> You can apply again below.</span></div>
    ${application?.status === "rejected" ? trainerApplyForm() : ""}`;
  else if (data.trainerEligible)
    promotion = `<div class="info-callout green-callout">${icon("trophy", 17)}<span><strong>You're eligible for a trainer role!</strong> You scored 90/100 or higher in all three modules. Apply below — your administrator approves the application and sets up your trainer sign-in.</span></div>${trainerApplyForm()}`;
  else
    promotion = `<div class="info-callout">${icon("award", 17)}<span><strong>Become a trainer.</strong> Score 90/100 or higher in all three modules to apply for a trainer role (currently ${ninety} of 3).</span></div>`;
  const ratingHtml = ratable.length
    ? `<section class="panel mt-24"><header class="panel-head"><div><h2>Rate your guides</h2><p>After finishing a module, let the trainer know how it went — like a Play Store rating.</p></div>${icon("star", 18)}</header><div class="panel-body">${ratable
        .map(
          (r) => `<div class="rating-row"><div><strong>${moduleMeta[r.key]?.short || r.key}</strong><small class="muted">Guide: ${esc(r.trainer.nickname)} · scored ${r.score}/100</small></div><div class="star-input" data-module="${r.key}" data-trainer="${r.trainer.id}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star${n === 1 ? "" : "s"}">${icon("star", 18)}</button>`).join("")}</div><div class="rating-actions"><input type="text" class="rating-comment" data-module="${r.key}" maxlength="280" placeholder="Add a short comment (optional)"><button type="button" class="btn btn-primary btn-sm" data-rate="${r.key}">${icon("send", 13)}Submit</button></div></div>`,
        )
        .join("")}</div></section>`
    : "";
  return {
    title: "My progress",
    html: `<div class="page-heading"><div><h1>Small steps. Safer habits.</h1><p>Your progress across the three required safety modules.</p></div>${progressBadge(p.status)}</div><a href="#/employee/certificates" class="btn btn-secondary completion-summary-link">${icon("award", 15)}Completion summary & certificate</a><section class="panel learning-progress-card" style="margin:0 0 24px"><div class="progress-ring" style="--value:${p.percent}"><span>${p.percent}%</span></div><div><h3>${p.passed} of 3 modules passed</h3><p>${p.overallScore === null ? "Your overall score will appear once all three modules are assessed." : `Overall score: ${p.overallScore} / 100. Every individual module still needs at least 70.`}</p></div></section>${p.hasDemoScores ? `<div class="scope-note">${icon("info", 16)}<span><strong>Sample progress.</strong> These demonstration scores illustrate the reporting interface. They are not evidence of completed safety training.</span></div>` : ""}<section class="panel promotion-card mt-24"><header class="panel-head"><div><h2>Grow with us</h2><p>High performers can move into a trainer role.</p></div>${icon("trophy", 18)}</header><div class="panel-body">${promotion}</div></section><section class="panel"><header class="panel-head"><div><h2>Module-by-module progress</h2><p>Your next safe decision starts with awareness.</p></div>${icon("chart", 18)}</header><div class="panel-body"><div class="detail-modules">${p.modules.map((m) => `<div class="detail-module"><span class="module-small-icon">${icon(moduleMeta[m.key].icon)}</span><div><strong>${moduleMeta[m.key].short}</strong><small>${m.score === null ? "No assessment yet" : m.source === "demo" ? "Illustrative sample — not a completed assessment" : `${m.attempts} attempt${m.attempts === 1 ? "" : "s"} · ${formatDate(m.assessedAt)}`}</small></div><span style="margin-left:auto" class="score ${m.score === null ? "none" : m.score >= 85 ? "excellent" : m.score >= 70 ? "pass" : "fail"}">${m.score === null ? "—" : `${m.score}<small>/100</small>`}</span><span class="badge ${m.score === null ? "gray" : m.score >= 70 ? "green" : "amber"}">${m.classification}</span></div>`).join("")}</div><div class="info-callout mt-24">${icon("award", 17)}<span>Certificate eligibility requires <strong>70/100 or higher in all three modules</strong>. Below 70 means a retake. All three assessments are available now. Pass all three genuine assessments, then open Certificates to generate your completion PDF.</span></div></div></section><div class="progress-legend"><span><i></i>Excellent · 85–100</span><span><i class="blue"></i>Pass · 70–84</span><span><i class="amber"></i>Retake · below 70</span></div>${ratingHtml}`,
    mount(root) {
      // Star ratings (Play-Store style)
      root.querySelectorAll(".star-input").forEach((group) => {
        const buttons = [...group.querySelectorAll("[data-star]")];
        buttons.forEach((b) => {
          b.addEventListener("click", () => {
            const n = Number(b.dataset.star);
            buttons.forEach((x) =>
              x.classList.toggle("active", Number(x.dataset.star) <= n),
            );
            group.dataset.value = n;
          });
        });
      });
      root.querySelectorAll("[data-rate]").forEach((button) =>
        button.addEventListener("click", async () => {
          const key = button.dataset.rate;
          const group = root.querySelector(
            `.star-input[data-module="${key}"]`,
          );
          const comment = root
            .querySelector(`.rating-comment[data-module="${key}"]`)
            .value.trim();
          if (!group.dataset.value) {
            notify("Pick a star rating first (1–5).", "error");
            return;
          }
          busy(button, true, "Submitting…");
          try {
            await ctx.api.post("/ratings", {
              moduleKey: key,
              trainerId: group.dataset.trainer,
              stars: Number(group.dataset.value),
              comment,
            });
            notify("Thanks for rating your guide!");
            ctx.render();
          } catch (error) {
            notify(error.message, "error");
            busy(button, false);
          }
        }),
      );
      // Trainer application form
      const applyForm = root.querySelector("#trainer-apply-form");
      if (applyForm)
        applyForm.onsubmit = async (e) => {
          e.preventDefault();
          const button = applyForm.querySelector('[type="submit"]');
          busy(button, true, "Sending…");
          try {
            await ctx.api.post("/me/apply-trainer", {
              message: applyForm.message.value,
            });
            notify("Application sent to your administrator.");
            ctx.render();
          } catch (error) {
            formError(applyForm, error);
          } finally {
            busy(button, false);
          }
        };
    },
  };
}
function trainerApplyForm() {
  return `<form id="trainer-apply-form" class="mt-16"><div class="form-alert" hidden></div><div class="field"><label for="apply-message">WHY YOU'RE READY (optional)</label><textarea id="apply-message" name="message" rows="3" maxlength="600" placeholder="A short note for your administrator…"></textarea></div><div class="form-actions" style="justify-content:flex-start"><button class="btn btn-primary" type="submit">${icon("send", 15)}Apply for a trainer role</button></div></form>`;
}
function starsText(n) {
  const s = Math.round(n);
  return `<span class="star-row" aria-label="${s} out of 5 stars">${"★".repeat(s)}${"☆".repeat(5 - s)}</span>`;
}
async function rateTrainerPage(ctx) {
  const [training, own] = await Promise.all([
    ctx.api.get("/me/training"),
    ctx.api.get("/me/trainer-reports"),
  ]);
  const modulesWithTrainer = training.modules.filter((m) => m.trainer);
  const myRatings = Object.fromEntries(
    (training.myRatings || []).map((r) => [r.moduleKey, r]),
  );
  const ratingRows = modulesWithTrainer
    .map((m) => {
      const rated = myRatings[m.key];
      return `<div class="detail-module"><span class="module-small-icon">${icon(moduleMeta[m.key].icon)}</span><div><strong>${esc(m.title)}</strong><small>Guide: ${esc(m.trainer.nickname)}</small></div>${
        rated
          ? `<span style="margin-left:auto;display:flex;align-items:center;gap:10px">${starsText(rated.stars)}<span class="badge green">Rated</span></span>`
          : `<span style="margin-left:auto;display:flex;align-items:center;gap:10px"><span class="star-input" data-module="${m.key}" data-trainer="${m.trainer.id}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star${n === 1 ? "" : "s"}">${icon("star", 18)}</button>`).join("")}</span><button type="button" class="btn btn-primary btn-sm" data-rate="${m.key}">${icon("send", 13)}Submit</button></span>`
      }</div>`;
    })
    .join("");
  const selectOptions = modulesWithTrainer
    .map(
      (m) =>
        `<option value="${m.key}" data-trainer-id="${m.trainer.id}">${esc(m.title)} — ${esc(m.trainer.nickname)}</option>`,
    )
    .join("");
  const reportRows = own.reports
    .map(
      (r) => `<div class="detail-module"><span class="module-small-icon">${icon("alert")}</span><div><strong>${esc(r.trainer)}${r.moduleKey ? ` · ${moduleMeta[r.moduleKey]?.short || r.moduleKey}` : ""}</strong><small>${formatDate(r.createdAt)} — “${esc(r.message)}”</small></div><span style="margin-left:auto"><span class="badge ${r.status === "open" ? "amber" : "green"}">${r.status === "open" ? "Under review" : "Resolved"}</span></span></div>`,
    )
    .join("");
  return {
    title: "Rate trainer",
    html: `<div class="page-heading"><div><h1>Rate your trainers</h1><p>Tell us how each guide supported you — one rating per module, plus a report button if something went wrong.</p></div></div>
    <section class="panel"><header class="panel-head"><div><h2>Module ratings</h2><p>1 to 5 stars for each module's guide.</p></div>${icon("star", 18)}</header><div class="panel-body"><div class="detail-modules">${modulesWithTrainer.length ? ratingRows : empty("No guides assigned yet", "Your administrator has not assigned active trainers to the modules yet.", "trainer")}</div></div></section>
    <section class="panel mt-24"><header class="panel-head"><div><h2>Report a trainer</h2><p>Not getting the help you need? Send a report to your administrator.</p></div>${icon("alert", 18)}</header><div class="panel-body"><div class="info-callout">${icon("info", 17)}<span>Reports are read by your administrator, not the trainer. Use them when a guide is <strong>not helping effectively</strong> — or to say what worked well.</span></div><div style="margin-top:14px"><button type="button" class="btn btn-secondary" id="open-report" ${modulesWithTrainer.length ? "" : "disabled"}>${icon("alert", 14)}Report a trainer</button></div>${own.reports.length ? `<h3 style="font-size:13px;margin-top:22px">Your reports</h3><div class="detail-modules">${reportRows}</div>` : ""}</div></section>`,
    mount(root) {
      root.querySelectorAll(".star-input").forEach((group) => {
        const buttons = [...group.querySelectorAll("[data-star]")];
        buttons.forEach((b) =>
          b.addEventListener("click", () => {
            const n = Number(b.dataset.star);
            buttons.forEach((x) =>
              x.classList.toggle("active", Number(x.dataset.star) <= n),
            );
            group.dataset.value = n;
          }),
        );
      });
      root.querySelectorAll("[data-rate]").forEach((button) =>
        button.addEventListener("click", async () => {
          const key = button.dataset.rate;
          const group = root.querySelector(
            `.star-input[data-module="${key}"]`,
          );
          if (!group.dataset.value) {
            notify("Pick a star rating first (1–5).", "error");
            return;
          }
          busy(button, true, "Submitting…");
          try {
            await ctx.api.post("/ratings", {
              moduleKey: key,
              trainerId: group.dataset.trainer,
              stars: Number(group.dataset.value),
              comment: "",
            });
            notify("Thanks for rating your guide!");
            ctx.render();
          } catch (error) {
            notify(error.message, "error");
            busy(button, false);
          }
        }),
      );
      const openReport = root.querySelector("#open-report");
      if (openReport)
        openReport.addEventListener("click", () => {
          modal({
            title: "Report a trainer",
            subtitle: "Your administrator will review this report",
            content: `<form id="trainer-report-form" class="mt-16"><div class="form-alert" hidden></div><div class="field"><label for="report-module">WHICH MODULE?</label><select id="report-module" name="moduleKey">${selectOptions}</select><small>The guide for the selected module will be attached to the report.</small></div><div class="field"><label for="report-message">WHAT HAPPENED? <b>*</b></label><textarea id="report-message" name="message" rows="4" maxlength="600" required placeholder="e.g. I asked for help twice during the practical activity and did not get a response…"></textarea></div></form>`,
            footer: `<button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" form="trainer-report-form" type="submit">${icon("send", 14)}Send report</button>`,
          });
          const form = document.getElementById("trainer-report-form");
          form.onsubmit = async (e) => {
            e.preventDefault();
            const button = form.querySelector('[type="submit"]');
            busy(button, true, "Sending…");
            try {
              const selected = form.moduleKey.value;
              const trainerId =
                form.querySelector(
                  `#report-module option[value="${selected}"]`,
                )?.dataset.trainerId;
              await ctx.api.post("/me/trainer-reports", {
                trainerId,
                moduleKey: selected,
                message: form.message.value.trim(),
              });
              closeModal();
              notify("Report sent to your administrator.");
              ctx.render();
            } catch (error) {
              formError(form, error);
              busy(button, false);
            }
          };
        });
    },
  };
}
export async function employeePage(route, ctx) {
  const routeName = route.split("?")[0];
  const attemptId = new URLSearchParams(route.split("?")[1] || "").get(
    "attempt",
  );
  if (routeName === "/employee/module/manual-handling") {
    const { manualHandlingPage } = await import("./manual-handling.js");
    return manualHandlingPage(ctx, attemptId);
  }
  if (routeName === "/employee/module/working-at-height") {
    const { workingAtHeightPage } = await import("./working-at-height.js");
    return workingAtHeightPage(ctx, attemptId);
  }
  if (routeName === "/employee/module/hazard-perception") {
    const { hazardPerceptionPage } = await import("./hazard-perception.js");
    return hazardPerceptionPage(ctx, attemptId);
  }
  if (routeName === "/employee/fun-games") {
    const { funGamesPage } = await import("./fun-games.js");
    return funGamesPage(ctx);
  }
  if (route === "/employee/certificates") {
    const { certificatePage } = await import("./certificates.js");
    return certificatePage(ctx);
  }
  if (route === "/employee/settings") return settingsPage(ctx);
  if (route === "/employee/rate-trainer") return rateTrainerPage(ctx);
  const data = verifiedLearning(await ctx.api.get("/me/training"));
  if (route === "/employee/hub") return hub(ctx, data);
  if (route === "/employee/progress") return progress(ctx, data);

  return {
    title: "Page not found",
    html: `${empty("That page isn’t here", "Choose a page from the navigation to continue.", "help")}<div style="text-align:center"><a class="btn btn-primary" href="#/employee/hub">Back to training hub</a></div>`,
  };
}
