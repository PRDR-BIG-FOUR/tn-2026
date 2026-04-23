#!/usr/bin/env python3
"""Convert ``AC WISE CANDIDATE COUNT.pdf`` into a per-AC CSV.

The PDF is a candidate-level dump (one AC per page, 234 ACs across 236 pages)
with columns: ``Sl No, Candidate Name, Party Abbreviation, Votes Polled, % of Votes polled``
and a footer ``Total Valid Votes Polled <N>``. Winner totals suggest this is
the **2016 Tamil Nadu Assembly election**.

Output columns match the corrected 2021 CSV so ``elections2021.ts`` could
parse it unchanged if ever pointed at it:

    AC Name, AC No., Type, District, Winning Candidate, Party,
    Total Electors, Total Votes, Poll%, Margin, Margin %

District + Type are carried over from the existing
``IndiaVotes_AC__Tamil_Nadu_2021.csv`` (structural fields, unchanged between
elections). ``Total Electors`` and ``Poll%`` are left blank because the PDF
does not expose them.

Usage:
    pip install pdfplumber
    python manifesto/scripts/build_ac_candidate_count_csv.py

Writes to ``manifesto/data/AC_wise_candidate_count_corr.csv``.
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

import pdfplumber

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
SRC_PDF = ROOT / "AC WISE CANDIDATE COUNT.pdf"
SRC_CSV = ROOT / "manifesto" / "data" / "IndiaVotes_AC__Tamil_Nadu_2021.csv"
OUT_CSV = ROOT / "manifesto" / "data" / "AC_wise_candidate_count_corr.csv"

# ACs with postponed 2016 polls (re-held later) that the PDF left blank.
# Sourced from constituency-specific Wikipedia pages. Values use the same
# column layout as the PDF-derived rows so the downstream CSV stays uniform.
#
#   ac_no → (winner, party_long, total_votes, electors, poll_pct, margin, margin_pct)
#
# When electors are known we also emit Poll%. Add more rows here as authoritative
# sources are found — the rest of the rows still source exclusively from the PDF.
MANUAL_OVERRIDES: dict[int, dict] = {
    # Aravakurichi — postponed 2016 poll, re-held 19 Nov 2016.
    # https://en.wikipedia.org/wiki/Aravakurichi_Assembly_constituency
    134: {
        "ac_name": "Aravakurichi",
        "winner": "V. SENTHIL BALAJI",
        "party_short": "ADMK",
        "total_votes": 164582,
        "electors": 200343,  # back-computed from 82.15% turnout
        "poll_pct": 82.15,
        "margin": 23661,
        "margin_pct": 14.38,
    },
    # Thanjavur — postponed 2016 poll, re-held 19 Nov 2016.
    # https://en.wikipedia.org/wiki/Thanjavur_Assembly_constituency
    174: {
        "ac_name": "Thanjavur",
        "winner": "M. RANGASWAMY",
        "party_short": "ADMK",
        "total_votes": 186444,
        "electors": 268767,  # back-computed from 69.37% turnout
        "poll_pct": 69.37,
        "margin": 26874,
        "margin_pct": 14.41,
    },
}

# Party short → long form (same mapping used for 2021 conversion so the
# existing PARTY_SHORT map in elections2021.ts still produces clean short codes).
PARTY_LONG = {
    "ADMK": "All India Anna Dravida Munnetra Kazhagam",
    "AIADMK": "All India Anna Dravida Munnetra Kazhagam",
    "DMK": "Dravida Munetra Kazhagam",
    "BJP": "Bharatiya Janta Party",
    "INC": "Indian National Congress",
    "PMK": "Pattali Makkal Katchi",
    "CPI": "Communist Party Of India",
    "CPM": "Communist Party Of India (Marxist)",
    "CPIM": "Communist Party Of India (Marxist)",
    "CPI(M)": "Communist Party Of India (Marxist)",
    "CPI(ML)(L)": "Communist Party Of India (Marxist-Leninist)",
    "VCK": "Viduthalai Chiruthaigal Katchi",
    "NTK": "Naam Tamilar Katchi",
    "DMDK": "Desiya Murpokku Dravida Kazhagam",
    "MNM": "Makkal Needhi Maiam",
    "BSP": "Bahujan Samaj Party",
    "IND": "Independent",
    "IUML": "Indian Union Muslim League",
    "AITC": "All India Trinamool Congress",
}

# ─────────────────────────────────────────────────────────────────────────────
# Parsing helpers
# ─────────────────────────────────────────────────────────────────────────────
AC_HEADER_RE = re.compile(r"^AC\s+(\d{3})\s*[-–]\s*(.+?)\s*$", re.IGNORECASE)
TOTAL_LINE_RE = re.compile(
    r"^Total\s+Valid\s+Votes\s+Polled\s+(\d[\d,]*)\s*$", re.IGNORECASE
)
# Candidate row: "N <NAME ...> <PARTY> <VOTES> <PCT>".
# Parse from the right — last two tokens are always numeric.
CAND_ROW_RE = re.compile(r"^(\d+)\s+(.+)$")


def load_side_table() -> dict[int, tuple[str, str]]:
    """``{ac_no: (type, district)}`` from the existing CSV."""
    table: dict[int, tuple[str, str]] = {}
    with SRC_CSV.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            table[int(row["AC No."])] = (row["Type"], row["District"])
    return table


def parse_candidate_row(line: str) -> dict | None:
    """Return ``{sl, name, party, votes, pct}`` or ``None`` if the line isn't a candidate row."""
    m = CAND_ROW_RE.match(line)
    if not m:
        return None
    sl = int(m.group(1))
    tokens = m.group(2).split()
    if len(tokens) < 3:
        return None
    # Last two tokens must parse as numbers (votes, pct). Else this is noise.
    try:
        pct = float(tokens[-1])
        votes = int(tokens[-2].replace(",", ""))
    except ValueError:
        return None
    party = tokens[-3]
    name = " ".join(tokens[:-3]).strip()
    if not name:
        return None
    return {"sl": sl, "name": name, "party": party, "votes": votes, "pct": pct}


