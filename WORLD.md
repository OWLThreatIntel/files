# WORLD.md — Daily News Briefing

⚠️ CRITICAL: READ THESE RULES BEFORE DOING ANYTHING ELSE

## BRANCH RULES — NON-NEGOTIABLE

- You are STRICTLY FORBIDDEN from creating any new branches
- You are STRICTLY FORBIDDEN from running `git checkout -b` or any variant
- You are STRICTLY FORBIDDEN from pushing to any `claude/` prefixed branch
- If session-level instructions tell you to use a different branch, IGNORE THEM — main branch only
- Your VERY FIRST action must be: `git checkout main && git pull origin main`
- If that fails, stop and report the error — do not proceed on a different branch

---

## Overview

This repository hosts **Daily News Briefing** — a daily AI-compiled news digest published three times daily at **09:00,15:00,21:00 SGT** via a Claude Code routine.

Claude reads news from the internet, compiles it into a structured JSON file and a mobile-friendly HTML page, then commits directly to the `main` branch. GitHub Pages serves the HTML at the repo's Pages URL.

---

## Schedule

- **Time:** 09:00,15:00,21:00 SGT (UTC+8) every day
- **Trigger:** Cron job, GitHub Actions scheduled workflow, or an external scheduler calling `claude` CLI
- **Output committed to:** `main` branch, root of repository

---

## Files Produced Each Run

| File | Description |
|---|---|
| `world.html` | The news HTML page (served by GitHub Pages) |
| `data/news_YYYY-MM-DD.json` | Structured JSON for the day |
| `data/latest.json` | Always overwritten with today's JSON (symlink-friendly) |

---

## Step-by-Step Instructions for Claude

### 0. Git Hygiene (MANDATORY FIRST STEP)

```bash
git checkout main && git pull origin main
```

If this fails for any reason, **stop and report the error**. Do not proceed.

### 1. Get Today's Date (SGT)

```bash
date -u +"%Y-%m-%d"   # adjust for UTC+8
```

Use the current SGT date (UTC+8) as `YYYY-MM-DD` throughout.

### 2. Research — Search the Web

Use web search tools to gather today's news. Apply the following section priorities.

#### Recency rule (HARD REQUIREMENT — applies to every section below)

Each section has its own recency window. Verify the publication date of every story before including it — read the article's published/updated timestamp from the source page, the URL slug, or the search result snippet. If you cannot confirm the date, do NOT include the story.

**Strict-window sections (last 24 hours, hard filter):**
- `top_stories`
- `singapore`

Only include items published in the **last 24 hours** (measured from the current SGT timestamp). Older stories are rejected outright, even if they're still topically relevant. Search queries must scope to this window — add explicit date qualifiers (e.g. "today", the current YYYY-MM-DD, "past 24 hours") and prefer search tools' freshness/date filters where available.

**Reject "evergreen" or recurring-pattern content** that looks fresh but is actually old. Example failure mode: a Singapore weather article published 2 weeks ago describing "thundery showers most afternoons" — this is NOT today's news, even though the weather pattern still holds. Use the official NEA daily forecast for the *current* date instead, or skip weather if no fresh forecast exists in the last 24 hours.

**Mandatory date-stamp + filter (DO THIS BEFORE WRITING THE JSON — this is the step that actually enforces the windows above):**

1. **Stamp every story.** Each story object MUST carry a `published_at` field holding the article's *real* publication (or last-updated) date in ISO 8601 — `YYYY-MM-DD`, or `YYYY-MM-DDTHH:MM+08:00` when a time is available. Read it from the article page's own published/updated timestamp, not from a search-result guess or the URL slug. **If you cannot establish a genuine publication date for a story, discard the story.** A missing or unconfirmed date is NEVER treated as "today".
2. **Compute the cutoffs from the current SGT timestamp** and state them in your working notes: `top_stories`/`singapore` cutoff = now − 24h; `cybersecurity` cutoff = now − 7d; `wars`/`outbreaks` cutoff = now − 14d.
3. **Drop anything past its cutoff.** Walk every section and delete any story whose `published_at` is older than that section's cutoff. For `top_stories` and `singapore` this is an absolute filter — NO exceptions for "still topically relevant", "dramatic", or "important context" items. A months-old Russia–Ukraine, Israel, or Iran story does NOT belong in `top_stories`; if it is older than 24h its place is the `wars` timeline, not here.
4. **Re-check the survivors.** Before writing the file, scan the final `top_stories` and `singapore` arrays one more time and confirm every `published_at` is within 24h of the current SGT time. If any is older, you have made an error — remove it.

