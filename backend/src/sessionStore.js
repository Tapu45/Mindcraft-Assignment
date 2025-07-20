const { v4: uuidv4 } = require("uuid");

const sessions = new Map(); // sessionId => { pages: [], startTime, lastEventTime }
let io = null;

const stats = {
  totalActive: 0,
  totalToday: 0,
  pagesVisited: {}, // { '/home': 10, '/products': 5 }
  visitorTimeline: [], // { timestamp, count }
};

function handleEvent(event) {
  const {
    type,
    page,
    sessionId,
    timestamp,
    country,
    metadata = {},
  } = event;

  // Track session journey
  let session = sessions.get(sessionId);
  const eventTime = new Date(timestamp);

  if (!session) {
    session = {
      sessionId,
      pages: [],
      startTime: eventTime,
      lastEventTime: eventTime,
      country,
      metadata,
    };
    sessions.set(sessionId, session);

    stats.totalActive++;
    stats.totalToday++;
  }

  if (type === "pageview" || type === "click") {
    if (!session.pages.includes(page)) {
      session.pages.push(page);
    }
    session.lastEventTime = eventTime;

    // Update page view count
    stats.pagesVisited[page] = (stats.pagesVisited[page] || 0) + 1;

    // Push to visitor timeline for charting (last 10 minutes)
    stats.visitorTimeline.push({ timestamp: eventTime.toISOString(), count: 1 });

    // Emit visitor_update + session_activity
    emitVisitorUpdate(event);
    emitSessionActivity(session);
  }

 if (type === "session_end") {
    sessions.delete(sessionId);
    stats.totalActive--;
    emitVisitorUpdate(event);
    io && io.emit("session_activity", {
      type: "session_activity",
      data: {
        sessionId,
        currentPage: null,
        journey: [],
        duration: 0,
        ended: true,
      },
    });
  }

  // Check for alert
  detectVisitorSpike();
}

function emitVisitorUpdate(event) {
  if (!io) return;
  io.emit("visitor_update", {
    type: "visitor_update",
    data: {
      event,
      stats: {
        totalActive: stats.totalActive,
        totalToday: stats.totalToday,
        pagesVisited: stats.pagesVisited,
      },
    },
  });
}

function emitSessionActivity(session) {
  if (!io) return;
  const duration = Math.floor((new Date() - session.startTime) / 1000); // seconds
  io.emit("session_activity", {
    type: "session_activity",
    data: {
      sessionId: session.sessionId,
      currentPage: session.pages[session.pages.length - 1],
      journey: session.pages,
      duration,
    },
  });
}

function detectVisitorSpike() {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  // Remove old entries
  stats.visitorTimeline = stats.visitorTimeline.filter(
    (entry) => new Date(entry.timestamp).getTime() > oneMinuteAgo
  );

  const visitorsLastMinute = stats.visitorTimeline.reduce((sum, e) => sum + e.count, 0);

  let level = null;
  if (visitorsLastMinute >= 50) level = "milestone";
  else if (visitorsLastMinute >= 35) level = "warning";
  else if (visitorsLastMinute >= 25) level = "info";

  if (level) {
    io.emit("alert", {
      type: "alert",
      data: {
        level,
        message: "New visitor spike detected!",
        details: { visitorsLastMinute },
      },
    });
  }
}

function getSummary() {
  return {
    totalActive: stats.totalActive,
    totalToday: stats.totalToday,
    pagesVisited: stats.pagesVisited,
  };
}

function getSessions() {
  const output = [];
  sessions.forEach((session) => {
    const duration = Math.floor((new Date() - session.startTime) / 1000);
    output.push({
      sessionId: session.sessionId,
      country: session.country,
      currentPage: session.pages[session.pages.length - 1],
      journey: session.pages,
      duration,
    });
  });
  return output;
}

function getFilteredStats(filter = {}) {
  const { country, page } = filter;
  let filteredSessions = Array.from(sessions.values());

  if (country) {
    filteredSessions = filteredSessions.filter((s) => s.country === country);
  }

  if (page) {
    filteredSessions = filteredSessions.filter((s) => s.pages.includes(page));
  }

  const pagesVisited = {};
  filteredSessions.forEach((s) => {
    s.pages.forEach((p) => {
      pagesVisited[p] = (pagesVisited[p] || 0) + 1;
    });
  });

  return {
    totalActive: filteredSessions.length,
    totalToday: filteredSessions.length, // <-- FIX: Only count filtered sessions
    pagesVisited,
  };
}

function setIO(ioInstance) {
  io = ioInstance;
}

function resetStats() {
  sessions.clear();
  stats.totalActive = 0;
  stats.totalToday = 0;
  stats.pagesVisited = {};
  stats.visitorTimeline = [];
}

function getFilteredSessions(filter = {}) {
  const { country, page } = filter;
  let filteredSessions = Array.from(sessions.values());

  if (country) {
    filteredSessions = filteredSessions.filter((s) => s.country === country);
  }
  if (page) {
    filteredSessions = filteredSessions.filter((s) => s.pages.includes(page));
  }

  return filteredSessions.map((session) => {
    const duration = Math.floor((new Date() - session.startTime) / 1000);
    return {
      sessionId: session.sessionId,
      country: session.country,
      currentPage: session.pages[session.pages.length - 1],
      journey: session.pages,
      duration,
    };
  });
}

module.exports = {
  handleEvent,
  getSummary,
  getSessions,
  getFilteredStats,
  setIO,
  resetStats,
  getFilteredSessions,
};
