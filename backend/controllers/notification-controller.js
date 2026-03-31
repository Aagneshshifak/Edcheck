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
const createNotifications = async (userIds, message, type) => {
    const docs = userIds.map((userId) => ({ userId, message, type }));
    const inserted = await Notification.insertMany(docs);
    // Push each notification to its connected client immediately
    for (const n of inserted) {
        pushToUser(n.userId, n.toObject());
    }
};

// GET /Notifications/stream/:userId  — SSE endpoint
const streamNotifications = (req, res) => {
    const { userId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
    res.flushHeaders();

    // Send a heartbeat comment every 25s to keep the connection alive
    const heartbeat = setInterval(() => {
        try { res.write(": heartbeat\n\n"); } catch (_) {}
    }, 25000);

    addClient(userId, res);

    req.on("close", () => {
        clearInterval(heartbeat);
        removeClient(userId, res);
    });
};

// GET /Notifications/:userId  — fetch history, newest first
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.params.userId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json(notifications);
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

module.exports = {
    createNotifications,
    streamNotifications,
    getNotifications,
    markAsRead,
    markAllAsRead,
};
