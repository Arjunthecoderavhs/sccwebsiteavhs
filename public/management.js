import { $, esc, ai, loading, errorBox, sportPicker, sportName, renderReport, seed, history, pick } from "./util.js";

const ROLES = {
  "General Manager": {
    blurb: "Trades, signings and re-signings, contract holdouts, the draft, and managing the salary cap.",
    types: ["Contract holdout", "Re-sign a star", "Free-agent signing", "Trade offer received", "Build a trade", "Draft day", "Salary cap crunch"],
  },
  Owner: {
    blurb: "Big-picture decisions: stadium upgrades, pricing, sponsorship deals, hiring and firing, and PR crises.",
    types: ["Stadium upgrade (video board, seats)", "Ticket pricing", "Naming-rights deal", "Hire or fire the coach/GM", "PR crisis", "New stadium / relocation"],
  },
  "Operations Manager": {
    blurb: "Runs game day and answers to the owner: supplies, staff, security, weather and last-minute problems.",
    types: ["Game-day emergency", "Concessions & supplies", "Staffing shortage", "Security & crowd control", "Weather delay", "Tech failure (scanners, video board)"],
  },
};

const money = (m) => (!m ? "$0" : m >= 1 ? `$${(+m).toFixed(m % 1 ? 1 : 0)}M` : `$${Math.round(m * 1000)}K`);

