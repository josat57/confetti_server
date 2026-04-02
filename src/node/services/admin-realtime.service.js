import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

class AdminRealtimeService {
  constructor() {
    this.io = null;
    this.connectedAdmins = new Map();
    this.rooms = new Map();
  }

  // Initialize Socket.IO
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      path: "/admin-socket",
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    console.log("✅ Admin Real-time service initialized");
  }

  // Setup authentication middleware
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.split(" ")[1];

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        // Verify JWT token
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET
        );

        if (decoded.type !== "admin") {
          return next(new Error("Admin access required"));
        }

        // Get admin user
        const admin = await User.findById(decoded.id).select("-password");
        if (!admin) {
          return next(new Error("Admin not found"));
        }

        socket.admin = admin;
        next();
      } catch (error) {
        next(new Error("Authentication failed"));
      }
    });
  }

  // Setup event handlers
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);

      socket.on("disconnect", () => this.handleDisconnect(socket));
      socket.on("join_room", (data) => this.handleJoinRoom(socket, data));
      socket.on("leave_room", (data) => this.handleLeaveRoom(socket, data));
      socket.on("subscribe_dashboard", () =>
        this.handleSubscribeDashboard(socket)
      );
      socket.on("unsubscribe_dashboard", () =>
        this.handleUnsubscribeDashboard(socket)
      );
      socket.on("ping", () => socket.emit("pong", { timestamp: Date.now() }));
    });
  }

  // Handle new connection
  handleConnection(socket) {
    const adminId = socket.admin._id.toString();

    // Store connection
    if (!this.connectedAdmins.has(adminId)) {
      this.connectedAdmins.set(adminId, new Set());
    }
    this.connectedAdmins.get(adminId).add(socket.id);

    // Send connection success
    socket.emit("connected", {
      adminId,
      timestamp: new Date(),
      message: "Connected to admin real-time service",
    });

    // Broadcast admin online status
    this.broadcastAdminStatus(adminId, "online");

    console.log(`Admin ${socket.admin.email} connected (${socket.id})`);
  }

  // Handle disconnection
  handleDisconnect(socket) {
    const adminId = socket.admin._id.toString();

    // Remove connection
    if (this.connectedAdmins.has(adminId)) {
      this.connectedAdmins.get(adminId).delete(socket.id);

      // If no more connections, remove admin
      if (this.connectedAdmins.get(adminId).size === 0) {
        this.connectedAdmins.delete(adminId);
        this.broadcastAdminStatus(adminId, "offline");
      }
    }

    // Remove from all rooms
    this.rooms.forEach((members, room) => {
      members.delete(socket.id);
    });

    console.log(`Admin ${socket.admin.email} disconnected (${socket.id})`);
  }

  // Handle join room
  handleJoinRoom(socket, data) {
    const { room } = data;

    if (!room) {
      socket.emit("error", { message: "Room name required" });
      return;
    }

    socket.join(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(socket.id);

    socket.emit("room_joined", { room, timestamp: new Date() });
    console.log(`Admin ${socket.admin.email} joined room: ${room}`);
  }

  // Handle leave room
  handleLeaveRoom(socket, data) {
    const { room } = data;

    if (!room) {
      socket.emit("error", { message: "Room name required" });
      return;
    }

    socket.leave(room);

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(socket.id);
    }

    socket.emit("room_left", { room, timestamp: new Date() });
  }

  // Handle dashboard subscription
  handleSubscribeDashboard(socket) {
    socket.join("dashboard");
    socket.emit("dashboard_subscribed", { timestamp: new Date() });
  }

  // Handle dashboard unsubscription
  handleUnsubscribeDashboard(socket) {
    socket.leave("dashboard");
    socket.emit("dashboard_unsubscribed", { timestamp: new Date() });
  }

  // ==================== Broadcast Methods ====================

  // Broadcast dashboard update
  broadcastDashboardUpdate(data) {
    if (!this.io) return;

    this.io.to("dashboard").emit("dashboard_update", {
      ...data,
      timestamp: new Date(),
    });
  }

  // Broadcast new user
  broadcastNewUser(user) {
    if (!this.io) return;

    this.io.to("dashboard").emit("new_user", {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      timestamp: new Date(),
    });
  }

  // Broadcast new vendor
  broadcastNewVendor(vendor) {
    if (!this.io) return;

    this.io.to("dashboard").emit("new_vendor", {
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        status: vendor.status,
        createdAt: vendor.createdAt,
      },
      timestamp: new Date(),
    });
  }

  // Broadcast new transaction
  broadcastNewTransaction(transaction) {
    if (!this.io) return;

    this.io.to("dashboard").emit("new_transaction", {
      transaction: {
        _id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt,
      },
      timestamp: new Date(),
    });
  }

  // Broadcast new ticket
  broadcastNewTicket(ticket) {
    if (!this.io) return;

    this.io.to("dashboard").emit("new_ticket", {
      ticket: {
        _id: ticket._id,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      timestamp: new Date(),
    });
  }

  // Broadcast notification
  broadcastNotification(adminId, notification) {
    if (!this.io) return;

    const sockets = this.connectedAdmins.get(adminId.toString());
    if (sockets) {
      sockets.forEach((socketId) => {
        this.io.to(socketId).emit("notification", {
          notification,
          timestamp: new Date(),
        });
      });
    }
  }

  // Broadcast to all admins
  broadcastToAllAdmins(event, data) {
    if (!this.io) return;

    this.io.emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  // Broadcast to specific room
  broadcastToRoom(room, event, data) {
    if (!this.io) return;

    this.io.to(room).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  // Broadcast admin status
  broadcastAdminStatus(adminId, status) {
    if (!this.io) return;

    this.io.emit("admin_status", {
      adminId,
      status,
      timestamp: new Date(),
    });
  }

  // Broadcast audit log
  broadcastAuditLog(log) {
    if (!this.io) return;

    this.io.to("dashboard").emit("audit_log", {
      log: {
        _id: log._id,
        admin: log.admin,
        action: log.action,
        resource: log.resource,
        createdAt: log.createdAt,
      },
      timestamp: new Date(),
    });
  }

  // Broadcast system alert
  broadcastSystemAlert(alert) {
    if (!this.io) return;

    this.io.emit("system_alert", {
      ...alert,
      timestamp: new Date(),
    });
  }

  // ==================== Status Methods ====================

  // Get connected admins
  getConnectedAdmins() {
    const admins = [];
    this.connectedAdmins.forEach((sockets, adminId) => {
      admins.push({
        adminId,
        connectionCount: sockets.size,
        sockets: Array.from(sockets),
      });
    });
    return admins;
  }

  // Get room members
  getRoomMembers(room) {
    if (!this.rooms.has(room)) {
      return [];
    }
    return Array.from(this.rooms.get(room));
  }

  // Check if admin is online
  isAdminOnline(adminId) {
    return this.connectedAdmins.has(adminId.toString());
  }

  // Get connection stats
  getConnectionStats() {
    return {
      totalConnections: Array.from(this.connectedAdmins.values()).reduce(
        (sum, sockets) => sum + sockets.size,
        0
      ),
      uniqueAdmins: this.connectedAdmins.size,
      activeRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([room, members]) => ({
        room,
        memberCount: members.size,
      })),
    };
  }

  // ==================== Activity Feed ====================

  // Broadcast activity
  broadcastActivity(activity) {
    if (!this.io) return;

    this.io.to("dashboard").emit("activity", {
      activity: {
        type: activity.type,
        message: activity.message,
        admin: activity.admin,
        resource: activity.resource,
        timestamp: new Date(),
      },
    });
  }

  // Get recent activities
  async getRecentActivities(limit = 50) {
    const activities = await AuditLog.find()
      .populate("admin", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return activities.map((log) => ({
      type: log.action,
      message: this.formatActivityMessage(log),
      admin: log.admin,
      resource: log.resource,
      timestamp: log.createdAt,
    }));
  }

  // Format activity message
  formatActivityMessage(log) {
    const adminName = log.admin
      ? `${log.admin.firstName} ${log.admin.lastName}`
      : "Admin";
    const action = log.action.replace(/_/g, " ");
    const resource = log.resource || "item";

    return `${adminName} ${action} ${resource}`;
  }
}

export default new AdminRealtimeService();
