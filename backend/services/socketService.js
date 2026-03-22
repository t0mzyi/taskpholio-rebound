const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger");
const { redisClient, redisSub } = require("./redisService");

let io;
// Map to keep track of connected users: userId -> socketId
const userSockets = new Map();

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    },
  });

  if (redisClient && redisSub) {
    io.adapter(createAdapter(redisClient, redisSub));
    logger.info("Socket.io attached to horizontal Redis Adapter cluster.");
  }

  // Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication error: No token provided"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return next(new Error("Authentication error: User not found"));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    userSockets.set(userId, socket.id);
    
    logger.info(`Socket connected: ${socket.id} (User: ${userId})`);

    // Broadcast online status to others
    socket.broadcast.emit("user_status", { userId, status: "online" });

    // Send the current list of online users to the newly connected user
    const onlineUsers = Array.from(userSockets.keys());
    socket.emit("online_users", onlineUsers);

    socket.on("disconnect", () => {
      userSockets.delete(userId);
      logger.info(`Socket disconnected: ${socket.id} (User: ${userId})`);
      // Broadcast offline status
      socket.broadcast.emit("user_status", { userId, status: "offline" });
    });
  });

  return io;
};

const getIo = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

// Emit event to a specific user
const emitToUser = (userId, event, data) => {
  const socketId = userSockets.get(userId.toString());
  if (socketId && io) {
    io.to(socketId).emit(event, data);
  }
};

// Emit event to multiple users
const emitToUsers = (userIds, event, data) => {
  userIds.forEach((userId) => emitToUser(userId, event, data));
};

module.exports = {
  initializeSocket,
  getIo,
  emitToUser,
  emitToUsers,
};
