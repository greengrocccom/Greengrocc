import dns from "node:dns";
import mongoose from "mongoose";
import { resolveMongoConfig } from "./config.js";

try {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
} catch (_) {}

const connectDB = async (serviceName = "service") => {
  try {
    const { uri, dbName } = resolveMongoConfig();
    const options = {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 15000,
    };
    if (dbName) {
      options.dbName = dbName;
    }
    const conn = await mongoose.connect(uri, options);
    console.log(
      `[${serviceName}] MongoDB connected: ${conn.connection.host} / ${conn.connection.name}`
    );
    return conn;
  } catch (error) {
    console.error(`[${serviceName}] MongoDB connection error:`, error.message);
    process.exit(1);
  }
};

export default connectDB;