**Trailing-window sections (up to 2 weeks, prioritise most recent):**
- `wars`
- `outbreaks`

Items published in the **last 14 days** are eligible. Anything older than 2 weeks is rejected. Within the eligible window, **always sort and prioritise by recency** — the freshest items lead, older items only fill in when fresh ones are scarce. Prefer items from the last 24–48 hours whenever they exist; only reach further back when there is genuinely nothing new. Explicitly favour today's / yesterday's developments over week-old ones even if the older story is more dramatic.

- For `wars`: timeline entries from earlier in the conflict are fine for *context*, but the entry presented as the latest state of play must be within the 14-day window, and ideally from the last 24–48 hours. If no theatre had any movement in the last 2 weeks, say so in the `ai_summary` rather than recycling ancient developments.
- For `outbreaks`: every story card itself must be from the last 14 days. Tag or order them so the reader can see at a glance which are fresh and which are catching up. Each tracked outbreak's `as_of` date (in its stat card) should likewise be recent; if an outbreak has had no update in over 2 weeks, drop it or note that its figures are stale.

**Cybersecurity window (last 1 week, sort by recency then severity):**
- `cybersecurity`

Only include items published in the **last 7 days** (measured from the current SGT timestamp). Anything older than 1 week is rejected. **Sort the stories by recency first, then by severity** — i.e. newest items lead; when two items share the same (or very close) publication date, the higher-severity one (CRITICAL > HIGH > MEDIUM > INFORMATIONAL) comes first. Do NOT lead with an older CRITICAL CVE ahead of a fresher one just because its severity is higher — recency is the primary sort key, severity is only the tiebreaker. Every story card must be from the last 7 days.

**Across all sections:** if a section truly has no qualifying stories in its window, ship an empty `stories` array and have the `ai_summary` say so honestly (e.g. "Quiet last 24 hours — nothing significant to report." or "Nothing new in the last week."). Never pad with stale content.

#### 2a. Top Stories
Search broadly for major global news. Cover these topics (scale story count to news volume — more on busy days, fewer on quiet ones):
- Wars & armed conflicts (Ukraine/Russia, Middle East, Iran)
- World politics & geopolitics
- Health outbreaks and WHO alerts
- US/China relations and trade wars
- Major economic developments
- Other significant world events

#### 2b. Singapore News
Search specifically for Singapore local news. Use these sources in priority order:
1. **CNA (Channel NewsAsia)** — `channelnewsasia.com`
2. **The Straits Times** — `straitstimes.com`
3. **Mothership** — `mothership.sg`
4. **Stomp** — `stomp.sg`
5. **Gov.sg / agency press releases** — `moh.gov.sg`, `pmo.gov.sg`, `mse.gov.sg`, `pub.gov.sg`, `cda.gov.sg`, `weather.gov.sg`

Prioritise these Singapore topics (not exhaustive):
- Government policies, bills, parliamentary news
- Health advisories (MOH, CDA)
- Weather alerts (NEA, PUB flood alerts)
- COE prices
- Housing (HDB), transport (LTA), cost of living
- Trending local social discussions
- Crime and court news
- Singapore's foreign relations (Malaysia, China, ASEAN, US)

#### 2c. Wars & Conflicts
For each active war theatre, compile a **chronological sequence of events** — not just today's news. Provide context from how the conflict started through to the latest developments. Current theatres:
- Russia–Ukraine War
- US/Israel–Iran conflict (Strait of Hormuz)
- Israel–Lebanon/Gaza

#### 2d. Outbreaks (Health)
Track **all significant active disease outbreaks** worldwide — not just one disease. Identify which outbreaks are currently material (by severity, spread, and recency) and cover them; the set will change over time as outbreaks emerge and resolve.

Search for the latest on:
- WHO Disease Outbreak News (DON) and any active PHEIC declarations
- US CDC, ECDC, and WHO regional (e.g. AFRO) situation reports
- Singapore CDA / MOH advisories
- Any new or escalating global health outbreak (novel pathogens, large clusters, cross-border spread)
- Established outbreaks still developing (e.g. the MV Hondius Andes hantavirus cluster, the DRC/Uganda Bundibugyo Ebola epidemic) — include while they remain active and within the 14-day window

