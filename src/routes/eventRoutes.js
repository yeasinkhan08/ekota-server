import express from "express";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// POST - Create a new event (Protected)
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const { title, description, eventType, thumbnailUrl, location, eventDate } =
      req.body;

    if (!title || !eventDate) {
      return res.status(400).json({
        success: false,
        message: "Title and event date are required",
      });
    }

    if (!req.user.email) {
      return res.status(401).json({
        success: false,
        message: "User email not found in token",
      });
    }

    const newEvent = {
      title,
      description,
      eventType,
      thumbnailUrl,
      location,
      eventDate,
      creatorEmail: req.user.email,
      joinedUsers: [],
      createdAt: new Date(),
    };

    const result = await eventsCollection.insertOne(newEvent);

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create event",
    });
  }
});

// GET - Get all upcoming events (Public)
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const today = new Date().toISOString().split("T")[0];
    const limit = Number(req.query.limit) || 0;

    let query = eventsCollection
      .find({ eventDate: { $gte: today } })
      .sort({ eventDate: 1 });

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
    console.error("Fetch events error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
});

// GET - Get 6 recent upcoming events (Public)
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

    res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    console.error("Recent events error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch recent events",
    });
  }
});

// GET - Test route (Public)
router.get("/test", (req, res) => {
  const db = getDB();

  res.json({
    success: true,
    message: "Event routes are working!",
    database: db.databaseName,
  });
});

// GET - Get events created by the logged-in user (Protected)
router.get("/my-events", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const events = await eventsCollection
      .find({
        creatorEmail: req.user.email,
      })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("My events error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch your events",
    });
  }
});

// POST - Join an event (Protected)
router.post("/:id/join", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    if (!req.user.email) {
      return res.status(401).json({
        success: false,
        message: "User email not found in token",
      });
    }

    // Check whether the event exists
    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Prevent users from joining their own events
    if (event.creatorEmail === req.user.email) {
      return res.status(400).json({
        success: false,
        message: "You cannot join your own event",
      });
    }

    // Add the user without creating duplicates
    const result = await eventsCollection.updateOne(
      {
        _id: new ObjectId(id),
        eventDate: { $gte: new Date().toISOString().split("T")[0] },
      },
      {
        $addToSet: {
          joinedUsers: req.user.email,
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "This event is no longer available to join",
      });
    }

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "You have already joined this event",
      });
    }

    res.status(200).json({
      success: true,
      message: "You joined the event successfully",
    });
  } catch (error) {
    console.error("Join event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to join event",
    });
  }
});

// GET - Get events joined by the logged-in user (Protected)
router.get("/joined", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const events = await eventsCollection
      .find({
        joinedUsers: req.user.email,
      })
      .sort({ eventDate: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Joined events error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch joined events",
    });
  }
});

// GET - Get single event by ID (Public)
router.get("/:id", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Get event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get event",
    });
  }
});

// DELETE - Delete an event (Protected, owner only)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const result = await eventsCollection.deleteOne({
      _id: new ObjectId(id),
      creatorEmail: req.user.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete event",
    });
  }
});

// PATCH - Update an event (Protected, owner only)
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const { title, description, eventType, thumbnailUrl, location, eventDate } =
      req.body;

    const updatedData = {
      title,
      description,
      eventType,
      thumbnailUrl,
      location,
      eventDate,
    };

    // Remove fields that were not provided
    Object.keys(updatedData).forEach((key) => {
      if (updatedData[key] === undefined) {
        delete updatedData[key];
      }
    });

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No update data provided",
      });
    }

    const result = await eventsCollection.updateOne(
      {
        _id: new ObjectId(id),
        creatorEmail: req.user.email,
      },
      {
        $set: updatedData,
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.json({
      success: true,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Update event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
});

export default router;
