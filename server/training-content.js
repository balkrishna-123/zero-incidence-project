import { HAZARD_COURSE } from "./hazard-content.js";
// Assessment answers stay on the server. Only explicitly serialized fields are public.
// Original scenarios informed by the linked HSE guidance; not site authorization.
//
// MODULE JOURNEY FORMAT (journey-2026-v2)
// Each module is a three-level journey:
//   Introduction (virtual trainer) → Level 1 study → Quiz 1 → Level 2 → Quiz 2 →
//   Level 3 → Quiz 3 → Final result (average of all twenty-four question scores).
// Each level quiz has 8 questions and is passed when every one of them is
// answered correctly — with a 20-second time limit per question (a timeout
// counts as a wrong attempt). Each wrong attempt before the correct one
// reduces that question's score by 25, minimum 0.

export const COURSE_VERSION = "journey-2026-v2";
export const QUESTIONS_PER_LEVEL = 8;
export const LEVEL_COUNT = 3;
export const QUESTION_MAX = 100;
export const WRONG_ANSWER_PENALTY = 25;
export const QUESTION_TIME_LIMIT_SECONDS = 20;
export const PASS_MARK = 70;
export const REFERENCES = {
  manual: {
    title: "HSE · Manual handling at work",
    url: "https://www.hse.gov.uk/msd/manual-handling/index.htm",
  },
  technique: {
    title: "HSE · Good handling technique",
    url: "https://www.hse.gov.uk/msd/manual-handling/good-handling-technique.htm",
  },
  height: {
    title: "HSE · Working at height safely",
    url: "https://www.hse.gov.uk/work-at-height/introduction.htm",
  },
  ladders: {
    title: "HSE · Selecting and using ladders",
    url: "https://www.hse.gov.uk/work-at-height/ladders/when-how-to-use-ladders-safely.htm",
  },
  ladderChecks: {
    title: "HSE · Ladder pre-use checks",
    url: "https://www.hse.gov.uk/work-at-height/ladders/how-to-check-ladder-is-safe-before-use.htm",
  },
  warehouse: {
    title: "HSE · Warehousing and storage: Keep it safe",
    url: "https://www.hse.gov.uk/pubns/indg412.pdf",
  },
  fire: {
    title: "GOV.UK · Clear escape routes",
    url: "https://www.gov.uk/workplace-fire-safety-your-responsibilities/fire-safety-and-evacuation-plans",
  },
  traffic: {
    title: "HSE · Separating pedestrians and vehicles",
    url: "https://www.hse.gov.uk/workplacetransport/separating.htm",
  },
  trips: {
    title: "HSE · Preventing slips and trips",
    url: "https://www.hse.gov.uk/slips/preventing-overview.htm",
  },
  electrical: {
    title: "HSE · Electrical equipment safety",
    url: "https://www.hse.gov.uk/electricity/faq-portable-appliance-testing.htm",
  },
};
const options = (values) =>
  values.map((text, i) => ({ id: `choice-${i + 1}`, text }));
function question(id, prompt, choices, correct, explanation, reference, hint) {
  return {
    id,
    prompt,
    options: options(choices),
    correctId: `choice-${correct + 1}`,
    explanation,
    reference,
    hint,
  };
}
const boards = (items) =>
  items.map((item, i) => ({
    id: `board-${i + 1}`,
    ...item,
  }));
// Shared 360° room anchor points (the warehouse shell is 24 × 24 units).
// Key-point boards keep the original three spots; lesson boards (the study
// sections rendered inside the 360° view) use six spots around the room,
// clear of the racking (x ±9.8) and the pedestrian route (x ≈ 1.05).
const KEY_BOARD_SPOTS = [
  [-4.2, 0, -5.4],
  [4.6, 0, -3.2],
  [5.2, 0, 4.2],
];
const LESSON_BOARD_SPOTS = [
  [0, 0, -8.4],
  [-7.4, 0, -3.2],
  [-7.4, 0, 2.6],
  [3.8, 0, 8.4],
  [7.4, 0, 2.6],
  [7.4, 0, -6.6],
];
function studyBoardDefs(texts) {
  return boards(
    texts.map((text, i) => ({
      label: text.split("\n")[0],
      text,
      position: KEY_BOARD_SPOTS[i % KEY_BOARD_SPOTS.length],
    })),
  );
}
// One line per lesson board: the first sentence of the section, capped so it
// fits the board face. The full text opens in the click card.
function firstSentenceCap(body, cap = 90) {
  const end = body.indexOf(". ");
  let line = end > 0 ? body.slice(0, end + 1) : body;
  if (line.length > cap) line = `${line.slice(0, cap - 1).replace(/[\s,;]+$/, "")}…`;
  return line;
}
// Derive the in-scene lesson boards from a level's study sections.
function lessonBoardDefs(level) {
  return (level.study.sections || []).map((s, i) => ({
    id: `lesson-${i + 1}`,
    kind: "lesson",
    label: s.title,
    text: `${s.title}\n${firstSentenceCap(s.body)}`,
    body: s.body,
    position: LESSON_BOARD_SPOTS[i % LESSON_BOARD_SPOTS.length],
  }));
}
const NOTICE =
  "Educational prototype based on HSE guidance. Follow local law and your company’s assessed procedures. Completion does not authorise practical work; content needs workplace safety review.";

