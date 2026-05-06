"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

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
  lastCheck: string;
  prospects: Prospect[];
  dailyActions: Record<string, DailyActions>;
};

const STORAGE_KEY = "arias_outreach_game_v1";

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

const defaultState = (): State => ({
  xp: 0,
  sent: 0,
  calls: 0,
  closed: 0,
  streak: 0,
  lastCheck: "",
  prospects: SEEDED,
  dailyActions: {},
});

const levelFromXP = (xp: number) => Math.floor(xp / 100) + 1;
const todayKey = () => new Date().toISOString().slice(0, 10);
const emptyDailyActions = (): DailyActions => ({ sent: 0, calls: 0, closed: 0, checkIn: false });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const toNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const normalizeProspect = (value: unknown): Prospect | null => {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  return {
    name: value.name,
    niche: typeof value.niche === "string" ? value.niche : "",
    status: typeof value.status === "string" ? value.status : "Not Contacted",
    lastContactedAt: typeof value.lastContactedAt === "string" ? value.lastContactedAt : "",
  };
};
const normalizeDailyActions = (value: unknown): Record<string, DailyActions> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([date, actions]) => {
      if (!isRecord(actions)) return [date, emptyDailyActions()];
      return [
        date,
        {
          sent: toNumber(actions.sent),
          calls: toNumber(actions.calls),
          closed: toNumber(actions.closed),
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
    : fallback.prospects;

  return {
    xp: toNumber(value.xp, fallback.xp),
    sent: toNumber(value.sent, fallback.sent),
    calls: toNumber(value.calls, fallback.calls),
    closed: toNumber(value.closed, fallback.closed),
    streak: toNumber(value.streak, fallback.streak),
    lastCheck: typeof value.lastCheck === "string" ? value.lastCheck : fallback.lastCheck,
    prospects: prospects.length ? prospects : fallback.prospects,
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
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
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

export default function Page() {
  const [state, setState] = useState<State>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizNiche, setBizNiche] = useState("");
  const [bizStatus, setBizStatus] = useState(STATUS_OPTIONS[0]);
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState("All");
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(normalizeState(JSON.parse(raw)));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const pct = useMemo(() => {
    const outreach = Math.min(state.sent / 20, 1) * 60;
    const calls = Math.min(state.calls / 3, 1) * 30;
    const close = Math.min(state.closed / 1, 1) * 10;
    return Math.round(outreach + calls + close);
  }, [state.sent, state.calls, state.closed]);

  const today = todayKey();
  const todayActions = state.dailyActions[today] ?? emptyDailyActions();
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
    { title: "7-day Streak", unlocked: state.streak >= 7 },
  ];

  const bumpDailyAction = (actions: Record<string, DailyActions>, key: keyof DailyActions) => {
    const current = actions[today] ?? emptyDailyActions();
    return {
      ...actions,
      [today]: {
        ...current,
        [key]: key === "checkIn" ? true : toNumber(current[key]) + 1,
      },
    };
  };

  const logProspectAction = (index: number, type: (typeof QUICK_ACTIONS)[number]["key"]) => {
    const action = QUICK_ACTIONS.find((item) => item.key === type);
    if (!action) return;
    const stampedAt = new Date().toISOString();
    setState((s) => ({
      ...s,
      xp: s.xp + action.xp,
      sent: action.key === "sent" ? s.sent + 1 : s.sent,
      calls: action.key === "calls" ? s.calls + 1 : s.calls,
      closed: action.key === "closed" ? s.closed + 1 : s.closed,
      dailyActions: bumpDailyAction(s.dailyActions, action.key),
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
    if (state.lastCheck === today) {
      alert("Already checked in today.");
      return;
    }
    setState((s) => ({
      ...s,
      lastCheck: today,
      streak: s.streak + 1,
      xp: s.xp + 5,
      dailyActions: bumpDailyAction(s.dailyActions, "checkIn"),
    }));
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

  const cards = [
    { title: "Level", value: levelFromXP(state.xp), sub: `${state.xp} XP` },
    { title: "Streak", value: `${state.streak}d`, sub: "Daily check-in keeps momentum" },
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

  return (
    <div className="wrap">
      <header className="hero">
        <div className="hero-row">
          <h1>Arias Outreach Game Dashboard</h1>
          <span className="level-pill" aria-label={`Level ${levelFromXP(state.xp)}, ${state.xp} XP`}>
            Level {levelFromXP(state.xp)} · {state.xp} XP
          </span>
        </div>
        <p>Goal: contact 20 businesses, book 3 calls, close 1 paid audit.</p>
      </header>

      <section className="grid" aria-label="Key stats">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            className="card stat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
          >
            <h2>{c.title}</h2>
            <div className="big">{c.value}</div>
            <p>{c.sub}</p>
          </motion.div>
        ))}
      </section>

      <motion.section
        className="card mission"
        aria-label="Mission progress"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
      >
        <div className="mission-head">
          <h2>Mission Progress</h2>
          <span className="mission-pct" aria-live="polite">{pct}%</span>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="row">
          <button
            type="button"
            className="secondary"
            onClick={dailyCheckIn}
            disabled={checkedInToday}
            aria-label={checkedInToday ? "Already checked in today" : "Daily check-in for 5 XP"}
          >
            {checkedInToday ? "Checked in today" : "Daily Check-in (+5 XP)"}
          </button>
        </div>
      </motion.section>

      <motion.div
        className="panelGrid"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
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
            <div className="fill" style={{ width: `${questProgress}%` }} />
          </div>
          <p>{questProgress}% complete today</p>
          <div className="questList">
            {quests.map((quest) => {
              const done = quest.current >= quest.target;
              return (
                <div className={`quest${done ? " done" : ""}`} key={quest.title}>
                  <span>{quest.title}</span>
                  <strong>{Math.min(quest.current, quest.target)}/{quest.target}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card" aria-label="Achievements">
          <h2>Achievements</h2>
          <div className="badgeGrid">
            {achievements.map((achievement) => (
              <span
                className={`achievement ${achievement.unlocked ? "unlocked" : ""}`}
                key={achievement.title}
                aria-label={`${achievement.title}: ${achievement.unlocked ? "unlocked" : "locked"}`}
              >
                {achievement.title}
              </span>
            ))}
          </div>
        </section>
      </motion.div>

      <section className="card prospectCard" aria-label="Prospect tracker" style={{ marginTop: 14 }}>
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
              {visibleProspects.map(({ prospect: p, index: i }) => {
                const age = daysSince(p.lastContactedAt);
                const actionable = p.status !== "Closed" && p.status !== "Not Contacted";
                const overdue = actionable && age !== null && age > 3;
                const copied = copiedKey === `${p.name}-${i}`;
                const copyFailed = copiedKey === `failed-${i}`;
                return (
                  <tr key={`${p.name}-${i}`}>
                    <td>{p.name}</td>
                    <td>
                      <span className="tag">{p.niche || "None"}</span>
                    </td>
                    <td>
                      <select
                        value={p.status}
                        onChange={(e) => updateProspectStatus(i, e.target.value)}
                        aria-label={`Status for ${p.name}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
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
                          <button
                            type="button"
                            key={action.key}
                            className="tiny"
                            onClick={() => logProspectAction(i, action.key)}
                            aria-label={`Log ${action.label} for ${p.name}`}
                          >
                            {action.label}
                          </button>
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
                      {copied && (
                        <span className="copyStatus" role="status" aria-live="polite">Copied</span>
                      )}
                      {copyFailed && (
                        <span className="copyStatus failed" role="status" aria-live="polite">
                          Copy failed
                        </span>
                      )}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
