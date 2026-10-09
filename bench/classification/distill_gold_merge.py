"""B4 (préparation) — Fusion des arbitrages gold : Jean + Thomas (+ Claude en triage).

Usage :
  python distill_gold_merge.py data/gold/verdicts_jean.json data/gold/verdicts_thomas.json \
      [--claude data/gold/verdicts_claude.json]

Règles :
  - les deux humains comptent ; Claude ne tranche jamais contre deux humains d'accord
    (circularité LLM) — il départage les désaccords humains et signale les accords suspects ;
  - accord humain (verdicts compatibles) → gold direct ;
  - désaccord → liste d'adjudication pour la session B3 (triée : vrais conflits d'abord,
    avec l'avis Claude comme éclairage) ;
  - kappa de Cohen Jean↔Thomas sur les verdicts réduits (A / = / B / 0 ; A+→A, B+→B).

Sorties : data/gold/adjudication.jsonl (cas à discuter en session),
data/gold/gold_fige_partiel.jsonl (accords, dé-anonymisés via gold_key.json),
et le rapport console (kappa, distributions, cas signalés par Claude).
"""

import argparse
import json
from collections import Counter
from pathlib import Path

BENCH_DIR = Path(__file__).parent
GOLD_DIR = BENCH_DIR / "data" / "gold"

REDUCTION = {"A": "A", "A+": "A", "=": "=", "B+": "B", "B": "B", "0": "0"}


def reduit(v, champ):
    return REDUCTION.get((v or {}).get(champ, ""), None)


def kappa(paires):
    n = len(paires)
    if not n:
        return float("nan")
    accord = sum(1 for a, b in paires if a == b) / n
    ca, cb = Counter(a for a, _ in paires), Counter(b for _, b in paires)
    attendu = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / n**2
    return (accord - attendu) / (1 - attendu) if attendu < 1 else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("jean")
    ap.add_argument("thomas")
    ap.add_argument("--claude")
    args = ap.parse_args()

    vj = json.load(open(args.jean, encoding="utf-8"))
    vt = json.load(open(args.thomas, encoding="utf-8"))
    vc = json.load(open(args.claude, encoding="utf-8")) if args.claude else {}
    key = json.load(open(GOLD_DIR / "gold_key.json", encoding="utf-8"))
    cas = {json.loads(l)["id"]: json.loads(l) for l in open(GOLD_DIR / "gold_projets.jsonl", encoding="utf-8")}

    accords, adjudication, signales = [], [], []
    paires_th, paires_nat = [], []
    for cid, c in cas.items():
        champ = "nature" if c["tranche"] == "nature" else "verdict"
        j, t = reduit(vj.get(cid), champ), reduit(vt.get(cid), champ)
        cl = reduit(vc.get(cid), champ)
        if j is None or t is None:
            adjudication.append({**c, "raison": "verdict manquant", "jean": j, "thomas": t, "claude": cl})
            continue
        (paires_nat if champ == "nature" else paires_th).append((j, t))
        if j == t:
            entree = {**c, "verdict_humain": j, "cle": key[cid]}
            if cl and cl != j:
                entree["claude_diverge"] = cl
                signales.append(entree)
            accords.append(entree)
        else:
            adjudication.append({**c, "raison": "désaccord humain", "jean": j, "thomas": t, "claude": cl,
                                 "cle": key[cid]})

    with open(GOLD_DIR / "gold_fige_partiel.jsonl", "w", encoding="utf-8") as f:
        for e in accords:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    with open(GOLD_DIR / "adjudication.jsonl", "w", encoding="utf-8") as f:
        for e in adjudication:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    print(f"cas: {len(cas)} | accords humains: {len(accords)} | à adjuger: {len(adjudication)} "
          f"| accords où Claude diverge (à re-regarder): {len(signales)}")
    print(f"kappa Jean↔Thomas — thématiques: {kappa(paires_th):.3f} ({len(paires_th)} cas) "
          f"| nature: {kappa(paires_nat):.3f} ({len(paires_nat)} cas)")
    for nom, v in (("Jean", vj), ("Thomas", vt), ("Claude", vc)):
        if v:
            dist = Counter(REDUCTION.get(x.get("verdict") or x.get("nature") or "", "?") for x in v.values())
            print(f"  distribution {nom}: {dict(dist)}")


if __name__ == "__main__":
    main()
