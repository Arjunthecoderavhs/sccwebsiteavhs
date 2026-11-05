import { $, esc, ai, loading, errorBox, SPORTS, seed, pick, history } from "./util.js";

const RESOURCES = [
  { group: "Learn the craft", items: [
    { t: "Sports commentator", d: "Overview of play-by-play vs. color commentary, history and famous voices.", u: "https://en.wikipedia.org/wiki/Sports_commentator" },
    { t: "Play-by-play", d: "What a play-by-play announcer does and how the role developed on radio and TV.", u: "https://en.wikipedia.org/wiki/Play-by-play" },
    { t: "Color commentator", d: "The analyst role: strategy, context and storytelling between plays.", u: "https://en.wikipedia.org/wiki/Color_commentator" },
    { t: "Sports broadcasting", d: "How games get from the venue to your screen, plus a history of the industry.", u: "https://en.wikipedia.org/wiki/Sports_broadcasting" },
  ]},
  { group: "Industry & news", items: [
    { t: "National Sports Media Association", d: "Honors the best sportscasters and sportswriters in every state, plus its Hall of Fame.", u: "https://nationalsportsmedia.org/" },
    { t: "Sports Video Group", d: "Trade news on how sports TV and streaming production actually works.", u: "https://www.sportsvideo.org/" },
    { t: "Awful Announcing", d: "Daily coverage of sports media: broadcasters, booths, TV deals.", u: "https://awfulannouncing.com/" },
    { t: "Ford C. Frick Award (Baseball Hall of Fame)", d: "Baseball's top broadcasting honor. Read about the legends and listen to their calls.", u: "https://baseballhall.org/discover-more/awards/ford-c-frick" },
  ]},
  { group: "Practice & student media", items: [
    { t: "NFHS Network", d: "High school sports streaming. Many schools have students run the broadcasts.", u: "https://www.nfhsnetwork.com/" },
    { t: "Podcast", d: "Background on podcasting formats, which helps for the Podcast Maker activity.", u: "https://en.wikipedia.org/wiki/Podcast" },
    { t: "Sports marketing", d: "Sponsorship, in-venue advertising and how teams sell the game.", u: "https://en.wikipedia.org/wiki/Sports_marketing" },
    { t: "General manager (sports)", d: "What front-office GMs do: trades, contracts, the draft and the cap.", u: "https://en.wikipedia.org/wiki/General_manager_(sports)" },
  ]},
];

