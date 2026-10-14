import { User, Trainer, Module, Progress, Counter, Audit, TrainerReport } from "./models.js";
import { demoMode, production, DEMO_CREDENTIALS } from "./config.js";
import { hashPassword, passwordProblem } from "./passwords.js";

const moduleData = [
  {
    key: "manual-handling",
    title: "Manual Handling",
    description: "Learn safe lifting techniques and reduce the risk of injury.",
    objectives: [
      "Assess the load, the task and your surroundings before lifting.",
      "Recognise when to use handling equipment or ask for assistance.",
      "Choose a safe route and use controlled, stable movements.",
    ],
    rules: [
      "Follow your workplace risk assessment and handling procedures.",
      "Do not lift a load that is beyond your capability.",
      "Stop if the task, load or route becomes unsafe.",
    ],
  },
  {
    key: "working-at-height",
    title: "Working at Height",
    description:
      "Understand the hazards and make safer decisions when working at height.",
    objectives: [
      "Recognise situations where a fall could cause injury.",
      "Understand the priority of avoiding, preventing and minimising falls.",
      "Check access equipment and follow site-specific safe systems of work.",
    ],
    rules: [
      "Only use suitable equipment you are trained and authorised to use.",
      "Inspect the equipment and work area before starting.",
      "Report defects and do not continue if the setup is unsafe.",
    ],
  },
  {
    key: "hazard-perception",
    title: "Hazard Perception",
    description:
      "Spot hazards in warehouse scenarios and choose a safer response.",
    objectives: [
      "Identify common pedestrian, vehicle and housekeeping hazards.",
      "Distinguish a hazard from the risk it creates.",
      "Choose appropriate controls and know when to report a concern.",
    ],
    rules: [
      "Observe the whole scene before deciding on an action.",
      "Use designated pedestrian routes and follow site signage.",
      "Report hazards through your workplace reporting process.",
    ],
  },
];
export async function seedDatabase() {
  await Promise.all(
    [User, Trainer, Module, Progress, Counter].map((model) => model.init()),
  );
  if (production && (await User.exists({ isDemo: true }))) {
    throw new Error(
      "This database contains demonstration accounts. Use a clean, non-demo database in production.",
    );
  }
  for (const data of moduleData)
    await Module.updateOne(
      { key: data.key },
      { $setOnInsert: data },
      { upsert: true },
    );
  await Counter.updateOne(
    { _id: "employee-number" },
    { $setOnInsert: { value: 1000 } },
    { upsert: true },
  );
  if (await User.exists({ role: "admin" })) return;
  const username = demoMode
    ? DEMO_CREDENTIALS.admin.username
    : process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = demoMode
    ? DEMO_CREDENTIALS.admin.password
    : process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (
    !username ||
    !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) ||
    passwordProblem(password)
  ) {
    throw new Error(
      "No administrator exists. Set a valid BOOTSTRAP_ADMIN_USERNAME and strong BOOTSTRAP_ADMIN_PASSWORD, or enable development DEMO_MODE.",
    );
  }
  const admin = await User.create({
    firstName: process.env.BOOTSTRAP_ADMIN_FIRST_NAME || "Safety",
    lastName: process.env.BOOTSTRAP_ADMIN_LAST_NAME || "Admin",
    username,
    passwordHash: await hashPassword(password),
    role: "admin",
    status: "active",
    mustChangePassword: !demoMode,
    isDemo: demoMode,
  });
  await Audit.create({
    actorId: admin._id,
    actorName: "System",
    action: "created the administrator account",
    subject: username,
  });
  if (!demoMode) return;
  // Trainers sign in with the ID and password the administrator provides.
  // The development sample trainer uses a fixed account for demonstrations.
  const trainerAccount = await User.create({
    firstName: "Yeti",
    lastName: "Guide",
    username: DEMO_CREDENTIALS.trainer.username,
    passwordHash: await hashPassword(DEMO_CREDENTIALS.trainer.password),
    role: "trainer",
    status: "active",
    mustChangePassword: false,
    isDemo: true,
  });
  const trainer = await Trainer.create({
    firstName: "Yeti",
    lastName: "Guide",
    nickname: "Yeti",
    nicknameKey: "yeti",
    imageUrl: "/assets/yeti-trainer.png",
    userId: trainerAccount._id,
    permissions: { viewProgress: true, resetPassword: true },
    introduction:
      "Welcome to Zero Incident! I’m Yeti, your safety guide. Let’s build safer habits, one module at a time.",
    // Backdated so the demo trainer already meets the tenure half of the
    // trainer -> administrator promotion rule; the certified-employee half
    // fills in as employees finish all three modules.
    createdAt: new Date(Date.now() - 120 * 86400000),
  });
  await Module.updateMany({}, { $set: { trainerId: trainer._id } });
  const people = [
    ["Ramesh", "Shrestha", 28, "ramesh.s", true, "active", []],
    // Anisha scores 90+ in every module: she demonstrates the
    // employee -> trainer promotion application.
    ["Anisha", "Gurung", 25, "anisha.g", false, "active", [94, 92, 91]],
    ["Bikash", "Thapa", 32, "bikash.t", false, "active", [74, null, 62]],
    ["Priya", "Rai", 24, "priya.r", false, "active", [85, 79]],
    ["Suman", "Karki", 30, "suman.k", true, "inactive", []],
    ["Nisha", "Magar", 27, "nisha.m", false, "active", [72, 65]],
  ];
  for (const [
    i,
    [firstName, lastName, age, user, mustChangePassword, status, scores],
  ] of people.entries()) {
    const createdAt = new Date(Date.now() - (6 - i) * 86400000);
    const employee = await User.create({
      firstName,
      lastName,
      age,
      username: user,
      role: "employee",
      employeeNumber: `ZI-${new Date().getFullYear()}-${1001 + i}`,
      passwordHash: await hashPassword(
        user === "ramesh.s"
          ? DEMO_CREDENTIALS.employee.password
          : "DemoOnly!2026",
      ),
      mustChangePassword,
      status,
      createdAt,
      isDemo: true,
      ...(mustChangePassword
        ? {}
        : { lastLoginAt: new Date(Date.now() - (i + 1) * 3600000) }),
    });
    for (let m = 0; m < scores.length; m++) {
      if (scores[m] !== null)
        await Progress.create({
          employeeId: employee._id,
          moduleKey: moduleData[m].key,
          score: scores[m],
          attempts: scores[m] < 70 ? 2 : 1,
          source: "demo",
          assessedAt: new Date(Date.now() - (i + 1) * 3600000),
        });
    }
    await Audit.create({
      actorId: admin._id,
      actorName: "Safety Admin",
      action: "registered an employee",
      subject: `${firstName} ${lastName}`,
      createdAt,
    });
  }
  await Counter.updateOne(
    { _id: "employee-number" },
    { $set: { value: 1006 } },
  );
  await Audit.create({
    actorId: admin._id,
    actorName: "Safety Admin",
    action: "assigned a virtual trainer",
    subject: "Yeti · all 3 modules",
  });
  // One open trainer report so the administrator Reports page is not empty.
  const reporter = await User.findOne({ username: "nisha.m" }).lean();
  if (reporter)
    await TrainerReport.create({
      userId: reporter._id,
      trainerId: trainer._id,
      moduleKey: "manual-handling",
      message:
        "I got stuck on the practical activity and waited a while for help. It would be easier if the guide checked in more often.",
      status: "open",
    });
  console.log(
    "Development sample accounts created. See README.md for demo credentials.",
  );
}