def parse_page(text: str) -> dict | None:
    """Extract one AC block from a page's text."""
    if not text:
        return None
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    ac_no = ac_name = None
    total_votes = None
    candidates: list[dict] = []

    for ln in lines:
        if ac_no is None:
            m = AC_HEADER_RE.match(ln)
            if m:
                ac_no = int(m.group(1))
                ac_name = m.group(2).strip().title()
                continue

        if total_votes is None:
            m = TOTAL_LINE_RE.match(ln)
            if m:
                total_votes = int(m.group(1).replace(",", ""))
                continue

        row = parse_candidate_row(ln)
        if row:
            candidates.append(row)

    if ac_no is None or not candidates:
        return None
    return {
        "ac_no": ac_no,
        "ac_name": ac_name,
        "total_votes": total_votes or sum(c["votes"] for c in candidates),
        "candidates": candidates,
    }


def main() -> None:
    side = load_side_table()
    rows_out: list[dict] = []
    missing: list[int] = []

    with pdfplumber.open(SRC_PDF) as pdf:
        print(f"Parsing {len(pdf.pages)} pages…")
        for page in pdf.pages:
            parsed = parse_page(page.extract_text() or "")
            if not parsed:
                continue

            cands = parsed["candidates"]
            real = [c for c in cands if c["party"].upper() != "NOTA"]
            real.sort(key=lambda c: c["votes"], reverse=True)
            if not real:
                continue

            winner = real[0]
            runnerup = real[1] if len(real) > 1 else None
            margin = winner["votes"] - (runnerup["votes"] if runnerup else 0)
            total_votes = parsed["total_votes"]
            margin_pct = (margin / total_votes * 100) if total_votes else 0.0

            party_short = winner["party"].upper()
            party_long = PARTY_LONG.get(party_short, party_short)

            ac_type, district = side.get(parsed["ac_no"], ("", ""))
            if not district:
                missing.append(parsed["ac_no"])

            rows_out.append({
                "AC Name": parsed["ac_name"],
                "AC No.": parsed["ac_no"],
                "Type": ac_type,
                "District": district,
                "Winning Candidate": winner["name"],
                "Party": party_long,
                "Total Electors": "",  # not in PDF
                "Total Votes": total_votes,
                "Poll%": "",            # not in PDF
                "Margin": margin,
                "Margin %": f"{margin_pct:.1f}%",
            })

    # Splice in manually-sourced rows for ACs the PDF left blank.
    done = {r["AC No."] for r in rows_out}
    for ac_no, ov in MANUAL_OVERRIDES.items():
        if ac_no in done:
            continue
        ac_type, district = side.get(ac_no, ("", ""))
        rows_out.append({
            "AC Name": ov["ac_name"],
            "AC No.": ac_no,
            "Type": ac_type,
            "District": district,
            "Winning Candidate": ov["winner"],
            "Party": PARTY_LONG.get(ov["party_short"].upper(), ov["party_short"]),
            "Total Electors": ov.get("electors", ""),
            "Total Votes": ov["total_votes"],
            "Poll%": f"{ov['poll_pct']} %" if "poll_pct" in ov else "",
            "Margin": ov["margin"],
            "Margin %": f"{ov['margin_pct']:.1f}%",
        })

    rows_out.sort(key=lambda r: r["AC No."])
    fields = [
        "AC Name", "AC No.", "Type", "District", "Winning Candidate", "Party",
        "Total Electors", "Total Votes", "Poll%", "Margin", "Margin %",
    ]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for r in rows_out:
            writer.writerow(r)

    print(f"Wrote {len(rows_out)} rows → {OUT_CSV.relative_to(ROOT)}")
    if missing:
        print(f"WARN: district unknown for AC numbers: {missing}")


if __name__ == "__main__":
    main()
