import express from "express";
import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// --------------------------------------------------
// Helper functions
// --------------------------------------------------

// Get today's date using Bangladesh timezone.
const getToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  parts.forEach(({ type, value }) => {
    values[type] = value;
  });

  return `${values.year}-${values.month}-${values.day}`;
};

// Get the authenticated user's email.
const getUserEmail = (req) => {
  const email = req.user?.email;

  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

// Validate an event date.
const isValidEventDate = (date) => {
  if (typeof date !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  const isRealDate =
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day;

  return isRealDate && date >= getToday();
};

// Validate image URL.
const isValidImageUrl = (value) => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// Validate create/update event data.
const validateEventData = (body, partial = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: "Request body must be a valid JSON object",
    };
  }

  const allowedFields = [
    "title",
    "description",
    "eventType",
    "thumbnailUrl",
    "location",
    "eventDate",
  ];

  const requiredFields = allowedFields;

  // Reject unsupported fields.
  const unsupportedFields = Object.keys(body).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unsupportedFields.length > 0) {
    return {
      error: `Unsupported field: ${unsupportedFields.join(", ")}`,
    };
  }

  const data = {};

  for (const field of allowedFields) {
    const exists = Object.prototype.hasOwnProperty.call(body, field);

    if (!exists) {
      if (!partial && requiredFields.includes(field)) {
        return {
          error: `${field} is required`,
        };
      }

      continue;
    }

    if (typeof body[field] !== "string") {
      return {
        error: `${field} must be a string`,
      };
    }

    const value = body[field].trim();

    if (!value) {
      return {
        error: `${field} cannot be empty`,
      };
    }

    if (field === "title" && value.length > 100) {
      return {
        error: "Event title cannot exceed 100 characters",
      };
    }

    if (field === "description" && value.length > 2000) {
      return {
        error: "Description cannot exceed 2000 characters",
      };
    }

    if (field === "eventType" && value.length > 50) {
      return {
        error: "Event category cannot exceed 50 characters",
      };
    }

    if (field === "location" && value.length > 150) {
      return {
        error: "Location cannot exceed 150 characters",
      };
    }

    if (field === "thumbnailUrl") {
      if (value.length > 2048 || !isValidImageUrl(value)) {
        return {
          error: "Please provide a valid HTTP or HTTPS image URL",
        };
      }
    }

    if (field === "eventDate" && !isValidEventDate(value)) {
      return {
        error: "Please provide a valid future event date",
      };
    }

    data[field] = value;
  }

  if (partial && Object.keys(data).length === 0) {
    return {
      error: "No update data provided",
    };
  }

  return { data };
};

// Hide the private joinedUsers list from API responses.
// Keep the creator email for your existing organizer display.
const formatEvent = (event) => {
  const { joinedUsers, ...publicData } = event;

  return {
    ...publicData,
    joinedCount: Array.isArray(joinedUsers) ? joinedUsers.length : 0,
  };
};

// --------------------------------------------------
// POST - Create a new event (Protected)
// --------------------------------------------------

router.post("/", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    const validation = validateEventData(req.body);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const newEvent = {
      ...validation.data,
      creatorEmail: userEmail,
      joinedUsers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await eventsCollection.insertOne(newEvent);

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create event",
    });
  }
});

// --------------------------------------------------
// GET - Get all upcoming events (Public)
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const today = getToday();

    let limit = 0;

    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);

      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return res.status(400).json({
          success: false,
          message: "Limit must be an integer between 1 and 50",
        });
      }
    }

    let query = eventsCollection
      .find({
        eventDate: { $gte: today },
      })
      .sort({
        eventDate: 1,
        createdAt: -1,
      });

    if (limit > 0) {
      query = query.limit(limit);
    }

    const events = await query.toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      events: events.map(formatEvent),
    });
  } catch (error) {
    console.error("Fetch events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
});

// --------------------------------------------------
// GET - Get six recent upcoming events (Public)
// --------------------------------------------------

router.get("/recent", async (req, res) => {
  try {
    const db = getDB();
    const eventsCollection = db.collection("events");

    const events = await eventsCollection
      .find({
        eventDate: { $gte: getToday() },
      })
      .sort({
        eventDate: 1,
        createdAt: -1,
      })
      .limit(6)
      .toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      events: events.map(formatEvent),
    });
  } catch (error) {
    console.error("Recent events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent events",
    });
  }
});

// --------------------------------------------------
// GET - Test route (Public)
// --------------------------------------------------

