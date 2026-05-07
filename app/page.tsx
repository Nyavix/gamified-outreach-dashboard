"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Prospect = { name: string; niche: string; status: string; lastContactedAt?: string };
type DailyActions = {
  sent: number;
  calls: number;
  closed: number;
  checkIn: boolean;
};
type State = {
  xp: number;
  sent: number;
  calls: number;
  closed: number;
  streak: number;
  bestStreak: number;
  lastCheck: string;
  prospects: Prospect[];
  dailyActions: Record<string, DailyActions>;
};

const STORAGE_KEY = "arias_outreach_game_v1";
const STORAGE_CORRUPT_PREFIX = `${STORAGE_KEY}_corrupt`;
const XP_PER_LEVEL = 100;
const DAY_MS = 86_400_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const SEEDED: Prospect[] = [
  ["Barren Ground Coffee", "Cafe"],
  ["Birchwood Coffee", "Cafe"],
  ["Bluebell Eatery", "Restaurant"],
  ["Bullocks Bistro", "Restaurant"],
  ["Copperhouse Eatery + Lounge", "Restaurant"],
  ["Kamp Coffee", "Cafe"],
  ["NWT Brewing Co. / Woodyard", "Brewery/Restaurant"],
  ["Oak & Olive", "Catering/Restaurant"],
  ["Sushi North", "Restaurant"],
  ["The Black Knight Pub", "Pub"],
  ["The Mantle Restaurant & Pub", "Restaurant"],
  ["Trader’s Grill", "Restaurant"],
  ["Wing Freak Inc.", "Restaurant"],
  ["Ricky’s All Day Grill", "Restaurant"],
  ["Chateau Nova Yellowknife", "Hotel"],
  ["Nova Inn Yellowknife", "Hotel"],
  ["Quality Inn & Suites Yellowknife", "Hotel"],
  ["Super 8 Yellowknife", "Hotel"],
  ["The Explorer Hotel", "Hotel"],
  ["Discovery Inn", "Hotel"],
].map(([name, niche]) => ({ name, niche, status: "Not Contacted", lastContactedAt: "" }));

const STATUS_OPTIONS = ["Not Contacted", "Messaged", "Replied", "Call Booked", "Closed"];
const QUICK_ACTIONS = [
  { key: "sent", label: "Sent", status: "Messaged", xp: 10 },
  { key: "calls", label: "Call", status: "Call Booked", xp: 35 },
  { key: "closed", label: "Closed", status: "Closed", xp: 100 },
] as const;

const RANKS = [
  { name: "Rookie", min: 0, color: "#8d95b3" },
  { name: "Bronze", min: 200, color: "#d28a5d" },
  { name: "Silver", min: 600, color: "#c9d2e8" },
  { name: "Gold", min: 1200, color: "#f3c969" },
  { name: "Platinum", min: 2200, color: "#9ad8ff" },
  { name: "Diamond", min: 3500, color: "#bda4ff" },
] as const;

const defaultState = (): State => ({
  xp: 0,
  sent: 0,
  calls: 0,
  closed: 0,
  streak: 0,
  bestStreak: 0,
  lastCheck: "",
  prospects: SEEDED,
  dailyActions: {},
});

const pad2 = (value: number) => String(value).padStart(2, "0");
const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseDateKey = (value: string) => {
  if (!DATE_KEY_RE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};
const levelFromXP = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;
const xpIntoLevel = (xp: number) => xp % XP_PER_LEVEL;
const todayKey = () => localDateKey();
const dateKeyFromOffset = (offset: number, baseKey = todayKey()) => {
  const base = parseDateKey(baseKey) ?? new Date();
  base.setDate(base.getDate() + offset);
  return localDateKey(base);
};
const dayDiff = (a: string, b: string) => {
  const da = parseDateKey(a)?.getTime();
  const db = parseDateKey(b)?.getTime();
  if (da === undefined || db === undefined) return null;
  return Math.round((db - da) / DAY_MS);
};
const emptyDailyActions = (): DailyActions => ({ sent: 0, calls: 0, closed: 0, checkIn: false });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};
const toCount = (value: unknown, fallback = 0) => Math.max(0, Math.floor(toNumber(value, fallback)));
const normalizeStatus = (value: unknown) =>
  typeof value === "string" && STATUS_OPTIONS.includes(value) ? value : STATUS_OPTIONS[0];
