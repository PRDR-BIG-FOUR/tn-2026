import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import geoData from "../tamilnadu.geo.json";
import {
  allPoints,
  PARTY_LABELS,
  TOTALS,
  type ManifestoPoint,
} from "../manifestoData";

// ── Design Tokens ──────────────────────────────────────────────────────────

const sans = '"Inter Tight", sans-serif';
const serif = '"Source Serif 4", serif';
const mono = '"IBM Plex Mono", monospace';
const dark = "#121212";
const gray = "#6b6b6b";
const border = "#d9d7d2";
const brown = "#a16749";

const PARTY_COLORS: Record<string, { base: string; light: string; dark: string }> = {
  ADMK: { base: "#547c5b", light: "#d4e8d4", dark: "#2f4a34" },
  DMK: { base: "#c94d48", light: "#f5d4d2", dark: "#7a2624" },
  TVK: { base: "#E5A000", light: "#fef0c7", dark: "#8a5e00" },
};

// ── Region-to-KML-District Mapper ──────────────────────────────────────────
// The enriched JSONs have region names like "Chennai", "Kancheepuram", etc.
// The KML has uppercased names like "CHENNAI", "KANCHIPURAM", "TUTICORIN".
// This mapper normalises all known variants to the exact KML Placemark name.

const REGION_TO_KML_DISTRICT: Record<string, string> = {
  // Direct district matches (lowercase → KML uppercase)
  ariyalur: "ARIYALUR",
  chengalpattu: "CHENGALPATTU",
  chennai: "CHENNAI",
  coimbatore: "COIMBATORE",
  cuddalore: "CUDDALORE",
  dharmapuri: "DHARMAPURI",
  dindigul: "DINDIGUL",
  erode: "ERODE",
  kallakurichi: "KALLAKKURICHI",
  kancheepuram: "KANCHIPURAM",
  kanchipuram: "KANCHIPURAM",
  kanyakumari: "KANYAKUMARI",
  karur: "KARUR",
  krishnagiri: "KRISHNAGIRI",
  madurai: "MADURAI",
  mayiladuthurai: "NAGAPATTINAM", // Mayiladuthurai carved from Nagapattinam
  nagapattinam: "NAGAPATTINAM",
  namakkal: "NAMAKKAL",
  nilgiris: "N|LGIRIS",
  "the nilgiris": "N|LGIRIS",
  perambalur: "PERAMBALUR",
  pudukkottai: "PUDUKKOTTAI",
  pudukottai: "PUDUKKOTTAI",
  ramanathapuram: "RAMANATHAPURAM",
  ranipet: "RANIPPETTAI",
  ranippettai: "RANIPPETTAI",
  salem: "SALEM",
  sivaganga: "SIVAGANGA",
  sivagangai: "SIVAGANGA",
  tenkasi: "TENKASI",
  thanjavur: "THANJAVUR",
  theni: "TENI",
  teni: "TENI",
  thiruvarur: "THIRUVARUR",
  tiruvarur: "THIRUVARUR",
  thoothukudi: "TUTICORIN",
  tuticorin: "TUTICORIN",
  tiruchirappalli: "TIRUCHIRAPALLI",
  tirunelveli: "TIRUNELVELI",
  tirupathur: "TIRUPPATTUR",
  tirupattur: "TIRUPPATTUR",
  tiruppattur: "TIRUPPATTUR",
  tiruppur: "TIRUPPUR",
  tiruvallur: "TIRUVALLUR",
  tiruvannamalai: "TIRUVANNAMALAI",
  vellore: "VELLORE",
  villupuram: "VILLUPURAM",
  viluppuram: "VILLUPURAM",
  virudhunagar: "VIRUDHUNAGAR",

  // City / town → parent district mapping
  avadi: "TIRUVALLUR",
  tambaram: "CHENGALPATTU",
  hosur: "KRISHNAGIRI",
  kumbakonam: "THANJAVUR",
  nagercoil: "KANYAKUMARI",
  sivakasi: "VIRUDHUNAGAR",
  sriperumbudur: "KANCHIPURAM",
  pollachi: "COIMBATORE",
  kodaikanal: "DINDIGUL",
  oddanchatram: "DINDIGUL",
  pattukkottai: "THANJAVUR",
  ambur: "TIRUPPATTUR",
  arakkonam: "RANIPPETTAI",
  udhagamandalam: "N|LGIRIS",
  yercaud: "SALEM",
  chidambaram: "CUDDALORE",
  karaikudi: "SIVAGANGA",
  kovilpatti: "VIRUDHUNAGAR",
  palani: "DINDIGUL",
  kangeyam: "TIRUPPUR",
  mannargudi: "THIRUVARUR",
  rameswaram: "RAMANATHAPURAM",
  dhanushkodi: "RAMANATHAPURAM",
  mandapam: "RAMANATHAPURAM",
  mahabalipuram: "CHENGALPATTU",
  oragadam: "KANCHIPURAM",
  siruseri: "CHENGALPATTU",
  maraimalainagar: "CHENGALPATTU",
  courtallam: "TENKASI",
  nagore: "NAGAPATTINAM",
  vedaranyam: "NAGAPATTINAM",
  velankanni: "NAGAPATTINAM",
  poompuhar: "NAGAPATTINAM",
  gangaikondacholapuram: "ARIYALUR",
  devakottai: "SIVAGANGA",
  kanadukathan: "SIVAGANGA",
  kaveripattinam: "KRISHNAGIRI",
  arani: "TIRUVANNAMALAI",
  azhagankulam: "RAMANATHAPURAM",
  adichanallur: "TIRUNELVELI",
  arikamedu: "CUDDALORE",
  keezhadi: "SIVAGANGA",
  kodumanal: "ERODE",
  mayiladumparai: "KRISHNAGIRI",
  saluvankuppam: "CHENGALPATTU",
  sivakalai: "TIRUNELVELI",
  "vallam-vadakal": "THANJAVUR",

  // AIADMK-specific cities/towns
  mettur: "SALEM",
  neyveli: "CUDDALORE",
  anthiyur: "ERODE",
  aruppukottai: "VIRUDHUNAGAR",
  bhavani: "ERODE",
  ettayapuram: "VIRUDHUNAGAR",
  gudalur: "N|LGIRIS",
  kilambakkam: "CHENGALPATTU",
  vaiyampalayam: "COIMBATORE",
};