router.get("/test", (req, res) => {
  try {
    const db = getDB();

    return res.status(200).json({
      success: true,
      message: "Event routes are working!",
      database: db.databaseName,
    });
  } catch (error) {
    console.error("Test route error:", error);

    return res.status(500).json({
      success: false,
      message: "Database connection is not available",
    });
  }
});

// --------------------------------------------------
// GET - Get events created by logged-in user (Protected)
// --------------------------------------------------

router.get("/my-events", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const events = await eventsCollection
      .find({
        creatorEmail: userEmail,
      })
      .sort({
        eventDate: 1,
        createdAt: -1,
      })
      .toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      events: events.map(formatEvent),
    });
  } catch (error) {
    console.error("My events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your events",
    });
  }
});

// --------------------------------------------------
// GET - Get events joined by logged-in user (Protected)
// --------------------------------------------------

router.get("/joined", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const events = await eventsCollection
      .find({
        joinedUsers: userEmail,
      })
      .sort({
        eventDate: 1,
        createdAt: -1,
      })
      .toArray();

    return res.status(200).json({
      success: true,
      count: events.length,
      events: events.map(formatEvent),
    });
  } catch (error) {
    console.error("Joined events error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch joined events",
    });
  }
});

// --------------------------------------------------
// POST - Join an event (Protected)
// --------------------------------------------------

router.post("/:id/join", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { id } = req.params;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");
    const eventId = new ObjectId(id);

    // Atomic update: prevent duplicate joins, own-event joins,
    // and joining events whose date has passed.
    const result = await eventsCollection.updateOne(
      {
        _id: eventId,
        creatorEmail: { $ne: userEmail },
        eventDate: { $gte: getToday() },
        joinedUsers: { $ne: userEmail },
      },
      {
        $addToSet: {
          joinedUsers: userEmail,
        },
      },
    );

    if (result.modifiedCount === 1) {
      return res.status(200).json({
        success: true,
        message: "You joined the event successfully",
      });
    }

    // Find the reason why the event could not be joined.
    const event = await eventsCollection.findOne(
      { _id: eventId },
      {
        projection: {
          creatorEmail: 1,
          eventDate: 1,
          joinedUsers: 1,
        },
      },
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.creatorEmail?.toLowerCase() === userEmail) {
      return res.status(400).json({
        success: false,
        message: "You cannot join your own event",
      });
    }

    if (event.eventDate < getToday()) {
      return res.status(400).json({
        success: false,
        message: "This event has already passed",
      });
    }

    if (event.joinedUsers?.includes(userEmail)) {
      return res.status(409).json({
        success: false,
        message: "You have already joined this event",
      });
    }

    return res.status(400).json({
      success: false,
      message: "This event is no longer available to join",
    });
  } catch (error) {
    console.error("Join event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to join event",
    });
  }
});

// --------------------------------------------------
// GET - Check participation status (Protected)
// --------------------------------------------------

router.get("/:id/participation", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { id } = req.params;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const event = await eventsCollection.findOne(
      {
        _id: new ObjectId(id),
      },
      {
        projection: {
          creatorEmail: 1,
          joinedUsers: 1,
        },
      },
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      isOwner: event.creatorEmail?.toLowerCase() === userEmail,
      isJoined: event.joinedUsers?.includes(userEmail) || false,
    });
  } catch (error) {
    console.error("Participation status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check participation status",
    });
  }
});

// --------------------------------------------------
// GET - Get single event by ID (Public)
// --------------------------------------------------

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const event = await eventsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      event: formatEvent(event),
    });
  } catch (error) {
    console.error("Get event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get event",
    });
  }
});

// --------------------------------------------------
// DELETE - Delete an event (Protected, owner only)
// --------------------------------------------------

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { id } = req.params;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const result = await eventsCollection.deleteOne({
      _id: new ObjectId(id),
      creatorEmail: userEmail,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete event",
    });
  }
});

// --------------------------------------------------
// PATCH - Update an event (Protected, owner only)
// --------------------------------------------------

router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const { id } = req.params;

    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user email not found",
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const validation = validateEventData(req.body, true);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const db = getDB();
    const eventsCollection = db.collection("events");

    const updatedData = {
      ...validation.data,
      updatedAt: new Date(),
    };

    const result = await eventsCollection.updateOne(
      {
        _id: new ObjectId(id),
        creatorEmail: userEmail,
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

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Update event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
});

export default router;
