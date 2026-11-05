import { send } from "./_lib.js";

export default function handler(req, res) {
  send(res, 200, {
    ai: Boolean(process.env.GEMINI_API_KEY),
    youtube: Boolean(process.env.YOUTUBE_API_KEY),
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN || "pleasantonusd.net",
  });
}
