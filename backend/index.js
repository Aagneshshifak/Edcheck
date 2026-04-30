require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { logger, requestLogger, sseHandler } = require("./utils/serverLogger");
const responseTimeTracker = require("./utils/responseTimeTracker");

const app = express();
const Routes = require("./routes/route.js");
const aiRoutes = require("./routes/aiRoutes.js");
const { startAllAISchedulers } = require("./services/aiScheduler");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const PORT = process.env.PORT || 5001;

app.use(express.json({ limit: "10mb" }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please slow down." },
    skip: (req) => req.path === "/api/logs/stream",
});
app.use("/api", generalLimiter);

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts. Please wait a minute." },
});
app.use("/AdminLogin",   authLimiter);
app.use("/TeacherLogin", authLimiter);
app.use("/StudentLogin", authLimiter);
app.use("/ParentLogin",  authLimiter);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    "http://localhost:3000",
    "https://edcheck-topaz.vercel.app",
];

// Also allow any *.onrender.com subdomain (covers Render preview + production URLs)
const isAllowedOrigin = (origin) => {
    if (!origin) return true; // server-to-server / curl
    if (allowedOrigins.includes(origin)) return true;
    if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) return true;
    return false;
};

app.use(cors({
    origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            console.warn("CORS blocked origin:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("*", cors());

// ── Response time tracking ────────────────────────────────────────────────────
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => responseTimeTracker.record(Date.now() - start));
    next();
});

// ── Request logger ────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── SSE log stream ────────────────────────────────────────────────────────────
app.get("/api/logs/stream", sseHandler);

// ── Static uploads ────────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Health / root route ───────────────────────────────────────────────────────
app.get("/", (req, res) => {
    res.json({ status: "ok", message: "School Management API is running" });
});

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
        logger.info("Connected to MongoDB");
        startAllAISchedulers();
    })
    .catch((err) => {
        logger.error("MongoDB connection failed", { message: err.message });
        process.exit(1);
    });

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/", Routes);
app.use("/api/ai", aiRoutes);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server started on port ${PORT}`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});
