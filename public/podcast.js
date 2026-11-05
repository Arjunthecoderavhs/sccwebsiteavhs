import { $, esc, ai, loading, errorBox, sportPicker, sportName, renderReport, seed, history } from "./util.js";
import { createBooth } from "./recorder.js";

const FORMATS = ["Hot take / debate", "Deep dive / analysis", "History & legends", "Fan culture", "Interview-style monologue", "Any"];

export function initPodcast(root) {
  let brief = null, getSport, format = "Any";
  root.innerHTML = `
  <div class="wrap segment">
    <div class="lower-third"><span class="tag">Activity</span><div class="title"><h2>Podcast Maker</h2></div></div>
    <p class="lead">Pick a sport and Coach gives you a custom episode topic. Hit record and talk it through, with no time limit. When you stop, Coach reviews your episode the way a real sports audience would: would they keep listening, subscribe, or skip?</p>

    <div class="panel" style="margin-bottom:24px">
      <h4>Your sport</h4>
      <div id="pdSports"></div>
      <h4 style="margin-top:16px">Show format</h4>
      <div class="chips" id="pdFormats">${FORMATS.map((f) => `<button type="button" class="chip" data-f="${esc(f)}" aria-pressed="${f === "Any"}">${esc(f)}</button>`).join("")}</div>
      <div class="row" style="margin-top:16px"><button class="btn primary" id="pdGen">Give me a topic</button><span class="note">Each click generates a new topic.</span></div>
    </div>

    <div class="split">
      <div id="pdBrief"><div class="empty-state">Your episode brief appears here: title, topic, angle, talking points and segment plan.</div></div>
      <div>
        <div id="pdBooth"></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" id="pdGrade" disabled style="flex:1">Get audience feedback</button></div>
      </div>
    </div>

    <div id="pdReport" style="margin-top:28px"></div>

    <div style="margin-top:40px">
      <div class="lower-third"><span class="tag">Info notes</span><div class="title"><h2>How good sports pods sound</h2></div></div>
      <div class="grid cols-3">
        <div class="panel soft"><h4>Cold open (0:00-0:30)</h4><p>Start with your boldest claim or a question, not "Hey guys, welcome back." Listeners decide in the first 30 seconds whether to stay.</p></div>
        <div class="panel soft"><h4>Back it up</h4><p>Every hot take needs receipts: a stat, a game you watched, a comparison. "He's the best shooter ever" is weaker than "He took 40% of his shots from three and still led the league in efficiency."</p></div>
        <div class="panel soft"><h4>Segments</h4><p>Break the episode into named segments (Take of the Week, Buy or Sell, Mailbag). Signpost them out loud: "Alright, moving to segment two…"</p></div>
        <div class="panel soft"><h4>Talk to one person</h4><p>Picture one friend listening. Use "you." Pause after big points. Energy goes up and down on purpose, not flat the whole time.</p></div>
        <div class="panel soft"><h4>Argue the other side</h4><p>Strong hosts state the best counter-argument, then knock it down. It makes your take more convincing and fair.</p></div>
        <div class="panel soft"><h4>Close strong</h4><p>Recap your take in one sentence, give a prediction, and tease what's next. Cut fillers like "um," "like," and "you know." The stats strip counts them.</p></div>
      </div>
    </div>
  </div>`;

  getSport = sportPicker($("#pdSports", root), { initial: "football" });
  $("#pdFormats", root).addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    format = b.dataset.f;
    root.querySelectorAll("#pdFormats .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
  });

  const booth = createBooth($("#pdBooth", root), {
    label: "Podcast studio · no time limit",
    placeholder: "Start talking. Your episode transcript builds here…",
    onStop: () => ($("#pdGrade", root).disabled = false),
  });

  async function gen() {
    const sport = getSport();
    const box = $("#pdBrief", root);
    box.innerHTML = loading("Producer is pitching a topic…");
    try {
      const b = await ai("podcast_prompt", { sport: sportName(sport), format, seed: seed() });
      brief = { ...b, sport };
      box.innerHTML = `<article class="brief">
        <div class="brief-head"><h3>${esc(b.title)}</h3><span class="badge">${esc(sportName(sport))} · ${esc(format)}</span></div>
        <div class="brief-body">
          <p class="big">${esc(b.prompt)}</p>
          <p><b>Your angle:</b> ${esc(b.angle)}</p>
          <div><h4>Talking points</h4><ul class="list-clean">${(b.talkingPoints || []).map((t) => `<li><span>${esc(t)}</span></li>`).join("")}</ul></div>
          <div><h4>Answer on air</h4><ul class="list-clean">${(b.questions || []).map((t) => `<li><span>${esc(t)}</span></li>`).join("")}</ul></div>
          <div><h4>Run of show</h4>${(b.suggestedSegments || []).map((s) => `<div class="term"><b>${esc(s.name)}</b><span>${esc(s.minutes)}</span></div>`).join("")}</div>
          <p class="note">Audience: ${esc(b.audience)}</p>
          <button class="btn small" id="pdNew">Different topic</button>
        </div></article>`;
      $("#pdNew", root).addEventListener("click", gen);
    } catch (e) {
      box.innerHTML = errorBox(e.message, "pdRetry");
      $("#pdRetry", root)?.addEventListener("click", gen);
    }
  }
  $("#pdGen", root).addEventListener("click", gen);

  async function grade() {
    const res = booth.result();
    const out = $("#pdReport", root);
    if (res.words < 25) { out.innerHTML = `<div class="callout warn">That episode is only ${res.words} words. Talk a little longer so the audience has something to react to.</div>`; return; }
    out.innerHTML = loading("Playing your episode for a test audience…");
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    const prompt = brief ? `${brief.title}: ${brief.prompt} Angle: ${brief.angle}` : "Open topic (student picked their own)";
    try {
      const r = await ai("grade_podcast", { sport: sportName(brief?.sport || getSport()), prompt, transcript: res.transcript, durationSec: res.seconds, wpm: res.wpm, fillers: res.fillers });
      const retention = Math.max(0, Math.min(100, Number(r.retention) || 0));
      out.innerHTML = renderReport(r, {
        verdictKey: "listenerVerdict",
        extra: `<div><h4>Estimated listeners still tuned in at the end</h4>
                  <div class="interest"><div class="track"><span class="knob" style="left:${retention}%"></span></div><div class="labels"><span>Skipped</span><b>${retention}%</b><span>Hooked</span></div></div></div>
                <div><h4>What listeners said</h4><div class="grid cols-3">${(r.audienceReactions || []).map((a) => `<div class="reaction"><b>${esc(a.persona)}</b><span>"${esc(a.reaction)}"</span></div>`).join("")}</div></div>
                ${r.drill ? `<div class="callout"><b>Next episode drill:</b> ${esc(r.drill)}</div>` : ""}`,
      });
      history("podcast").add({ at: Date.now(), title: brief?.title, score: r.overall });
    } catch (e) {
      out.innerHTML = errorBox(e.message, "pdGradeRetry");
      $("#pdGradeRetry", root)?.addEventListener("click", grade);
    }
  }
  $("#pdGrade", root).addEventListener("click", grade);
}
