/**
 * MongoDB Atlas (shared tier) drops idle or busy connections now and then. The driver
 * reconnects on its own, but a dropped connection rejects every in-flight query, and one
 * that nobody awaits (index builds, fire-and-forget writes) would otherwise crash the
 * process. Those network blips are logged; every other unhandled rejection still crashes.
 */
const TRANSIENT_MONGO_ERRORS = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongoPoolClearedError",
]);

function isTransientMongoError(error) {
  for (let current = error; current; current = current.cause) {
    if (TRANSIENT_MONGO_ERRORS.has(current.name)) return true;
    if (typeof current.hasErrorLabel === "function" && current.hasErrorLabel("ResetPool")) return true;
  }
  return false;
}

export function installTransientDbErrorGuard() {
  process.on("unhandledRejection", (reason) => {
    if (isTransientMongoError(reason)) {
      console.warn(`[server] MongoDB connection dropped (${reason.name}: ${reason.message}); the driver will reconnect.`);
      return;
    }
    throw reason;
  });
}
