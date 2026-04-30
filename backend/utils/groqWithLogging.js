/**
 * groqWithLogging
 *
 * Drop-in replacement for groq.chat.completions.create() that automatically
 * logs every call to the AILogs collection.
 *
 * Usage (in any controller):
 *   const { groqCall } = require('../utils/groqWithLogging');
 *
 *   const response = await groqCall({
 *     userId:       req.user.id,
 *     userRole:     req.user.role.toLowerCase(),
 *     endpointName: 'predict-student-risk',
 *     messages:     [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
 *     model:        GROQ_MODELS.BALANCED,
 *   });
 *
 * The function returns the same response object as groq.chat.completions.create().
 */

const { groq, GROQ_MODELS } = require('../config/groq');
const AILog = require('../models/aiLogSchema');
const { logger } = require('./serverLogger');

/**
 * @param {object} opts
 * @param {string}   opts.userId        - Requesting user ID
 * @param {string}   opts.userRole      - 'teacher' | 'student' | 'admin' | 'system'
 * @param {string}   opts.endpointName  - Logical endpoint name for logging
 * @param {string}   opts.model         - Groq model string
 * @param {Array}    opts.messages      - Messages array for chat completion
 * @param {object}   [opts.extra]       - Any extra params for groq.chat.completions.create
 * @returns {Promise<object>} Groq response
 */
async function groqCall({ userId, userRole, endpointName, model, messages, extra = {} }) {
    const start = Date.now();
    let success = true;
    let errorMessage = '';
    let responseSummary = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let response = null;

    // Build prompt summary from the user message
    const userMsg = messages.find(m => m.role === 'user');
    const promptSummary = (userMsg?.content || '').slice(0, 2000);

    try {
        response = await groq.chat.completions.create({
            model,
            messages,
            ...extra,
        });

        const usage = response?.usage;
        if (usage) {
            promptTokens     = usage.prompt_tokens     || 0;
            completionTokens = usage.completion_tokens || 0;
            totalTokens      = usage.total_tokens      || 0;
        }

        const content = response?.choices?.[0]?.message?.content ?? '';
        responseSummary = content.slice(0, 2000);

    } catch (err) {
        success = false;
        errorMessage = err.message || 'Unknown error';
        throw err;
    } finally {
        const responseTimeMs = Date.now() - start;

        // Non-blocking log write
        AILog.create({
            userId:          userId || 'system',
            userRole:        (userRole || 'system').toLowerCase(),
            endpointName,
            model:           model || '',
            promptSummary,
            responseSummary,
            promptTokens,
            completionTokens,
            totalTokens,
            responseTimeMs,
            success,
            errorMessage,
            fromCache:       false,
        }).catch(logErr => {
            logger.warn('groq-logger: failed to write AI log', { err: logErr.message });
        });
    }

    return response;
}

module.exports = { groqCall, GROQ_MODELS };
