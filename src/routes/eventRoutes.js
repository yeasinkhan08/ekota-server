import express from "express";
import { getDB } from "../config/db.js";

const router = express.Router();

router.get("/test", (req, res) => {
  const db = getDB();

  res.json({
    success: true,
    message: "Event routes are working!",
    database: db.databaseName,
  });
});

export default router;
