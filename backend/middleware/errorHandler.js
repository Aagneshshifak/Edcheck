/**
 * Centralized Error Handler Middleware
 *
 * Catches all errors passed via next(err) and returns consistent JSON responses.
 *
 * Response format:
 * {
 *   "error": {
 *     "message": string,
 *     "status": number,
 *     "timestamp": ISO string,
 *     "path": string        (request path)
 *   }
 * }
 *
 * Usage in index.js (MUST be registered AFTER all routes):
 *   const { errorHandler } = require('./middleware/errorHandler');
 *   app.use(errorHandler);
 */

const { logger } = require('../utils/serverLogger');

/**
 * Map known error types to HTTP status codes.
 */
function resolveStatus(err) {
    // Explicit status set by controller
    if (err.statusCode && typeof err.statusCode === 'number') return err.statusCode;
    if (err.status    && typeof err.status    === 'number') return err.status;

    // Mongoose validation error
    if (err.name === 'ValidationError') return 400;

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') return 400;

    // Mongoose duplicate key
    if (err.code === 11000) return 409;

    // JWT errors
    if (err.name === 'JsonWebTokenError')  return 401;
    if (err.name === 'TokenExpiredError')  return 403;

    // Groq / AI errors
    if (err.isGroqError) return 503;

    // Default
    return 500;
}

/**
 * Sanitize error message for client response.
 * Never expose internal stack traces or raw DB errors in production.
 */
function resolveMessage(err, status) {
    // Always use explicit message if set
    if (err.message) {
        // Don't expose internal Mongoose/DB messages in production
        if (process.env.NODE_ENV === 'production' && status >= 500) {
            return 'Internal server error';
        }
        return err.message;
    }
    return 'An unexpected error occurred';
}

/**
 * Express error-handling middleware.
 * Must have exactly 4 parameters (err, req, res, next).
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status  = resolveStatus(err);
    const message = resolveMessage(err, status);

    // Log server errors (5xx) with full details
    if (status >= 500) {
        logger.error(`errorHandler: ${req.method} ${req.path} → ${status}`, {
            message: err.message,
            stack:   err.stack?.split('\n').slice(0, 5).join(' | '),
        });
    }

    // Log client errors (4xx) at warn level
    if (status >= 400 && status < 500) {
        logger.warn(`errorHandler: ${req.method} ${req.path} → ${status}`, { message });
    }

    return res.status(status).json({
        error: {
            message,
            status,
            timestamp: new Date().toISOString(),
            path: req.path,
        },
    });
};

/**
 * 404 handler — register BEFORE errorHandler but AFTER all routes.
 */
const notFoundHandler = (req, res, next) => {
    const err = new Error(`Route not found: ${req.method} ${req.path}`);
    err.statusCode = 404;
    next(err);
};

module.exports = { errorHandler, notFoundHandler };