function regionToDistrict(regionName: string): string | null {
  const key = regionName.toLowerCase().trim();
  return REGION_TO_KML_DISTRICT[key] ?? null;
}

// ── Build promise counts per district per party ────────────────────────────

interface DistrictData {
  admk: number;
  dmk: number;
  tvk: number;
  total: number;
  promises: ManifestoPoint[];
}

interface StatewideData {
  admk: number;
  dmk: number;
  tvk: number;
  total: number;
  promises: ManifestoPoint[];
}

function buildDistrictMap(
  points: ManifestoPoint[],
  partyFilter: string | null
): { districts: Map<string, DistrictData>; statewide: StatewideData } {
  const map = new Map<string, DistrictData>();
  const statewide: StatewideData = { admk: 0, dmk: 0, tvk: 0, total: 0, promises: [] };

  // Initialise every KML district with zeros
  const kmlNames = (geoData as any).features.map(
    (f: any) => f.properties.name as string
  );
  for (const name of kmlNames) {
    map.set(name, { admk: 0, dmk: 0, tvk: 0, total: 0, promises: [] });
  }

  for (const pt of points) {
    if (partyFilter && pt.partyLabel !== partyFilter) continue;

    const geo = (pt as any).__rawGeo;
    if (!geo) continue;

    const regions: string[] = [];
    if (Array.isArray(geo.regions)) {
      for (const r of geo.regions) {
        const name = typeof r === "string" ? r : r?.name;
        if (name) regions.push(name);
      }
    }

    // Statewide classification — priority: if scope=statewide, ignore regions entirely
    // (The enriched JSONs have been cleaned so statewide entries have empty regions,
    //  but we keep this check as a safety net.)
    const scope = geo.scope ?? "";
    const isStatewide =
      scope === "statewide" ||
      regions.length === 0 ||
      (scope === "multi" && regions.length >= 20);

    if (isStatewide) {
      const partyKey = pt.party as "admk" | "dmk" | "tvk";
      statewide[partyKey]++;
      statewide.total++;
      statewide.promises.push(pt);
      continue;
    }

    // Map regions to districts, deduplicating to avoid counting a promise
    // multiple times when multiple regions resolve to the same district
    // (e.g. village:Vaiyampalayam + district:Coimbatore both → COIMBATORE)
    const mappedDistricts = new Set<string>();
    for (const regionName of regions) {
      const district = regionToDistrict(regionName);
      if (district) mappedDistricts.add(district);
    }

    for (const district of mappedDistricts) {
      const data = map.get(district);
      if (!data) continue;

      data[pt.party]++;
      data.total++;
      data.promises.push(pt);
    }
  }
  return { districts: map, statewide };
}

// ── Attach raw geography to each ManifestoPoint (one-time augmentation) ───

import admkRaw from "../../../../data/pipeline_2/aiadmk.enriched.json";
import dmkRaw from "../../../../data/pipeline_2/dmk.enriched.json";
import tvkRaw from "../../../../data/pipeline_2/tvk_en.enriched.json";

