// 🌐 ตัวช่วยเรียก REST API (same-origin + httpOnly cookie)
const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(method, url, body) {
    const options = { method, headers: JSON_HEADERS, credentials: "same-origin" };
    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch("/api" + url, options);
    } catch {
        throw new Error("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
        const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

export default {
    get: (url) => request("GET", url),
    post: (url, body) => request("POST", url, body),
    put: (url, body) => request("PUT", url, body),
    delete: (url) => request("DELETE", url),
};
