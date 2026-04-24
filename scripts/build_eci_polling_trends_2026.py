#!/usr/bin/env python3
"""Build per-constituency JSON from ECI Polling Trends 2026 screenshots.

Input:  screenshots in Ecidata2026/ were OCR'd manually into RAW below
        (each entry is "ac_name - ac_no : vtr_pct").

Output: manifesto/data/eci_polling_trends_2026.json

Each row is cross-checked against the canonical 234-AC list from
tn_sir_constituency_stats_2026.json (ac_no is the join key).  The output
carries the canonical constituency + district name for consistency with
the rest of the pipeline.
"""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# ── Raw OCR extractions ──────────────────────────────────────────────────
# Format: "display_name - ac_no : vtr_percent".  Order here mirrors the
# alphabetical order in the ECI "All ACs" listing and is preserved only
# for readability; the canonical AC number is the join key.

RAW = """\
Alandur - 28 : 86.15
Alangudi - 182 : 84.59
Alangulam - 223 : 85.53
Ambasamudram - 225 : 82.85
Ambattur - 8 : 77.04
Ambur - 48 : 90.67
Anaikattu - 44 : 89.69
Andipatti - 198 : 83.58
Anna Nagar - 21 : 85.64
Anthiyur - 105 : 88.15
Arakkonam - 38 : 90.12
Arani - 67 : 89.31
Aranthangi - 183 : 78.97
Aravakurichi - 134 : 91.74
Arcot - 42 : 91.03
Ariyalur - 149 : 89.00
Aruppukkottai - 207 : 84.75
Athoor - 129 : 89.49
Attur - 82 : 90.24
Avadi - 6 : 78.81
Avanashi - 112 : 90.57
Bargur - 52 : 88.01
Bhavani - 104 : 91.96
Bhavanisagar - 107 : 89.52
Bhuvanagiri - 157 : 87.90
Bodinayakanur - 200 : 82.84
Chengalpattu - 32 : 86.37
Chengam - 62 : 88.12
Chepauk-thiruvallikeni - 19 : 84.34
Cheyyar - 68 : 91.97
Cheyyur - 34 : 90.34
Chidambaram - 158 : 83.81
Coimbatore (north) - 118 : 75.67
Coimbatore (south) - 120 : 82.15
Colachal - 231 : 74.13
Coonoor - 110 : 78.38
Cuddalore - 155 : 83.79
Cumbum - 201 : 81.23
Dharapuram - 101 : 88.92
Dharmapuri - 59 : 89.44
Dindigul - 132 : 86.20
Dr.radhakrishnan Nagar - 11 : 90.50
Edappadi - 86 : 92.08
Egmore - 16 : 85.55
Erode (east) - 98 : 89.80
Erode (west) - 99 : 87.95
Gandharvakottai - 178 : 84.89
Gangavalli - 81 : 88.86
Gingee - 70 : 88.51
Gobichettipalayam - 106 : 90.74
Gudalur - 109 : 80.80
Gudiyattam - 46 : 90.47
Gummidipoondi - 1 : 90.97
Harbour - 18 : 82.75
Harur - 61 : 87.72
Hosur - 55 : 80.35
Jayankondam - 150 : 85.85
Jolarpet - 49 : 89.45
Kadayanallur - 221 : 81.36
Kalasapakkam - 65 : 91.03
Kallakurichi - 80 : 87.95
Kancheepuram - 37 : 87.15
Kangayam - 102 : 91.56
Kanniyakumari - 229 : 81.43
Karaikudi - 184 : 74.32
Karur - 135 : 93.37
Katpadi - 40 : 88.07
Kattumannarkoil - 159 : 82.11
Kavundampalayam - 117 : 85.57
Killiyoor - 234 : 71.29
Kilpennathur - 64 : 90.28
Kilvaithinankuppam - 45 : 87.25
Kilvelur - 164 : 87.98
Kinathukadavu - 122 : 87.11
Kolathur - 13 : 86.11
Kovilpatti - 218 : 79.34
Krishnagiri - 53 : 84.85
Krishnarayapuram - 136 : 92.43
Kulithalai - 137 : 92.80
Kumarapalayam - 97 : 92.65
Kumbakonam - 171 : 81.04
Kunnam - 148 : 85.04
Kurinjipadi - 156 : 88.83
Lalgudi - 143 : 86.51
Madathukulam - 126 : 86.90
Madavaram - 9 : 83.47
Madurai Central - 193 : 73.88
Madurai East - 189 : 79.90
Madurai North - 191 : 72.63
Madurai South - 192 : 78.26
Madurai West - 194 : 77.77
Madurantakam - 35 : 92.28
Maduravoyal - 7 : 78.55
Mailam - 71 : 89.71
Manachanallur - 144 : 87.65
Manamadurai - 187 : 79.26
Manapparai - 138 : 88.81
Mannargudi - 167 : 82.14
Mayiladuthurai - 161 : 79.67
Melur - 188 : 82.44
Mettuppalayam - 111 : 85.93
Mettur - 85 : 89.18
Modakkurichi - 100 : 90.34
Mudhukulathur - 212 : 76.65
Musiri - 145 : 86.78
Mylapore - 25 : 74.88
Nagapattinam - 163 : 85.87
Nagercoil - 230 : 74.72
Namakkal - 94 : 87.72
Nanguneri - 227 : 80.22
Nannilam - 169 : 85.92
Natham - 131 : 91.09
Neyveli - 153 : 87.19
Nilakkottai - 130 : 88.21
Oddanchatram - 128 : 90.64
Omalur - 84 : 90.87
Orathanadu - 175 : 82.85
Ottapidaram - 217 : 79.47
Padmanabhapuram - 232 : 75.46
Palacodu - 57 : 92.57
Palani - 127 : 86.24
Palayamkottai - 226 : 68.97
Palladam - 115 : 90.73
Pallavaram - 30 : 83.63
Panruti - 154 : 86.09
Papanasam - 172 : 80.34
Pappireddipatti - 60 : 90.36
Paramakudi - 209 : 79.61
Paramathi-velur - 95 : 90.24
Pattukkottai - 176 : 75.42
Pennagaram - 58 : 90.71
Perambalur - 147 : 85.93
Perambur - 12 : 89.79
Peravurani - 177 : 81.89
Periyakulam - 199 : 78.51
Perundurai - 103 : 92.47
Pollachi - 123 : 88.09
Polur - 66 : 89.37
Ponneri - 2 : 89.77
Poompuhar - 162 : 84.09
Poonamallee - 5 : 83.41
Pudukkottai - 180 : 83.26
Radhapuram - 228 : 80.04
Rajapalayam - 202 : 84.47
Ramanathapuram - 211 : 75.39
Ranipet - 41 : 88.51
Rasipuram - 92 : 90.60
Rishivandiyam - 78 : 88.32
Royapuram - 17 : 79.34
Saidapet - 23 : 77.84
Salem (north) - 89 : 87.39
Salem (south) - 90 : 91.01
Salem (west) - 88 : 89.98
Sankarankovil - 219 : 81.04
Sankarapuram - 79 : 87.33
Sankari - 87 : 92.50
Sattur - 204 : 85.74
Senthamangalam - 93 : 90.17
Sholavandan - 190 : 87.23
Sholingur - 39 : 89.95
Shozhinganallur - 27 : 80.39
Singanallur - 121 : 81.19
Sirkazhi - 160 : 82.44
Sivaganga - 186 : 75.91
Sivakasi - 205 : 84.26
Sriperumbudur - 29 : 86.14
Srirangam - 139 : 87.95
Srivaikuntam - 216 : 81.04
Srivilliputhur - 203 : 84.97
Sulur - 116 : 88.31
Tambaram - 31 : 83.94
Tenkasi - 222 : 82.43
Thalli - 56 : 84.68
Thanjavur - 174 : 77.60
Thiru-vi-ka-nagar - 15 : 78.70
Thirumangalam - 196 : 87.03
Thirumayam - 181 : 82.07
Thiruparankundram - 195 : 81.41
Thiruporur - 33 : 88.23
Thiruthuraipoondi - 166 : 83.56
Thiruvaiyaru - 173 : 85.19
Thiruvallur - 4 : 89.51
Thiruvarur - 168 : 83.04
Thiruverumbur - 142 : 81.21
Thiruvidaimarudur - 170 : 80.72
Thiruvottiyur - 10 : 84.41
Thiyagarayanagar - 24 : 83.55
Thondamuthur - 119 : 87.54
Thoothukkudi - 214 : 80.92
Thousand Lights - 20 : 83.09
Thuraiyur - 146 : 86.52
Tindivanam - 72 : 88.56
Tiruchendur - 215 : 78.89
Tiruchengodu - 96 : 90.06
Tiruchirappalli (east) - 141 : 81.77
Tiruchirappalli (west) - 140 : 81.35
Tiruchuli - 208 : 87.27
Tirukkoyilur - 76 : 88.46
Tirunelveli - 224 : 78.21
Tiruppattur - 50 : 88.69
Tiruppattur - 185 : 77.45
Tiruppur (north) - 113 : 83.14
Tiruppur (south) - 114 : 90.71
Tiruttani - 3 : 90.23
Tiruvadanai - 210 : 77.08
Tiruvannamalai - 63 : 87.33
Tittakudi - 151 : 83.33
Udhagamandalam - 108 : 77.68
Udumalaipettai - 125 : 87.40
Ulundurpettai - 77 : 89.54
Usilampatti - 197 : 82.95
Uthangarai - 51 : 86.15
Uthiramerur - 36 : 91.14
Valparai - 124 : 85.91
Vandavasi - 69 : 88.62
Vaniyambadi - 47 : 87.23
Vanur - 73 : 91.08
Vasudevanallur - 220 : 81.52
Vedaranyam - 165 : 85.18
Vedasandur - 133 : 91.75
Veerapandi - 91 : 93.41
Velachery - 26 : 84.50
Vellore - 43 : 87.98
Veppanahalli - 54 : 89.79
Vikravandi - 75 : 90.50
Vilathikulam - 213 : 84.16
Vilavancode - 233 : 75.77
Villivakkam - 14 : 86.00
Viluppuram - 74 : 86.60
Viralimalai - 179 : 89.80
Virudhunagar - 206 : 82.77
Virugampakkam - 22 : 85.50
Vriddhachalam - 152 : 86.05
Yercaud - 83 : 91.80
"""

