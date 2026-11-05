import { $, esc, ai, loading, errorBox, sportPicker, sportName, renderReport, history, toast } from "./util.js";
import { createBooth } from "./recorder.js";

let player, ytReady, booth, current = null, queue = [], notesData = null, getSport;
const seenKey = "scc:seenClips";
const seen = new Set((() => { try { return JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch { return []; } })());
function markSeen(id) { seen.add(id); try { localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-400))); } catch {} }

function loadYouTubeApi() {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytReady;
}

export function parseYouTubeId(url) {
  const m = String(url).trim().match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(url.trim()) ? url.trim() : null;
}

export function initCommentary(root) {
  root.innerHTML = `
  <div class="wrap segment">
    <div class="lower-third"><span class="tag">Activity</span><div class="title"><h2>Commentary Practice</h2></div></div>
    <p class="lead">Watch a real announcer call a play. Then mute the broadcast, run it back, and call it your way. Coach grades your play-by-play on accuracy, energy, pacing, vocabulary and storytelling.</p>

    <div class="grid cols-3" style="margin-bottom:24px">
      <div class="panel soft"><h4>Step 1 · Scout</h4><p style="margin:0">Pick a sport and pull a random clip. Read the scoresheet below while you watch the original call.</p></div>
      <div class="panel soft"><h4>Step 2 · Call it</h4><p style="margin:0">Hit <b>Call it myself</b>. The clip restarts muted and your mic goes live. Recording stops when the clip ends, or whenever you hit Stop.</p></div>
      <div class="panel soft"><h4>Step 3 · Review</h4><p style="margin:0">Fix any misheard words, then get graded. Try a different style on the same clip or pull a new one.</p></div>
    </div>

    <div class="panel" style="margin-bottom:24px">
      <h4>Choose your sport</h4>
      <div id="cmSports"></div>
      <div class="row" style="margin-top:16px">
        <button class="btn primary" id="cmNew">Pull a random clip</button>
        <form id="cmPaste" class="row" style="flex:1;min-width:260px">
          <input type="url" id="cmUrl" placeholder="…or paste any YouTube link" style="flex:1;min-width:180px" aria-label="YouTube link">
          <button class="btn" type="submit">Load</button>
        </form>
      </div>
      <div id="cmSource" class="note" style="margin-top:10px"></div>
    </div>

    <div class="split">
      <div>
        <div class="video-frame"><div id="cmPlayerWrap"><div class="placeholder"><div><b style="font:800 28px var(--display);letter-spacing:-.02em;color:#fff">No clip loaded</b><br>Pick a sport and pull a random clip to start.</div></div></div></div>
        <div class="video-meta">
          <div style="min-width:0;flex:1"><b id="cmTitle">Waiting for a clip…</b><span class="note" id="cmChannel"></span></div>
          <div class="mode-switch" role="group" aria-label="Playback mode">
            <button id="cmWatch" aria-pressed="false" disabled>1 · Watch original</button>
            <button id="cmCall" aria-pressed="false" disabled>2 · Call it myself</button>
          </div>
        </div>
        <div class="row" style="margin-top:10px"><button class="btn small" id="cmSkip" disabled>Skip to next clip</button><span class="note">Clips are random from YouTube. Skip anything that isn't a called play.</span></div>
      </div>
      <div>
        <div id="cmBooth"></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" id="cmGrade" disabled style="flex:1">Grade my call</button></div>
      </div>
    </div>

    <div id="cmReport" style="margin-top:28px"></div>

    <div style="margin-top:36px">
      <div class="scoresheet">
        <div class="scoresheet-head"><h3>Scoresheet &amp; game notes</h3><span class="eyebrow" style="color:var(--ink)" id="cmSheetTag">Your spotting board</span></div>
        <div class="sheet-body" id="cmSheet"><div class="empty-state">Load a clip and Coach will build a spotting board for that game: teams, key players, storylines, terms to use, and a live scoreboard you can fill in while you call.</div></div>
      </div>
    </div>
  </div>`;

  getSport = sportPicker($("#cmSports", root), { initial: "basketball" });
  booth = createBooth($("#cmBooth", root), {
    label: "Play-by-play booth",
    placeholder: "Your call shows up here live…",
    onStop: () => { $("#cmGrade", root).disabled = false; $("#cmCall", root).setAttribute("aria-pressed", "false"); player?.unMute?.(); },
  });

  $("#cmNew", root).addEventListener("click", () => { queue = []; nextClip(root); });
  $("#cmSkip", root).addEventListener("click", () => nextClip(root));
  $("#cmPaste", root).addEventListener("submit", (e) => {
    e.preventDefault();
    const id = parseYouTubeId($("#cmUrl", root).value);
    if (!id) return toast("That doesn't look like a YouTube link");
    loadClip(root, { id, title: "", channel: "", description: "", sport: getSport() });
  });
  $("#cmWatch", root).addEventListener("click", () => {
    if (!player) return;
    if (booth.recording) booth.stop();
    player.unMute(); player.seekTo(0, true); player.playVideo();
    $("#cmWatch", root).setAttribute("aria-pressed", "true"); $("#cmCall", root).setAttribute("aria-pressed", "false");
  });
  $("#cmCall", root).addEventListener("click", async () => {
    if (!player) { booth.start(); return; }
    player.mute(); player.seekTo(0, true); player.pauseVideo();
    $("#cmCall", root).setAttribute("aria-pressed", "true"); $("#cmWatch", root).setAttribute("aria-pressed", "false");
    await booth.start();
    if (booth.recording) player.playVideo();
  });
  $("#cmGrade", root).addEventListener("click", () => grade(root));
}

