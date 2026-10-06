"""A4 — Rapport GO/NO-GO de la passe pilote.

Croise les réponses Jev (results/distill_pilote_*.jsonl) avec l'input
(data/pilote_stratifie.jsonl : labels Sonnet + nature de l'algo Jean) :
  - débit / coût / erreurs / latences
  - thématiques : accord Jev↔Sonnet (top-1 Jev ∈ labels Sonnet ; Jaccard à seuil 0,5),
    usage des 32 nouveaux labels
  - nature : accord Jev↔algo Jean (sur les cas où Jean a une nature), confusion
  - couvertures leviers / compétences / budget vert (nb d'items ≥ 0,5 par projet)
"""

import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

BENCH_DIR = Path(__file__).parent
SEUIL = 0.5


def main():
    idx = json.load(open(BENCH_DIR / "results/distill_pilote_indexes.json"))
    th_labels = idx["thematiques"]
    nat_labels = idx["natures"]
    ref = json.load(open(BENCH_DIR / "referentiel_etendu.json"))
    anciens_138 = set(json.load(open(BENCH_DIR / "referentiel.json"))["thematiques"])
    nouveaux = [l for l in ref["thematiques"] if l not in anciens_138]

    inputs = {json.loads(l)["id"]: json.loads(l) for l in open(BENCH_DIR / "data/pilote_stratifie.jsonl")}
    recs, errs, costs, lats = [], 0, [], []
    for shard in sorted(BENCH_DIR.glob("results/distill_pilote_*.jsonl")):
        for line in open(shard):
            r = json.loads(line)
            if "error" in r:
                errs += 1
                continue
            recs.append(r)
            if r.get("cost"):
                costs.append(r["cost"])
            if r.get("lat"):
                lats.append(r["lat"])

    print(f"== Volumétrie ==")
    print(f"réponses ok {len(recs)} | erreurs définitives {errs} "
          f"({100 * errs / max(1, len(recs) + errs):.2f} %)")
    print(f"coût total {sum(costs):.2f} $ — {1000 * sum(costs) / max(1, len(costs)):.3f} $/1000")
    print(f"latence/req : médiane {statistics.median(lats):.2f}s, p95 {sorted(lats)[int(len(lats) * 0.95)]:.2f}s")

    top1_in_sonnet = jacc_sum = n_cmp = 0
    usage_nouveaux = Counter()
    nat_ok = nat_n = 0
    nat_conf = Counter()
    couv = defaultdict(list)
    for r in recs:
        a = r["a"]
        inp = inputs.get(r["id"]) or {}
        jev_th = {th_labels[q]: p for q, p in a.items() if q.startswith("th_")}
        jev_pos = {l for l, p in jev_th.items() if p >= SEUIL}
        for l in jev_pos:
            if l in nouveaux:
                usage_nouveaux[l] += 1
        sonnet = set(inp.get("labels_sonnet") or [])
        if sonnet and jev_th:
            top1 = max(jev_th, key=jev_th.get)
            top1_in_sonnet += top1 in sonnet
            union = jev_pos | sonnet
            if union:
                jacc_sum += len(jev_pos & sonnet) / len(union)
            n_cmp += 1
        nat = a.get("nature")
        if isinstance(nat, dict) and inp.get("nature_jean"):
            jev_nat = nat_labels[max(nat, key=nat.get)]
            nat_n += 1
            nat_ok += jev_nat == inp["nature_jean"]
            nat_conf[(inp["nature_jean"], jev_nat)] += 1
        couv["thematiques>=0.5"].append(len(jev_pos))
        couv["leviers>=0.5"].append(sum(1 for q, p in a.items() if q.startswith("lv_") and p >= SEUIL))
        couv["competences>=0.5"].append(sum(1 for q, p in a.items() if q.startswith("cp_") and p >= SEUIL))

    print(f"\n== Thématiques vs Sonnet ({n_cmp} comparables) ==")
    print(f"top-1 Jev ∈ labels Sonnet : {100 * top1_in_sonnet / max(1, n_cmp):.1f} %")
    print(f"Jaccard moyen (seuil {SEUIL}) : {jacc_sum / max(1, n_cmp):.3f}")
    print(f"nouveaux labels utilisés : {len(usage_nouveaux)}/{len(nouveaux)} — top : "
          f"{usage_nouveaux.most_common(5)}")

    print(f"\n== Nature vs algo Jean ({nat_n} comparables) ==")
    print(f"accord brut : {100 * nat_ok / max(1, nat_n):.1f} %")
    for (jean, jev), n in nat_conf.most_common(8):
        marq = "=" if jean == jev else "≠"
        print(f"  {n:5d}  Jean « {jean} » {marq} Jev « {jev} »")

    print(f"\n== Couvertures (moyenne items ≥ {SEUIL} / projet) ==")
    for k, v in couv.items():
        print(f"  {k}: moy {statistics.mean(v):.2f}, médiane {statistics.median(v)}, max {max(v)}")


if __name__ == "__main__":
    main()
