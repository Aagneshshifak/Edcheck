const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODELS = {
    FAST: 'llama3-8b-8192',
    BALANCED: 'mixtral-8x7b-32768',
    POWERFUL: 'llama3-70b-8192',
};

module.exports = { groq, GROQ_MODELS };