export function initQuiz(root) {
  let difficulty = "medium", quiz = [], idx = 0, results = [];
  const seenTopics = history("quizTopics");

  root.innerHTML = `
  <div class="wrap segment">
    <div class="lower-third"><span class="tag">Test yourself</span><div class="title"><h2>Quiz &amp; Resources</h2></div></div>
    <p class="lead">What would a pro do? Every quiz is newly generated: on-air scenarios with four choices. Miss one and Coach explains why your pick was wrong and what the right call is.</p>

    <div class="panel" style="margin-bottom:24px">
      <h4>Difficulty</h4>
      <div class="chips" id="qzDiff">
        <button type="button" class="chip" data-d="easy" aria-pressed="false">Easy · rookie</button>
        <button type="button" class="chip" data-d="medium" aria-pressed="true">Medium · starter</button>
        <button type="button" class="chip" data-d="hard" aria-pressed="false">Hard · Hall of Fame</button>
      </div>
      <div class="row" style="margin-top:16px">
        <label class="note" for="qzCount">Questions</label>
        <select id="qzCount" style="width:auto"><option>5</option><option selected>8</option><option>10</option></select>
        <button class="btn primary" id="qzStart">Generate a new quiz</button>
      </div>
    </div>

    <div id="qzStage"><div class="empty-state">Pick a difficulty and generate a quiz. Questions are different every time.</div></div>

    <div style="margin-top:48px">
      <div class="lower-third"><span class="tag">Resources</span><div class="title"><h2>Read up on commentating</h2></div></div>
      ${RESOURCES.map((g) => `<h4 style="margin-top:18px">${esc(g.group)}</h4><div class="grid cols-4">${g.items.map((r) => `<a class="res-tile" href="${r.u}" target="_blank" rel="noopener"><small>${esc(new URL(r.u).hostname.replace("www.", ""))}</small><b>${esc(r.t)}</b><span>${esc(r.d)}</span></a>`).join("")}</div>`).join("")}
      <div class="panel soft" style="margin-top:18px">
        <h4>Study the greats</h4>
        <p style="margin:0">Search YouTube for famous calls and study how each voice builds to the moment, then lets the crowd take over: Vin Scully (baseball), Al Michaels (football and the "Miracle on Ice"), Mike Breen (basketball), Doris Burke (basketball analyst), Ian Darke (soccer), Doc Emrick (hockey) and Jim Nantz (golf and football).</p>
      </div>
    </div>
  </div>`;

  $("#qzDiff", root).addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    difficulty = b.dataset.d;
    root.querySelectorAll("#qzDiff .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
  });

  const stage = $("#qzStage", root);

  async function start() {
    stage.innerHTML = loading("Writing a fresh " + difficulty + " quiz…");
    const sports = [...SPORTS].sort(() => Math.random() - 0.5).slice(0, 5).map((s) => s.name).join(", ");
    try {
      const r = await ai("quiz", { difficulty, count: Number($("#qzCount", root).value), sports, seed: seed(), avoid: seenTopics.get().slice(0, 25).join("; ") });
      quiz = (r.questions || []).filter((q) => Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer));
      if (!quiz.length) throw new Error("The quiz came back empty.");
      quiz.forEach((q) => q.topic && seenTopics.add(q.topic));
      idx = 0; results = [];
      show();
    } catch (e) {
      stage.innerHTML = errorBox(e.message, "qzRetry");
      $("#qzRetry", root)?.addEventListener("click", start);
    }
  }

  function progress() {
    return `<div class="quiz-progress" aria-hidden="true">${quiz.map((_, i) => `<i class="${i < results.length ? (results[i] ? "right" : "wrong") : i === idx ? "cur" : ""}"></i>`).join("")}</div>`;
  }

  function show() {
    const q = quiz[idx];
    stage.innerHTML = `<div class="panel">
      ${progress()}
      <div class="row" style="justify-content:space-between"><span class="eyebrow">Question ${idx + 1} of ${quiz.length} · ${esc(difficulty)}</span><span class="eyebrow">${esc(q.topic || "")}</span></div>
      <div class="q-scenario" style="margin-top:12px">${esc(q.scenario)}</div>
      <div class="q-question">${esc(q.question)}</div>
      <div class="options">${q.options.map((o, i) => `<button class="option" data-i="${i}"><span class="letter">${"ABCD"[i]}</span><span>${esc(o)}</span></button>`).join("")}</div>
      <div id="qzFeedback"></div>
    </div>`;
    stage.querySelector(".options").addEventListener("click", (e) => {
      const b = e.target.closest(".option"); if (!b || b.disabled) return;
      answer(Number(b.dataset.i));
    });
  }

  function answer(i) {
    const q = quiz[idx];
    const right = i === q.answer;
    results.push(right);
    stage.querySelectorAll(".option").forEach((b, k) => {
      b.disabled = true;
      if (k === q.answer) b.classList.add("correct");
      if (k === i && !right) b.classList.add("incorrect");
    });
    const why = (q.whyWrong || [])[i];
    $("#qzFeedback", stage).innerHTML = `<div class="feedback ${right ? "right" : "wrong"}">
      <b>${right ? "Correct!" : `Not quite. You picked ${"ABCD"[i]}.`}</b>
      ${!right && why ? `<p style="margin:6px 0 0"><b>Why ${"ABCD"[i]} is wrong:</b> ${esc(why)}</p>` : ""}
      <p style="margin:6px 0 0"><b>${right ? "Why it works" : `The right call is ${"ABCD"[q.answer]}`}:</b> ${esc(q.explanation)}</p>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="qzNext">${idx + 1 < quiz.length ? "Next question" : "See my results"}</button></div>`;
    stage.querySelector(".quiz-progress").outerHTML = progress();
    $("#qzNext", stage).addEventListener("click", () => { idx++; idx < quiz.length ? show() : finish(); });
    $("#qzNext", stage).focus();
  }

  function finish() {
    const score = results.filter(Boolean).length;
    const pct = Math.round((score / quiz.length) * 100);
    const label = pct >= 90 ? "Hall of Fame booth" : pct >= 75 ? "Network ready" : pct >= 50 ? "Local broadcast" : "Back to the press box";
    const missed = quiz.map((q, i) => ({ q, ok: results[i] })).filter((x) => !x.ok);
    stage.innerHTML = `<article class="report">
      <div class="report-top"><div class="grade-ring" style="--p:${pct}"><div><b>${score}/${quiz.length}</b><span>${pct}%</span></div></div>
      <div><div class="headline">${label}</div><div class="verdict">${esc(difficulty)} quiz complete. ${missed.length ? "Review the ones you missed below." : "Perfect run. Try a harder level."}</div></div></div>
      <div class="report-body">
        ${missed.map(({ q }) => `<div class="panel soft"><span class="eyebrow">${esc(q.topic || "")}</span><p style="margin:6px 0"><b>${esc(q.question)}</b></p><p style="margin:0">Answer: <b>${esc(q.options[q.answer])}</b>. ${esc(q.explanation)}</p></div>`).join("")}
        <div class="row"><button class="btn primary" id="qzAgain">New quiz</button></div>
      </div></article>`;
    $("#qzAgain", stage).addEventListener("click", start);
    history("quiz").add({ at: Date.now(), difficulty, score: pct });
  }

  $("#qzStart", root).addEventListener("click", start);
}
