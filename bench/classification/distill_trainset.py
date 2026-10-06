"""C1 — Jeu d'entraînement de l'élève depuis les soft labels Jev.

Entrées : results/distill_full_*.jsonl (soft labels Jev, schéma riche) +
data/corpus_distill.jsonl (textes). Sorties dans data/trainset/ :
  - train.jsonl / val.jsonl / test.jsonl : {id, text, th: [170 floats], nature: [9 floats]}
  - meta.json : tailles, mapping labels, seuils, composition

Choix (brief lot C1 + dossier §4.1) :
  - cibles de l'élève : thématiques étendues (170, soft) + nature (9, soft) — le reste
    du schéma riche (leviers/compétences/BV) sert au lot C' (dérivations), pas ici ;
  - nettoyage par nature : on ÉCARTE de l'entraînement les objets dont la nature Jev
    dominante est Tâche / Moyens / Indicateur (bruit pour la tête thématique) SAUF
    pour la tête nature qui a besoin de ces classes → deux sous-ensembles :
    train thématique = filtré, train nature = tout (flag `th_ok` par exemple) ;
  - dédup fine : textes normalisés identiques → un seul exemplaire (évite la fuite
    train/test) ;
  - split 90/5/5 stratifié grossièrement par thématique dominante, graine fixe —
    le test inclura en plus le gold (gelé au lot B, ids réservés via gold_ids.txt
    s'il existe).
"""

import json
import random
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

BENCH_DIR = Path(__file__).parent
OUT_DIR = BENCH_DIR / "data" / "trainset"
SEED = 42
NATURES_EXCLUES_TH = {"Tâche", "Moyens", "Indicateur"}


def norm_text(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def main():
    random.seed(SEED)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    idx = json.load(open(BENCH_DIR / "results/distill_full_indexes.json"))
    th_qids = sorted(idx["thematiques"])  # th_000..th_169, ordre stable
    th_labels = [idx["thematiques"][q] for q in th_qids]
    nat_qids = sorted(idx["natures"])     # n0..n8
    nat_labels = [idx["natures"][q] for q in nat_qids]

    textes = {}
    for l in open(BENCH_DIR / "data/corpus_distill.jsonl", encoding="utf-8"):
        p = json.loads(l)
        t = p["nom"] + (" — " + p["description"] if p.get("description") else "")
        textes[p["id"]] = t[:2000]

    gold_path = BENCH_DIR / "data/gold_ids.txt"
    gold_ids = set(gold_path.read_text().split()) if gold_path.exists() else set()

    vus_texte = {}
    exemples = []
    for shard in sorted(BENCH_DIR.glob("results/distill_full_0*.jsonl")):
        for l in open(shard, encoding="utf-8"):
            r = json.loads(l)
            if "error" in r or r["id"] not in textes:
                continue
            a = r["a"]
            text = textes[r["id"]]
            cle = norm_text(text)
            if cle in vus_texte:
                continue
            vus_texte[cle] = r["id"]
            th_vec = [round(a.get(q, 0.0), 4) for q in th_qids]
            nat_dist = a.get("nature") or {}
            nat_vec = [round(nat_dist.get(q, 0.0), 4) for q in nat_qids]
            nat_dom = nat_labels[max(range(9), key=lambda i: nat_vec[i])] if any(nat_vec) else None
            exemples.append({
                "id": r["id"],
                "text": text,
                "th": th_vec,
                "nature": nat_vec,
                "th_ok": nat_dom not in NATURES_EXCLUES_TH,
            })

    # split stratifié par thématique dominante
    par_dom = defaultdict(list)
    for ex in exemples:
        dom = max(range(len(ex["th"])), key=lambda i: ex["th"][i]) if max(ex["th"]) >= 0.3 else -1
        par_dom[dom].append(ex)
    splits = {"train": [], "val": [], "test": []}
    for dom, pool in par_dom.items():
        random.shuffle(pool)
        for i, ex in enumerate(pool):
            if ex["id"] in gold_ids:
                splits["test"].append(ex)
            elif i % 20 == 18:
                splits["val"].append(ex)
            elif i % 20 == 19:
                splits["test"].append(ex)
            else:
                splits["train"].append(ex)

    for name, rows in splits.items():
        random.shuffle(rows)
        with open(OUT_DIR / f"{name}.jsonl", "w", encoding="utf-8") as f:
            for ex in rows:
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    meta = {
        "exemples_total": len(exemples),
        "dedup_textes_ecartes": len(textes) - len(vus_texte),
        "th_labels": th_labels,
        "nature_labels": nat_labels,
        "natures_exclues_tete_thematique": sorted(NATURES_EXCLUES_TH),
        "th_ok": sum(1 for e in exemples if e["th_ok"]),
        "splits": {k: len(v) for k, v in splits.items()},
        "gold_ids_reserves_test": len(gold_ids),
        "seed": SEED,
    }
    json.dump(meta, open(OUT_DIR / "meta.json", "w"), ensure_ascii=False, indent=2)
    print(json.dumps(meta, ensure_ascii=False, indent=2, default=str)[:1200])


if __name__ == "__main__":
    main()