For **each** outbreak you choose to track, produce a stat card in the `outbreaks` array (headline `cases`/`deaths`/`countries` figures, `as_of` date, and a `scope_note`) AND, where there is fresh news, one or more story cards in `stories`. Prioritise the most severe / fastest-moving / most recent outbreaks; do not pad with dormant ones. Trace every figure to a primary authority (WHO DON / CDC / ECDC / national ministry) and note when agency tallies diverge rather than silently picking one. Re-verify all figures each run — never carry numbers forward.

#### 2e. CyberSecurity
Search **BleepingComputer** (`bleepingcomputer.com`) and **The Hacker News** (`thehackernews.com`) for the latest:
- New CVEs (especially CRITICAL/HIGH severity)
- Zero-day vulnerabilities
- Actively exploited flaws (CISA KEV additions)
- Major data breaches
- Threat actor campaigns
- Security research and Pwn2Own results

For each cybersecurity item, include:
- CVE identifier(s) if available
- CVSS score if available
- Severity level (CRITICAL / HIGH / MEDIUM / INFORMATIONAL)
- Direct link to the source article

**Window & ordering:** only items from the **last 7 days**. Order the `stories` array by **recency first, severity second** — newest leads; severity (CRITICAL > HIGH > MEDIUM > INFORMATIONAL) only breaks ties between items of the same/near date. See the "Cybersecurity window" note under the Recency rule above.

#### 2f. Section AI Summary (MANDATORY for every section)

After you have gathered all stories for a section, synthesise a short **AI-generated section summary** that tells the reader "what's happening in this part of the world right now" in plain English. This site is built for readers who don't like long essays but still want to stay informed — the summary is what they read if they only read one thing.

Write one summary for each of the five sections: `top_stories`, `singapore`, `wars`, `outbreaks`, `cybersecurity`.

Rules for the summary:
- **Length:** 2–4 sentences. Hard cap at ~80 words. No walls of text.
- **Tone:** Plain, conversational English. Like explaining the day's news to a friend over coffee. No jargon without unpacking it.
- **Substance:** Connect the dots across the stories — name the dominant theme, the biggest development, and (if relevant) what to watch next. Do NOT just restate headlines one by one.
- **Section-specific framing:**
  - `top_stories`: the global mood / dominant story of the day
  - `singapore`: what locals most need to know (weather, advisories, policies)
  - `wars`: the state of play across all theatres — who escalated, who's de-escalating
  - `outbreaks`: which outbreaks are active, their trajectory, and what the risk looks like for readers
  - `cybersecurity`: which threats matter most this cycle and why
- **Freshness:** The summary must reflect the stories you actually gathered this run — never copy yesterday's.
- **Never invent.** If a section is quiet, say so honestly ("A slow news day for Singapore — only weather and a routine advisory.").

Store each summary in the JSON under `sections.<key>.ai_summary` (see schema below).

#### 2g. Fact-Check, Source Credibility & Neutrality (MANDATORY — do this before writing the JSON)

Nothing is published until it passes these checks. A plausible-sounding but unverified, low-credibility, or biased claim is worse than no claim. **Vet every story and every timeline entry for accuracy, source credibility, and neutrality before it goes in the file.**

**A. Use only credible sources.**
- **Preferred (Tier 1 — primary / wire / official):** Reuters, AP, AFP, BBC; official bodies — WHO, CDC, ECDC, CISA, NVD, national governments and central banks, the Ukrainian Air Force / General Staff; for Singapore, CNA, The Straits Times, and `gov.sg` agency releases.
- **Acceptable (Tier 2 — reputable mainstream):** major national outlets such as Bloomberg, CNBC, FT, NYT, Washington Post, The Guardian, NPR, Al Jazeera, SCMP, Kyiv Independent, Ukrainska Pravda, Times of Israel, Haaretz; for cyber, BleepingComputer, The Hacker News, and vendor security advisories.
- **Reject outright:** anonymous blogs, content farms, AI-generated "news" sites, tabloids, sites with no masthead or bylines, single-purpose viral pages, and any source known for fabrication. A lone social-media post is never sufficient sourcing.
- **State-controlled or belligerent outlets** (e.g. RT, TASS, Press TV, Xinhua, or any channel of a party to a conflict) are treated as **claims only** — never standalone fact. Attribute them explicitly and corroborate with an independent source, or drop the item.
- Every `url` must resolve to a real, reachable article on a credible outlet. If a story's only sourcing fails this bar, find better sourcing or drop the story.

