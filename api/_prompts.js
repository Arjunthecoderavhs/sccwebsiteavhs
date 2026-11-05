// Prompt templates for every AI task. The browser only sends a task name + data;
// the prompts live here so the endpoint can't be used as an open chatbot.
import { clip } from "./_lib.js";

const BASE = `You are "Coach," the AI broadcast coach for the Sports Commentary Club (SCC) at Amador Valley High School in Pleasanton, CA.
Your users are high school students practicing play-by-play, podcasting, sports marketing and front-office management.
Be specific, encouraging and honest. Keep everything school-appropriate. Use real sports terminology.
Grade fairly: an average high-school first attempt lands around 60-75. Reserve 90+ for genuinely broadcast-ready work. Very short or empty submissions score low and you say why.
OUTPUT RULES: reply with ONE valid JSON object only. No markdown, no code fences, no commentary outside the JSON.`;

const CATEGORY_SHAPE = `"categories": [{"name": string, "score": integer 0-10, "comment": string (1-2 sentences, cite something they actually said)}]`;

export const TASKS = {
  // ---------------- Commentary Practice ----------------
  game_notes: {
    effort: "low",
    maxTokens: 3000,
    build: (d) => `A student is about to call this YouTube clip. Build a broadcaster's prep sheet ("spotting board") for it.
Sport: ${clip(d.sport, 60)}
Video title: ${clip(d.title, 300)}
Channel: ${clip(d.channel, 120)}
Published: ${clip(d.published, 40)}
Description: ${clip(d.description, 1200)}

Use what the title/description reveal (teams, event, year, players). Where you are drawing on general knowledge rather than the video text, keep it to well-established facts and mark uncertain items with "(verify)". Never invent a final score you cannot know.
Return JSON:
{"matchup": string, "event": string, "venue": string or "", "date": string or "",
 "context": string (2-3 sentences of stakes/storyline),
 "teams": [{"name": string, "colors": string, "notes": string}],
 "keyPlayers": [{"name": string, "team": string, "position": string, "note": string}] (3-8),
 "storylines": [string] (3-5 talking points a play-by-play voice could drop in),
 "stats": [{"label": string, "value": string}] (season/game numbers that are safe to cite, else []),
 "vocabulary": [{"term": string, "meaning": string}] (6-8 sport-specific calls/terms),
 "callTips": [string] (3 tips specific to calling THIS sport),
 "scoreboard": {"periodName": string (e.g. "Quarter","Inning","Half","Set","Round","Period","Lap"), "fields": [string] (4-6 stat columns worth tracking live, e.g. "Fouls","Timeouts")}}`,
  },

  grade_commentary: {
    effort: "medium",
    maxTokens: 3500,
    build: (d) => `Grade this student's play-by-play call. They watched the clip first, then re-called it in their own words with the original announcer muted.
Sport: ${clip(d.sport, 60)}
Clip: ${clip(d.title, 300)}
Prep notes they had: ${clip(d.notes, 1500)}
Recording length: ${Number(d.durationSec) || 0} seconds | Words: ${Number(d.wordCount) || 0} | Words/min: ${Number(d.wpm) || 0} | Filler words detected: ${Number(d.fillers) || 0}
Speech-to-text transcript (may contain recognition errors; don't punish obvious mis-hearings):
"""${clip(d.transcript, 9000)}"""

Score these categories 0-10: "Play-by-Play Accuracy", "Energy & Excitement", "Pacing & Timing", "Vocabulary & Terminology", "Storytelling & Color", "Clarity & Delivery".
Return JSON:
{"overall": integer 0-100, "letter": string (A+..F), "headline": string (a punchy one-line verdict, like a broadcast chyron),
 ${CATEGORY_SHAPE},
 "strengths": [string] (2-3), "improvements": [string] (2-4, concrete and actionable),
 "bestLine": string (quote their strongest moment, or "" if none),
 "proCall": string (rewrite one of their weaker moments the way a network play-by-play voice would call it),
 "drill": string (one practice drill for next time)}`,
  },

  // ---------------- Podcast Maker ----------------
  podcast_prompt: {
    effort: "low",
    maxTokens: 1500,
    build: (d) => `Create a fresh sports-podcast assignment for a high school student.
Sport: ${clip(d.sport, 60)}
Format they picked: ${clip(d.format || "any", 60)}
Variety seed (use it to pick a different angle each time): ${clip(d.seed, 40)}
Pick a debatable, evergreen-or-timely topic (strategy, history, rule changes, player legacies, team building, sports culture, "hot take" debates). Avoid anything that depends on news you can't be sure about; frame current-events topics generally.
Return JSON:
{"title": string (episode title), "prompt": string (the topic in 1-2 sentences), "angle": string (the stance or tension to explore),
 "talkingPoints": [string] (4-5), "questions": [string] (3 questions to answer on air),
 "audience": string (who is listening), "suggestedSegments": [{"name": string, "minutes": string}] (3-4)}`,
  },

  grade_podcast: {
    effort: "medium",
    maxTokens: 3500,
    build: (d) => `Review this student's sports podcast episode from the perspective of a real sports-podcast AUDIENCE (fans who choose what to listen to and skip what bores them).
Sport: ${clip(d.sport, 60)}
Assignment: ${clip(d.prompt, 1500)}
Length: ${Number(d.durationSec) || 0} s | Words/min: ${Number(d.wpm) || 0} | Filler words: ${Number(d.fillers) || 0}
Transcript (speech-to-text, may have recognition errors):
"""${clip(d.transcript, 12000)}"""

Score 0-10: "Hook & Opening", "Knowledge & Evidence", "Hot-Take Strength", "Structure & Flow", "Personality & Voice", "Audience Engagement".
Return JSON:
{"overall": integer 0-100, "letter": string, "headline": string,
 "listenerVerdict": string (2-3 sentences: would fans subscribe? why?),
 "retention": integer 0-100 (estimated % of listeners still listening at the end),
 ${CATEGORY_SHAPE},
 "audienceReactions": [{"persona": string (e.g. "Die-hard fan","Casual fan","Stats nerd"), "reaction": string (a realistic comment in their voice)}] (3),
 "strengths": [string], "improvements": [string],
 "bestLine": string, "drill": string}`,
  },

  // ---------------- Promote Your Sport ----------------
  promo_prompt: {
    effort: "low",
    maxTokens: 1500,
    build: (d) => `Create an IN-GAME sports marketing challenge for a high school student. In-game only: TV commercial breaks, jumbotron/video board spots, PA announcer reads, in-stadium signage, halftime/intermission promos, fan-cam moments, sponsored segments.
Sport: ${clip(d.sport, 60)}
What they're promoting: ${clip(d.focus || "any", 60)} (product = a sponsor's product; company = a brand/sponsor; game = the sport/team/event itself)
Variety seed: ${clip(d.seed, 40)}
Use a believable fictional brand or a generic one ("a regional credit union"), not real trademarks.
Return JSON:
{"title": string, "client": string, "category": "Product"|"Company"|"The Game",
 "problem": string (2-3 sentences: the marketing problem, with a number in it, e.g. attendance down 18% among 18-24 year-olds),
 "placement": string (exactly where/when the 30 seconds runs, e.g. "Video board, 2nd-quarter media timeout"),
 "audience": string, "constraints": [string] (2-3), "successMetric": string,
 "starterIdeas": [string] (2 sentence-starters to help them begin, not full answers)}`,
  },

  grade_pitch: {
    effort: "medium",
    maxTokens: 3000,
    build: (d) => `Grade a student's 30-second in-game marketing pitch.
Sport: ${clip(d.sport, 60)}
Brief: ${clip(d.brief, 2000)}
Pitch length: ${Number(d.durationSec) || 0} s (target 30) | Words/min: ${Number(d.wpm) || 0}
Transcript:
"""${clip(d.transcript, 4000)}"""

Score 0-10: "Hook (first 3 seconds)", "Solves the Problem", "Fits the Placement", "Audience Fit", "Call to Action", "Creativity".
Return JSON:
{"overall": integer 0-100, "letter": string, "headline": string,
 ${CATEGORY_SHAPE},
 "clientReaction": string (what the client's marketing director says after hearing it, in character),
 "fanReaction": string (what a fan in the seats thinks),
 "strengths": [string], "improvements": [string],
 "tagline": string (a sharper tagline built from their idea)}`,
  },

  // ---------------- Quiz ----------------
  quiz: {
    effort: "medium",
    maxTokens: 6000,
    build: (d) => `Write a NEW multiple-choice quiz on how a sports commentator / broadcaster should handle real on-air scenarios.
Difficulty: ${clip(d.difficulty, 10)}
Number of questions: ${Math.min(Math.max(Number(d.count) || 8, 4), 12)}
Sports to mix in: ${clip(d.sports, 200)}
Variety seed: ${clip(d.seed, 40)} (use it so this quiz differs from previous ones)
Avoid these question topics (already seen): ${clip(d.avoid, 1200)}

Difficulty guide:
- easy: basic roles (play-by-play vs color), common etiquette, obvious right answers.
- medium: judgment calls (injury on field, blown call, dead air, mispronounced names, sponsor reads, stat accuracy).
- hard: subtle professional standards (laying out vs talking over a big moment, handling breaking news, legal/ethical issues, live corrections, broadcast timing to the second, conflicts of interest), where 2+ options sound reasonable.
Each question is a short scenario. Exactly 4 options. Vary the correct position.
Return JSON:
{"questions": [{"topic": string (2-4 words), "scenario": string, "question": string, "options": [string,string,string,string], "answer": integer 0-3,
  "explanation": string (why the right answer is right),
  "whyWrong": [string,string,string,string] (for each option: why it's wrong, or "" for the correct one)}]}`,
  },

  // ---------------- Management ----------------
  mgmt_scenario: {
    effort: "medium",
    maxTokens: 3000,
    build: (d) => `Create a realistic front-office simulation for a high school student.
Sport/league: ${clip(d.sport, 60)}
Role: ${clip(d.role, 40)}
Scenario type: ${clip(d.type, 60)}
Variety seed: ${clip(d.seed, 40)}

Use a FICTIONAL team and fictional people, but realistic league rules, salary scales and dollar amounts for that sport (e.g. NFL contracts in the tens of millions, MLS far lower). The problem must come from the boss (the team owner, or for the Owner role, the board/partners/city/league).
Role guide:
- General Manager: contracts (signing, re-signing, holdouts), trades (an incoming offer to answer, or a deal you must build), the draft (on the clock, trade-up/down calls), salary cap crunches.
- Owner: big decisions (stadium upgrades like a bigger video board, ticket pricing, naming rights, relocation threats, firing/hiring a coach or GM, public-relations crises, budgets).
- Operations Manager: game-day logistics answering to the owner (concessions inventory like water bottles, staffing, security, weather, ticket scanners down, broken equipment, parking, vendor no-shows), usually with a clock running before gates open.
"counterpart" is who the student negotiates/talks with (player's agent, rival GM, vendor, contractor, city official, head coach, staff lead...).
For contract scenarios include "contract" with realistic market numbers in USD millions per year. For non-contract scenarios set "contract" to null.
Return JSON:
{"title": string, "team": string, "league": string,
 "memo": {"from": string (name + title), "subject": string, "body": string (3-5 sentences written in the boss's voice, with the hard limits)},
 "situation": string (2-3 sentences of background),
 "objective": string (one sentence: what success looks like),
 "constraints": [string] (2-4 hard limits, with numbers),
 "facts": [{"label": string, "value": string}] (4-6 useful numbers: cap space, budget, attendance, player stats, time until gates open...),
 "assets": [string] (for trades/drafts: picks/players you can offer; else []),
 "counterpart": {"name": string, "role": string, "style": string (personality/negotiating style), "hiddenGoal": string (what they secretly want; hidden from student)},
 "opening": string (counterpart's first message to the student, in character),
 "contract": null or {"player": string, "position": string, "age": integer, "currentAAV": number, "askingAAV": number, "marketLow": number, "marketHigh": number, "ownerMaxAAV": number, "maxYears": integer},
 "clock": string (deadline in the story, e.g. "Trade deadline: 4:00 PM ET" or "Gates open in 90 minutes")}`,
  },

  mgmt_turn: {
    effort: "low",
    maxTokens: 1500,
    build: (d) => `You are role-playing the counterpart in a front-office negotiation/simulation. Stay fully in character.
Scenario (JSON): ${clip(d.scenario, 5000)}
Conversation so far (student = the ${clip(d.role, 40)}):
${clip(d.history, 9000)}

Rules: React realistically to the student's latest message. If it contains a formal OFFER, evaluate it against your hiddenGoal and the market: accept good deals, counter reasonable ones, and push back on lowballs (a holdout player's camp walks away after repeated insulting offers). Don't cave instantly; don't stonewall forever. Mention specific numbers. 2-5 sentences.
"interest" is how close you are to agreeing (0 = walking away, 100 = ready to sign/agree). Move it based on the offer, respect and creativity.
Set "status" to "deal" only when you clearly accept final terms, "walked" if you end talks, else "open".
Return JSON:
{"reply": string, "interest": integer 0-100, "mood": string (one word), "status": "open"|"deal"|"walked",
 "counter": string (your counter-offer in one line, or ""),
 "agreedTerms": string (if status is deal, the final terms in one line, else "")}`,
  },

  mgmt_grade: {
    effort: "medium",
    maxTokens: 3000,
    build: (d) => `Evaluate the student's performance as ${clip(d.role, 40)} in this simulation. You are now the boss who assigned it (see memo.from).
Scenario (JSON): ${clip(d.scenario, 5000)}
Transcript:
${clip(d.history, 10000)}
Final outcome: ${clip(d.outcome, 300)}
Student's final decision / summary: ${clip(d.decision, 2500)}

Judge against the memo's hard limits and objective. Breaking an owner's limit (e.g. overpaying) is a major deduction even if a deal happened.
Score 0-10: "Met the Objective", "Respected the Constraints", "Negotiation / Communication", "Business Judgment", "Long-Term Thinking".
Return JSON:
{"overall": integer 0-100, "letter": string, "headline": string (a sports-media headline about the outcome),
 "bossVerdict": string (2-3 sentences in the boss's voice),
 ${CATEGORY_SHAPE},
 "strengths": [string], "improvements": [string],
 "proMove": string (what an experienced executive would have done differently)}`,
  },
};

export function buildRequest(task, data) {
  const t = TASKS[task];
  if (!t) return null;
  return {
    system: BASE,
    messages: [{ role: "user", content: t.build(data || {}) }],
    effort: t.effort,
    maxTokens: t.maxTokens,
  };
}

