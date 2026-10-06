"""Extract blinded disagreement cases for LLM-arbiter evaluation.

Three strata, shuffled together, proposer hidden:
  jev_only    : Jev >= 0.8 on a label absent from Sonnet's 3
  sonnet_only : label retained by Sonnet (>= 0.8) but Jev < 0.5
  control     : both positive (sanity check for the judge)

Outputs:
  results/arbitre_cases.json  — what the judge sees (no proposer info)
  results/arbitre_key.json    — case_id -> stratum + probs (for scoring)
"""

import hashlib
import json
import random

from common import BENCH_DIR, DATA_DIR, RESULTS_DIR

N_PER_STRATUM = {"jev_only": 60, "sonnet_only": 60, "control": 20}


def main():
    projets = {p["id"]: p for p in (json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl"))}
    jev1 = {r["id"]: r for r in (json.loads(l) for l in open(RESULTS_DIR / "phase1_raw.jsonl")) if "answers" in r}
    th_index = json.load(open(RESULTS_DIR / "phase1_indexes.json"))["thematiques"]
    defs = json.load(open(BENCH_DIR / "definitions_thematiques.json"))

    pools = {"jev_only": [], "sonnet_only": [], "control": []}
    for pid, r in jev1.items():
        p = projets[pid]
        items = p.get("llm_thematiques")
        if isinstance(items, str):
            items = json.loads(items)
        if not items:
            continue
        sonnet_all = {i["label"] for i in items}
        sonnet_pos = {i["label"]: float(i["score"]) for i in items if float(i["score"]) >= 0.8}
        jev = {th_index[k]: v.get("noul", 0.0) for k, v in r["answers"].items() if k.startswith("th_")}
        for label, prob in jev.items():
            if prob >= 0.8 and label not in sonnet_all:
                pools["jev_only"].append((pid, label, prob, None))
            elif label in sonnet_pos and prob < 0.5:
                pools["sonnet_only"].append((pid, label, prob, sonnet_pos[label]))
            elif label in sonnet_pos and prob >= 0.8:
                pools["control"].append((pid, label, prob, sonnet_pos[label]))

    rng = random.Random("arbitre-2026")
    cases, key = [], {}
    for stratum, pool in pools.items():
        rng.shuffle(pool)
        for pid, label, jev_p, sonnet_s in pool[: N_PER_STRATUM[stratum]]:
            p = projets[pid]
            cid = hashlib.md5(f"{pid}|{label}".encode()).hexdigest()[:8]
            desc = (p["description"] or "").strip()
            cases.append({
                "case_id": cid,
                "nom": p["nom"],
                "description": desc[:500] if desc else None,
                "label": label,
                "definition": defs[label],
            })
            key[cid] = {"stratum": stratum, "jev": round(jev_p, 3), "sonnet": sonnet_s,
                        "id": pid, "label": label}

    rng.shuffle(cases)
    json.dump(cases, open(RESULTS_DIR / "arbitre_cases.json", "w"), ensure_ascii=False, indent=1)
    json.dump(key, open(RESULTS_DIR / "arbitre_key.json", "w"), ensure_ascii=False)
    sizes = {s: min(len(pools[s]), N_PER_STRATUM[s]) for s in pools}
    print("pools disponibles:", {s: len(pools[s]) for s in pools})
    print("cas extraits:", sizes, "— total", len(cases))


if __name__ == "__main__":
    main()
