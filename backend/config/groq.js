const Groq = require('groq-sdk');

// ── Centralized Model Configuration ──────────────────────────────────────────
// All model names are configured here via environment variables.
// No other file in the codebase should hardcode a Groq model string.
//
// GROQ_MODEL        — primary model for analysis, study plans, staff reports
// GROQ_MODEL_FAST   — lighter model for quick operations (notes, routines)
//
// Default: openai/gpt-oss-120b (primary), llama-3.1-8b-instant (fast)
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_MODELS = {
    // Fast model for lightweight tasks (class notes, daily routines)
    FAST:      process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',

    // Balanced model — same as primary for consistency
    BALANCED:  process.env.GROQ_MODEL      || 'openai/gpt-oss-120b',

    // Powerful model — same as primary
    POWERFUL:  process.env.GROQ_MODEL      || 'openai/gpt-oss-120b',

    // Dedicated analysis model for student performance, study plans, staff reports
    ANALYSIS:  process.env.GROQ_MODEL      || 'openai/gpt-oss-120b',
};

// Lazy singleton — created on first use so dotenv has already run by then
let _groq = null;

function getGroq() {
    if (!_groq) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error('GROQ_API_KEY environment variable is missing or empty');
        }
        _groq = new Groq({ apiKey });
    }
    return _groq;
}

// Proxy object so existing code using `groq.chat.completions.create(...)` works unchanged
const groq = new Proxy({}, {
    get(_, prop) {
        return getGroq()[prop];
    },
});

module.exports = { groq, GROQ_MODELS };
