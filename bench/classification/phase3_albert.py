"""Phase 3 (e) — Gemma 4 31B on Albert API, unary decomposition + logprobs.

Same protocol as Jev where the 100 RPM quota allows:
  - te_global on all projects (1 req each)
  - pairs on all pairs (1 req each)
  - thematiques: 138 unary questions on a 20-project subset (~2760 req)

Incremental JSONL outputs — safe to re-run.
"""

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from albert_client import AlbertError, albert_noul
from common import BENCH_DIR, DATA_DIR, RESULTS_DIR

WORKERS = 6
N_TH_PROJECTS = 20

TE_PROMPT = (
    "Projet de collectivité :\n{state}\n\n"
    "Question : ce projet contribue-t-il directement à la transition écologique "
    "(réduction d'émissions de gaz à effet de serre, adaptation au changement climatique, biodiversité, "
    "préservation des ressources, économie circulaire, réduction des déchets ou des pollutions) ?\n\n"
    "Réponds uniquement par Oui ou Non."
)

PAIR_PROMPT = (
    "Projet a :\n{a}\n\nProjet b :\n{b}\n\n"
    "Question : les projets a et b désignent-ils le même projet réel — la même opération concrète, "
    "portée par la même collectivité, sur le même objet et le même lieu, éventuellement décrite "
    "différemment par deux sources ou deux dispositifs de financement ?\n\n"
    "Réponds uniquement par Oui ou Non."
)

TH_PROMPT = (
    "Projet de collectivité :\n{state}\n\n"
    "Question : ce projet relève-t-il de la thématique « {label} » ({definition}) ?\n\n"
    "Réponds uniquement par Oui ou Non."
)


def fmt_state(nom, description):
    return f"- Intitulé : {nom}" + (f"\n- Description : {description}" if description else "")


def run_batch(tasks, out_path, done_key):
    """tasks: list of (key_dict, prompt). Appends {**key, p, latency} to out_path."""
    done = set()
    if out_path.exists():
        done = {done_key(json.loads(l)) for l in open(out_path)}
    todo = [(k, prompt) for k, prompt in tasks if done_key(k) not in done]
    print(f"{out_path.name}: {len(tasks)} taches, {len(done)} deja faites, {len(todo)} a traiter")
    if not todo:
        return

    out = open(out_path, "a")
    lock = threading.Lock()
    count = [0]
    start = time.monotonic()

    def one(key, prompt):
        try:
            p, latency = albert_noul(prompt)
            rec = {**key, "p": round(p, 4), "latency_s": round(latency, 3)}
        except AlbertError as e:
            rec = {**key, "error": str(e)[:300]}
        with lock:
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            out.flush()
            count[0] += 1
            if count[0] % 100 == 0:
                rate = count[0] / (time.monotonic() - start) * 60
                print(f"  {count[0]}/{len(todo)} ({rate:.0f} req/min)")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for f in as_completed([pool.submit(one, k, pr) for k, pr in todo]):
            f.result()
    out.close()
    print(f"  termine en {time.monotonic() - start:.0f}s")


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    projets = [json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl")]
    paires = [json.loads(l) for l in open(DATA_DIR / "paires_sample.jsonl")]
    ref = json.load(open(BENCH_DIR / "referentiel.json"))
    defs = json.load(open(BENCH_DIR / "definitions_thematiques.json"))

    # 1. TE on all projects
    te_tasks = [({"id": p["id"]}, TE_PROMPT.format(state=fmt_state(p["nom"], p["description"])))
                for p in projets]
    run_batch(te_tasks, RESULTS_DIR / "albert_te.jsonl", lambda k: k["id"])

    # 2. Pairs
    pair_tasks = [({"id_a": p["id_a"], "id_b": p["id_b"]},
                   PAIR_PROMPT.format(a=fmt_state(p["nom_a"], p["description_a"]),
                                      b=fmt_state(p["nom_b"], p["description_b"])))
                  for p in paires]
    run_batch(pair_tasks, RESULTS_DIR / "albert_paires.jsonl", lambda k: (k["id_a"], k["id_b"]))

    # 3. Thematiques, unary, on a deterministic subset: classified projects with description
    subset = sorted((p for p in projets if p["llm_thematiques"] and p["description"]),
                    key=lambda p: p["id"])[:N_TH_PROJECTS]
    th_tasks = []
    for p in subset:
        state = fmt_state(p["nom"], p["description"])
        for label in ref["thematiques"]:
            th_tasks.append(({"id": p["id"], "label": label},
                             TH_PROMPT.format(state=state, label=label, definition=defs[label])))
    run_batch(th_tasks, RESULTS_DIR / "albert_thematiques.jsonl", lambda k: (k["id"], k["label"]))


if __name__ == "__main__":
    main()
