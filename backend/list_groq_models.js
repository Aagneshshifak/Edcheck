require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function listModels() {
    try {
        const response = await groq.models.list();
        const activeModels = response.data.filter(m => !m.id.includes('whisper') && !m.id.includes('vision')).map(m => m.id);
        console.log("Available models:", activeModels);
    } catch (err) {
        console.error("Error fetching models:", err.message);
    }
}
listModels();