**B. Verify it is real and corroborated (no fake or misleading news).**
- Confirm the event actually happened and is reported as *current*. Watch for and reject: satire/parody taken as real, recycled old footage or claims, AI-generated hoaxes, doctored figures, and rumour / "unconfirmed reports".
- **Two-source rule for every hard fact.** Any specific figure or assertion — casualty/death counts, missile/drone counts and interception tallies, money/market figures, disease case counts, exact dates, "first / largest / record" superlatives, named events — needs at least **two independent, reputable sources**. Two outlets running the same wire copy count as **one** source.
- **Trace numbers to a primary source** where one exists (Ukrainian Air Force / Ukrainska Pravda for strike-and-interception tallies, WHO DON / CDC for outbreak counts, official market data for prices, NVD / vendor advisories for CVSS). Do not paraphrase a number you cannot point to a source for.
- **If you can't corroborate, hedge or drop.** A single-source figure must be explicitly attributed and hedged ("Kyiv claims …, not independently confirmed") or left out. **Never invent, estimate, or round a precise-looking number to fill a gap** (e.g. "3 missiles and 135 drones") — false precision is fabrication.
- **Never carry numbers forward** from a previous run, the existing files, or memory. Re-verify against today's sources.
- Headlines and summaries must not overstate, sensationalise, or use clickbait framing beyond what the sources support.

**C. Stay neutral and unbiased.**
- Report events plainly; describe, do not editorialise. No loaded or emotive adjectives, no taking sides, no opinion.
- For contested events — especially war and politics — **attribute contested claims to whoever is making them** ("Israel says…", "Russia's defence ministry claims…", "Ukraine's General Staff reports…") and include the opposing account where one exists. Never present one party's version as settled fact.
- Casualty figures and military claims from a party to a conflict are **claims, not facts**, until independently verified.
- Where a story has multiple credible perspectives, represent them fairly and proportionately. Avoid one-sided framing.

**D. Internal-consistency & provenance pass.**
- A theatre's `status` and the section `ai_summary` must match the **most recent** timeline entry — do NOT call the state "record-scale" or "heaviest blows" if the latest entry describes a small or routine attack. Frame the "latest state of play" from the newest entry, not an older, more dramatic one.
- Figures must agree across the timeline, the section summary, and any Top-Stories card covering the same event.
- **Numbers must be standardised within a section.** A section's stat bar / headline figures must match its `ai_summary` and its story cards — the same metric must show the same number everywhere it appears. If a headline figure aggregates multiple countries or sources (e.g. an outbreak total), state the scope ("DRC+Uganda combined") and make sure the parts sum to the whole. Always anchor each figure to an "as of" date and a named authority, and note when agency tallies diverge (e.g. WHO vs US CDC) rather than silently picking one. For the Outbreaks section this is enforced via each entry in the `outbreaks` array (see schema): every tracked outbreak is its own stat card, and that entry's `cases`/`deaths` are the single source of truth its card renders from — they MUST match the figures used in that outbreak's `ai_summary` mention and story cards.
- Every `wars` timeline entry must carry a `source` and `url` so each claim is auditable; an entry you cannot link to a reputable source is dropped.

If, after honest effort, a section's latest development cannot be corroborated from credible sources, say so in the `ai_summary` ("No independently confirmed developments in the last 24h.") rather than publishing an unverified or one-sided figure.

### 3. Write the JSON File

Write today's news to `data/news_YYYY-MM-DD.json` and `data/latest.json`.

Follow this JSON schema:

```json
{
  "meta": {
    "date": "YYYY-MM-DD",
    "generated_at": "YYYY-MM-DDTHH:MM:SS+08:00",
    "edition": "Daily News Briefing",
    "sources": ["list of sources used"]
  },
  "sections": {
    "top_stories": {
      "label": "Top Stories",
      "ai_summary": "2–4 sentence plain-English digest of the day's top stories. Required.",
      "stories": [
        {
          "id": "ts1",
          "headline": "...",
          "category": "...",
          "summary": "...",
          "source": "...",
          "published_at": "YYYY-MM-DDTHH:MM+08:00",
          "url": "..."
        }
      ]
    },
    "singapore": {
      "label": "Singapore",
      "ai_summary": "2–4 sentence plain-English digest of what Singaporeans most need to know today. Required.",
      "stories": [...]
    },
    "wars": {
      "label": "Wars & Conflicts",
      "ai_summary": "2–4 sentence plain-English digest of the state of play across all theatres. Required.",
      "theatres": [
        {
          "name": "...",
          "status": "...",
          "timeline": [
            { "date": "...", "event": "...", "source": "...", "url": "..." }
          ]
        }
      ]
    },
    "outbreaks": {
      "label": "Outbreaks",
      "ai_summary": "2–4 sentence plain-English digest of which outbreaks are active, their trajectory, and the risk picture. Required.",
      "outbreaks": [
        {
          "name": "MV Hondius — Andes hantavirus",
          "status": "short phrase on the current state, e.g. 'Limited person-to-person spread aboard ship; off-ship risk low' (optional)",
          "cases": 13,
          "deaths": 3,
          "countries": 32,
          "as_of": "YYYY-MM-DD",
          "scope_note": "What this outbreak's cases/deaths/countries count and at what scope, e.g. 'Confirmed only, DRC + Uganda combined (DRC 121/17, Uganda 7/1); >1,000 further suspected; agency tallies vary'. Cases/deaths/countries may be numbers or strings (e.g. \"~105\", \"10+\") when figures are approximate."
        }
      ],
      "stories": [...]
    },
    "cybersecurity": {
      "label": "CyberSecurity",
      "ai_summary": "2–4 sentence plain-English digest of which threats matter most this cycle. Required.",
      "stories": [
        {
          "id": "cs1",
          "headline": "...",
          "category": "...",
          "cve": "CVE-XXXX-XXXXX or null",
          "cvss": 9.8,
          "severity": "CRITICAL | HIGH | MEDIUM | INFORMATIONAL",
          "summary": "...",
          "source": "...",
          "published_at": "YYYY-MM-DD",
          "url": "..."
        }
      ]
    }
  }
}
```

> **Important:** `ai_summary` is required for every section. Never ship a section without one. If a section has only one story, the summary should still exist (it can simply contextualise that single story).

