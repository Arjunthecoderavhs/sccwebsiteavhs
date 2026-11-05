// All AI work for the site goes through Google's Gemini API (free tier available).
// The browser only sends a task name + data; prompts live in api/_prompts.js.
import { send, readJson, clientIp, rateLimited } from "./_lib.js";
import { buildRequest } from "./_prompts.js";

const BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
// Tried in order: if one model is busy, missing or not allowed on the free tier, the next one is used.
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"]
  .filter((m, i, a) => m && a.indexOf(m) === i);

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(model, req) {
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.9 },
  };
  const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": (process.env.GEMINI_API_KEY || "").trim() },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data, message: data?.error?.message || "" };
}

async function callGemini(req) {
  let last = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await callModel(model, req);
      if (res.ok) {
        const d = res.data;
        if (d?.promptFeedback?.blockReason) throw httpError(422, "The AI declined this request. Try rephrasing your answer.");
        const cand = d?.candidates?.[0];
        if (cand?.finishReason === "SAFETY") throw httpError(422, "The AI declined this request. Try rephrasing your answer.");
        const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
        if (text.trim()) return text;
        last = { status: 502, message: `empty answer (${cand?.finishReason || "no reason"})` };
        break; // try the next model
      }
      last = res;
      console.error("[ai] gemini", model, res.status, res.message);
      // a bad or blocked key won't work on any model: stop right away
      if (res.status === 400 && /api key/i.test(res.message)) throw httpError(401, "The Gemini key is invalid. In Vercel, check GEMINI_API_KEY has no extra spaces, then Redeploy.");
      if (res.status === 403) throw httpError(401, "Google blocked this Gemini key: " + res.message.slice(0, 160));
      if (res.status === 503 || res.status === 500) { await sleep(800); continue; } // busy: retry once, then next model
      break; // 404 model not found, 429 limit, 400 other: try next model
    }
  }
  if (last?.status === 429) throw httpError(429, "The free AI limit was reached for now. Wait a minute (or try again tomorrow if it keeps happening).");
  throw httpError(502, `The AI couldn't finish that request (Google said: ${String(last?.message || "error " + last?.status).slice(0, 180)})`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!process.env.GEMINI_API_KEY) {
    return send(res, 503, { error: "AI is not set up yet: the site owner needs to add GEMINI_API_KEY in the Vercel settings, then Redeploy." });
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
    console.error("[ai]", body.task, status, err.message);
    return send(res, status, { error: err.status ? err.message : "The AI couldn't finish that request (" + String(err.message).slice(0, 120) + ")" });
  }
}