function augmentPointsWithGeo() {
  const raws = [
    { key: "admk" as const, doc: admkRaw },
    { key: "dmk" as const, doc: dmkRaw },
    { key: "tvk" as const, doc: tvkRaw },
  ];

  for (const { key, doc } of raws) {
    const raw = doc as any;
    // Match by array index — both allPoints (per-party) and raw.points
    // share the same ordering since parseDoc uses .map() on raw.points.
    // Using point_number is NOT safe because TVK has massive duplicates.
    const partyPoints = allPoints.filter((pt) => pt.party === key);
    for (let i = 0; i < partyPoints.length && i < raw.points.length; i++) {
      (partyPoints[i] as any).__rawGeo =
        raw.points[i].analysis?.beneficiary?.geography ?? {};
    }
  }
}

augmentPointsWithGeo();

// ── SVG Map Projection ─────────────────────────────────────────────────────
// Tamil Nadu approx bounds: lon 76.2–80.4, lat 8.0–13.6

const MAP_WIDTH = 600;
const MAP_HEIGHT = 700;
const LON_MIN = 76.0;
const LON_MAX = 80.6;
const LAT_MIN = 7.8;
const LAT_MAX = 13.8;

function projectLon(lon: number): number {
  return ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_WIDTH;
}
function projectLat(lat: number): number {
  return MAP_HEIGHT - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_HEIGHT;
}

