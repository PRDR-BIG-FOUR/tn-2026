import kmlRaw from "../../../data/assembly-constituency-map.kml?raw";

export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 700;
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

export interface KmlConstituency {
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

export const kmlConstituencies = parseKml(kmlRaw);

// ── Color scales ───────────────────────────────────────────────────────────

export type VoterMapMode = "total" | "men" | "women" | "growth" | "winner2021" | "winner2016" | "polls2026";

type RGB = [number, number, number];

function lerp(t: number, a: RGB, b: RGB): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// Piecewise-linear interpolation through N color stops.
function lerpMulti(t: number, stops: RGB[]): string {
  const clamped = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  if (n <= 0) return `rgb(${stops[0].join(",")})`;
  const pos = clamped * n;
  const i = Math.min(Math.floor(pos), n - 1);
  const f = pos - i;
  return lerp(f, stops[i], stops[i + 1]);
}

// 4-stop green ramp for the "total" voter map (Ever green → Calm green).
export const TOTAL_SCALE: RGB[] = [
  [190, 207, 187], // #BECFBB Ever green
  [142, 164, 139], // #8EA48B Matcha
  [114, 138, 110], // #728A6E Early green
  [ 50,  77,  62], // #324D3E Calm green
];

const MEN_SCALE: RGB[] = [
  [232, 241, 252],
  [186, 213, 240],
  [125, 179, 232],
  [ 70, 130, 200],
  [ 28,  78, 150],
];

const WOMEN_SCALE: RGB[] = [
  [253, 232, 238],
  [247, 188, 206],
  [232, 125, 155],
  [200,  76, 120],
  [140,  36,  80],
];

// SIR impact ramp: Light Coral → Dark Crimson (direct, no mid stop).
// Light = least impact (near 0 or positive), dark = heavy deletions.
const SIR_IMPACT_SCALE: RGB[] = [
  [240, 128, 128], // #F08080 Light Coral
  [169,  37,  66], // #A92542 Dark crimson
];

export function scaleForMode(mode: VoterMapMode): RGB[] {
  switch (mode) {
    case "men":   return MEN_SCALE;
    case "women": return WOMEN_SCALE;
    case "total":
    default:      return TOTAL_SCALE;
  }
}

// Accepts a pre-computed 0..1 position (usually a quantile rank) and returns
// the fill from the appropriate multi-stop ramp.
export function voterFill(t: number, mode: VoterMapMode): string {
  if (t < 0 && (mode === "total" || mode === "men" || mode === "women")) return "#f5f3ee";
  return lerpMulti(t, scaleForMode(mode));
}

// SIR impact scale — darkness encodes deletion magnitude.
// Accepts a precomputed 0..1 position (the Explorer passes a rank percentile
// among negative-Δ ACs so the worst-hit seat is always the darkest stop).
export function growthFill(t: number): string {
  return lerpMulti(Math.max(0, Math.min(1, t)), SIR_IMPACT_SCALE);
}

export const SIR_IMPACT_RAMP = SIR_IMPACT_SCALE;

// ── 2026 Polling Trends (VTR) — diverging ramp ────────────────────────────
// Red (well below state avg) → pale sand (≈ state avg) → deep green
// (well above).  Used by the "2026 Elections" mode in the Constituency
// Explorer and the per-AC voter turnout from ECI ECINET.
export const POLLS_2026_RAMP: RGB[] = [
  [197,  68,  72], // #C54448 — crimson   (well below)
  [223, 129,  95], // #DF815F — warm amber
  [235, 210, 140], // #EBD28C — pale sand (≈ state avg)
  [148, 188, 128], // #94BC80 — leaf green
  [ 62, 132,  96], // #3E8460 — deep forest (well above)
];

/** Diverging colour centred on stateAvg, clamped to [min, max]. */
export function pollTurnoutFill(
  vtr: number,
  stateAvg: number,
  min: number,
  max: number,
): string {
  const lowSpan  = Math.max(stateAvg - min, 0.001);
  const highSpan = Math.max(max - stateAvg, 0.001);
  const t = vtr <= stateAvg
    ? 0.5 * ((vtr - min) / lowSpan)
    : 0.5 + 0.5 * ((vtr - stateAvg) / highSpan);
  return lerpMulti(Math.max(0, Math.min(1, t)), POLLS_2026_RAMP);
}

// Build a CSS linear-gradient string matching a multi-stop ramp — used by legends.
export function gradientCss(stops: RGB[]): string {
  const parts = stops.map((s, i) => {
    const pct = (i / (stops.length - 1)) * 100;
    return `rgb(${s.join(",")}) ${pct.toFixed(0)}%`;
  });
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
