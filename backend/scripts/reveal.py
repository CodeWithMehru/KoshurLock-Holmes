"""Stage-5 headless verification of 'The Turn'.

Runs the full before/after sequence against the live graph:

    ask(CENTRAL_QUESTION)          -> BEFORE  (should implicate rsharma)
    teach(DEFAULT_CORRECTION)      -> add the confirmed phishing/attacker fact
    forget(anonymous_tip.txt)      -> drop the planted tip
    ask(CENTRAL_QUESTION)          -> AFTER   (should exonerate Rahul Sharma and
                                              name the external attacker / 41.220.13.7)

Gate: the AFTER answer must mention the external attacker or 41.220.13.7 and must
exonerate Rahul Sharma; the two answers must differ.

Run inside the backend container:
    docker compose exec backend python scripts/reveal.py
"""

from __future__ import annotations

import asyncio
import sys
import textwrap
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.settings import configure  # noqa: E402

configure(verbose=False)

from app import cognee_engine  # noqa: E402


def _show(title: str, res: dict) -> None:
    print("\n" + "=" * 72)
    print(f"  {title}")
    print("=" * 72)
    print(textwrap.fill(res["answer"], width=72))
    print(f"\n  sources cited: {', '.join(res['sources']) or '(none)'}")


def _implicates_rahul(answer: str) -> bool:
    a = answer.lower()
    return ("rahul sharma" in a or "rsharma" in a) and any(
        k in a for k in ("responsible", "downloaded", "exfiltrat", "stole",
                          "culprit", "insider", "leak")
    )


def _exonerates_and_names_attacker(answer: str) -> bool:
    a = answer.lower()
    names_attacker = "41.220.13.7" in a or "external attacker" in a or "lagos" in a \
        or "account takeover" in a or "stolen credential" in a or "phish" in a
    exonerates = any(k in a for k in ("framed", "did not", "was not", "not responsible",
                                      "exonerat", "could not", "innocent"))
    return names_attacker and exonerates


async def main() -> int:
    q = cognee_engine.CENTRAL_QUESTION

    before = await cognee_engine.ask(q, want_timeline=False)
    _show("BEFORE  (raw evidence - should implicate Rahul Sharma)", before)

    print("\n[turn] teaching the confirmed SOC finding (phishing / account takeover) ...")
    await cognee_engine.teach(cognee_engine.DEFAULT_CORRECTION)
    print("[turn] forgetting the planted anonymous tip ...")
    await cognee_engine.purge("anonymous_tip.txt")

    after = await cognee_engine.ask(q, want_timeline=False)
    _show("AFTER  (should exonerate Rahul Sharma -> external attacker)", after)

    changed = before["answer"].strip() != after["answer"].strip()
    after_ok = _exonerates_and_names_attacker(after["answer"])
    print("\n" + "-" * 72)
    print(f"  before implicates Rahul : {_implicates_rahul(before['answer'])}")
    print(f"  after exonerates + names attacker : {after_ok}")
    print(f"  answers differ : {changed}")
    print("-" * 72)

    if after_ok and changed:
        print("\nSTAGE 5 PASS: the conclusion flipped after teach + forget.")
        return 0
    print("\nSTAGE 5 FAIL: review the answers above.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
