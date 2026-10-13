"""Étape 2 du plan révisé — score d'une « recette » de classification sur le gold figé.

Le gold (data/gold/gold_fige.jsonl, arbitré par Thomas le 13/10) donne pour chaque cas :
  - tranches thématiques (120) : la liste de thématiques de référence (éventuellement vide :
    aucun label du référentiel ne convient) ;
  - tranche nature (60) : la nature de référence.

Une recette = un fichier de prédictions jsonl, une ligne par cas :
  {"id": ..., "thematiques": {label: score, ...} | [label, ...], "nature": "..."}
Avec des scores, la liste retenue dépend de --seuil (et du repli top-1 si >= --repli).

Recettes intégrées, sans appel externe :
  --recette jev-v1     scores de la passe complète du 09/10 (shards distill_full_*)
  --recette sonnet-v1  labels Sonnet en base (proposés dans le gold)

Usage :
  python gold_eval.py --recette jev-v1 --seuil 0.7
  python gold_eval.py --predictions results/gold_<tag>.jsonl [--seuil 0.7]
  python gold_eval.py --compare jev-v1 sonnet-v1 results/gold_<tag>.jsonl
"""

import argparse
import glob
import json
import os
from collections import defaultdict
from pathlib import Path

BENCH_DIR = Path(__file__).parent
GOLD = BENCH_DIR / "data/gold/gold_fige.jsonl"
GOLD_KEY = BENCH_DIR / "data/gold/gold_key.json"
GOLD_PROJETS = BENCH_DIR / "data/gold/gold_projets.jsonl"
# shards de la passe complète : results/ sur la box, copie locale ailleurs (DISTILL_RESULTS)
SHARDS_V1 = Path(os.environ.get("DISTILL_RESULTS", BENCH_DIR / "results"))


def charge_gold():
    return [json.loads(l) for l in open(GOLD, encoding="utf-8")]


def recette_jev_v1(ids):
    idx = json.load(open(SHARDS_V1 / "distill_full_indexes.json", encoding="utf-8"))
    th, nat = idx["thematiques"], idx["natures"]
    preds = {}
    for f in sorted(glob.glob(str(SHARDS_V1 / "distill_full_0*.jsonl"))):
        for l in open(f, encoding="utf-8"):
            if l[8:44] not in ids:
                continue
            r = json.loads(l)
            if "error" in r or r["id"] in preds:
                continue
            a = r["a"]
            dist = a.get("nature") or {}
            preds[r["id"]] = {
                "thematiques": {th[q]: v for q, v in a.items() if q.startswith("th_")},
                "nature": nat[max(dist, key=dist.get)] if dist else None,
            }
    return preds


def recette_sonnet_v1(ids):
    key = json.load(open(GOLD_KEY, encoding="utf-8"))
    preds = {}
    for l in open(GOLD_PROJETS, encoding="utf-8"):
        p = json.loads(l)
        if p["id"] not in ids:
            continue
        cote = "A" if key[p["id"]]["A"] == "sonnet" else "B"
        preds[p["id"]] = {"thematiques": p["proposition_" + cote]}
        # nature : l'algo de Jean (pas de nature Sonnet en base)
        if "nature_A" in p:
            cote_n = "A" if key[p["id"]].get("nature_A") == "jean" else "B"
            preds[p["id"]]["nature_jean"] = p["nature_" + cote_n]
    return preds


def charge_predictions(source, ids):
    if source == "jev-v1":
        return recette_jev_v1(ids)
    if source == "sonnet-v1":
        return recette_sonnet_v1(ids)
    return {r["id"]: r for r in map(json.loads, open(source, encoding="utf-8")) if r["id"] in ids}


def liste_retenue(th, seuil, repli):
    if isinstance(th, list):
        return set(th)
    retenus = {k for k, v in th.items() if v >= seuil}
    if not retenus and th:
        meilleur = max(th, key=th.get)
        if th[meilleur] >= repli:
            retenus = {meilleur}
    return retenus


