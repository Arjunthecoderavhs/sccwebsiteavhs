// All AI work for the site goes through Google's Gemini API (free tier available).
// The browser only sends a task name + data; prompts live in api/_prompts.js.
import { send, readJson, clientIp, rateLimited } from "./_lib.js";
import { buildRequest } from "./_prompts.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

function extractJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return null;
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

async function callGemini(req) {
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: Math.max(req.maxTokens, 4000), temperature: 0.9 },
  };
  const r = await fetch(`${BASE}/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || "";
    console.error("[ai] gemini", r.status, msg);
    if (r.status === 429) throw httpError(429, "The free AI limit was reached for now. Wait a minute (or try again tomorrow if it keeps happening).");
    if (r.status === 400 && /api key/i.test(msg)) throw httpError(401, "The AI key on the server is invalid. Tell a club officer.");
    if (r.status === 403) throw httpError(401, "The AI key on the server isn't allowed to use Gemini. Tell a club officer.");
    if (r.status === 404) throw httpError(500, "The AI model name is wrong. Tell a club officer to check GEMINI_MODEL.");
    throw httpError(502, "The AI couldn't finish that request. Please try again.");
  }
  if (data?.promptFeedback?.blockReason) throw httpError(422, "The AI declined this request. Try rephrasing your answer.");
  const cand = data?.candidates?.[0];
  if (cand?.finishReason === "SAFETY") throw httpError(422, "The AI declined this request. Try rephrasing your answer.");
  return (cand?.content?.parts || []).map((p) => p.text || "").join("");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!process.env.GEMINI_API_KEY) {
    return send(res, 503, { error: "AI is not set up yet: the site owner needs to add GEMINI_API_KEY in the Vercel settings." });
  }
  if (rateLimited("ai:" + clientIp(req), 60)) {
    return send(res, 429, { error: "You've hit the practice limit for now. Take a 10-minute break and try again." });
  }
  let body;
  try { body = await readJson(req); } catch (e) { return send(res, e.status || 400, { error: e.message }); }
  const request = buildRequest(body.task, body.data);
  if (!request) return send(res, 400, { error: "Unknown task" });

  try {
    let text = await callGemini(request);
    let json = extractJson(text);
    if (!json) {
      request.messages = [...request.messages,
        { role: "assistant", content: text.slice(0, 2000) || "(empty)" },
        { role: "user", content: "That was not valid JSON. Reply again with ONLY the JSON object." }];
      text = await callGemini(request);
      json = extractJson(text);
    }
    if (!json) return send(res, 502, { error: "The AI returned an unreadable answer. Please try again." });
    return send(res, 200, { result: json });
  } catch (err) {
    const status = err.status || 500;
    if (!err.status) console.error("[ai]", body.task, err);
    return send(res, status, { error: err.status ? err.message : "The AI couldn't finish that request. Please try again." });
  }
}
