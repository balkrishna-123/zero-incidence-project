// Shows the password values stored in the local development database.
//
//   1. Stop the running app (Ctrl+C in its terminal).
//   2. Run:  node scripts/show-password-hashes.mjs
//   3. Start the app again:  npm start
//
// The output is the EXACT value kept in the "users" collection: a salted
// scrypt hash (algorithm, work factors, salt and digest) — never the
// password itself.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Load .env without extra dependencies (same file npm start uses).
const envFile = path.join(import.meta.dirname, "..", ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}

try {
  const { connectDatabase, disconnectDatabase } = await import("../server/db.js");
  const mongoose = (await import("mongoose")).default;
  await connectDatabase();
  const users = await mongoose.connection.db
    .collection("users")
    .find({}, { projection: { username: 1, role: 1, passwordHash: 1 } })
    .toArray();
  console.log(`Stored password values for ${users.length} accounts (users collection):\n`);
  for (const u of users) {
    console.log(`• ${u.username}  (${u.role})`);
    console.log(`  ${u.passwordHash}`);
    console.log(`  → ${u.passwordHash.length} characters, format: scrypt$N$r$p$salt$digest`);
    console.log("");
  }
  console.log("Note: these are one-way salted hashes — the passwords cannot be read back from them.");
  await disconnectDatabase();
  process.exit(0);
} catch (e) {
  if (String(e).includes("WiredTiger") || String(e).includes("lock")) {
    console.error("The database appears to be in use. Stop the running app (Ctrl+C) and run this script again.");
  } else {
    console.error("Could not read the database:", e);
  }
  process.exit(1);
}
