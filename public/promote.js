import { $, esc, ai, loading, errorBox, sportPicker, sportName, renderReport, seed, history } from "./util.js";
import { createBooth } from "./recorder.js";

const FOCUS = [
  { id: "any", name: "Surprise me" },
  { id: "product", name: "A product" },
  { id: "company", name: "A company / sponsor" },
  { id: "game", name: "The game itself" },
];

export function initPromote(root) {
  let brief = null, focus = "any";
  root.innerHTML = `
  <div class="wrap segment">
    <div class="lower-third"><span class="tag">Activity</span><div class="title"><h2>Promote Your Sport</h2></div></div>
    <p class="lead">You're the in-game marketing team. Pick a sport from the catalog and get a client with a real problem. Then pitch your fix in <b>30 seconds</b>: a TV commercial, a video-board spot, a PA read, signage, or a halftime promo. Coach grades it like a marketing director would.</p>

    <div class="panel" style="margin-bottom:24px">
      <h4>Sport catalog</h4>
      <div id="prSports"></div>
      <h4 style="margin-top:16px">What are you marketing?</h4>
      <div class="chips" id="prFocus">${FOCUS.map((f) => `<button type="button" class="chip" data-f="${f.id}" aria-pressed="${f.id === "any"}">${esc(f.name)}</button>`).join("")}</div>
      <div class="row" style="margin-top:16px"><button class="btn primary" id="prGen">Get my client brief</button></div>
    </div>

    <div class="split">
      <div id="prBrief"><div class="empty-state">Your client brief appears here: the problem, where your 30 seconds run, who's watching, and how success is measured.</div></div>
      <div>
        <div id="prBooth"></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" id="prGrade" disabled style="flex:1">Pitch it to the client</button></div>
      </div>
    </div>
    <div id="prReport" style="margin-top:28px"></div>

    <div style="margin-top:40px">
      <div class="lower-third"><span class="tag">Info notes</span><div class="title"><h2>In-game marketing 101</h2></div></div>
      <div class="grid cols-4">
        <div class="panel soft"><h4>Video board / jumbotron</h4><p>Fans glance up for a few seconds at a time. Go big and visual, use short words, and get the crowd to do something (cheer, scan, wave).</p></div>
        <div class="panel soft"><h4>TV commercial break</h4><p>A :30 spot has room for a mini-story: setup, twist, payoff, brand. Tie it to the moment in the game when you can.</p></div>
        <div class="panel soft"><h4>PA announcer read</h4><p>Pure audio, competing with crowd noise. Say the brand name twice, keep one simple message, and end with a clear action.</p></div>
        <div class="panel soft"><h4>Signage &amp; promos</h4><p>Rotating LED boards, concourse displays, halftime contests and "kiss cam"-style sponsored moments. Fans remember interactive moments best.</p></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <h4>A 30-second pitch formula</h4>
        <div class="grid cols-4">
          <div><b>0-5s · Hook</b><p class="note">A surprising stat, a question, or a picture of the spot.</p></div>
          <div><b>5-15s · The idea</b><p class="note">What the fan sees or hears, and exactly when.</p></div>
          <div><b>15-25s · Why it works</b><p class="note">Tie it to the client's problem and audience.</p></div>
          <div><b>25-30s · The ask</b><p class="note">Call to action and how you'll measure success.</p></div>
        </div>
      </div>
    </div>
  </div>`;

  const getSport = sportPicker($("#prSports", root), { initial: "baseball" });
  $("#prFocus", root).addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    focus = b.dataset.f;
    root.querySelectorAll("#prFocus .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
  });

  const booth = createBooth($("#prBooth", root), {
    label: "Pitch room · 30 seconds",
    countdown: 30,
    placeholder: "Your 30-second pitch appears here…",
    onStop: () => ($("#prGrade", root).disabled = false),
  });

  async function gen() {
    const sport = getSport();
    const box = $("#prBrief", root);
    box.innerHTML = loading("The client is on the line…");
    try {
      const b = await ai("promo_prompt", { sport: sportName(sport), focus: FOCUS.find((f) => f.id === focus)?.name, seed: seed() });
      brief = { ...b, sport };
      box.innerHTML = `<article class="brief">
        <div class="brief-head"><h3>${esc(b.title)}</h3><span class="badge">${esc(b.category)} · ${esc(sportName(sport))}</span></div>
        <div class="brief-body">
          <dl class="kv"><dt>Client</dt><dd>${esc(b.client)}</dd><dt>Placement</dt><dd><b>${esc(b.placement)}</b></dd><dt>Audience</dt><dd>${esc(b.audience)}</dd><dt>Success</dt><dd>${esc(b.successMetric)}</dd></dl>
          <p class="big">${esc(b.problem)}</p>
          <div><h4>Constraints</h4><ul class="list-clean">${(b.constraints || []).map((t) => `<li><span>${esc(t)}</span></li>`).join("")}</ul></div>
          ${(b.starterIdeas || []).length ? `<div><h4>Stuck? Start with…</h4>${b.starterIdeas.map((s) => `<div class="quote-box" style="margin-bottom:6px">${esc(s)}</div>`).join("")}</div>` : ""}
          <button class="btn small" id="prNew">New client</button>
        </div></article>`;
      $("#prNew", root).addEventListener("click", gen);
    } catch (e) {
      box.innerHTML = errorBox(e.message, "prRetry");
      $("#prRetry", root)?.addEventListener("click", gen);
    }
  }
  $("#prGen", root).addEventListener("click", gen);

  async function grade() {
    const res = booth.result();
    const out = $("#prReport", root);
    if (!brief) { out.innerHTML = `<div class="callout warn">Get a client brief first so Coach knows what you were solving.</div>`; return; }
    if (res.words < 15) { out.innerHTML = `<div class="callout warn">Only ${res.words} words. Use your full 30 seconds!</div>`; return; }
    out.innerHTML = loading("The client is reviewing your pitch…");
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const r = await ai("grade_pitch", {
        sport: sportName(brief.sport),
        brief: `Client: ${brief.client}. Problem: ${brief.problem} Placement: ${brief.placement}. Audience: ${brief.audience}. Constraints: ${(brief.constraints || []).join("; ")}. Success metric: ${brief.successMetric}`,
        transcript: res.transcript, durationSec: res.seconds, wpm: res.wpm,
      });
      out.innerHTML = renderReport(r, {
        extra: `<div class="grid cols-2">
                  <div class="reaction"><b>Client's marketing director</b><span>"${esc(r.clientReaction)}"</span></div>
                  <div class="reaction"><b>Fan in section 112</b><span>"${esc(r.fanReaction)}"</span></div>
                </div>
                ${r.tagline ? `<div><h4>Sharper tagline from your idea</h4><div class="quote-box">${esc(r.tagline)}</div></div>` : ""}`,
      });
      history("promote").add({ at: Date.now(), title: brief.title, score: r.overall });
    } catch (e) {
      out.innerHTML = errorBox(e.message, "prGradeRetry");
      $("#prGradeRetry", root)?.addEventListener("click", grade);
    }
  }
  $("#prGrade", root).addEventListener("click", grade);
}
