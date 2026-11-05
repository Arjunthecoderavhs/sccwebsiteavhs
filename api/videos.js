// Random YouTube clips of announcers calling plays, filtered by sport.
// Each request builds a randomized search (call style x moment x era x sort order),
// so the pool is effectively unlimited instead of a fixed rotation.
import { send, clientIp, rateLimited } from "./_lib.js";

const SPORT_TERMS = {
  football: ["NFL", "college football", "football"],
  basketball: ["NBA", "college basketball", "WNBA", "March Madness"],
  baseball: ["MLB", "baseball", "World Series"],
  soccer: ["soccer", "Premier League", "World Cup", "MLS", "Champions League"],
  hockey: ["NHL", "hockey", "Stanley Cup"],
  tennis: ["tennis", "Wimbledon", "US Open tennis"],
  golf: ["golf", "PGA Tour", "Masters golf"],
  volleyball: ["volleyball", "NCAA volleyball", "Olympic volleyball"],
  track: ["track and field", "Olympic 100m", "relay race"],
  swimming: ["swimming", "Olympic swimming"],
  boxing: ["boxing"],
  mma: ["UFC", "MMA"],
  cricket: ["cricket", "IPL", "Test cricket"],
  rugby: ["rugby", "Rugby World Cup"],
  racing: ["Formula 1", "NASCAR", "IndyCar"],
  lacrosse: ["lacrosse", "PLL lacrosse", "NCAA lacrosse"],
  softball: ["softball", "Women's College World Series"],
  wrestling: ["NCAA wrestling", "Olympic wrestling"],
  cycling: ["Tour de France", "cycling sprint finish"],
  skiing: ["Olympic skiing", "downhill skiing"],
};

const CALL_STYLES = ["play by play call", "announcer call", "radio call", "commentary", "broadcast call", "best calls", "TV call"];
const MOMENTS = ["", "game winner", "final minutes", "overtime", "buzzer beater", "comeback", "championship", "playoff", "rivalry", "highlights", "walk off", "goal"];
const ORDERS = ["relevance", "viewCount", "relevance", "rating"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function buildQuery(sport) {
  const key = SPORT_TERMS[sport] ? sport : pick(Object.keys(SPORT_TERMS));
  return { sport: key, q: `${pick(SPORT_TERMS[key])} ${pick(CALL_STYLES)} ${pick(MOMENTS)}`.replace(/\s+/g, " ").trim() };
}

function randomWindow() {
  // random 3-year window between 2006 and now, so different eras surface
  const now = new Date().getFullYear();
  const startYear = 2006 + Math.floor(Math.random() * (now - 2006));
  return {
    publishedAfter: `${startYear}-01-01T00:00:00Z`,
    publishedBefore: `${Math.min(startYear + 3, now + 1)}-01-01T00:00:00Z`,
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const sportParam = (url.searchParams.get("sport") || "random").toLowerCase();
  const { sport, q } = buildQuery(sportParam);
  const youtubeSearchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);

  if (!process.env.YOUTUBE_API_KEY) {
    return send(res, 200, { configured: false, sport, query: q, youtubeSearchUrl, videos: [] });
  }
  if (rateLimited("yt:" + clientIp(req), 60)) {
    return send(res, 429, { error: "Too many clip searches. Try again in a few minutes." });
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "strict",
    maxResults: "25",
    q,
    order: pick(ORDERS),
    videoDuration: Math.random() < 0.6 ? "short" : "medium",
    relevanceLanguage: "en",
    key: process.env.YOUTUBE_API_KEY,
  });
  if (Math.random() < 0.6) {
    const w = randomWindow();
    params.set("publishedAfter", w.publishedAfter);
    params.set("publishedBefore", w.publishedBefore);
  }

  try {
    let r = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
    let data = await r.json();
    if (r.ok && (!data.items || data.items.length < 3) && params.has("publishedAfter")) {
      params.delete("publishedAfter"); params.delete("publishedBefore");
      r = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
      data = await r.json();
    }
    if (!r.ok) {
      console.error("[videos]", r.status, data?.error?.message);
      return send(res, 200, { configured: true, error: "YouTube search is unavailable right now (daily quota may be used up).", sport, query: q, youtubeSearchUrl, videos: [] });
    }
    const videos = (data.items || [])
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        id: it.id.videoId,
        title: decode(it.snippet.title),
        channel: decode(it.snippet.channelTitle),
        description: decode(it.snippet.description || ""),
        published: (it.snippet.publishedAt || "").slice(0, 10),
        thumb: it.snippet.thumbnails?.medium?.url || "",
      }));
    return send(res, 200, { configured: true, sport, query: q, youtubeSearchUrl, videos });
  } catch (e) {
    console.error("[videos]", e.message);
    return send(res, 200, { configured: true, error: "Couldn't reach YouTube.", sport, query: q, youtubeSearchUrl, videos: [] });
  }
}

function decode(s) {
  return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