def score(gold, preds, seuil, repli, nature_champ="nature"):
    par_tranche = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0, "n": 0, "vides_ok": 0, "vides": 0, "manquants": 0})
    nat = {"ok": 0, "n": 0, "manquants": 0}
    for c in gold:
        p = preds.get(c["id"])
        if c["tranche"] == "nature":
            nat["n"] += 1
            if not p or not p.get(nature_champ):
                nat["manquants"] += 1
            elif p[nature_champ] == c["nature_reference"]:
                nat["ok"] += 1
            continue
        t = par_tranche[c["tranche"]]
        t["n"] += 1
        if not p or "thematiques" not in p:
            t["manquants"] += 1
            continue
        ref = set(c["thematiques_reference"])
        pred = liste_retenue(p["thematiques"], seuil, repli)
        t["tp"] += len(pred & ref)
        t["fp"] += len(pred - ref)
        t["fn"] += len(ref - pred)
        if not ref:
            t["vides"] += 1
            t["vides_ok"] += not pred
    total = {k: sum(t[k] for t in par_tranche.values()) for k in ("tp", "fp", "fn", "n", "vides_ok", "vides", "manquants")}
    return dict(par_tranche), total, nat


def prf(t):
    p = t["tp"] / (t["tp"] + t["fp"]) if t["tp"] + t["fp"] else 0.0
    r = t["tp"] / (t["tp"] + t["fn"]) if t["tp"] + t["fn"] else 0.0
    return p, r, (2 * p * r / (p + r) if p + r else 0.0)


def ligne(nom, t):
    p, r, f = prf(t)
    extra = f"  vides justes {t['vides_ok']}/{t['vides']}" if t["vides"] else ""
    manq = f"  ⚠ {t['manquants']} sans prédiction" if t["manquants"] else ""
    return f"  {nom:<20} n={t['n']:<4} P={p:.2f}  R={r:.2f}  F1={f:.2f}{extra}{manq}"


def rapport(nom, gold, preds, seuil, repli):
    par_tranche, total, nat = score(gold, preds, seuil, repli)
    print(f"\n=== {nom} (seuil {seuil}, repli {repli}) ===")
    for tr in ("desaccord_frequent", "traine", "sans_sonnet"):
        if tr in par_tranche:
            print(ligne(tr, par_tranche[tr]))
    print(ligne("TOTAL thématiques", total))
    champ = "nature" if any(p.get("nature") for p in preds.values()) else "nature_jean"
    if champ == "nature_jean":
        _, _, nat = score(gold, preds, seuil, repli, nature_champ="nature_jean")
        nom_nat = "nature (algo Jean)"
    else:
        nom_nat = "nature"
    if nat["n"] - nat["manquants"]:
        print(f"  {nom_nat:<20} {nat['ok']}/{nat['n']} justes ({nat['ok'] / nat['n']:.0%})"
              + (f"  ⚠ {nat['manquants']} sans prédiction" if nat["manquants"] else ""))
    return prf(total)[2]


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--recette", choices=["jev-v1", "sonnet-v1"])
    g.add_argument("--predictions")
    g.add_argument("--compare", nargs="+", help="recettes intégrées et/ou fichiers de prédictions")
    ap.add_argument("--seuil", type=float, default=0.7)
    ap.add_argument("--repli", type=float, default=0.5, help="garde la meilleure thématique si aucune n'atteint le seuil (1 = pas de repli)")
    ap.add_argument("--balayage", action="store_true", help="balaye les seuils 0,4-0,95 (recettes à scores)")
    args = ap.parse_args()

    gold = charge_gold()
    ids = {c["id"] for c in gold}
    sources = args.compare or [args.recette or args.predictions]
    for src in sources:
        preds = charge_predictions(src, ids)
        if args.balayage:
            print(f"\n=== {src} : balayage ===")
            for s in (0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95):
                _, total, _ = score(gold, preds, s, min(args.repli, s))
                p, r, f = prf(total)
                print(f"  seuil {s:.2f}  P={p:.2f}  R={r:.2f}  F1={f:.2f}")
        else:
            rapport(src, gold, preds, args.seuil, args.repli)


if __name__ == "__main__":
    main()