const normalizeDateTime = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};
const normalizeDateKey = (value: unknown) =>
  typeof value === "string" && parseDateKey(value) ? value : "";
const normalizeProspect = (value: unknown): Prospect | null => {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  const name = value.name.trim();
  if (!name) return null;
  return {
    name,
    niche: typeof value.niche === "string" ? value.niche.trim() : "",
    status: normalizeStatus(value.status),
    lastContactedAt: normalizeDateTime(value.lastContactedAt),
  };
};
const normalizeDailyActions = (value: unknown): Record<string, DailyActions> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([date]) => Boolean(parseDateKey(date)))
      .map(([date, actions]) => {
        if (!isRecord(actions)) return [date, emptyDailyActions()];
        return [
          date,
          {
            sent: toCount(actions.sent),
            calls: toCount(actions.calls),
            closed: toCount(actions.closed),
            checkIn: Boolean(actions.checkIn),
          },
        ];
      }),
  );
};
const normalizeState = (value: unknown): State => {
  const fallback = defaultState();
  if (!isRecord(value)) return fallback;
  const prospects = Array.isArray(value.prospects)
    ? value.prospects.map(normalizeProspect).filter((p): p is Prospect => Boolean(p))
    : null;
  const streak = toCount(value.streak, fallback.streak);

  return {
    xp: toCount(value.xp, fallback.xp),
    sent: toCount(value.sent, fallback.sent),
    calls: toCount(value.calls, fallback.calls),
    closed: toCount(value.closed, fallback.closed),
    streak,
    bestStreak: Math.max(streak, toCount(value.bestStreak, 0)),
    lastCheck: normalizeDateKey(value.lastCheck),
    prospects: prospects ?? fallback.prospects,
    dailyActions: normalizeDailyActions(value.dailyActions),
  };
};
const formatDate = (value?: string) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
};
const daysSince = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / DAY_MS);
};
type Rank = (typeof RANKS)[number];
const rankFor = (xp: number): { current: Rank; next: Rank | undefined } => {
  const current = RANKS.reduce<Rank>((matched, tier) => (xp >= tier.min ? tier : matched), RANKS[0]);
  const next = RANKS.find((tier) => tier.min > xp);
  return { current, next };
};
const templateFor = (prospect: Prospect) => {
  const niche = prospect.niche.toLowerCase();
  if (niche.includes("cafe") || niche.includes("coffee")) {
    return `Hi ${prospect.name}, I noticed local cafes can lose regulars when menus, hours, or reviews are hard to scan online. I put together quick website and Google profile audits for cafes. Want me to send a 3-point snapshot for ${prospect.name}?`;
  }
  if (niche.includes("restaurant") || niche.includes("pub") || niche.includes("bistro")) {
    return `Hi ${prospect.name}, I help restaurants spot small website and Google profile fixes that can turn more searches into bookings. Want me to send a quick 3-point audit for ${prospect.name}?`;
  }
  if (niche.includes("hotel") || niche.includes("inn")) {
    return `Hi ${prospect.name}, I help hotels find booking leaks across their website and Google profile. Want me to send a quick 3-point audit with practical fixes for ${prospect.name}?`;
  }
  return `Hi ${prospect.name}, I help local businesses find simple online fixes that can create more calls, bookings, or visits. Want me to send a quick 3-point audit for ${prospect.name}?`;
};
const heatScore = (actions?: DailyActions) => {
  if (!actions) return 0;
  return actions.sent + actions.calls * 3 + actions.closed * 6 + (actions.checkIn ? 1 : 0);
};
const loadStoredState = (): State => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        window.localStorage.setItem(`${STORAGE_CORRUPT_PREFIX}_${Date.now()}`, raw);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    return defaultState();
  }
};
const saveStoredState = (state: State) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    // Keep the in-memory session usable when storage is unavailable or full.
  }
};

