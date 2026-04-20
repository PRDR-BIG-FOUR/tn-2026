import React, { useState, useMemo } from "react";
import { Wheat, GraduationCap, Briefcase, Landmark, Factory, HardHat, HandCoins, Users, Palette, Scale, TrendingUp, MoreHorizontal } from "lucide-react";
import { sectorData, TOTALS } from "../manifestoData";
import {
  ResponsiveContainer, Tooltip,
  Treemap,
} from "recharts";

const sans  = '"Inter Tight", sans-serif';
const serif = '"Source Serif 4", serif';
const mono  = '"IBM Plex Mono", monospace';
const dark  = "#121212";
const gray  = "#6b6b6b";
const border = "#d9d7d2";
const admkColor = "#547c5b";
const dmkColor  = "#c94d48";
const tvkColor  = "#E5A000";

type PartyKey = "admk" | "dmk" | "tvk";

const PARTY_META: Record<PartyKey, { label: string; color: string }> = {
  admk: { label: "ADMK", color: admkColor },
  dmk:  { label: "DMK",  color: dmkColor  },
  tvk:  { label: "TVK",  color: tvkColor  },
};

const topicIcons: Record<string, React.ReactNode> = {
  "Governance":             <Landmark size={14} strokeWidth={1.5} />,
  "Social Justice":         <Scale size={14} strokeWidth={1.5} />,
  "Welfare & Cash Transfer":<HandCoins size={14} strokeWidth={1.5} />,
  "Education":              <GraduationCap size={14} strokeWidth={1.5} />,
  "Employment / Jobs":      <Briefcase size={14} strokeWidth={1.5} />,
  "Arts & Culture":         <Palette size={14} strokeWidth={1.5} />,
  "Infrastructure":         <HardHat size={14} strokeWidth={1.5} />,
  "Industry & Investment":  <Factory size={14} strokeWidth={1.5} />,
  "Agriculture":            <Wheat size={14} strokeWidth={1.5} />,
  "Women & Gender":         <Users size={14} strokeWidth={1.5} />,
  "Youth":                  <TrendingUp size={14} strokeWidth={1.5} />,
  "Other":                  <MoreHorizontal size={14} strokeWidth={1.5} />,
};

type ViewMode = "verdicts" | "priorities" | "duels" | "treemap";

// ── Data helpers ────────────────────────────────────────────────────────────

interface ThemeRow {
  name: string;
  admk: number;
  dmk: number;
  tvk: number;
  total: number;
  leader: PartyKey;
  leaderPct: number; // leader share of theme total
  leaderMargin: number; // leader - 2nd
}

function buildThemeRows(): ThemeRow[] {
  return Object.entries(sectorData).map(([name, d]) => {
    const total = d.admk + d.dmk + d.tvk;
    const sorted = (["admk","dmk","tvk"] as const)
      .map(k => ({ k, v: d[k] }))
      .sort((a, b) => b.v - a.v);
    const leader = sorted[0].k;
    const leaderPct = total > 0 ? (sorted[0].v / total) * 100 : 0;
    const leaderMargin = sorted[0].v - sorted[1].v;
    return { name, admk: d.admk, dmk: d.dmk, tvk: d.tvk, total, leader, leaderPct, leaderMargin };
  });
}

// ── Verdicts view ───────────────────────────────────────────────────────────

function buildVerdict(r: ThemeRow): string {
  const parties = (["admk","dmk","tvk"] as const)
    .map(k => ({ k, label: PARTY_META[k].label, v: r[k] }))
    .sort((a, b) => b.v - a.v);
  const [top, mid, bot] = parties;

  if (top.v === 0) return `No party has made ${r.name.toLowerCase()} a focus.`;

  if (mid.v === 0) {
    return `${top.label} owns ${r.name.toLowerCase()} — ${top.v} promises. The others are silent.`;
  }
  if (top.v >= mid.v * 2) {
    return `${top.label} dominates ${r.name.toLowerCase()} (${top.v}) — more than ${mid.label} (${mid.v}) and ${bot.label} (${bot.v}) combined.`;
  }
  if (top.v - mid.v <= Math.max(1, top.v * 0.15)) {
    return `${top.label} (${top.v}) and ${mid.label} (${mid.v}) are neck-and-neck. ${bot.label} trails at ${bot.v}.`;
  }
  if (bot.v === 0) {
    return `${top.label} leads with ${top.v}, ${mid.label} follows at ${mid.v}, ${bot.label} ignores the theme.`;
  }
  return `${top.label} leads (${top.v}), ${mid.label} (${mid.v}), ${bot.label} (${bot.v}).`;
}

