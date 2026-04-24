import React, { useMemo, useState, useEffect, useRef } from "react";
import { allPoints, TOTALS, sampleSizes, type ManifestoPoint } from "../manifestoData";

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

type PartyKey = "admk" | "dmk" | "tvk";

const PARTIES: { key: PartyKey; label: string; color: string }[] = [
  { key: "admk", label: "ADMK", color: admkColor },
  { key: "dmk",  label: "DMK",  color: dmkColor  },
  { key: "tvk",  label: "TVK",  color: tvkColor  },
];

interface Group {
  key: string;
  label: string;
  match: (p: ManifestoPoint) => boolean;
}

const GROUPS: Group[] = [
  { key: "women",   label: "Women",          match: p => p.gender.includes("women") },
  { key: "youth",   label: "Youth",          match: p => p.ageGroup.includes("youth") || p.primaryTheme === "youth" },
  { key: "farmers", label: "Farmers / Agri", match: p => p.sector.some(s => /agri/i.test(s)) || p.primaryTheme === "agriculture" },
  { key: "sc_st",   label: "SC / ST",        match: p => p.communityCategory.some(c => c === "SC" || c === "ST") },
  { key: "elderly", label: "Elderly (60+)",  match: p => p.ageGroup.includes("elderly") },
  { key: "obc",     label: "OBC / MBC",      match: p => p.communityCategory.some(c => c === "OBC" || c === "MBC") },
  { key: "rural",   label: "Rural",          match: p => p.urbanRural === "rural" },
  { key: "urban",   label: "Urban",          match: p => p.urbanRural === "urban" },
];

function scaleCount(sample: number, party: PartyKey): number {
  const ss = sampleSizes[party];
  if (ss === 0) return 0;
  return Math.round((sample / ss) * TOTALS[party]);
}

interface GroupStats {
  group: Group;
  counts: Record<PartyKey, { raw: number; scaled: number; share: number; pts: ManifestoPoint[] }>;
  totalScaled: number;
  leader: PartyKey | null;
  leaderMargin: number; // leader scaled minus 2nd place scaled
  shareLeader: PartyKey | null; // leader by share%
}

function buildStats(): GroupStats[] {
  return GROUPS.map(group => {
    const counts: GroupStats["counts"] = {
      admk: { raw: 0, scaled: 0, share: 0, pts: [] },
      dmk:  { raw: 0, scaled: 0, share: 0, pts: [] },
      tvk:  { raw: 0, scaled: 0, share: 0, pts: [] },
    };
    for (const p of allPoints) {
      if (!group.match(p)) continue;
      counts[p.party].raw++;
      counts[p.party].pts.push(p);
    }
    for (const k of ["admk","dmk","tvk"] as const) {
      counts[k].scaled = scaleCount(counts[k].raw, k);
      counts[k].share  = TOTALS[k] > 0 ? (counts[k].scaled / TOTALS[k]) * 100 : 0;
    }
    const sorted = (["admk","dmk","tvk"] as const)
      .map(k => ({ k, v: counts[k].scaled }))
      .sort((a, b) => b.v - a.v);
    const leader = sorted[0].v > 0 ? sorted[0].k : null;
    const leaderMargin = sorted[0].v - sorted[1].v;
    const sortedShare = (["admk","dmk","tvk"] as const)
      .map(k => ({ k, v: counts[k].share }))
      .sort((a, b) => b.v - a.v);
    const shareLeader = sortedShare[0].v > 0 ? sortedShare[0].k : null;
    const totalScaled = counts.admk.scaled + counts.dmk.scaled + counts.tvk.scaled;
    return { group, counts, totalScaled, leader, leaderMargin, shareLeader };
  });
}

