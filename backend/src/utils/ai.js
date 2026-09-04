// 🤖 ตัวช่วยเรียก DeepSeek (ใช้ได้ทั้ง Chatbot และ AI Security Scan)
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

async function askDeepSeek(messages, { maxTokens = 1200, temperature = 0.3 } = {}) {
    if (!API_KEY) {
        const err = new Error("ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY ในเซิร์ฟเวอร์");
        err.status = 503;
        throw err;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
        const res = await fetch(DEEPSEEK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            const err = new Error(`DeepSeek API error (${res.status}): ${text.slice(0, 300)}`);
            err.status = 502;
            throw err;
        }

        const data = await res.json();
        const reply = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : "";
        if (!reply) {
            const err = new Error("DeepSeek ไม่ได้คืนคำตอบ");
            err.status = 502;
            throw err;
        }
        return { model: MODEL, reply };
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = { askDeepSeek };
