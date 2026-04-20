import React, { useMemo, useState } from "react";
import { factChecks, PARTY_LABELS, type FactCheck, type FactCheckEvidence } from "../manifestoData";

const sans  = '"Inter Tight", sans-serif';
const serif = '"Source Serif 4", serif';
const mono  = '"IBM Plex Mono", monospace';
const dark  = "#121212";
const gray  = "#6b6b6b";
const border = "#d9d7d2";
const brown = "#a16749";
const admkColor = "#547c5b";
const dmkColor  = "#c94d48";
const tvkColor  = "#E5A000";

const PARTY_COLOR: Record<string, string> = { ADMK: admkColor, DMK: dmkColor, TVK: tvkColor };

type Verdict = "Accurate" | "Aspirational" | "Disputed" | "Unlikely";
const VERDICTS: Verdict[] = ["Accurate", "Aspirational", "Disputed", "Unlikely"];

const VERDICT_COLORS: Record<Verdict, string> = {
  Accurate:     "#1C804C",
  Aspirational: "#D76405",
  Disputed:     "#BA5C3B",
  Unlikely:     "#d43d51",
};

// Unlikely is most concerning, then Disputed, then Aspirational, then Accurate.
const VERDICT_SEVERITY: Record<Verdict, number> = {
  Unlikely: 4, Disputed: 3, Aspirational: 2, Accurate: 1,
};

type SortKey = "severity" | "party" | "theme" | "order";

