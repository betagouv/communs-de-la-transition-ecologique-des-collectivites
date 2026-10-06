"""Report for the Gemma 4 (Albert API) comparison — side by side with Jev.

Reads albert_te.jsonl / albert_paires.jsonl / albert_thematiques.jsonl and the
Jev raw results, computes the same metrics on the same items.
"""

import json
import statistics
from collections import defaultdict

from common import DATA_DIR, RESULTS_DIR

SAME = {"medium", "high"}


def auc(pos, neg):
    wins = ties = 0
    for p_ in pos:
        for n in neg:
            if p_ > n:
                wins += 1
            elif p_ == n:
                ties += 1
    total = len(pos) * len(neg)
    return (wins + 0.5 * ties) / total if total else 0.0


def pearson(pairs):
    xs, ys = zip(*pairs)
    mx, my = statistics.mean(xs), statistics.mean(ys)
    cov = sum((x - mx) * (y - my) for x, y in pairs)
    return cov / ((sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5)


def main():
    projets = {p["id"]: p for p in (json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl"))}
    paires = {(p["id_a"], p["id_b"]): p for p in (json.loads(l) for l in open(DATA_DIR / "paires_sample.jsonl"))}
    jev1 = {r["id"]: r for r in (json.loads(l) for l in open(RESULTS_DIR / "phase1_raw.jsonl")) if "answers" in r}
    jev2 = {(r["id_a"], r["id_b"]): r for r in (json.loads(l) for l in open(RESULTS_DIR / "phase2_raw.jsonl")) if "answers" in r}
    th_index = json.load(open(RESULTS_DIR / "phase1_indexes.json"))["thematiques"]

    # ---- TE
    albert_te = [json.loads(l) for l in open(RESULTS_DIR / "albert_te.jsonl")]
    te_err = sum(1 for r in albert_te if "p" not in r)
    triples = []  # (gemma, jev, sonnet)
    for r in albert_te:
        if "p" not in r:
            continue
        p = projets[r["id"]]
        if p.get("llm_probabilite_te") is None or r["id"] not in jev1:
            continue
        triples.append((r["p"], jev1[r["id"]]["answers"]["te_global"]["noul"], float(p["llm_probabilite_te"])))
    print(f"# Comparatif Gemma 4 31B (Albert) vs Jev — reference Sonnet\n")
    print(f"## Proba TE ({len(triples)} projets, {te_err} erreurs Albert)")
    g, j, s = zip(*triples)
    for name, xs in (("Gemma", g), ("Jev", j)):
        pr = pearson(list(zip(xs, s)))
        mae = statistics.mean(abs(x - y) for x, y in zip(xs, s))
        agree = statistics.mean(1.0 if (x >= 0.5) == (y >= 0.5) else 0.0 for x, y in zip(xs, s))
        extreme = statistics.mean(1.0 if x <= 0.05 or x >= 0.95 else 0.0 for x in xs)
        print(f"  {name:6s} vs Sonnet: pearson={pr:.3f}, MAE={mae:.3f}, accord binaire={agree:.1%}, "
              f"probas extremes (<0.05 ou >0.95): {extreme:.1%}")

    # ---- pairs
    albert_p = [json.loads(l) for l in open(RESULTS_DIR / "albert_paires.jsonl")]
    p_err = sum(1 for r in albert_p if "p" not in r)
    rows = []
    for r in albert_p:
        if "p" not in r:
            continue
        key = (r["id_a"], r["id_b"])
        if key not in jev2:
            continue
        rows.append((r["p"], jev2[key]["answers"]["meme_projet"]["noul"], paires[key]["verdict"]))
    print(f"\n## Paires ({len(rows)} paires, {p_err} erreurs Albert)")
    for name, idx in (("Gemma", 0), ("Jev", 1)):
        pos = [r[idx] for r in rows if r[2] in SAME]
        neg = [r[idx] for r in rows if r[2] not in SAME]
        pos_c = [r[idx] for r in rows if r[2] == "high"]
        neg_c = [r[idx] for r in rows if r[2] == "no"]
        acc = statistics.mean(1.0 if (r[idx] >= 0.5) == (r[2] in SAME) else 0.0 for r in rows)
        print(f"  {name:6s}: AUC={auc(pos, neg):.4f}, AUC cas tranches={auc(pos_c, neg_c):.4f}, exactitude@0.5={acc:.3f}")
    print("  mediane par verdict:")
    for v in ("no", "low", "medium", "high"):
        sel = [r for r in rows if r[2] == v]
        if sel:
            print(f"    {v:7s} Gemma={statistics.median(r[0] for r in sel):.3f}  Jev={statistics.median(r[1] for r in sel):.3f}  (n={len(sel)})")

    # ---- thematiques (subset)
    albert_th = [json.loads(l) for l in open(RESULTS_DIR / "albert_thematiques.jsonl")]
    th_err = sum(1 for r in albert_th if "p" not in r)
    by_proj = defaultdict(dict)
    for r in albert_th:
        if "p" in r:
            by_proj[r["id"]][r["label"]] = r["p"]
    decisions = {"Gemma": [], "Jev": []}
    for pid, gemma_probs in by_proj.items():
        p = projets[pid]
        items = p["llm_thematiques"]
        if isinstance(items, str):
            items = json.loads(items)
        pos = {i["label"] for i in items if float(i["score"]) >= 0.8}
        jev_probs = {th_index[k]: v.get("noul", 0) for k, v in jev1[pid]["answers"].items() if k.startswith("th_")}
        for label, gp in gemma_probs.items():
            decisions["Gemma"].append((gp, label in pos))
            decisions["Jev"].append((jev_probs.get(label, 0), label in pos))
    print(f"\n## Thematiques unaires ({len(by_proj)} projets x 138 labels, {th_err} erreurs Albert)")
    for name, dec in decisions.items():
        best = None
        for t in [x / 100 for x in range(10, 95, 5)]:
            tp = sum(1 for p_, y in dec if p_ >= t and y)
            fp = sum(1 for p_, y in dec if p_ >= t and not y)
            fn = sum(1 for p_, y in dec if p_ < t and y)
            prec = tp / (tp + fp) if tp + fp else 0
            rec = tp / (tp + fn) if tp + fn else 0
            f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
            if best is None or f1 > best[3]:
                best = (t, prec, rec, f1)
        pos_scores = [p_ for p_, y in dec if y]
        neg_scores = [p_ for p_, y in dec if not y]
        extreme = statistics.mean(1.0 if p_ <= 0.05 or p_ >= 0.95 else 0.0 for p_, _ in dec)
        print(f"  {name:6s}: AUC={auc(pos_scores, neg_scores):.4f}, "
              f"F1 optimal={best[3]:.3f} (seuil {best[0]:.2f}, P={best[1]:.3f} R={best[2]:.3f}), "
              f"probas extremes: {extreme:.1%}")

    lats = sorted(r["latency_s"] for r in albert_te + albert_p + albert_th if "latency_s" in r)
    if lats:
        print(f"\n## Ops Albert — latence p50={lats[len(lats) // 2]:.2f}s p95={lats[int(len(lats) * 0.95)]:.2f}s "
              f"(hors attente de quota), debit plafonne a ~92 req/min")


if __name__ == "__main__":
    main()
