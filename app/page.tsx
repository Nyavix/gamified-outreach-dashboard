"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";

type Prospect = { name: string; niche: string; status: string };
type State = {
  xp: number;
  sent: number;
  calls: number;
  closed: number;
  streak: number;
  lastCheck: string;
  prospects: Prospect[];
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
].map(([name, niche]) => ({ name, niche, status: "Not Contacted" }));

const STATUS_OPTIONS = ["Not Contacted", "Messaged", "Replied", "Call Booked", "Closed"];

const defaultState = (): State => ({
  xp: 0,
  sent: 0,
  calls: 0,
  closed: 0,
  streak: 0,
  lastCheck: "",
  prospects: SEEDED,
});

const levelFromXP = (xp: number) => Math.floor(xp / 100) + 1;

export default function Page() {
  const [state, setState] = useState<State>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizNiche, setBizNiche] = useState("");
  const [bizStatus, setBizStatus] = useState(STATUS_OPTIONS[0]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...defaultState(), ...JSON.parse(raw) });
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

  const log = (type: "outreach" | "call" | "close") => {
    setState((s) => {
      if (type === "outreach") return { ...s, sent: s.sent + 1, xp: s.xp + 10 };
      if (type === "call") return { ...s, calls: s.calls + 1, xp: s.xp + 35 };
      return { ...s, closed: 1, xp: s.xp + 100 };
    });
  };

  const dailyCheckIn = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastCheck === today) {
      alert("Already checked in today ✅");
      return;
    }
    setState((s) => ({ ...s, lastCheck: today, streak: s.streak + 1, xp: s.xp + 5 }));
  };

  const addProspect = () => {
    const name = bizName.trim();
    if (!name) return;
    setState((s) => ({
      ...s,
      prospects: [...s.prospects, { name, niche: bizNiche.trim(), status: bizStatus }],
    }));
    setBizName("");
    setBizNiche("");
  };

  const removeProspect = (i: number) => {
    setState((s) => ({ ...s, prospects: s.prospects.filter((_, idx) => idx !== i) }));
  };

  const cards = [
    { title: "Level", value: levelFromXP(state.xp), sub: `${state.xp} XP` },
    { title: "Streak", value: `${state.streak} days`, sub: "Daily check-in keeps momentum" },
    { title: "Outreach Sent", value: state.sent, sub: "/ 20 target" },
    { title: "Calls Booked", value: state.calls, sub: "/ 3 target" },
  ];

  return (
    <div className="wrap">
      <h1>🚀 Arias Outreach Game Dashboard</h1>
      <p>Goal: contact 20 businesses, book 3 calls, close 1 paid audit.</p>

      <div className="grid">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            className="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
          >
            <h2>{c.title}</h2>
            <div className="big">{c.value}</div>
            <p>{c.sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="card"
        style={{ marginTop: 12 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25, ease: "easeOut" }}
      >
        <h2>Mission Progress</h2>
        <div className="bar">
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <p>{pct}% complete</p>
        <div className="row">
          <button onClick={() => log("outreach")}>+ Outreach Sent (+10 XP)</button>
          <button className="secondary" onClick={() => log("call")}>+ Call Booked (+35 XP)</button>
          <button className="secondary" onClick={() => log("close")}>+ Deal Closed (+100 XP)</button>
          <button className="secondary" onClick={dailyCheckIn}>✅ Daily Check-in (+5 XP)</button>
        </div>
      </motion.div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>Prospect Tracker</h2>
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="Business name"
          />
          <input
            value={bizNiche}
            onChange={(e) => setBizNiche(e.target.value)}
            placeholder="Niche"
          />
          <select value={bizStatus} onChange={(e) => setBizStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button onClick={addProspect}>Add</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>Niche</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {state.prospects.map((p, i) => (
              <tr key={`${p.name}-${i}`}>
                <td>{p.name}</td>
                <td>
                  <span className="tag">{p.niche || "—"}</span>
                </td>
                <td>{p.status}</td>
                <td>
                  <button className="secondary" onClick={() => removeProspect(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
