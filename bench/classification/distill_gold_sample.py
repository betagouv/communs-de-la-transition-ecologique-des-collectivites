"""B1 — Échantillon gold, tiré du split TEST (zéro fuite), concentré sur les désaccords.

Composition (brief lot B) :
  - 120 projets « thématiques » :
      60 désaccords fréquents   (top-1 Jev ∉ labels Sonnet, classes fréquentes)
      40 traîne                 (labels rares, dont les 32 ajouts Jean)
      20 sans labels Sonnet     (stock DETR/CIL — Jev à l'aveugle)
  - 60 cas « nature », sur-échantillonnés sur les désaccords Jev ↔ algo Jean
    (notamment Diagnostic→Projet op. et Action→Dispositif/Médiation)

Sorties : data/gold/gold_projets.jsonl (cas + propositions des deux algos,
anonymisées A/B pour l'arbitrage en aveugle), data/gold/gold_key.json
(correspondance A/B → algo, à ne PAS montrer à l'arbitre), data/gold_ids.txt
(réservation pour les splits).
"""

import json
import random
from collections import Counter, defaultdict
from pathlib import Path

BENCH_DIR = Path(__file__).parent
GOLD_DIR = BENCH_DIR / "data" / "gold"
SEED = 2026

N_DESACCORDS_FREQUENTS = 60
N_TRAINE = 40
N_SANS_SONNET = 20
N_NATURE = 60
SEUIL_TRAINE = 300  # un label est « traîne » s'il a < 300 occurrences Sonnet en base


def main():
    random.seed(SEED)
    GOLD_DIR.mkdir(parents=True, exist_ok=True)

    idx = json.load(open(BENCH_DIR / "results/distill_full_indexes.json"))
    th_map = idx["thematiques"]
    nat_map = idx["natures"]

    test_ids = set()
    for l in open(BENCH_DIR / "data/trainset/test.jsonl", encoding="utf-8"):
        test_ids.add(json.loads(l)["id"])

    corpus = {}
    freq_sonnet = Counter()
    for l in open(BENCH_DIR / "data/corpus_distill.jsonl", encoding="utf-8"):
        p = json.loads(l)
        if p["labels_sonnet"]:
            freq_sonnet.update(p["labels_sonnet"])
        if p["id"] in test_ids:
            corpus[p["id"]] = p
    traine_labels = {l for l, n in freq_sonnet.items() if n < SEUIL_TRAINE}

    pools = defaultdict(list)
    for shard in sorted(BENCH_DIR.glob("results/distill_full_0*.jsonl")):
        for l in open(shard, encoding="utf-8"):
            r = json.loads(l)
            p = corpus.get(r.get("id"))
            if p is None or "error" in r:
                continue
            a = r["a"]
            jev_th = {th_map[q]: v for q, v in a.items() if q.startswith("th_")}
            if not jev_th:
                continue
            jev_top = sorted(jev_th, key=jev_th.get, reverse=True)[:3]
            jev_pos = {l for l, v in jev_th.items() if v >= 0.5}
            sonnet = set(p["labels_sonnet"] or [])
            nat_dist = a.get("nature") or {}
            jev_nat = nat_map[max(nat_dist, key=nat_dist.get)] if nat_dist else None
            cas = {
                "id": p["id"], "nom": p["nom"], "description": p.get("description"),
                "sources": p["sources"], "jev_top3": jev_top,
                "jev_pos": sorted(jev_pos), "sonnet": sorted(sonnet),
                "jev_nature": jev_nat, "nature_jean": p.get("nature_jean"),
            }
            if not sonnet:
                pools["sans_sonnet"].append(cas)
            elif jev_top[0] not in sonnet:
                if (jev_pos | sonnet) & traine_labels:
                    pools["traine_desaccord"].append(cas)
                else:
                    pools["desaccord_frequent"].append(cas)
            elif (jev_pos | sonnet) & traine_labels:
                pools["traine_accord"].append(cas)
            if jev_nat and p.get("nature_jean") and jev_nat != p["nature_jean"]:
                pools["nature_desaccord"].append(cas)

    for k in pools:
        random.shuffle(pools[k])

    gold = []
    gold += [dict(c, tranche="desaccord_frequent") for c in pools["desaccord_frequent"][:N_DESACCORDS_FREQUENTS]]
    traine = (pools["traine_desaccord"] + pools["traine_accord"])[:N_TRAINE]
    gold += [dict(c, tranche="traine") for c in traine]
    gold += [dict(c, tranche="sans_sonnet") for c in pools["sans_sonnet"][:N_SANS_SONNET]]
    deja = {c["id"] for c in gold}
    nature = [c for c in pools["nature_desaccord"] if c["id"] not in deja][:N_NATURE]
    gold += [dict(c, tranche="nature") for c in nature]

    # anonymisation A/B par cas (ordre aléatoire algo↔lettre), clé séparée
    key = {}
    for c in gold:
        inv = random.random() < 0.5
        c["proposition_A"] = c.pop("sonnet") if inv else c.pop("jev_pos")
        c["proposition_B"] = c.pop("jev_pos") if inv else c.pop("sonnet")
        key[c["id"]] = {"A": "sonnet" if inv else "jev", "B": "jev" if inv else "sonnet"}
        if c["tranche"] == "nature":
            inv_n = random.random() < 0.5
            c["nature_A"] = c.pop("nature_jean") if inv_n else c.pop("jev_nature")
            c["nature_B"] = c.pop("jev_nature") if inv_n else c.pop("nature_jean")
            key[c["id"]]["nature_A"] = "jean" if inv_n else "jev"
            key[c["id"]]["nature_B"] = "jev" if inv_n else "jean"

    with open(GOLD_DIR / "gold_projets.jsonl", "w", encoding="utf-8") as f:
        for c in gold:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    json.dump(key, open(GOLD_DIR / "gold_key.json", "w", encoding="utf-8"), ensure_ascii=False)
    (BENCH_DIR / "data/gold_ids.txt").write_text("\n".join(c["id"] for c in gold))

    print(json.dumps({
        "pools": {k: len(v) for k, v in pools.items()},
        "gold": dict(Counter(c["tranche"] for c in gold)),
        "total": len(gold),
    }, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
