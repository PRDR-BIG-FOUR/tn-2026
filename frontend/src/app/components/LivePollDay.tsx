import React from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, CartesianGrid,
} from "recharts";
import { state2021 } from "../elections2021";

const sans = '"Inter Tight", sans-serif';
const serif = '"Source Serif 4", serif';
const mono = '"IBM Plex Mono", monospace';
const dark = "#121212";
const gray = "#6b6b6b";
const border = "#d9d7d2";
const brown = "#a16749";

// ── Dummy hourly turnout curves ────────────────────────────────────────────
// 2021 TN turnout was ~72.8%. Shape: slow start, pickup mid-morning,
// afternoon lull, late surge.

const HOURS = ["7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm"];

// Cumulative % of total eligible voters cast so far, per hour.
const baseline2021 = [2.1, 8.4, 16.2, 25.8, 34.5, 41.8, 47.2, 52.6, 57.9, 63.8, 69.4, 72.8];

// Dummy live 2026 curve — slightly ahead of 2021. Only first 7 hours "reported".
const live2026Full = [2.6, 9.8, 18.1, 28.0, 37.1, 44.9, 51.5, 0, 0, 0, 0, 0];
const hoursReported = 7;

const hourlyData = HOURS.map((h, i) => ({
  hour: h,
  "2021 baseline": baseline2021[i],
  "2026 live": i < hoursReported ? live2026Full[i] : null,
  projected: i >= hoursReported - 1 ? baseline2021[i] + (live2026Full[hoursReported - 1] - baseline2021[hoursReported - 1]) : null,
}));

// Dummy district-level snapshot at current hour.
const districtSnapshot = [
  { district: "Chennai",      "2021": 47.8, "2026": 52.4, delta: +4.6 },
  { district: "Coimbatore",   "2021": 53.2, "2026": 54.1, delta: +0.9 },
  { district: "Madurai",      "2021": 51.1, "2026": 49.7, delta: -1.4 },
  { district: "Tiruchirapalli", "2021": 50.4, "2026": 53.8, delta: +3.4 },
  { district: "Salem",        "2021": 54.0, "2026": 56.2, delta: +2.2 },
  { district: "Tirunelveli",  "2021": 49.6, "2026": 51.0, delta: +1.4 },
  { district: "Erode",        "2021": 52.7, "2026": 54.3, delta: +1.6 },
  { district: "Vellore",      "2021": 48.3, "2026": 50.1, delta: +1.8 },
];

// ── Component ──────────────────────────────────────────────────────────────

