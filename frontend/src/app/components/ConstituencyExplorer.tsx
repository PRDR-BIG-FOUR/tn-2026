import React, { useState, useMemo, useCallback, useRef } from "react";
import sirData from "../../../../data/tn_sir_constituency_stats_2026.json";
import { results2021ByAcNo, competitiveness, PARTY_COLORS_2021 } from "../elections2021";
import { allPoints } from "../manifestoData";
import {
  kmlConstituencies, voterFill, growthFill,
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

export function ConstituencyExplorer() {
  const [acNo, setAcNo] = useState<number>(1);
  const [mode, setMode] = useState<VoterMapMode>("total");
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const ac = useMemo(() => statsByNo.get(acNo) ?? allAC[0], [acNo]);
  const r21 = results2021ByAcNo.get(ac.ac_no);

  // Precompute per-AC derived values used by the map fill.
  const derivedByNo = useMemo(() => {
    const m = new Map<number, { val: number; growthPct: number; winner: string | null }>();
    for (const c of allAC) {
      const past = results2021ByAcNo.get(c.ac_no);
      const growth = past && past.totalElectors
        ? ((c.total - past.totalElectors) / past.totalElectors) * 100
        : 0;
      const valByMode: Record<VoterMapMode, number> = {
        total: c.total, men: c.men, women: c.women,
        growth, winner2021: 0,
      };
      m.set(c.ac_no, { val: valByMode[mode], growthPct: growth, winner: past?.partyShort ?? null });
    }
    return m;
  }, [mode]);

  const maxVal = useMemo(() => {
    if (mode === "growth" || mode === "winner2021") return 0;
    let m = 0;
    for (const c of allAC) {
      const v = mode === "men" ? c.men : mode === "women" ? c.women : c.total;
      if (v > m) m = v;
    }
    return m;
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  // Derived voter comparison numbers.
  const electorDelta = r21 ? ac.total - r21.totalElectors : null;
  const electorDeltaPct = r21 && r21.totalElectors
    ? ((ac.total - r21.totalElectors) / r21.totalElectors) * 100
    : null;
  const compet = r21 ? competitiveness(r21.marginPct) : null;
  const womenPct = (ac.women / ac.total) * 100;

  // Relevant manifesto promises.
  const relevantPromises = useMemo(() => {
    const d = ac.district.toLowerCase();
    const c = ac.constituency.toLowerCase();
    return allPoints.filter(p =>
      p.tags.some(t => t.toLowerCase().includes(d) || t.toLowerCase().includes(c)) ||
      p.text.toLowerCase().includes(c) ||
      p.sector.some(s => s.toLowerCase().includes(d))
    ).slice(0, 12);
  }, [ac]);

  // Plain-English story headline.
  const storyHeadline = (() => {
    if (!r21) return `${ac.constituency} has ${fmt(ac.total)} voters in 2026.`;
    const winner = r21.partyShort;
    const grew = electorDelta ?? 0;
    const womenLead = ac.women > ac.men;
    const growBit = grew > 0
      ? `${fmt(Math.abs(grew))} more voters than 2021`
      : grew < 0 ? `${fmt(Math.abs(grew))} fewer voters than 2021`
      : `roughly the same voter count as 2021`;
    const compBit = compet!.label === "Flip-risk" ? "a knife-edge seat" :
                    compet!.label === "Swing" ? "a genuine swing seat" :
                    compet!.label === "Lean" ? `a ${winner}-leaning seat` :
                    `a ${winner} stronghold`;
    const womenBit = womenLead ? "Women outnumber men on the rolls." : "Men outnumber women on the rolls.";
    return `${ac.constituency} went to ${winner} in 2021 and is ${compBit}. It has ${growBit}. ${womenBit}`;
  })();

  const hoveredStats = hovered !== null ? statsByNo.get(hovered) : null;
  const hoveredR21 = hovered !== null ? results2021ByAcNo.get(hovered) : null;

  const modeOptions: Array<{ k: VoterMapMode; label: string; col: string }> = [
    { k: "total",      label: "Total",        col: brown },
    { k: "men",        label: "Men",          col: "#7DB3E8" },
    { k: "women",      label: "Women",        col: "#E87D9B" },
    { k: "growth",     label: "Growth vs '21", col: "#047857" },
    { k: "winner2021", label: "2021 Winner",   col: dark },
  ];

  return (
    <section style={{ padding: "32px 0 40px", fontFamily: sans }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.2 }}>
          Constituency Explorer
        </h2>
        <p style={{ fontFamily: serif, fontSize: 15, color: "#2e2e2e", lineHeight: "26px", marginTop: 6, maxWidth: 760 }}>
          Click any of Tamil Nadu's 234 constituencies on the map. See who lives there now,
          how they voted in 2021, how the electorate has grown or shrunk since, and what parties are promising.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 4 }}>
          Color map by
        </span>
        {modeOptions.map(opt => {
          const active = mode === opt.k;
          return (
            <button key={opt.k} onClick={() => setMode(opt.k)} style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1.5px solid ${active ? opt.col : border}`,
              background: active ? opt.col + "18" : "#faf9f6",
              color: active ? opt.col : gray,
              fontFamily: sans, fontSize: 11, fontWeight: active ? 700 : 500,
              letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
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
            }}
          >
            {kmlConstituencies.map(c => {
              const d = derivedByNo.get(c.no);
              const stats = statsByNo.get(c.no);
              let fill = "#ede9e3";
              if (d && stats) {
                if (mode === "growth") fill = growthFill(d.growthPct);
                else if (mode === "winner2021") fill = d.winner ? (PARTY_COLORS_2021[d.winner] ?? "#999") : "#ede9e3";
                else fill = voterFill(d.val, maxVal, mode);
              }
              const isSel = acNo === c.no;
              const isHov = hovered === c.no;
              return (
                <path
                  key={c.no}
                  d={c.path}
                  fill={fill}
                  fillRule="evenodd"
                  stroke={isSel ? dark : isHov ? "#444" : "#bbb"}
                  strokeWidth={isSel ? 1.8 : isHov ? 1.2 : 0.4}
                  style={{ cursor: "pointer", transition: "stroke 0.1s" }}
                  onMouseEnter={() => setHovered(c.no)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setAcNo(c.no)}
                />
              );
            })}
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
              {hoveredR21 && (
                <>
                  <div style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.75)" }}>
                    2021: {hoveredR21.partyShort} won by {hoveredR21.marginPct.toFixed(1)}%
                  </div>
                  {(() => {
                    const g = ((hoveredStats.total - hoveredR21.totalElectors) / hoveredR21.totalElectors) * 100;
                    return (
                      <div style={{ fontFamily: mono, fontSize: 10, color: g >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                        {g >= 0 ? "+" : ""}{g.toFixed(1)}% voters vs 2021
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 10 }}>
            {mode === "winner2021" ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: gray, textTransform: "uppercase", letterSpacing: "0.08em" }}>2021 winner</span>
                {Object.entries(PARTY_COLORS_2021).map(([p, col]) => (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
                    <span style={{ fontFamily: mono, fontSize: 10, color: dark }}>{p}</span>
                  </span>
                ))}
              </div>
            ) : mode === "growth" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: "#dc2626" }}>Shrinking</span>
                <div style={{
                  height: 6, flex: 1, borderRadius: 3,
                  background: "linear-gradient(to right, #dc2626, #f5f0e6, #047857)",
                }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: "#047857" }}>Growing</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>Fewer</span>
                <div style={{
                  height: 6, flex: 1, borderRadius: 3,
                  background: mode === "men"
                    ? "linear-gradient(to right, #E0EEFF, #7DB3E8)"
                    : mode === "women"
                    ? "linear-gradient(to right, #FFE4EC, #E87D9B)"
                    : "linear-gradient(to right, #F4ECE8, #A16749)",
                }} />
                <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>More</span>
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
              <div style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                AC #{ac.ac_no} · {ac.district}
              </div>
              <div style={{ fontFamily: serif, fontSize: 38, fontWeight: 400, color: dark, lineHeight: 1.1, marginTop: 2 }}>
                {ac.constituency}
              </div>
            </div>
            {compet && (
              <span style={{
                display: "inline-block", padding: "6px 12px", borderRadius: 20,
                background: compet.color + "18", border: `1.5px solid ${compet.color}`,
                fontFamily: sans, fontSize: 11, fontWeight: 700, color: compet.color,
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>
                {compet.label}
              </span>
            )}
          </div>

          {/* Plain-English headline */}
          <div style={{
            background: "#faf9f6", borderLeft: `3px solid ${brown}`,
            padding: "12px 16px", borderRadius: 4, marginBottom: 24,
          }}>
            <Headline text={storyHeadline} />
          </div>

          {/* THEN vs NOW — the flagship comparison */}
          <SectionTitle
            eyebrow="Then vs Now"
            title="The electorate — 2021 vs 2026"
            sub="How the voter rolls have changed between the last election and the SIR 2026 final roll."
          />
          {r21 ? (
            <div style={{
              background: "#fff", border: `1px solid ${border}`, borderRadius: 8,
              padding: "16px 18px", marginBottom: 28,
            }}>
              {/* Dual-bar compare */}
              {(() => {
                const maxSide = Math.max(ac.total, r21.totalElectors);
                const p21 = (r21.totalElectors / maxSide) * 100;
                const p26 = (ac.total / maxSide) * 100;
                const growth = electorDeltaPct ?? 0;
                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, color: gray, marginBottom: 4 }}>
                        <span>2021 rolls</span>
                        <span style={{ color: dark, fontWeight: 700 }}>{fmt(r21.totalElectors)}</span>
                      </div>
                      <div style={{ height: 16, background: "#ede9e3", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ width: `${p21}%`, height: "100%", background: gray, borderRadius: 8 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 11, color: gray, marginBottom: 4 }}>
                        <span>2026 rolls (SIR)</span>
                        <span style={{ color: dark, fontWeight: 700 }}>{fmt(ac.total)}</span>
                      </div>
                      <div style={{ height: 16, background: "#ede9e3", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{
                          width: `${p26}%`, height: "100%",
                          background: growth >= 0 ? "#047857" : "#dc2626",
                          borderRadius: 8,
                        }} />
                      </div>
                    </div>
                    <Headline
                      text={
                        growth > 2
                          ? `The roll grew by ${growth.toFixed(1)}% — that's ${fmt(Math.abs(electorDelta!))} new voters. A bigger electorate can reshuffle a safe seat.`
                          : growth < -2
                          ? `The roll shrank by ${Math.abs(growth).toFixed(1)}% — ${fmt(Math.abs(electorDelta!))} fewer voters. Migration or SIR deletions at work.`
                          : `The roll is nearly unchanged vs 2021 (${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%). Turnout, not roll size, will decide this one.`
                      }
                    />
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{ background: "#faf9f6", padding: "14px 16px", borderRadius: 6, marginBottom: 28, fontFamily: mono, fontSize: 12, color: gray }}>
              2021 result not available for this constituency.
            </div>
          )}

          {/* SIR 2026 breakdown */}
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
              label="vs 2021"
              value={electorDelta === null ? "—" : `${electorDelta >= 0 ? "+" : ""}${fmt(electorDelta)}`}
              sub={electorDeltaPct === null ? "" : `${electorDeltaPct >= 0 ? "+" : ""}${electorDeltaPct.toFixed(1)}% change`}
              color={electorDelta === null ? gray : electorDelta >= 0 ? "#047857" : "#dc2626"}
            />
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 28 }}>
            <div style={{ background: "#7DB3E8", width: `${(ac.men/ac.total)*100}%` }} title={`Men ${fmt(ac.men)}`} />
            <div style={{ background: "#E87D9B", flex: 1 }} title={`Women ${fmt(ac.women)}`} />
          </div>

          {/* 2021 Result */}
          {r21 && compet && (
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
                  text={`${r21.winner} (${r21.partyShort}) won by ${r21.marginPct.toFixed(1)}% — ${compet.hint}. Turnout was ${r21.pollPct.toFixed(1)}%.`}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                <Stat label="Winner" value={r21.partyShort} sub={r21.winner} color={PARTY_COLORS_2021[r21.partyShort] ?? dark} />
                <Stat label="Margin" value={`${r21.marginPct.toFixed(1)}%`} sub={`${fmt(r21.margin)} votes`} color={compet.color} />
                <Stat label="Turnout 2021" value={`${r21.pollPct.toFixed(1)}%`} sub={`${fmt(r21.totalVotes)} cast`} />
                <Stat label="Verdict" value={compet.label} sub={compet.hint} color={compet.color} />
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
                  <span>0% (tie)</span>
                  <span>5% flip-risk</span>
                  <span>10% swing</span>
                  <span>20% safe →</span>
                </div>
              </div>
            </>
          )}

          {/* 2026 candidates placeholder */}
          {r21 && (
            <>
              <SectionTitle
                eyebrow="This time's fight"
                title="What to watch in 2026"
                sub="2026 candidate list will populate here once filed. The 2021 margin is the baseline to beat."
              />
              <div style={{
                background: "#fff", border: `1px solid ${border}`, borderRadius: 8,
                padding: "14px 16px", marginBottom: 28,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
              }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    2021 incumbent
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 16, color: dark }}>{r21.winner}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: PARTY_COLORS_2021[r21.partyShort] ?? gray, fontWeight: 700 }}>
                    {r21.partyShort}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    2026 candidates
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 13, color: gray, fontStyle: "italic" }}>
                    To be filed by parties — coming soon.
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Manifesto promises */}
          <SectionTitle
            eyebrow="What was promised"
            title={`Promises mentioning ${ac.constituency} or ${ac.district}`}
            sub={relevantPromises.length === 0
              ? "No party manifesto point explicitly references this constituency or its district."
              : `${relevantPromises.length} manifesto point${relevantPromises.length === 1 ? "" : "s"} matched on name or district.`}
          />
          {relevantPromises.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          )}
        </div>
      </div>
    </section>
  );
}
