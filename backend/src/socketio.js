const sessionStore = require("./sessionStore");

let connectedDashboards = 0;

function configureSocket(io) {
  io.on("connection", (socket) => {
    connectedDashboards++;
    console.log("Dashboard connected:", socket.id);

    // Notify all dashboards
    io.emit("user_connected", {
      type: "user_connected",
      data: {
        totalDashboards: connectedDashboards,
        connectedAt: new Date().toISOString(),
      },
    });

    // Send initial stats
    socket.emit("visitor_update", {
      type: "visitor_update",
      data: {
        event: null,
        stats: sessionStore.getSummary(),
      },
    });

    // Listen for dashboard actions
    // ...existing code...
    socket.on("request_detailed_stats", (filter) => {
      const filtered = sessionStore.getFilteredStats(filter);
      const filteredSessions = sessionStore.getFilteredSessions(filter);
      socket.emit("filtered_stats", {
        type: "filtered_stats",
        data: { stats: filtered, sessions: filteredSessions },
      });
    });
    // ...existing code...

    socket.on("reset_stats", () => {
      sessionStore.resetStats();
      io.emit("alert", {
        type: "alert",
        data: {
          level: "info",
          message: "Statistics have been reset by a dashboard.",
          details: {},
        },
      });
      io.emit("visitor_update", {
        type: "visitor_update",
        data: {
          event: null,
          stats: sessionStore.getSummary(),
        },
      });
    });


    socket.on("track_dashboard_action", (data) => {
      console.log("Dashboard action tracked:", data);
    });

    socket.on("disconnect", () => {
      connectedDashboards--;
      io.emit("user_disconnected", {
        type: "user_disconnected",
        data: {
          totalDashboards: connectedDashboards,
        },
      });
      console.log("Dashboard disconnected:", socket.id);
    });

    // Store reference for external emit
    sessionStore.setIO(io);
  });
}

module.exports = { configureSocket };
