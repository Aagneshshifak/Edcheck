const Notification = require("../models/notificationSchema");

// In-memory map of userId → SSE response objects
const clients = new Map(); // userId (string) → Set<res>

// Register an SSE client
const addClient = (userId, res) => {
    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId).add(res);
};

// Remove an SSE client
const removeClient = (userId, res) => {
    const set = clients.get(userId);
    if (set) {
        set.delete(res);
        if (set.size === 0) clients.delete(userId);
    }
};

// Push a notification object to all connected clients for a user
const pushToUser = (userId, notification) => {
    const set = clients.get(String(userId));
    if (!set) return;
    const data = `data: ${JSON.stringify(notification)}\n\n`;
    for (const res of set) {
        try { res.write(data); } catch (_) {}
    }
};

// Helper — create one or many notifications and push via SSE
const createNotifications = async (userIds, message, type, extra = {}) => {
    const docs = userIds.map((userId) => ({ userId, message, type, ...extra }));
    const inserted = await Notification.insertMany(docs);
    for (const n of inserted) {
        pushToUser(n.userId, n.toObject());
    }
};

// GET /Notifications/stream/:userId  — SSE endpoint
const streamNotifications = (req, res) => {
    const { userId } = req.params;

    // Do NOT set Access-Control-Allow-Origin here — it is already handled
    // by the global cors() middleware in index.js. Setting it twice causes
    // browsers to reject the response with a CORS error.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx/GCP buffering
    res.flushHeaders();

    // Send a heartbeat comment every 20s to keep the connection alive
    // (GCP Cloud Run has a 60s idle timeout; 20s keeps us well under it)
    res.write("retry: 3000\n\n"); // tell browser to reconnect after 3s if dropped
    const heartbeat = setInterval(() => {
        try { res.write(": heartbeat\n\n"); } catch (_) {}
    }, 20000);

    addClient(userId, res);

    req.on("close", () => {
        clearInterval(heartbeat);
        removeClient(userId, res);
    });
};

// GET /Notifications/:userId?before=<ISO_date>&limit=20  — cursor-based lazy load
const getNotifications = async (req, res) => {
    try {
        const limit  = Math.min(50, parseInt(req.query.limit) || 20);
        const before = req.query.before ? new Date(req.query.before) : new Date();

        const query = { userId: req.params.userId, createdAt: { $lt: before } };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const hasMore = notifications.length === limit;
        const nextCursor = hasMore
            ? notifications[notifications.length - 1].createdAt.toISOString()
            : null;

        res.json({ notifications, hasMore, nextCursor });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Notifications/read/:id
const markAsRead = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { readStatus: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Notifications/readAll/:userId
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.params.userId, readStatus: false },
            { readStatus: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Notifications/:id  — delete a single notification
const deleteNotificationById = async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Notifications/read/:userId  — delete all read notifications for a user
const deleteReadNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.params.userId, readStatus: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createNotifications,
    streamNotifications,
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotificationById,
    deleteReadNotifications,
};
