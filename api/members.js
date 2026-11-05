// PUSD-only members area. Students join with their school Google account,
// and only through the invite link (?join=CODE). Officers can see emails and remove members.
import { promises as fs } from "node:fs";
import path from "node:path";
import { send, readJson, clientIp, rateLimited } from "./_lib.js";

const DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "pleasantonusd.net").toLowerCase();
const OFFICERS = (process.env.OFFICER_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
const KEY = "scc:members";

// ---------- storage: Upstash Redis REST, or a local JSON file in development ----------
const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const localFile = path.join(process.cwd(), ".data", "members.json");

async function kv(cmd) {
  const r = await fetch(kvUrl, { method: "POST", headers: { Authorization: `Bearer ${kvToken}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || "storage error");
  return data.result;
}
async function readLocal() {
  try { return JSON.parse(await fs.readFile(localFile, "utf8")); } catch { return {}; }
}
async function writeLocal(obj) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  await fs.writeFile(localFile, JSON.stringify(obj, null, 2));
}
const store = {
  ready: () => Boolean(kvUrl && kvToken) || process.env.SCC_LOCAL_DEV === "1",
  async all() {
    if (kvUrl) {
      const flat = (await kv(["HGETALL", KEY])) || [];
      const out = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = JSON.parse(flat[i + 1]);
      return out;
    }
    return readLocal();
  },
  async get(email) {
    if (kvUrl) { const v = await kv(["HGET", KEY, email]); return v ? JSON.parse(v) : null; }
    return (await readLocal())[email] || null;
  },
  async put(email, m) {
    if (kvUrl) return kv(["HSET", KEY, email, JSON.stringify(m)]);
    const all = await readLocal(); all[email] = m; return writeLocal(all);
  },
  async remove(email) {
    if (kvUrl) return kv(["HDEL", KEY, email]);
    const all = await readLocal(); delete all[email]; return writeLocal(all);
  },
};

async function verifyGoogle(credential) {
  if (!credential || typeof credential !== "string") throw httpError(401, "Sign in with Google first.");
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
  const t = await r.json();
  if (!r.ok) throw httpError(401, "Your Google sign-in expired. Sign in again.");
  if (t.aud !== process.env.GOOGLE_CLIENT_ID) throw httpError(401, "This sign-in was not issued for this site.");
  if (Number(t.exp) * 1000 < Date.now()) throw httpError(401, "Your Google sign-in expired. Sign in again.");
  const email = String(t.email || "").toLowerCase();
  if (t.email_verified !== "true" && t.email_verified !== true) throw httpError(403, "Your Google email isn't verified.");
  if (!email.endsWith("@" + DOMAIN) && (t.hd || "").toLowerCase() !== DOMAIN) {
    throw httpError(403, `Use your school account (@${DOMAIN}). You signed in as ${email}.`);
  }
  return { email, name: t.name || email.split("@")[0], picture: t.picture || "" };
}

function httpError(status, message) { return Object.assign(new Error(message), { status }); }

function publicList(all, officer) {
  return Object.values(all)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({ name: m.name, picture: m.picture, joinedAt: m.joinedAt, officer: OFFICERS.includes(m.email), ...(officer ? { email: m.email } : {}) }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!process.env.GOOGLE_CLIENT_ID) return send(res, 503, { error: "Members sign-in isn't set up yet (missing GOOGLE_CLIENT_ID)." });
  if (!store.ready()) return send(res, 503, { error: "Member storage isn't set up yet (add Upstash Redis in the hosting settings)." });
  if (rateLimited("mem:" + clientIp(req), 30)) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." });

  try {
    const body = await readJson(req);
    const who = await verifyGoogle(body.credential);
    const officer = OFFICERS.includes(who.email);
    let me = await store.get(who.email);

    if (body.action === "join" && !me) {
      const code = String(body.joinCode || "");
      if (!process.env.MEMBER_INVITE_CODE || code !== process.env.MEMBER_INVITE_CODE) {
        throw httpError(403, "That invite link isn't valid. Ask a club officer for the current link.");
      }
      me = { ...who, joinedAt: new Date().toISOString() };
      await store.put(who.email, me);
    }

    if (!me && !officer) {
      return send(res, 403, { error: "You're not a member yet. Members join through the invite link from a club officer.", notMember: true, email: who.email });
    }

    if (body.action === "remove") {
      if (!officer) throw httpError(403, "Only officers can remove members.");
      await store.remove(String(body.email || "").toLowerCase());
    }

    const all = await store.all();
    return send(res, 200, {
      me: me || { ...who, joinedAt: null },
      officer,
      members: publicList(all, officer),
      inviteCode: officer ? process.env.MEMBER_INVITE_CODE || "" : undefined,
    });
  } catch (e) {
    if (!e.status) console.error("[members]", e);
    return send(res, e.status || 500, { error: e.status ? e.message : "Something went wrong saving your membership." });
  }
}
