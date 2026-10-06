"""A2/A4 — Runner Jev reprenable pour la passe professeur (pilote et passe complète).

Usage :
  python distill_run.py --input data/pilote_stratifie.jsonl --tag pilote [--limit N]
                        [--workers 8] [--no-competences] [--smoke]

Reprenable : sorties en shards results/distill_<tag>_NNN.jsonl (rotation 20 k lignes),
le set des ids déjà traités est reconstruit au démarrage depuis tous les shards du tag.
Les erreurs définitives sont écrites avec {"error": ...} et re-tentées au run suivant
(--retry-errors). Retry/backoff réseau déjà dans jev_client (alpha endpoint, ~15 % timeouts).

Compaction des réponses (indispensable à 1 M × 411 questions) :
  - noul (thématiques, leviers, compétences, TE) : probabilité gardée si p >= 0.01
  - choice (site, intervention, nature, budget vert) : distribution complète
  → soft labels suffisants pour la distillation, ~1-2 ko / projet au lieu de ~12 ko.

Stats live : débit req/s, coût cumulé (usage.cost si présent, sinon tokens), erreurs.
"""

import argparse
import json
import threading
import time
from collections import defaultdict
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

from distill_schema import build_questions
from jev_client import JevError, jev_decide

# Disjoncteur : après CONSECUTIVE_FAILURES échecs d'affilée (endpoint down, clé
# plafonnée...), tous les workers se mettent en pause ; une sonde re-tente une
# requête témoin toutes les PROBE_INTERVAL_S et rouvre le circuit quand ça répond.
CONSECUTIVE_FAILURES = 25
PROBE_INTERVAL_S = 120


class CircuitBreaker:
    def __init__(self, probe):
        self.open_evt = threading.Event()
        self.open_evt.set()  # circuit fermé = trafic autorisé
        self.fails = 0
        self.lock = threading.Lock()
        self.probe = probe

    def success(self):
        with self.lock:
            self.fails = 0

    def failure(self):
        with self.lock:
            self.fails += 1
            if self.fails >= CONSECUTIVE_FAILURES and self.open_evt.is_set():
                self.open_evt.clear()
                threading.Thread(target=self._probe_loop, daemon=True).start()
                print(f"\n⚡ disjoncteur OUVERT après {self.fails} échecs consécutifs — "
                      f"workers en pause, sonde toutes les {PROBE_INTERVAL_S}s")

    def _probe_loop(self):
        while True:
            time.sleep(PROBE_INTERVAL_S)
            try:
                self.probe()
                with self.lock:
                    self.fails = 0
                self.open_evt.set()
                print("\n⚡ endpoint de nouveau joignable — reprise")
                return
            except Exception as e:
                print(f"  sonde: toujours KO ({str(e)[:90]})")

    def wait(self):
        self.open_evt.wait()

BENCH_DIR = Path(__file__).parent
RESULTS_DIR = BENCH_DIR / "results"
SHARD_SIZE = 20_000


def compact(answers):
    out = {}
    for qid, a in answers.items():
        if not isinstance(a, dict):
            continue
        if "noul" in a:  # noul : {"type": "noul", "noul": 0.39}
            p = a["noul"]
            if p is not None and p >= 0.01:
                out[qid] = round(p, 4)
        elif "probabilities" in a:  # choice : distribution par critère
            out[qid] = {k: round(v, 4) for k, v in a["probabilities"].items() if v >= 0.005}
        elif "choice" in a:
            out[qid] = a["choice"]
    return out


