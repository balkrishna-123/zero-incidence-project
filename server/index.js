import { connectDatabase, disconnectDatabase } from "./db.js";
import { seedDatabase } from "./seed.js";
import { createApp } from "./app.js";
import { demoMode } from "./config.js";

try {
  const uri = await connectDatabase();
  await seedDatabase();
  const app = await createApp(uri);
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Zero Incident is listening on 0.0.0.0:${port}`);
    console.log(
      demoMode
        ? "DEVELOPMENT DEMO — seeded progress is illustrative. All three module assessments are available. Verified completion certificates are available."
        : "Demo data is disabled.",
    );
  });
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await app.locals.sessionStore.close();
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 12000).unref();
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch (error) {
  console.error("Startup failed:", error.message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
}
