const dotenv = require("dotenv");
dotenv.config();

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
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10mb" }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// General API rate limit: 200 requests per minute per IP
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down.' },
    skip: (req) => req.path === '/api/logs/stream', // skip SSE stream
});
app.use('/api', generalLimiter);

// Auth endpoints: stricter limit — 20 login attempts per minute per IP
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please wait a minute.' },
});
app.use('/AdminLogin',   authLimiter);
app.use('/TeacherLogin', authLimiter);
app.use('/StudentLogin', authLimiter);
app.use('/ParentLogin',  authLimiter);

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production set FRONTEND_URL (and optionally ALLOWED_ORIGINS) in .env
// e.g. FRONTEND_URL=https://yourschool.netlify.app
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'https://edcheck-topaz.vercel.app',
      ];

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
        startAllAISchedulers();
    })
    .catch((err) => {
        logger.error("MongoDB connection failed", { message: err.message });
        process.exit(1);
    });

app.use("/", Routes);
// ── Unified AI routes (new canonical paths) ───────────────────────────────────
app.use("/api/ai", aiRoutes);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server started on port ${PORT}`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});
