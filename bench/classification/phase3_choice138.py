"""Phase 3 (b) — main thematique as a single 138-option choice (Jev).

Compares the choice top-1 (and its probability distribution) against Sonnet's
top-scored thematique. Run + report in one go.
"""

import json
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import BENCH_DIR, DATA_DIR, RESULTS_DIR
from jev_client import JevError, jev_decide

WORKERS = 8


def build_question():
    ref = json.load(open(BENCH_DIR / "referentiel.json"))
    defs = json.load(open(BENCH_DIR / "definitions_thematiques.json"))
    criteria = {f"th_{i:03d}": f"{label} : {defs[label]}" for i, label in enumerate(ref["thematiques"])}
    index = {f"th_{i:03d}": label for i, label in enumerate(ref["thematiques"])}
    question = {
        "thematique_principale": {
            "type": "choice",
            "instructions": "Thématique principale du projet.",
            "criteria": criteria,
        }
    }
    return question, index


def run(projets, question):
    raw_path = RESULTS_DIR / "phase3_choice138_raw.jsonl"
    done = set()
    if raw_path.exists():
        done = {json.loads(l)["id"] for l in open(raw_path)}
    todo = [p for p in projets if p["id"] not in done]
    print(f"{len(projets)} projets, {len(done)} deja faits, {len(todo)} a traiter")
    if not todo:
        return

    out = open(raw_path, "a")
    lock = threading.Lock()
    start = time.monotonic()

    def one(p):
        state = {"intitule": p["nom"]}
        if p["description"]:
            state["description"] = p["description"]
        try:
            resp, latency = jev_decide(state, question)
            rec = {"id": p["id"], "answer": resp["answers"]["thematique_principale"],
                   "usage": resp.get("usage"), "latency_s": round(latency, 3)}
        except JevError as e:
            rec = {"id": p["id"], "error": str(e)[:500]}
        with lock:
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for f in as_completed([pool.submit(one, p) for p in todo]):
            f.result()
    out.close()
    print(f"appels termines en {time.monotonic() - start:.0f}s")


def report(projets, index):
    by_id = {p["id"]: p for p in projets}
    raw = [json.loads(l) for l in open(RESULTS_DIR / "phase3_choice138_raw.jsonl")]
    ok = [r for r in raw if "answer" in r]

    rows = []
    for r in ok:
        p = by_id[r["id"]]
        if not p.get("llm_thematiques"):
            continue
        items = p["llm_thematiques"]
        if isinstance(items, str):
            items = json.loads(items)
        items = sorted(items, key=lambda x: -float(x["score"]))
        ans = r["answer"]
        probs = {index[k]: v for k, v in ans.get("probabilities", {}).items()}
        jev_top3 = [l for l, _ in sorted(probs.items(), key=lambda x: -x[1])[:3]]
        rows.append({
            "jev_top1": index.get(ans.get("choice")),
            "jev_top3": jev_top3,
            "confidence": ans.get("confidence", 0),
            "sonnet_top1": items[0]["label"],
            "sonnet_labels": [i["label"] for i in items],
        })

    n = len(rows)
    print(f"\n# Variante B — choice 138 options ({len(ok)} reponses, {n} avec reference Sonnet)")
    print(f"top-1 Jev = top-1 Sonnet: {statistics.mean(1.0 if r['jev_top1'] == r['sonnet_top1'] else 0.0 for r in rows):.1%}")
    print(f"top-1 Jev dans les 3 Sonnet: {statistics.mean(1.0 if r['jev_top1'] in r['sonnet_labels'] else 0.0 for r in rows):.1%}")
    print(f"top-1 Sonnet dans top-3 Jev: {statistics.mean(1.0 if r['sonnet_top1'] in r['jev_top3'] else 0.0 for r in rows):.1%}")
    print(f"confiance mediane: {statistics.median(r['confidence'] for r in rows):.2f}")
    print("\ncouverture x exactitude (top-1 = top-1) par confiance:")
    for thr in (0.5, 0.7, 0.9):
        sel = [r for r in rows if r["confidence"] >= thr]
        if not sel:
            continue
        acc = statistics.mean(1.0 if r["jev_top1"] == r["sonnet_top1"] else 0.0 for r in sel)
        in3 = statistics.mean(1.0 if r["jev_top1"] in r["sonnet_labels"] else 0.0 for r in sel)
        print(f"  conf >= {thr}: couverture {len(sel) / n:.1%}, top1={acc:.3f}, dans-les-3={in3:.3f}")

    lats = sorted(r["latency_s"] for r in ok)
    cost = sum(r["usage"].get("cost", 0) for r in ok if r.get("usage"))
    toks = statistics.mean(r["usage"]["input_tokens"] for r in ok if r.get("usage"))
    print(f"\nops: p50={lats[len(lats) // 2]:.2f}s p95={lats[int(len(lats) * 0.95)]:.2f}s, "
          f"{toks:.0f} tokens/projet, cout total {cost:.4f}$")


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    projets = [json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl")]
    question, index = build_question()
    run(projets, question)
    report(projets, index)


if __name__ == "__main__":
    main()