export const COURSES = {
  "hazard-perception": HAZARD_COURSE,
  "manual-handling": {
    key: "manual-handling",
    title: "Manual Handling",
    zone: "Dispatch bay",
    color: "mint",
    subtitle: "A safer move starts before the lift.",
    description:
      "Prepare an automotive-parts shipment. Learn to assess, plan, support and lift safely across three levels.",
    intro: {
      about:
        "Manual handling means moving or supporting a load by hand or body force — lifting, lowering, carrying, pushing, pulling or holding. Most warehouse back, shoulder and arm problems start with handling that was never thought through first. In this module your guide will show you how to assess a move before it happens, choose the equipment that removes the risk, and use safe technique when a lift is genuinely unavoidable.",
      learn: [
        "Why most handling injuries happen — and why assessment, not strength, prevents them",
        "The TILE method: Task, Individual, Load and Environment",
        "How to plan a move: route, destination and when to ask for help",
        "Choosing trolleys and aids so your back does the least possible work",
        "Safe lifting technique when a lift is genuinely unavoidable",
      ],
    },
    references: ["manual", "technique", "warehouse"],
    levels: [
      {
        key: "level-1",
        title: "Know before you lift",
        summary:
          "The basics: what manual handling really means and why we assess before we move.",
        study: {
          intro:
            "Start with the big idea: almost every handling injury is a planning problem, not a strength problem.",
          sections: [
            {
              title: "What counts as manual handling?",
              body: "Any task where you move or support a load by hand or body force: lifting boxes, carrying parts, pushing a trolley, pulling a load, holding an awkward shape, or repeated small lifts from a bench. Even “light” tasks can cause injury when they are repeated, rushed or done in a tight space.",
            },
            {
              title: "Why assessment comes before strength",
              body: "Few injuries come from one heroic lift. Most come from repetitive, unplanned handling. The first control is to avoid hazardous handling where reasonably practicable — no load, no lift. Only when it cannot be avoided do we assess and reduce the risk.",
            },
            {
              title: "Meet TILE",
              body: "TILE is the short checklist for every move: Task (distance, twisting, repetition), Individual (strength, health, training), Load (weight, shape, centre of gravity, contents) and Environment (route, floor space, lighting, temperature). A move is only safe when all four accept it.",
            },
            {
              title: "How much is too much?",
              body: "There is no universal safe weight. Ten kilograms is not safe for everyone, and a light box can be dangerous on a long, twisting route. When in doubt, assess it — and when it is heavy, awkward or far, get help or equipment instead.",
            },
          ],
          boards: studyBoardDefs([
            "ASSESS FIRST\nCheck before you carry",
            "TILE\nTask · Individual\nLoad · Environment",
            "NO FIXED SAFE WEIGHT\nAssess the whole job",
          ]),
        },
        questions: [
          question(
            "mh-q1",
            "What is the first approach to hazardous manual handling?",
            [
              "Avoid the hazardous operation where reasonably practicable.",
              "Teach lifting technique and leave the task unchanged.",
              "Choose the strongest employee.",
            ],
            0,
            "Avoid hazardous manual handling first. If it cannot be avoided, assess and reduce the risk.",
            "manual",
            "Think about the order of risk control. What would you do before choosing any person or any technique?",
          ),
          question(
            "mh-q2",
            "Which set of factors should be considered before handling a load?",
            [
              "Only its weight and colour.",
              "The task, load, working environment and individual capability.",
              "Only how quickly the task can be finished.",
            ],
            1,
            "A useful assessment considers the task, load, working environment and individual capability; weight is only one factor.",
            "warehouse",
            "Remember the TILE checklist — which four letters make it up?",
          ),
          question(
            "mh-q3",
            "Does one fixed weight guarantee that a load is safe for everybody to lift?",
            [
              "Yes, if the label says it is light.",
              "Yes, as long as two hands are used.",
              "No. The whole task and the individual must be assessed.",
            ],
            2,
            "There is no universal safe lifting weight. Shape, reach, repetition, route and individual capability also affect risk.",
            "manual",
            "The same box can be fine on a clear bench and dangerous on a long twisting route. What single number can never guarantee safety?",
          ),
          question(
            "mh-q10",
            "Which of these is an example of manual handling?",
            [
              "Holding a phone to your ear while you stand at a bench.",
              "Pushing a trolley, carrying a box or lowering a load.",
              "Reviewing paperwork while seated at a desk.",
            ],
            1,
            "Manual handling covers moving or supporting a load by hand or body force: lifting, lowering, carrying, pushing, pulling or holding.",
            "manual",
            "It is not only about lifting — what else does it cover?",
          ),
          question(
            "mh-q11",
            "Why can a “light” task still cause a handling injury?",
            [
              "Light boxes are usually slippery.",
              "Light tasks are often repeated many times, and the small strains add up.",
              "Light tasks cannot cause injuries.",
            ],
            1,
            "Repetition, rushing and tight spaces turn small efforts into cumulative load on the back and joints.",
            "manual",
            "Think about doing the same light lift forty times in an hour — what adds up?",
          ),
          question(
            "mh-q12",
            "In the TILE checklist, what does the “T” stand for?",
            ["Temperature", "Task", "Training"],
            1,
            "Task covers the distances, twisting, reach and repetition involved in the handling.",
            "manual",
            "T — I — L — E. Which letter asks about distance, twisting and repetition?",
          ),
          question(
            "mh-q13",
            "Before carrying a box across the warehouse, what should you check first?",
            [
              "The route, the destination and the floor between them.",
              "Only the label on the box.",
              "How many boxes are left in the tray.",
            ],
            0,
            "The environment belongs to the assessment: clear the route, confirm the destination and check the floor before the first lift.",
            "warehouse",
            "Remember the “E” in TILE — what must the environment accept?",
          ),
          question(
            "mh-q14",
            "Which task most clearly needs assessment before anyone starts?",
            [
              "Repeatedly moving awkward automotive parts from a bench all shift.",
              "Picking up a pen from a desk.",
              "Opening and closing a single door.",
            ],
            0,
            "Repetition and awkwardness are the classic indicators that a move should be assessed and controlled before it starts.",
            "manual",
            "Which clues — weight, repetition or awkwardness — make a task need an assessment?",
          ),
        ],
      },
      {
        key: "level-2",
        title: "Plan the move",
        summary:
          "Applying TILE to a real warehouse move: route, destination, repetition and asking for help.",
        study: {
          intro:
            "Assessment only works when it changes what you do. This level turns TILE into a plan for an actual shipment.",
          sections: [
            {
              title: "Plan before you pick up",
              body: "Before any handling: where is the load going, what is the full route, and what is in the way? Check doorways, gradients, vehicle crossings and the destination. Planning before handling is what separates a safe move from a risky one.",
            },
            {
              title: "The route matters as much as the lift",
              body: "Pedestrian routes, forklift lanes, floor condition, lighting and turning space all belong to the task. Carrying a load is never a reason to enter a vehicle route or step over an obstruction.",
            },
            {
              title: "Repetitive handling",
              body: "Forty light boxes in an hour is not forty easy lifts — it is one task of high repetition. Repetitive handling is assessed as a whole: rotation, breaks, mechanical aids and task redesign all reduce the cumulative risk.",
            },
            {
              title: "When to ask for help",
              body: "If the load is beyond your capability, awkward, heavy, or the carry is long or the space tight, get suitable advice, assistance or equipment. A two-person lift needs an agreed method: one person coordinates, both keep the load close.",
            },
            {
              title: "A destination that works",
              body: "The destination should be prepared: a stable surface at a sensible height, where the load will not be obstructing anyone. Put the load down before fine positioning — never hold it out and nudge it into place.",
            },
          ],
          boards: studyBoardDefs([
            "PLAN THE ROUTE\nCheck before you carry",
            "ASK FOR HELP\nHeavy · awkward · long carry",
            "PREPARE THE DESTINATION\nPut down, then position",
          ]),
        },
        questions: [
          question(
            "mh-q7",
            "When should the route and destination be checked?",
            [
              "Before starting the handling operation.",
              "Only after the load has been picked up.",
              "Only if another person complains.",
            ],
            0,
            "Think before handling: plan where the load will go and remove obstructions first.",
            "technique",
            "Would you prefer to check the route before the lift, or after you have already picked the load up?",
          ),
          question(
            "mh-q4",
            "A load feels beyond your capability. What should you do?",
            [
              "Stop and get suitable advice, assistance or equipment.",
              "Lift quickly so the effort ends sooner.",
              "Try once before asking anyone.",
            ],
            0,
            "Do not handle more than you can manage safely. Get advice or help when in doubt.",
            "technique",
            "Pride has not prevented a single injury. What should happen the moment a load feels beyond you?",
          ),
          question(
            "mh-q8",
            "You must move 40 light boxes in an hour — each well within your capability. What is the safest view of this task?",
            [
              "Each box is light, so there is no problem.",
              "Repeated handling is a risk in itself; the whole task should be assessed and controlled, for example with rotation, breaks or an aid.",
              "Finish as quickly as possible so the effort ends.",
            ],
            1,
            "High repetition changes the risk even when each lift is light. Control the task as a whole: rotate the work, plan breaks, use an aid where suitable.",
            "warehouse",
            "Think about the whole job, not one box. What does “40 times in a row” do to a back?",
          ),
          question(
            "mh-q15",
            "You have a long carry from the dock to the picking bay. What is the best first control?",
            [
              "Lift with a perfectly straight back.",
              "Use a trolley or other suitable aid for the carry.",
              "Carry two boxes at once to halve the number of trips.",
            ],
            1,
            "For a long carry, equipment removes the manual handling — good technique cannot substitute for removing the task.",
            "technique",
            "A long carry is a planning problem. What removes the carry entirely?",
          ),
          question(
            "mh-q16",
            "A two-person lift is agreed for a heavy drum. Who should coordinate it?",
            [
              "Either person, independently.",
              "A nominated leader who calls the lift so both people move together.",
              "The supervisor, from across the floor.",
            ],
            1,
            "Two-person handling needs an agreed method: one person coordinates, both keep the load close and move as one.",
            "technique",
            "Two people lifting — how do they make sure both bend at the same moment?",
          ),
          question(
            "mh-q17",
            "The destination bench is at the wrong height, so you would have to hold the load while squeezing it into place. What should you do?",
            [
              "Hold it out and nudge it in quickly.",
              "Put the load down, prepare a destination at a sensible height, then position it.",
              "Stack it on the floor and slide it later.",
            ],
            1,
            "Set the load down before fine positioning — never hold a load out while you adjust it into place.",
            "technique",
            "You set it down before you position it — always. What does that prevent?",
          ),
          question(
            "mh-q18",
            "A load is heavy, but within your capability, the route is clear and the carry is short. Is a two-person lift automatically required?",
            [
              "No — the full TILE assessment decides; a solo lift may be suitable.",
              "Yes — any heavy load always needs two people.",
              "Only if it is a drum.",
            ],
            0,
            "There is no “heavy = two people” rule. The assessment of task, individual, load and environment determines the right method.",
            "manual",
            "Is there a magic weight that forces two people — or does the assessment decide?",
          ),
          question(
            "mh-q19",
            "Why should you check for vehicle crossings on your carrying route?",
            [
              "Carrying a load is never a reason to enter a vehicle route — crossings need a safe method and control.",
              "Vehicles make the load feel heavier.",
              "There is no connection between vehicles and manual handling.",
            ],
            0,
            "Pedestrians carrying loads have the least freedom of movement. Vehicle crossings are a task risk that planning must control.",
            "traffic",
            "Which person on the floor has the least freedom to move out of the way of a forklift?",
          ),
        ],
      },
      {
        key: "level-3",
        title: "Technique and aids",
        summary:
          "When a lift is genuinely needed: technique that protects you — and the aids that remove the need.",
        study: {
          intro:
            "Technique is the last line of defence. The best outcome is a move where the person does nothing heavy at all.",
          sections: [
            {
              title: "First choice: no lift at all",
              body: "A trolley, hoist, conveyor or mechanical aid can remove the manual handling entirely. A suitable aid beats good technique — technique only helps when a lift is genuinely unavoidable.",
            },
            {
              title: "Choosing an aid",
              body: "The aid must be rated for the load, in good working order (wheels, brakes, handles), and you must be trained to use it. Equipment that introduces a new risk — a broken wheel, an overloaded deck — is worse than none.",
            },
            {
              title: "When you must lift: the setup",
              body: "Keep the load as close to the body as possible, start from a low stable position, use a solid footing, clear the route, and brace. Avoid jerking and sudden stops; move smoothly.",
            },
            {
              title: "Moving and turning",
              body: "Change direction by moving your feet, not by twisting your back under load. Keep the load close, take a step, turn the body. A twist with a load out front is the classic back injury.",
            },
            {
              title: "Setting down safely",
              body: "Put the load down in a controlled way on a prepared surface, then adjust its position. Do not hold it extended while positioning it, and never leave it obstructing a route.",
            },
            {
              title: "Stop rules",
              body: "Pain, loss of grip, a changing route or a surprised load are all reasons to stop and reassess. Stopping is a good safety habit, not a failure — you can always ask for help.",
            },
          ],
          boards: studyBoardDefs([
            "AID FIRST\nA trolley beats\na hero lift",
            "KEEP IT CLOSE\nTurn with your feet",
            "STOP RULE\nPain · lost grip\n= stop and reassess",
          ]),
        },
        questions: [
          question(
            "mh-q5",
            "When an assessed manual lift is appropriate, how should you change direction?",
            [
              "Twist your back while keeping the feet still.",
              "Move your feet and keep the load close.",
              "Lean sideways with the load extended.",
            ],
            1,
            "Moving your feet is preferable to twisting and lifting at the same time.",
            "technique",
            "Which should do the turning — your feet, or your back?",
          ),
          question(
            "mh-q6",
            "Is good lifting technique a substitute for a suitable handling aid?",
            [
              "Always.",
              "Only for experienced workers.",
              "No. Technique is an additional measure, not a replacement for risk reduction.",
            ],
            2,
            "Good technique complements task design, suitable equipment and other risk controls.",
            "technique",
            "Can a perfect squat make a 30 kg awkward load safe? Remember the order of controls.",
          ),
          question(
            "mh-q9",
            "While carrying a box it hides your feet, and the route ahead is partly blocked. What should you do?",
            [
              "Hold it higher so you can see over it.",
              "Set it down safely before walking, then move or clear the obstruction and continue.",
              "Carry on and step carefully around it.",
            ],
            1,
            "A load that hides your feet removes your balance and your sight of the route. Set it down before moving; remove the obstruction through the site procedure.",
            "technique",
            "If a load hides your feet, what is the first thing to do with the load?",
          ),
          question(
            "mh-q20",
            "A 20 kg part must be transferred between two benches many times a day. Which aid best matches the job?",
            [
              "A trolley with a tilting tray for the short, repeated transfer.",
              "A stronger colleague for every transfer.",
              "Splitting each part into two halves by hand.",
            ],
            0,
            "Repeated transfers call for repeated, easy mechanics — a suitable aid is matched to the task, not improvised per lift.",
            "technique",
            "Repeated short transfers — what equipment makes every single one of them easy?",
          ),
          question(
            "mh-q21",
            "Before using a handling aid, what must be true of it?",
            [
              "It is rated for the load, in good working order, and you are trained to use it.",
              "It is the newest model the company owns.",
              "It has been used by at least one person before.",
            ],
            0,
            "Capability, condition and competence: an aid that is overloaded, broken or unfamiliar creates a new risk.",
            "technique",
            "Three requirements — capability, condition and competence. Can any one of them be missing?",
          ),
          question(
            "mh-q22",
            "When you must lift, how should the lift start?",
            [
              "From as high a position as you can reach, to save effort.",
              "From a low stable position, the load close to your body, on solid footing.",
              "In the air, if a colleague tosses it to you.",
            ],
            1,
            "Close, low and stable — then move smoothly without jerking. The setup is what protects the back.",
            "technique",
            "Three words: close, low and… what?",
          ),
          question(
            "mh-q23",
            "Your grip slips in the middle of a lift. What is the safe action?",
            [
              "Hold on with everything you have, whatever it takes.",
              "Let the load down in a controlled way and reassess before continuing.",
              "Twist your body sharply to recover the grip.",
            ],
            1,
            "A lost grip is a stop rule: pain, loss of grip or a changing route all mean stop and reassess.",
            "technique",
            "Pain, a changing route — and a lost grip. What do all three mean you should do?",
          ),
          question(
            "mh-q24",
            "Which is the strongest statement about lifting technique?",
            [
              "Perfect technique removes the need to assess the task.",
              "Technique protects you when a lift is genuinely unavoidable — after avoidance, planning and aids have been considered.",
              "Technique matters only for loads above 20 kg.",
            ],
            1,
            "Technique is the last layer of control. Avoid first, plan and use aids second, technique when a lift is genuinely needed.",
            "manual",
            "Where does technique sit in the order of controls — first or last?",
          ),
        ],
      },
    ],
  },
  "working-at-height": {
    key: "working-at-height",
    title: "Working at Height",
    zone: "Maintenance zone",
    color: "blue",
    subtitle: "The safest step may be staying on the ground.",
    description:
      "Prepare a maintenance area without rushing into a climb. Learn the hierarchy, equipment checks and the planning that keeps people safe at height.",
    intro: {
      about:
        "Working at height is any work where a person could fall and be injured — ladders, platforms, racking, rooflights, maintenance tasks. In this module your guide will walk you through the hierarchy that controls fall risk, the checks that access equipment must pass, and the planning that protects the people working above and below.",
      learn: [
        "Why even a short fall counts — and what “working at height” really includes",
        "The hierarchy: avoid → prevent → minimise",
        "Choosing and checking access equipment (ladders, platforms, MEWPs)",
        "Edge protection, fragile surfaces and the people below",
        "Competence, planning and stopping when something is not right",
      ],
    },
    references: ["height", "ladders", "ladderChecks", "warehouse"],
    levels: [
      {
        key: "level-1",
        title: "Height awareness",
        summary:
          "What counts as work at height, and the three-step hierarchy that controls it.",
        study: {
          intro:
            "Before any equipment is chosen, the first question is always whether the height can be avoided altogether.",
          sections: [
            {
              title: "What is working at height?",
              body: "Any place where a person could fall a distance and be injured — including falls to a lower level and falls through fragile surfaces such as rooflights. Getting to and from the work also counts as work at height.",
            },
            {
              title: "Short falls count too",
              body: "There is no universal minimum height. A 1.5 m fall onto concrete can break a leg; a fall onto machinery can be far worse. Ask “could this fall cause injury?” — not “is it high enough?”",
            },
            {
              title: "The hierarchy",
              body: "Step 1 — AVOID: can the task be done from the ground with a suitable method? Step 2 — PREVENT: if height is unavoidable, use a safe workplace or suitable equipment; think protection for everyone (guardrails) before personal systems. Step 3 — MINIMISE: if risk remains, reduce the distance and consequences; specialist fall-arrest needs competent selection, training and rescue planning.",
            },
            {
              title: "The pallet rule",
              body: "Never use a pallet on forklift forks as a working platform, and never climb storage racking as a staircase. These are among the most common serious fall scenarios in warehousing — the guidance on both is absolute.",
            },
          ],
          boards: studyBoardDefs([
            "AVOID FIRST\nCan it be done\nfrom the ground?",
            "SHORT FALLS COUNT\n1.5 m can break a leg",
            "NEVER A PALLETON FORKLIFT FORKS",
          ]),
        },
        questions: [
          question(
            "wh-q6",
            "A person could fall a short distance and be injured. Is the fall risk worth assessing?",
            [
              "No; only very high work matters.",
              "Only when a ladder is used.",
              "Yes. A fall capable of injury can matter even at a low level.",
            ],
            2,
            "Work at height is not defined by a universal minimum height; consider whether a fall could cause injury.",
            "height",
            "Is there a “safe height” below which falls simply do not matter?",
          ),
          question(
            "wh-q1",
            "What is the preferred order for controlling work-at-height risk?",
            [
              "Harness, ladder, then risk assessment.",
              "Avoid height, prevent falls, then minimise remaining fall consequences.",
              "Climb first, inspect later.",
            ],
            1,
            "Use the hierarchy: avoid work at height; if unavoidable, prevent falls; if risk remains, minimise distance and consequences.",
            "height",
            "Three steps, in order. Which comes first — a harness, or not going up at all?",
          ),
          question(
            "wh-q3",
            "Can an ordinary pallet on forklift forks be used as a work platform?",
            [
              "Yes, if the task is quick.",
              "Yes, if the operator is careful.",
              "No. Use suitable, properly selected access equipment.",
            ],
            2,
            "HSE warehouse guidance says never use pallets on forklift trucks for access to work at height or as working platforms.",
            "warehouse",
            "The warehouse guidance on standing on a pallet on the forks is absolute. What is the answer?",
          ),
          question(
            "wh-q10",
            "Which of these is an example of working at height?",
            [
              "Changing a light fitting three metres up on a beam.",
              "Sitting at a desk reviewing paperwork.",
              "Walking across a level, dry floor.",
            ],
            0,
            "The test is simple: could a person fall a distance and be injured? If so, it is work at height.",
            "height",
            "The test is not the height — it is the fall. Which task fails that test?",
          ),
          question(
            "wh-q11",
            "Why does travelling to and from the work count as working at height?",
            [
              "Because travel time is paid time.",
              "Because people fall when climbing up to, and down from, the task — not only while working.",
              "It does not count as work at height.",
            ],
            1,
            "Getting to and from the work is part of the task. Climb-in and climb-out are when many falls actually happen.",
            "height",
            "When do most access falls happen — while working, or on the way up and down?",
          ),
          question(
            "wh-q12",
            "Which fall scenario is among the most common serious ones in warehousing?",
            [
              "Falls from forklift forks or storage racking used as access.",
              "Falls through open office windows.",
              "Falls from a stepladder in a carpeted room.",
            ],
            0,
            "Warehouse guidance is absolute: never use pallets on forklift forks, and never climb racking. Both cause serious falls.",
            "warehouse",
            "Warehouse guidance is absolute about two things. What are they?",
          ),
          question(
            "wh-q13",
            "A light fitting needs a five-minute swap, three metres up. What is the first question you should ask?",
            [
              "Which ladder should I use?",
              "Can it be done from the ground with a suitable tool or method?",
              "Who can hold the ladder?",
            ],
            1,
            "Step 1 of the hierarchy is avoid: look for a ground-level method before any access equipment is chosen.",
            "height",
            "Three steps of the hierarchy — which word comes first?",
          ),
          question(
            "wh-q14",
            "Which surface is classed as fragile?",
            ["A load-bearing steel beam", "A rooflight panel", "A concrete floor"],
            1,
            "Rooflights and unassessed roof panels can look solid and fail instantly — they are fragile surfaces.",
            "height",
            "It can look solid and fail the moment you step on it. What is it?",
          ),
        ],
      },
      {
        key: "level-2",
        title: "Access and equipment",
        summary:
          "Choosing the right equipment, checking it before use, and the competence rules around it.",
        study: {
          intro:
            "Equipment is only safe when it is suitable for the task and in good condition — and used by people who are allowed to use it.",
          sections: [
            {
              title: "Choosing access equipment",
              body: "Ladder, step ladder, platform, mobile elevated work platform (MEWP): the choice follows the risk assessment — duration of the task, what must be carried, edge conditions and the surface. A short task is not automatically a ladder task.",
            },
            {
              title: "Pre-use checks",
              body: "Check rungs, steps, locks, feet and overall condition before every use. If anything is damaged: do not use it. Tag it, report it and remove it from service through the site procedure. A helper holding a ladder does not fix a damaged rung.",
            },
            {
              title: "Ladders in practice",
              body: "Where a ladder is genuinely suitable: secure it, stand it at the correct angle, extend it above the landing, keep three points of contact, and never overreach. Ladders remain a fallback for short tasks, not a default.",
            },
            {
              title: "Competence is not confidence",
              body: "Work at height must be carried out by people with the required skills, knowledge and experience, trained and authorised under the work plan, with appropriate supervision. Confidence alone is not one of the three.",
            },
            {
              title: "Racking is storage, not a staircase",
              body: "Climbing storage racking is a common cause of serious falls in warehouses. Use the access arrangements provided for the task — racking is designed to hold loads, not people.",
            },
          ],
          boards: studyBoardDefs([
            "CHECK BEFORE YOU CLIMB\nRungs · locks · feet\n· damage",
            "3-POINT CONTACT\nSecure · angle\n· above the landing",
            "DAMAGED = OUT\nTag it. Report it.",
          ]),
        },
        questions: [
          question(
            "wh-q4",
            "What should happen after a pre-use check finds damage to a ladder?",
            [
              "Use it only for a low step.",
              "Stop using it and follow the reporting/removal-from-service procedure.",
              "Cover the defect with tape.",
            ],
            1,
            "Damaged equipment is not made safe by a shorter task or improvised repair. Obtain suitable equipment.",
            "ladderChecks",
            "A colleague holding a damaged ladder does not repair the rung. What is the right move?",
          ),
          question(
            "wh-q8",
            "A task will take only a few minutes. Is that enough to decide a ladder is suitable?",
            [
              "Yes, short jobs are always safe on ladders.",
              "No. Assess the risk, equipment and conditions before selecting access equipment.",
              "Yes, if a colleague is nearby.",
            ],
            1,
            "Short duration alone does not make a ladder appropriate. Risk must be considered first, including whether higher-protection equipment is justified.",
            "ladders",
            "Duration is only one factor. What must happen before you pick the equipment?",
          ),
          question(
            "wh-q5",
            "Who should undertake the work with the selected equipment?",
            [
              "People with suitable competence, training and authorisation under the work plan.",
              "Anyone who is confident.",
              "Whoever is available first.",
            ],
            0,
            "Confidence alone is not competence. Planning, supervision and suitable skills, knowledge and experience are required.",
            "height",
            "Confidence is not one of the required three. What are the real requirements?",
          ),
          question(
            "wh-q15",
            "A ladder could reach a six-metre platform, but the installation job will take three hours and involves carrying materials up. What should the assessment prioritise?",
            [
              "A longer, sturdier ladder.",
              "Higher-protection equipment such as a MEWP or platform — duration and load change the choice.",
              "A strict time limit on the ladder use.",
            ],
            1,
            "Duration, what must be carried, edges and surface all shape the equipment choice. A ladder is a fallback for short tasks, not the default for a three-hour job.",
            "ladders",
            "Duration and carried load are factors in the choice. Which equipment earns its keep on a long task?",
          ),
          question(
            "wh-q16",
            "On a ladder, what does “three points of contact” mean?",
            [
              "Two hands and one foot, or two feet and one hand, on the ladder at all times.",
              "Three people must be nearby at all times.",
              "The ladder must touch three walls.",
            ],
            0,
            "Three points of contact keeps the climb stable: always two hands and one foot, or two feet and one hand.",
            "ladders",
            "Count your hands and feet on the ladder — how many must be in contact?",
          ),
          question(
            "wh-q17",
            "A step ladder’s lock is broken, but the task is a small 30-second job. Is it safe to use?",
            [
              "Yes, for such a short task.",
              "No — damaged equipment is out of service: tag it, report it and obtain suitable equipment.",
              "Yes, if a helper holds the base.",
            ],
            1,
            "A helper does not fix a broken lock. Damaged equipment is tagged, reported and removed from service through the procedure.",
            "ladderChecks",
            "Does a helpful colleague repair a broken lock?",
          ),
          question(
            "wh-q18",
            "What does “never overreach” mean in practice?",
            [
              "If you must lean sideways to work, you are overreaching — reposition instead.",
              "Do not look sideways while you climb.",
              "Keep every ladder under three metres.",
            ],
            0,
            "Leaning away from the ladder’s centreline shifts your balance outside the base — move the ladder and climb again.",
            "ladders",
            "If you have to lean to reach the work, where is the problem?",
          ),
          question(
            "wh-q19",
            "A MEWP has a valid inspection label, but its tyres are clearly under-inflated. Can you use it?",
            [
              "Yes — the inspection label covers everything.",
              "No — a pre-use check of the current condition is required; report the defect before use.",
              "Yes, as long as the surface is flat.",
            ],
            1,
            "The label dates a past inspection; your pre-use check judges today’s condition. A defect found now means the equipment stops.",
            "ladderChecks",
            "The label speaks about the past. What speaks about today?",
          ),
        ],
      },
      {
        key: "level-3",
        title: "Planning real work",
        summary:
          "Edge protection, fragile surfaces, the people below — and the plan that lets you stop when something is wrong.",
        study: {
          intro:
            "The final level is where planning meets reality: protecting everyone above, at and below the work.",
          sections: [
            {
              title: "Edge protection first",
              body: "Prevent falls with collective protection — guardrails and safe workplaces — before personal protection. A harness does not replace a safe place to work; it is the last layer, and only with competent selection and rescue arrangements.",
            },
            {
              title: "Fragile surfaces",
              body: "Rooflights and unassessed roofs can look solid and fail instantly. Never assume a surface is load-bearing. Keep off it, and have it assessed under the work plan with specific precautions if access is genuinely required.",
            },
            {
              title: "The people below",
              body: "Plan for falling objects: cordon the area, use barriers or canopies where suitable, set an alternative pedestrian route, and control the timing of the work below. A warning “if something falls” is not a control.",
            },
            {
              title: "The work plan and rescue",
              body: "Before work at height: method, equipment, supervision and a rescue arrangement — if someone falls or is injured at height, how do you get them to safety? Urgent jobs still need a plan; urgency is not a control measure.",
            },
            {
              title: "Stop authority",
              body: "Everyone can stop unsafe work at height and escalate to the supervisor. The equipment, the surface or the person below not ready are all valid reasons to wait. Stopping is a control, not a delay.",
            },
            {
              title: "Equipment checks before every use",
              body: "Inspect each piece of access or fall-arrest equipment before use: look for corrosion, worn or frayed webbing, damaged buckles and a valid inspection label. Defect it and take it out of service — report it, tag it, and never improvise a repair. A harness that fails is the last, only thing standing between you and the ground.",
            },
          ],
          boards: studyBoardDefs([
            "GUARDRAILS BEFORE\nA HARNESS",
            "ROOFLIGHTS ARE FRAGILE\nKeep off — keep clear",
            "CORDON THE AREA\nbelow the work",
          ]),
        },
        questions: [
          question(
            "wh-q2",
            "Which is an example of collective protection?",
            [
              "Suitable guardrails protecting everyone on a platform.",
              "One person remembering not to approach an edge.",
              "A high-visibility vest.",
            ],
            0,
            "Guardrails are collective protection: effectiveness does not depend on each person attaching equipment.",
            "height",
            "Which protection still works even if one person forgets to attach anything?",
          ),
          question(
            "wh-q9",
            "A rooflight has not been assessed as load-bearing. Can you assume it is safe to stand on?",
            [
              "Yes, if the task is quick.",
              "No. Keep off it and have the surface and protective measures assessed under the work plan.",
              "Yes, if you wear a hard hat.",
            ],
            1,
            "Do not assume a roof or rooflight can support a person. Fragile surfaces need specific precautions and competent planning; a hard hat does not prevent a fall through a surface.",
            "height",
            "Would a hard hat keep you safe on an unassessed rooflight? Think about what a hard hat actually prevents.",
          ),
          question(
            "wh-q7",
            "What else must be considered when planning work above other people?",
            [
              "Only the worker’s speed.",
              "Falling objects, access restrictions and emergency arrangements.",
              "Only the colour of the platform.",
            ],
            1,
            "Protect people from falling objects and consider evacuation and rescue as part of planning.",
            "height",
            "Think about everything that could fall — and the people under the work. What does the plan need to cover?",
          ),
          question(
            "wh-q20",
            "Competent selection of fall-arrest equipment also requires what before anyone is tied in?",
            [
              "Training for the user and a rescue plan for if someone falls.",
              "Only a hard hat.",
              "Nothing else — the equipment is enough.",
            ],
            0,
            "Fall-arrest is the last layer: it needs competent selection, training, and a rescue arrangement so a suspended person is brought to safety.",
            "height",
            "If someone falls and hangs suspended, what happens in the next five minutes?",
          ),
          question(
            "wh-q21",
            "During the job the wind picks up and a lightweight platform starts to feel lively. What is the right call?",
            [
              "Finish quickly before it gets worse.",
              "Stop and reassess against the plan — stopping is a control, not a failure.",
              "Hold on tighter and continue.",
            ],
            1,
            "Everyone has stop authority. Conditions that differ from the plan are a valid reason to wait, reassess and escalate.",
            "height",
            "The plan assumed calm conditions. What do you do with your stop authority?",
          ),
          question(
            "wh-q22",
            "People must pass below your platform while you are working. What control should already be in place?",
            [
              "A cordon or barrier with an alternative route, set before work starts.",
              "A loud warning if someone appears.",
              "Working faster to finish sooner.",
            ],
            0,
            "Falling objects are planned for in advance: cordon, barriers or canopies where suitable, and a controlled route below. A warning is not a control.",
            "height",
            "A warning works “if something falls.” What works before it happens?",
          ),
          question(
            "wh-q23",
            "Which of these is a personal — not collective — fall protection measure?",
            [
              "Guardrails around the platform edge.",
              "A safety harness and lanyard, correctly used by the wearer.",
              "A safety net installed below the platform.",
            ],
            1,
            "Personal protection works only if that person uses it correctly every time; guardrails and nets protect everyone regardless.",
            "height",
            "Which protection still works even if one person forgets to attach anything?",
          ),
          question(
            "wh-q24",
            "What must a rescue arrangement for work at height cover?",
            [
              "How a fallen or injured person is reached and brought to safety without further delay.",
              "The break rota for the crew.",
              "The serial number of the access equipment.",
            ],
            0,
            "If someone falls or is injured at height, the plan says how they are recovered — before the work starts, not after the incident.",
            "height",
            "Urgent jobs still need a plan. What does the plan promise if someone is injured at height?",
          ),
        ],
      },
    ],
  },
};
// Attach the in-scene lesson boards to every level (all three modules).
for (const c of Object.values(COURSES))
  for (const l of c.levels) l.study.lessonBoards = lessonBoardDefs(l);

