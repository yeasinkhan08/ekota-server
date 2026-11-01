import express from "express";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// POST -create a new event

// POST - Create a new event
router.post("/", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const newEvent = req.body;

    if (!newEvent.title || !newEvent.eventDate) {
      return res.status(400).send({
        success: false,
        message: "Title and event date are required",
      });
    }

    const result = await eventsCollection.insertOne(newEvent);

    res.status(201).send({
      success: true,
      message: "Event created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to create event",
    });
  }
});
// GET all upcoming events
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    // Get today's date
    const today = new Date().toISOString().split("T")[0];

    // Get limit from query parameter
    const limit = Number(req.query.limit) || 0;

    // Find upcoming events
    let query = eventsCollection
      .find({ eventDate: { $gte: today } })
      .sort({ eventDate: 1 });

    // Apply limit if provided
    if (limit > 0) {
      query = query.limit(limit);
    }

    const events = await query.toArray();

    res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
      error: error.message,
    });
  }
});

// GET - Get 6 recent upcoming events
router.get("/recent", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const today = new Date().toISOString().split("T")[0];

    const events = await eventsCollection
      .find({ eventDate: { $gte: today } })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();

    res.send({
      success: true,
      events,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to fetch recent events",
    });
  }
});

// GET - Get single event by ID
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");
    // req.params.id=gets the id from the url
    const { id } = req.params;

    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).send({
        success: false,
        message: "Event not found",
      });
    }

    res.send({
      success: true,
      event,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to get event",
    });
  }
});

// DELETE - Delete an event
router.delete("/:id", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const { id } = req.params;

    const result = await eventsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Event not found",
      });
    }

    res.send({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete event",
    });
  }
});
// UPDATE - Update an event
router.patch("/:id", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const { id } = req.params;
    const updatedData = req.body;

    const result = await eventsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Event not found",
      });
    }

    res.send({
      success: true,
      message: "Event updated successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to update event",
    });
  }
});
// Test route
router.get("/test", (req, res) => {
  const db = getDB();

  res.json({
    success: true,
    message: "Event routes are working!",
    database: db.databaseName,
  });
});

export default router;
