const Groq = require('groq-sdk');

const GROQ_MODELS = {
    FAST: 'llama-3.1-8b-instant',
    BALANCED: 'llama-3.3-70b-versatile',
    POWERFUL: 'llama-3.3-70b-versatile',
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