export const AVAILABLE_MODULE_KEYS = Object.freeze(Object.keys(COURSES));
export function courseOverview(key) {
  const c = COURSES[key];
  if (!Object.hasOwn(COURSES, key)) return null;
  return {
    key: c.key,
    title: c.title,
    zone: c.zone,
    color: c.color,
    subtitle: c.subtitle,
    description: c.description,
    intro: c.intro,
    levels: c.levels.map((l) => ({
      key: l.key,
      title: l.title,
      summary: l.summary,
      // Study material is public; question answers and hints are not.
      study: {
        intro: l.study.intro,
        sections: l.study.sections.map((s) => ({
          title: s.title,
          body: s.body,
        })),
        boards: l.study.boards.map((b) => ({
          label: b.label,
          text: b.text,
          position: b.position,
        })),
        lessonBoards: (l.study.lessonBoards || []).map((b) => ({
          id: b.id,
          kind: "lesson",
          label: b.label,
          text: b.text,
          body: b.body,
          position: b.position,
        })),
      },
      sectionCount: l.study.sections.length,
      boardCount: l.study.boards.length,
      lessonBoardCount: (l.study.lessonBoards || []).length,
      questionCount: l.questions.length,
    })),
    levelCount: LEVEL_COUNT,
    questionsPerLevel: QUESTIONS_PER_LEVEL,
    questionCount: c.levels.reduce((n, l) => n + l.questions.length, 0),
    questionMax: QUESTION_MAX,
    questionTimeLimit: QUESTION_TIME_LIMIT_SECONDS,
    wrongPenalty: WRONG_ANSWER_PENALTY,
    passMark: PASS_MARK,
    references: c.references.map((k) => ({ key: k, ...REFERENCES[k] })),
    version: c.version || COURSE_VERSION,
    notice: NOTICE,
  };
}
export function questionScore(wrongAttempts) {
  return Math.max(0, QUESTION_MAX - wrongAttempts * WRONG_ANSWER_PENALTY);
}
export function moduleQuestions(key) {
  const c = COURSES[key];
  return c.levels.flatMap((l) =>
    l.questions.map((q) => ({ ...q, level: l.key })),
  );
}
export function classificationFor(score) {
  return score >= 85 ? "Excellent" : score >= 70 ? "Pass" : "Retake";
}