export function DemographyExplorer() {
  const mode = "share" as const;
  const [drill, setDrill] = useState<{ group: string; party: PartyKey } | null>(null);
  const stats = useMemo(buildStats, []);

  const drillStat = drill ? stats.find(s => s.group.key === drill.group) : null;
  const drillPts  = drillStat && drill ? drillStat.counts[drill.party].pts : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Help text */}
      <div style={{
        display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 14,
        padding: "14px 0", borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`,
      }}>
        <span style={{ fontFamily: serif, fontSize: 14, color: "#2e2e2e", fontStyle: "italic", lineHeight: 1.45, flex: 1, minWidth: 280 }}>
          % of each party's manifesto devoted to this group — tells you who cared most.
        </span>
        <span style={{ fontFamily: sans, fontSize: 11, color: gray, letterSpacing: "0.6px", textTransform: "uppercase" as const }}>
          Click any card to see the promises
        </span>
      </div>

      {/* Card grid */}
      <div className="mobile-grid-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {stats.map(stat => (
          <GroupCard
            key={stat.group.key}
            stat={stat}
            mode={mode}
            isDrilled={drill?.group === stat.group.key}
            drillParty={drill?.group === stat.group.key ? drill.party : null}
            onDrill={(party) => {
              if (drill?.group === stat.group.key && drill?.party === party) setDrill(null);
              else if (stat.counts[party].raw > 0) setDrill({ group: stat.group.key, party });
            }}
          />
        ))}
      </div>

      {/* Drill modal */}
      {drill && drillStat && (
        <DrillModal
          drill={drill}
          drillStat={drillStat}
          drillPts={drillPts}
          onClose={() => setDrill(null)}
        />
      )}

      {/* Footnote */}
      <p style={{ fontFamily: serif, fontSize: 13, color: gray, fontStyle: "italic", margin: 0 }}>
        Share percentages are derived from {allPoints.length} analysed promises across the three manifestos.
        Leader badge marks the party that devotes the highest % of its manifesto to each group.
      </p>
    </div>
  );
}

// ── Drill modal ─────────────────────────────────────────────────────────────

function DrillModal({ drill, drillStat, drillPts, onClose }: {
  drill: { group: string; party: PartyKey };
  drillStat: GroupStats;
  drillPts: ManifestoPoint[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const party = PARTIES.find(p => p.key === drill.party)!;

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.toLowerCase().trim();
  const visible = q
    ? drillPts.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        p.text.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        p.sectionTitle.toLowerCase().includes(q)
      )
    : drillPts;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(18,18,18,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 10,
          width: "100%", maxWidth: 680,
          maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 0",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: party.color, flexShrink: 0 }} />
              <span style={{
                fontFamily: sans, fontSize: 12, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase" as const, color: party.color,
              }}>{party.label}</span>
              <span style={{ fontFamily: serif, fontSize: 16, color: dark }}>
                promises targeting <strong>{drillStat.group.label}</strong>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>
                {visible.length} of {drillPts.length}
              </span>
              <button onClick={onClose} style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: sans, fontSize: 22, color: gray, lineHeight: 1, padding: 0,
              }}>×</button>
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            border: `1px solid ${query ? party.color : border}`,
            borderRadius: 6, padding: "8px 12px",
            background: "#faf9f6", marginBottom: 14,
            transition: "border-color 0.15s",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="5.7" cy="6.2" r="4.2" stroke={query ? party.color : gray} strokeWidth="1" />
              <line x1="8.85" y1="9.35" x2="12" y2="12.5" stroke={query ? party.color : gray} strokeWidth="1" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search promises…"
              style={{
                border: "none", outline: "none", background: "transparent", flex: 1,
                fontFamily: sans, fontSize: 13, color: dark,
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{
                background: "none", border: "none", cursor: "pointer",
                color: gray, fontSize: 16, lineHeight: 1, padding: 0,
              }}>×</button>
            )}
          </div>
        </div>

        {/* Promise list */}
        <div style={{ overflowY: "auto", padding: "0 24px 24px" }}>
          {visible.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" as const, fontFamily: serif, fontSize: 15, color: gray, fontStyle: "italic" }}>
              No promises match "{query}"
            </div>
          ) : (
            visible.map((p, i) => (
              <div key={i} style={{ padding: "14px 0", borderTop: `1px solid ${border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>#{p.pointNumber}</span>
                  {p.sectionTitle && (
                    <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>§ {p.sectionTitle}</span>
                  )}
                </div>
                <div style={{ fontFamily: serif, fontSize: 15, color: dark, lineHeight: 1.5, fontWeight: 500 }}>
                  {p.title || p.text}
                </div>
                {p.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginTop: 8 }}>
                    {p.tags.slice(0, 5).map(tag => (
                      <span key={tag} style={{
                        fontFamily: sans, fontSize: 10, fontWeight: 600,
                        padding: "2px 7px", borderRadius: 12,
                        background: party.color + "18", border: `1px solid ${party.color}40`,
                        color: party.color, letterSpacing: "0.04em",
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Group card ──────────────────────────────────────────────────────────────

function GroupCard({
  stat, mode, isDrilled, drillParty, onDrill,
}: {
  stat: GroupStats;
  mode: "reach" | "share";
  isDrilled: boolean;
  drillParty: PartyKey | null;
  onDrill: (p: PartyKey) => void;
}) {
  const leaderKey = mode === "reach" ? stat.leader : stat.shareLeader;
  const leader = leaderKey ? PARTIES.find(p => p.key === leaderKey)! : null;

  // Ordered: leader first, then others by value desc
  const ordered = (["admk","dmk","tvk"] as const)
    .map(k => ({ k, party: PARTIES.find(p => p.key === k)!, c: stat.counts[k] }))
    .sort((a, b) => {
      const va = mode === "reach" ? a.c.scaled : a.c.share;
      const vb = mode === "reach" ? b.c.scaled : b.c.share;
      return vb - va;
    });

  const maxVal = mode === "reach"
    ? Math.max(1, ...ordered.map(o => o.c.scaled))
    : Math.max(1, ...ordered.map(o => o.c.share));

  const verdict = buildVerdict(stat, mode);

  return (
    <div style={{
      border: `1px solid ${isDrilled ? dark : border}`,
      borderRadius: 8, padding: "18px 20px",
      background: isDrilled ? "#faf8f4" : "#fff",
      display: "flex", flexDirection: "column", gap: 14,
      transition: "border-color 0.15s, background 0.15s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: dark, lineHeight: 1.15 }}>
            {stat.group.label}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: gray, marginTop: 2 }}>
            {stat.totalScaled} promises total
          </div>
        </div>
        {leader && (
          <div style={{
            padding: "4px 10px", borderRadius: 12,
            background: leader.color + "18", border: `1px solid ${leader.color}55`,
            fontFamily: sans, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase" as const, color: leader.color,
            whiteSpace: "nowrap" as const,
          }}>◆ Priority: {leader.label}</div>
        )}
      </div>

      {/* Verdict sentence */}
      <div style={{
        fontFamily: serif, fontSize: 14, color: "#2e2e2e", lineHeight: 1.5,
        paddingLeft: 12, borderLeft: `3px solid ${leader ? leader.color : border}`,
      }}>
        {verdict}
      </div>

      {/* Bars — clickable */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ordered.map(({ k, party, c }) => {
          const val = mode === "reach" ? c.scaled : c.share;
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const display = mode === "reach" ? String(c.scaled) : `${c.share.toFixed(1)}%`;
          const isThisDrilled = drillParty === k;
          const interactive = c.raw > 0;
          const isLead = k === leaderKey;
          return (
            <button key={k} onClick={() => onDrill(k)} disabled={!interactive} style={{
              display: "grid", gridTemplateColumns: "44px 1fr 56px",
              alignItems: "center", gap: 10,
              background: "none", border: "none", padding: 0,
              cursor: interactive ? "pointer" : "default",
              opacity: interactive ? 1 : 0.4,
              textAlign: "left" as const,
            }}>
              <span style={{
                fontFamily: sans, fontSize: 11, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase" as const, color: party.color,
              }}>{party.label}</span>
              <div style={{
                height: 16,
                background: "#f0eeea", borderRadius: 7,
                overflow: "hidden", position: "relative" as const,
                outline: isThisDrilled ? `2px solid ${dark}` : "none",
              }}>
                <div style={{
                  width: `${Math.min(100, pct)}%`, height: "100%",
                  background: party.color, borderRadius: 7,
                  minWidth: val > 0 ? 6 : 0,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <span style={{
                fontFamily: mono, fontSize: 12,
                fontWeight: isLead ? 700 : 500,
                color: isLead ? party.color : dark,
                textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const,
              }}>{display}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Auto-generated verdict sentences ────────────────────────────────────────

function buildVerdict(stat: GroupStats, mode: "reach" | "share"): string {
  const label = stat.group.label;
  const ordered = (["admk","dmk","tvk"] as const)
    .map(k => ({ k, label: PARTIES.find(p => p.key === k)!.label, scaled: stat.counts[k].scaled, share: stat.counts[k].share }))
    .sort((a, b) => (mode === "reach" ? b.scaled - a.scaled : b.share - a.share));

  const top = ordered[0];
  const mid = ordered[1];
  const bot = ordered[2];

  if (top.scaled === 0) return `No party has made explicit ${label.toLowerCase()} promises.`;

  if (mode === "reach") {
    if (top.scaled > mid.scaled * 2 && mid.scaled > 0) {
      return `${top.label} dominates with ${top.scaled} promises — more than ${mid.label} (${mid.scaled}) and ${bot.label} (${bot.scaled}) combined.`;
    }
    if (mid.scaled === 0) {
      return `Only ${top.label} has made any ${label.toLowerCase()}-specific promises (${top.scaled}). The others have none.`;
    }
    if (top.scaled - mid.scaled <= Math.max(1, top.scaled * 0.15)) {
      return `${top.label} and ${mid.label} are nearly tied (${top.scaled} vs ${mid.scaled}). ${bot.label} trails at ${bot.scaled}.`;
    }
    return `${top.label} leads with ${top.scaled} promises, followed by ${mid.label} (${mid.scaled}) and ${bot.label} (${bot.scaled}).`;
  }

  // share mode
  if (top.share > mid.share * 1.5 && mid.share > 0) {
    return `${top.label} devotes ${top.share.toFixed(1)}% of its manifesto here — well above ${mid.label} (${mid.share.toFixed(1)}%) and ${bot.label} (${bot.share.toFixed(1)}%).`;
  }
  if (mid.share === 0) {
    return `Only ${top.label} gives meaningful space (${top.share.toFixed(1)}% of manifesto). Others are silent.`;
  }
  return `${top.label} spends ${top.share.toFixed(1)}% of its manifesto on ${label.toLowerCase()}, ${mid.label} ${mid.share.toFixed(1)}%, ${bot.label} ${bot.share.toFixed(1)}%.`;
}
