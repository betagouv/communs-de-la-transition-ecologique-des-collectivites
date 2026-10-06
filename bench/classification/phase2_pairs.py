"""Phase 2 — pair judgment: "same real-world project?" on llm_pair_judgments sample.

Per pair, one request with two questions on the same state:
  - noul  "meme_projet"  -> probability, evaluated against the binarized verdict
  - score "similarite" (4 ordered levels) -> evaluated against the 4-level verdict

Reference verdicts come from the Sonnet-based pipeline: no/low/medium/high.
Binary mapping: {medium, high} = same project, {no, low} = different.
"""

import json
import statistics
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import DATA_DIR, RESULTS_DIR
from jev_client import JevError, jev_decide

WORKERS = 8

QUESTIONS = {
    "meme_projet": {
        "type": "noul",
        "instructions": "Les projets a et b désignent le même projet réel : la même opération concrète, "
        "portée par la même collectivité, sur le même objet et le même lieu — éventuellement décrite "
        "différemment par deux sources ou deux dispositifs de financement.",
    },
    "similarite": {
        "type": "score",
        "instructions": "Degré de correspondance entre les projets a et b.",
        "criteria": [
            "Projets clairement différents",
            "Projets probablement différents malgré des points communs",
            "Probablement le même projet, sans certitude",
            "Manifestement le même projet",
        ],
    },
}

VERDICT_TO_LEVEL = {"no": 1, "low": 2, "medium": 3, "high": 4}
SAME = {"medium", "high"}


def build_state(p):
    def side(prefix):
        d = {"intitule": p[f"nom_{prefix}"]}
        if p[f"description_{prefix}"]:
            d["description"] = p[f"description_{prefix}"]
        return d

    return {"a": side("a"), "b": side("b")}


def run(paires):
    raw_path = RESULTS_DIR / "phase2_raw.jsonl"
    done = set()
    if raw_path.exists():
        done = {(r["id_a"], r["id_b"]) for r in (json.loads(l) for l in open(raw_path))}
    todo = [p for p in paires if (p["id_a"], p["id_b"]) not in done]
    print(f"{len(paires)} paires, {len(done)} deja faites, {len(todo)} a traiter")

    out = open(raw_path, "a")
    lock = threading.Lock()
    start = time.monotonic()

    def one(p):
        try:
            resp, latency = jev_decide(build_state(p), QUESTIONS)
            rec = {"id_a": p["id_a"], "id_b": p["id_b"], "answers": resp.get("answers", {}),
                   "usage": resp.get("usage"), "latency_s": round(latency, 3)}
        except JevError as e:
            rec = {"id_a": p["id_a"], "id_b": p["id_b"], "error": str(e)[:500]}
        with lock:
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for f in as_completed([pool.submit(one, p) for p in todo]):
            f.result()
    out.close()
    print(f"appels termines en {time.monotonic() - start:.0f}s")


def auc(pos_scores, neg_scores):
    """Mann-Whitney AUC."""
    wins = ties = 0
    for p_ in pos_scores:
        for n in neg_scores:
            if p_ > n:
                wins += 1
            elif p_ == n:
                ties += 1
    total = len(pos_scores) * len(neg_scores)
    return (wins + 0.5 * ties) / total if total else 0.0


