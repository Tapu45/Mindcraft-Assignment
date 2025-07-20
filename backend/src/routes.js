const express = require("express");
const router = express.Router();
const sessionStore = require("./sessionStore");

router.post("/events", (req, res) => {
  const event = req.body;
  sessionStore.handleEvent(event);
  res.status(200).json({ message: "Event received" });
});

router.get("/analytics/summary", (req, res) => {
  const summary = sessionStore.getSummary();
  res.status(200).json(summary);
});

router.get("/analytics/sessions", (req, res) => {
  const sessions = sessionStore.getSessions();
  res.status(200).json(sessions);
});

module.exports = router;