export function FactCheckPanel() {
  const [partyFilter, setPartyFilter] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Set<Verdict>>(new Set());
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [openRisks, setOpenRisks] = useState<Set<string>>(new Set());

  const allThemes = useMemo(() => {
    const set = new Map<string, string>();
    for (const fc of factChecks) set.set(fc.theme, fc.themeLabel);
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const q = query.toLowerCase().trim();

  const filtered = useMemo(() => {
    let items = factChecks.slice();
    if (partyFilter) items = items.filter(fc => fc.party === partyFilter);
    if (verdictFilter.size > 0) items = items.filter(fc => verdictFilter.has(fc.verdict as Verdict));
    if (themeFilter) items = items.filter(fc => fc.theme === themeFilter);
    if (q) items = items.filter(fc =>
      fc.claim.toLowerCase().includes(q) ||
      fc.analysis.toLowerCase().includes(q) ||
      fc.keyRisks.some(r => r.toLowerCase().includes(q))
    );

    if (sortKey === "severity") {
      items.sort((a, b) => (VERDICT_SEVERITY[b.verdict as Verdict] ?? 0) - (VERDICT_SEVERITY[a.verdict as Verdict] ?? 0));
    } else if (sortKey === "party") {
      items.sort((a, b) => a.party.localeCompare(b.party) || a.pointNumber - b.pointNumber);
    } else if (sortKey === "theme") {
      items.sort((a, b) => a.themeLabel.localeCompare(b.themeLabel) || a.pointNumber - b.pointNumber);
    }
    return items;
  }, [partyFilter, verdictFilter, themeFilter, q, sortKey]);

  const toggleVerdict = (v: Verdict) => setVerdictFilter(prev => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });

  const toggleRisks = (id: string) => setOpenRisks(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const resetFilters = () => {
    setPartyFilter(null);
    setVerdictFilter(new Set());
    setThemeFilter(null);
    setQuery("");
    setSortKey("order");
  };

  const hasActiveFilter = partyFilter || verdictFilter.size > 0 || themeFilter || q || sortKey !== "order";

  return (
    <section style={{ padding: "32px 0 48px" }}>
      {/* Header */}
      <div style={{ paddingBottom: 20 }}>
        <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.2 }}>
          Fact-checking the manifestos
        </h2>
        <p style={{ fontFamily: serif, fontSize: 16, lineHeight: "30px", color: "#2e2e2e", marginTop: 4, marginBottom: 0 }}>
          {factChecks.length} key claims verified against data, official records and legal texts —
          rated Accurate, Aspirational, Disputed or Unlikely.
        </p>
      </div>

      {/* Party summary strip */}
      <PartySummaryStrip />

      {/* Sticky controls */}
      <div style={{
        position: "sticky" as const, top: 0, zIndex: 10,
        background: "#fff",
        borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
        padding: "14px 0", margin: "24px 0 20px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Row 1: search + sort + reset */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 240,
            border: `1px solid ${query ? brown : border}`, borderRadius: 4,
            padding: "6px 11px", background: "#faf9f6",
            transition: "border-color 0.2s",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="5.7" cy="6.2" r="4.2" stroke={query ? brown : dark} strokeWidth="0.98" />
              <line x1="8.85" y1="9.35" x2="12" y2="12.5" stroke={query ? brown : dark} strokeWidth="0.98" />
            </svg>
            <input
              placeholder="Search claims, analysis, risks…"
              value={query} onChange={e => setQuery(e.target.value)}
              style={{
                border: "none", outline: "none", background: "transparent", flex: 1,
                fontFamily: sans, fontSize: 12, color: dark,
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: gray, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>

          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: gray }}>Sort</span>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} style={{
            fontFamily: sans, fontSize: 12, padding: "6px 10px", borderRadius: 4,
            border: `1px solid ${border}`, background: "#faf9f6", color: dark, cursor: "pointer",
          }}>
            <option value="order">Original order</option>
            <option value="severity">Severity (most concerning first)</option>
            <option value="party">Party</option>
            <option value="theme">Theme</option>
          </select>

          {hasActiveFilter && (
            <button onClick={resetFilters} style={{
              padding: "6px 12px", borderRadius: 4, cursor: "pointer",
              background: "transparent", color: gray,
              border: `1px dashed ${border}`,
              fontFamily: sans, fontSize: 11,
            }}>Reset ×</button>
          )}

          <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11, color: gray }}>
            {filtered.length} of {factChecks.length}
          </span>
        </div>

        {/* Row 2: party chips */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: gray, minWidth: 52 }}>Party</span>
          {[{ label: "All", value: null as string | null }, ...PARTY_LABELS.map(l => ({ label: l, value: l }))].map(f => {
            const on = partyFilter === f.value;
            const color = f.value ? PARTY_COLOR[f.value] : dark;
            return (
              <button key={f.label} onClick={() => setPartyFilter(f.value)} style={{
                padding: "5px 11px", borderRadius: 4, cursor: "pointer",
                background: on ? color : "transparent",
                color: on ? "#fff" : dark,
                border: `1px solid ${on ? color : border}`,
                fontFamily: sans, fontSize: 12, fontWeight: 500,
              }}>{f.label}</button>
            );
          })}
        </div>

        {/* Row 3: verdict chips + theme dropdown */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: gray, minWidth: 52 }}>Verdict</span>
          {VERDICTS.map(v => {
            const on = verdictFilter.has(v);
            return (
              <button key={v} onClick={() => toggleVerdict(v)} style={{
                padding: "5px 11px", borderRadius: 4, cursor: "pointer",
                background: on ? VERDICT_COLORS[v] : "transparent",
                color: on ? "#fff" : dark,
                border: `1px solid ${on ? VERDICT_COLORS[v] : border}`,
                fontFamily: sans, fontSize: 12, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#fff" : VERDICT_COLORS[v] }} />
                {v}
              </button>
            );
          })}

          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: gray, marginLeft: 16 }}>Theme</span>
          <select value={themeFilter ?? ""} onChange={e => setThemeFilter(e.target.value || null)} style={{
            fontFamily: sans, fontSize: 12, padding: "5px 10px", borderRadius: 4,
            border: `1px solid ${themeFilter ? brown : border}`, background: "#faf9f6", color: dark, cursor: "pointer",
          }}>
            <option value="">All themes</option>
            {allThemes.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ padding: "64px 0", textAlign: "center" as const, fontFamily: serif, fontSize: 18, color: gray }}>
          No fact checks match the current filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((fc, i) => (
            <FactCheckCard
              key={`${fc.party}-${fc.pointNumber}`}
              fc={fc}
              first={i === 0}
              risksOpen={openRisks.has(`${fc.party}-${fc.pointNumber}`)}
              onToggleRisks={() => toggleRisks(`${fc.party}-${fc.pointNumber}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Party summary strip ─────────────────────────────────────────────────────

function PartySummaryStrip() {
  const byParty = useMemo(() => {
    const init = () => ({ Accurate: 0, Aspirational: 0, Disputed: 0, Unlikely: 0, total: 0 });
    const map: Record<string, ReturnType<typeof init>> = { ADMK: init(), DMK: init(), TVK: init() };
    for (const fc of factChecks) {
      if (!map[fc.party]) continue;
      map[fc.party][fc.verdict as Verdict]++;
      map[fc.party].total++;
    }
    return map;
  }, []);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
      marginTop: 20,
    }}>
      {PARTY_LABELS.map(label => {
        const s = byParty[label];
        const color = PARTY_COLOR[label];
        const accuratePct = s.total > 0 ? (s.Accurate / s.total) * 100 : 0;
        return (
          <div key={label} style={{
            border: `1px solid ${border}`, borderRadius: 8,
            padding: "14px 18px", background: "#fff",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{
                fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase" as const, color,
              }}>{label}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>{s.total} claims</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: serif, fontSize: 32, fontWeight: 500, color: VERDICT_COLORS.Accurate, lineHeight: 1 }}>
                {Math.round(accuratePct)}%
              </span>
              <span style={{ fontFamily: sans, fontSize: 12, color: gray }}>rated accurate</span>
            </div>

            {/* Stacked verdict bar */}
            <div style={{ height: 10, background: "#f0eeea", borderRadius: 5, overflow: "hidden", display: "flex" }}>
              {VERDICTS.map(v => {
                const pct = s.total > 0 ? (s[v] / s.total) * 100 : 0;
                return (
                  <div key={v} title={`${v}: ${s[v]}`} style={{
                    width: `${pct}%`, background: VERDICT_COLORS[v],
                    minWidth: s[v] > 0 ? 2 : 0,
                  }} />
                );
              })}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10, fontSize: 11 }}>
              {VERDICTS.map(v => s[v] > 0 && (
                <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: sans, color: gray }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: VERDICT_COLORS[v] }} />
                  <span style={{ fontFamily: mono, color: dark, fontWeight: 600 }}>{s[v]}</span> {v}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Fact check card ─────────────────────────────────────────────────────────

function FactCheckCard({ fc, first, risksOpen, onToggleRisks }: {
  fc: FactCheck;
  first: boolean;
  risksOpen: boolean;
  onToggleRisks: () => void;
}) {
  return (
    <div style={{
      padding: "24px 0",
      borderTop: first ? `1px solid ${border}` : `1px solid ${border}`,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" as const, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
          <span style={{ width: 12, height: 12, background: fc.color, borderRadius: 3 }} />
          <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#1a1a1a" }}>
            {fc.party}
          </span>
          <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>Promise {fc.num}</span>
          <span style={{
            padding: "2px 8px", borderRadius: 12,
            background: "#f5f3ee", border: `1px solid ${border}`,
            fontFamily: sans, fontSize: 10, fontWeight: 600, color: gray,
            letterSpacing: "0.04em",
          }}>{fc.themeLabel}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {fc.score !== null && (
            <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>
              Feasibility {fc.score}/5
            </span>
          )}
          <div style={{
            padding: "6px 12px", borderRadius: 4,
            background: VERDICT_COLORS[fc.verdict as Verdict],
            color: "#fff", fontFamily: sans, fontSize: 10.5, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase" as const,
          }}>{fc.verdict}</div>
        </div>
      </div>

      {/* Claim */}
      <div style={{ fontFamily: serif, fontSize: 20, color: dark, lineHeight: 1.5, marginBottom: 14 }}>
        {fc.claim}
      </div>

      {/* Analysis */}
      <div style={{
        fontFamily: serif, fontSize: 15, color: "#6b6b6b", lineHeight: 1.65,
        fontStyle: "italic", borderLeft: `3px solid ${fc.verdictColor}`, paddingLeft: 16,
      }}>
        <span style={{ fontWeight: 700, fontStyle: "normal", color: "#1a1a1a" }}>Fact: </span>
        {fc.analysis}
      </div>

      {/* Key risks */}
      {fc.keyRisks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={onToggleRisks} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: risksOpen ? "#fef2ed" : "#faf8f4",
            border: `1px solid ${risksOpen ? VERDICT_COLORS.Disputed : border}`,
            borderRadius: 4, padding: "6px 12px", cursor: "pointer",
            fontFamily: sans, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            color: risksOpen ? VERDICT_COLORS.Disputed : dark,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
              transform: risksOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s",
            }}>
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {fc.keyRisks.length} key risk{fc.keyRisks.length !== 1 ? "s" : ""}
          </button>
          {risksOpen && (
            <ul style={{
              margin: "10px 0 0", padding: "0 0 0 22px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              {fc.keyRisks.map((risk, j) => (
                <li key={j} style={{
                  fontFamily: serif, fontSize: 14, color: "#2e2e2e", lineHeight: 1.5,
                  listStyleType: "'— '" as const,
                }}>{risk}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Sources */}
      {fc.evidence.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: gray }}>
            Sources
          </span>
          {fc.evidence.map((ev: FactCheckEvidence, j: number) => (
            <div key={j} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {ev.url ? (
                <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{
                  fontFamily: sans, fontSize: 12, fontWeight: 600, color: fc.color,
                  textDecoration: "none", lineHeight: 1.4,
                }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                >
                  {ev.title}
                  <svg style={{ marginLeft: 4, verticalAlign: "middle", opacity: 0.7 }} width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 8.5L8.5 1.5M8.5 1.5H3.5M8.5 1.5V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ) : (
                <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: fc.color }}>{ev.title}</span>
              )}
              {ev.snippet && (
                <span style={{ fontFamily: serif, fontSize: 12, color: gray, lineHeight: 1.55, fontStyle: "italic" }}>
                  "{ev.snippet}"
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