export default function Page() {
  const [state, setState] = useState<State>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [currentDay, setCurrentDay] = useState(todayKey);
  const [bizName, setBizName] = useState("");
  const [bizNiche, setBizNiche] = useState("");
  const [bizStatus, setBizStatus] = useState(STATUS_OPTIONS[0]);
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState("All");
  const [copiedKey, setCopiedKey] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "prospects" | "service" | "alignment">("dashboard");
  const [slideDirection, setSlideDirection] = useState(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setState(loadStoredState());
    setCurrentDay(todayKey());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveStoredState(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const interval = window.setInterval(() => {
      setCurrentDay((day) => {
        const next = todayKey();
        return next === day ? day : next;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [hydrated]);

  // Auto-reset a stale streak (gap of 2+ days since last check-in) on mount.
  useEffect(() => {
    if (!hydrated || !state.lastCheck) return;
    const gap = dayDiff(state.lastCheck, currentDay);
    if (gap !== null && gap >= 2 && state.streak !== 0) {
      setState((s) => ({ ...s, streak: 0 }));
    }
  }, [hydrated, currentDay, state.lastCheck, state.streak]);

  const pct = useMemo(() => {
    const outreach = Math.min(state.sent / 20, 1) * 60;
    const calls = Math.min(state.calls / 3, 1) * 30;
    const close = Math.min(state.closed / 1, 1) * 10;
    return Math.round(outreach + calls + close);
  }, [state.sent, state.calls, state.closed]);

  const today = currentDay;
  const todayActions = state.dailyActions[today] ?? emptyDailyActions();
  const { current: rank, next: nextRank } = rankFor(state.xp);
  const rankProgress = nextRank
    ? Math.round(((state.xp - rank.min) / (nextRank.min - rank.min)) * 100)
    : 100;
  const xpToNext = nextRank ? nextRank.min - state.xp : 0;
  const levelXP = xpIntoLevel(state.xp);
  const nicheOptions = useMemo(
    () =>
      ["All", ...Array.from(new Set(state.prospects.map((p) => p.niche).filter(Boolean))).sort()],
    [state.prospects],
  );
  const visibleProspects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return state.prospects
      .map((prospect, index) => ({ prospect, index }))
      .filter(({ prospect }) => {
        const matchesSearch =
          !needle ||
          prospect.name.toLowerCase().includes(needle) ||
          prospect.niche.toLowerCase().includes(needle) ||
          prospect.status.toLowerCase().includes(needle);
        const matchesNiche = nicheFilter === "All" || prospect.niche === nicheFilter;
        return matchesSearch && matchesNiche;
      });
  }, [state.prospects, search, nicheFilter]);
  const quests = [
    { title: "Send 5 outreach", current: todayActions.sent, target: 5 },
    { title: "Book 1 call", current: todayActions.calls, target: 1 },
    { title: "Close 1 deal", current: todayActions.closed, target: 1 },
    { title: "Daily check-in", current: todayActions.checkIn ? 1 : 0, target: 1 },
  ];
  const questProgress = Math.round(
    (quests.reduce((sum, quest) => sum + Math.min(quest.current / quest.target, 1), 0) /
      quests.length) *
      100,
  );
  const achievements = [
    { title: "First Outreach", unlocked: state.sent > 0 },
    { title: "First Call", unlocked: state.calls > 0 },
    { title: "First Close", unlocked: state.closed > 0 },
    { title: "7-day Streak", unlocked: state.bestStreak >= 7 },
  ];

  const heatmap = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, idx) => {
      const offset = -6 + idx;
      const key = dateKeyFromOffset(offset, today);
      const actions = state.dailyActions[key];
      return {
        key,
        offset,
        score: heatScore(actions),
        label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parseDateKey(key) ?? new Date()),
      };
    });
    const max = Math.max(1, ...days.map((d) => d.score));
    return days.map((d) => ({ ...d, intensity: d.score / max }));
  }, [state.dailyActions, today]);

  const streakDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => {
        const offset = -6 + idx;
        const key = dateKeyFromOffset(offset, today);
        const checkedIn = state.dailyActions[key]?.checkIn ?? false;
        const label = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
          parseDateKey(key) ?? new Date(),
        );
        return { key, offset, checkedIn, label };
      }),
    [state.dailyActions, today],
  );

  const currentRankIndex = RANKS.findIndex((tier) => tier.name === rank.name);

  const bumpDailyAction = (actions: Record<string, DailyActions>, key: keyof DailyActions, dateKey = todayKey()) => {
    const current = actions[dateKey] ?? emptyDailyActions();
    return {
      ...actions,
      [dateKey]: {
        ...current,
        [key]: key === "checkIn" ? true : toNumber(current[key]) + 1,
      },
    };
  };

  const logProspectAction = (index: number, type: (typeof QUICK_ACTIONS)[number]["key"]) => {
    const action = QUICK_ACTIONS.find((item) => item.key === type);
    if (!action) return;
    const stampedAt = new Date().toISOString();
    const actionDay = todayKey();
    setCurrentDay(actionDay);
    setState((s) => ({
      ...s,
      xp: s.xp + action.xp,
      sent: action.key === "sent" ? s.sent + 1 : s.sent,
      calls: action.key === "calls" ? s.calls + 1 : s.calls,
      closed: action.key === "closed" ? s.closed + 1 : s.closed,
      dailyActions: bumpDailyAction(s.dailyActions, action.key, actionDay),
      prospects: s.prospects.map((prospect, idx) =>
        idx === index ? { ...prospect, status: action.status, lastContactedAt: stampedAt } : prospect,
      ),
    }));
  };

  const updateProspectStatus = (index: number, status: string) => {
    setState((s) => ({
      ...s,
      prospects: s.prospects.map((prospect, idx) =>
        idx === index ? { ...prospect, status } : prospect,
      ),
    }));
  };

  const dailyCheckIn = () => {
    const checkInDay = todayKey();
    setCurrentDay(checkInDay);
    if (state.lastCheck === checkInDay) return;
    setState((s) => {
      if (s.lastCheck === checkInDay) return s;
      const gap = s.lastCheck ? dayDiff(s.lastCheck, checkInDay) : null;
      const continued = gap === 1;
      const nextStreak = continued ? s.streak + 1 : 1;
      return {
        ...s,
        lastCheck: checkInDay,
        streak: nextStreak,
        bestStreak: Math.max(s.bestStreak, nextStreak),
        xp: s.xp + 5,
        dailyActions: bumpDailyAction(s.dailyActions, "checkIn", checkInDay),
      };
    });
  };

  const addProspect = () => {
    const name = bizName.trim();
    if (!name) return;
    setState((s) => ({
      ...s,
      prospects: [...s.prospects, { name, niche: bizNiche.trim(), status: bizStatus, lastContactedAt: "" }],
    }));
    setBizName("");
    setBizNiche("");
  };

  const removeProspect = (i: number) => {
    setState((s) => ({ ...s, prospects: s.prospects.filter((_, idx) => idx !== i) }));
  };

  const xpBar = (
    <div
      className="xpBar"
      role="progressbar"
      aria-valuenow={levelXP}
      aria-valuemin={0}
      aria-valuemax={XP_PER_LEVEL}
      aria-label={`${levelXP} of ${XP_PER_LEVEL} XP into level ${levelFromXP(state.xp)}`}
    >
      <motion.div
        className="xpBarFill"
        initial={false}
        animate={{ scaleX: levelXP / XP_PER_LEVEL }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </div>
  );
  const streakStrip = (
    <div className="streakStrip" role="list" aria-label="Last 7 days check-in track">
      {streakDays.map((d) => (
        <motion.span
          key={d.key}
          role="listitem"
          className={`streakDot${d.checkedIn ? " lit" : ""}${d.offset === 0 ? " today" : ""}`}
          aria-label={`${d.label}: ${d.checkedIn ? "checked in" : "missed"}`}
          initial={false}
          animate={d.checkedIn && !reduceMotion ? { scale: [1, 1.18, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </div>
  );
  const cards: { title: string; value: ReactNode; sub: string; extra?: ReactNode }[] = [
    {
      title: "Level",
      value: levelFromXP(state.xp),
      sub: `${levelXP} / ${XP_PER_LEVEL} XP to next`,
      extra: xpBar,
    },
    {
      title: "Streak",
      value: `${state.streak}d`,
      sub: state.bestStreak ? `Best ${state.bestStreak}d` : "Check in to build it",
      extra: streakStrip,
    },
    { title: "Outreach Sent", value: state.sent, sub: `${state.sent} / 20 target` },
    { title: "Calls Booked", value: state.calls, sub: `${state.calls} / 3 target` },
  ];
  const checkedInToday = state.lastCheck === today;
  const copyTemplate = async (prospect: Prospect, index: number) => {
    const text = templateFor(prospect);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopiedKey(`${prospect.name}-${index}`);
      window.setTimeout(() => setCopiedKey(""), 1600);
    } catch {
      setCopiedKey(`failed-${index}`);
      window.setTimeout(() => setCopiedKey(""), 1600);
    }
  };

  const fade = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
      };

  const switchTab = (nextTab: "dashboard" | "prospects" | "service" | "alignment") => {
    if (nextTab === activeTab) return;
    const order: Array<"dashboard" | "prospects" | "service" | "alignment"> = [
      "dashboard",
      "prospects",
      "service",
      "alignment",
    ];
    const currentIndex = order.indexOf(activeTab);
    const nextIndex = order.indexOf(nextTab);
    setSlideDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveTab(nextTab);
  };

  return (
    <div className="wrap">
      <header className="hero">
        <div className="hero-row">
          <h1>Arias Outreach Game Dashboard</h1>
          <motion.span
            className="rank-pill"
            style={{ color: rank.color, borderColor: `${rank.color}55`, background: `${rank.color}14` }}
            aria-label={`Rank ${rank.name}, level ${levelFromXP(state.xp)}, ${state.xp} XP`}
            initial={false}
            animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            key={rank.name}
          >
            <span className="rank-dot" style={{ background: rank.color, boxShadow: `0 0 8px ${rank.color}` }} />
            {rank.name} · L{levelFromXP(state.xp)} · {state.xp} XP
          </motion.span>
        </div>
        <p>Goal: contact 20 businesses, book 3 calls, close 1 paid audit.</p>
      </header>

      <section className="grid" aria-label="Key stats">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            className="card stat"
            {...fade}
            transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
          >
            <h2>{c.title}</h2>
            <motion.div
              className="big"
              key={String(c.value)}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {c.value}
            </motion.div>
            <p>{c.sub}</p>
            {c.extra}
          </motion.div>
        ))}
      </section>

      <div className="viewTabs" role="tablist" aria-label="Dashboard views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "dashboard"}
          aria-controls="view-panel-dashboard"
          className={`tabBtn${activeTab === "dashboard" ? " active" : ""}`}
          onClick={() => switchTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "prospects"}
          aria-controls="view-panel-prospects"
          className={`tabBtn${activeTab === "prospects" ? " active" : ""}`}
          onClick={() => switchTab("prospects")}
        >
          Prospect Tracker
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "service"}
          aria-controls="view-panel-service"
          className={`tabBtn${activeTab === "service" ? " active" : ""}`}
          onClick={() => switchTab("service")}
        >
          Call Script
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "alignment"}
          aria-controls="view-panel-alignment"
          className={`tabBtn${activeTab === "alignment" ? " active" : ""}`}
          onClick={() => switchTab("alignment")}
        >
          Alignment
        </button>
      </div>

      <AnimatePresence initial={false} mode="wait" custom={slideDirection}>
        {activeTab === "dashboard" ? (
          <motion.div
            key="dashboard"
            id="view-panel-dashboard"
            role="tabpanel"
            aria-label="Dashboard view"
            className="tabPanel"
            custom={slideDirection}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? -54 : 54 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? 54 : -54 }
            }
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          >
      <motion.section
        className="card mission"
        aria-label="Mission progress"
        {...fade}
        transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
      >
        <div className="mission-head">
          <h2>Mission Progress</h2>
          <span className="mission-pct" aria-live="polite">{pct}%</span>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="fill"
            initial={false}
            animate={{ scaleX: pct / 100 }}
            transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          />
        </div>

        <div className="rankProgress">
          <div className="rankMeta">
            <span className="muted">
              {nextRank ? `${xpToNext} XP to ${nextRank.name}` : "Top tier reached"}
            </span>
            <span className="muted">{rankProgress}%</span>
          </div>
          <div className="bar compact" role="progressbar" aria-valuenow={rankProgress} aria-valuemin={0} aria-valuemax={100}>
            <motion.div
              className="fill rankFill"
              initial={false}
              animate={{ scaleX: rankProgress / 100 }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              style={{ background: `linear-gradient(90deg, ${rank.color}, ${nextRank?.color ?? rank.color})` }}
            />
          </div>
        </div>

        <div className="row">
          <motion.button
            type="button"
            className="secondary"
            onClick={dailyCheckIn}
            disabled={checkedInToday}
            aria-label={checkedInToday ? "Already checked in today" : "Daily check-in for 5 XP"}
            whileTap={reduceMotion || checkedInToday ? undefined : { scale: 0.97 }}
          >
            {checkedInToday ? "Checked in today" : "Daily Check-in (+5 XP)"}
          </motion.button>
        </div>
      </motion.section>

      <motion.section
        className="card rankLadder"
        aria-label="Rank ladder"
        {...fade}
        transition={{ duration: 0.35, delay: 0.28, ease: "easeOut" }}
      >
        <div className="rankLadder-head">
          <h2>Rank Ladder</h2>
          <span className="muted">
            Position {currentRankIndex + 1} of {RANKS.length}
          </span>
        </div>
        <ol className="rankList">
          {RANKS.map((tier, idx) => {
            const isCurrent = tier.name === rank.name;
            const isReached = state.xp >= tier.min;
            const xpFromTier = Math.max(0, state.xp - tier.min);
            return (
              <motion.li
                key={tier.name}
                className={`rankItem${isCurrent ? " current" : ""}${isReached ? " reached" : ""}`}
                style={{ ["--tier-color" as string]: tier.color }}
                whileHover={reduceMotion ? undefined : { y: -1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <span className="rankIndex">{idx + 1}</span>
                <span className="rankSwatch" aria-hidden="true" />
                <span className="rankName">{tier.name}</span>
                <span className="rankReq">{tier.min.toLocaleString()} XP</span>
                {isCurrent ? (
                  <motion.span
                    className="rankBadge"
                    initial={false}
                    animate={
                      reduceMotion ? { opacity: 1 } : { opacity: [0.65, 1, 0.65] }
                    }
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    You · +{xpFromTier} XP
                  </motion.span>
                ) : isReached ? (
                  <span className="rankBadge reached" aria-label="Cleared">
                    Cleared
                  </span>
                ) : (
                  <span className="rankBadge locked" aria-label="Locked">
                    Locked
                  </span>
                )}
              </motion.li>
            );
          })}
        </ol>
      </motion.section>

      <motion.div
        className="panelGrid"
        {...fade}
        transition={{ duration: 0.35, delay: 0.3, ease: "easeOut" }}
      >
        <section className="card" aria-label="Daily quests">
          <h2>Daily Quests</h2>
          <div
            className="bar compact"
            role="progressbar"
            aria-valuenow={questProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${questProgress}% of daily quests complete`}
          >
            <motion.div
              className="fill"
              initial={false}
              animate={{ scaleX: questProgress / 100 }}
              transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            />
          </div>
          <p>{questProgress}% complete today</p>
          <div className="questList">
            {quests.map((quest) => {
              const done = quest.current >= quest.target;
              return (
                <motion.div
                  className={`quest${done ? " done" : ""}`}
                  key={quest.title}
                  layout
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <span>{quest.title}</span>
                  <strong>{Math.min(quest.current, quest.target)}/{quest.target}</strong>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="card" aria-label="Activity and achievements">
          <h2>7-Day Activity</h2>
          <div className="heatmap" role="list">
            {heatmap.map((d) => (
              <motion.div
                key={d.key}
                className={`heatCell${d.offset === 0 ? " today" : ""}`}
                role="listitem"
                aria-label={`${d.label}: ${d.score} activity points`}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 0.35 + d.intensity * 0.65, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                whileHover={reduceMotion ? undefined : { scale: 1.08 }}
              >
                <span className="heatLabel">{d.label[0]}</span>
              </motion.div>
            ))}
          </div>
          <h2 style={{ marginTop: 18 }}>Achievements</h2>
          <div className="badgeGrid">
            {achievements.map((achievement) => (
              <motion.span
                className={`achievement ${achievement.unlocked ? "unlocked" : ""}`}
                key={achievement.title}
                aria-label={`${achievement.title}: ${achievement.unlocked ? "unlocked" : "locked"}`}
                layout
                initial={false}
                animate={achievement.unlocked && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {achievement.title}
              </motion.span>
            ))}
          </div>
        </section>
      </motion.div>
          </motion.div>
        ) : activeTab === "prospects" ? (
          <motion.div
            key="prospects"
            id="view-panel-prospects"
            role="tabpanel"
            aria-label="Prospect tracker view"
            className="tabPanel"
            custom={slideDirection}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? 54 : -54 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? -54 : 54 }
            }
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          >
      <section className="card prospectCard" aria-label="Prospect tracker">
        <div className="section-head">
          <h2>Prospect Tracker</h2>
          <span className="muted">{state.prospects.length} total</span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="Business name"
            aria-label="Business name"
          />
          <input
            value={bizNiche}
            onChange={(e) => setBizNiche(e.target.value)}
            placeholder="Niche"
            aria-label="Niche"
          />
          <select
            value={bizStatus}
            onChange={(e) => setBizStatus(e.target.value)}
            aria-label="Initial status"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button type="button" onClick={addProspect}>Add prospect</button>
        </div>

        <div className="toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, niche, or status"
            aria-label="Search prospects"
          />
          <select
            value={nicheFilter}
            onChange={(e) => setNicheFilter(e.target.value)}
            aria-label="Filter by niche"
          >
            {nicheOptions.map((niche) => (
              <option key={niche}>{niche}</option>
            ))}
          </select>
          <span className="muted" aria-live="polite">{visibleProspects.length} shown</span>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Business</th>
                <th scope="col">Niche</th>
                <th scope="col">Status</th>
                <th scope="col">Last Contact</th>
                <th scope="col">Log</th>
                <th scope="col">Template</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {visibleProspects.map(({ prospect: p, index: i }) => {
                  const age = daysSince(p.lastContactedAt);
                  const actionable = p.status !== "Closed" && p.status !== "Not Contacted";
                  const overdue = actionable && age !== null && age > 3;
                  const copied = copiedKey === `${p.name}-${i}`;
                  const copyFailed = copiedKey === `failed-${i}`;
                  const statusClass = p.status.toLowerCase().replace(/\s+/g, "-");
                  return (
                    <motion.tr
                      key={`${p.name}-${i}`}
                      layout
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className={`row-${statusClass}`}
                    >
                      <td>{p.name}</td>
                      <td>
                        <span className="tag">{p.niche || "None"}</span>
                      </td>
                      <td>
                        <motion.div
                          className="statusCell"
                          key={p.status}
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                          <motion.span
                            className={`statusDot status-${statusClass}`}
                            aria-hidden="true"
                            initial={false}
                            animate={reduceMotion ? { scale: 1 } : { scale: [1, 1.4, 1] }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                            key={`dot-${p.status}`}
                          />
                          <select
                            value={p.status}
                            onChange={(e) => updateProspectStatus(i, e.target.value)}
                            aria-label={`Status for ${p.name}`}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </motion.div>
                      </td>
                      <td>
                        <div className="followUp">
                          <span>{formatDate(p.lastContactedAt)}</span>
                          <span className={`badge ${overdue ? "overdue" : actionable ? "active" : ""}`}>
                            {overdue ? "Overdue" : actionable ? "On track" : "None"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="miniActions">
                          {QUICK_ACTIONS.map((action) => (
                            <motion.button
                              type="button"
                              key={action.key}
                              className="tiny"
                              onClick={() => logProspectAction(i, action.key)}
                              aria-label={`Log ${action.label} for ${p.name}`}
                              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                            >
                              {action.label}
                            </motion.button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => copyTemplate(p, i)}
                          aria-label={`Copy outreach template for ${p.name}`}
                        >
                          Copy
                        </button>
                        <AnimatePresence>
                          {copied && (
                            <motion.span
                              className="copyStatus"
                              role="status"
                              aria-live="polite"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                            >
                              Copied
                            </motion.span>
                          )}
                          {copyFailed && (
                            <motion.span
                              className="copyStatus failed"
                              role="status"
                              aria-live="polite"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                            >
                              Copy failed
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => removeProspect(i)}
                          aria-label={`Remove ${p.name}`}
                        >
                          Remove
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </section>
          </motion.div>
        ) : activeTab === "service" ? (
          <motion.div
            key="service"
            id="view-panel-service"
            role="tabpanel"
            aria-label="Service call script view"
            className="tabPanel"
            custom={slideDirection}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? 54 : -54 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? -54 : 54 }
            }
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <section className="card" aria-label="Service overview and call flow">
              <div className="section-head">
                <h2>Service Offer + Call Script</h2>
                <span className="muted">Quick reference during live calls</span>
              </div>

              <div className="scriptGrid">
                <article className="scriptBlock">
                  <h3>What We Do (Simple Offer)</h3>
                  <ul>
                    <li>Website + Google profile audit focused on booking/call leaks.</li>
                    <li>Clarity fixes: services, proof, offer, contact flow, trust signals.</li>
                    <li>Fast implementation option after audit if they want help shipping.</li>
                  </ul>
                </article>

                <article className="scriptBlock">
                  <h3>Call Flow (5–8 min)</h3>
                  <ol>
                    <li>Intro + context: “I noticed a few conversion opportunities.”</li>
                    <li>Ask 2 discovery questions: current lead flow + biggest bottleneck.</li>
                    <li>Share 3 specific observations from their online presence.</li>
                    <li>Present outcome: more calls/bookings with practical fixes.</li>
                    <li>Close: offer audit delivery + next-step booking.</li>
                  </ol>
                </article>

                <article className="scriptBlock">
                  <h3>Prompt Script (Use/Adapt)</h3>
                  <p>
                    “Hey <strong>[Business Name]</strong>, I took a quick look at your website and Google profile.
                    I found a few small fixes that could help convert more search traffic into calls/bookings.
                    If you want, I can walk you through the top 3 now and send you the audit after this call.”
                  </p>
                </article>

                <article className="scriptBlock">
                  <h3>Objection Handles</h3>
                  <ul>
                    <li><strong>“No budget”</strong> → Start with low-lift fixes they can do themselves first.</li>
                    <li><strong>“Need to think”</strong> → Offer a concise written audit + 10-min follow-up slot.</li>
                    <li><strong>“We already have a site”</strong> → Focus on conversion gaps, not redesign.</li>
                  </ul>
                </article>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="alignment"
            id="view-panel-alignment"
            role="tabpanel"
            aria-label="Belief and alignment view"
            className="tabPanel"
            custom={slideDirection}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? 54 : -54 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: slideDirection > 0 ? -54 : 54 }
            }
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <section className="card" aria-label="Sales alignment and confidence brief">
              <div className="section-head">
                <h2>Belief Deck: Why This Works</h2>
                <span className="muted">Use before outreach to lock your energy in</span>
              </div>

              <div className="alignmentGrid">
                <article className="alignmentBlock">
                  <h3>What We’re Really Selling</h3>
                  <ul>
                    <li>We are not selling a website. We are selling clearer customer decisions.</li>
                    <li>We are not pushing features. We are reducing booking friction.</li>
                    <li>We are not begging for work. We are offering practical growth leverage.</li>
                  </ul>
                </article>

                <article className="alignmentBlock">
                  <h3>Problem Reality (Their Side)</h3>
                  <ul>
                    <li>Most local businesses lose leads through unclear offers and weak trust signals.</li>
                    <li>They are busy, so gaps stay unfixed even when they know they exist.</li>
                    <li>A clear outside audit saves them time and reveals hidden revenue leaks.</li>
                  </ul>
                </article>

                <article className="alignmentBlock">
                  <h3>Our Promise</h3>
                  <ul>
                    <li>Fast, specific, no-fluff audit focused on calls/bookings.</li>
                    <li>Actionable fixes they can execute immediately.</li>
                    <li>Optional implementation support only if they want help shipping.</li>
                  </ul>
                </article>

                <article className="alignmentBlock">
                  <h3>Pre-Call Confidence Script</h3>
                  <p>
                    “I’m here to create value first. I only need one yes at a time. The right client will feel relief,
                    not pressure, when they hear this offer.”
                  </p>
                </article>

                <article className="alignmentBlock full">
                  <h3>5-Step Alignment Reset (60 seconds)</h3>
                  <ol>
                    <li><strong>Breathe:</strong> 4 seconds in, 4 seconds out, three rounds.</li>
                    <li><strong>Intent:</strong> “I serve. I do not chase.”</li>
                    <li><strong>Truth:</strong> Name one concrete result your audit can produce.</li>
                    <li><strong>Focus:</strong> Pick the next single outreach action only.</li>
                    <li><strong>Move:</strong> Send one message immediately before doubt returns.</li>
                  </ol>
                </article>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
