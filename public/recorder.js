// "Broadcast booth": mic recording + live speech-to-text + level meter + ON AIR tally.
// No time cap unless `countdown` seconds is given (used for 30-second pitches).
import { esc, fmtTime, speechStats } from "./util.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function createBooth(root, { label = "Booth", countdown = 0, placeholder = "Your words will appear here as you talk…", onStart, onStop } = {}) {
  root.innerHTML = `
  <div class="booth">
    <div class="booth-head">
      <span class="tally" data-r="tally"><i></i><span>Standby</span></span>
      <span class="eyebrow" style="color:#a5a5a5">${esc(label)}</span>
      <span class="booth-clock ${countdown ? "countdown" : ""}" data-r="clock">${fmtTime(countdown)}</span>
    </div>
    <div class="booth-body">
      <div class="meter" data-r="meter" aria-hidden="true">${"<i></i>".repeat(24)}</div>
      <div class="row">
        <button class="btn rec" data-r="start">● Start recording</button>
        <button class="btn" data-r="stop" disabled>■ Stop</button>
        <button class="btn" data-r="reset" disabled>Reset</button>
      </div>
      <div class="transcript-box" data-r="live" aria-live="polite" data-placeholder="${esc(placeholder)}"></div>
      <div class="stats-strip">
        <div><b data-r="sTime">0:00</b><span>Time</span></div>
        <div><b data-r="sWords">0</b><span>Words</span></div>
        <div><b data-r="sWpm">0</b><span>Words/min</span></div>
        <div><b data-r="sFill">0</b><span>Fillers</span></div>
      </div>
      <div data-r="after" hidden>
        <h4 style="color:var(--yellow)">Playback</h4>
        <audio controls data-r="audio"></audio>
        <div class="field" style="margin-top:12px">
          <label for="${root.id}-tx" style="color:#fff">Transcript (fix any words the mic misheard before grading)</label>
          <textarea id="${root.id}-tx" data-r="tx" rows="6"></textarea>
        </div>
      </div>
      <p class="note" data-r="msg">${SR ? "Uses your microphone. Live transcription works best in Chrome or Edge." : "Live transcription isn't supported in this browser (use Chrome or Edge). You can still record, then type your transcript below."}</p>
    </div>
  </div>`;

  const r = (k) => root.querySelector(`[data-r="${k}"]`);
  const bars = [...r("meter").children];
  let stream, mediaRec, chunks = [], audioCtx, analyser, raf, timer, recog;
  let finalText = "", interimText = "", startedAt = 0, elapsed = 0, recording = false;

  function renderLive() {
    r("live").innerHTML = esc(finalText) + (interimText ? ` <span class="interim">${esc(interimText)}</span>` : "");
    r("live").scrollTop = r("live").scrollHeight;
    const st = speechStats(finalText + " " + interimText, elapsed);
    r("sWords").textContent = st.words;
    r("sWpm").textContent = st.wpm;
    r("sFill").textContent = st.fillers;
  }

  function tick() {
    elapsed = (performance.now() - startedAt) / 1000;
    r("sTime").textContent = fmtTime(elapsed);
    if (countdown) {
      const left = countdown - elapsed;
      r("clock").textContent = fmtTime(Math.ceil(left));
      r("clock").classList.toggle("low", left <= 5);
      if (left <= 0) stop();
    } else {
      r("clock").textContent = fmtTime(elapsed);
    }
    renderLive();
  }

  function meterLoop() {
    const data = new Uint8Array(analyser.fftSize);
    const draw = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      const lit = Math.min(24, Math.round((peak / 128) * 24 * 1.6));
      bars.forEach((b, i) => { b.className = i < lit ? "on" + (i > 19 ? " hot" : i > 14 ? " mid" : "") : ""; });
      raf = requestAnimationFrame(draw);
    };
    draw();
  }

  function startRecognition() {
    if (!SR) return;
    recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (e) => {
      interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += (finalText ? " " : "") + t.trim();
        else interimText += t;
      }
      renderLive();
    };
    recog.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") r("msg").textContent = "Speech-to-text was blocked. You can still type your transcript after you stop.";
    };
    // Chrome ends recognition after silence; keep it going for the whole (uncapped) take.
    recog.onend = () => { if (recording) { try { recog.start(); } catch {} } };
    try { recog.start(); } catch {}
  }

  async function start() {
    if (recording) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      r("msg").innerHTML = `<span class="callout warn" style="display:block">Microphone access was blocked. Click the lock/mic icon in the address bar, allow the microphone, then try again. (${esc(err.name || "error")})</span>`;
      return;
    }
    finalText = ""; interimText = ""; chunks = []; elapsed = 0;
    r("after").hidden = true;
    recording = true;
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
    mediaRec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mediaRec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mediaRec.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRec.mimeType || "audio/webm" });
      r("audio").src = URL.createObjectURL(blob);
    };
    mediaRec.start(1000);
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    meterLoop();
    startRecognition();
    startedAt = performance.now();
    timer = setInterval(tick, 200);
    r("tally").classList.add("live");
    r("tally").querySelector("span").textContent = "On air";
    r("start").disabled = true; r("stop").disabled = false; r("reset").disabled = true;
    onStart?.();
  }

  function stop() {
    if (!recording) return;
    recording = false;
    clearInterval(timer);
    tick();
    cancelAnimationFrame(raf);
    bars.forEach((b) => (b.className = ""));
    try { recog?.stop(); } catch {}
    try { mediaRec?.state !== "inactive" && mediaRec.stop(); } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => {});
    r("tally").classList.remove("live");
    r("tally").querySelector("span").textContent = "Off air";
    r("start").disabled = false; r("start").textContent = "● Record again";
    r("stop").disabled = true; r("reset").disabled = false;
    // give recognition a moment to flush its last final result
    setTimeout(() => {
      const text = (finalText + " " + interimText).trim();
      interimText = "";
      renderLive();
      r("tx").value = text;
      r("after").hidden = false;
      onStop?.(result());
    }, 700);
  }

  function reset() {
    finalText = ""; interimText = ""; elapsed = 0;
    r("live").innerHTML = ""; r("tx").value = ""; r("after").hidden = true;
    r("clock").textContent = fmtTime(countdown); r("sTime").textContent = "0:00";
    r("start").textContent = "● Start recording";
    renderLive();
  }

  function result() {
    const transcript = (r("tx").value || finalText).trim();
    return { transcript, seconds: Math.round(elapsed), ...speechStats(transcript, elapsed) };
  }

  r("start").addEventListener("click", start);
  r("stop").addEventListener("click", stop);
  r("reset").addEventListener("click", reset);

  return { start, stop, reset, result, get recording() { return recording; }, setTranscriptVisible() { r("after").hidden = false; } };
}
