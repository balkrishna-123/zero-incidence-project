// Original warehouse examples. Observations are free to inspect; grading keys stay here.
const choices = (a) => a.map((text, i) => ({ id: `choice-${i + 1}`, text }));
const question = (id, prompt, options, correct, explanation, reference, hint) => ({
  id,
  prompt,
  options: choices(options),
  correctId: `choice-${correct + 1}`,
  explanation,
  reference,
  hint,
});
const boards = (texts) =>
  texts.map((text, i) => ({
    id: `board-${i + 1}`,
    label: text.split("\n")[0],
    text,
    position: [
      [-4.2, 0, -5.4],
      [4.6, 0, -3.2],
      [5.2, 0, 4.2],
      [-4.8, 0, 5.0],
    ][i % 4],
  }));
export const HAZARD_COURSE = {
  key: "hazard-perception",
  version: "hazard-journey-2026-v2",
  title: "Hazard Perception",
  zone: "Warehouse safety walk",
  color: "amber",
  subtitle: "Look closer. Make the safer call.",
  description:
    "Learn to see the conditions that cause harm in a busy warehouse — slips, vehicle conflicts, falling loads, damaged equipment, blocked escapes — and respond through the site’s procedures.",
  intro: {
    about:
      "Hazard perception is the habit of noticing the conditions that can cause harm before they cause it — a spill on a route, a forklift lane with no separation, a leaning load, a damaged lead, a blocked exit. In this module your guide will show you how to look at condition, possible harm and who is exposed, how to respond safely, and how to report so the risk is actually closed.",
    learn: [
      "How to look: condition, possible harm and who is exposed",
      "The five most common warehouse hazards",
      "Why colour and labels are not verdicts — and every hazard does not look scary",
      "Responding safely: keep clear, report, use the procedure",
      "Making a hazard report that people can act on",
    ],
  },
  references: ["warehouse", "traffic", "trips", "electrical", "fire"],
  levels: [
    {
      key: "level-1",
      title: "Seeing risk",
      summary:
        "The basics of looking: what a hazard is, how to observe systematically, and why appearances mislead.",
      study: {
        intro:
          "A hazard is not a scary-looking object. It is a condition with the potential to cause harm — and you find it by looking systematically, not by guessing from labels.",
        sections: [
          {
            title: "What is a hazard?",
            body: "A hazard is a condition with the potential to cause harm: a slippery floor, an unstable load, a damaged lead, a blocked exit. To judge it, look at three things: the condition itself, the harm it could cause, and who or what is exposed to it.",
          },
          {
            title: "Observe like a system",
            body: "Walk the full loop: routes, storage, equipment, people, and the areas in between. Look at floor level (spills, cables, packaging) and above (loads, edges, overheads). Most warehouse incidents involve a condition that was visible for a long time before it was noticed.",
          },
          {
            title: "Colour is not a verdict",
            body: "Red means safety equipment, not danger. A clean warning sign does not mean the hazard is gone, and a stable, well-stacked load does not need action. Assess the condition and the situation, not the colour or the label.",
          },
          {
            title: "Housekeeping is hazard control",
            body: "Cables, packaging and spills on walking routes are trip and slip risks for the next person. Keeping routes clear is one of the most effective controls in a warehouse — and reporting what you cannot clear yourself is part of the control.",
          },
        ],
        boards: boards([
          "CONDITION · HARM\nWHO IS EXPOSED?\nNot colour",
          "A SIGN IS NOT\nTHE FIX\nCheck the condition",
          "FLOOR FIRST\nCables · spills\n· packaging",
        ]),
      },
      questions: [
        question(
          "hp-q8",
          "Does red equipment automatically mean a hazard exists?",
          [
            "No. Assess the condition and situation, not colour alone.",
            "Yes, all red objects are unsafe.",
            "Only if a warning sticker is missing.",
          ],
          0,
          "Identify the actual condition and possible harm. Accessible safety equipment is not itself a hazard simply because of its colour.",
          "warehouse",
          "A red fire extinguisher cabinet is dangerous. Is it?",
        ),
        question(
          "hp-q1",
          "A spill has a warning sign beside it. Is the underlying slip hazard removed?",
          [
            "Yes, the sign removes the contamination.",
            "No. Keep people away and arrange suitable cleanup.",
            "Yes, if everyone has seen the sign.",
          ],
          1,
          "A sign can warn people, but contamination remains until it is safely dealt with.",
          "warehouse",
          "The sign tells people about the spill. Does it remove the slip risk itself?",
        ),
        question(
          "hp-q6",
          "Why should walking routes be free of cables and packaging?",
          [
            "Only to improve appearance.",
            "Only to avoid damaging the packaging.",
            "They can cause trips and obstruct safe movement.",
          ],
          2,
            "Good housekeeping and suitable route design help prevent trips.",
            "trips",
            "What happens to the next person who walks over a cable at ankle height?",
          ),
          question(
            "hp-q10",
            "A hazard is best described as:",
            [
              "Anything that looks dangerous.",
              "A condition with the potential to cause harm — judged by the condition, the harm and who is exposed.",
              "Any object painted red.",
            ],
            1,
            "You judge a hazard from the condition, the harm it could cause, and who or what is exposed — not from its appearance.",
            "warehouse",
            "Not appearance — condition, harm and… who?",
          ),
          question(
            "hp-q11",
            "When scanning a new area, where should your eyes go?",
            [
              "Only at eye level.",
              "Floor level — spills, cables, packaging — and above — loads, edges and overheads.",
              "Only at the exits.",
            ],
            1,
            "Systematic observation covers low and high: most incidents involve a condition that was visible for a long time before it was noticed.",
            "warehouse",
            "Think low and high — what hides at ankle level and overhead?",
          ),
          question(
            "hp-q12",
            "A stored load is neatly stacked and looks stable. What is the correct conclusion?",
            [
              "It is safe and needs no attention.",
              "It still needs to be checked against racking limits and securement rules.",
              "It is a hazard simply because it is high.",
            ],
            1,
            "Looking tidy is not the same as being assessed — stable, well-stacked loads are checked against the rules, not admired.",
            "warehouse",
            "“Looks fine” — is that an assessment, or an assumption?",
          ),
          question(
            "hp-q13",
            "You notice a small water spill on a main route, some distance from you. What is the best first move?",
            [
              "Walk around it quietly.",
              "Keep people safe from it and report it so it is cleaned through the procedure.",
              "Put your foot on it so others avoid it.",
            ],
            1,
            "It is not yours to ignore, and not necessarily yours to clean — keep people clear and put it through the reporting procedure.",
            "trips",
            "You are not the cleaner, but you are not the bystander either. What do you do?",
          ),
          question(
            "hp-q14",
            "Why do many warehouse incidents involve a condition that was “visible for a long time”?",
            [
              "People tend to miss what they are not looking for systematically.",
              "Hazards only appear at night.",
              "They do not — incidents are always sudden surprises.",
            ],
            0,
            "Familiarity is the enemy of observation. Systematic looking — routes, storage, equipment, people — is the habit that finds the visible-but-missed.",
            "warehouse",
            "The hazard was there for everyone to see. What habit actually sees it?",
          ),
        ],
      },
      {
        key: "level-2",
      title: "The five common hazards",
      summary:
        "The hazards that cause most warehouse harm: spills, vehicle conflicts, falling loads, damaged equipment and blocked escapes.",
      study: {
        intro:
          "Every warehouse carries roughly the same five high-severity hazards. Learn to spot each one and know the right first response.",
        sections: [
          {
            title: "Slips and contamination",
            body: "Oil, water or other contamination on a walking route is a slip risk the moment it appears. Restrict access, report it and arrange cleanup through the site procedure — with extra care when the substance is unknown. A sign alone is not cleanup.",
          },
          {
            title: "Pedestrians and vehicles",
            body: "The most severe conflicts in a warehouse are between people and workplace vehicles. Separate pedestrian and vehicle activity wherever possible, use designated controlled crossings, and never rely on a horn, visibility or a high-visibility vest alone.",
          },
          {
            title: "Falling loads",
            body: "An unstable, leaning or overhanging stored load can fall onto the people below. Keep clear, restrict access and report it for a competent response. Do not climb the racking, stand beneath it, or try to catch or push back a moving load.",
          },
          {
            title: "Damaged equipment and leads",
            body: "Visible damage — torn insulation, cracked guards, frayed cables — means the equipment must stop being used until it is dealt with. Report it and remove it from service through the procedure. Electrical work belongs with competent, authorised people, never an improvised repair.",
          },
          {
            title: "Blocked escape routes",
            body: "Exits and escape routes must be available at all times, not only during an emergency. Packaging and equipment blocking an exit are dealt with promptly, through the site procedure, so the route is available before an alarm ever sounds.",
          },
        ],
        boards: boards([
          "SPILL: RESTRICT\nREPORT · CLEAN\nThe sign is not the fix",
          "PEOPLE ≠ FORKLIFTS\nSeparate the routes",
          "LEANING LOAD\nKeep clear · cordon\n· report · wait",
        ]),
      },
      questions: [
        question(
          "hp-q3",
          "A stored load looks unstable. What should a new employee do?",
          [
            "Try to catch it if it moves.",
            "Climb the rack to adjust it.",
            "Keep clear, restrict access through the site procedure and report it for a trained response.",
          ],
          2,
          "Avoid entering the falling-object risk area or attempting an unsafe intervention.",
          "warehouse",
          "Would you stand under a leaning load to watch it? What three actions keep everyone safe?",
        ),
        question(
          "hp-q4",
          "A lead was checked in the past but is visibly damaged now. Is it safe to keep using?",
          [
            "Yes, the previous check overrides new damage.",
            "No. Report the defect and follow the safe procedure for stopping use.",
            "Yes, if it still works.",
          ],
          1,
          "Current condition matters. A previous inspection does not make a new defect safe.",
          "electrical",
          "Tape is not an electrical repair. What is the right response to a visibly damaged lead?",
        ),
        question(
          "hp-q2",
          "What is the preferred approach to pedestrians and workplace vehicles?",
          [
            "Separate their activity and routes wherever possible.",
            "Rely only on a horn.",
            "Rely only on high-visibility clothing.",
          ],
          0,
          "Separation is preferred; use suitable controls wherever pedestrian and vehicle routes must interact.",
          "traffic",
            "A horn and a hi-vis vest are two things you cannot rely on alone. What is the preferred control?",
          ),
          question(
            "hp-q15",
            "You see oil on a ramp that forklifts use. What is the correct order of actions?",
            [
              "Restrict access, report it, and arrange cleanup through the site procedure.",
              "Mop it yourself with any cloth you can find.",
              "Leave it for the next shift to deal with.",
            ],
            0,
            "Protect first: restrict the area, then the procedure owns the safe cleanup — especially with an unknown or slippery substance.",
            "trips",
            "Protect, then fix — in that order. Who owns the fix?",
          ),
          question(
            "hp-q16",
            "A forklift is reversing along your lane and you cannot see it. What is the best response?",
            [
              "Stand still — a reversing vehicle driver may not see a stationary person.",
              "Wave and hope the driver sees you.",
              "Duck under the truck.",
            ],
            0,
            "Reversing vehicles have blind spots and priorities. Do not place yourself where a vehicle cannot see you; use the designated crossing and separation points.",
            "traffic",
            "A reversing driver cannot see you. What do you do with your legs?",
          ),
          question(
            "hp-q17",
            "A load is overhanging the racking beam. Which of these must you NOT do?",
            ["Walk beneath it", "Restrict access", "Report it"],
            0,
            "The falling-object zone is exactly where you must not be: keep clear, restrict access and report it for a competent response.",
            "warehouse",
            "Which of these puts you inside the falling-object zone?",
          ),
          question(
            "hp-q18",
            "A pallet truck’s brake cable has snapped and it is parked in the middle of the route. What now?",
            [
              "Nudge it to the side yourself.",
              "Restrict the area and report it for removal through the procedure.",
              "Tape a “brake broken” note on the handle.",
            ],
            1,
            "A note on a broken brake does not stop the truck. Defective equipment is restricted and removed through the procedure, not improvised with.",
            "warehouse",
            "Does a paper note repair a brake cable?",
          ),
          question(
            "hp-q19",
            "Why must pedestrian and vehicle routes be separated “wherever possible”?",
            [
              "Because a horn, visibility and high-vis clothing alone are not reliable controls.",
              "Because pedestrians are usually faster.",
              "It is only a preference, not a requirement.",
            ],
            0,
            "Separation is the preferred control; where routes must interact, suitable controls — not a horn or a vest — carry the risk.",
            "traffic",
            "None of the soft controls is dependable on its own. What carries the risk instead?",
          ),
        ],
      },
      {
        key: "level-3",
      title: "Responding and reporting",
      summary:
        "What to do when you see it: keep people safe, use the procedure, and report so the risk is actually closed.",
      study: {
        intro:
          "Noticing a hazard is only half the job. The response must protect people first — and the report must be good enough for someone to act on.",
        sections: [
          {
            title: "Keep people clear first",
            body: "The order is protect → report → act only with competence. Keep yourself and others out of the risk area before you do anything else. Never become the second casualty by intervening in a way you are not trained for.",
          },
          {
            title: "Use the procedure",
            body: "Cordon, tag, report — through the site’s agreed escalation. A warning sign or tag is part of the control, not the whole of it: the risk stays live until a competent person closes it. Follow up on your report.",
          },
          {
            title: "Reporting uncertainty",
            body: "If you are unsure whether something is dangerous, raise it. A false alarm costs a few minutes; an injury costs far more. No scoring rule in any exercise is ever a reason to hide a genuine concern at work.",
          },
          {
            title: "A report that works",
            body: "A useful hazard report has four parts: WHERE (exact location), WHAT (the condition you observed, factually), WHO (who or what may be affected) and WHAT YOU DID (access restricted, people moved). Sent through the agreed channel, it lets the responsible people assess and act quickly.",
          },
          {
            title: "After the report",
            body: "The risk is closed when the competent response is complete — not when you filed the report. If the condition is still there after your report, follow up. Ownership of the fix belongs to the procedure; ownership of noticing belongs to you.",
          },
          {
            title: "From response to prevention",
            body: "Every hazard you report is data. When a fix is made — the guardrail refitted, the route rerouted, the panel labelled — the goal is that the same hazard never appears on someone else’s list. Ask what the permanent control is, and where the lesson fits in the induction. Spotting one hazard is good; making sure it is never a hazard again is the standard.",
          },
        ],
        boards: boards([
          "PROTECT → REPORT\nNever become the\nsecond casualty",
          "IF UNSURE, SAY IT\nA false alarm is cheap",
          "A GOOD REPORT\nWHERE · WHAT · WHO\n· WHAT YOU DID",
        ]),
      },
      questions: [
        question(
          "hp-q5",
          "When should a blocked escape route be addressed?",
          [
            "Promptly, so the route is available before an emergency.",
            "Only after an alarm sounds.",
            "Only at the end of the week.",
          ],
          0,
          "An evacuation plan needs clear passageways and usable escape routes.",
          "fire",
          "Should escape routes be cleared after the alarm — or before it ever sounds?",
        ),
        question(
          "hp-q7",
          "You are unsure whether a condition is dangerous in real work. What should you do?",
          [
            "Ignore it to avoid raising an incorrect concern.",
            "Keep yourself safe and report or seek advice through the site procedure.",
            "Intervene even if you are not trained.",
          ],
          1,
          "Uncertain conditions should be raised for a safe assessment. Never use this exercise’s marks as a reason to hide a genuine concern.",
          "warehouse",
          "What does a false alarm cost — compared with an injury? Which option is the affordable one?",
        ),
        question(
          "hp-q9",
          "What makes a useful hazard report?",
          [
            "Only saying that someone should be more careful.",
            "Waiting until someone is injured.",
            "A clear location, observed condition and who may be affected, reported through the agreed process.",
          ],
          2,
          "A clear report helps the responsible people assess and control the risk. Stay safe and follow the site’s reporting arrangements.",
          "warehouse",
          "If you only reported “be careful”, what could the reader actually do? Name the parts of a useful report.",
        ),
        question(
          "hp-q20",
          "You reported a hazard two days ago and it is still there. What is the correct view?",
          [
            "The report was filed, so the matter is closed.",
            "The risk is closed only when the competent response completes it — follow up.",
            "It is no longer your hazard.",
          ],
          1,
          "Filing is not fixing. If the condition is still there after your report, follow up — ownership of the fix belongs to the procedure, ownership of noticing to you.",
          "warehouse",
          "Filing is not… what?",
        ),
        question(
          "hp-q21",
          "Which hazard report would the team be able to act on immediately?",
          [
            "“Something near the dock is not safe.”",
            "“A cable crosses the route between bays 3 and 4 at ankle height; I have cordon-roped it; pedestrians are exposed.”",
            "“Be more careful around the forklifts.”",
          ],
          1,
          "A report that works has where, what you observed, who is affected and what you already did — enough for the responsible people to act.",
          "warehouse",
          "Where, what, who — and what you already did. Which option has all four?",
        ),
        question(
          "hp-q22",
          "An unknown chemical is leaking from a drum and you have no training with that substance. What is the safe line?",
          [
            "Dilute it with water so it is less concentrated.",
            "Keep clear, restrict access and report it — the procedure decides the response.",
            "Absorb it with rags from the store room.",
          ],
          1,
          "Never become the second casualty: protect people first, then let the competent response — not improvised first aid for a chemical — take over.",
          "warehouse",
          "Protect → report → act only with competence. Which option breaks that order?",
        ),
        question(
          "hp-q23",
          "After a drill, the team finds the evacuation exit had been blocked with pallets all morning — though “no one needed it”. Why does this still matter?",
          [
            "Escape routes must be available before an emergency, not during one.",
            "It does not matter if the alarm was only a drill.",
            "Only if the pallets were heavy.",
          ],
          0,
          "You cannot test the exit during the emergency. Clear passageways and usable escape routes exist so the alarm finds them ready.",
          "fire",
          "You cannot test the exit “during” the emergency. When must it be clear?",
        ),
        question(
          "hp-q24",
          "The team refitted a guardrail over an edge — fixing a recurring hazard once and for all. What is the prevention goal?",
          [
            "That the same hazard never appears on someone else’s list — make the control permanent.",
            "To have one item ticked off for the month.",
            "Nothing — fixes are always one-off events.",
          ],
          0,
          "Every reported hazard is data. When the permanent control is in, the standard is that it is never a hazard again.",
          "warehouse",
          "One fix, many future shifts. What is the standard a permanent control sets?",
        ),
      ],
    },
  ],
};
