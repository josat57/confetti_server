import mongoose from "mongoose";
import { initGridFS } from "../utils/gridfs.js";

let GridFSBucket = null;
const connectDB = async () => {
  try {
    // Remove deprecated options
    const conn = await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://confetti:Ginger_123@localhost:27017/confetti?authSource=admin"
    );
    // console.log(conn);
    GridFSBucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
      bucketName: "uploads",
    });
    console.log(`GridFSBucket initialized: ${GridFSBucket}`);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Initialize GridFS for file uploads
    initGridFS();

    // Listen for database events
    mongoose.connection.on("connected", () => {
      console.log("✓ MongoDB connection established");
    });

    mongoose.connection.on("error", (err) => {
      console.error("✗ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB connection disconnected");
    });

    return conn;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    throw error;
  }
};

// Monitor database connection status
const checkDBConnection = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };

  console.log(`Database Status: ${states[state]}`);
  return state === 1;
};

export { connectDB, checkDBConnection, GridFSBucket };
