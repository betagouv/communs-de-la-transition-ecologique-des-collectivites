"""C1 (complément) — ajoute au jeu d'entraînement les textes d'une passe complémentaire.

Les splits existants ne bougent pas (le gold a été tiré du split test) : les nouveaux
exemples sont dédupliqués contre l'existant (texte normalisé, et id), puis répartis
90/5/5 par thématique dominante, comme distill_trainset.py.

Usage : python distill_trainset_ajoute.py --tag compl --corpus data/corpus_compl.jsonl
"""

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path

from distill_trainset import NATURES_EXCLUES_TH, OUT_DIR, SEED, norm_text

BENCH_DIR = Path(__file__).parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True)
    ap.add_argument("--corpus", required=True)
    args = ap.parse_args()
    random.seed(SEED)

    meta = json.load(open(OUT_DIR / "meta.json"))
    if args.tag in meta.get("complements", {}):
        raise SystemExit(f"La passe {args.tag!r} est déjà dans le jeu d'entraînement.")
    idx = json.load(open(BENCH_DIR / f"results/distill_{args.tag}_indexes.json"))
    th_qids = sorted(idx["thematiques"])
    nat_qids = sorted(idx["natures"])
    nat_labels = [idx["natures"][q] for q in nat_qids]
    if [idx["thematiques"][q] for q in th_qids] != meta["th_labels"] or nat_labels != meta["nature_labels"]:
        raise SystemExit("Les labels de cette passe diffèrent de ceux du jeu existant — abandon.")

    vus_texte, vus_id = set(), set()
    for name in ("train", "val", "test"):
        for l in open(OUT_DIR / f"{name}.jsonl", encoding="utf-8"):
            ex = json.loads(l)
            vus_texte.add(norm_text(ex["text"]))
            vus_id.add(ex["id"])

    textes = {}
    for l in open(args.corpus, encoding="utf-8"):
        p = json.loads(l)
        t = p["nom"] + (" — " + p["description"] if p.get("description") else "")
        textes[p["id"]] = t[:2000]

    nouveaux, ecartes = [], 0
    for shard in sorted(BENCH_DIR.glob(f"results/distill_{args.tag}_0*.jsonl")):
        for l in open(shard, encoding="utf-8"):
            r = json.loads(l)
            if "error" in r or r["id"] not in textes:
                continue
            text = textes[r["id"]]
            cle = norm_text(text)
            if cle in vus_texte or r["id"] in vus_id:
                ecartes += 1
                continue
            vus_texte.add(cle)
            vus_id.add(r["id"])
            a = r["a"]
            th_vec = [round(a.get(q, 0.0), 4) for q in th_qids]
            nat_dist = a.get("nature") or {}
            nat_vec = [round(nat_dist.get(q, 0.0), 4) for q in nat_qids]
            nat_dom = nat_labels[max(range(9), key=lambda i: nat_vec[i])] if any(nat_vec) else None
            nouveaux.append({"id": r["id"], "text": text, "th": th_vec, "nature": nat_vec,
                             "th_ok": nat_dom not in NATURES_EXCLUES_TH})

    par_dom = defaultdict(list)
    for ex in nouveaux:
        dom = max(range(len(ex["th"])), key=lambda i: ex["th"][i]) if max(ex["th"]) >= 0.3 else -1
        par_dom[dom].append(ex)
    ajouts = {"train": [], "val": [], "test": []}
    for dom in sorted(par_dom):
        pool = par_dom[dom]
        random.shuffle(pool)
        for i, ex in enumerate(pool):
            ajouts["val" if i % 20 == 18 else "test" if i % 20 == 19 else "train"].append(ex)

    for name, rows in ajouts.items():
        with open(OUT_DIR / f"{name}.jsonl", "a", encoding="utf-8") as f:
            for ex in rows:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")
        meta["splits"][name] += len(rows)
    meta["exemples_total"] += len(nouveaux)
    meta["th_ok"] += sum(1 for e in nouveaux if e["th_ok"])
    meta.setdefault("complements", {})[args.tag] = {
        "ajoutes": {k: len(v) for k, v in ajouts.items()},
        "ecartes_deja_presents": ecartes,
        "note": "ajoutés en fin de fichier, non mélangés : mélanger au chargement",
    }
    json.dump(meta, open(OUT_DIR / "meta.json", "w"), ensure_ascii=False, indent=2)
    print(json.dumps({k: meta[k] for k in ("exemples_total", "th_ok", "splits", "complements")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
