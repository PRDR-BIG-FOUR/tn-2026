#!/usr/bin/env python3
"""Rebuild the AC-level 2021 Tamil Nadu election CSV from the ECI source.

The existing ``IndiaVotes_AC__Tamil_Nadu_2021.csv`` (scraped third-party) had
stale/incorrect figures for some ACs (e.g. Nanguneri total electors were off
by ~21k). This script regenerates a corrected CSV straight from the ECI
"10 - Detailed Results" sheet in ``2021.xlsx``.

Output columns mirror the existing CSV exactly so ``elections2021.ts`` can
parse it unchanged:

    AC Name, AC No., Type, District, Winning Candidate, Party,
    Total Electors, Total Votes, Poll%, Margin, Margin %

The xlsx is candidate-level and has no district/type column, so District
and Type are carried forward from the existing CSV as a side-table (those
two fields are structural and don't change between re-counts).

Usage:
    pip install openpyxl
    python manifesto/scripts/build_elections2021_corr.py

Writes to ``manifesto/data/IndiaVotes_AC__Tamil_Nadu_2021_corr.csv``.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

import openpyxl

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
SRC_XLSX = ROOT / "2021.xlsx"
SRC_CSV = ROOT / "manifesto" / "data" / "IndiaVotes_AC__Tamil_Nadu_2021.csv"
OUT_CSV = ROOT / "manifesto" / "data" / "IndiaVotes_AC__Tamil_Nadu_2021_corr.csv"

# ─────────────────────────────────────────────────────────────────────────────
# Party short → long form. Matches keys in ``PARTY_SHORT`` inside
# ``manifesto/frontend/src/app/elections2021.ts`` so ``partyShort``/colors work.
# Short codes absent from this map pass through unchanged.
# ─────────────────────────────────────────────────────────────────────────────
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
    "IUML": "Indian Union Muslim League",
    "AITC": "All India Trinamool Congress",
    "VCK": "Viduthalai Chiruthaigal Katchi",
    "NTK": "Naam Tamilar Katchi",
    "DMDK": "Desiya Murpokku Dravida Kazhagam",
    "MNM": "Makkal Needhi Maiam",
    "BSP": "Bahujan Samaj Party",
    "IND": "Independent",
}


def load_side_table() -> dict[int, tuple[str, str]]:
    """Return ``{ac_no: (type, district)}`` from the existing CSV."""
    table: dict[int, tuple[str, str]] = {}
    with SRC_CSV.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            ac_no = int(row["AC No."])
            table[ac_no] = (row["Type"], row["District"])
    return table


def parse_xlsx() -> tuple[dict[int, list[dict]], dict[int, tuple[int, float]]]:
    """Parse the ECI detailed-results sheet.

    Returns
    -------
    by_ac:
        Mapping of AC number → list of candidate dicts
        (``{ac_name, candidate, party, total, electors}``).
    turnout:
        Mapping of AC number → ``(total_votes, poll_pct)`` from the
        "TURN OUT" / "TOTAL:" row that follows each AC block.
    """
    wb = openpyxl.load_workbook(SRC_XLSX, read_only=True, data_only=True)
    ws = wb["Worksheet"]

    by_ac: dict[int, list[dict]] = defaultdict(list)
    turnout: dict[int, tuple[int, float]] = {}

    current_ac: int | None = None
    for row in ws.iter_rows(values_only=True):
        if not row or all(v is None for v in row):
            continue
        (state, ac_no, ac_name, cand, _sex, _age, _cat,
         party, _sym, _gen, _postal, total, pct, electors) = row[:14]

        if isinstance(ac_no, int) and ac_name and isinstance(cand, str):
            current_ac = ac_no
            by_ac[ac_no].append({
                "ac_name": ac_name,
                "candidate": cand,
                "party": (party or "").strip(),
                "total": total or 0,
                "electors": electors,
            })
        elif state == "TURN OUT" and current_ac is not None:
            turnout[current_ac] = (total or 0, float(pct) if pct is not None else 0.0)
            current_ac = None

    return by_ac, turnout


def strip_index(name: str) -> str:
    """``"1 GOVINDARAJAN T.J"`` → ``"GOVINDARAJAN T.J"``."""
    parts = name.split(" ", 1)
    if len(parts) == 2 and parts[0].isdigit():
        return parts[1]
    return name


def main() -> None:
    side = load_side_table()
    by_ac, turnout = parse_xlsx()

    rows: list[dict] = []
    for ac_no in sorted(by_ac):
        cands = by_ac[ac_no]
        ac_name = cands[0]["ac_name"]
        electors = cands[0]["electors"]
        total_votes, poll_pct = turnout.get(ac_no, (0, 0.0))

        # Winner = highest TOTAL among real (non-NOTA) candidates.
        real = [c for c in cands if c["party"].upper() != "NOTA"]
        real.sort(key=lambda c: c["total"], reverse=True)
        if not real:
            continue
        winner = real[0]
        runnerup = real[1] if len(real) > 1 else None
        margin = winner["total"] - (runnerup["total"] if runnerup else 0)
        margin_pct = (margin / total_votes * 100) if total_votes else 0.0

        party_short = winner["party"].upper()
        party_long = PARTY_LONG.get(party_short, party_short)

        ac_type, district = side.get(ac_no, ("GEN", ""))

        rows.append({
            "AC Name": ac_name,
            "AC No.": ac_no,
            "Type": ac_type,
            "District": district,
            "Winning Candidate": strip_index(winner["candidate"]),
            "Party": party_long,
            "Total Electors": electors,
            "Total Votes": total_votes,
            "Poll%": f"{poll_pct} %",
            "Margin": margin,
            "Margin %": f"{margin_pct:.1f}%",
        })

    fields = [
        "AC Name", "AC No.", "Type", "District", "Winning Candidate", "Party",
        "Total Electors", "Total Votes", "Poll%", "Margin", "Margin %",
    ]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    print(f"Wrote {len(rows)} rows → {OUT_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
