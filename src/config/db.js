import { MongoClient } from "mongodb";

let client;
let db;
let connectionPromise;

// Connect to MongoDB
const connectDB = async () => {
  // Reuse an existing connection.
  if (db) {
    return db;
  }

  // Prevent multiple simultaneous connection attempts.
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  const mongoClient = new MongoClient(uri);

  client = mongoClient;

  connectionPromise = (async () => {
    try {
      await mongoClient.connect();

      const databaseName = process.env.MONGODB_DB_NAME || "ekota";

      db = mongoClient.db(databaseName);

      // Verify that the database is responding.
      await db.command({ ping: 1 });

      console.log("MongoDB connected successfully!");
      console.log(`Database: ${databaseName}`);

      return db;
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);

      await mongoClient.close().catch(() => {});

      if (client === mongoClient) {
        client = undefined;
        db = undefined;
        connectionPromise = undefined;
      }

      throw error;
    }
  })();

  return connectionPromise;
};

// Get the connected database.
const getDB = () => {
  if (!db) {
    throw new Error("Database is not connected. Call connectDB() first.");
  }

  return db;
};

// Get the MongoDB client.
const getMongoClient = () => {
  if (!client) {
    throw new Error("MongoDB client is not connected.");
  }

  return client;
};

// Close MongoDB connection.
const closeDB = async () => {
  if (!client) return;

  const currentClient = client;

  await currentClient.close();

  if (client === currentClient) {
    client = undefined;
    db = undefined;
    connectionPromise = undefined;
  }

  console.log("MongoDB connection closed.");
};

export { connectDB, getDB, getMongoClient, closeDB };
