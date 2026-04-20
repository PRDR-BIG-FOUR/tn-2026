// All data is derived at runtime from the enriched JSON files.
// Adding more points to the JSONs automatically flows through to the UI.

import admkRaw from "../data/aiadmk.enriched.json";
import dmkRaw  from "../data/dmk.enriched.json";
import tvkRaw  from "../data/tvk_en.enriched.json";

// ── Types ─────────────────────────────────────────────────────────────────

interface RawPoint {
  point_number: number;
  section_number?: number;
  section_title?: string | null;
  subsection_title?: string | null;
  title?: string | null;
  text: string;
  analysis?: {
    beneficiary?: {
      geography?: { scope?: string; regions?: string[] };
      gender?: string[];
      age_group?: string[];
      community_category?: string[];
      minority?: { religious?: string[]; linguistic?: string[] };
      occupation_jobs?: string[] | null;
      sector?: string[];
      income_class?: string[];
      urban_rural?: string;
      primary_theme?: string;
      tags?: string[];
    };
    plan_existence?: {
      already_exists?: boolean;
      relation_to_existing?: string;
      existing_scheme_names?: string[];
      evidence?: Array<{ title?: string; url?: string; snippet?: string }>;
      notes?: string | null;
    };
    feasibility?: {
      fiscal?:         { score?: number | null };
      legal?:          { score?: number | null };
      administrative?: { score?: number | null };
      timeline?:       { score?: number | null };
      political?:      { score?: number | null };
      overall_score?:  number | null;
      overall_comments?: string | null;
      key_risks?:      string[];
    };
  };
}

interface RawDoc {
  document_title: string;
  total_points: number;
  points: RawPoint[];
}

export interface ManifestoPoint {
  party: "admk" | "dmk" | "tvk";
  partyLabel: string;
  partyColor: string;
  pointNumber: number;
  sectionTitle: string;
  subsectionTitle: string;
  title: string;
  text: string;
  primaryTheme: string;
  tags: string[];
  feasibilityScore: number | null;
  feasibilityDims: { fiscal: number | null; legal: number | null; administrative: number | null; timeline: number | null; political: number | null };
  alreadyExists: boolean;
  relation: string;
  gender: string[];
  ageGroup: string[];
  urbanRural: string;
  communityCategory: string[];
  sector: string[];
}

// ── Parse raw docs ────────────────────────────────────────────────────────

const PARTY_META = {
  admk: { label: "ADMK", color: "#547c5b" },
  dmk:  { label: "DMK",  color: "#c94d48" },
  tvk:  { label: "TVK",  color: "#E5A000" },
} as const;

function parseDoc(doc: RawDoc, party: "admk" | "dmk" | "tvk"): ManifestoPoint[] {
  const { label, color } = PARTY_META[party];
  return doc.points.map(pt => {
    const ben  = pt.analysis?.beneficiary   ?? {};
    const pe   = pt.analysis?.plan_existence ?? {};
    const feas = pt.analysis?.feasibility   ?? {};
    return {
      party,
      partyLabel: label,
      partyColor: color,
      pointNumber: pt.point_number,
      sectionTitle: pt.section_title ?? "",
      subsectionTitle: pt.subsection_title ?? "",
      title: pt.title ?? "",
      text: pt.text,
      primaryTheme: ben.primary_theme ?? "other",
      tags: ben.tags ?? [],
      feasibilityScore: feas.overall_score ?? null,
      feasibilityDims: {
        fiscal:         feas.fiscal?.score         ?? null,
        legal:          feas.legal?.score          ?? null,
        administrative: feas.administrative?.score ?? null,
        timeline:       feas.timeline?.score       ?? null,
        political:      feas.political?.score      ?? null,
      },
      alreadyExists: pe.already_exists === true,
      relation: pe.relation_to_existing ?? "new",
      gender: Array.isArray(ben.gender) ? ben.gender : ["all"],
      ageGroup: Array.isArray(ben.age_group) ? ben.age_group : ["all"],
      urbanRural: ben.urban_rural ?? "both",
      communityCategory: Array.isArray(ben.community_category) ? ben.community_category : [],
      sector: Array.isArray(ben.sector) ? ben.sector.filter(s => s.length > 2) : [],
    };
  });
}

export const PARTY_LABELS = Object.values(PARTY_META).map(m => m.label);

export const allPoints: ManifestoPoint[] = [
  ...parseDoc(admkRaw as unknown as RawDoc, "admk"),
  ...parseDoc(dmkRaw  as unknown as RawDoc, "dmk"),
  ...parseDoc(tvkRaw  as unknown as RawDoc, "tvk"),
];

