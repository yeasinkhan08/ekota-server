import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import eventRoutes from "./routes/eventRoutes.js";

const app = express();

// Environment configuration

const PORT = Number(process.env.PORT) || 5000;

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware

// Allow requests from configured frontend origins.
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parse incoming JSON requests.
app.use(express.json({ limit: "1mb" }));

// Parse URL-encoded requests.
app.use(express.urlencoded({ extended: false }));

// Health check

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Ekota server is running!",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// API Routes

app.use("/api/events", eventRoutes);

// Handle unknown routes

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Global error handler

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  // Handle invalid JSON requests.
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server after MongoDB connection

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Ekota server running on port ${PORT}`);
      console.log("MongoDB connection established.");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