async function nextClip(root) {
  const sport = getSport();
  const src = $("#cmSource", root);
  if (!queue.length) {
    src.innerHTML = loading("Searching YouTube for a " + sportName(sport).toLowerCase() + " call…");
    try {
      const r = await fetch("/api/videos?sport=" + encodeURIComponent(sport));
      const data = await r.json();
      if (!data.configured) {
        src.innerHTML = `<div class="callout">Random clip search needs a YouTube API key on the server (see README). For now: <a href="${esc(data.youtubeSearchUrl)}" target="_blank" rel="noopener"><b>open a random ${esc(sportName(data.sport))} search on YouTube</b></a>, copy any clip's link, and paste it above.</div>`;
        return;
      }
      queue = (data.videos || []).filter((v) => !seen.has(v.id)).sort(() => Math.random() - 0.5);
      if (!queue.length) queue = (data.videos || []).sort(() => Math.random() - 0.5);
      if (!queue.length) {
        src.innerHTML = errorBox(data.error || "No clips came back for that search.", "cmRetry");
        $("#cmRetry", root)?.addEventListener("click", () => nextClip(root));
        return;
      }
      src.textContent = `Search: "${data.query}" · ${queue.length} clips queued`;
    } catch {
      src.innerHTML = errorBox("Couldn't reach the clip search.", "cmRetry");
      $("#cmRetry", root)?.addEventListener("click", () => nextClip(root));
      return;
    }
  }
  const v = queue.shift();
  loadClip(root, { ...v, sport });
}