// The total_points field reflects the full manifesto count even if fewer
// points are currently enriched in the JSON — use it for headline numbers.
export const TOTALS = {
  admk: (admkRaw as unknown as RawDoc).total_points,
  dmk:  (dmkRaw  as unknown as RawDoc).total_points,
  tvk:  (tvkRaw  as unknown as RawDoc).total_points,
};
export const GRAND_TOTAL = TOTALS.admk + TOTALS.dmk + TOTALS.tvk;

// ── Derived metrics ───────────────────────────────────────────────────────

// Scale a sample count to the full manifesto total.
// Once all points are enriched the scale factor becomes 1.
function scale(sampleCount: number, sampleSize: number, fullSize: number): number {
  if (sampleSize === 0) return 0;
  return Math.round((sampleCount / sampleSize) * fullSize);
}

export const sampleSizes = {
  admk: allPoints.filter(p => p.party === "admk").length,
  dmk:  allPoints.filter(p => p.party === "dmk").length,
  tvk:  allPoints.filter(p => p.party === "tvk").length,
};

// ── Sector / theme breakdown ──────────────────────────────────────────────

// Human-readable label for each LLM-assigned primary_theme
const THEME_LABELS: Record<string, string> = {
  governance:     "Governance",
  social_justice: "Social Justice",
  welfare:        "Welfare & Cash Transfer",
  education:      "Education",
  employment:     "Employment / Jobs",
  jobs:           "Employment / Jobs",
  "arts and culture": "Arts & Culture",
  infrastructure: "Infrastructure",
  industry:       "Industry & Investment",
  investment:     "Industry & Investment",
  agriculture:    "Agriculture",
  women:          "Women & Gender",
  youth:          "Youth",
  tourism:        "Tourism",
  other:          "Other",
};

function themeLabel(raw: string): string {
  return THEME_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function computeSectorData(): Record<string, { admk: number; dmk: number; tvk: number }> {
  // Count raw sample hits per theme per party
  const raw: Record<string, { admk: number; dmk: number; tvk: number }> = {};
  for (const pt of allPoints) {
    const label = themeLabel(pt.primaryTheme);
    if (!raw[label]) raw[label] = { admk: 0, dmk: 0, tvk: 0 };
    raw[label][pt.party]++;
  }
  // Scale each party's sample to its full manifesto size
  const scaled: Record<string, { admk: number; dmk: number; tvk: number }> = {};
  for (const [label, counts] of Object.entries(raw)) {
    scaled[label] = {
      admk: scale(counts.admk, sampleSizes.admk, TOTALS.admk),
      dmk:  scale(counts.dmk,  sampleSizes.dmk,  TOTALS.dmk),
      tvk:  scale(counts.tvk,  sampleSizes.tvk,  TOTALS.tvk),
    };
  }
  // Sort by total descending
  return Object.fromEntries(
    Object.entries(scaled).sort((a, b) =>
      (b[1].admk + b[1].dmk + b[1].tvk) - (a[1].admk + a[1].dmk + a[1].tvk)
    )
  );
}

export const sectorData = computeSectorData();

// ── Specific theme counts for donut charts ────────────────────────────────

function themeCount(themeRaw: string[]): { admk: number; dmk: number; tvk: number } {
  const result = { admk: 0, dmk: 0, tvk: 0 };
  for (const pt of allPoints) {
    if (themeRaw.includes(pt.primaryTheme)) result[pt.party]++;
  }
  return {
    admk: scale(result.admk, sampleSizes.admk, TOTALS.admk),
    dmk:  scale(result.dmk,  sampleSizes.dmk,  TOTALS.dmk),
    tvk:  scale(result.tvk,  sampleSizes.tvk,  TOTALS.tvk),
  };
}

export const welfareData  = themeCount(["welfare"]);
export const eduData      = themeCount(["education"]);
export const agriData     = themeCount(["agriculture"]);

// ── Feasibility scores (average across enriched sample) ───────────────────

function avgScores(party: "admk" | "dmk" | "tvk") {
  const pts = allPoints.filter(p => p.party === party);
  const avg = (arr: (number | null)[]) => {
    const vals = arr.filter((v): v is number => v !== null);
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
  };
  return {
    fiscal:         avg(pts.map(p => p.feasibilityDims.fiscal)),
    legal:          avg(pts.map(p => p.feasibilityDims.legal)),
    administrative: avg(pts.map(p => p.feasibilityDims.administrative)),
    timeline:       avg(pts.map(p => p.feasibilityDims.timeline)),
    political:      avg(pts.map(p => p.feasibilityDims.political)),
    overall:        avg(pts.map(p => p.feasibilityScore)),
  };
}

export const feasibility = {
  admk: avgScores("admk"),
  dmk:  avgScores("dmk"),
  tvk:  avgScores("tvk"),
};

export const feasibilityRadarData = [
  { dim: "Fiscal",    ADMK: feasibility.admk.fiscal,         DMK: feasibility.dmk.fiscal,         TVK: feasibility.tvk.fiscal         },
  { dim: "Legal",     ADMK: feasibility.admk.legal,          DMK: feasibility.dmk.legal,           TVK: feasibility.tvk.legal          },
  { dim: "Admin",     ADMK: feasibility.admk.administrative, DMK: feasibility.dmk.administrative,  TVK: feasibility.tvk.administrative },
  { dim: "Timeline",  ADMK: feasibility.admk.timeline,       DMK: feasibility.dmk.timeline,        TVK: feasibility.tvk.timeline       },
  { dim: "Political", ADMK: feasibility.admk.political,      DMK: feasibility.dmk.political,       TVK: feasibility.tvk.political      },
];

// ── Plan novelty (relation_to_existing) ───────────────────────────────────

function computeNovelty() {
  const categories = ["new", "expansion", "amendment", "continuation", "replacement"];
  const raw: Record<string, { admk: number; dmk: number; tvk: number }> = {};
  for (const cat of categories) raw[cat] = { admk: 0, dmk: 0, tvk: 0 };

  for (const pt of allPoints) {
    const rel = pt.relation ?? "new";
    if (!raw[rel]) raw[rel] = { admk: 0, dmk: 0, tvk: 0 };
    raw[rel][pt.party]++;
  }

  return Object.entries(raw)
    .filter(([, c]) => c.admk + c.dmk + c.tvk > 0)
    .map(([label, counts]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      admk: scale(counts.admk, sampleSizes.admk, TOTALS.admk),
      dmk:  scale(counts.dmk,  sampleSizes.dmk,  TOTALS.dmk),
      tvk:  scale(counts.tvk,  sampleSizes.tvk,  TOTALS.tvk),
    }));
}

