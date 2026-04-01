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
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10mb" }));
app.use(cors());

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
    .then(() => logger.info("Connected to MongoDB"))
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
