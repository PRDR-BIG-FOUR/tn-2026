// 2016 Tamil Nadu Assembly election winners.
// Source: ECI "AC Wise Candidate Count" PDF, aggregated by
// manifesto/scripts/build_ac_candidate_count_csv.py.
//
// Coverage: 232 of 234 ACs. AC 134 (Aravakurichi) and AC 174 (Thanjavur)
// had their 2016 polls postponed; they are absent from this dataset.
// Total Electors and Poll% are not exposed in the source PDF.
import csvRaw from "../../../data/AC_wise_candidate_count_corr.csv?raw";

export interface Result2016 {
  acName: string;
  acNo: number;
  type: string;
  district: string;
  winner: string;
  party: string;
  partyShort: string;
  /** Not in source PDF — 0 when unknown. */
  totalElectors: number;
  totalVotes: number;
  /** Not in source PDF — 0 when unknown. */
  pollPct: number;
  margin: number;
  marginPct: number;
}

// Long-form party name → short code. Mirrors the 2021 map so both years share
// the same PARTY_COLORS_2021 palette for consistent map colouring.
const PARTY_SHORT: Record<string, string> = {
  "All India Anna Dravida Munnetra Kazhagam": "AIADMK",
  "Dravida Munetra Kazhagam": "DMK",
  "Bharatiya Janta Party": "BJP",
  "Indian National Congress": "INC",
  "Pattali Makkal Katchi": "PMK",
  "Communist Party Of India": "CPI",
  "Communist Party Of India (Marxist)": "CPM",
  "Viduthalai Chiruthaigal Katchi": "VCK",
  "Indian Union Muslim League": "IUML",
};

// Minimal CSV splitter — quotes-safe, mirrors elections2021.ts.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[%, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseAll(raw: string): Result2016[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const out: Result2016[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    if (c.length < 11) continue;
    const party = c[5];
    out.push({
      acName: c[0],
      acNo: parseInt(c[1], 10) || 0,
      type: c[2],
      district: c[3],
      winner: c[4],
      party,
      partyShort: PARTY_SHORT[party] ?? party,
      totalElectors: parseNum(c[6]),
      totalVotes: parseNum(c[7]),
      pollPct: parseNum(c[8]),
      margin: parseNum(c[9]),
      marginPct: parseNum(c[10]),
    });
  }
  return out;
}

export const results2016: Result2016[] = parseAll(csvRaw);

export const results2016ByAcNo = new Map<number, Result2016>(
  results2016.map(r => [r.acNo, r])
);
