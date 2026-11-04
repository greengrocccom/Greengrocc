export function resolveMongoConfig(env = process.env) {
  const { USE_PRODUCTION_DB, USE_TEST_DB } = env;

  if (USE_PRODUCTION_DB !== undefined || USE_TEST_DB !== undefined) {
    const validFlags = ["true", "false"];
    if (
      !validFlags.includes(USE_PRODUCTION_DB) ||
      !validFlags.includes(USE_TEST_DB) ||
      USE_PRODUCTION_DB === USE_TEST_DB
    ) {
      throw new Error("Set USE_PRODUCTION_DB and USE_TEST_DB to opposite true/false values.");
    }

    if (USE_PRODUCTION_DB === "true") {
      const uri = env.MONGODB_PRODUCTION_URI?.trim();
      const dbName = env.MONGODB_PRODUCTION_DB_NAME?.trim();
      if (!uri || !dbName) {
        throw new Error("Set MONGODB_PRODUCTION_URI and MONGODB_PRODUCTION_DB_NAME to use production.");
      }
      return { uri, dbName };
    }
  }

  const uri = env.MONGODB_URI?.trim();
  if (!uri) throw new Error("Set MONGODB_URI to connect to MongoDB.");

  return {
    uri,
    dbName: env.MONGODB_DB_NAME,
  };
}