export function LivePollDay() {
  const currentHour = hoursReported - 1; // 0-indexed
  const currentLive = live2026Full[currentHour];
  const current2021 = baseline2021[currentHour];
  const delta = currentLive - current2021;
  const projectedFinal = 72.8 + delta; // naive projection

  return (
    <section style={{ padding: "32px 0 40px", fontFamily: sans }}>

      {/* Status strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
        fontFamily: mono, fontSize: 11, color: gray,
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#dc2626", boxShadow: "0 0 0 3px rgba(220,38,38,0.18)",
            animation: "pulse 2s infinite",
          }} />
          <span style={{ color: "#dc2626", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Live</span>
        </span>
        <span>Poll day · {HOURS[currentHour]} · dummy data — live pipeline pending</span>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.2 }}>
          Tamil Nadu is voting.
        </h2>
        <p style={{ fontFamily: serif, fontSize: 16, color: "#2e2e2e", lineHeight: "28px", marginTop: 8, maxWidth: 760 }}>
          Hour-by-hour turnout against the 2021 baseline. Watch which districts are voting faster or slower than last time —
          it's the earliest signal of who is motivated to show up.
        </p>
      </div>

      {/* Headline stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        marginBottom: 28,
      }}>
        {[
          { label: "Turnout so far", value: `${currentLive.toFixed(1)}%`, sub: `by ${HOURS[currentHour]}`, color: dark },
          { label: "vs 2021 at same hour", value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts`, sub: delta >= 0 ? "ahead of last time" : "behind last time", color: delta >= 0 ? "#047857" : "#dc2626" },
          { label: "Projected final", value: `${projectedFinal.toFixed(1)}%`, sub: `2021 finished at ${state2021.turnoutPct.toFixed(1)}%`, color: brown },
          { label: "Hours left", value: `${HOURS.length - hoursReported}`, sub: "polls close at 6pm", color: gray },
        ].map(s => (
          <div key={s.label} style={{
            background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
            padding: "14px 16px",
          }}>
            <div style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginTop: 2 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Hourly curve */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          background: "#faf9f6", borderLeft: `3px solid ${brown}`,
          padding: "12px 16px", borderRadius: 4, marginBottom: 16,
        }}>
          <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 500, color: dark, lineHeight: 1.5 }}>
            {delta >= 0
              ? `By ${HOURS[currentHour]}, ${currentLive.toFixed(1)}% of Tamil Nadu has already voted — ${delta.toFixed(1)} points ahead of where 2021 was at the same hour.`
              : `By ${HOURS[currentHour]}, only ${currentLive.toFixed(1)}% have voted — ${Math.abs(delta).toFixed(1)} points behind 2021's pace at the same hour.`}
          </div>
        </div>

        <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: dark, margin: "0 0 6px" }}>
          Turnout hour by hour
        </h3>
        <p style={{ fontFamily: serif, fontSize: 14, color: "#2e2e2e", lineHeight: "24px", margin: "0 0 16px" }}>
          Cumulative % of eligible voters who've cast a ballot. Dotted line is 2021 at the same hour — the benchmark to beat.
        </p>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={border} strokeDasharray="2 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontFamily: sans, fontSize: 12, fill: gray }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: mono, fontSize: 11, fill: gray }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 80]} />
              <Tooltip
                contentStyle={{ fontFamily: sans, fontSize: 12, border: `1px solid ${border}`, borderRadius: 4 }}
                formatter={(v: any) => v === null ? "—" : `${v}%`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: sans, fontSize: 12 }} />
              <ReferenceLine x={HOURS[currentHour]} stroke="#dc2626" strokeDasharray="3 3" label={{ value: "now", position: "top", fontFamily: mono, fontSize: 10, fill: "#dc2626" }} />
              <Line type="monotone" dataKey="2021 baseline" stroke={gray} strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="2026 live" stroke={brown} strokeWidth={3} dot={{ r: 4, fill: brown }} connectNulls={false} />
              <Line type="monotone" dataKey="projected" stroke={brown} strokeWidth={2} strokeDasharray="2 4" dot={false} name="projected path" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* District snapshot */}
      <div>
        <div style={{
          background: "#faf9f6", borderLeft: `3px solid ${brown}`,
          padding: "12px 16px", borderRadius: 4, marginBottom: 16,
        }}>
          <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 500, color: dark, lineHeight: 1.5 }}>
            Chennai is voting {Math.abs(districtSnapshot[0].delta).toFixed(1)} points faster than 2021 — the biggest early surge of any major district.
          </div>
        </div>

        <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: dark, margin: "0 0 6px" }}>
          Which districts are voting faster?
        </h3>
        <p style={{ fontFamily: serif, fontSize: 14, color: "#2e2e2e", lineHeight: "24px", margin: "0 0 16px" }}>
          Turnout at {HOURS[currentHour]} today, compared to the same hour in 2021. Positive = faster pace; negative = slower.
        </p>
        <div style={{
          border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden",
        }}>
          {districtSnapshot.map((d, i) => (
            <div key={d.district} style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr 90px",
              alignItems: "center", gap: 14,
              padding: "10px 16px",
              borderBottom: i < districtSnapshot.length - 1 ? `1px solid ${border}` : "none",
              background: i % 2 === 0 ? "#fff" : "#faf9f6",
            }}>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: dark }}>
                {d.district}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Split bar: 2021 on left (gray), 2026 on right (brown) */}
                <div style={{ position: "relative", flex: 1, height: 22, background: "#ede9e3", borderRadius: 11, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${d["2026"]}%`,
                    background: d.delta >= 0 ? "#047857" : "#dc2626",
                    opacity: 0.85,
                  }} />
                  <div style={{
                    position: "absolute", left: `${d["2021"]}%`, top: -2, bottom: -2,
                    width: 2, background: dark,
                  }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 11, color: dark, width: 48 }}>
                  {d["2026"].toFixed(1)}%
                </span>
              </div>
              <div style={{
                fontFamily: mono, fontSize: 12, fontWeight: 700,
                color: d.delta >= 0 ? "#047857" : "#dc2626", textAlign: "right",
              }}>
                {d.delta >= 0 ? "+" : ""}{d.delta.toFixed(1)} pts
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginTop: 10, fontStyle: "italic" }}>
          Black tick on each bar marks 2021's turnout at this same hour. Bars in green are running ahead; red are behind.
        </div>
      </div>
    </section>
  );
}