export const noveltyData = computeNovelty();

// ── Demographics ──────────────────────────────────────────────────────────

type DemoMatcher = (pt: ManifestoPoint) => boolean;

const DEMO_GROUPS: { group: string; pop: string; share: string; match: DemoMatcher }[] = [
  {
    group: "Women", pop: "3.83 cr", share: "50.1%",
    match: pt => pt.gender.includes("women"),
  },
  {
    group: "Youth (15–29)", pop: "2.02 cr", share: "26.4%",
    match: pt => pt.ageGroup.some(a => a === "youth") || pt.primaryTheme === "youth",
  },
  {
    group: "Farmers / Agri", pop: "2.09 cr", share: "27.3%",
    match: pt =>
      pt.sector.some(s => /agri/i.test(s)) ||
      pt.primaryTheme === "agriculture",
  },
  {
    group: "SC / ST", pop: "1.62 cr", share: "21.2%",
    match: pt => pt.communityCategory.some(c => c === "SC" || c === "ST"),
  },
  {
    group: "Elderly (60+)", pop: "0.98 cr", share: "12.9%",
    match: pt => pt.ageGroup.some(a => a === "elderly"),
  },
  {
    group: "OBC / MBC", pop: "est. 50%", share: "~50%",
    match: pt => pt.communityCategory.some(c => c === "OBC" || c === "MBC"),
  },
  {
    group: "Rural", pop: "est. 52%", share: "~52%",
    match: pt => pt.urbanRural === "rural",
  },
];

export const demographicsData = DEMO_GROUPS.map(({ group, pop, share, match }) => {
  const raw = { admk: 0, dmk: 0, tvk: 0 };
  for (const pt of allPoints) if (match(pt)) raw[pt.party]++;
  return {
    group, pop, share,
    admk: scale(raw.admk, sampleSizes.admk, TOTALS.admk),
    dmk:  scale(raw.dmk,  sampleSizes.dmk,  TOTALS.dmk),
    tvk:  scale(raw.tvk,  sampleSizes.tvk,  TOTALS.tvk),
  };
});

// ── Urban / Rural scope ───────────────────────────────────────────────────

