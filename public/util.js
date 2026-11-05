// Shared helpers: DOM, AI calls, sport catalog, report card rendering.

export const SPORTS = [
  { id: "football", name: "Football" },
  { id: "basketball", name: "Basketball" },
  { id: "baseball", name: "Baseball" },
  { id: "soccer", name: "Soccer" },
  { id: "hockey", name: "Hockey" },
  { id: "tennis", name: "Tennis" },
  { id: "golf", name: "Golf" },
  { id: "volleyball", name: "Volleyball" },
  { id: "track", name: "Track & Field" },
  { id: "swimming", name: "Swimming" },
  { id: "boxing", name: "Boxing" },
  { id: "mma", name: "MMA" },
  { id: "cricket", name: "Cricket" },
  { id: "rugby", name: "Rugby" },
  { id: "racing", name: "Motorsports" },
  { id: "lacrosse", name: "Lacrosse" },
  { id: "softball", name: "Softball" },
  { id: "wrestling", name: "Wrestling" },
  { id: "cycling", name: "Cycling" },
  { id: "skiing", name: "Skiing" },
];
export const sportName = (id) => SPORTS.find((s) => s.id === id)?.name || "Random sport";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  t.setAttribute("role", "status");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Select and copy: " + text); }
}

export const seed = () => Math.random().toString(36).slice(2, 8);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];

export async function ai(task, data) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, data }),
  });
  let body = {};
  try { body = await r.json(); } catch {}
  if (!r.ok) throw new Error(body.error || (r.status === 504 || r.status === 502 ? "The AI took too long to answer. Please try again." : `Request failed (${r.status})`));
  return body.result;
}

export function loading(text) {
  return `<div class="loading"><span class="spinner"></span>${esc(text)}</div>`;
}

export function errorBox(msg, retryId) {
  return `<div class="callout warn"><b>Couldn't finish:</b> ${esc(msg)} ${retryId ? `<button class="btn small" id="${retryId}" style="margin-left:8px">Try again</button>` : ""}</div>`;
}

/** Sport chip picker. Returns a getter for the current value. */
export function sportPicker(container, { includeRandom = true, initial = "basketball", onChange } = {}) {
  let value = initial;
  const items = (includeRandom ? [{ id: "random", name: "Random" }] : []).concat(SPORTS);
  container.innerHTML = `<div class="chips" role="group" aria-label="Pick a sport">${items
    .map((s) => `<button type="button" class="chip" data-id="${s.id}" aria-pressed="${s.id === value}">${esc(s.name)}</button>`)
    .join("")}</div>`;
  container.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    value = b.dataset.id;
    $$(".chip", container).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    onChange?.(value);
  });
  return () => (value === "random" ? pick(SPORTS).id : value);
}

const FILLERS = /\b(um+|uh+|uhm|er+|ah+|like|you know|i mean|basically|literally|kind of|sort of)\b/gi;
export function speechStats(transcript, seconds) {
  const words = (transcript.trim().match(/\b[\w'-]+\b/g) || []).length;
  const minutes = Math.max(seconds, 1) / 60;
  return {
    words,
    wpm: seconds > 3 ? Math.round(words / minutes) : 0,
    fillers: (transcript.match(FILLERS) || []).length,
  };
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0");
}

/** Broadcast-style report card for any graded result. */
export function renderReport(r, { verdictKey, extra = "" } = {}) {
  const overall = Math.max(0, Math.min(100, Number(r.overall) || 0));
  const cats = (r.categories || []).map((c) => {
    const s = Math.max(0, Math.min(10, Number(c.score) || 0));
    return `<div class="cat"><span class="name">${esc(c.name)}</span><div class="bar"><i style="width:${s * 10}%"></i></div><span class="score">${s}</span><div class="comment">${esc(c.comment)}</div></div>`;
  }).join("");
  const list = (arr) => `<ul class="list-clean">${(arr || []).map((x) => `<li><span>${esc(x)}</span></li>`).join("")}</ul>`;
  return `<article class="report" aria-label="AI feedback">
    <div class="report-top">
      <div class="grade-ring" style="--p:${overall}"><div><b>${esc(r.letter || "")}</b><span>${overall}/100</span></div></div>
      <div><div class="headline">${esc(r.headline || "Your scorecard")}</div>${verdictKey && r[verdictKey] ? `<div class="verdict">${esc(r[verdictKey])}</div>` : ""}</div>
    </div>
    <div class="report-body">
      <div>${cats}</div>
      <div class="grid cols-2">
        <div><h4>What worked</h4>${list(r.strengths)}</div>
        <div><h4>Work on next</h4>${list(r.improvements)}</div>
      </div>
      ${r.bestLine ? `<div><h4>Your best line</h4><div class="quote-box">"${esc(r.bestLine)}"</div></div>` : ""}
      ${extra}
    </div>
  </article>`;
}

export function history(key) {
  const k = "scc:" + key;
  return {
    get() { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } },
    add(item) { try { const a = this.get(); a.unshift(item); localStorage.setItem(k, JSON.stringify(a.slice(0, 30))); } catch {} },
  };
}