function VerdictsView({ rows }: { rows: ThemeRow[] }) {
  const maxTotal = Math.max(1, ...rows.map(r => r.total));
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r, i) => {
        const leaderMeta = PARTY_META[r.leader];
        return (
          <div key={r.name} style={{
            display: "grid", gridTemplateColumns: "220px 1fr",
            alignItems: "center", gap: 24,
            padding: "22px 0",
            borderTop: i === 0 ? `1px solid ${border}` : `1px solid #f0eeea`,
          }}>
            {/* Left: title + leader badge */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ color: dark, display: "flex" }}>{topicIcons[r.name]}</span>
                <span style={{
                  fontFamily: serif, fontSize: 18, fontWeight: 500, color: dark,
                }}>{r.name}</span>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "3px 10px", borderRadius: 12,
                background: leaderMeta.color + "18", border: `1px solid ${leaderMeta.color}55`,
                fontFamily: sans, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase" as const, color: leaderMeta.color,
              }}>
                ◆ {leaderMeta.label} · {Math.round(r.leaderPct)}%
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: gray, marginTop: 6 }}>
                {r.total} promises
              </div>
            </div>

            {/* Right: stacked race bar + verdict */}
            <div>
              <div style={{
                display: "flex", height: 28, width: `${(r.total / maxTotal) * 100}%`,
                minWidth: "42%", borderRadius: 4, overflow: "hidden", background: "#f0eeea",
                marginBottom: 10,
              }}>
                {(["admk","dmk","tvk"] as const).map(k => {
                  const v = r[k];
                  const pct = r.total > 0 ? (v / r.total) * 100 : 0;
                  const meta = PARTY_META[k];
                  return (
                    <div key={k} title={`${meta.label}: ${v}`} style={{
                      width: `${pct}%`, height: "100%",
                      background: meta.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontFamily: mono, fontSize: 11, fontWeight: 700,
                      textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                      minWidth: v > 0 ? 18 : 0,
                    }}>
                      {pct >= 9 ? v : ""}
                    </div>
                  );
                })}
              </div>
              <div style={{
                fontFamily: serif, fontSize: 14, color: "#2e2e2e", lineHeight: 1.55,
                paddingLeft: 10, borderLeft: `3px solid ${leaderMeta.color}`,
              }}>
                {buildVerdict(r)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Party Priorities view ───────────────────────────────────────────────────

interface PartyPriority {
  party: PartyKey;
  label: string;
  color: string;
  total: number;
  themes: { name: string; count: number; pct: number }[];
}

function buildPriorities(rows: ThemeRow[]): PartyPriority[] {
  return (["admk","dmk","tvk"] as const).map(party => {
    const total = TOTALS[party];
    const themes = rows
      .map(r => ({ name: r.name, count: r[party], pct: total > 0 ? (r[party] / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    return { party, label: PARTY_META[party].label, color: PARTY_META[party].color, total, themes };
  });
}

function PrioritiesView({ rows }: { rows: ThemeRow[] }) {
  const priorities = useMemo(() => buildPriorities(rows), [rows]);
  // Max % across parties for consistent bar scale
  const maxPct = Math.max(1, ...priorities.flatMap(p => p.themes.slice(0, 6).map(t => t.pct)));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
      {priorities.map(p => {
        const top3 = p.themes.slice(0, 3);
        const top3Pct = top3.reduce((a, b) => a + b.pct, 0);
        const rest = p.themes.slice(3).filter(t => t.count > 0);
        return (
          <div key={p.party} style={{
            border: `1px solid ${border}`, borderRadius: 8, padding: "20px 22px",
            display: "flex", flexDirection: "column", gap: 14,
            background: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{
                fontFamily: sans, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase" as const, color: p.color,
              }}>{p.label}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>{p.total} total</span>
            </div>

            {/* Headline: what % of manifesto is the top 3 themes */}
            <div style={{
              fontFamily: serif, fontSize: 15, color: "#2e2e2e", lineHeight: 1.45,
              paddingBottom: 10, borderBottom: `1px solid ${border}`,
            }}>
              Top three themes account for{" "}
              <strong style={{ color: p.color, fontSize: 20 }}>{Math.round(top3Pct)}%</strong>
              {" "}of this manifesto.
            </div>

            {/* Top themes as horizontal bars sized against maxPct */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.themes.slice(0, 6).map((t, i) => (
                <div key={t.name} style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: gray, textAlign: "right" as const }}>
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                      <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 500, color: dark, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ color: gray, display: "flex" }}>{topicIcons[t.name]}</span>
                        {t.name}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>
                        {t.count} · {t.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: 8, background: "#f0eeea", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.min(100, (t.pct / maxPct) * 100)}%`,
                        height: "100%", background: p.color, borderRadius: 4,
                        minWidth: t.count > 0 ? 4 : 0,
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                  </div>
                  <span />
                </div>
              ))}
            </div>

            {/* What's ignored */}
            {rest.filter(t => t.count === 0).length > 0 && (
              <div style={{ marginTop: 4, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                <div style={{
                  fontFamily: sans, fontSize: 10, fontWeight: 700, letterSpacing: "1px",
                  textTransform: "uppercase" as const, color: gray, marginBottom: 6,
                }}>Blind spots</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                  {rest.filter(t => t.count === 0).map(t => (
                    <span key={t.name} style={{
                      fontFamily: sans, fontSize: 10, color: gray,
                      padding: "2px 7px", borderRadius: 10,
                      background: "#f5f3ee", border: `1px dashed ${border}`,
                    }}>{t.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Head-to-Head Duels view ─────────────────────────────────────────────────

type DuelPair = [PartyKey, PartyKey];

function DuelsView({ rows }: { rows: ThemeRow[] }) {
  const [pair, setPair] = useState<DuelPair>(["admk", "dmk"]);
  const [a, b] = pair;
  const metaA = PARTY_META[a];
  const metaB = PARTY_META[b];

  // Sort themes by magnitude of gap, biggest first
  const sortedByGap = useMemo(() => {
    return [...rows]
      .map(r => ({
        ...r,
        gap: r[a] - r[b],
        absGap: Math.abs(r[a] - r[b]),
        pairTotal: r[a] + r[b],
      }))
      .filter(r => r.pairTotal > 0)
      .sort((x, y) => y.absGap - x.absGap);
  }, [rows, a, b]);

  const maxAbs = Math.max(1, ...sortedByGap.map(r => r.absGap));

  const pairs: DuelPair[] = [["admk","dmk"], ["dmk","tvk"], ["admk","tvk"]];

  // Headline stats
  const aWins = sortedByGap.filter(r => r.gap > 0).length;
  const bWins = sortedByGap.filter(r => r.gap < 0).length;
  const biggestForA = sortedByGap.find(r => r.gap > 0);
  const biggestForB = sortedByGap.find(r => r.gap < 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Pair picker */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: gray, marginRight: 2 }}>
          Duel
        </span>
        {pairs.map(p => {
          const active = p[0] === pair[0] && p[1] === pair[1];
          const la = PARTY_META[p[0]];
          const lb = PARTY_META[p[1]];
          return (
            <button key={p.join()} onClick={() => setPair(p)} style={{
              padding: "6px 12px", borderRadius: 4, cursor: "pointer",
              background: active ? dark : "transparent",
              color: active ? "#fff" : dark,
              border: `1px solid ${active ? dark : border}`,
              fontFamily: sans, fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: la.color }} />
              {la.label} vs {lb.label}
              <span style={{ width: 8, height: 8, borderRadius: 2, background: lb.color }} />
            </button>
          );
        })}
      </div>

      {/* Headline */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
        border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden",
      }}>
        <div style={{ padding: "18px 22px", borderRight: `1px solid ${border}`, background: metaA.color + "0c" }}>
          <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: metaA.color, marginBottom: 6 }}>
            {metaA.label} leads in
          </div>
          <div style={{ fontFamily: serif, fontSize: 34, color: metaA.color, fontWeight: 500, lineHeight: 1 }}>
            {aWins}<span style={{ fontSize: 16, color: gray, fontWeight: 400 }}> / {rows.length} themes</span>
          </div>
          {biggestForA && (
            <div style={{ fontFamily: serif, fontSize: 13, color: "#2e2e2e", lineHeight: 1.5, marginTop: 8 }}>
              Biggest gap: <strong>{biggestForA.name}</strong> — {biggestForA[a]} vs {biggestForA[b]}.
            </div>
          )}
        </div>
        <div style={{ padding: "18px 22px", background: metaB.color + "0c" }}>
          <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: metaB.color, marginBottom: 6 }}>
            {metaB.label} leads in
          </div>
          <div style={{ fontFamily: serif, fontSize: 34, color: metaB.color, fontWeight: 500, lineHeight: 1 }}>
            {bWins}<span style={{ fontSize: 16, color: gray, fontWeight: 400 }}> / {rows.length} themes</span>
          </div>
          {biggestForB && (
            <div style={{ fontFamily: serif, fontSize: 13, color: "#2e2e2e", lineHeight: 1.5, marginTop: 8 }}>
              Biggest gap: <strong>{biggestForB.name}</strong> — {biggestForB[b]} vs {biggestForB[a]}.
            </div>
          )}
        </div>
      </div>

      {/* Diverging bars: left = A advantage, right = B advantage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 1fr", columnGap: 12, rowGap: 4, alignItems: "center" }}>
        <div style={{ textAlign: "right" as const, fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: metaA.color }}>
          {metaA.label} advantage →
        </div>
        <div />
        <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: metaB.color }}>
          ← {metaB.label} advantage
        </div>

        {sortedByGap.map(r => {
          const aVal = r[a];
          const bVal = r[b];
          const aPct = (aVal / maxAbs) * 100;
          const bPct = (bVal / maxAbs) * 100;
          return (
            <React.Fragment key={r.name}>
              {/* Left bar (A) */}
              <div style={{ display: "flex", justifyContent: "flex-end", height: 18 }}>
                <div style={{ width: `${Math.min(100, (r.gap > 0 ? aPct : 0))}%`, height: "100%",
                  background: metaA.color, borderRadius: "3px 0 0 3px",
                  opacity: r.gap > 0 ? 1 : 0.25,
                  minWidth: aVal > 0 ? 4 : 0,
                  display: "flex", alignItems: "center", justifyContent: "flex-start",
                  paddingLeft: 6, color: "#fff", fontFamily: mono, fontSize: 10, fontWeight: 700,
                }}>
                  {aVal > 0 && aPct > 12 ? aVal : ""}
                </div>
              </div>
              {/* Theme label */}
              <div style={{
                textAlign: "center" as const, fontFamily: sans, fontSize: 12, fontWeight: 500, color: dark,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                <span style={{ color: gray, display: "flex" }}>{topicIcons[r.name]}</span>
                {r.name}
              </div>
              {/* Right bar (B) */}
              <div style={{ display: "flex", justifyContent: "flex-start", height: 18 }}>
                <div style={{ width: `${Math.min(100, (r.gap < 0 ? bPct : 0))}%`, height: "100%",
                  background: metaB.color, borderRadius: "0 3px 3px 0",
                  opacity: r.gap < 0 ? 1 : 0.25,
                  minWidth: bVal > 0 ? 4 : 0,
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  paddingRight: 6, color: "#fff", fontFamily: mono, fontSize: 10, fontWeight: 700,
                }}>
                  {bVal > 0 && bPct > 12 ? bVal : ""}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <p style={{ fontFamily: serif, fontSize: 12, color: gray, fontStyle: "italic", margin: 0 }}>
        Bar length = promise count for each party. Faded bars show the losing side of each duel so you see both numbers at once.
      </p>
    </div>
  );
}

// ── Treemap ─────────────────────────────────────────────────────────────────

const PARTY_COLORS = { admk: admkColor, dmk: dmkColor, tvk: tvkColor };

interface TreemapContentProps {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; admk?: number; dmk?: number; tvk?: number;
  depth?: number; index?: number;
}

function TreemapContent(props: TreemapContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", admk = 0, dmk = 0, tvk = 0 } = props;
  const total = admk + dmk + tvk;
  if (width < 10 || height < 10) return null;
  const parties: Array<{ key: PartyKey; val: number }> = [
    { key: "admk", val: admk },
    { key: "dmk",  val: dmk  },
    { key: "tvk",  val: tvk  },
  ];
  let cx = x;
  return (
    <g>
      {parties.map(({ key, val }) => {
        const w = total > 0 ? (val / total) * width : 0;
        const rect = <rect key={key} x={cx} y={y} width={w} height={height} fill={PARTY_COLORS[key]} opacity={0.85} />;
        cx += w;
        return rect;
      })}
      <rect x={x} y={y} width={width} height={height} fill="none" stroke="#fff" strokeWidth={2} />
      {height > 28 && width > 50 && (
        <text x={x + 8} y={y + 16} fill="#fff" fontSize={11} fontFamily={sans} fontWeight={700} style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
          {name}
        </text>
      )}
      {height > 44 && width > 50 && (
        <text x={x + 8} y={y + 30} fill="rgba(255,255,255,0.85)" fontSize={10} fontFamily={mono}>
          {total}
        </text>
      )}
    </g>
  );
}

function TreemapView({ rows }: { rows: ThemeRow[] }) {
  const data = rows.map(r => ({ name: r.name, admk: r.admk, dmk: r.dmk, tvk: r.tvk, size: r.total }));
  return (
    <div>
      <div style={{ height: 480 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" aspectRatio={4 / 3} content={<TreemapContent />}>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { name: string; admk: number; dmk: number; tvk: number };
              return (
                <div style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 4, padding: "8px 12px", fontFamily: sans, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{d.name}</div>
                  <div style={{ color: admkColor }}>ADMK: {d.admk}</div>
                  <div style={{ color: dmkColor }}>DMK: {d.dmk}</div>
                  <div style={{ color: tvkColor }}>TVK: {d.tvk}</div>
                </div>
              );
            }} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        {(["admk","dmk","tvk"] as const).map(k => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: PARTY_META[k].color }} />
            <span style={{ fontFamily: sans, fontSize: 12, color: gray }}>{PARTY_META[k].label} share</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main CompareGrid ────────────────────────────────────────────────────────

const VIEW_MODES: { key: ViewMode; label: string; desc: string }[] = [
  { key: "verdicts",   label: "Verdicts",       desc: "One-line verdict per theme — who owns what" },
  { key: "priorities", label: "Party Priorities", desc: "What each party actually cares about most" },
  { key: "duels",      label: "Head-to-Head",   desc: "Pick two parties, see biggest gaps" },
  { key: "treemap",    label: "Treemap",        desc: "Area = promise count, colour split by party" },
];

export function CompareGrid() {
  const [viewMode, setViewMode] = useState<ViewMode>("verdicts");
  const rows = useMemo(buildThemeRows, []);

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ paddingTop: 48, paddingBottom: 20 }}>
        <h2 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, color: dark, margin: 0, lineHeight: 1.2 }}>
          Who promises what?
        </h2>
        <p style={{ fontFamily: serif, fontSize: 16, lineHeight: "30px", color: "#2e2e2e", marginTop: 4, marginBottom: 0 }}>
          {(TOTALS.admk + TOTALS.dmk + TOTALS.tvk).toLocaleString()} promises across 12 policy themes —
          sorted four ways to tell different stories about ADMK, DMK and TVK.
        </p>
      </div>

      {/* View mode switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" as const }}>
        {VIEW_MODES.map(v => (
          <button key={v.key} onClick={() => setViewMode(v.key)} style={{
            fontFamily: sans, fontSize: 12, fontWeight: 500, padding: "8px 16px",
            borderRadius: 4, cursor: "pointer",
            background: viewMode === v.key ? dark : "transparent",
            color: viewMode === v.key ? "#fff" : dark,
            borderWidth: 1, borderStyle: "solid",
            borderColor: viewMode === v.key ? dark : border,
          }}>{v.label}</button>
        ))}
        <span style={{ alignSelf: "center", fontFamily: serif, fontSize: 13, color: gray, fontStyle: "italic", marginLeft: 8 }}>
          {VIEW_MODES.find(v => v.key === viewMode)?.desc}
        </span>
      </div>

      {viewMode === "verdicts"   && <VerdictsView rows={rows} />}
      {viewMode === "priorities" && <PrioritiesView rows={rows} />}
      {viewMode === "duels"      && <DuelsView rows={rows} />}
      {viewMode === "treemap"    && <TreemapView rows={rows} />}
    </div>
  );
}