def report(paires):
    by_key = {(p["id_a"], p["id_b"]): p for p in paires}
    raw = [json.loads(l) for l in open(RESULTS_DIR / "phase2_raw.jsonl")]
    ok = [r for r in raw if "answers" in r]
    errs = len(raw) - len(ok)

    rows = []
    for r in ok:
        p = by_key[(r["id_a"], r["id_b"])]
        prob = r["answers"]["meme_projet"].get("noul")
        sc = r["answers"]["similarite"]
        # score is 0-indexed and continuous (expected value); level = argmax of the distribution
        level = int(max(sc.get("probabilities", {"0": 1}).items(), key=lambda kv: kv[1])[0]) + 1
        rows.append({
            "verdict": p["verdict"], "strata": p["strata"], "prob": prob,
            "level": level, "score_cont": sc.get("score"), "level_conf": sc.get("confidence"),
            "emb": p.get("emb_score"), "nom_a": p["nom_a"], "nom_b": p["nom_b"],
        })

    print(f"\n# Phase 2 — {len(ok)} paires jugees ({errs} erreurs)")
    print("Reference = verdicts du pipeline (Sonnet) : no/low/medium/high — binaire: medium+high = meme projet.\n")

    pos = [r["prob"] for r in rows if r["verdict"] in SAME]
    neg = [r["prob"] for r in rows if r["verdict"] not in SAME]
    print(f"## noul « meme projet » — AUC = {auc(pos, neg):.4f}")
    pos_clear = [r["prob"] for r in rows if r["verdict"] == "high"]
    neg_clear = [r["prob"] for r in rows if r["verdict"] == "no"]
    print(f"AUC cas tranches (high vs no, sans low/medium): {auc(pos_clear, neg_clear):.4f}")
    acc = statistics.mean(1.0 if (r["prob"] >= 0.5) == (r["verdict"] in SAME) else 0.0 for r in rows)
    print(f"exactitude au seuil 0.5: {acc:.3f}")
    for conf_thr in (0.7, 0.9, 0.95):
        sel = [r for r in rows if max(r["prob"], 1 - r["prob"]) >= conf_thr]
        if not sel:
            continue
        a = statistics.mean(1.0 if (r["prob"] >= 0.5) == (r["verdict"] in SAME) else 0.0 for r in sel)
        print(f"  conf >= {conf_thr}: couverture {len(sel) / len(rows):.1%}, exactitude {a:.3f}")

    print("\nproba mediane par verdict / strate:")
    for strata in ("verdict:no", "verdict:no-hard", "verdict:low", "verdict:medium", "verdict:high"):
        sel = [r["prob"] for r in rows if r["strata"] == strata]
        if sel:
            print(f"  {strata:18s} n={len(sel):3d}  mediane={statistics.median(sel):.3f}  "
                  f">=0.5: {statistics.mean(1.0 if s >= 0.5 else 0.0 for s in sel):.1%}")

    print("\n## score ordinal 4 niveaux")
    exact = statistics.mean(1.0 if r["level"] == VERDICT_TO_LEVEL[r["verdict"]] else 0.0 for r in rows)
    off1 = statistics.mean(1.0 if abs(r["level"] - VERDICT_TO_LEVEL[r["verdict"]]) <= 1 else 0.0 for r in rows)
    print(f"accord exact: {exact:.1%} — accord a un niveau pres: {off1:.1%}")
    conf = defaultdict(Counter)
    for r in rows:
        conf[VERDICT_TO_LEVEL[r["verdict"]]][r["level"]] += 1
    print("confusion (verdict pipeline -> niveaux Jev 1..4):")
    for v in (1, 2, 3, 4):
        c = conf[v]
        print(f"  pipeline {v}: " + "  ".join(f"{c.get(l, 0):4d}" for l in (1, 2, 3, 4)))

    print("\n## desaccords francs (a lire)")
    fp = sorted((r for r in rows if r["verdict"] == "no" and r["prob"] >= 0.9), key=lambda r: -r["prob"])[:4]
    fn = sorted((r for r in rows if r["verdict"] == "high" and r["prob"] <= 0.1), key=lambda r: r["prob"])[:4]
    for r in fp:
        print(f"  Jev {r['prob']:.2f} / pipeline no   : «{r['nom_a'][:60]}» vs «{r['nom_b'][:60]}»")
    for r in fn:
        print(f"  Jev {r['prob']:.2f} / pipeline high : «{r['nom_a'][:60]}» vs «{r['nom_b'][:60]}»")

    lats = sorted(r["latency_s"] for r in ok)
    cost = sum(r["usage"].get("cost", 0) for r in ok if r.get("usage"))
    toks = statistics.mean(r["usage"]["input_tokens"] for r in ok if r.get("usage"))
    print(f"\n## Ops — p50={lats[len(lats) // 2]:.2f}s p95={lats[int(len(lats) * 0.95)]:.2f}s, "
          f"{toks:.0f} tokens/paire, cout total {cost:.4f}$")


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    paires = [json.loads(l) for l in open(DATA_DIR / "paires_sample.jsonl")]
    run(paires)
    report(paires)


if __name__ == "__main__":
    main()
