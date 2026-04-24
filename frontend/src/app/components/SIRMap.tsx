import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import kmlRaw from "../../../../data/assembly-constituency-map.kml?raw";
import sirData from "../../../../data/tn_sir_constituency_stats_2026.json";

const sans = '"Inter Tight", sans-serif';
const mono = '"IBM Plex Mono", monospace';
const dark = "#121212";
const gray = "#6b6b6b";
const border = "#d9d7d2";
const brown = "#a16749";

const MAP_WIDTH = 600;
const MAP_HEIGHT = 700;
const LON_MIN = 76.0;
const LON_MAX = 80.6;
const LAT_MIN = 7.8;
const LAT_MAX = 13.8;

function projectLon(lon: number) {
  return ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_WIDTH;
}
function projectLat(lat: number) {
  return MAP_HEIGHT - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_HEIGHT;
}

// ── Parse KML once ─────────────────────────────────────────────────────────

interface KmlConstituency {
  name: string;
  no: number;
  district: string;
  path: string;
  cx: number;
  cy: number;
}

function parseKml(raw: string): KmlConstituency[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "application/xml");
  const placemarks = Array.from(doc.querySelectorAll("Placemark"));
  const result: KmlConstituency[] = [];

  for (const pm of placemarks) {
    const name = pm.querySelector("name")?.textContent?.trim() ?? "";
    const noEl = pm.querySelector('Data[name="Constituency_No"] value');
    const distEl = pm.querySelector('Data[name="District"] value');
    const no = parseInt(noEl?.textContent ?? "0", 10);
    const district = distEl?.textContent?.trim() ?? "";

    const coordsEls = Array.from(pm.querySelectorAll("coordinates"));
    if (coordsEls.length === 0) continue;

    const subPaths: string[] = [];
    let sumX = 0, sumY = 0, totalPts = 0;

    for (const el of coordsEls) {
      const coordsText = el.textContent?.trim() ?? "";
      if (!coordsText) continue;
      const pts = coordsText.split(/\s+/).map((t) => {
        const [lon, lat] = t.split(",").map(Number);
        return [lon, lat] as [number, number];
      }).filter(([lon, lat]) => !isNaN(lon) && !isNaN(lat));
      if (pts.length < 3) continue;
      const segs = pts.map(([lon, lat], i) => {
        const x = projectLon(lon);
        const y = projectLat(lat);
        sumX += x; sumY += y; totalPts++;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      });
      subPaths.push(segs.join(" ") + " Z");
    }

    if (subPaths.length === 0 || totalPts === 0) continue;
    result.push({ name, no, district, path: subPaths.join(" "), cx: sumX / totalPts, cy: sumY / totalPts });
  }
  return result;
}

// ── Data ────────────────────────────────────────────────────────────────────

interface ConstituencyStats {
  ac_no: number;
  constituency: string;
  district: string;
  men: number;
  women: number;
  others: number;
  total: number;
}

const allConstituencies: ConstituencyStats[] = Object.values(
  (sirData as any).districts
).flatMap((d: any) => d.constituencies as ConstituencyStats[]);

const stateTotal = (sirData as any).statewide_totals.total as number;
const stateMen   = (sirData as any).statewide_totals.men as number;
const stateWomen = (sirData as any).statewide_totals.women as number;

const statsMap = new Map<string, ConstituencyStats>();
for (const c of allConstituencies) statsMap.set(c.constituency.toLowerCase(), c);

const statsByNo = new Map<number, ConstituencyStats>();
for (const c of allConstituencies) statsByNo.set(c.ac_no, c);

// Unique districts sorted
const allDistricts = Array.from(new Set(allConstituencies.map(c => c.district))).sort();

// ── Color scale ─────────────────────────────────────────────────────────────

