const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const { configureSocket } = require("./socketio");
const middleware = require("./middleware");
const routes = require("./routes");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*" }
});

// Middleware
middleware(app);

// Routes
app.use("/api", routes);

// WebSocket setup
configureSocket(io);


const path = require("path");
app.use(express.static(path.join(__dirname, "../../frontend")));


const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
