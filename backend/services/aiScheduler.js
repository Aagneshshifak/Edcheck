/**
 * AI Scheduler — Unified entry point for all AI cron jobs.
 *
 * Consolidates and delegates to the three existing schedulers:
 *   - reminder-scheduler      (teacher class reminders)
 *   - ai-analysis-scheduler   (weak topic detection, nightly)
 *   - student-ai-scheduler    (study plan, daily routine, test prep)
 *   - admin-ai-scheduler      (admin analytics after major tests)
 *
 * This file satisfies the requirement for services/aiScheduler.js
 * while reusing all existing scheduler logic without duplication.
 *
 * Usage (in index.js):
 *   const { startAllAISchedulers } = require('./services/aiScheduler');
 *   startAllAISchedulers();
 */

const { logger } = require('../utils/serverLogger');

// ── Import all individual schedulers ─────────────────────────────────────────
const { startReminderScheduler }     = require('./reminder-scheduler');
const { startAIAnalysisScheduler }   = require('./ai-analysis-scheduler');
const { startStudentAIScheduler }    = require('./student-ai-scheduler');

// Admin AI scheduler — may not exist yet, load safely
let startAdminAIScheduler = null;
try {
    startAdminAIScheduler = require('./admin-ai-scheduler').startAdminAIScheduler;
} catch (_) {
    // Admin AI scheduler not yet available — skip
}

// ── Unified start function ────────────────────────────────────────────────────

/**
 * Start all AI schedulers.
 * Called once after MongoDB connects in index.js.
 *
 * Schedule summary:
 *   06:00 IST — Student daily routine generation
 *   06:30 IST — Student test preparation generation
 *   02:00 IST — Admin nightly school analytics
 *   02:00 IST — Weak topic detection (teacher AI)
 *   23:00 IST — Student study plan regeneration
 *   Before class — Teacher class reminders (reminder-scheduler)
 */
function startAllAISchedulers() {
    try {
        startReminderScheduler();
        logger.info('aiScheduler: reminder-scheduler started');
    } catch (err) {
        logger.error('aiScheduler: reminder-scheduler failed to start', { err: err.message });
    }

    try {
        startAIAnalysisScheduler();
        logger.info('aiScheduler: ai-analysis-scheduler started');
    } catch (err) {
        logger.error('aiScheduler: ai-analysis-scheduler failed to start', { err: err.message });
    }

    try {
        startStudentAIScheduler();
        logger.info('aiScheduler: student-ai-scheduler started');
    } catch (err) {
        logger.error('aiScheduler: student-ai-scheduler failed to start', { err: err.message });
    }

    if (startAdminAIScheduler) {
        try {
            startAdminAIScheduler();
            logger.info('aiScheduler: admin-ai-scheduler started');
        } catch (err) {
            logger.error('aiScheduler: admin-ai-scheduler failed to start', { err: err.message });
        }
    }

    logger.info('aiScheduler: all AI schedulers started');
}

module.exports = { startAllAISchedulers };
