# Sports Commentary Club website: setup guide

Free setup: **GitHub** (stores the files) + **Vercel** (puts the site online) + **Google Gemini** (the AI). No coding needed.

---

## Step 1: Get a free Gemini AI key (5 min)

1. Go to **https://aistudio.google.com** and sign in with a Google account. Use a personal account or an adult's; school accounts often block this. Google requires you to be 18+, so an advisor or parent may need to do this step.
2. Click **Get API key → Create API key**.
3. Copy the key (a long code) and save it somewhere safe. **Don't share it or paste it into any file.**

## Step 2: Put the files on GitHub (5 min)

1. Unzip `scc-website.zip`.
2. On **github.com**, click **+ → New repository**, name it `scc-website`, and click **Create repository**.
   - If you already made one for Netlify, delete it first (**Settings → bottom of page → Delete this repository**) and make a fresh one.
3. Click **"uploading an existing file"**.
4. Open the unzipped `scc-website` folder, select **everything inside it** (`api`, `public`, `package.json`, `vercel.json`…) and drag it in.
   Drag the **contents**, not the folder itself.
5. Click **Commit changes**.

## Step 3: Put it online with Vercel (5 min)

1. Go to **https://vercel.com** → **Sign Up** → **Continue with GitHub** (choose the free **Hobby** plan).
2. Click **Add New… → Project** → find `scc-website` → **Import**.
3. Open the **Environment Variables** section on that same screen and add:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** paste your key from Step 1
4. Click **Deploy**. Wait about 1 minute.
5. Click the preview to visit your site. Your link looks like `scc-website.vercel.app`.

**Test it:** open **Quiz** and click **Generate a new quiz**. If questions appear, the AI works.

---

## Optional extras (add later, all free)

Add each in Vercel under **Project → Settings → Environment Variables**, then go to **Deployments → ⋯ → Redeploy** so the site picks it up.

**Random YouTube clips** (without it, students paste a YouTube link instead)
- `YOUTUBE_API_KEY`: from https://console.cloud.google.com → create a project → search "YouTube Data API v3" → **Enable** → **Credentials → Create credentials → API key**.

**Members sign-in (PUSD accounts only)**
1. `GOOGLE_CLIENT_ID`: in the same Google Cloud project:
   - **OAuth consent screen** → External → fill in the name and email → set it to **In production**.
   - **Credentials → Create credentials → OAuth client ID → Web application**, and under *Authorized JavaScript origins* add your Vercel link (e.g. `https://scc-website.vercel.app`).
2. Storage: in Vercel open **Storage** (or **Marketplace**) → **Upstash for Redis** → create a free database and connect it to the project. This fills in `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
3. Add these variables:
   - `MEMBER_INVITE_CODE` = any secret word, e.g. `micdrop2026`
   - `ALLOWED_EMAIL_DOMAIN` = `pleasantonusd.net`
   - `OFFICER_EMAILS` = `ap4956@pleasantonusd.net,wb6525@pleasantonusd.net,gkramer@pleasantonusd.net`
4. Invite link to share: `https://YOUR-SITE.vercel.app/?join=micdrop2026`

---

## Changing things later

Open a file on github.com → pencil icon → edit → **Commit changes**. Vercel updates the live site automatically in about a minute.

| To change… | Edit this file |
|---|---|
| About page text, contacts, links | `public/index.html` |
| Scrolling ticker messages | `public/app.js` |
| Resource links under the quiz | `public/quiz.js` |
| How the AI grades | `api/_prompts.js` |
| Colors and fonts | `public/styles.css` |

## Good to know

- **Free AI limits:** Gemini's free tier caps how many requests you can make per minute and per day. If many students use it at once, some may see "The free AI limit was reached". Waiting a minute fixes it.
- **Privacy:** on the free tier, Google may use what's sent to the AI (student transcripts) to improve its products. Let your advisor know.
- **Microphone recording** works best in Chrome or Edge, which includes school Chromebooks.
- Optional `GEMINI_MODEL` setting: the site uses Google's current fast model (`gemini-flash-latest`) by default.
