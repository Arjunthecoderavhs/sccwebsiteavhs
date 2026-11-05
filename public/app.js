import { $, $$, copyText } from "./util.js";
import { initCommentary } from "./commentary.js";
import { initPodcast } from "./podcast.js";
import { initPromote } from "./promote.js";
import { initQuiz } from "./quiz.js";
import { initManagement } from "./management.js";
import { initMembers } from "./members.js";

const configP = fetch("/api/config").then((r) => r.json()).catch(() => ({}));

const INIT = {
  commentary: (el) => initCommentary(el),
  podcast: (el) => initPodcast(el),
  promote: (el) => initPromote(el),
  quiz: (el) => initQuiz(el),
  management: (el) => initManagement(el),
  members: async (el) => initMembers(el, await configP),
};
const started = new Set();

function route() {
  const id = (location.hash.slice(1) || "about").split(/[?&]/)[0];
  const target = document.getElementById(id);
  const page = target?.matches("[data-page]") ? target : target?.closest("[data-page]") || $("#about");
  $$("[data-page]").forEach((s) => (s.hidden = s !== page));
  $$(".nav a").forEach((a) => (a.getAttribute("href") === "#" + page.id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if (!started.has(page.id) && INIT[page.id]) { started.add(page.id); INIT[page.id](page); }
  $("#nav").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
  if (target === page) window.scrollTo({ top: 0, behavior: "instant" });
  else target?.scrollIntoView();
}

// invite links look like /?join=CODE → send them to the members tab
if (new URLSearchParams(location.search).get("join") && !location.hash) location.hash = "#members";
window.addEventListener("hashchange", route);
route();

$("#menuBtn").addEventListener("click", () => {
  const open = $("#nav").classList.toggle("open");
  $("#menuBtn").setAttribute("aria-expanded", String(open));
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]");
  if (b) copyText(b.dataset.copy);
});

// ticker
const items = [
  "Meetings every Friday at lunch · Room H-9",
  "Google Classroom code: ao7yexzb",
  "New: Management sims — GM, Owner & Operations",
  "Call a random clip in Commentary Practice",
  "Fantasy basketball league forming now",
  "Sharks game trip at SAP Center pending ASB approval",
  "Join the mailing list on the About page",
];
$("#ticker").innerHTML = [...items, ...items].map((t) => `<span>${t}</span>`).join("");

// hero scorebug clock: countdown to next Friday lunch
function heroClock() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(12, 0, 0, 0);
  const add = (5 - now.getDay() + 7) % 7;
  next.setDate(now.getDate() + add);
  if (next < now) next.setDate(next.getDate() + 7);
  const ms = next - now;
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  $("#heroClock").textContent = d ? `${d}D ${h}H` : `${h}H ${String(m).padStart(2, "0")}M`;
  $("#heroClock").title = "Time until the next Friday meeting";
}
heroClock();
setInterval(heroClock, 30000);

configP.then((c) => {
  if (c && c.ai === false) console.info("AI features need GEMINI_API_KEY on the server.");
});
