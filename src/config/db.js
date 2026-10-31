import { MongoClient } from "mongodb";

let db;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    const client = new MongoClient(uri);

    await client.connect();

    db = client.db("ekota");

    console.log("MongoDB connected successfully!");

    return db;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

const getDB = () => db;

export { connectDB, getDB };