function voterColor(val: number, maxVal: number, filter: "all" | "men" | "women"): string {
  if (val === 0) return "#f5f3ee";
  const t = Math.min(val / Math.max(maxVal, 1), 1);
  const intensity = 0.25 + t * 0.75;
  let lR: number, lG: number, lB: number, bR: number, bG: number, bB: number;
  if (filter === "men") {
    lR = 224; lG = 238; lB = 255; bR = 125; bG = 179; bB = 232;
  } else if (filter === "women") {
    lR = 255; lG = 228; lB = 235; bR = 232; bG = 125; bB = 155;
  } else {
    lR = 244; lG = 236; lB = 232; bR = 161; bG = 103; bB = 73;
  }
  return `rgb(${Math.round(lR + (bR - lR) * intensity)},${Math.round(lG + (bG - lG) * intensity)},${Math.round(lB + (bB - lB) * intensity)})`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const kmlConstituencies = parseKml(kmlRaw);

function fmt(n: number) { return n.toLocaleString("en-IN"); }
function pct(n: number, d: number) {
  if (!d) return "—";
  return ((n / d) * 100).toFixed(2) + "%";
}
function pctNum(n: number, d: number) {
  if (!d) return 0;
  return (n / d) * 100;
}

type GenderFilter = "all" | "men" | "women";

// ── Component ────────────────────────────────────────────────────────────────

export function SIRMap() {
  const [filter, setFilter]       = useState<GenderFilter>("all");
  const [hovered, setHovered]     = useState<string | null>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Click outside map deselects
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (mapContainerRef.current && !mapContainerRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const getVal = useCallback((stats: ConstituencyStats): number => {
    if (filter === "men") return stats.men;
    if (filter === "women") return stats.women;
    return stats.total;
  }, [filter]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const c of allConstituencies) { const v = getVal(c); if (v > m) m = v; }
    return m;
  }, [getVal]);

  const stateVal = filter === "men" ? stateMen : filter === "women" ? stateWomen : stateTotal;

  // Search + district filter applied to list
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allConstituencies.filter(c => {
      const matchSearch = !q || c.constituency.toLowerCase().includes(q) || c.district.toLowerCase().includes(q) || String(c.ac_no).includes(q);
      const matchDistrict = !districtFilter || c.district === districtFilter;
      return matchSearch && matchDistrict;
    }).sort((a, b) => getVal(b) - getVal(a));
  }, [search, districtFilter, getVal]);

  // Set of highlighted ac_nos for the map when searching
  const highlightedNos = useMemo(() => {
    if (!search.trim() && !districtFilter) return null;
    return new Set(filteredList.map(c => c.ac_no));
  }, [filteredList, search, districtFilter]);

  const hoveredStats = useMemo(() => hovered ? (statsMap.get(hovered.toLowerCase()) ?? null) : null, [hovered]);
  const selectedStats = useMemo(() => selected ? (statsMap.get(selected.toLowerCase()) ?? null) : null, [selected]);

  // District-level aggregates for selected district filter
  const districtAgg = useMemo(() => {
    if (!districtFilter) return null;
    const cs = allConstituencies.filter(c => c.district === districtFilter);
    return {
      total: cs.reduce((s, c) => s + c.total, 0),
      men:   cs.reduce((s, c) => s + c.men,   0),
      women: cs.reduce((s, c) => s + c.women, 0),
      count: cs.length,
    };
  }, [districtFilter]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const accentCol = filter === "men" ? "#7DB3E8" : filter === "women" ? "#E87D9B" : brown;

  return (
    <div style={{ padding: "32px 0 80px", fontFamily: sans }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: sans, fontSize: 20, fontWeight: 700, color: dark, margin: "0 0 4px" }}>
          Voter Distribution — SIR 2026
        </h2>
        <p style={{ fontFamily: mono, fontSize: 11, color: gray, margin: 0 }}>
          Special Intensive Revision · Final Electoral Rolls · 2026-02-23 · 234 constituencies · {fmt(stateTotal)} total electors
        </p>
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Gender pills */}
        {(["all", "men", "women"] as const).map((f) => {
          const active = filter === f;
          const col = f === "men" ? "#7DB3E8" : f === "women" ? "#E87D9B" : brown;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 16px", borderRadius: 20,
              border: `1.5px solid ${active ? col : border}`,
              background: active ? col + "18" : "#faf9f6",
              color: active ? col : gray,
              fontFamily: sans, fontSize: 12, fontWeight: active ? 700 : 500,
              letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s",
            }}>
              {f === "all" ? "All Voters" : f === "men" ? "Men" : "Women"}
            </button>
          );
        })}

        {/* Search box */}
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 140 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke={gray} strokeWidth="1.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke={gray} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search constituency, district…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "7px 10px 7px 30px",
              border: `1.5px solid ${search ? accentCol : border}`,
              borderRadius: 20, background: "#faf9f6",
              fontFamily: mono, fontSize: 11, color: dark,
              outline: "none", transition: "border-color 0.15s",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: gray, fontSize: 14, lineHeight: 1, padding: 0,
            }}>×</button>
          )}
        </div>

        {/* District dropdown */}
        <select
          value={districtFilter ?? ""}
          onChange={e => setDistrictFilter(e.target.value || null)}
          style={{
            padding: "7px 12px", borderRadius: 20,
            border: `1.5px solid ${districtFilter ? accentCol : border}`,
            background: "#faf9f6", fontFamily: mono, fontSize: 11, color: districtFilter ? dark : gray,
            cursor: "pointer", outline: "none", flex: "0 0 auto",
          }}
        >
          <option value="">All Districts</option>
          {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Result count */}
        {(search || districtFilter) && (
          <span style={{ fontFamily: mono, fontSize: 10, color: gray, whiteSpace: "nowrap" }}>
            {filteredList.length} of 234
          </span>
        )}
      </div>

      {/* ── District aggregate banner (when district filter active) ── */}
      {districtAgg && districtFilter && (
        <div style={{
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          background: accentCol + "0f", border: `1px solid ${accentCol}40`,
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
        }}>
          <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: dark }}>{districtFilter}</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: gray }}>{districtAgg.count} constituencies</span>
          <span style={{ fontFamily: mono, fontSize: 12, color: "#7DB3E8" }}>♂ {fmt(districtAgg.men)}</span>
          <span style={{ fontFamily: mono, fontSize: 12, color: "#E87D9B" }}>♀ {fmt(districtAgg.women)}</span>
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: dark }}>∑ {fmt(districtAgg.total)}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: brown }}>{pct(districtAgg.total, stateTotal)} of TN</span>
          <button onClick={() => setDistrictFilter(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: gray, fontSize: 14 }}>× clear</button>
        </div>
      )}

      {/* ── Main layout: map + panel ── */}
      <div className="sir-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* SVG Map */}
        <div
          ref={mapContainerRef}
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
              // Render the selected constituency last so the zoomed-in shape
              // draws above its neighbours and isn't clipped.
              const ordered = [...kmlConstituencies].sort((a, b) => {
                const rank = (n: string) => (n === selected ? 1 : 0);
                return rank(a.name) - rank(b.name);
              });
              return ordered.map((c) => {
                const stats = statsByNo.get(c.no) ?? statsMap.get(c.name.toLowerCase());
                const val = stats ? getVal(stats) : 0;
                const isHov = hovered === c.name;
                const isSel = selected === c.name;
                const isDimmed = highlightedNos !== null && !highlightedNos.has(c.no);
                const fill = isDimmed ? "#ede9e3" : voterColor(val, maxVal, filter);
                // Only the *selected* (clicked) constituency zooms.  We wrap
                // the path in a <g> and use CSS transform with an explicit
                // pixel transform-origin in the SVG viewBox coordinate system.
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
                      opacity={isDimmed ? 0.45 : 1}
                      style={{
                        cursor: "pointer",
                        transition: "stroke 0.12s, stroke-width 0.12s, opacity 0.2s",
                      }}
                      onMouseEnter={() => setHovered(c.name)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setSelected(selected === c.name ? null : c.name)}
                    />
                  </g>
                );
              });
            })()}
          </svg>

          {/* Hover tooltip */}
          {hoveredStats && hovered && (
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
              minWidth: 190,
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              backdropFilter: "blur(6px)",
            }}>
              <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                {hovered}
                <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.55)", fontSize: 10, marginLeft: 6 }}>AC #{hoveredStats.ac_no}</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{hoveredStats.district}</div>
              {/* Mini gender bar */}
              <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ background: "#7DB3E8", width: pct(hoveredStats.men, hoveredStats.total) }} />
                <div style={{ background: "#E87D9B", flex: 1 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 10 }}>
                <span style={{ color: "#afd4f5" }}>♂ {fmt(hoveredStats.men)}</span>
                <span style={{ color: "#f5b8cc" }}>♀ {fmt(hoveredStats.women)}</span>
              </div>
              <div style={{ marginTop: 4, fontFamily: mono, fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "center" }}>
                {fmt(hoveredStats.total)}
                <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.45)", fontSize: 9, marginLeft: 4 }}>total</span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>Fewer</span>
            <div style={{
              height: 6, flex: 1, borderRadius: 3,
              background: filter === "men"
                ? "linear-gradient(to right, #E0EEFF, #7DB3E8)"
                : filter === "women"
                ? "linear-gradient(to right, #FFE4EC, #E87D9B)"
                : "linear-gradient(to right, #F4ECE8, #A16749)",
            }} />
            <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>More</span>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div style={{ flex: "1 1 300px", minWidth: 260, maxWidth: 480 }}>

          {/* Selected constituency — innovative detail card */}
          {selectedStats ? (
            <div style={{
              background: "#faf9f6",
              border: `1.5px solid ${dark}`,
              borderRadius: 10,
              padding: "18px 20px",
              marginBottom: 16,
            }}>
              {/* Title row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 16, color: dark }}>{selectedStats.constituency}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginTop: 2 }}>
                    {selectedStats.district} · AC #{selectedStats.ac_no}
                  </div>
                </div>
                <span style={{
                  fontFamily: mono, fontSize: 18, fontWeight: 700, color: dark,
                  textAlign: "right", lineHeight: 1.1,
                }}>
                  {fmt(selectedStats.total)}
                  <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 400, color: brown, marginTop: 1 }}>
                    {pct(selectedStats.total, stateTotal)} of TN
                  </div>
                </span>
              </div>

              {/* Stacked gender bar — full width */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden" }}>
                  <div
                    style={{ background: "#7DB3E8", width: `${pctNum(selectedStats.men, selectedStats.total)}%`, transition: "width 0.4s ease" }}
                    title={`Men: ${pct(selectedStats.men, selectedStats.total)}`}
                  />
                  <div
                    style={{ background: "#E87D9B", flex: 1 }}
                    title={`Women: ${pct(selectedStats.women, selectedStats.total)}`}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#7DB3E8" }}>
                    ♂ {fmt(selectedStats.men)} · {pct(selectedStats.men, selectedStats.total)}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#E87D9B" }}>
                    {pct(selectedStats.women, selectedStats.total)} · {fmt(selectedStats.women)} ♀
                  </span>
                </div>
              </div>

              {/* Stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "vs state avg", val: (() => { const avg = stateTotal / 234; const diff = selectedStats.total - avg; return (diff >= 0 ? "+" : "") + fmt(Math.round(diff)); })(), sub: "voters above avg", col: selectedStats.total >= stateTotal/234 ? "#16a34a" : "#dc2626" },
                  { label: "rank", val: (() => { const sorted = [...allConstituencies].sort((a,b) => b.total - a.total); return "#" + (sorted.findIndex(c => c.ac_no === selectedStats.ac_no) + 1); })(), sub: "by total voters", col: dark },
                  { label: "gender gap", val: (() => { const diff = Math.abs(selectedStats.men - selectedStats.women); return fmt(diff); })(), sub: selectedStats.men > selectedStats.women ? "more men" : "more women", col: selectedStats.men > selectedStats.women ? "#7DB3E8" : "#E87D9B" },
                  { label: "others", val: fmt(selectedStats.others || 0), sub: `${pct(selectedStats.others || 0, selectedStats.total)} of total`, col: gray },
                ].map(({ label, val, sub, col }) => (
                  <div key={label} style={{
                    background: "#fff", borderRadius: 6, padding: "10px 12px",
                    border: `1px solid ${border}`,
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 10, color: gray, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                    <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: col }}>{val}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: gray, marginTop: 1 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Tap outside hint */}
              <div style={{ marginTop: 10, fontFamily: mono, fontSize: 9, color: gray, textAlign: "center", opacity: 0.7 }}>
                click outside map to deselect
              </div>
            </div>
          ) : (
            /* State-level summary when nothing selected */
            <div style={{
              background: "#faf9f6", border: `1px solid ${border}`,
              borderRadius: 10, padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, color: dark, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Tamil Nadu — SIR 2026
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ background: "#7DB3E8", width: `${pctNum(stateMen, stateTotal)}%` }} />
                <div style={{ background: "#E87D9B", flex: 1 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: "#7DB3E8" }}>♂ {fmt(stateMen)} · {pct(stateMen, stateTotal)}</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: "#E87D9B" }}>{pct(stateWomen, stateTotal)} · {fmt(stateWomen)} ♀</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                {[
                  { label: "Total", val: fmt(stateTotal), col: dark },
                  { label: "Men", val: fmt(stateMen), col: "#7DB3E8" },
                  { label: "Women", val: fmt(stateWomen), col: "#E87D9B" },
                ].map(({ label, val, col }) => (
                  <div key={label}>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: col }}>{val}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: gray, marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontFamily: mono, fontSize: 9, color: gray, textAlign: "center" }}>
                Click a constituency on the map to explore
              </div>
            </div>
          )}

          {/* ── Constituency list ── */}
          <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
            {/* List header */}
            <div style={{
              padding: "8px 14px", borderBottom: `1px solid ${border}`,
              background: "#faf9f6", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: dark, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {districtFilter ? districtFilter : "All Constituencies"}
              </span>
              <span style={{ fontFamily: mono, fontSize: 9, color: gray }}>
                {filteredList.length} · ranked by {filter === "all" ? "total" : filter} ↓
              </span>
            </div>

            <div style={{ overflowY: "auto", maxHeight: selectedStats ? 360 : 520 }}>
              {filteredList.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", fontFamily: mono, fontSize: 11, color: gray }}>
                  No results for "{search}"
                </div>
              ) : filteredList.map((c, i) => {
                const val = getVal(c);
                const isSel = selected === c.constituency;
                const barPct = (val / maxVal) * 100;
                const col = filter === "men" ? "#7DB3E8" : filter === "women" ? "#E87D9B" : brown;
                return (
                  <div
                    key={c.ac_no}
                    onClick={() => setSelected(isSel ? null : c.constituency)}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "6px 14px", gap: 8,
                      borderBottom: `1px solid ${border}`,
                      background: isSel ? col + "14" : "transparent",
                      cursor: "pointer", transition: "background 0.1s",
                    }}
                  >
                    <span style={{ fontFamily: mono, fontSize: 9, color: gray, width: 20, flexShrink: 0, textAlign: "right" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{
                          fontFamily: sans, fontSize: 11, fontWeight: isSel ? 700 : 500, color: dark,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "54%",
                        }}>
                          {c.constituency}
                        </span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: dark, flexShrink: 0 }}>
                          {fmt(val)}
                          <span style={{ color: gray, marginLeft: 3, fontSize: 9 }}>({pct(val, stateVal)})</span>
                        </span>
                      </div>
                      <div style={{ height: 2, background: border, borderRadius: 1, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barPct}%`, background: col, borderRadius: 1 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
