I've read the codebase — single-page Next.js 14 client component (~210 LOC), localStorage persistence, 20 seeded prospects, XP/streak/mission-bar gamification, and a basic prospect table. Here's the review.

---

# Outreach Dashboard — Product Review

## Executive Summary

The dashboard is a tight, attractive MVP but currently functions as a **counter, not a CRM**. Three structural gaps cap its real-world usefulness:

1. **Activity is decoupled from prospects.** "+Outreach Sent" is a global counter; you can't tell *who* was contacted, *when*, or *what's next*. This is the single biggest friction point — every other CRM feature compounds on top of this.
2. **Status is write-once on add.** Once a prospect is in the table, the only edit is `Remove`. There's no way to advance them through the pipeline without deleting and re-adding (and losing history).
3. **Motivation loop is shallow.** Streak + XP exist but have no *protection*, no *milestones*, and no *daily target*. Once XP hits ~200, the curve flattens and momentum dies.

Fixing #1 and #2 unlocks 80% of the value. Everything else (kanban, AI pitch generation, activity heatmap) is a multiplier on those two foundations.

There's also a **latent bug** in `app/page.tsx:86` — `closed` is hard-set to `1` instead of incrementing, so the dashboard structurally caps at one closed deal. Worth fixing alongside #1.

---

## Top Recommendations (ranked by impact ÷ effort)

| # | Feature | Impact | Effort | Why it matters |
|---|---|---|---|---|
| 1 | **Per-row activity logging + inline status edit** | 🟢 High | S | Connects XP to actual prospects; replaces global +buttons |
| 2 | **Last-contacted date + "follow-up due" badge** | 🟢 High | S | Cold outreach lives or dies on the second touch — currently invisible |
| 3 | **Outreach templates panel (copy-to-clipboard, niche-aware)** | 🟢 High | S | Drops time-per-send from minutes to seconds; the actual execution-speed lever |
| 4 | **Daily quota ring + activity heatmap** | 🟢 High | M | Converts vague "streak" into concrete daily target; visual reward loop |
| 5 | **Kanban pipeline view (toggle from table)** | 🟡 Med | M | Drag prospects across status columns; shows pipeline shape at a glance |
| 6 | **Notes + activity timeline per prospect** | 🟡 Med | M | "What did I say last time?" — the question that kills follow-ups |
| 7 | **AI pitch generator via Vercel AI Gateway** | 🟢 High | M | Per-prospect cold message tailored to niche; leans on stack you already have |
| 8 | **Achievements / milestone badges** | 🟡 Med | S | First reply, 50 sent, 7-day streak — extends motivation past XP plateau |
| 9 | **Streak freeze (1 per week)** | 🟡 Med | XS | Protects momentum on bad days; well-documented retention mechanic |
| 10 | **CSV / JSON import-export** | 🟡 Med | S | Backup, multi-device portability, bulk-add from spreadsheets |
| 11 | **Server persistence (Vercel Blob or Neon via Marketplace)** | 🟡 Med | M | localStorage = one device, one wiped browser = total data loss |
| 12 | **Power-Hour focus mode (25-min timer with live logging)** | 🟢 High | S | Behavior change, not just tracking — drives the actual "send 5 today" |

---

## Quick Wins (this week)

These should each be a few hours and compose well together.

### QW-1 — Inline status + per-row "Log" actions
Replace the row's `Remove` cell with an editable status `<select>` and three quick-action buttons (`📨 Sent`, `📞 Call`, `✅ Closed`). Clicking a button bumps XP **and** auto-advances status **and** stamps `lastContactedAt`. Side-effect: kills the `closed: 1` bug because logging now flows through one path per prospect.

*Data model:* add `lastContactedAt: string | null` and `history: Array<{ type, at }>` per prospect.

### QW-2 — "Days since last contact" column
Render `lastContactedAt` as `2d ago` / `🔴 7d (overdue)`. Anything `>3d && status !== 'Closed' && status !== 'Not Contacted'` gets the warn color. This single column transforms the table from a checklist into a follow-up queue.

### QW-3 — Templates drawer
Hardcode 3 templates (Cafe, Restaurant, Hotel) keyed off `niche`. A `Copy pitch` button on each row reads the niche, fills `{{name}}`, copies to clipboard, and toasts. Re-uses the pitch angles already in `20-yellowknife-outreach-prospects.md:30-32`.

### QW-4 — Streak freeze + clearer streak math
Currently `lastCheck` only advances the streak — it never *breaks* it on miss. Either implement real break logic (compare today vs `lastCheck`, reset if gap > 1) **or** add a "streak freeze" token earned every 7 days that auto-spends on a miss. Clearer mechanics make the streak emotionally load-bearing.

