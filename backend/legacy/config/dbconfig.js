import mongoose from "mongoose";
import { resolveMongoConfig } from "../../shared/db/config.js";

const connectDB = async () => {
  try {
    const { uri, dbName } = resolveMongoConfig();
    const conn = await mongoose.connect(uri, {
      dbName: dbName || "test",
    });
    console.log(
      `MongoDB connected: ${conn.connection.host} / ${conn.connection.name}`
    );
    return conn;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    if (error.message.includes("bad auth")) {
      console.error(
        "Check the selected MongoDB URI in .env: confirm the Atlas database user and URL-encode special characters in the password (e.g. @ → %40)."
      );
    }
    process.exit(1);
  }
};

export default connectDB;
