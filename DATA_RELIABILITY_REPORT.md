# Data Reliability Report

## Scope

This pass focused only on client-side persistence and state integrity for the localStorage-backed outreach dashboard.

## Hardening Completed

- Replaced UTC-based daily keys with local calendar date keys (`YYYY-MM-DD`) so daily quests, heatmap entries, and streak checks follow the user's local day instead of shifting near UTC midnight.
- Added strict date-key validation for `lastCheck` and `dailyActions`, rejecting malformed keys and impossible calendar dates during hydration.
- Normalized persisted counters (`xp`, `sent`, `calls`, `closed`, `streak`, `bestStreak`, daily action counts) into non-negative integers, accepting numeric strings and clamping corrupt negative or fractional values.
- Normalized prospects on hydration:
  - Drops entries without a usable business name.
  - Trims names and niches.
  - Falls back unknown statuses to `Not Contacted`.
  - Converts valid `lastContactedAt` values to ISO timestamps and clears invalid timestamps.
  - Preserves an intentionally empty prospect list instead of reseeding it on reload.
- Preserved migration safety for existing stored data by filling missing `bestStreak`, `dailyActions`, and prospect fields from defaults instead of assuming the newest schema exists.
- Added corrupt localStorage recovery. If the primary payload cannot be parsed or read safely, the app moves the raw value to a timestamped `arias_outreach_game_v1_corrupt_*` backup key when possible, removes the broken primary key, and starts from a clean default state.
- Wrapped localStorage writes so quota errors, blocked storage, or private-mode failures do not crash the dashboard. The in-memory session remains usable even if persistence is temporarily unavailable.
- Saves a normalized state shape back to localStorage after hydration, so migrated legacy data is rewritten in the current schema.

## Daily Counter And Streak Integrity

- The current day is tracked in React state and refreshed every minute while the tab is open, preventing stale daily quest displays after a date boundary.
- Logging outreach/call/closed actions computes the action date at click time, so actions after midnight land in the new day's counter even if the page was opened the previous day.
- Daily check-in also computes the date at click time and rechecks inside the state updater, preventing duplicate XP/streak increments from rapid repeated clicks.
- Streak continuation now depends on validated local calendar-day differences:
  - Same-day check-ins are ignored.
  - A one-day gap continues the streak.
  - A larger gap starts a new streak on check-in.
  - On hydration/date refresh, stale streaks with a gap of two or more days are reset to zero while preserving `bestStreak`.

## Edge Cases Handled

- Empty, missing, or non-object localStorage state.
- Invalid JSON in localStorage.
- Unavailable or throwing localStorage APIs.
- Negative, fractional, non-finite, or stringified numeric counters.
- Unknown prospect statuses.
- Empty prospect names.
- Invalid `lastContactedAt` timestamps.
- Invalid daily action buckets such as `today`, `2026-99-99`, or non-date object keys.
- Intentionally empty prospect lists.
- Browser tabs left open across midnight.
- Legacy data that predates `bestStreak` and normalized daily action records.

## Verification

- `npm run build` was run after the reliability changes.
