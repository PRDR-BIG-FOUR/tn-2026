"""Re-run only the points in data/pipeline_2/*.enriched.json that have
``analysis._parse_errors`` (or are otherwise all-null), and patch them
in-place.

We deliberately use ``batch_k=1`` here so a single missing item in the
batched response can no longer cascade into 3-4 broken points, and so the
patch is independent of the original batch boundaries.

Usage:
    GEMINI_API_KEY=... python -m scripts.fix_parse_errors \
        [--party aiadmk|dmk|tvk_en|all]  [--concurrency 4]
        [--dir data/pipeline_2]

By default we process all three enriched files in the default output dir.
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import datetime as _dt
import json
import sys
from pathlib import Path
from typing import Any

# Make `src.pipeline_2.*` importable when executed as `python -m scripts...`
# from the manifesto project root.
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from src.pipeline_2.config import (  # noqa: E402
    DEFAULT_MAX_RETRIES,
    DEFAULT_MODEL,
    OUTPUT_DIR,
)
from src.pipeline_2.gemini_client import GeminiClient  # noqa: E402
from src.pipeline_2.parser import ParsedItem, parse_response  # noqa: E402
from src.pipeline_2.prompts import SYSTEM_PROMPT, build_user_prompt  # noqa: E402


ENRICHED_FILES = {
    "aiadmk": "aiadmk.enriched.json",
    "dmk": "dmk.enriched.json",
    "tvk_en": "tvk_en.enriched.json",
}


def _is_broken(analysis: dict[str, Any] | None) -> bool:
    """A point needs re-running if parse errors were recorded or if the
    three analysis sections are all missing/null."""
    if not isinstance(analysis, dict):
        return True
    if analysis.get("_parse_errors"):
        return True
    if "error" in analysis and not isinstance(analysis.get("beneficiary"), dict):
        return True
    return (
        analysis.get("beneficiary") is None
        and analysis.get("plan_existence") is None
        and analysis.get("feasibility") is None
    )


async def _fix_one(
    client: GeminiClient,
    sem: asyncio.Semaphore,
    point: dict[str, Any],
    label: str,
) -> tuple[ParsedItem | None, dict[str, Any] | None, str | None]:
    async with sem:
        try:
            user_prompt = build_user_prompt([point])
            result = await client.generate(SYSTEM_PROMPT, user_prompt)
        except Exception as err:  # noqa: BLE001
            print(f"[fix] {label}: request FAILED: {err}", file=sys.stderr)
            return None, None, str(err)

    items = parse_response(result.text, expected_count=1)
    parsed = items[0] if items else None
    raw = {
        "search_queries": result.search_queries,
        "citation_urls": result.citation_urls,
        "tokens": result.tokens,
        "attempts": result.attempts,
        "model": result.model,
    }
    status = "ok" if (parsed is not None and parsed.ok) else "partial/failed"
    print(
        f"[fix] {label}: {status} "
        f"(attempts={result.attempts}, tokens={result.tokens.get('total_token_count','?')})",
        flush=True,
    )
    return parsed, raw, None


def _build_analysis(
    parsed: ParsedItem | None,
    raw: dict[str, Any] | None,
    err: str | None,
) -> dict[str, Any]:
    if err is not None or parsed is None:
        return {
            "error": err or "no parsed item produced",
            "_meta": {
                "model": (raw or {}).get("model"),
                "tokens": (raw or {}).get("tokens", {}),
                "attempts": (raw or {}).get("attempts", 0),
            },
        }

    analysis: dict[str, Any] = {
        "beneficiary": parsed.beneficiary,
        "plan_existence": parsed.plan_existence,
        "feasibility": parsed.feasibility,
    }
    if raw is not None:
        analysis["_grounding"] = {
            "search_queries": raw["search_queries"],
            "citation_urls": raw["citation_urls"],
        }
        analysis["_meta"] = {
            "model": raw["model"],
            "tokens": raw["tokens"],
            "attempts": raw["attempts"],
        }
    if parsed.errors:
        analysis["_parse_errors"] = parsed.errors
    return analysis


async def _fix_file(
    path: Path,
    *,
    party: str,
    model: str,
    concurrency: int,
    max_retries: int,
) -> None:
    with path.open("r", encoding="utf-8") as f:
        doc = json.load(f)

    points: list[dict[str, Any]] = doc.get("points") or []
    broken_idxs = [i for i, p in enumerate(points) if _is_broken(p.get("analysis"))]

    print(
        f"[fix] {party}: {len(broken_idxs)} broken points out of {len(points)} "
        f"(file={path.name})",
        flush=True,
    )
    if not broken_idxs:
        return

    client = GeminiClient(model=model, max_retries=max_retries)
    sem = asyncio.Semaphore(concurrency)

    async def _worker(idx: int) -> tuple[int, ParsedItem | None, dict[str, Any] | None, str | None]:
        point = points[idx]
        label = f"{party} idx={idx} point#{point.get('point_number')}"
        # Carry party into the prompt so grounding stays Tamil-Nadu focused.
        payload = copy.deepcopy(point)
        payload.setdefault("_party", party)
        parsed, raw, err = await _fix_one(client, sem, payload, label)
        return idx, parsed, raw, err

    results = await asyncio.gather(*[_worker(i) for i in broken_idxs])

    now_iso = _dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    fixed = 0
    still_broken = 0
    for idx, parsed, raw, err in results:
        new_analysis = _build_analysis(parsed, raw, err)
        new_analysis["_repaired_at"] = now_iso
        points[idx]["analysis"] = new_analysis
        if _is_broken(new_analysis):
            still_broken += 1
        else:
            fixed += 1

    # Refresh the aggregate counters if present.
    meta = doc.get("pipeline_2_meta") or {}
    if isinstance(meta, dict):
        remaining = sum(1 for p in points if _is_broken(p.get("analysis")))
        meta["parse_errors"] = remaining
        meta["last_repaired_at"] = now_iso
        meta["last_repair_batch_k"] = 1
        doc["pipeline_2_meta"] = meta

    with path.open("w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    print(
        f"[fix] {party}: repaired={fixed} still_broken={still_broken} -> wrote {path}",
        flush=True,
    )


def _parties_from_arg(party_arg: str, out_dir: Path) -> dict[str, Path]:
    if party_arg == "all":
        return {k: out_dir / v for k, v in ENRICHED_FILES.items()}
    if party_arg not in ENRICHED_FILES:
        raise SystemExit(
            f"Unknown party '{party_arg}'. Choose from {', '.join(ENRICHED_FILES)} or 'all'."
        )
    return {party_arg: out_dir / ENRICHED_FILES[party_arg]}


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--party", default="all")
    p.add_argument("--dir", type=Path, default=OUTPUT_DIR)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES)
    return p.parse_args()


async def _amain(args: argparse.Namespace) -> None:
    parties = _parties_from_arg(args.party, args.dir)
    for party, path in parties.items():
        if not path.exists():
            print(f"[fix] {party}: missing {path}, skipping", file=sys.stderr)
            continue
        await _fix_file(
            path,
            party=party,
            model=args.model,
            concurrency=args.concurrency,
            max_retries=args.max_retries,
        )


def main() -> None:
    args = _parse_args()
    asyncio.run(_amain(args))


if __name__ == "__main__":
    main()
