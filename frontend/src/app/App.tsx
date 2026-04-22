import React, { useState, useMemo } from "react";
import { DonutChart } from "./components/DonutChart";
import { CompareGrid } from "./components/CompareGrid";
import { DemographyExplorer } from "./components/DemographyExplorer";
import { FactCheckPanel } from "./components/FactCheckPanel";
import { MapExplorer } from "./components/MapExplorer";
import imgHero from "../assets/MANIFESTO_IMAGE.png";
import {
  allPoints,
  TOTALS,
  GRAND_TOTAL,
  welfareData,
  capexData,
  feasibilityRadarData,
  urbanRuralData,
  PARTY_LABELS,
  PARTY_COLORS_BY_LABEL,
  noveltyData,
} from "./manifestoData";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { PromiseModal } from "./components/PromiseModal";

const sans = '"Inter Tight", sans-serif';
const serif = '"Source Serif 4", serif';
const mono = '"IBM Plex Mono", monospace';
const brown = "#a16749";
const dark = "#121212";
const gray = "#6b6b6b";
const border = "#d9d7d2";
const admkColor = "#547c5b";
const dmkColor = "#c94d48";
const tvkColor = "#E5A000";

const tabs = ["Dashboard", "Compare", "Demography", "Fact Check", "Map"];

// Editorial descriptions for each feasibility dimension in feasibilityRadarData.
const FEASIBILITY_DESCRIPTIONS: Record<string, string> = {
  Fiscal: "Can the state afford it?",
  Legal: "Does the state have jurisdiction?",
  Admin: "Does delivery capacity exist?",
  Timeline: "Achievable within a 5-year term?",
  Political: "Does it have broad political support?",
};


// ── Small shared components ───────────────────────────────────────────────

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      background: color + "18", border: `1px solid ${color}40`,
      fontFamily: sans, fontSize: 10, fontWeight: 600,
      letterSpacing: "0.08em", textTransform: "uppercase" as const, color,
    }}>{text}</span>
  );
}

function FeasibilityDots({ score }: { score: number | null }) {
  if (score === null) return <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>—</span>;
  const color = score >= 4 ? "#1C804C" : score >= 3 ? brown : "#d43d51";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= Math.round(score) ? color : "#e8e4dc" }} />
      ))}
      <span style={{ fontFamily: mono, fontSize: 11, color: gray, marginLeft: 2 }}>{score}/5</span>
    </span>
  );
}

// ── NavBar ────────────────────────────────────────────────────────────────

function NavBar({
  activeTab, setActiveTab, searchQuery, setSearchQuery,
}: {
  activeTab: string; setActiveTab: (t: string) => void;
  searchQuery: string; setSearchQuery: (q: string) => void;
}) {
  return (
    <div className="mobile-col mobile-gap-sm mobile-py-sm mobile-align-start" style={{
      borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: dark,
      padding: "10px 0", display: "flex", justifyContent: "space-between",
      alignItems: "center", fontFamily: sans,
    }}>
      <div className="mobile-logo" style={{
        background: brown, padding: "12px 8px", height: 18,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginRight: 160,
      }}>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, color: "#fff", letterSpacing: "2px" }}>
          PRDR
        </span>
      </div>
      <div className="mobile-nav mobile-w-full" style={{ display: "flex", alignItems: "center", gap: 24, flex: 1 }}>
        {tabs.map(t => (
          <button key={t} onClick={(e) => {
            setActiveTab(t);
            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }} style={{
            background: "none", border: "none", cursor: "pointer", padding: "4px 4px",
            fontFamily: sans, fontSize: 14, fontWeight: activeTab === t ? 700 : 500,
            letterSpacing: "0.58px", textTransform: "uppercase" as const,
            color: activeTab === t ? brown : dark,
            boxShadow: activeTab === t ? `inset 0 -2px 0 0 ${brown}` : "none",
            flexShrink: 0,
          }}>{t}</button>
        ))}
      </div>
      <div className="mobile-w-full" style={{
        display: "flex", alignItems: "center", gap: 8,
        borderWidth: 1, borderStyle: "solid",
        borderColor: searchQuery ? brown : border,
        borderRadius: 4, padding: "6px 11px", background: "#faf9f6",
        width: 280, flexShrink: 0, transition: "border-color 0.2s",
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="5.7" cy="6.2" r="4.2" stroke={searchQuery ? brown : dark} strokeWidth="0.98" />
          <line x1="8.85" y1="9.35" x2="12" y2="12.5" stroke={searchQuery ? brown : dark} strokeWidth="0.98" />
        </svg>
        <input
          placeholder="Search promises…"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim()) setActiveTab("Search");
          }}
          onKeyDown={e => {
            if (e.key === "Escape") { setSearchQuery(""); setActiveTab("Dashboard"); }
          }}
          style={{
            border: "none", outline: "none", background: "transparent",
            fontFamily: sans, fontSize: 12, color: dark, flex: 1, letterSpacing: "0.24px",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); setActiveTab("Dashboard"); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: gray, fontSize: 16, lineHeight: 1 }}
          >×</button>
        )}
      </div>
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────────────

