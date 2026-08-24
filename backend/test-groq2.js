require('dotenv').config();
const { groq } = require('./config/groq');
async function test() {
    try {
        console.log("Testing model: llama-3.3-70b-versatile");
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'hello' }]
        });
        console.log("Success:", response.choices[0].message.content);
    } catch (e) {
        console.error("Error Status:", e.status);
        console.error("Error Message:", e.message);
    }
}
test();