### QW-5 — JSON export/import button
Two buttons in a footer row: `Export backup` (downloads `arias_outreach_<date>.json`) and `Import` (file input, merges or replaces). Defends against the localStorage-wipe failure mode while you decide whether to add server persistence.

### QW-6 — `tel:` and `mailto:` links + phone column
The seed list has phone numbers (`20-yellowknife-outreach-prospects.md`) but the data model doesn't carry them. Add a `phone` field, render as `tel:` link, and you've turned the table into a click-to-call dialer on mobile.

---

## Medium Bets (2–4 weeks)

### MB-1 — Pipeline kanban view
Toggle button: `Table | Pipeline`. Five columns matching `STATUS_OPTIONS`. Drag-to-move auto-logs the activity (drop into "Messaged" → +10 XP, stamp date). Use Motion's layout animations — already in the stack. This is the view that makes the dashboard feel like a real CRM.

### MB-2 — Activity heatmap + daily quota ring
GitHub-style 7×N grid keyed off `history[].at` dates. Above it, a daily ring: "Today: 3/5 sent." The quota target should auto-derive from the mission goal (20 sent over a configurable window). Pairs with the streak system; the heatmap is the *evidence* that the streak is real.

### MB-3 — AI pitch generator (Vercel AI Gateway)
Per-row `✨ Generate pitch` button. Server action calls AI Gateway with `provider/model` string (e.g. `"anthropic/claude-haiku-4.5"`), passes `{ name, niche, locale: 'Yellowknife' }`, returns 2 sentence cold-open + a follow-up. Caches the result on the prospect. This is a high-leverage AI feature that uses infra you already deploy on. Keep it cheap (Haiku) and rate-limited per session.

### MB-4 — Notes + activity timeline per prospect
Click a row → side drawer with: contact details, full history (auto-logged events + manual notes), next-action input. This is the feature that turns "20 prospects" into "an actual book of business" once you scale past the seed list.

### MB-5 — Achievements
~10 unlockable badges with Motion-driven unlock animations: `First Send`, `First Reply`, `Half Mission`, `7-day Streak`, `50 Sent`, `First Close`, `Niche Sweep` (touched all 3 niches), etc. Persist unlocks in state. Render a small badge tray near the level card. Cheap to ship, visible reward surface beyond raw XP.

### MB-6 — Server persistence
localStorage is fine for solo + single-device, but it's a deletion away from total loss. Two reasonable options on the Vercel side: **Vercel Blob** (simplest — JSON blob keyed by user) or **Neon Postgres via Marketplace** (proper schema, ready for multi-user later). Add a thin `/api/state` route. Auth can stay anonymous (cookie-based device id) until you actually need users.

### MB-7 — Power Hour focus mode
Big "Start Power Hour" button → 25-min timer overlay, only the prospect list visible, every logged action animates with confetti, end-of-hour summary card ("You sent 7 in 25 minutes — top 10% of your sessions"). This is the only feature on the list that drives *behavior* rather than tracking it.

---

## Risks / Tradeoffs

- **Scope creep into "real CRM" territory.** Notes, kanban, server persistence, AI pitches — each one inches closer to rebuilding HubSpot. Decide upfront whether this stays a single-operator dashboard or grows into a product. If solo, *resist* multi-user, auth, and team features; if product, reorder MB-6 to first.
- **Gamification can become the goal.** XP for the sake of XP doesn't book calls. Tie every reward to outcomes that actually correlate with revenue (calls booked, deals closed weighted higher). The current 60/30/10 split is reasonable; don't dilute it with badges-for-everything.
- **AI pitch quality risk.** Generic AI cold messages get filtered/ignored. If you ship MB-3, prompt it with concrete local context (the Yellowknife pitch angles, the actual offer pricing) and let the user edit before sending — never auto-send.
- **localStorage migration.** When you ship server persistence (MB-6), you need a one-time migration path or you'll wipe the user's existing streak. A simple "Import from this device" prompt on first server load handles it.
- **Drag-and-drop kanban (MB-1) on mobile is a known UX hazard.** If most usage is mobile (likely for outreach-on-the-go), prioritize the table view + status dropdown over the kanban — or build kanban as desktop-only.
- **The `closed: 1` bug** (`app/page.tsx:86`) is a 1-line fix but ships a subtle data-correctness issue today. Worth fixing in QW-1 even if you defer everything else.
- **Motion bundle size.** `motion/react` is great; just be deliberate about `<motion.*>` proliferation — every animated row in a 100-row table adds up. Use `LayoutGroup` and shared transitions sparingly.