function SearchTab({ query }: { query: string }) {
  const [pf, setPf] = useState<string | null>(null);
  const q = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!q) return [];
    return allPoints.filter(p =>
      p.text.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      p.sectionTitle.toLowerCase().includes(q) ||
      p.primaryTheme.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [q]);

  const filtered = pf ? results.filter(r => r.partyLabel === pf) : results;

  return (
    <section style={{ padding: "32px 0" }}>
      <div style={{ paddingBottom: 24 }}>
        <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.2 }}>
          {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
        </h2>
        <p style={{ fontFamily: serif, fontSize: 16, lineHeight: "30px", color: "#2e2e2e", marginTop: 4 }}>
          Searching across {allPoints.length} indexed promises from {PARTY_LABELS.length} parties.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center" }}>
        {[{ label: "All", value: null as string | null }, ...PARTY_LABELS.map(l => ({ label: l, value: l }))].map(f => (
          <button key={f.label} onClick={() => setPf(f.value)} style={{
            fontFamily: sans, fontSize: 12, fontWeight: 500, padding: "7px 12px",
            borderRadius: 4, cursor: "pointer",
            background: pf === f.value ? dark : "transparent",
            color: pf === f.value ? "#fff" : "#1a1a1a",
            borderWidth: 1, borderStyle: "solid",
            borderColor: pf === f.value ? dark : border,
          }}>{f.label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontFamily: sans, fontSize: 12, color: gray }}>
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: gray, fontFamily: serif, fontSize: 18 }}>
          No promises found matching "{query}". Try a different keyword.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((p, i) => (
            <div key={i} style={{ padding: "20px 0", borderTop: `1px solid ${border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" as const }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: p.partyColor, flexShrink: 0 }} />
                <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: p.partyColor }}>
                  {p.partyLabel}
                </span>
                {p.sectionTitle && (
                  <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>§ {p.sectionTitle}</span>
                )}
                <span style={{ marginLeft: "auto" }}>
                  <FeasibilityDots score={p.feasibilityScore} />
                </span>
              </div>
              {p.title && (
                <div style={{ fontFamily: serif, fontSize: 17, color: dark, lineHeight: 1.4, marginBottom: 6, fontWeight: 500 }}>
                  {p.title}
                </div>
              )}
              <div style={{ fontFamily: serif, fontSize: 14, color: "#444", lineHeight: 1.65 }}>
                {p.text.length > 300 ? p.text.slice(0, 300) + "…" : p.text}
              </div>
              {p.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginTop: 10 }}>
                  {p.tags.slice(0, 6).map(tag => (
                    <Pill key={tag} text={tag} color={p.partyColor} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────

function DashboardTab() {
  const welfareTotal = welfareData.admk + welfareData.dmk + welfareData.tvk;
  const capexTotal = capexData.admk + capexData.dmk + capexData.tvk;

  const [drill, setDrill] = useState<{ party: string; label: string } | null>(null);

  const drillPts = useMemo(() => {
    if (!drill) return [];
    return allPoints.filter(p => p.party === drill.party && p.relation?.toLowerCase() === drill.label.toLowerCase());
  }, [drill]);

  return (
    <>
      {/* Hero */}
      <section className="mobile-col-reverse mobile-py-sm" style={{ padding: "56px 0 80px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40 }}>
        <div className="mobile-w-full mobile-text-center" style={{ maxWidth: 586 }}>
          <h1 className="mobile-hero-title" style={{ fontFamily: serif, fontWeight: 400, fontSize: 64, lineHeight: 1.115, letterSpacing: "-1.7px", color: dark, margin: 0 }}>
            Tamil Nadu's parties{" "}
            <span style={{ fontWeight: 500, color: brown }}>Manifesto</span>{" "}
            Analysis
          </h1>
          <p className="mobile-hero-subtitle" style={{ fontFamily: serif, fontSize: 20, lineHeight: "30px", color: "#2e2e2e", marginTop: 19, maxWidth: 586 }}>
            A structured reading of the {PARTY_LABELS.slice(0, -1).join(", ")} and {PARTY_LABELS.slice(-1)[0]} manifestos for the 2026 Legislative Assembly election.
            Every promise parsed, classified by theme, beneficiary, sector and feasibility.
          </p>

        </div>
        <div className="mobile-w-full" style={{ width: 533, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderStyle: "solid", borderColor: border, flexShrink: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={imgHero} alt="Tamil Nadu Election" style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} />
        </div>
      </section>

      {/* Donut Charts */}
      <section className="mobile-col mobile-no-border-x" style={{ display: "flex", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: border, borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: border }}>
        <div className="mobile-w-full mobile-no-border-x mobile-no-border" style={{ flex: 1 }}>
          <DonutChart
            title="Total promises"
            subtitle="Every promise across all three manifestos."
            total={GRAND_TOTAL} admk={TOTALS.admk} dmk={TOTALS.dmk} tvk={TOTALS.tvk}
          />
        </div>
        <div className="mobile-w-full mobile-no-border-x mobile-no-border" style={{ borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: border, borderRightWidth: 1, borderRightStyle: "solid", borderRightColor: border, flex: 1 }}>
          <DonutChart
            title="Welfare & recurring spends"
            subtitle="Cash transfers and recurring expenditure."
            total={welfareTotal} admk={welfareData.admk} dmk={welfareData.dmk} tvk={welfareData.tvk}
            admkTotal={TOTALS.admk} dmkTotal={TOTALS.dmk} tvkTotal={TOTALS.tvk}
          />
        </div>
        <div className="mobile-w-full mobile-no-border" style={{ flex: 1 }}>
          <DonutChart
            title="Capital expenditure"
            subtitle="Infrastructure, education & industry — builds the state's future."
            total={capexTotal} admk={capexData.admk} dmk={capexData.dmk} tvk={capexData.tvk}
            admkTotal={TOTALS.admk} dmkTotal={TOTALS.dmk} tvkTotal={TOTALS.tvk}
          />
        </div>
      </section>

      {/* Promise Novelty */}
      <section style={{ padding: "48px 0 0px", borderBottom: `1px solid ${border}` }}>
        <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: dark, margin: "0 0 6px", lineHeight: 1.2 }}>
          How much is genuinely new?
        </h2>
        <p style={{ fontFamily: serif, fontSize: 15, lineHeight: "28px", color: "#2e2e2e", margin: "0 0 24px" }}>
          Each promise classified against existing schemes: truly new, an expansion, an amendment or a continuation.
          Click any bar to see the specific promises.
        </p>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={noveltyData} barCategoryGap="28%" barGap={3}>
              <XAxis dataKey="label" tick={{ fontFamily: sans, fontSize: 12, fill: gray }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: mono, fontSize: 11, fill: gray }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontFamily: sans, fontSize: 12, border: `1px solid ${border}`, borderRadius: 4 }} cursor={{ fill: "#f5f3ee" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: sans, fontSize: 12 }} />
              <Bar dataKey="admk" name="ADMK" fill={PARTY_COLORS_BY_LABEL["ADMK"]} radius={[3, 3, 0, 0]} style={{ cursor: "pointer" }} onClick={(data) => data.admk > 0 && setDrill({ party: "admk", label: data.label })} />
              <Bar dataKey="dmk" name="DMK" fill={PARTY_COLORS_BY_LABEL["DMK"]} radius={[3, 3, 0, 0]} style={{ cursor: "pointer" }} onClick={(data) => data.dmk > 0 && setDrill({ party: "dmk", label: data.label })} />
              <Bar dataKey="tvk" name="TVK" fill={PARTY_COLORS_BY_LABEL["TVK"]} radius={[3, 3, 0, 0]} style={{ cursor: "pointer" }} onClick={(data) => data.tvk > 0 && setDrill({ party: "tvk", label: data.label })} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Feasibility Radar */}
      <section className="mobile-py-sm" style={{ padding: "48px 0 32px" }}>
        <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: dark, margin: "0 0 6px" }}>
          How feasible are the promises?
        </h2>
        <p style={{ fontFamily: serif, fontSize: 15, lineHeight: "28px", color: "#2e2e2e", margin: "0 0 28px", maxWidth: 600 }}>
          Each promise was scored 1–5 across {feasibilityRadarData.length} dimensions using LLM analysis grounded in real policy data.
          Higher score = more feasible.
        </p>
        <div className="mobile-col mobile-gap-sm" style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
          <div className="mobile-w-full mobile-h-auto mobile-basis-initial" style={{ flex: "0 0 400px", height: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={feasibilityRadarData}>
                <PolarGrid stroke={border} />
                <PolarAngleAxis dataKey="dim" tick={{ fontFamily: sans, fontSize: 12, fill: gray }} />
                <Radar name="ADMK" dataKey="ADMK" stroke={admkColor} fill={admkColor} fillOpacity={0.12} strokeWidth={2} dot />
                <Radar name="DMK" dataKey="DMK" stroke={dmkColor} fill={dmkColor} fillOpacity={0.12} strokeWidth={2} dot />
                <Radar name="TVK" dataKey="TVK" stroke={tvkColor} fill={tvkColor} fillOpacity={0.12} strokeWidth={2} dot />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: sans, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              {feasibilityRadarData.map(({ dim }) => (
                <div key={dim} style={{ padding: "16px 0", borderBottom: `1px solid ${border}` }}>
                  <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: dark, marginBottom: 4 }}>{dim}</div>
                  <div style={{ fontFamily: serif, fontSize: 13, color: gray, lineHeight: 1.5 }}>{FEASIBILITY_DESCRIPTIONS[dim] ?? ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


    </>
  );
}

// ── Demography Tab ────────────────────────────────────────────────────────

function DemographyTab() {
  return (
    <section style={{ padding: "0px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: "32px 0 0", lineHeight: 1.2 }}>
            Who do the manifestos speak to?
          </h2>
          <p style={{ fontFamily: serif, fontSize: 16, lineHeight: "30px", color: "#2e2e2e", marginTop: 4, marginBottom: 0 }}>
            Promises targeting specific communities — filter by gender, age, caste, sector or geography.
            Bars show % of each party's manifesto devoted to the group. Click any bar to drill into the underlying promises.
          </p>
        </div>

        <DemographyExplorer />

        <p style={{ fontFamily: serif, fontSize: 13, color: gray, fontStyle: "italic", marginTop: 4 }}>
          Counts reflect all {allPoints.length} analysed promises across the three manifestos.
          Click any bar to drill into the underlying promises.
        </p>

        {/* Urban vs Rural */}
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 32 }}>
          <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: dark, margin: "0 0 6px" }}>
            Urban vs Rural reach
          </h3>
          <p style={{ fontFamily: serif, fontSize: 14, color: "#2e2e2e", lineHeight: "26px", margin: "0 0 20px" }}>
            % of each party's manifesto by geographic focus — statewide, urban-only or rural-only.
          </p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={urbanRuralData.map(row => ({
                  label: row.label,
                  admk: TOTALS.admk > 0 ? +((row.admk / TOTALS.admk) * 100).toFixed(1) : 0,
                  dmk: TOTALS.dmk > 0 ? +((row.dmk / TOTALS.dmk) * 100).toFixed(1) : 0,
                  tvk: TOTALS.tvk > 0 ? +((row.tvk / TOTALS.tvk) * 100).toFixed(1) : 0,
                }))}
                barCategoryGap="28%" barGap={3}
              >
                <XAxis dataKey="label" tick={{ fontFamily: sans, fontSize: 12, fill: gray }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: mono, fontSize: 11, fill: gray }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={(value: number) => `${value}%`}
                  contentStyle={{ fontFamily: sans, fontSize: 12, border: `1px solid ${border}`, borderRadius: 4 }}
                  cursor={{ fill: "#f5f3ee" }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: sans, fontSize: 12 }} />
                <Bar dataKey="admk" name="ADMK" fill={admkColor} radius={[3, 3, 0, 0]} />
                <Bar dataKey="dmk" name="DMK" fill={dmkColor} radius={[3, 3, 0, 0]} />
                <Bar dataKey="tvk" name="TVK" fill={tvkColor} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div style={{ background: "#fff", paddingBottom: 40, overflowX: "hidden" }}>
      <div className="mobile-w-full mobile-px-sm" style={{ maxWidth: 1176, margin: "0 auto", padding: "0 32px" }}>
        <NavBar activeTab={activeTab} setActiveTab={setActiveTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        {activeTab === "Search" && <SearchTab query={searchQuery} />}
        {activeTab === "Dashboard" && <DashboardTab />}
        {activeTab === "Compare" && <section style={{ padding: "0px 0" }}><CompareGrid /></section>}
        {activeTab === "Demography" && <DemographyTab />}
        {activeTab === "Map" && <MapExplorer />}
        {activeTab === "Fact Check" && <FactCheckPanel />}

        {/* Global Footer / Disclaimer */}
        <div style={{ position: "fixed", bottom: 0, left: 0, width: "100%", background: "#fcfbf9", borderTop: `1px solid ${border}`, padding: "8px 24px", zIndex: 1000, boxShadow: "0 -2px 10px rgba(0,0,0,0.03)" }}>
          <p style={{ fontFamily: sans, fontSize: 11, color: gray, margin: 0, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>
            Disclaimer: The information, classifications, and fact-checks on this dashboard were parsed and analysed using Large Language Models (LLMs). While efforts have been made to ensure accuracy, AI can sometimes hallucinate or misinterpret text, meaning some information may be incorrect or lack full context. Please verify critical claims directly from the official manifestos.
          </p>
        </div>
      </div>
    </div>
  );
}
