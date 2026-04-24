// Corrected AC-level CSV regenerated from ECI's 2021.xlsx detailed-results sheet.
// See manifesto/scripts/build_elections2021_corr.py for the regeneration step.
import csvRaw from "../../../data/IndiaVotes_AC__Tamil_Nadu_2021_corr.csv?raw";

export interface Result2021 {
  acName: string;
  acNo: number;
  type: string;
  district: string;
  winner: string;
  party: string;
  partyShort: string;
  totalElectors: number;
  totalVotes: number;
  pollPct: number;
  margin: number;
  marginPct: number;
}

const PARTY_SHORT: Record<string, string> = {
  "All India Anna Dravida Munnetra Kazhagam": "AIADMK",
  "Dravida Munetra Kazhagam": "DMK",
  "Bharatiya Janta Party": "BJP",
  "Indian National Congress": "INC",
  "Pattali Makkal Katchi": "PMK",
  "Communist Party Of India": "CPI",
  "Communist Party Of India (Marxist)": "CPM",
  "Viduthalai Chiruthaigal Katchi": "VCK",
};

export const PARTY_COLORS_2021: Record<string, string> = {
  AIADMK: "#547C5B",
  DMK:    "#C94D48",
  TVK:    "#F5AC01",
  BJP:    "#E0660E",
  INC:    "#2A8BE1",
  PMK:    "#EBE301",
  CPI:    "#FA4545",
  CPM:    "#F61900",
  CPIM:   "#F61900",
  VCK:    "#55C4E9",
};

// Minimal CSV splitter: supports quoted fields.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[%, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseAll(raw: string): Result2021[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  const out: Result2021[] = [];
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

export const results2021: Result2021[] = parseAll(csvRaw);

export const results2021ByAcNo = new Map<number, Result2021>(
  results2021.map(r => [r.acNo, r])
);

// Derived: competitiveness bucket from margin %.
export function competitiveness(marginPct: number): { label: string; color: string; hint: string } {
  if (marginPct < 5) return { label: "Flip-risk", color: "#dc2626", hint: "won by under 5% — swing seat" };
  if (marginPct < 10) return { label: "Swing", color: "#d97706", hint: "5–10% margin — competitive" };
  if (marginPct < 20) return { label: "Lean", color: "#65a30d", hint: "10–20% margin — leans one way" };
  return { label: "Safe", color: "#047857", hint: "20%+ margin — dominant hold" };
}

// Statewide summary.
export const state2021 = (() => {
  let dmk = 0, admk = 0, other = 0;
  let totalElectors = 0, totalVotes = 0;
  for (const r of results2021) {
    if (r.partyShort === "DMK") dmk++;
    else if (r.partyShort === "AIADMK") admk++;
    else other++;
    totalElectors += r.totalElectors;
    totalVotes += r.totalVotes;
  }
  return {
    seats: { dmk, admk, other, total: results2021.length },
    totalElectors,
    totalVotes,
    turnoutPct: totalElectors ? (totalVotes / totalElectors) * 100 : 0,
  };
})();
