import { MongoClient } from "mongodb";

let client;
let db;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    client = new MongoClient(uri);

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
const getMongoClient = () => client;

export { connectDB, getDB, getMongoClient };
