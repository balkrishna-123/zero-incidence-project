// Operator-only recovery. This is deliberately NOT an HTTP endpoint.
// Stop the application first if using the locally managed development database.
import { connectDatabase, disconnectDatabase } from "./db.js";
import { User, Audit } from "./models.js";
import { hashPassword, passwordProblem } from "./passwords.js";
const username = process.env.RECOVERY_ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.RECOVERY_TEMP_PASSWORD;
try {
  if (!username || passwordProblem(password))
    throw new Error(
      "Set RECOVERY_ADMIN_USERNAME and a strong RECOVERY_TEMP_PASSWORD in your environment.",
    );
  await connectDatabase();
  const user = await User.findOne({ username, role: "admin" });
  if (!user) throw new Error("No administrator matches that username.");
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        status: "active",
      },
      $inc: { sessionVersion: 1 },
    },
  );
  await Audit.create({
    actorName: "Server operator",
    action: "reset administrator credentials through the recovery command",
    subject: username,
  });
  console.log(
    `Administrator ${username} reset. All sessions revoked. The next login requires a password change.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => {});
}