async function loadClip(root, clip) {
  if (booth.recording) booth.stop();
  current = clip;
  markSeen(clip.id);
  $("#cmTitle", root).textContent = clip.title || "Loading clip…";
  $("#cmChannel", root).textContent = clip.channel ? ` · ${clip.channel}${clip.published ? " · " + clip.published : ""}` : "";
  $("#cmReport", root).innerHTML = "";
  $("#cmGrade", root).disabled = true;
  ["#cmWatch", "#cmCall", "#cmSkip"].forEach((s) => ($(s, root).disabled = false));
  booth.reset();

  if (clip.title) buildNotes(root);
  const wrap = $("#cmPlayerWrap", root);
  const ytOk = await Promise.race([loadYouTubeApi().then(() => true), new Promise((r) => setTimeout(() => r(false), 8000))]);
  if (!ytOk) {
    wrap.innerHTML = `<div class="placeholder"><div><b style="color:#fff">The YouTube player couldn't load on this network.</b><br><a class="btn small primary" style="margin-top:10px" href="https://www.youtube.com/watch?v=${esc(clip.id)}" target="_blank" rel="noopener">Open the clip on YouTube</a><br><span class="note" style="color:#bbb">Watch it there with the sound off, and record your call here.</span></div></div>`;
    if (!clip.title) { clip.title = "YouTube clip (title unavailable)"; buildNotes(root); }
    return;
  }
  if (player) {
    player.cueVideoById(clip.id);
  } else {
    wrap.innerHTML = `<div id="cmPlayer"></div>`;
    player = new YT.Player("cmPlayer", {
      videoId: clip.id,
      playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: () => fillTitleFromPlayer(root),
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) fillTitleFromPlayer(root);
          if (e.data === YT.PlayerState.ENDED && booth.recording) { booth.stop(); toast("Clip over, booth off air"); }
        },
        onError: () => { toast("That clip can't be embedded. Pulling another…"); if (current?.title) nextClip(root); },
      },
    });
  }
  if (!clip.title) setTimeout(() => fillTitleFromPlayer(root), 1500);
}

function fillTitleFromPlayer(root) {
  const d = player?.getVideoData?.();
  if (!d?.title || !current || current.title) return;
  current.title = d.title;
  current.channel = d.author || "";
  $("#cmTitle", root).textContent = d.title;
  $("#cmChannel", root).textContent = d.author ? " · " + d.author : "";
  buildNotes(root);
}

async function buildNotes(root) {
  const sheet = $("#cmSheet", root);
  const clip = current;
  sheet.innerHTML = loading("Coach is building your spotting board…");
  notesData = null;
  try {
    const n = await ai("game_notes", { sport: sportName(clip.sport), title: clip.title, channel: clip.channel, description: clip.description, published: clip.published });
    if (clip !== current) return;
    notesData = n;
    sheet.innerHTML = renderSheet(n);
  } catch (e) {
    sheet.innerHTML = errorBox(e.message, "cmNotesRetry") + blankSheet();
    $("#cmNotesRetry", root)?.addEventListener("click", () => buildNotes(root));
  }
}

function boardTable(teams, sb) {
  const period = sb?.periodName || "Period";
  const ab = period.slice(0, 1).toUpperCase();
  const fields = (sb?.fields || []).slice(0, 6);
  const head = `<tr><th>Team</th>${[1, 2, 3, 4].map((i) => `<th>${ab}${i}</th>`).join("")}<th>Total</th>${fields.map((f) => `<th>${esc(f)}</th>`).join("")}</tr>`;
  const rows = (teams.length ? teams : [{ name: "Home" }, { name: "Away" }]).slice(0, 2)
    .map((t) => `<tr><td><b>${esc(t.name)}</b></td>${"<td><input inputmode='numeric' aria-label='score'></td>".repeat(5)}${fields.map(() => "<td><input aria-label='stat'></td>").join("")}</tr>`).join("");
  return `<div class="table-scroll"><table class="board">${head}${rows}</table></div><p class="note" style="margin-top:6px">Live scoreboard: track it while you call (${esc(period)} by ${esc(period.toLowerCase())}).</p>`;
}

function blankSheet() {
  return `<div><h4>Live scoreboard</h4>${boardTable([], null)}</div>
  <div class="field"><label for="cmMyNotes">My spotting notes</label><textarea id="cmMyNotes" placeholder="Names, numbers, what happened, phrases you want to use…"></textarea></div>`;
}

