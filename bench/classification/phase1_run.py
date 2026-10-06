"""Phase 1 — full labellisation of the project sample with Jev.

One request per project: 138 noul (thematiques) + 1 choice (59 sites)
+ 1 choice (15 interventions) + 4 noul (TE global / atténuation / adaptation /
biodiversité). French criteria (validated in phase 0).

Appends to results/phase1_raw.jsonl — safe to re-run, already-done ids are skipped.
"""

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import BENCH_DIR, DATA_DIR, RESULTS_DIR
from jev_client import JevError, jev_decide

WORKERS = 8

TE_QUESTIONS = {
    "te_global": "Le projet contribue directement à la transition écologique : réduction d'émissions de gaz à effet "
    "de serre, adaptation au changement climatique, biodiversité, préservation des ressources, économie circulaire, "
    "réduction des déchets ou des pollutions.",
    "te_attenuation": "Le projet contribue à l'atténuation du changement climatique : il réduit les émissions de gaz "
    "à effet de serre ou la consommation d'énergie.",
    "te_adaptation": "Le projet contribue à l'adaptation au changement climatique : il réduit la vulnérabilité aux "
    "canicules, inondations, sécheresses ou autres effets du climat.",
    "te_biodiversite": "Le projet contribue à la biodiversité : protection ou restauration d'espèces, de milieux "
    "naturels ou de continuités écologiques.",
}


def build_questions():
    ref = json.load(open(BENCH_DIR / "referentiel.json"))
    defs = json.load(open(BENCH_DIR / "definitions_thematiques.json"))

    missing = [t for t in ref["thematiques"] if t not in defs]
    if missing:
        raise SystemExit(f"definitions manquantes: {missing}")

    questions = {}
    th_index = {}
    for i, label in enumerate(ref["thematiques"]):
        qid = f"th_{i:03d}"
        th_index[qid] = label
        questions[qid] = {
            "type": "noul",
            "instructions": f"Le projet relève de la thématique « {label} » : {defs[label]}.",
        }

    site_index = {f"s{i:02d}": label for i, label in enumerate(ref["sites"])}
    questions["site"] = {
        "type": "choice",
        "instructions": "Type de site ou de lieu principal concerné par le projet.",
        "criteria": site_index,
    }

    itv_index = {f"i{i:02d}": label for i, label in enumerate(ref["interventions"])}
    questions["intervention"] = {
        "type": "choice",
        "instructions": "Type d'intervention principal du projet.",
        "criteria": itv_index,
    }

    for qid, instr in TE_QUESTIONS.items():
        questions[qid] = {"type": "noul", "instructions": instr}

    return questions, {"thematiques": th_index, "sites": site_index, "interventions": itv_index}


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    questions, indexes = build_questions()
    json.dump(indexes, open(RESULTS_DIR / "phase1_indexes.json", "w"), ensure_ascii=False)

    projets = [json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl")]

    raw_path = RESULTS_DIR / "phase1_raw.jsonl"
    done = set()
    if raw_path.exists():
        for line in open(raw_path):
            done.add(json.loads(line)["id"])
    todo = [p for p in projets if p["id"] not in done]
    print(f"{len(projets)} projets, {len(done)} deja faits, {len(todo)} a traiter")

    out = open(raw_path, "a")
    lock = threading.Lock()
    stats = {"ok": 0, "err": 0}
    start = time.monotonic()

    def run_one(p):
        state = {"intitule": p["nom"]}
        if p["description"]:
            state["description"] = p["description"]
        try:
            resp, latency = jev_decide(state, questions)
            record = {
                "id": p["id"],
                "answers": resp.get("answers", {}),
                "usage": resp.get("usage"),
                "latency_s": round(latency, 3),
            }
        except JevError as e:
            record = {"id": p["id"], "error": str(e)[:500]}
        with lock:
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            out.flush()
            stats["ok" if "answers" in record else "err"] += 1
            n = stats["ok"] + stats["err"]
            if n % 25 == 0:
                elapsed = time.monotonic() - start
                print(f"  {n}/{len(todo)} ({stats['err']} erreurs) — {elapsed:.0f}s")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(run_one, p) for p in todo]
        for f in as_completed(futures):
            f.result()

    out.close()
    print(f"termine: {stats['ok']} ok, {stats['err']} erreurs, {time.monotonic() - start:.0f}s")


if __name__ == "__main__":
    main()
