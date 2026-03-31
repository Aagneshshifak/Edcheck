/**
 * Lightweight in-process server logger with SSE broadcast.
 * No external dependencies required.
 */

const clients = new Set();

// ── Internal emit ────────────────────────────────────────────────────────────

const emit = (level, message, meta = {}) => {
    const entry = JSON.stringify({
        level,
        message,
        meta,
        time: new Date().toISOString(),
    });

    for (const res of clients) {
        try {
            res.write(`data: ${entry}\n\n`);
        } catch (_) {
            clients.delete(res);
        }
    }

    // Also mirror to process stdout
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️ ' : level === 'info' ? 'ℹ️ ' : '📋';
    console.log(`${prefix} [${level.toUpperCase()}] ${message}`, Object.keys(meta).length ? meta : '');
};

// ── Public logger ────────────────────────────────────────────────────────────

const logger = {
    info:  (msg, meta) => emit('info',  msg, meta),
    warn:  (msg, meta) => emit('warn',  msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
    debug: (msg, meta) => emit('debug', msg, meta),
};

// ── Express middleware: log every request/response ───────────────────────────

const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
        const ms     = Date.now() - start;
        const status = res.statusCode;
        const level  = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
        emit(level, `${method} ${originalUrl} → ${status}`, { status, ms: `${ms}ms` });
    });

    next();
};

// ── SSE handler: GET /api/logs/stream ────────────────────────────────────────

const sseHandler = (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send a heartbeat immediately so the client knows it's connected
    res.write(`data: ${JSON.stringify({ level: 'info', message: '🔌 Log stream connected', time: new Date().toISOString() })}\n\n`);

    clients.add(res);

    // Heartbeat every 25 s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch (_) { /* ignore */ }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(res);
    });
};

module.exports = { logger, requestLogger, sseHandler };
