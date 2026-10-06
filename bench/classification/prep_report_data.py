"""Aggregate every bench result into results/report_data.json for the HTML report."""

import json
import statistics
from collections import defaultdict

from common import DATA_DIR, RESULTS_DIR

SAME = {"medium", "high"}
VERDICT_TO_LEVEL = {"no": 1, "low": 2, "medium": 3, "high": 4}


def auc(pos, neg):
    wins = ties = 0
    for p_ in pos:
        for n in neg:
            if p_ > n:
                wins += 1
            elif p_ == n:
                ties += 1
    total = len(pos) * len(neg)
    return (wins + 0.5 * ties) / total if total else None


def pearson(pairs):
    xs, ys = zip(*pairs)
    mx, my = statistics.mean(xs), statistics.mean(ys)
    cov = sum((x - mx) * (y - my) for x, y in pairs)
    return cov / ((sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5)


def jsonl(path):
    if not path.exists():
        return []
    return [json.loads(l) for l in open(path)]


def parse_items(v):
    if isinstance(v, str):
        return json.loads(v)
    return v or []


def main():
    projets = {p["id"]: p for p in jsonl(DATA_DIR / "projets_sample.jsonl")}
    paires = jsonl(DATA_DIR / "paires_sample.jsonl")
    jev1 = {r["id"]: r for r in jsonl(RESULTS_DIR / "phase1_raw.jsonl") if "answers" in r}
    jev2 = {(r["id_a"], r["id_b"]): r for r in jsonl(RESULTS_DIR / "phase2_raw.jsonl") if "answers" in r}
    choice138 = {r["id"]: r for r in jsonl(RESULTS_DIR / "phase3_choice138_raw.jsonl") if "answer" in r}
    th_index = json.load(open(RESULTS_DIR / "phase1_indexes.json"))["thematiques"]
    phase0 = jsonl(RESULTS_DIR / "phase0.jsonl")

    out = {}

    # ---- tiles / ops
    lats = sorted(r["latency_s"] for r in jev1.values())
    cost1 = sum(r["usage"].get("cost", 0) for r in jev1.values() if r.get("usage"))
    out["ops"] = {
        "n_projets": len(jev1), "n_paires": len(jev2), "errors": 0,
        "p50": lats[len(lats) // 2], "p95": lats[int(len(lats) * 0.95)],
        "tokens_moy": round(statistics.mean(r["usage"]["input_tokens"] for r in jev1.values())),
        "cost_1000": round(cost1 / len(jev1) * 1000, 3),
        "cost_300k": round(cost1 / len(jev1) * 300000, 1),
    }

    # ---- phase 0 : fr vs en scatter
    pts = []
    for rec in phase0:
        for qid in rec["fr"]["answers"]:
            fr = rec["fr"]["answers"][qid].get("noul")
            en = rec["en"]["answers"][qid].get("noul")
            if fr is not None and en is not None:
                pts.append([round(fr, 3), round(en, 3)])
    out["phase0_fr_en"] = pts

    # ---- phase 1 : decisions, reliability, routing
    decisions = []
    for pid, r in jev1.items():
        p = projets[pid]
        items = parse_items(p.get("llm_thematiques"))
        if not items:
            continue
        pos = {i["label"] for i in items if float(i["score"]) >= 0.8}
        for k, v in r["answers"].items():
            if k.startswith("th_"):
                decisions.append((v.get("noul", 0.0), th_index[k] in pos))
    bins = defaultdict(list)
    for p_, y in decisions:
        bins[min(int(p_ * 10), 9)].append((p_, y))
    out["reliability"] = [
        {"bin": b / 10, "annonce": round(statistics.mean(p_ for p_, _ in v), 3),
         "observe": round(statistics.mean(float(y) for _, y in v), 3), "n": len(v)}
        for b, v in sorted(bins.items())
    ]
    routing = []
    for c in [x / 100 for x in range(50, 100, 5)]:
        sel = [(p_, y) for p_, y in decisions if max(p_, 1 - p_) >= c]
        if sel:
            routing.append({"conf": c, "couverture": round(len(sel) / len(decisions), 4),
                            "exactitude": round(statistics.mean(1.0 if (p_ >= 0.5) == y else 0.0 for p_, y in sel), 4)})
    out["routing_thematiques"] = routing

    # ---- phase 1 : example card (École Louis Pasteur)
    example = None
    for pid, p in projets.items():
        if "PASTEUR" in (p["nom"] or "").upper() and pid in jev1:
            example = (pid, p)
            break
    if example:
        pid, p = example
        probs = sorted(((v.get("noul", 0), th_index[k]) for k, v in jev1[pid]["answers"].items() if k.startswith("th_")),
                       reverse=True)[:10]
        sonnet = {i["label"]: float(i["score"]) for i in parse_items(p["llm_thematiques"])}
        out["exemple"] = {
            "nom": p["nom"], "source": p["source_origine"], "description": bool(p["description"]),
            "jev": [{"label": l, "p": round(pr, 3), "sonnet": sonnet.get(l)} for pr, l in probs],
            "sonnet_absents": [{"label": l, "score": s} for l, s in sonnet.items()
                               if l not in {l2 for _, l2 in probs}],
        }

    # ---- phase 2 : strip plot + confusion + routing + AUC
    strip = []
    for pa in paires:
        key = (pa["id_a"], pa["id_b"])
        if key not in jev2:
            continue
        r = jev2[key]
        sc = r["answers"]["similarite"]
        level = int(max(sc.get("probabilities", {"0": 1}).items(), key=lambda kv: kv[1])[0]) + 1
        strip.append({"v": pa["verdict"], "hard": pa["strata"] == "verdict:no-hard",
                      "p": round(r["answers"]["meme_projet"]["noul"], 3), "niveau": level})
    out["paires"] = strip
    pos = [s["p"] for s in strip if s["v"] in SAME]
    neg = [s["p"] for s in strip if s["v"] not in SAME]
    out["paires_auc"] = {
        "global": round(auc(pos, neg), 4),
        "tranche": round(auc([s["p"] for s in strip if s["v"] == "high"], [s["p"] for s in strip if s["v"] == "no"]), 4),
    }
    conf = defaultdict(lambda: defaultdict(int))
    for s in strip:
        conf[VERDICT_TO_LEVEL[s["v"]]][s["niveau"]] += 1
    out["paires_confusion"] = {str(v): {str(l): conf[v][l] for l in (1, 2, 3, 4)} for v in (1, 2, 3, 4)}

    # ---- phase 3 : choice 138
    rows = []
    for pid, r in choice138.items():
        p = projets[pid]
        items = parse_items(p.get("llm_thematiques"))
        if not items:
            continue
        items = sorted(items, key=lambda x: -float(x["score"]))
        idx_rev = {f"th_{i:03d}": lbl for i, lbl in enumerate(json.load(open(RESULTS_DIR / "phase1_indexes.json"))["thematiques"].values())}
        ans = r["answer"]
        rows.append({"top1": th_index.get(ans.get("choice")) == items[0]["label"],
                     "in3": th_index.get(ans.get("choice")) in {i["label"] for i in items[:3]},
                     "conf": ans.get("confidence", 0)})
    out["choice138"] = {
        "n": len(rows),
        "top1": round(statistics.mean(1.0 if r["top1"] else 0.0 for r in rows), 3),
        "in3": round(statistics.mean(1.0 if r["in3"] else 0.0 for r in rows), 3),
        "routing": [
            {"conf": c, "couverture": round(len([r for r in rows if r["conf"] >= c]) / len(rows), 3),
             "top1": round(statistics.mean(1.0 if r["top1"] else 0.0 for r in rows if r["conf"] >= c), 3)}
            for c in (0.5, 0.7, 0.9) if any(r["conf"] >= c for r in rows)
        ],
    }

    # ---- albert comparison (if runs are complete)
    albert_te = {r["id"]: r["p"] for r in jsonl(RESULTS_DIR / "albert_te.jsonl") if "p" in r}
    albert_pairs = {(r["id_a"], r["id_b"]): r["p"] for r in jsonl(RESULTS_DIR / "albert_paires.jsonl") if "p" in r}
    albert_th = jsonl(RESULTS_DIR / "albert_thematiques.jsonl")

    # Only include a comparison section once its batch is (nearly) complete.
    if len(albert_te) < len(projets) - 10:
        albert_te = {}
    if len(albert_pairs) < len(paires) - 10:
        albert_pairs = {}
    if len(albert_th) < 20 * 138 - 20:
        albert_th = []

    if albert_te:
        triples = []
        for pid, gp in albert_te.items():
            p = projets[pid]
            if p.get("llm_probabilite_te") is None or pid not in jev1:
                continue
            triples.append((gp, jev1[pid]["answers"]["te_global"]["noul"], float(p["llm_probabilite_te"])))
        g, j, s = zip(*triples)
        out["te_compare"] = {
            "n": len(triples),
            "scatter": [[round(a, 3), round(b, 3), round(c, 3)] for a, b, c in triples],
            "gemma": {"pearson": round(pearson(list(zip(g, s))), 3),
                      "mae": round(statistics.mean(abs(x - y) for x, y in zip(g, s)), 3),
                      "extremes": round(statistics.mean(1.0 if x <= 0.05 or x >= 0.95 else 0.0 for x in g), 3)},
            "jev": {"pearson": round(pearson(list(zip(j, s))), 3),
                    "mae": round(statistics.mean(abs(x - y) for x, y in zip(j, s)), 3),
                    "extremes": round(statistics.mean(1.0 if x <= 0.05 or x >= 0.95 else 0.0 for x in j), 3)},
        }

    if albert_pairs:
        rows2 = []
        for pa in paires:
            key = (pa["id_a"], pa["id_b"])
            if key in albert_pairs and key in jev2:
                rows2.append((albert_pairs[key], jev2[key]["answers"]["meme_projet"]["noul"], pa["verdict"]))
        out["paires_compare"] = {}
        for name, idx in (("gemma", 0), ("jev", 1)):
            out["paires_compare"][name] = {
                "auc": round(auc([r[idx] for r in rows2 if r[2] in SAME], [r[idx] for r in rows2 if r[2] not in SAME]), 4),
                "auc_tranche": round(auc([r[idx] for r in rows2 if r[2] == "high"], [r[idx] for r in rows2 if r[2] == "no"]), 4),
                "medianes": {v: round(statistics.median(r[idx] for r in rows2 if r[2] == v), 3)
                             for v in ("no", "low", "medium", "high")},
            }
        out["paires_compare"]["n"] = len(rows2)

    if albert_th:
        by_proj = defaultdict(dict)
        for r in albert_th:
            if "p" in r:
                by_proj[r["id"]][r["label"]] = r["p"]
        dec = {"gemma": [], "jev": []}
        for pid, gprobs in by_proj.items():
            items = parse_items(projets[pid].get("llm_thematiques"))
            pos_set = {i["label"] for i in items if float(i["score"]) >= 0.8}
            jprobs = {th_index[k]: v.get("noul", 0) for k, v in jev1[pid]["answers"].items() if k.startswith("th_")}
            for label, gp in gprobs.items():
                dec["gemma"].append((gp, label in pos_set))
                dec["jev"].append((jprobs.get(label, 0), label in pos_set))
        out["th_compare"] = {"n_projets": len(by_proj)}
        for name, d in dec.items():
            best = max(
                ((t,) + (lambda tp, fp, fn: ((2 * tp / (2 * tp + fp + fn)) if tp else 0,))(
                    sum(1 for p_, y in d if p_ >= t and y),
                    sum(1 for p_, y in d if p_ >= t and not y),
                    sum(1 for p_, y in d if p_ < t and y))
                 for t in [x / 100 for x in range(10, 95, 5)]),
                key=lambda x: x[1],
            )
            out["th_compare"][name] = {
                "auc": round(auc([p_ for p_, y in d if y], [p_ for p_, y in d if not y]), 4),
                "f1_optimal": round(best[1], 3), "seuil_optimal": best[0],
                "extremes": round(statistics.mean(1.0 if p_ <= 0.05 or p_ >= 0.95 else 0.0 for p_, _ in d), 3),
            }

    json.dump(out, open(RESULTS_DIR / "report_data.json", "w"), ensure_ascii=False)
    print("sections:", ", ".join(out.keys()))


if __name__ == "__main__":
    main()