export function initManagement(root) {
  let role = "General Manager", type = "Surprise me", sc = null, log = [], interest = 50, status = "open", busy = false;

  root.innerHTML = `
  <div class="wrap segment">
    <div class="lower-third"><span class="tag">Front office</span><div class="title"><h2>Management</h2></div></div>
    <p class="lead">Step into the front office. Pick a sport and a role, and the boss hands you a problem. Negotiate back and forth with agents, rival GMs, vendors and staff until you get a deal, or don't. Then report back for your review.</p>

    <div class="panel" style="margin-bottom:20px">
      <h4>League</h4>
      <div id="mgSports"></div>
    </div>
    <h4>Choose your role</h4>
    <div class="grid cols-3" id="mgRoles" style="margin-bottom:20px">
      ${Object.entries(ROLES).map(([name, r]) => `<button type="button" class="role-card" data-role="${esc(name)}" aria-pressed="${name === role}"><span class="eyebrow">Role</span><b>${esc(name)}</b><span>${esc(r.blurb)}</span></button>`).join("")}
    </div>
    <div class="panel soft" style="margin-bottom:24px">
      <h4>Situation type</h4>
      <div class="chips" id="mgTypes"></div>
      <div class="row" style="margin-top:16px"><button class="btn primary" id="mgGen">Open the boss's memo</button></div>
    </div>

    <div id="mgDesk"><div class="empty-state">Your scenario loads here: the boss's memo, the hard limits, key numbers, and a live negotiation with the other side.</div></div>
    <div id="mgReport" style="margin-top:28px"></div>
  </div>`;

  const getSport = sportPicker($("#mgSports", root), { initial: "football" });

  function renderTypes() {
    $("#mgTypes", root).innerHTML = ["Surprise me", ...ROLES[role].types].map((t) => `<button type="button" class="chip" data-t="${esc(t)}" aria-pressed="${t === type}">${esc(t)}</button>`).join("");
  }
  renderTypes();
  $("#mgRoles", root).addEventListener("click", (e) => {
    const b = e.target.closest(".role-card"); if (!b) return;
    role = b.dataset.role; type = "Surprise me";
    root.querySelectorAll(".role-card").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    renderTypes();
  });
  $("#mgTypes", root).addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    type = b.dataset.t;
    root.querySelectorAll("#mgTypes .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
  });

  const desk = $("#mgDesk", root);

  async function generate() {
    desk.innerHTML = loading("The boss is typing up a memo…");
    $("#mgReport", root).innerHTML = "";
    const sport = getSport();
    const chosenType = type === "Surprise me" ? pick(ROLES[role].types) : type;
    try {
      sc = await ai("mgmt_scenario", { sport: sportName(sport), role, type: chosenType, seed: seed() });
      sc._sport = sport; sc._type = chosenType;
      log = [{ who: "them", text: sc.opening }];
      interest = 50; status = "open";
      renderDesk();
    } catch (e) {
      desk.innerHTML = errorBox(e.message, "mgRetry");
      $("#mgRetry", root)?.addEventListener("click", generate);
    }
  }
  $("#mgGen", root).addEventListener("click", generate);

  function renderDesk() {
    const c = sc.contract;
    const cp = sc.counterpart || {};
    desk.innerHTML = `
    <div class="split">
      <div class="grid" style="gap:16px">
        <div class="memo">
          <div class="memo-meta"><span>To</span><span>${esc(role)}, ${esc(sc.team)}</span><span>From</span><span>${esc(sc.memo?.from)}</span><span>Re</span><span>${esc(sc.memo?.subject)}</span></div>
          <p style="margin:0">${esc(sc.memo?.body)}</p>
        </div>
        <div class="panel">
          <div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(sc.title)}</h3><span class="tally live"><i></i><span>${esc(sc.clock || "Clock running")}</span></span></div>
          <p class="note" style="margin-top:6px">${esc(sc.league)} · ${esc(sc._type)}</p>
          <p>${esc(sc.situation)}</p>
          <div class="facts">${(sc.facts || []).map((f) => `<div><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div>`).join("")}</div>
          <h4 style="margin-top:16px">Hard limits</h4>
          <ul class="list-clean">${(sc.constraints || []).map((x) => `<li><span>${esc(x)}</span></li>`).join("")}</ul>
          ${(sc.assets || []).length ? `<h4 style="margin-top:16px">Assets you can use</h4><div class="chips">${sc.assets.map((a) => `<span class="chip" style="cursor:default">${esc(a)}</span>`).join("")}</div>` : ""}
          <div class="callout" style="margin-top:16px"><b>Objective:</b> ${esc(sc.objective)}</div>
        </div>
      </div>

      <div class="panel" style="display:grid;gap:14px">
        <div class="row" style="justify-content:space-between">
          <div><span class="eyebrow">Across the table</span><div style="font:800 24px/1.1 var(--display);letter-spacing:-.02em">${esc(cp.name)}</div><span class="note">${esc(cp.role)} · ${esc(cp.style)}</span></div>
          <span class="chip" style="cursor:default" id="mgMood">Mood: ${esc("Guarded")}</span>
        </div>
        <div class="interest"><div class="labels"><span>Walking away</span><span>Interest</span><span>Ready to deal</span></div><div class="track"><span class="knob" id="mgKnob" style="left:${interest}%"></span></div></div>
        <div class="chat" id="mgChat" aria-live="polite"></div>
        ${c ? offerBuilder(c) : ""}
        <form id="mgSay" class="grid" style="gap:8px">
          <label class="note" for="mgText">${c ? "Or talk it out (pitch the team, push back, ask questions):" : "Your move: respond, make an offer, give an order, ask questions:"}</label>
          <textarea id="mgText" rows="3" placeholder="${c ? "e.g. We see him as the face of the franchise, but we can't go past our number…" : "e.g. Call our backup vendor and get 400 cases delivered before gates open…"}"></textarea>
          <div class="row"><button class="btn black" type="submit" id="mgSend">Send</button><button class="btn" type="button" id="mgWrap">Wrap up &amp; report to the boss</button></div>
        </form>
      </div>
    </div>`;
    renderChat();
    if (c) wireOffer(c);
    $("#mgSay", desk).addEventListener("submit", (e) => { e.preventDefault(); const t = $("#mgText", desk).value.trim(); if (t) { $("#mgText", desk).value = ""; say(t); } });
    $("#mgWrap", desk).addEventListener("click", wrapUp);
    desk.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function offerBuilder(c) {
    const maxY = Math.max(1, Math.min(10, (c.maxYears || 5) + 1));
    const step = c.askingAAV >= 5 ? 0.25 : 0.05;
    return `<div class="panel soft" id="mgOffer">
      <div class="row" style="justify-content:space-between"><h4 style="margin:0">Contract offer · ${esc(c.player)}</h4><span class="note">${esc(c.position)} · Age ${esc(c.age)}</span></div>
      <dl class="kv" style="margin:10px 0"><dt>Asking</dt><dd>${money(c.askingAAV)}/yr</dd><dt>Market</dt><dd>${money(c.marketLow)} – ${money(c.marketHigh)}/yr</dd><dt>Owner max</dt><dd><b>${money(c.ownerMaxAAV)}/yr</b></dd></dl>
      <div class="offer-grid">
        <div class="field"><label for="ofYears">Years: <span id="ofYearsV">${Math.min(3, maxY)}</span></label><input type="range" id="ofYears" min="1" max="${maxY}" value="${Math.min(3, maxY)}"></div>
        <div class="field"><label for="ofAav">Per year ($M)</label><input type="number" id="ofAav" step="${step}" min="0" value="${(+c.marketLow).toFixed(2)}"></div>
        <div class="field"><label for="ofBonus">Signing bonus ($M)</label><input type="number" id="ofBonus" step="${step}" min="0" value="0"></div>
        <div class="field"><label for="ofGtd">Guaranteed: <span id="ofGtdV">50</span>%</label><input type="range" id="ofGtd" min="0" max="100" step="5" value="50"></div>
      </div>
      <div class="field" style="margin-top:10px"><label for="ofInc">Incentives / clauses (optional)</label><input type="text" id="ofInc" placeholder="e.g. $1M for Pro Bowl, no-trade clause"></div>
      <div class="offer-total" id="ofTotal" style="margin-top:12px"></div>
      <div class="row" style="margin-top:10px"><button class="btn primary" type="button" id="ofSend" style="flex:1">Submit offer</button></div>
    </div>`;
  }

  function wireOffer(c) {
    const upd = () => {
      const y = +$("#ofYears", desk).value, a = +$("#ofAav", desk).value || 0, b = +$("#ofBonus", desk).value || 0, g = +$("#ofGtd", desk).value;
      $("#ofYearsV", desk).textContent = y; $("#ofGtdV", desk).textContent = g;
      const total = y * a + b;
      const effAav = total / y;
      const over = effAav > c.ownerMaxAAV;
      const t = $("#ofTotal", desk);
      t.classList.toggle("over", over);
      t.innerHTML = `<span>Total <b>${money(total)}</b></span><span>Avg/yr incl. bonus <b>${money(effAav)}</b></span><span>Guaranteed <b>${money(total * g / 100)}</b></span>${over ? "<span><b>Over owner's max</b></span>" : ""}`;
    };
    ["#ofYears", "#ofAav", "#ofBonus", "#ofGtd"].forEach((s) => $(s, desk).addEventListener("input", upd));
    upd();
    $("#ofSend", desk).addEventListener("click", () => {
      const y = +$("#ofYears", desk).value, a = +$("#ofAav", desk).value || 0, b = +$("#ofBonus", desk).value || 0, g = +$("#ofGtd", desk).value, inc = $("#ofInc", desk).value.trim();
      const total = y * a + b;
      say(`OFFER: ${y} year${y > 1 ? "s" : ""}, ${money(a)} per year, ${money(b)} signing bonus, ${g}% guaranteed (total ${money(total)}, ${money(total * g / 100)} guaranteed)${inc ? `. Incentives/clauses: ${inc}` : ""}.`, true);
    });
  }

  function renderChat() {
    const chat = $("#mgChat", desk);
    if (!chat) return;
    const cp = sc.counterpart || {};
    chat.innerHTML = log.map((m) => m.who === "system"
      ? `<div class="msg system">${esc(m.text)}</div>`
      : `<div class="msg ${m.who === "me" ? "me" : "them"}"><div class="who">${m.who === "me" ? "You · " + esc(role) : esc(cp.name || "Them")}</div>${esc(m.text)}${m.counter ? `<div class="counter">Counter: ${esc(m.counter)}</div>` : ""}</div>`).join("")
      + (busy ? `<div class="msg them"><span class="spinner"></span></div>` : "");
    chat.scrollTop = chat.scrollHeight;
  }

  const transcript = () => log.map((m) => m.who === "me" ? `STUDENT (${role}): ${m.text}` : m.who === "system" ? `[${m.text}]` : `${sc.counterpart?.name || "Counterpart"}: ${m.text}${m.counter ? ` (counter: ${m.counter})` : ""}`).join("\n");

  async function say(text) {
    if (busy || status !== "open") return;
    log.push({ who: "me", text });
    busy = true; renderChat(); setControls(false);
    try {
      const r = await ai("mgmt_turn", { scenario: JSON.stringify(sc), role, history: transcript() });
      log.push({ who: "them", text: r.reply, counter: r.counter });
      interest = Math.max(0, Math.min(100, Number(r.interest) || interest));
      $("#mgKnob", desk).style.left = interest + "%";
      $("#mgMood", desk).textContent = "Mood: " + (r.mood || "—");
      if (r.status === "deal") { status = "deal"; log.push({ who: "system", text: "Deal reached" + (r.agreedTerms ? ": " + r.agreedTerms : "") + ". Report back to the boss." }); sc._terms = r.agreedTerms; }
      if (r.status === "walked") { status = "walked"; log.push({ who: "system", text: `${sc.counterpart?.name || "They"} ended talks. Report back to the boss.` }); }
    } catch (e) {
      log.push({ who: "system", text: "Connection dropped: " + e.message + " Send your message again." });
    }
    busy = false; renderChat(); setControls(status === "open");
  }

  function setControls(on) {
    ["#mgSend", "#ofSend", "#mgText"].forEach((s) => { const el = $(s, desk); if (el) el.disabled = !on; });
  }

  function wrapUp() {
    const out = $("#mgReport", root);
    const outcome = status === "deal" ? `Deal reached: ${sc._terms || "see transcript"}` : status === "walked" ? "Counterpart walked away" : "No final agreement yet";
    out.innerHTML = `<div class="panel">
      <h3>Report to ${esc(sc.memo?.from || "the boss")}</h3>
      <p class="note">Outcome: ${esc(outcome)}. In a few sentences, explain your decision and why it's right for the franchise.</p>
      <textarea id="mgDecision" rows="5" placeholder="We signed him at… because… This keeps us under the cap by…"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="mgSubmit">Submit report for review</button></div>
    </div>`;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#mgSubmit", out).addEventListener("click", async () => {
      const decision = $("#mgDecision", out).value.trim();
      out.innerHTML = loading("The boss is reading your report…");
      try {
        const r = await ai("mgmt_grade", { scenario: JSON.stringify(sc), role, history: transcript(), outcome, decision });
        out.innerHTML = renderReport(r, {
          verdictKey: "bossVerdict",
          extra: `${r.proMove ? `<div><h4>What a veteran executive would do</h4><div class="quote-box">${esc(r.proMove)}</div></div>` : ""}
                  <div class="row"><button class="btn primary" id="mgNew">New scenario</button></div>`,
        });
        history("management").add({ at: Date.now(), title: sc.title, role, score: r.overall });
        $("#mgNew", out).addEventListener("click", () => { out.innerHTML = ""; generate(); });
      } catch (e) {
        out.innerHTML = errorBox(e.message, "mgGradeRetry");
        $("#mgGradeRetry", out)?.addEventListener("click", wrapUp);
      }
    });
  }
}
