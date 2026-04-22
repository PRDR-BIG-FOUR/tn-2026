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

export type VoterMapMode = "total" | "men" | "women" | "growth" | "winner2021";

function lerp(t: number, a: [number, number, number], b: [number, number, number]): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function voterFill(val: number, maxVal: number, mode: VoterMapMode): string {
  if (val === 0 && (mode === "total" || mode === "men" || mode === "women")) return "#f5f3ee";
  const t = Math.min(val / Math.max(maxVal, 1), 1);
  const i = 0.25 + t * 0.75;
  switch (mode) {
    case "men":   return lerp(i, [224, 238, 255], [125, 179, 232]);
    case "women": return lerp(i, [255, 228, 235], [232, 125, 155]);
    case "total":
    default:      return lerp(i, [244, 236, 232], [161, 103, 73]);
  }
}

// Diverging scale for growth %: red (shrinking) — cream (flat) — green (growing)
export function growthFill(deltaPct: number): string {
  const capped = Math.max(-20, Math.min(20, deltaPct));
  if (capped >= 0) {
    const t = capped / 20;
    return lerp(t, [245, 240, 230], [4, 120, 87]);
  } else {
    const t = -capped / 20;
    return lerp(t, [245, 240, 230], [220, 38, 38]);
  }
}