function coordsToPath(coords: number[][]): string {
  return coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${projectLon(c[0]).toFixed(1)},${projectLat(c[1]).toFixed(1)}`)
    .join(" ") + " Z";
}

// Extract all outer rings from a feature (handles both Polygon and MultiPolygon)
function getAllRings(geometry: any): number[][][] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as number[][][];
  }
  if (geometry.type === "MultiPolygon") {
    // MultiPolygon: [ [ [ring1], [hole1] ], [ [ring2] ], ... ]
    // Take the first ring (outer boundary) from each polygon part
    return (geometry.coordinates as number[][][][]).map((poly) => poly[0]);
  }
  return [];
}

// Approximate polygon area for finding the main landmass
function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += (ring[i][0] - ring[i + 1][0]) * (ring[i][1] + ring[i + 1][1]);
  }
  return Math.abs(a / 2);
}

function getDistrictCenter(rings: number[][][]): [number, number] {
  // Use the largest ring (main landmass) for the label position
  const mainRing = rings.reduce((best, ring) =>
    ringArea(ring) > ringArea(best) ? ring : best
  , rings[0]);
  let sumLon = 0, sumLat = 0;
  for (const c of mainRing) {
    sumLon += c[0];
    sumLat += c[1];
  }
  return [
    projectLon(sumLon / mainRing.length),
    projectLat(sumLat / mainRing.length),
  ];
}

// ── Color scale ────────────────────────────────────────────────────────────

function getHeatColor(
  count: number,
  maxCount: number,
  partyFilter: string | null
): string {
  if (count === 0) return "#f5f3ee";
  const t = Math.min(count / Math.max(maxCount, 1), 1);
  const intensity = 0.35 + t * 0.65;

  if (!partyFilter) {
    // Brown gradient (#A16749) for combined view
    const lR = 244, lG = 236, lB = 232;
    const bR = 161, bG = 103, bB = 73;
    return `rgb(${Math.round(lR + (bR - lR) * intensity)},${Math.round(lG + (bG - lG) * intensity)},${Math.round(lB + (bB - lB) * intensity)})`;
  }

  const c = PARTY_COLORS[partyFilter];
  if (!c) return "#f5f3ee";

  // Interpolate from light to base colour
  const lR = parseInt(c.light.slice(1, 3), 16);
  const lG = parseInt(c.light.slice(3, 5), 16);
  const lB = parseInt(c.light.slice(5, 7), 16);
  const bR = parseInt(c.base.slice(1, 3), 16);
  const bG = parseInt(c.base.slice(3, 5), 16);
  const bB = parseInt(c.base.slice(5, 7), 16);
  return `rgb(${Math.round(lR + (bR - lR) * intensity)},${Math.round(lG + (bG - lG) * intensity)},${Math.round(lB + (bB - lB) * intensity)})`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function MapExplorer() {
  const [partyFilter, setPartyFilter] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [showStatewide, setShowStatewide] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const { districts: districtMap, statewide } = useMemo(
    () => buildDistrictMap(allPoints, partyFilter),
    [partyFilter]
  );

  const maxCount = useMemo(() => {
    let max = 0;
    for (const d of districtMap.values()) {
      const val = partyFilter
        ? d[partyFilter === "ADMK" ? "admk" : partyFilter === "DMK" ? "dmk" : "tvk"]
        : d.total;
      if (val > max) max = val;
    }
    return max;
  }, [districtMap, partyFilter]);

  const features = (geoData as any).features as Array<{
    properties: { name: string };
    geometry: { type: string; coordinates: any };
  }>;

  // Stats
  const totalRegionalPromises = useMemo(() => {
    let sum = 0;
    for (const d of districtMap.values()) {
      sum += partyFilter
        ? d[partyFilter === "ADMK" ? "admk" : partyFilter === "DMK" ? "dmk" : "tvk"]
        : d.total;
    }
    return sum;
  }, [districtMap, partyFilter]);

  const districtsWithPromises = useMemo(() => {
    let count = 0;
    for (const d of districtMap.values()) {
      const val = partyFilter
        ? d[partyFilter === "ADMK" ? "admk" : partyFilter === "DMK" ? "dmk" : "tvk"]
        : d.total;
      if (val > 0) count++;
    }
    return count;
  }, [districtMap, partyFilter]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setContainerSize({ w: rect.width, h: rect.height });
    }
  }, []);

  const getCount = useCallback(
    (data: DistrictData) => {
      if (!partyFilter) return data.total;
      return data[partyFilter === "ADMK" ? "admk" : partyFilter === "DMK" ? "dmk" : "tvk"];
    },
    [partyFilter]
  );

  const selectedData = selectedDistrict
    ? districtMap.get(selectedDistrict)
    : null;
  const hoveredData = hoveredDistrict
    ? districtMap.get(hoveredDistrict)
    : null;

  // Format district names nicely
  const formatDistrictName = (name: string) => {
    if (name === "N|LGIRIS") return "Nilgiris";
    return name
      .split(/[\s-]+/)
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
  };

  // Legend buckets
  const legendSteps = 5;
  const step = Math.ceil(maxCount / legendSteps);

  return (
    <section style={{ padding: "32px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontFamily: serif,
            fontSize: 34,
            fontWeight: 400,
            color: dark,
            margin: "0 0 6px",
            lineHeight: 1.2,
          }}
        >
          Promise Geography
        </h2>
        <p
          style={{
            fontFamily: serif,
            fontSize: 16,
            lineHeight: "28px",
            color: "#2e2e2e",
            marginTop: 4,
            marginBottom: 0,
            maxWidth: 640,
          }}
        >
          Where are the manifestos focused? Explore promises geographically — each
          district is shaded by the number of promises targeting it. Toggle between
          parties to see their regional priorities.
        </p>
      </div>

      {/* Party Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => {
            setPartyFilter(null);
            setSelectedDistrict(null);
          }}
          style={{
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 18px",
            borderRadius: 6,
            cursor: "pointer",
            background: !partyFilter ? dark : "transparent",
            color: !partyFilter ? "#fff" : dark,
            borderWidth: 1.5,
            borderStyle: "solid",
            borderColor: !partyFilter ? dark : border,
            transition: "all 0.2s ease",
            letterSpacing: "0.04em",
          }}
        >
          All Parties
        </button>
        {PARTY_LABELS.map((label) => {
          const active = partyFilter === label;
          const pc = PARTY_COLORS[label];
          return (
            <button
              key={label}
              onClick={() => {
                setPartyFilter(active ? null : label);
                setSelectedDistrict(null);
              }}
              style={{
                fontFamily: sans,
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 18px",
                borderRadius: 6,
                cursor: "pointer",
                background: active ? pc.base : "transparent",
                color: active ? "#fff" : pc.base,
                borderWidth: 1.5,
                borderStyle: "solid",
                borderColor: active ? pc.base : pc.base + "50",
                transition: "all 0.2s ease",
                letterSpacing: "0.04em",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: active ? "#fff" : pc.base,
                  marginRight: 6,
                }}
              />
              {label}
            </button>
          );
        })}

        <span
          style={{
            marginLeft: "auto",
            fontFamily: mono,
            fontSize: 12,
            color: gray,
          }}
        >
          {districtsWithPromises}/{features.length} districts &middot;{" "}
          {totalRegionalPromises.toLocaleString()} regional &middot;{" "}
          {statewide.total.toLocaleString()} statewide
        </span>
      </div>

      {/* Statewide summary card */}
      <div
        onClick={() => {
          setShowStatewide(!showStatewide);
          setSelectedDistrict(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          padding: "14px 20px",
          background: showStatewide
            ? "linear-gradient(135deg, #faf9f6 0%, #f0ede5 100%)"
            : "#faf9f6",
          borderRadius: 10,
          border: `1.5px solid ${showStatewide ? brown : border}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(135deg, #a16749 0%, #8b5536 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          🏛
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: sans,
              fontSize: 13,
              fontWeight: 700,
              color: dark,
              marginBottom: 2,
            }}
          >
            Statewide Promises
            <span
              style={{
                fontFamily: mono,
                fontSize: 12,
                color: brown,
                marginLeft: 8,
              }}
            >
              {statewide.total}
            </span>
          </div>
          <div
            style={{
              fontFamily: serif,
              fontSize: 12,
              color: gray,
              lineHeight: 1.3,
            }}
          >
            Promises that apply uniformly across Tamil Nadu — not counted in district totals
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {[
            { l: "ADMK", v: statewide.admk, c: PARTY_COLORS.ADMK.base },
            { l: "DMK", v: statewide.dmk, c: PARTY_COLORS.DMK.base },
            { l: "TVK", v: statewide.tvk, c: PARTY_COLORS.TVK.base },
          ].map((r) => (
            <div
              key={r.l}
              style={{
                textAlign: "center",
                minWidth: 36,
              }}
            >
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: r.c,
                }}
              >
                {r.v}
              </div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  color: gray,
                  letterSpacing: "0.05em",
                }}
              >
                {r.l}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: sans,
            fontSize: 14,
            color: gray,
            transform: showStatewide ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▾
        </div>
      </div>

      {/* Main content: Map + Detail panel */}
      <div className="mobile-map-container"
        style={{
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        {/* Map Container */}
        <div
          ref={mapRef}
          className="mobile-w-full"
          onMouseMove={handleMouseMove}
          style={{
            position: "relative",
            flex: "0 0 600px",
            background: "#faf9f6",
            borderRadius: 12,
            border: `1px solid ${border}`,
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          }}
        >
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            width="100%"
            height="auto"
            style={{ display: "block", maxWidth: MAP_WIDTH, margin: "0 auto" }}
          >
            {/* District polygons */}
            {features.map((feature) => {
              const name = feature.properties.name;
              const data = districtMap.get(name);
              const count = data ? getCount(data) : 0;
              const fillColor = getHeatColor(count, maxCount, partyFilter);
              const isHovered = hoveredDistrict === name;
              const isSelected = selectedDistrict === name;
              const rings = getAllRings(feature.geometry);
              const strokeColor = isSelected
                ? partyFilter
                  ? PARTY_COLORS[partyFilter]?.dark ?? dark
                  : dark
                : isHovered
                ? brown
                : "#c4c0b8";
              const sw = isSelected ? 2.5 : isHovered ? 1.8 : 0.8;

              return (
                <g key={name}>
                  {rings.map((ring, ri) => (
                    <path
                      key={ri}
                      d={coordsToPath(ring)}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={sw}
                      style={{
                        cursor: "pointer",
                        transition: "fill 0.3s ease, stroke-width 0.2s ease",
                        filter: isHovered ? "brightness(0.95)" : "none",
                      }}
                      onMouseEnter={() => setHoveredDistrict(name)}
                      onMouseLeave={() => setHoveredDistrict(null)}
                      onClick={() =>
                        setSelectedDistrict(
                          selectedDistrict === name ? null : name
                        )
                      }
                    />
                  ))}
                  {/* Count label on district (placed on largest ring) */}
                  {count > 0 && rings.length > 0 && (
                    <text
                      x={getDistrictCenter(rings)[0]}
                      y={getDistrictCenter(rings)[1]}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={count > maxCount * 0.5 ? "#fff" : dark}
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        fontWeight: 700,
                        pointerEvents: "none",
                        textShadow:
                          count > maxCount * 0.5
                            ? "0 1px 2px rgba(0,0,0,0.3)"
                            : "none",
                      }}
                    >
                      {count}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip — flips to the opposite side of the cursor when it
              would overflow the map container, so it's never clipped. */}
          {hoveredDistrict && hoveredData && (() => {
            const TOOLTIP_W = 220; // approx width (minWidth 160, maxWidth 240)
            const TOOLTIP_H = 130; // approx height incl. padding
            const EDGE_PAD = 8;
            const flipRight =
              tooltipPos.x + 12 + TOOLTIP_W > containerSize.w - EDGE_PAD;
            const flipBottom =
              tooltipPos.y + TOOLTIP_H > containerSize.h - EDGE_PAD;
            const positionStyle: React.CSSProperties = {
              left: flipRight ? undefined : tooltipPos.x + 12,
              right: flipRight ? Math.max(EDGE_PAD, containerSize.w - tooltipPos.x + 12) : undefined,
              top: flipBottom ? undefined : Math.max(EDGE_PAD, tooltipPos.y - 10),
              bottom: flipBottom ? Math.max(EDGE_PAD, containerSize.h - tooltipPos.y + 10) : undefined,
            };

            return (
            <div
              style={{
                position: "absolute",
                ...positionStyle,
                background: "rgba(18,18,18,0.92)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 8,
                fontFamily: sans,
                fontSize: 12,
                pointerEvents: "none",
                zIndex: 10,
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                minWidth: 160,
                maxWidth: 240,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 6,
                  letterSpacing: "0.02em",
                }}
              >
                {formatDistrictName(hoveredDistrict)}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "3px 12px",
                }}
              >
                {[
                  { label: "ADMK", val: hoveredData.admk, c: PARTY_COLORS.ADMK.base },
                  { label: "DMK", val: hoveredData.dmk, c: PARTY_COLORS.DMK.base },
                  { label: "TVK", val: hoveredData.tvk, c: PARTY_COLORS.TVK.base },
                ].map((r) => (
                  <React.Fragment key={r.label}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: r.c,
                        }}
                      />
                      {r.label}
                    </span>
                    <span style={{ fontFamily: mono, fontWeight: 600 }}>
                      {r.val}
                    </span>
                  </React.Fragment>
                ))}
                <span
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.2)",
                    paddingTop: 3,
                    fontWeight: 700,
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.2)",
                    paddingTop: 3,
                    fontFamily: mono,
                    fontWeight: 700,
                  }}
                >
                  {hoveredData.total}
                </span>
              </div>
            </div>
            );
          })()}

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${border}`,
              fontFamily: sans,
              fontSize: 10,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: gray,
                marginBottom: 6,
              }}
            >
              Promises
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {Array.from({ length: legendSteps }, (_, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 28,
                      height: 10,
                      background: getHeatColor(
                        step * (i + 1),
                        maxCount,
                        partyFilter
                      ),
                      borderRadius: i === 0 ? "3px 0 0 3px" : i === legendSteps - 1 ? "0 3px 3px 0" : 0,
                    }}
                  />
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 8,
                      color: gray,
                      marginTop: 2,
                    }}
                  >
                    {step * (i + 1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="mobile-map-details" style={{ flex: 1, minWidth: 0 }}>
          {showStatewide ? (
            <StatewideDetail
              data={statewide}
              partyFilter={partyFilter}
              onClose={() => setShowStatewide(false)}
            />
          ) : selectedDistrict && selectedData ? (
            <DistrictDetail
              name={selectedDistrict}
              data={selectedData}
              partyFilter={partyFilter}
              formatName={formatDistrictName}
              onClose={() => setSelectedDistrict(null)}
            />
          ) : (
            <DistrictRanking
              districtMap={districtMap}
              partyFilter={partyFilter}
              formatName={formatDistrictName}
              onSelect={(d) => {
                setSelectedDistrict(d);
                setShowStatewide(false);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ── Statewide Detail Panel ─────────────────────────────────────────────────

function StatewideDetail({
  data,
  partyFilter,
  onClose,
}: {
  data: StatewideData;
  partyFilter: string | null;
  onClose: () => void;
}) {
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});
  const toggleTheme = (theme: string) => setExpandedThemes(prev => ({ ...prev, [theme]: !prev[theme] }));

  const barMax = Math.max(data.admk, data.dmk, data.tvk, 1);

  const byTheme = useMemo(() => {
    const map = new Map<string, ManifestoPoint[]>();
    for (const p of data.promises) {
      if (partyFilter && p.partyLabel !== partyFilter) continue;
      const theme = p.primaryTheme || "other";
      if (!map.has(theme)) map.set(theme, []);
      map.get(theme)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [data, partyFilter]);

  return (
    <div
      style={{
        background: "#faf9f6",
        borderRadius: 12,
        border: `1px solid ${border}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: "linear-gradient(135deg, #faf9f6 0%, #f5f0e8 100%)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏛</span>
            <h3
              style={{
                fontFamily: serif,
                fontSize: 24,
                fontWeight: 500,
                color: dark,
                margin: 0,
              }}
            >
              Statewide Promises
            </h3>
          </div>
          <p
            style={{
              fontFamily: serif,
              fontSize: 13,
              color: gray,
              margin: "6px 0 0",
              lineHeight: 1.4,
            }}
          >
            These {data.total} promises apply uniformly across all of Tamil Nadu
            and are not counted in individual district totals.
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: sans,
            fontSize: 18,
            color: gray,
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Party bars */}
      <div style={{ padding: "16px 24px" }}>
        {(["ADMK", "DMK", "TVK"] as const).map((label) => {
          const count =
            data[label === "ADMK" ? "admk" : label === "DMK" ? "dmk" : "tvk"];
          const pct = (count / barMax) * 100;
          const pc = PARTY_COLORS[label];
          return (
            <div key={label} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 13,
                    fontWeight: 600,
                    color: pc.base,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: pc.base,
                    }}
                  />
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    fontWeight: 700,
                    color: dark,
                  }}
                >
                  {count}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "#ece9e1",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${pc.light}, ${pc.base})`,
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Promises by theme */}
      <div
        style={{
          borderTop: `1px solid ${border}`,
          padding: "16px 24px",
          maxHeight: 400,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: gray,
            marginBottom: 12,
          }}
        >
          Top themes
        </div>
        {byTheme.map(([theme, promises]) => {
          const isExpanded = expandedThemes[theme];
          const visiblePromises = isExpanded ? promises : promises.slice(0, 3);
          
          return (
            <div
              key={theme}
              style={{
                marginBottom: 14,
                paddingBottom: 14,
                borderBottom: `1px solid ${border}20`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 14,
                    fontWeight: 600,
                    color: dark,
                    textTransform: "capitalize",
                  }}
                >
                  {theme.replace(/_/g, " ")}
                </span>
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 12,
                    color: gray,
                    background: "#ece9e1",
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  {promises.length}
                </span>
              </div>
              {visiblePromises.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    marginBottom: 6,
                    paddingLeft: 8,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: p.partyColor,
                      marginTop: 7,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: serif,
                      fontSize: 14,
                      color: "#333",
                      lineHeight: 1.5,
                    }}
                  >
                    {isExpanded 
                      ? (p.text || p.title) 
                      : (p.text || p.title).slice(0, 120) + ((p.text || p.title).length > 120 ? "…" : "")}
                  </span>
                </div>
              ))}
              {promises.length > 3 && (
                <button
                  onClick={() => toggleTheme(theme)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: mono,
                    fontSize: 11,
                    color: brown,
                    padding: "4px 8px",
                    marginTop: 4,
                    display: "inline-block",
                    fontWeight: 600,
                  }}
                >
                  {isExpanded ? "Show less" : `+${promises.length - 3} more`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── District Detail Panel ──────────────────────────────────────────────────

function DistrictDetail({
  name,
  data,
  partyFilter,
  formatName,
  onClose,
}: {
  name: string;
  data: DistrictData;
  partyFilter: string | null;
  formatName: (n: string) => string;
  onClose: () => void;
}) {
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});
  const toggleTheme = (theme: string) => setExpandedThemes(prev => ({ ...prev, [theme]: !prev[theme] }));

  const barMax = Math.max(data.admk, data.dmk, data.tvk, 1);

  // Group promises by theme
  const byTheme = useMemo(() => {
    const map = new Map<string, ManifestoPoint[]>();
    for (const p of data.promises) {
      if (partyFilter && p.partyLabel !== partyFilter) continue;
      const theme = p.primaryTheme || "other";
      if (!map.has(theme)) map.set(theme, []);
      map.get(theme)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [data, partyFilter]);

  return (
    <div
      style={{
        background: "#faf9f6",
        borderRadius: 12,
        border: `1px solid ${border}`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: serif,
              fontSize: 24,
              fontWeight: 500,
              color: dark,
              margin: 0,
            }}
          >
            {formatName(name)}
          </h3>
          <p
            style={{
              fontFamily: mono,
              fontSize: 12,
              color: gray,
              margin: "4px 0 0",
            }}
          >
            {data.total} total promises targeting this district
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: sans,
            fontSize: 18,
            color: gray,
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Party bars */}
      <div style={{ padding: "16px 24px" }}>
        {(["ADMK", "DMK", "TVK"] as const).map((label) => {
          const count = data[label === "ADMK" ? "admk" : label === "DMK" ? "dmk" : "tvk"];
          const pct = (count / barMax) * 100;
          const pc = PARTY_COLORS[label];
          return (
            <div key={label} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: pc.base,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: pc.base,
                    }}
                  />
                  {label}
                </span>
                <span
                  style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: dark }}
                >
                  {count}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "#ece9e1",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${pc.light}, ${pc.base})`,
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Promises by theme */}
      <div
        style={{
          borderTop: `1px solid ${border}`,
          padding: "16px 24px",
          maxHeight: 400,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: sans,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: gray,
            marginBottom: 12,
          }}
        >
          Promises by theme
        </div>
        {byTheme.length === 0 ? (
          <div
            style={{
              fontFamily: serif,
              fontSize: 14,
              color: gray,
              fontStyle: "italic",
              paddingTop: 8,
            }}
          >
            No specific promises tagged for this district.
          </div>
        ) : (
          byTheme.map(([theme, promises]) => {
            const isExpanded = expandedThemes[theme];
            const visiblePromises = isExpanded ? promises : promises.slice(0, 3);
            
            return (
              <div
                key={theme}
                style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${border}20` }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: sans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: dark,
                      textTransform: "capitalize",
                    }}
                  >
                    {theme.replace(/_/g, " ")}
                  </span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 11,
                      color: gray,
                      background: "#ece9e1",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {promises.length}
                  </span>
                </div>
                {visiblePromises.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      marginBottom: 6,
                      paddingLeft: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: p.partyColor,
                        marginTop: 7,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: serif,
                        fontSize: 14,
                        color: "#333",
                        lineHeight: 1.5,
                      }}
                    >
                      {isExpanded 
                        ? (p.text || p.title) 
                        : (p.text || p.title).slice(0, 120) + ((p.text || p.title).length > 120 ? "…" : "")}
                    </span>
                  </div>
                ))}
                {promises.length > 3 && (
                  <button
                    onClick={() => toggleTheme(theme)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: mono,
                      fontSize: 10,
                      color: brown,
                      padding: "4px 8px",
                      marginTop: 4,
                      display: "inline-block",
                      fontWeight: 600,
                    }}
                  >
                    {isExpanded ? "Show less" : `+${promises.length - 3} more`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── District Ranking ───────────────────────────────────────────────────────

function DistrictRanking({
  districtMap,
  partyFilter,
  formatName,
  onSelect,
}: {
  districtMap: Map<string, DistrictData>;
  partyFilter: string | null;
  formatName: (n: string) => string;
  onSelect: (d: string) => void;
}) {
  const ranked = useMemo(() => {
    const entries = Array.from(districtMap.entries());
    return entries
      .map(([name, data]) => {
        const count = partyFilter
          ? data[
              partyFilter === "ADMK"
                ? "admk"
                : partyFilter === "DMK"
                ? "dmk"
                : "tvk"
            ]
          : data.total;
        return { name, count, data };
      })
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [districtMap, partyFilter]);

  const topMax = ranked[0]?.count ?? 1;

  return (
    <div
      style={{
        background: "#faf9f6",
        borderRadius: 12,
        border: `1px solid ${border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "20px 24px 12px",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <h3
          style={{
            fontFamily: serif,
            fontSize: 20,
            fontWeight: 500,
            color: dark,
            margin: 0,
          }}
        >
          District Ranking
        </h3>
        <p
          style={{
            fontFamily: mono,
            fontSize: 11,
            color: gray,
            margin: "4px 0 0",
          }}
        >
          {partyFilter
            ? `${partyFilter} promises by district`
            : "All party promises by district"}{" "}
          — click to explore
        </p>
      </div>

      <div style={{ maxHeight: 560, overflowY: "auto" }}>
        {ranked.map(({ name, count, data }, i) => {
          const pc = partyFilter
            ? PARTY_COLORS[partyFilter]
            : { base: brown, light: "#f5e6db", dark: "#5a3222" };
          const pct = (count / topMax) * 100;

          return (
            <div
              key={name}
              onClick={() => onSelect(name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 24px",
                cursor: "pointer",
                borderBottom: `1px solid ${border}20`,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "#f0ede5")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 11,
                  color: gray,
                  width: 22,
                  textAlign: "right",
                }}
              >
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontFamily: sans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: dark,
                    }}
                  >
                    {formatName(name)}
                  </span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      fontWeight: 700,
                      color: pc.base,
                    }}
                  >
                    {count}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: "#ece9e1",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${pc.light}, ${pc.base})`,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                {/* Mini party breakdown */}
                {!partyFilter && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 3,
                    }}
                  >
                    {[
                      { l: "A", v: data.admk, c: PARTY_COLORS.ADMK.base },
                      { l: "D", v: data.dmk, c: PARTY_COLORS.DMK.base },
                      { l: "T", v: data.tvk, c: PARTY_COLORS.TVK.base },
                    ].map((r) => (
                      <span
                        key={r.l}
                        style={{
                          fontFamily: mono,
                          fontSize: 9,
                          color: r.c,
                          fontWeight: 600,
                        }}
                      >
                        {r.l}:{r.v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {ranked.length === 0 && (
          <div
            style={{
              padding: "32px 24px",
              textAlign: "center",
              fontFamily: serif,
              fontSize: 14,
              color: gray,
            }}
          >
            No district-specific promises found.
          </div>
        )}
      </div>
    </div>
  );
}
