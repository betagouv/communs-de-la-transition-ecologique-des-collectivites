"""Phase 1 report — agreement with Sonnet, calibration, routing, ops metrics.

Caveat printed in the report: the reference is Sonnet's labels, not ground
truth (teacher/student agreement). Sonnet only ever emits 3 thematiques per
project, so a correct 4th label from Jev counts as a false positive here.
"""

import json
import statistics
from collections import defaultdict

from common import DATA_DIR, RESULTS_DIR

SONNET_POSITIVE = 0.8  # production convention: retained labels


def load():
    projets = {p["id"]: p for p in (json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl"))}
    raw = [json.loads(l) for l in open(RESULTS_DIR / "phase1_raw.jsonl")]
    indexes = json.load(open(RESULTS_DIR / "phase1_indexes.json"))
    return projets, raw, indexes


def sonnet_labels(p, field, threshold):
    items = p.get(field) or []
    if isinstance(items, str):
        items = json.loads(items)
    return {i["label"] for i in items if float(i["score"]) >= threshold}, items


def prf(tp, fp, fn):
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return prec, rec, f1


def main():
    projets, raw, indexes = load()
    th_index = indexes["thematiques"]
    ok = [r for r in raw if "answers" in r]
    errors = [r for r in raw if "answers" not in r]

    # -------- decisions: (jev_prob, sonnet_positive) per (projet, label), classified projects only
    decisions = []
    per_label = defaultdict(list)
    top3_overlap, top1_hits, n_cls = [], 0, 0
    for r in ok:
        p = projets[r["id"]]
        if not p.get("llm_thematiques"):
            continue
        n_cls += 1
        pos, items = sonnet_labels(p, "llm_thematiques", SONNET_POSITIVE)
        probs = {th_index[k]: v.get("noul", 0.0) for k, v in r["answers"].items() if k.startswith("th_")}
        for label, prob in probs.items():
            is_pos = label in pos
            decisions.append((prob, is_pos))
            per_label[label].append((prob, is_pos))
        jev_top3 = [l for l, _ in sorted(probs.items(), key=lambda x: -x[1])[:3]]
        sonnet_top3 = [i["label"] for i in sorted(items, key=lambda x: -float(x["score"]))[:3]]
        if sonnet_top3:
            top3_overlap.append(len(set(jev_top3) & set(sonnet_top3)) / min(3, len(sonnet_top3)))
            top1_hits += sonnet_top3[0] in jev_top3

    print(f"# Phase 1 — {len(ok)} reponses ({len(errors)} erreurs), {n_cls} projets avec reference Sonnet\n")
    print(f"Reference = labels Sonnet score >= {SONNET_POSITIVE} (accord eleve/professeur, pas un gold humain).")
    print("Sonnet n'emet que 3 thematiques : un 4e label correct de Jev compte ici comme faux positif.\n")

    # -------- micro P/R/F1 at 0.5 + threshold sweep
    print("## Thematiques (138 noul par projet)")
    for thr in (0.5, None):
        best = None
        for t in ([thr] if thr else [x / 100 for x in range(10, 95, 5)]):
            tp = sum(1 for p_, y in decisions if p_ >= t and y)
            fp = sum(1 for p_, y in decisions if p_ >= t and not y)
            fn = sum(1 for p_, y in decisions if p_ < t and y)
            prec, rec, f1 = prf(tp, fp, fn)
            if best is None or f1 > best[3]:
                best = (t, prec, rec, f1)
        label = f"seuil {best[0]:.2f}" + ("" if thr else " (optimal)")
        print(f"micro {label}: P={best[1]:.3f} R={best[2]:.3f} F1={best[3]:.3f}")

    # macro over labels with at least 3 Sonnet positives
    f1s, evaluable = [], 0
    for label, rows in per_label.items():
        npos = sum(1 for _, y in rows if y)
        if npos < 3:
            continue
        evaluable += 1
        tp = sum(1 for p_, y in rows if p_ >= 0.5 and y)
        fp = sum(1 for p_, y in rows if p_ >= 0.5 and not y)
        fn = sum(1 for p_, y in rows if p_ < 0.5 and y)
        f1s.append(prf(tp, fp, fn)[2])
    print(f"macro F1 (seuil 0.5, {evaluable} labels avec >=3 positifs Sonnet): {statistics.mean(f1s):.3f}")
    print(f"top-3 Jev ∩ top-3 Sonnet: {statistics.mean(top3_overlap):.1%} — top-1 Sonnet dans top-3 Jev: {top1_hits / n_cls:.1%}")

    # -------- calibration (vs Sonnet binary)
    bins = defaultdict(list)
    for p_, y in decisions:
        bins[min(int(p_ * 10), 9)].append((p_, y))
    ece = sum(len(v) * abs(statistics.mean(p_ for p_, _ in v) - statistics.mean(float(y) for _, y in v)) for v in bins.values()) / len(decisions)
    brier = statistics.mean((p_ - float(y)) ** 2 for p_, y in decisions)
    print(f"\ncalibration vs Sonnet: ECE={ece:.4f}, Brier={brier:.4f}")
    print("fiabilite par bin (proba moyenne -> taux positif Sonnet, n):")
    for b in sorted(bins):
        v = bins[b]
        print(f"  [{b / 10:.1f}-{b / 10 + 0.1:.1f}] {statistics.mean(p_ for p_, _ in v):.2f} -> {statistics.mean(float(y) for _, y in v):.2f}  (n={len(v)})")

    # -------- confidence routing (noul confidence = max(p, 1-p))
    print("\ncouverture x exactitude par confiance (decision correcte = accord avec Sonnet au seuil 0.5):")
    for conf_thr in (0.5, 0.7, 0.9):
        sel = [(p_, y) for p_, y in decisions if max(p_, 1 - p_) >= conf_thr]
        acc = statistics.mean(1.0 if (p_ >= 0.5) == y else 0.0 for p_, y in sel) if sel else 0
        print(f"  conf >= {conf_thr}: couverture {len(sel) / len(decisions):.1%}, exactitude {acc:.3f}")

    # -------- sites / interventions
    for axis, field, qid in (("sites", "llm_sites", "site"), ("interventions", "llm_interventions", "intervention")):
        idx = indexes[axis]
        top1_match, in_top3, confs, n = 0, 0, [], 0
        for r in ok:
            p = projets[r["id"]]
            if not p.get(field):
                continue
            _, items = sonnet_labels(p, field, 0.0)
            if not items:
                continue
            n += 1
            ans = r["answers"].get(qid, {})
            jev_label = idx.get(ans.get("choice"))
            confs.append(ans.get("confidence", 0))
            sorted_items = sorted(items, key=lambda x: -float(x["score"]))
            top1_match += jev_label == sorted_items[0]["label"]
            in_top3 += jev_label in {i["label"] for i in sorted_items[:3]}
        print(f"\n## {axis.capitalize()} (choice, {n} projets)")
        print(f"top-1 Jev = top-1 Sonnet: {top1_match / n:.1%} — top-1 Jev dans les 3 de Sonnet: {in_top3 / n:.1%}")
        print(f"confiance mediane: {statistics.median(confs):.2f}")

    # -------- proba TE
    pairs = []
    for r in ok:
        p = projets[r["id"]]
        if p.get("llm_probabilite_te") is None:
            continue
        pairs.append((r["answers"]["te_global"].get("noul", 0.0), float(p["llm_probabilite_te"])))
    if pairs:
        xs, ys = zip(*pairs)
        mx, my = statistics.mean(xs), statistics.mean(ys)
        cov = sum((x - mx) * (y - my) for x, y in pairs)
        pearson = cov / ((sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5)
        mae = statistics.mean(abs(x - y) for x, y in pairs)
        agree = statistics.mean(1.0 if (x >= 0.5) == (y >= 0.5) else 0.0 for x, y in pairs)
        print(f"\n## Proba TE ({len(pairs)} projets)")
        print(f"pearson={pearson:.3f}, MAE={mae:.3f}, accord binaire (0.5)={agree:.1%}")

    # -------- disagreements worth reading
    print("\n## Desaccords a lire (Jev >= 0.9, absent des 3 labels Sonnet)")
    examples = []
    for r in ok:
        p = projets[r["id"]]
        if not p.get("llm_thematiques"):
            continue
        pos, _ = sonnet_labels(p, "llm_thematiques", 0.0)
        for k, v in r["answers"].items():
            if k.startswith("th_") and v.get("noul", 0) >= 0.9 and th_index[k] not in pos:
                examples.append((v["noul"], p["nom"][:70], th_index[k]))
    for prob, nom, label in sorted(examples, reverse=True)[:8]:
        print(f"  {prob:.2f}  {label}  <-  {nom}")

    # -------- ops
    lats = sorted(r["latency_s"] for r in ok)
    toks = [r["usage"]["input_tokens"] for r in ok if r.get("usage")]
    cost = sum(r["usage"].get("cost", 0) for r in ok if r.get("usage"))
    print(f"\n## Ops")
    print(f"latence p50={lats[len(lats) // 2]:.2f}s p95={lats[int(len(lats) * 0.95)]:.2f}s — "
          f"tokens entree moyens={statistics.mean(toks):.0f} — cout total={cost:.4f}$ "
          f"({cost / len(ok) * 1000:.3f}$/1000 projets... x1000 = {cost / len(ok) * 300000:.2f}$ pour 300k)")


if __name__ == "__main__":
    main()
