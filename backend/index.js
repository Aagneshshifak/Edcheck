const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const { logger, requestLogger, sseHandler } = require("./utils/serverLogger");
const responseTimeTracker = require("./utils/responseTimeTracker");

const app = express();
const Routes = require("./routes/route.js");
const { startReminderScheduler } = require("./services/reminder-scheduler");
const { startAIAnalysisScheduler } = require("./services/ai-analysis-scheduler");
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10mb" }));

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production set FRONTEND_URL (and optionally ALLOWED_ORIGINS) in .env
// e.g. FRONTEND_URL=https://yourschool.netlify.app
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [process.env.FRONTEND_URL || 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow server-to-server / curl (no origin) and whitelisted origins
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Log rejected origin for debugging
            logger.warn(`CORS: origin ${origin} not in allowed list: ${allowedOrigins.join(', ')}`);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Response time tracking middleware (before routes)
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => responseTimeTracker.record(Date.now() - start));
    next();
});

// Request/response logger (before routes)
app.use(requestLogger);

// SSE log stream endpoint
app.get("/api/logs/stream", sseHandler);

// Serve uploaded assignment files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
        logger.info("Connected to MongoDB");
        startReminderScheduler();
        startAIAnalysisScheduler();
    })
    .catch((err) => {
        logger.error("MongoDB connection failed", { message: err.message });
        process.exit(1);
    });

app.use("/", Routes);

const server = app.listen(PORT, () => {
    logger.info(`Server started at http://localhost:${PORT}`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});