class ShardWriter:
    def __init__(self, tag):
        self.tag = tag
        RESULTS_DIR.mkdir(exist_ok=True)
        self.lock = threading.Lock()
        existing = sorted(RESULTS_DIR.glob(f"distill_{tag}_*.jsonl"))
        self.done, self.errored = set(), set()
        for shard in existing:
            for line in open(shard, encoding="utf-8"):
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue  # ligne tronquée (kill en cours d'écriture) → re-traitée
                (self.errored if "error" in rec else self.done).add(rec["id"])
        self.errored -= self.done
        self.idx = int(existing[-1].stem.rsplit("_", 1)[1]) if existing else 0
        self.count_in_shard = sum(1 for _ in open(existing[-1], encoding="utf-8")) if existing else 0
        self.fh = open(RESULTS_DIR / f"distill_{tag}_{self.idx:03d}.jsonl", "a", encoding="utf-8")

    def write(self, rec):
        with self.lock:
            if self.count_in_shard >= SHARD_SIZE:
                self.fh.close()
                self.idx += 1
                self.count_in_shard = 0
                self.fh = open(RESULTS_DIR / f"distill_{self.tag}_{self.idx:03d}.jsonl", "a", encoding="utf-8")
            self.fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            self.fh.flush()
            self.count_in_shard += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--no-competences", action="store_true")
    ap.add_argument("--retry-errors", action="store_true")
    ap.add_argument("--smoke", action="store_true", help="20 projets, affiche une réponse complète")
    args = ap.parse_args()

    questions, indexes = build_questions(include_competences=not args.no_competences)
    idx_path = RESULTS_DIR / f"distill_{args.tag}_indexes.json"
    RESULTS_DIR.mkdir(exist_ok=True)
    idx_path.write_text(json.dumps(indexes, ensure_ascii=False))

    writer = ShardWriter(args.tag)
    projets = [json.loads(l) for l in open(args.input, encoding="utf-8")]
    todo = [p for p in projets if p["id"] not in writer.done
            and (args.retry_errors or p["id"] not in writer.errored)]
    if args.smoke:
        args.limit = min(args.limit or 20, 20)
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(projets)} en entrée, {len(writer.done)} déjà faits, "
          f"{len(writer.errored)} en erreur, {len(todo)} à traiter — {len(questions)} questions")

    stats = defaultdict(float)
    lock = threading.Lock()
    start = time.monotonic()
    shown = {"done": False}

    def probe():
        jev_decide({"intitule": "sonde"}, {"q": {"type": "noul", "instructions": "test"}},
                   max_retries=0, timeout=20)

    breaker = CircuitBreaker(probe)

    def run_one(p):
        breaker.wait()
        state = {"intitule": p["nom"]}
        if p.get("description"):
            state["description"] = p["description"][:4000]
        try:
            resp, latency = jev_decide(state, questions)
            usage = resp.get("usage") or {}
            # Un 200 sans contenu (endpoint dégradé) est une ERREUR, pas un résultat :
            # on exige l'essentiel des réponses et une facturation cohérente.
            if len(resp.get("answers") or {}) < len(questions) * 0.8 or not usage.get("cost"):
                raise JevError(f"réponse vide/incomplète ({len(resp.get('answers') or {})} réponses)")
            breaker.success()
            rec = {
                "id": p["id"],
                "a": compact(resp.get("answers", {})),
                "in_tok": usage.get("input_tokens"),
                "cost": usage.get("cost"),
                "lat": round(latency, 2),
            }
            if args.smoke and not shown["done"]:
                shown["done"] = True
                print("--- exemple de réponse compacte ---")
                print(json.dumps({**rec, "nom": p["nom"]}, ensure_ascii=False)[:1500])
        except JevError as e:
            breaker.failure()
            breaker.wait()  # si le circuit vient de s'ouvrir, on attend avant d'écrire l'échec
            rec = {"id": p["id"], "error": str(e)[:300]}
        writer.write(rec)
        with lock:
            stats["n"] += 1
            if "error" in rec:
                stats["err"] += 1
            else:
                stats["tok"] += rec.get("in_tok") or 0
                stats["cost"] += rec.get("cost") or 0
            if stats["n"] % 100 == 0 or stats["n"] == len(todo):
                el = time.monotonic() - start
                debit = stats["n"] / el if el else 0
                cout_1000 = (stats["cost"] / max(1, stats["n"] - stats["err"])) * 1000
                print(f"  {int(stats['n'])}/{len(todo)}  {debit:.1f} req/s  "
                      f"err {int(stats['err'])}  coût/1000 ≈ {cout_1000:.3f} $  cumul {stats['cost']:.2f} $")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(run_one, p) for p in todo]
        for f in as_completed(futures):
            f.result()

    el = time.monotonic() - start
    n_ok = int(stats["n"] - stats["err"])
    print(f"\nterminé : {n_ok} ok, {int(stats['err'])} erreurs, {el:.0f}s "
          f"({stats['n'] / el if el else 0:.1f} req/s)")
    if n_ok:
        print(f"coût total {stats['cost']:.3f} $ — {stats['cost'] / n_ok * 1000:.3f} $/1000 "
              f"— tokens entrée moyens {stats['tok'] / n_ok:.0f}")


if __name__ == "__main__":
    main()
