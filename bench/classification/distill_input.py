"""A3 — Sélection de l'input pour la passe professeur Jev.

Source : data_projets_consolides.projets (la base consolidée ~1,14 M, prod read-only
via tunnel). PAS de filtre nature (la passe la produit). Dédup grossière par clé
(nom normalisé + SIREN) en gardant la ligne la plus riche (description la plus
longue, puis plus de sources).

Produit dans data/ :
  - corpus_distill.jsonl        : tout le corpus dédupliqué (la passe complète pioche ici)
  - pilote_stratifie.jsonl      : ~8 k pour la passe pilote A4 — stratifié sur les labels
    Sonnet en base (jusqu'à N par label, classes rares sur-échantillonnées de fait)
    + une tranche aléatoire du stock NON labellisé (DETR/CIL/DECP sans labels)
  - distill_input_stats.json    : volumétrie et composition

Relançable à l'identique (requête déterministe, graine fixée).
"""

import json
import random
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import psycopg

from common import load_env
import os

BENCH_DIR = Path(__file__).parent
DATA_DIR = BENCH_DIR / "data"

PILOTE_PAR_LABEL = 40  # ~40 ex / label Sonnet → couvre les 168 classes observées
PILOTE_NON_LABELLISE = 1500
SEED = 42


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def main():
    load_env()
    random.seed(SEED)
    DATA_DIR.mkdir(exist_ok=True)

    conn = psycopg.connect(os.environ["BENCH_DATABASE_URL"])
    conn.execute("SET default_transaction_read_only = on")
    cur = conn.cursor("corpus", scrollable=False)
    cur.itersize = 20_000
    cur.execute("""
        SELECT id::text, nom, description, collectivite_responsable_siren,
               sources::text, budget_retenu, nature, classification_thematiques
        FROM data_projets_consolides.projets
        WHERE nom IS NOT NULL AND length(trim(nom)) >= 3
    """)

    best = {}  # cle dedup -> record
    n_rows = 0
    for pid, nom, desc, siren, sources, budget, nature_jean, labels in cur:
        n_rows += 1
        cle = norm(nom) + "|" + (siren or "")
        rec = {
            "id": pid,
            "nom": nom.strip(),
            "description": (desc or "").strip() or None,
            "siren": siren,
            "sources": sources,
            "budget": budget,
            "nature_jean": nature_jean,
            "labels_sonnet": labels,
        }
        prev = best.get(cle)
        if prev is None or (len(rec["description"] or "") , rec["sources"].count(",")) > (
            len(prev["description"] or ""), prev["sources"].count(",")):
            best[cle] = rec
    conn.close()

    corpus = list(best.values())
    with open(DATA_DIR / "corpus_distill.jsonl", "w", encoding="utf-8") as f:
        for rec in corpus:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # --- pilote stratifié ---------------------------------------------------
    par_label = defaultdict(list)
    non_labellises = []
    for rec in corpus:
        if rec["labels_sonnet"]:
            for lab in rec["labels_sonnet"]:
                par_label[lab].append(rec)
        else:
            non_labellises.append(rec)

    pilote, vus = [], set()

    def ajoute(rec):
        if rec["id"] not in vus:
            vus.add(rec["id"])
            pilote.append(rec)

    for lab in sorted(par_label):
        pool = par_label[lab]
        random.shuffle(pool)
        for rec in pool[:PILOTE_PAR_LABEL]:
            ajoute(rec)
    random.shuffle(non_labellises)
    for rec in non_labellises[:PILOTE_NON_LABELLISE]:
        ajoute(rec)

    random.shuffle(pilote)
    with open(DATA_DIR / "pilote_stratifie.jsonl", "w", encoding="utf-8") as f:
        for rec in pilote:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    stats = {
        "lignes_source": n_rows,
        "corpus_dedup": len(corpus),
        "avec_labels_sonnet": sum(1 for r in corpus if r["labels_sonnet"]),
        "avec_description": sum(1 for r in corpus if r["description"]),
        "labels_distincts": len(par_label),
        "pilote": {
            "total": len(pilote),
            "non_labellises": sum(1 for r in pilote if not r["labels_sonnet"]),
            "par_label_cible": PILOTE_PAR_LABEL,
        },
    }
    json.dump(stats, open(DATA_DIR / "distill_input_stats.json", "w"), indent=2, ensure_ascii=False)
    print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
