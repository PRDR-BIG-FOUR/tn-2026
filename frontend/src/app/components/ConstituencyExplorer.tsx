import React, { useState, useMemo, useCallback, useRef } from "react";
import sirData from "../../../../data/tn_sir_constituency_stats_2026.json";
import pollData2026Raw from "../../../../data/eci_polling_trends_2026.json";
import { results2021ByAcNo, PARTY_COLORS_2021 } from "../elections2021";
import { results2016ByAcNo } from "../elections2016";
import { rolls2025ByAcNo } from "../rolls2025";
import { allPoints } from "../manifestoData";
import {
  kmlConstituencies, voterFill, growthFill, scaleForMode, gradientCss, SIR_IMPACT_RAMP,
  POLLS_2026_RAMP, pollTurnoutFill,
  MAP_WIDTH, MAP_HEIGHT, type VoterMapMode,
} from "../tnMap";

const sans = '"Inter Tight", sans-serif';
const serif = '"Source Serif 4", serif';
const mono = '"IBM Plex Mono", monospace';
const dark = "#121212";
const gray = "#6b6b6b";
const border = "#d9d7d2";
const brown = "#a16749";

interface ConstituencyStats {
  ac_no: number;
  constituency: string;
  district: string;
  men: number;
  women: number;
  others: number;
  total: number;
}

const allAC: ConstituencyStats[] = Object.values((sirData as any).districts)
  .flatMap((d: any) => d.constituencies as ConstituencyStats[])
  .sort((a, b) => a.ac_no - b.ac_no);

const stateTotal2026 = (sirData as any).statewide_totals.total as number;
const statsByNo = new Map<number, ConstituencyStats>();
for (const c of allAC) statsByNo.set(c.ac_no, c);

// ── 2026 Polling Trends (VTR) ──────────────────────────────────────────────
interface Poll2026Row {
  ac_no: number;
  constituency: string;
  district: string;
  eci_display_name: string;
  vtr_pct: number;
}
const pollData2026 = pollData2026Raw as unknown as {
  poll_date: string;
  statewide_vtr_pct: number;
  constituencies: Poll2026Row[];
};
const polls2026ByNo = new Map<number, Poll2026Row>();
for (const r of pollData2026.constituencies) polls2026ByNo.set(r.ac_no, r);
const STATE_VTR_2026 = pollData2026.statewide_vtr_pct;
const POLL_DATE_2026 = pollData2026.poll_date;
const VTR_VALUES = pollData2026.constituencies.map(c => c.vtr_pct);
const VTR_MIN = Math.min(...VTR_VALUES);
const VTR_MAX = Math.max(...VTR_VALUES);
const VTR_RANKED = [...pollData2026.constituencies].sort((a, b) => b.vtr_pct - a.vtr_pct);

function fmt(n: number) { return n.toLocaleString("en-IN"); }

// ── Sub-components ─────────────────────────────────────────────────────────