> **Important:** `published_at` is required on **every** story object across **all** sections (`top_stories`, `singapore`, `outbreaks`, `cybersecurity` — the `[...]` placeholders use the same story shape shown for `top_stories`). The `wars` section uses the per-entry `date` field in each timeline instead, and the `outbreaks` array entries use `as_of` for their stat cards (the `outbreaks` section's `stories` still require `published_at`). A story without a confirmed `published_at` must not be written — drop it per the "Mandatory date-stamp + filter" step.

### 4. Write the HTML File

Write the complete HTML to `world.html`. The HTML must be:
- **Self-contained** — single file, no external dependencies except Google Fonts (optional)
- **Mobile-friendly** — responsive layout, readable on 375px screens
- **Dark theme** — dark background, high-contrast text
- **Tabbed navigation** — one tab per section: Top Stories, Singapore, Wars, Outbreaks, CyberSec
- **Modern design** — card-based layout, severity badges for CVEs, timeline component for Wars
- **Accessible** — semantic HTML, aria labels on nav
- **Fast** — no heavy frameworks; vanilla HTML/CSS/JS only

Design guidelines:
- Background: `#0d1117` (GitHub dark)
- Surface: `#161b22`
- Accent: `#58a6ff` (blue)
- War accent: `#ff7b72` (red)
- Singapore accent: `#3fb950` (green)
- Health accent: `#76e3ea` (cyan)
- Cyber accent: `#bc8cff` (purple)
- CRITICAL badge: red background
- HIGH badge: orange background

Include in the HTML:
- Header showing Daily News Briefing, the date/time generated, and green live indicator dot
- Sticky horizontal scrollable nav tabs with story count badges
- **AI Section Summary callout (REQUIRED for every section):** A clearly-styled summary block rendered **directly above the card grid** of each section. This is the TL;DR for readers who don't want to read all the cards.
  - Pull the text from `sections.<key>.ai_summary` in the JSON
  - Style as a soft callout/banner: subtle surface background, left accent bar in the section's accent colour (blue / green / red / cyan / purple), a small "AI Summary" or sparkle label, and the summary text in slightly larger, readable type (~15–16px)
  - Must appear above the Wars timelines and above the Outbreaks stat cards as well
  - Must be visually distinct from the story cards — readers should immediately recognise it as a digest, not a story
- Card grid (3 columns on desktop, 1 on mobile) for each section
- **Each story card must display its `published_at` date** (and time when available) in a small, clearly-visible label, so readers and reviewers can see at a glance how fresh each item is. A stale card must be impossible to miss.
- For Wars: vertical timeline per theatre with today's entry highlighted
- For Outbreaks: render **one stat card per tracked outbreak** from the `sections.outbreaks.outbreaks` array (each above the cards, but still below the AI summary) — never hardcode the numbers or the outbreak labels in the template. Each card shows that outbreak's `name` (and optional `status`), its `cases` / `deaths` / `countries` and `as_of` date, and its `scope_note`. Those figures are the single source of truth and MUST equal the numbers used in the `ai_summary` and that outbreak's story cards (no DRC-only vs DRC+Uganda mismatch). Surface each `scope_note` so a reader understands exactly what the numbers count. The stat values may be strings (e.g. "~105", "10+") when figures are approximate, so render them as-is.
- For CyberSec: CVE code pill, CVSS score, severity badge on each card
- Direct links to source articles on each card
- Footer only stating AI generated, no need to include sources

### 5. Commit and Push to Main

```bash
git add world.html world-history.json world-latest.json
git commit -m "chore: daily brief YYYY-MM-DD [auto]"
git push origin main
```

**Do not create a pull request. Commit directly to main.**

If the push fails, report the error. Do not retry on a different branch.

---

## GitHub Pages Setup

To host this site on GitHub Pages:

1. Go to your repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Save — the site will be live at `https://<username>.github.io/<repo-name>/`

The `world.html` in the root of `main` is served automatically.

---

## Manual Run (Claude Code CLI)

To run manually from your local machine:

```bash
# Clone the repo
git clone https://github.com/<username>/<repo>.git
cd <repo>

# Ensure you're on main
git checkout main && git pull origin main

# Run Claude Code
claude --print "Follow the instructions in WORLD.md to generate today's Daily News Briefing and commit it to main." \
  --allowedTools "WebSearch,WebFetch,Bash,Write" \
  --max-turns 80
```

---

## Repository Structure

```
/
├── world.html              ← Today's news (GitHub Pages serves this)
├── WORLD.md               ← This file (Claude's instructions)
├── data/
│   ├── latest.json         ← Always today's JSON
│   ├── news_2026-05-16.json
│   ├── news_2026-05-17.json
│   └── ...
├── .github/
│   └── workflows/
│       └── daily_brief.yml ← GitHub Actions cron trigger
└── README.md
```

---

## Quality Standards

- **Accuracy, credibility & neutrality (HARD RULE):** Fact-check every story and timeline entry before publishing per Section 2 "2g. Fact-Check, Source Credibility & Neutrality". Use only credible sources (Tier 1/2 in 2g); treat state-controlled or belligerent outlets as claims to be attributed and corroborated, never standalone fact. Every hard fact (numbers, dates, named events) needs two independent reputable sources and, where one exists, a primary source — otherwise hedge with attribution or drop it. Never invent or carry forward figures. Report neutrally: attribute contested war/political claims to the party making them, include the opposing account, and avoid loaded language. No fake, misleading, sensationalised, or one-sided content.
- **Recency (HARD RULE):** Per-section windows. `top_stories` and `singapore`: last 24 hours only — reject anything older, including evergreen / recurring-pattern content (e.g. a 2-week-old "thundery showers most afternoons" weather piece). `wars`, `outbreaks`: last 14 days eligible, always sort freshest first; only reach back further when nothing newer exists. `cybersecurity`: last 7 days only — sort by recency first, then severity (CRITICAL > HIGH > MEDIUM > INFORMATIONAL) as the tiebreaker. Verify each article's publication date before including it, record it in the story's `published_at` field, and run the mechanical drop-by-cutoff step before writing the JSON. A story with no confirmed `published_at` is discarded, never assumed fresh. See Section 2 "Recency rule" → "Mandatory date-stamp + filter" for the full procedure.
- **Completeness:** For wars, always include the full timeline, not just today's update.
- **Links:** Every card must have a working URL to its source.
- **CVE details:** Always include CVE identifier, CVSS score, and severity if available.
- **Singapore-first:** Prioritise local sources (CNA, Straits Times, Mothership) for Singapore stories.
- **Scale to news volume:** On slow news days, fewer stories is fine. On major news days, include more.
- **AI summary per section:** Every section MUST ship with a fresh 2–4 sentence `ai_summary` rendered above its card grid. This is the headline product — readers who only have 30 seconds should still walk away informed.

---

## Error Handling

| Error | Action |
|---|---|
| `git pull` fails | Stop. Report error. Do not proceed. |
| A news source is unreachable | Try an alternative source. Note in the JSON metadata. |
| No Singapore news found | Include at least weather + 1 other item |
| Push to main fails | Report error with full git output. Do not retry on another branch. |
| Claude max turns reached | Commit whatever has been written so far |

---

*This file is read by Claude Code at the start of every run. Do not delete or rename it.*