function renderSheet(n) {
  const list = (a) => (a || []).map((x) => `<li><span>${esc(x)}</span></li>`).join("");
  return `
    <div class="grid cols-2">
      <div>
        <h3 style="margin-bottom:6px">${esc(n.matchup || "Matchup")}</h3>
        <dl class="kv">
          ${n.event ? `<dt>Event</dt><dd>${esc(n.event)}</dd>` : ""}
          ${n.venue ? `<dt>Venue</dt><dd>${esc(n.venue)}</dd>` : ""}
          ${n.date ? `<dt>Date</dt><dd>${esc(n.date)}</dd>` : ""}
        </dl>
        <p style="margin-top:10px">${esc(n.context || "")}</p>
        ${(n.teams || []).map((t) => `<div class="player-row"><b>${esc(t.name)}</b><span class="note">${esc(t.colors || "")}</span><span>${esc(t.notes || "")}</span></div>`).join("")}
      </div>
      <div>
        <h4>Live scoreboard</h4>
        ${boardTable(n.teams || [], n.scoreboard)}
        ${(n.stats || []).length ? `<h4 style="margin-top:14px">Numbers to cite</h4><dl class="kv">${n.stats.map((s) => `<dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd>`).join("")}</dl>` : ""}
      </div>
    </div>
    <div class="grid cols-3">
      <div><h4>Key players</h4>${(n.keyPlayers || []).map((p) => `<div class="player-row"><b>${esc(p.name)}</b><span class="note">${esc([p.team, p.position].filter(Boolean).join(" · "))}</span><span>${esc(p.note || "")}</span></div>`).join("") || '<p class="note">None identified from the clip.</p>'}</div>
      <div><h4>Storylines to drop in</h4><ul class="list-clean">${list(n.storylines)}</ul><h4 style="margin-top:14px">Calling tips</h4><ul class="list-clean">${list(n.callTips)}</ul></div>
      <div><h4>Words to use</h4>${(n.vocabulary || []).map((v) => `<div class="term"><b>${esc(v.term)}</b><span>${esc(v.meaning)}</span></div>`).join("")}</div>
    </div>
    <div class="field"><label for="cmMyNotes">My spotting notes</label><textarea id="cmMyNotes" placeholder="Names, numbers, what happened, phrases you want to use…"></textarea></div>
    <p class="note">Coach built these notes from the clip's title and description. Items marked "(verify)" may not be exact.</p>`;
}

async function grade(root) {
  const res = booth.result();
  const out = $("#cmReport", root);
  if (res.words < 8) {
    out.innerHTML = `<div class="callout warn">Coach needs more to grade. Your transcript has ${res.words} words. Record a full call, or type what you said in the transcript box.</div>`;
    return;
  }
  out.innerHTML = loading("Coach is reviewing the tape…");
  out.scrollIntoView({ behavior: "smooth", block: "start" });
  const myNotes = $("#cmMyNotes", root)?.value || "";
  const notes = notesData ? `${notesData.matchup}. ${notesData.context} Players: ${(notesData.keyPlayers || []).map((p) => p.name).join(", ")}. Student notes: ${myNotes}` : myNotes;
  try {
    const r = await ai("grade_commentary", {
      sport: sportName(current?.sport), title: current?.title || "", notes,
      transcript: res.transcript, durationSec: res.seconds, wordCount: res.words, wpm: res.wpm, fillers: res.fillers,
    });
    out.innerHTML = renderReport(r, {
      extra: `${r.proCall ? `<div><h4>How a network voice might call it</h4><div class="quote-box">${esc(r.proCall)}</div></div>` : ""}
              ${r.drill ? `<div class="callout"><b>Drill for next time:</b> ${esc(r.drill)}</div>` : ""}
              <div class="row"><button class="btn" id="cmAgain">Call this clip again</button><button class="btn primary" id="cmNext">Next random clip</button></div>`,
    });
    history("commentary").add({ at: Date.now(), title: current?.title, score: r.overall });
    $("#cmAgain", root).addEventListener("click", () => { booth.reset(); $("#cmCall", root).click(); });
    $("#cmNext", root).addEventListener("click", () => nextClip(root));
  } catch (e) {
    out.innerHTML = errorBox(e.message, "cmGradeRetry");
    $("#cmGradeRetry", root)?.addEventListener("click", () => grade(root));
  }
}