LINE_RE = re.compile(r"^(?P<name>.+?)\s*-\s*(?P<no>\d+)\s*:\s*(?P<vtr>\d+(?:\.\d+)?)\s*$")

STATE_VTR = 85.13
POLL_DATE = "2026-04-23"
SOURCE = "ECI ECINET 'Polling Trends' app — Tamil Nadu, AC-General"
NOTE = (
    "Approximate polling trends (VTR) as published by ECI on the evening "
    "of poll day.  Values are captured from the ECINET app on 2026-04-23 "
    "and may be revised in subsequent days as postal ballots etc. are tallied."
)


def load_canonical() -> dict[int, tuple[str, str]]:
    """Return {ac_no: (canonical_name, district)} from the SIR JSON."""
    p = ROOT / "manifesto" / "data" / "tn_sir_constituency_stats_2026.json"
    with p.open() as f:
        d = json.load(f)
    out: dict[int, tuple[str, str]] = {}
    for dist_name, dist in d["districts"].items():
        for c in dist["constituencies"]:
            out[int(c["ac_no"])] = (c["constituency"], c["district"])
    return out


def parse_raw() -> list[dict]:
    rows: list[dict] = []
    for ln in RAW.strip().splitlines():
        m = LINE_RE.match(ln)
        if not m:
            raise ValueError(f"Un-parseable line: {ln!r}")
        rows.append(
            {
                "ac_no": int(m["no"]),
                "eci_display_name": m["name"].strip(),
                "vtr_pct": float(m["vtr"]),
            }
        )
    return rows