function Headline({ text }: { text: string }) {
  return (
    <div style={{
      fontFamily: serif, fontSize: 17, fontWeight: 500, color: dark,
      lineHeight: 1.5,
    }}>{text}</div>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: mono, fontSize: 10, letterSpacing: "0.14em",
        textTransform: "uppercase", color: brown, marginBottom: 4,
      }}>{eyebrow}</div>
      <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: dark, lineHeight: 1.2 }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontFamily: serif, fontSize: 13, color: gray, lineHeight: 1.5, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${border}`, borderRadius: 6,
      padding: "10px 12px",
    }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: color ?? dark }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type PartyKey = "admk" | "dmk" | "tvk";

const PARTY_FILTER_META: Array<{ k: PartyKey; label: string; color: string }> = [
  { k: "admk", label: "AIADMK", color: "#547c5b" },
  { k: "dmk",  label: "DMK",    color: "#c94d48" },
  { k: "tvk",  label: "TVK",    color: "#E5A000" },
];

export function ConstituencyExplorer() {
  const [acNo, setAcNo] = useState<number>(1);
  const [mode, setMode] = useState<VoterMapMode>("polls2026");
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [partyFilter, setPartyFilter] = useState<Record<PartyKey, boolean>>({
    admk: true, dmk: true, tvk: true,
  });
  const mapRef = useRef<HTMLDivElement>(null);

  const ac = useMemo(() => statsByNo.get(acNo) ?? allAC[0], [acNo]);
  const r21 = results2021ByAcNo.get(ac.ac_no);
  const r16 = results2016ByAcNo.get(ac.ac_no);
  const r25 = rolls2025ByAcNo.get(ac.ac_no);

  // Precompute per-AC derived values used by the map fill.
  // "Growth" now compares the SIR 2026 roll against the Jan-2025 roll (post-SIR deletions),
  // not against the 2021 rolls — this surfaces the poll-number reduction.
  //
  // For total/men/women we map each AC to its QUANTILE RANK (0..1) rather than val/maxVal.
  // Rank-based coloring is far more contrastive because the 234 ACs are spread evenly across
  // the full palette instead of being squished into the lower end by a few outlier big-city seats.
  const derivedByNo = useMemo(() => {
    const rows = allAC.map(c => {
      const past25 = rolls2025ByAcNo.get(c.ac_no);
      const past21 = results2021ByAcNo.get(c.ac_no);
      const past16 = results2016ByAcNo.get(c.ac_no);
      const growth = past25 && past25.total
        ? ((c.total - past25.total) / past25.total) * 100
        : 0;
      const valByMode: Record<VoterMapMode, number> = {
        total: c.total, men: c.men, women: c.women,
        growth, winner2021: 0, winner2016: 0,
      };
      return {
        no: c.ac_no,
        val: valByMode[mode],
        growthPct: growth,
        winner: past21?.partyShort ?? null,
        winner16: past16?.partyShort ?? null,
      };
    });

    const rankByNo = new Map<number, number>();
    if (mode === "total" || mode === "men" || mode === "women") {
      const sorted = [...rows].sort((a, b) => a.val - b.val);
      const denom = Math.max(1, sorted.length - 1);
      sorted.forEach((r, i) => rankByNo.set(r.no, i / denom));
    } else if (mode === "growth") {
      // Rank only the ACs that shrank (deletions). Most-negative Δ → t=1 (darkest),
      // smallest deletion → t≈0. Positive / flat Δ → t=0 (Light Coral).
      // This spreads the full palette across the real deletion range so the
      // worst-hit AC is always visually distinct, with no 10% cap pile-up.
      const negatives = rows.filter(r => r.growthPct < 0).sort((a, b) => a.growthPct - b.growthPct);
      const denom = Math.max(1, negatives.length - 1);
      negatives.forEach((r, i) => rankByNo.set(r.no, 1 - i / denom));
      for (const r of rows) if (r.growthPct >= 0) rankByNo.set(r.no, 0);
    }

    const m = new Map<number, { t: number; val: number; growthPct: number; winner: string | null; winner16: string | null }>();
    for (const r of rows) {
      m.set(r.no, { t: rankByNo.get(r.no) ?? 0, val: r.val, growthPct: r.growthPct, winner: r.winner, winner16: r.winner16 });
    }
    return m;
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  // Electorate comparison is now 2025 roll → 2026 SIR roll (post-SIR deletion delta).
  const electorDelta = r25 ? ac.total - r25.total : null;
  const electorDeltaPct = r25 && r25.total
    ? ((ac.total - r25.total) / r25.total) * 100
    : null;
  const womenPct = (ac.women / ac.total) * 100;

  // Relevant manifesto promises — filtered by both the current AC and
  // the party-filter pills under the map.
  const relevantPromises = useMemo(() => {
    const d = ac.district.toLowerCase();
    const c = ac.constituency.toLowerCase();
    return allPoints.filter(p =>
      partyFilter[p.party as PartyKey] &&
      (p.tags.some(t => t.toLowerCase().includes(d) || t.toLowerCase().includes(c)) ||
       p.text.toLowerCase().includes(c) ||
       p.sector.some(s => s.toLowerCase().includes(d)))
    ).slice(0, 24);
  }, [ac, partyFilter]);

  // Plain-English story headline.
  const storyHeadline = (() => {
    if (!r21) return `${ac.constituency} has ${fmt(ac.total)} voters in 2026.`;
    const winner = r21.partyShort;
    const grew = electorDelta ?? 0;
    const womenLead = ac.women > ac.men;
    const growBit = grew > 0
      ? `${fmt(Math.abs(grew))} more voters than the 2025 roll`
      : grew < 0 ? `${fmt(Math.abs(grew))} fewer voters than the 2025 roll`
      : `roughly the same voter count as the 2025 roll`;
    const womenBit = womenLead ? "Women outnumber men on the rolls." : "Men outnumber women on the rolls.";
    return `${ac.constituency} went to ${winner} in 2021. It has ${growBit}. ${womenBit}`;
  })();

  const hoveredStats = hovered !== null ? statsByNo.get(hovered) : null;
  const hoveredR21 = hovered !== null ? results2021ByAcNo.get(hovered) : null;
  const hoveredR16 = hovered !== null ? results2016ByAcNo.get(hovered) : null;
  const hoveredR25 = hovered !== null ? rolls2025ByAcNo.get(hovered) : null;

  // Top row: elections (2026 | 2021 | 2016).  Clicking one of these sets
  // `mode` to that election's *default* map.  For 2026 the default is the
  // voter-turnout map; a second row of chips then lets the reader switch to
  // other 2026 lenses (Total / Men / Women / S.I.R. impact).  2021 and 2016
  // have no sub-chips — their map is a single winner-by-party view.
  type Election = 2026 | 2021 | 2016;
  const activeElection: Election =
    mode === "winner2021" ? 2021
    : mode === "winner2016" ? 2016
    : 2026;

  // Year dropdown — selecting a year sets the map to that year's default.
  const yearOptions: Array<{ year: Election; label: string; defaultMode: VoterMapMode }> = [
    { year: 2026, label: "2026 Elections", defaultMode: "polls2026"  },
    { year: 2021, label: "2021 Elections", defaultMode: "winner2021" },
    { year: 2016, label: "2016 Elections", defaultMode: "winner2016" },
  ];

  // Chips only appear under the dropdown when Year = 2026 (the only year
  // with more than one view).  2021 and 2016 go straight to the winner map.
  const election2026Chips: Array<{ k: VoterMapMode; label: string }> = [
    { k: "polls2026", label: "Voter Turnout" },
    { k: "total",     label: "Total"         },
    { k: "men",       label: "Men"           },
    { k: "women",     label: "Women"         },
    { k: "growth",    label: "S.I.R. impact" },
  ];

  return (
    <section style={{ padding: "32px 0 40px", fontFamily: sans }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.2 }}>
          Poll Maps
        </h2>
        <p style={{ fontFamily: serif, fontSize: 15, color: "#2e2e2e", lineHeight: "26px", marginTop: 6, maxWidth: 760 }}>
          234 constituencies · 3 elections · 5 lenses. Switch between
          {" "}<strong>2026</strong> turnout, S.I.R. impact and demographics, or
          the <strong>2021</strong> / <strong>2016</strong> winners. Click any
          seat to zoom in.
        </p>
      </div>

      {/* Mode toggle — Year dropdown + view chips in a single row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <select
          value={activeElection}
          onChange={(e) => {
            const picked = Number(e.target.value) as Election;
            const next = yearOptions.find(o => o.year === picked);
            if (next) setMode(next.defaultMode);
          }}
          style={{
            fontFamily: sans, fontSize: 13, fontWeight: 500,
            padding: "7px 22px 7px 20px", borderRadius: 6,
            border: `1px solid ${border}`,
            background: "#fff", color: dark, cursor: "pointer",
          }}
        >
          {yearOptions.map(o => (
            <option key={o.year} value={o.year}>{o.label}</option>
          ))}
        </select>

        {activeElection === 2026 && (
          <div
            aria-hidden
            style={{
              width: 1,
              alignSelf: "stretch",
              background: border,
              margin: "0 4px",
            }}
          />
        )}

        {activeElection === 2026 && election2026Chips.map(opt => {
          const active = mode === opt.k;
          return (
            <button key={opt.k} onClick={() => setMode(opt.k)} style={{
              padding: "7px 14px", borderRadius: 6, cursor: "pointer",
              background: active ? dark : "#fff",
              color: active ? "#fff" : dark,
              border: `1px solid ${active ? dark : border}`,
              fontFamily: sans, fontSize: 13, fontWeight: active ? 700 : 500,
              whiteSpace: "nowrap",
            }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Layout: map + story */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Left: Map */}
        <div
          ref={mapRef}
          onMouseMove={handleMouseMove}
          style={{ position: "relative", flex: "0 0 auto", maxWidth: "100%" }}
        >
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            style={{
              border: `1px solid ${border}`, borderRadius: 8,
              background: "#faf9f6", display: "block",
              maxWidth: "100%", height: "auto",
              overflow: "visible",
            }}
          >
            {(() => {
              // Render the selected (clicked) AC last so the zoomed-in shape
              // draws above its neighbours and isn't clipped.
              const ordered = [...kmlConstituencies].sort((a, b) => {
                const rank = (n: number) => (n === acNo ? 1 : 0);
                return rank(a.no) - rank(b.no);
              });
              return ordered.map(c => {
                const d = derivedByNo.get(c.no);
                const stats = statsByNo.get(c.no);
                let fill = "#ede9e3";
                if (d && stats) {
                  if (mode === "growth") fill = growthFill(d.t);
                  else if (mode === "winner2021") fill = d.winner ? (PARTY_COLORS_2021[d.winner] ?? "#999") : "#ede9e3";
                  else if (mode === "winner2016") fill = d.winner16 ? (PARTY_COLORS_2021[d.winner16] ?? "#999") : "#ede9e3";
                  else if (mode === "polls2026") {
                    const poll = polls2026ByNo.get(c.no);
                    fill = poll ? pollTurnoutFill(poll.vtr_pct, STATE_VTR_2026, VTR_MIN, VTR_MAX) : "#ede9e3";
                  }
                  else fill = voterFill(d.t, mode);
                }
                const isSel = acNo === c.no;
                const isHov = hovered === c.no;
                return (
                  <g
                    key={c.no}
                    style={{
                      transformOrigin: `${c.cx}px ${c.cy}px`,
                      transformBox: "view-box" as React.CSSProperties["transformBox"],
                      transform: isSel ? "scale(2.2)" : "scale(1)",
                      transition: "transform 0.28s cubic-bezier(.2,.7,.3,1), filter 0.28s ease",
                      filter: isSel
                        ? "drop-shadow(0 8px 18px rgba(0,0,0,0.35))"
                        : "none",
                      willChange: isSel ? "transform" : "auto",
                    }}
                  >
                    <path
                      d={c.path}
                      fill={fill}
                      fillRule="evenodd"
                      stroke={isSel ? dark : isHov ? "#444" : "#bbb"}
                      strokeWidth={isSel ? 0.8 : isHov ? 1.2 : 0.4}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: "pointer", transition: "stroke 0.1s, stroke-width 0.1s" }}
                      onMouseEnter={() => setHovered(c.no)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setAcNo(c.no)}
                    />
                  </g>
                );
              });
            })()}
          </svg>

          {/* Hover tooltip */}
          {hoveredStats && hovered !== null && (
            <div style={{
              position: "absolute",
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 10,
              background: "rgba(18,18,18,0.93)",
              color: "#fff",
              borderRadius: 8,
              padding: "10px 14px",
              pointerEvents: "none",
              zIndex: 10,
              minWidth: 200,
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
            }}>
              <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 13 }}>
                {hoveredStats.constituency}
                <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.55)", fontSize: 10, marginLeft: 6 }}>AC #{hoveredStats.ac_no}</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{hoveredStats.district}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: "#fff" }}>
                {fmt(hoveredStats.total)} voters (2026)
              </div>
              {hoveredR25 && (() => {
                const g = ((hoveredStats.total - hoveredR25.total) / hoveredR25.total) * 100;
                return (
                  <div style={{ fontFamily: mono, fontSize: 10, color: g >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                    {g >= 0 ? "+" : ""}{g.toFixed(1)}% vs 2025 roll
                  </div>
                );
              })()}
              {hoveredR21 && (
                <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.75)" }}>
                  2021: {hoveredR21.partyShort} won by {hoveredR21.marginPct.toFixed(1)}%
                </div>
              )}
              {hoveredR16 && (
                <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>
                  2016: {hoveredR16.partyShort} won by {hoveredR16.marginPct.toFixed(1)}%
                </div>
              )}
              {(() => {
                const poll = polls2026ByNo.get(hoveredStats.ac_no);
                if (!poll) return null;
                const delta = poll.vtr_pct - STATE_VTR_2026;
                return (
                  <div style={{
                    fontFamily: mono, fontSize: 10,
                    color: delta >= 0 ? "#6ee7b7" : "#fca5a5",
                    marginTop: 4, paddingTop: 4,
                    borderTop: "1px solid rgba(255,255,255,0.15)",
                  }}>
                    2026 VTR: {poll.vtr_pct.toFixed(2)}%
                    <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: 4 }}>
                      ({delta >= 0 ? "+" : ""}{delta.toFixed(2)} pp vs state)
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 10 }}>
            {mode === "winner2021" || mode === "winner2016" ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {mode === "winner2016" ? "2016 winner" : "2021 winner"}
                </span>
                {Object.entries(PARTY_COLORS_2021).map(([p, col]) => (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
                    <span style={{ fontFamily: mono, fontSize: 10, color: dark }}>{p}</span>
                  </span>
                ))}
              </div>
            ) : mode === "polls2026" ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: mono, fontSize: 9, color: "#C54448" }}>{VTR_MIN.toFixed(1)}%</span>
                  <div style={{
                    height: 8, flex: 1, borderRadius: 4, position: "relative",
                    background: gradientCss(POLLS_2026_RAMP),
                  }}>
                    <div style={{
                      position: "absolute",
                      left: `${((STATE_VTR_2026 - VTR_MIN) / (VTR_MAX - VTR_MIN)) * 100}%`,
                      top: -4, bottom: -4, width: 2, background: dark,
                      transform: "translateX(-50%)", borderRadius: 1,
                    }} />
                  </div>
                  <span style={{ fontFamily: mono, fontSize: 9, color: "#3E8460" }}>{VTR_MAX.toFixed(1)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontFamily: mono, fontSize: 8, color: gray }}>
                  <span>well below</span>
                  <span style={{ color: dark }}>│ state avg {STATE_VTR_2026.toFixed(2)}%</span>
                  <span>well above</span>
                </div>
              </div>
            ) : mode === "growth" ? (() => {
              // Show the actual deletion range spanned by the ramp (rank-based).
              let minDel = 0;
              for (const [, d] of derivedByNo) if (d.growthPct < minDel) minDel = d.growthPct;
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: "#F08080" }}>Least</span>
                    <div style={{
                      height: 8, flex: 1, borderRadius: 4,
                      background: gradientCss(SIR_IMPACT_RAMP),
                    }} />
                    <span style={{ fontFamily: mono, fontSize: 9, color: "#A92542" }}>Heaviest</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontFamily: mono, fontSize: 8, color: gray }}>
                    <span>≥0% Δ</span>
                    <span>25th</span>
                    <span>50th</span>
                    <span>75th</span>
                    <span>worst ({minDel.toFixed(1)}%)</span>
                  </div>
                </div>
              );
            })() : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>Fewest</span>
                  <div style={{
                    height: 8, flex: 1, borderRadius: 4,
                    background: gradientCss(scaleForMode(mode)),
                  }} />
                  <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>Most</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontFamily: mono, fontSize: 8, color: gray }}>
                  <span>0th</span><span>25th</span><span>50th</span><span>75th</span><span>100th %ile</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Story */}
        <div style={{ flex: "1 1 460px", minWidth: 320 }}>

          {/* Title strip */}
          <div style={{
            display: "flex", alignItems: "flex-end", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap",
            borderBottom: `2px solid ${dark}`, paddingBottom: 10, marginBottom: 18,
          }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 10, color: dark, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Assembly Constituency #{ac.ac_no} · District: {ac.district}
              </div>
              <div style={{ fontFamily: serif, fontSize: 38, fontWeight: 400, color: dark, lineHeight: 1.1, marginTop: 2 }}>
                {ac.constituency}
              </div>
            </div>
          </div>

          {/* Plain-English headline — sits above every mode EXCEPT Voter
              Turnout, where the 2026 section leads and this is pushed below. */}
          {mode !== "polls2026" && (
            <div style={{
              background: "#faf9f6", borderLeft: `3px solid ${brown}`,
              padding: "12px 16px", borderRadius: 4, marginBottom: 24,
            }}>
              <Headline text={storyHeadline} />
            </div>
          )}

          {/* THEN vs NOW — only when S.I.R. impact mode is active */}
          {mode === "growth" && (<>
          <SectionTitle
            eyebrow="Then vs Now"
            title="Before S.I.R. vs After S.I.R."
            sub="How the roll changed between the 06-Jan-2025 electoral roll and the Special Intensive Revision's final 2026 roll — i.e. the poll-number reduction."
          />
          {r25 ? (
            <div style={{
              background: "#fff", border: `1px solid ${border}`, borderRadius: 8,
              padding: "16px 18px", marginBottom: 28,
            }}>
              {/* Dual-bar compare */}
              {(() => {
                const maxSide = Math.max(ac.total, r25.total);
                const p25 = (r25.total / maxSide) * 100;
                const p26 = (ac.total / maxSide) * 100;
                const growth = electorDeltaPct ?? 0;
                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, color: gray, marginBottom: 4 }}>
                        <span>2025 roll (06-Jan-2025)</span>
                        <span style={{ color: dark, fontWeight: 700 }}>{fmt(r25.total)}</span>
                      </div>
                      <div style={{ height: 16, background: "#ede9e3", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ width: `${p25}%`, height: "100%", background: gray, borderRadius: 8 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, color: gray, marginBottom: 4 }}>
                        <span>2026 roll (S.I.R., 23-Feb-2026)</span>
                        <span style={{ color: dark, fontWeight: 700 }}>
                          {fmt(ac.total)}
                          {growth < 0 && (
                            <span style={{ color: "#DD3639", fontWeight: 700, marginLeft: 6 }}>
                              −{fmt(Math.abs(electorDelta!))}
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: 16, background: "#ede9e3", borderRadius: 8, overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${p26}%`, height: "100%", background: gray }} />
                        {growth < 0 && (
                          <div style={{ width: `${Math.max(0, p25 - p26)}%`, height: "100%", background: "#DD3639" }} />
                        )}
                      </div>
                    </div>
                    <Headline
                      text={
                        growth > 2
                          ? `The roll grew by ${growth.toFixed(1)}% — ${fmt(Math.abs(electorDelta!))} more names on the 2026 roll than the 2025 roll. A rare expansion through S.I.R.`
                          : growth < -2
                          ? `The roll shrank by ${Math.abs(growth).toFixed(1)}% — ${fmt(Math.abs(electorDelta!))} fewer voters after S.I.R. deletions from the 2025 roll.`
                          : `The roll is nearly unchanged vs the 2025 roll (${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%). S.I.R. left this AC largely untouched.`
                      }
                    />
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{ background: "#faf9f6", padding: "14px 16px", borderRadius: 6, marginBottom: 28, fontFamily: mono, fontSize: 12, color: gray }}>
              2025 roll not available for this constituency.
            </div>
          )}
          </>)}

          {/* 2026 breakdown — only when Total / Men / Women mode is active */}
          {(mode === "total" || mode === "men" || mode === "women") && (<>
          <SectionTitle
            eyebrow="Who lives here now"
            title="2026 voter breakdown"
            sub="From the Special Intensive Revision final roll, 23 Feb 2026."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            <Stat label="Total voters" value={fmt(ac.total)} sub={`${((ac.total/stateTotal2026)*100).toFixed(2)}% of TN`} />
            <Stat label="Men" value={fmt(ac.men)} sub={`${((ac.men/ac.total)*100).toFixed(1)}%`} color="#7DB3E8" />
            <Stat label="Women" value={fmt(ac.women)} sub={`${womenPct.toFixed(1)}%`} color="#E87D9B" />
            <Stat
              label="vs 2025 roll"
              value={electorDelta === null ? "—" : `${electorDelta >= 0 ? "+" : ""}${fmt(electorDelta)}`}
              sub={electorDeltaPct === null ? "" : `${electorDeltaPct >= 0 ? "+" : ""}${electorDeltaPct.toFixed(1)}% after S.I.R.`}
              color={electorDelta === null ? gray : electorDelta >= 0 ? "#047857" : "#DD3639"}
            />
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 28 }}>
            <div style={{ background: "#7DB3E8", width: `${(ac.men/ac.total)*100}%` }} title={`Men ${fmt(ac.men)}`} />
            <div style={{ background: "#E87D9B", flex: 1 }} title={`Women ${fmt(ac.women)}`} />
          </div>
          </>)}

          {/* 2021 Result — only when 2021 Winner mode is active */}
          {mode === "winner2021" && r21 && (
            <>
              <SectionTitle
                eyebrow="Last time around"
                title="How this seat voted in 2021"
                sub="Winner, margin and turnout from the Election Commission's AC-level result sheet."
              />
              <div style={{
                background: "#faf9f6", borderLeft: `3px solid ${brown}`,
                padding: "12px 16px", borderRadius: 4, marginBottom: 14,
              }}>
                <Headline
                  text={`${r21.winner} (${r21.partyShort}) won by ${r21.marginPct.toFixed(1)}%. Turnout was ${r21.pollPct.toFixed(1)}%.`}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                <Stat label="Winner" value={r21.partyShort} sub={r21.winner} color={PARTY_COLORS_2021[r21.partyShort] ?? dark} />
                <Stat label="Margin" value={`${r21.marginPct.toFixed(1)}%`} sub={`${fmt(r21.margin)} votes`} />
                <Stat label="Turnout 2021" value={`${r21.pollPct.toFixed(1)}%`} sub={`${fmt(r21.totalVotes)} cast`} />
              </div>

              {/* Margin ribbon */}
              <div style={{
                background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
                padding: "14px 16px", marginBottom: 28,
              }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Margin of victory
                </div>
                <div style={{ position: "relative", height: 24, background: "#ede9e3", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${Math.min(r21.marginPct, 50) * 2}%`,
                    background: PARTY_COLORS_2021[r21.partyShort] ?? brown,
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                    paddingRight: 10,
                  }}>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#fff" }}>
                      {r21.marginPct.toFixed(1)}%
                    </span>
                  </div>
                  {[5, 10, 20].map(m => (
                    <div key={m} style={{
                      position: "absolute", left: `${m * 2}%`, top: 0, bottom: 0,
                      width: 1, background: "rgba(0,0,0,0.2)",
                    }} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: mono, fontSize: 9, color: gray }}>
                  <span>0%</span>
                  <span>5%</span>
                  <span>10%</span>
                  <span>20% →</span>
                </div>
              </div>

              {/* 2016 → 2021 comparison card */}
              {r16 && (
                <div style={{
                  background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
                  padding: "14px 16px", marginBottom: 28,
                }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    2016 → 2021 flip check
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 2 }}>2016</div>
                      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: PARTY_COLORS_2021[r16.partyShort] ?? dark }}>
                        {r16.partyShort} · {r16.marginPct.toFixed(1)}%
                      </div>
                      <div style={{ fontFamily: serif, fontSize: 12, color: "#444" }}>{r16.winner}</div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 16, color: gray }}>→</div>
                    <div style={{ minWidth: 140 }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 2 }}>2021</div>
                      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: PARTY_COLORS_2021[r21.partyShort] ?? dark }}>
                        {r21.partyShort} · {r21.marginPct.toFixed(1)}%
                      </div>
                      <div style={{ fontFamily: serif, fontSize: 12, color: "#444" }}>{r21.winner}</div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <span style={{
                        display: "inline-block", padding: "4px 10px", borderRadius: 20,
                        fontFamily: sans, fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        background: r16.partyShort === r21.partyShort ? "#ede9e3" : "#DD363918",
                        color: r16.partyShort === r21.partyShort ? gray : "#DD3639",
                        border: `1.5px solid ${r16.partyShort === r21.partyShort ? border : "#DD3639"}`,
                      }}>
                        {r16.partyShort === r21.partyShort ? "Held" : "Flipped"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 2026 Elections — only when 2026 Elections mode is active */}
          {mode === "polls2026" && (() => {
            const poll = polls2026ByNo.get(ac.ac_no);
            if (!poll) {
              return (
                <div style={{
                  background: "#faf9f6", padding: "14px 16px",
                  borderRadius: 6, marginBottom: 28, fontFamily: mono,
                  fontSize: 12, color: gray,
                }}>
                  2026 polling trend not available for this constituency.
                </div>
              );
            }
            const rank = VTR_RANKED.findIndex(r => r.ac_no === poll.ac_no) + 1;
            const deltaState = poll.vtr_pct - STATE_VTR_2026;
            const delta2021 = r21 ? poll.vtr_pct - r21.pollPct : null;
            const col = pollTurnoutFill(poll.vtr_pct, STATE_VTR_2026, VTR_MIN, VTR_MAX);
            return (
              <>
                <SectionTitle
                  eyebrow="The latest vote"
                  title="How this seat voted in 2026"
                  sub={`Approximate polling trends (VTR) published by ECI on poll day (${POLL_DATE_2026}). Values are provisional and may be revised as postal ballots are tallied.`}
                />

                {/* Plain-English lead */}
                <div style={{
                  background: "#faf9f6", borderLeft: `3px solid ${brown}`,
                  padding: "12px 16px", borderRadius: 4, marginBottom: 14,
                }}>
                  <Headline
                    text={
                      `${ac.constituency} polled ${poll.vtr_pct.toFixed(2)}% — ` +
                      (Math.abs(deltaState) < 0.25
                        ? `right at the statewide ${STATE_VTR_2026.toFixed(2)}% average`
                        : deltaState > 0
                          ? `${deltaState.toFixed(2)} points above the statewide ${STATE_VTR_2026.toFixed(2)}% average`
                          : `${Math.abs(deltaState).toFixed(2)} points below the statewide ${STATE_VTR_2026.toFixed(2)}% average`) +
                      (delta2021 !== null && Math.abs(delta2021) >= 0.5
                        ? delta2021 > 0
                          ? `, up ${delta2021.toFixed(2)} points from ${r21!.pollPct.toFixed(2)}% in 2021`
                          : `, down ${Math.abs(delta2021).toFixed(2)} points from ${r21!.pollPct.toFixed(2)}% in 2021`
                        : "") + "."
                    }
                  />
                </div>

                {/* Stat grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                  <Stat
                    label="2026 VTR"
                    value={`${poll.vtr_pct.toFixed(2)}%`}
                    sub={`rank #${rank} of 234`}
                    color={col}
                  />
                  <Stat
                    label="vs 2021"
                    value={delta2021 === null ? "—" : `${delta2021 >= 0 ? "+" : ""}${delta2021.toFixed(2)} pp`}
                    sub={r21 ? `2021 · ${r21.pollPct.toFixed(2)}%` : "no 2021 data"}
                    color={delta2021 === null ? gray : delta2021 >= 0 ? "#047857" : "#DD3639"}
                  />
                  <Stat
                    label="S.I.R. impact"
                    value={
                      electorDelta === null
                        ? "—"
                        : `${electorDelta >= 0 ? "+" : ""}${fmt(electorDelta)}`
                    }
                    sub={
                      electorDeltaPct === null
                        ? "no 2025 roll"
                        : `${electorDeltaPct >= 0 ? "+" : ""}${electorDeltaPct.toFixed(1)}% vs 2025 roll`
                    }
                    color={
                      electorDelta === null
                        ? gray
                        : electorDelta >= 0
                        ? "#047857"
                        : "#DD3639"
                    }
                  />
                </div>

                {/* VTR ribbon — where this AC sits in the statewide range */}
                <div style={{
                  background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
                  padding: "14px 16px", marginBottom: 28,
                }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Turnout vs statewide range
                  </div>
                  <div style={{
                    position: "relative", height: 10, borderRadius: 5, overflow: "visible",
                    background: gradientCss(POLLS_2026_RAMP),
                  }}>
                    {/* state avg marker */}
                    <div style={{
                      position: "absolute",
                      left: `${((STATE_VTR_2026 - VTR_MIN) / (VTR_MAX - VTR_MIN)) * 100}%`,
                      top: -2, bottom: -2, width: 1,
                      background: "rgba(18,18,18,0.45)", transform: "translateX(-50%)",
                    }} />
                    {/* This AC marker */}
                    <div style={{
                      position: "absolute",
                      left: `${((poll.vtr_pct - VTR_MIN) / (VTR_MAX - VTR_MIN)) * 100}%`,
                      top: -6, bottom: -6, width: 4,
                      background: dark, borderRadius: 2,
                      transform: "translateX(-50%)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: mono, fontSize: 9, color: gray }}>
                    <span>{VTR_MIN.toFixed(1)}%</span>
                    <span>│ state avg {STATE_VTR_2026.toFixed(2)}%</span>
                    <span>{VTR_MAX.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Top / Bottom shortcuts */}
                <div style={{
                  background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
                  padding: "14px 16px", marginBottom: 28,
                }}>
                  <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Statewide extremes
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: "#3E8460", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                        Highest turnout
                      </div>
                      {VTR_RANKED.slice(0, 3).map(r => (
                        <button
                          key={r.ac_no}
                          onClick={() => setAcNo(r.ac_no)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            width: "100%", padding: "3px 6px", borderRadius: 4,
                            background: "transparent", border: "none", cursor: "pointer",
                            textAlign: "left", fontFamily: sans, fontSize: 11,
                          }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#3E846014")}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                        >
                          <span style={{ color: dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{r.constituency}</span>
                          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#3E8460" }}>{r.vtr_pct.toFixed(1)}%</span>
                        </button>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 9, color: "#C54448", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                        Lowest turnout
                      </div>
                      {[...VTR_RANKED].slice(-3).reverse().map(r => (
                        <button
                          key={r.ac_no}
                          onClick={() => setAcNo(r.ac_no)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            width: "100%", padding: "3px 6px", borderRadius: 4,
                            background: "transparent", border: "none", cursor: "pointer",
                            textAlign: "left", fontFamily: sans, fontSize: 11,
                          }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#C5444814")}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                        >
                          <span style={{ color: dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{r.constituency}</span>
                          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#C54448" }}>{r.vtr_pct.toFixed(1)}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generic story headline pushed down here in Voter Turnout */}
                <div style={{
                  background: "#faf9f6", borderLeft: `3px solid ${brown}`,
                  padding: "12px 16px", borderRadius: 4, marginBottom: 24,
                }}>
                  <Headline text={storyHeadline} />
                </div>
              </>
            );
          })()}

          {/* 2016 Result — only when 2016 Winner mode is active */}
          {mode === "winner2016" && (
            <>
              <SectionTitle
                eyebrow="Further back"
                title="How this seat voted in 2016"
                sub="From the Election Commission's AC-wise candidate count for the 2016 Tamil Nadu Assembly election."
              />
              {r16 ? (
                <>
                  <div style={{
                    background: "#faf9f6", borderLeft: `3px solid ${brown}`,
                    padding: "12px 16px", borderRadius: 4, marginBottom: 14,
                  }}>
                    <Headline
                      text={`${r16.winner} (${r16.partyShort}) won by ${r16.marginPct.toFixed(1)}% — ${fmt(r16.margin)} votes out of ${fmt(r16.totalVotes)} cast.`}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                    <Stat label="Winner" value={r16.partyShort} sub={r16.winner} color={PARTY_COLORS_2021[r16.partyShort] ?? dark} />
                    <Stat label="Margin" value={`${r16.marginPct.toFixed(1)}%`} sub={`${fmt(r16.margin)} votes`} />
                    <Stat label="Total votes 2016" value={fmt(r16.totalVotes)} sub="valid votes polled" />
                  </div>

                  {/* 2016 Margin ribbon */}
                  <div style={{
                    background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
                    padding: "14px 16px", marginBottom: 14,
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Margin of victory (2016)
                    </div>
                    <div style={{ position: "relative", height: 24, background: "#ede9e3", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0,
                        width: `${Math.min(r16.marginPct, 50) * 2}%`,
                        background: PARTY_COLORS_2021[r16.partyShort] ?? brown,
                        borderRadius: 12,
                        display: "flex", alignItems: "center", justifyContent: "flex-end",
                        paddingRight: 10,
                      }}>
                        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#fff" }}>
                          {r16.marginPct.toFixed(1)}%
                        </span>
                      </div>
                      {[5, 10, 20].map(m => (
                        <div key={m} style={{
                          position: "absolute", left: `${m * 2}%`, top: 0, bottom: 0,
                          width: 1, background: "rgba(0,0,0,0.2)",
                        }} />
                      ))}
                    </div>
                  </div>

                  {/* Side-by-side 2016 vs 2021 */}
                  {r21 && (
                    <div style={{
                      background: "#faf9f6", border: `1px solid ${border}`, borderRadius: 8,
                      padding: "14px 16px", marginBottom: 28,
                    }}>
                      <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        2016 → 2021 flip check
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 140 }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 2 }}>2016</div>
                          <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: PARTY_COLORS_2021[r16.partyShort] ?? dark }}>
                            {r16.partyShort} · {r16.marginPct.toFixed(1)}%
                          </div>
                          <div style={{ fontFamily: serif, fontSize: 12, color: "#444" }}>{r16.winner}</div>
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 16, color: gray }}>→</div>
                        <div style={{ minWidth: 140 }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 2 }}>2021</div>
                          <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: PARTY_COLORS_2021[r21.partyShort] ?? dark }}>
                            {r21.partyShort} · {r21.marginPct.toFixed(1)}%
                          </div>
                          <div style={{ fontFamily: serif, fontSize: 12, color: "#444" }}>{r21.winner}</div>
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <span style={{
                            display: "inline-block", padding: "4px 10px", borderRadius: 20,
                            fontFamily: sans, fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.08em", textTransform: "uppercase",
                            background: r16.partyShort === r21.partyShort ? "#ede9e3" : "#DD363918",
                            color: r16.partyShort === r21.partyShort ? gray : "#DD3639",
                            border: `1.5px solid ${r16.partyShort === r21.partyShort ? border : "#DD3639"}`,
                          }}>
                            {r16.partyShort === r21.partyShort ? "Held" : "Flipped"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ background: "#faf9f6", padding: "14px 16px", borderRadius: 6, marginBottom: 28, fontFamily: mono, fontSize: 12, color: gray }}>
                  2016 result not available — this AC ({ac.constituency}, #{ac.ac_no}) had a postponed poll in 2016.
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Manifesto promises (full-width, below map + story) ─────────── */}
      <div style={{ marginTop: 40 }}>
        <SectionTitle
          eyebrow="What was promised"
          title={`Promises mentioning ${ac.constituency} or ${ac.district}`}
          sub={relevantPromises.length === 0
            ? "No party manifesto point explicitly references this constituency or its district for the selected parties."
            : `${relevantPromises.length} manifesto point${relevantPromises.length === 1 ? "" : "s"} matched on name or district.`}
        />

        {/* Party filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 4 }}>
            Filter by party
          </span>
          {PARTY_FILTER_META.map(p => {
            const active = partyFilter[p.k];
            return (
              <button
                key={p.k}
                onClick={() => setPartyFilter(prev => ({ ...prev, [p.k]: !prev[p.k] }))}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: `1.5px solid ${active ? p.color : border}`,
                  background: active ? p.color + "18" : "#faf9f6",
                  color: active ? p.color : gray,
                  fontFamily: sans, fontSize: 11, fontWeight: active ? 700 : 500,
                  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {relevantPromises.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}>
            {relevantPromises.map((p, i) => (
              <div key={i} style={{
                padding: "12px 14px", background: "#fff",
                borderLeft: `3px solid ${p.partyColor}`,
                border: `1px solid ${border}`, borderLeftWidth: 3,
                borderRadius: 4,
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{
                    fontFamily: sans, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: p.partyColor,
                  }}>{p.partyLabel}</span>
                  {p.sectionTitle && (
                    <span style={{ fontFamily: mono, fontSize: 10, color: gray }}>§ {p.sectionTitle}</span>
                  )}
                </div>
                {p.title && (
                  <div style={{ fontFamily: serif, fontSize: 14, fontWeight: 500, color: dark, marginBottom: 3 }}>
                    {p.title}
                  </div>
                )}
                <div style={{ fontFamily: serif, fontSize: 13, color: "#444", lineHeight: 1.55 }}>
                  {p.text.length > 240 ? p.text.slice(0, 240) + "…" : p.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: "#faf9f6", padding: "14px 16px", borderRadius: 6,
            fontFamily: mono, fontSize: 12, color: gray,
          }}>
            No matching promises for the selected parties.
          </div>
        )}
      </div>
    </section>
  );
}
