require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function test() {
    try {
        console.log("Using model:", process.env.GROQ_MODEL);
        const response = await groq.chat.completions.create({
            model: process.env.GROQ_MODEL,
            messages: [{ role: 'user', content: 'Say hello' }]
        });
        console.log("Success:", response.choices[0].message.content);
    } catch (err) {
        console.error("Error:", err.status, err.message);
    }
}
test();