def main() -> None:
    canonical = load_canonical()
    rows = parse_raw()

    # Dedupe by ac_no (the listing overlaps at page boundaries).
    by_no: dict[int, dict] = {}
    for r in rows:
        by_no[r["ac_no"]] = r

    if len(by_no) != 234:
        missing = sorted(set(canonical) - set(by_no))
        extra = sorted(set(by_no) - set(canonical))
        raise SystemExit(
            f"Expected 234 unique ACs, got {len(by_no)}. "
            f"Missing: {missing}.  Extra: {extra}."
        )

    # Check every ac_no is a valid 1..234 constituency.
    bad = [no for no in by_no if no not in canonical]
    if bad:
        raise SystemExit(f"Unknown ac_no(s): {bad}")

    # Merge with canonical names and sort by ac_no.
    constituencies = []
    for no in sorted(by_no):
        r = by_no[no]
        name, district = canonical[no]
        constituencies.append(
            OrderedDict(
                [
                    ("ac_no", no),
                    ("constituency", name),
                    ("district", district),
                    ("eci_display_name", r["eci_display_name"]),
                    ("vtr_pct", r["vtr_pct"]),
                ]
            )
        )

    out = OrderedDict(
        [
            ("state", "Tamil Nadu"),
            ("poll_date", POLL_DATE),
            ("source", SOURCE),
            ("note", NOTE),
            ("statewide_vtr_pct", STATE_VTR),
            ("constituency_count", len(constituencies)),
            ("constituencies", constituencies),
        ]
    )

    out_path = ROOT / "manifesto" / "data" / "eci_polling_trends_2026.json"
    with out_path.open("w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Quick summary printout
    vals = [c["vtr_pct"] for c in constituencies]
    print(f"Wrote {out_path.relative_to(ROOT)}")
    print(f"  constituencies : {len(constituencies)}")
    print(f"  statewide VTR  : {STATE_VTR}%")
    print(f"  min / max VTR  : {min(vals)}% / {max(vals)}%")
    print(f"  simple mean    : {sum(vals) / len(vals):.2f}%")


if __name__ == "__main__":
    main()
