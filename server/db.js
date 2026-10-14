import mongoose from "mongoose";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, production } from "./config.js";
let localMongo;
export async function connectDatabase({ isolated = false } = {}) {
  let uri = isolated ? null : process.env.MONGODB_URI;
  if (!uri) {
    if (production || (!isolated && process.env.ALLOW_LOCAL_MONGO !== "true")) {
      throw new Error(
        "Set MONGODB_URI, or enable ALLOW_LOCAL_MONGO=true for development.",
      );
    }
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const dbPath = isolated ? undefined : path.join(DATA_DIR, "mongodb");
    if (dbPath) await mkdir(dbPath, { recursive: true });
    localMongo = await MongoMemoryServer.create({
      binary: { version: "7.0.24" },
      instance: {
        ...(dbPath ? { dbPath } : {}),
        dbName: isolated ? "zero_incident_test" : "zero_incident",
        ip: "127.0.0.1",
        storageEngine: "wiredTiger",
        args: [
          "--wiredTigerCacheSizeGB",
          "0.25",
          "--wiredTigerEngineConfigString",
          "log=(file_max=1MB)",
        ],
      },
    });
    uri = localMongo.getUri(isolated ? "zero_incident_test" : "zero_incident");
    console.log(
      `MongoDB ready (${isolated ? "isolated test database" : "persistent local development database"}).`,
    );
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  return uri;
}
export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (localMongo) await localMongo.stop({ doCleanup: true, force: false });
}