function computeUrbanRural() {
  const raw: Record<string, { admk: number; dmk: number; tvk: number }> = {
    both:  { admk: 0, dmk: 0, tvk: 0 },
    urban: { admk: 0, dmk: 0, tvk: 0 },
    rural: { admk: 0, dmk: 0, tvk: 0 },
  };
  for (const pt of allPoints) {
    const key = pt.urbanRural in raw ? pt.urbanRural : "both";
    raw[key][pt.party]++;
  }
  return [
    { label: "Both",  admk: scale(raw.both.admk,  sampleSizes.admk, TOTALS.admk), dmk: scale(raw.both.dmk,  sampleSizes.dmk, TOTALS.dmk), tvk: scale(raw.both.tvk,  sampleSizes.tvk, TOTALS.tvk) },
    { label: "Urban", admk: scale(raw.urban.admk, sampleSizes.admk, TOTALS.admk), dmk: scale(raw.urban.dmk, sampleSizes.dmk, TOTALS.dmk), tvk: scale(raw.urban.tvk, sampleSizes.tvk, TOTALS.tvk) },
    { label: "Rural", admk: scale(raw.rural.admk, sampleSizes.admk, TOTALS.admk), dmk: scale(raw.rural.dmk, sampleSizes.dmk, TOTALS.dmk), tvk: scale(raw.rural.tvk, sampleSizes.tvk, TOTALS.tvk) },
  ];
}

export const urbanRuralData = computeUrbanRural();

// ── Fact Checks ───────────────────────────────────────────────────────────

export interface FactCheckEvidence {
  title: string;
  url: string;
  snippet: string;
}

export interface FactCheck {
  party: string;
  partyKey: "admk" | "dmk" | "tvk";
  color: string;
  num: string;
  pointNumber: number;
  claim: string;
  analysis: string;
  verdict: string;
  verdictColor: string;
  score: number | null;
  theme: string;
  themeLabel: string;
  keyRisks: string[];
  evidence: FactCheckEvidence[];
}

function scoreToVerdict(score: number | null | undefined): { verdict: string; verdictColor: string } {
  if (score === null || score === undefined) return { verdict: "Aspirational", verdictColor: "rgb(138,117,32)" };
  if (score >= 4) return { verdict: "Accurate",    verdictColor: "#1C804C" };
  if (score === 3) return { verdict: "Disputed",   verdictColor: "rgb(176,90,42)" };
  return             { verdict: "Unlikely",    verdictColor: "#d43d51" };
}

function buildFactChecks(): FactCheck[] {
  const result: FactCheck[] = [];
  const parties: Array<{ key: "admk" | "dmk" | "tvk"; doc: RawDoc }> = [
    { key: "admk", doc: admkRaw as unknown as RawDoc },
    { key: "dmk",  doc: dmkRaw  as unknown as RawDoc },
    { key: "tvk",  doc: tvkRaw  as unknown as RawDoc },
  ];

  for (const { key, doc } of parties) {
    const { label, color } = PARTY_META[key];
    for (const pt of doc.points) {
      const pe   = pt.analysis?.plan_existence;
      const feas = pt.analysis?.feasibility;
      const notes   = pe?.notes;
      const comments = feas?.overall_comments;
      const evidence = pe?.evidence ?? [];
      const score = feas?.overall_score;

      // Only include points that have grounding text (notes or comments)
      const analysisText = notes || comments;
      if (!analysisText) continue;

      // Use title as claim; fall back to first 120 chars of text
      const claim = pt.title
        ? `"${pt.title}"`
        : `"${pt.text.slice(0, 120)}…"`;

      const { verdict, verdictColor } = scoreToVerdict(score);
      const themeRaw = pt.analysis?.beneficiary?.primary_theme ?? "other";

      result.push({
        party: label,
        partyKey: key,
        color,
        num: `#${pt.point_number}`,
        pointNumber: pt.point_number,
        claim,
        analysis: analysisText,
        verdict,
        verdictColor,
        score: score ?? null,
        theme: themeRaw,
        themeLabel: themeLabel(themeRaw),
        keyRisks: Array.isArray(feas?.key_risks) ? feas!.key_risks! : [],
        evidence: evidence.map(e => ({
          title:   e.title   ?? "",
          url:     e.url     ?? "",
          snippet: e.snippet ?? "",
        })).filter(e => e.title || e.url),
      });
    }
  }

  return result;
}

export const factChecks: FactCheck[] = buildFactChecks();
