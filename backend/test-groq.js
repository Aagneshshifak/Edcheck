require('dotenv').config();
const { groq, GROQ_MODELS } = require('./config/groq');
async function test() {
    try {
        console.log("Testing model:", GROQ_MODELS.BALANCED);
        const response = await groq.chat.completions.create({
            model: GROQ_MODELS.BALANCED,
            messages: [{ role: 'user', content: 'hello' }]
        });
        console.log("Success:", response.choices[0].message.content);
    } catch (e) {
        console.error("Error Status:", e.status);
        console.error("Error Message:", e.message);
        console.error("Error error property:", e.error);
    }
}
test();
