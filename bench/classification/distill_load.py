"""D4 — Charge les scores de la passe professeur dans la base consolidée.

Écrit dans data_projets_consolides.labels_methodes / labels_referentiel (la méthode et
sa nomenclature codée), labels_scores (une ligne par texte classifié) et
labels_rattachements (chaque projet → la ligne classifiée de même titre + SIREN).
N'écrit JAMAIS dans data_projets_consolides.projets.

Usage :
  LOAD_DATABASE_URL=postgres://... python distill_load.py \
      --results <dossier des shards distill_full_*.jsonl> [--methode jev-1.13/schema-riche-v1]
      [--plancher 0.4] [--replace] [--dry-run]

Réversible : DELETE FROM labels_methodes WHERE methode = '<méthode>' (cascade sur les
trois autres tables), ou --replace pour recharger. Tout tient dans une transaction.

Ce qui est gardé en base (le détail complet reste dans les shards) :
  - thématiques, leviers, compétences : scores >= plancher (défaut 0,4 — couvre les
    seuils plausibles ; le seuil de lecture se règle ensuite sans rechargement) ;
  - site, intervention, nature : distribution (probabilités >= 0,1) ;
  - budget vert : cotation dominante de chaque axe, avec sa probabilité ;
  - probabilités TE : toutes.
Stockage codé (codes smallint + scores en centièmes), décodé par labels_referentiel.

Les projets dont le texte n'a pas été classifié (lignes arrivées en base après
l'extraction du corpus) sont listés dans <results>/non_rattaches.csv : ils demandent
une passe complémentaire.
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import psycopg

BENCH_DIR = Path(__file__).parent
SCHEMA = "data_projets_consolides"
PLANCHER_CHOIX = 0.1
BV_COTATIONS = {"fav": "favorable", "neu": "neutre", "def": "défavorable", "nc": "non coté"}


def norm(s):
    """Même normalisation que distill_input.py — la clé de dédup doit être identique."""
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def cle(nom, siren):
    return norm(nom) + "|" + (siren or "")


def construit_referentiel(idx):
    """Nomenclature codée de la méthode : [(code, famille, label, detail)] + qid → code."""
    lignes, code_de = [], {}

    def ajoute(cle_ref, famille, label, detail=None):
        code = len(lignes) + 1
        lignes.append((code, famille, label, detail))
        code_de[cle_ref] = code

    for qid, label in sorted(idx["thematiques"].items()):
        ajoute(qid, "thematiques", label)
    for k, label in sorted(idx["sites"].items()):
        ajoute(("site", k), "sites", label)
    for k, label in sorted(idx["interventions"].items()):
        ajoute(("intervention", k), "interventions", label)
    for k, label in sorted(idx["natures"].items()):
        ajoute(("nature", k), "nature", label)
    for qid, label in sorted(idx["leviers"].items()):
        ajoute(qid, "leviers", label)
    for qid, comp in sorted(idx["competences"].items()):
        ajoute(qid, "competences", comp["code"], comp["nom"])
    for te in ("global", "attenuation", "adaptation", "biodiversite"):
        ajoute(f"te_{te}", "te", te)
    for axe in idx["budget_vert"]["axes"]:
        for k, cotation in BV_COTATIONS.items():
            ajoute((axe, k), axe, cotation)
    return lignes, code_de


def compacte(answers, code_de, plancher):
    """Réponses brutes du professeur ({qid: proba}) → (codes, scores en centièmes)."""
    codes, scores = [], []

    def garde(cle_ref, proba):
        codes.append(code_de[cle_ref])
        scores.append(round(proba * 100))

    for qid, v in answers.items():
        if qid[:3] in ("th_", "lv_", "cp_"):
            if v >= plancher:
                garde(qid, v)
        elif qid.startswith("te_"):
            garde(qid, v)
        elif qid.startswith("bv_"):
            if v:
                k = max(v, key=v.get)
                garde((qid, k), v[k])
        elif qid in ("site", "intervention", "nature"):
            for k, proba in v.items():
                if proba >= PLANCHER_CHOIX:
                    garde((qid, k), proba)
    return codes, scores


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True, help="dossier contenant distill_full_*.jsonl et distill_full_indexes.json")
    ap.add_argument("--corpus", default=str(BENCH_DIR / "data/corpus_distill.jsonl"))
    ap.add_argument("--methode", default="jev-1.13/schema-riche-v1")
    ap.add_argument("--plancher", type=float, default=0.4)
    ap.add_argument("--replace", action="store_true", help="supprime d'abord les lignes de cette méthode")
    ap.add_argument("--dry-run", action="store_true", help="calcule les rattachements, n'écrit rien")
    args = ap.parse_args()

    url = os.environ.get("LOAD_DATABASE_URL")
    if not url:
        sys.exit("LOAD_DATABASE_URL requis.")
    results = Path(args.results)
    idx = json.load(open(results / "distill_full_indexes.json", encoding="utf-8"))

    # 1. clé de dédup → ligne classifiée (le corpus est déjà dédupliqué : une ligne par clé)
    source_par_cle = {}
    for line in open(args.corpus, encoding="utf-8"):
        p = json.loads(line)
        source_par_cle[cle(p["nom"], p["siren"])] = p["id"]
    print(f"corpus : {len(source_par_cle)} textes classifiés")

    conn = psycopg.connect(url)
    try:
        # 2. chaque projet de la base → sa ligne classifiée
        rattachements, non_rattaches = [], []
        with conn.cursor("projets") as cur:
            cur.itersize = 50_000
            cur.execute(f"SELECT id::text, nom, collectivite_responsable_siren FROM {SCHEMA}.projets")
            for pid, nom, siren in cur:
                source = source_par_cle.get(cle(nom, siren))
                if source:
                    rattachements.append((pid, source))
                else:
                    non_rattaches.append((pid, nom, siren))
        sources_utiles = {s for _, s in rattachements}
        total = len(rattachements) + len(non_rattaches)
        print(f"base : {total} projets — {len(rattachements)} rattachés à {len(sources_utiles)} textes classifiés, "
              f"{len(non_rattaches)} sans texte classifié")

        with open(results / "non_rattaches.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["projet_id", "nom", "siren"])
            w.writerows(non_rattaches)

        if args.dry_run:
            print("dry-run : rien d'écrit.")
            return

        referentiel, code_de = construit_referentiel(idx)
        with conn.cursor() as cur:
            cur.execute(f"SELECT id FROM {SCHEMA}.labels_methodes WHERE methode = %s", (args.methode,))
            existante = cur.fetchone()
            if existante and not args.replace:
                sys.exit(f"La méthode {args.methode!r} est déjà chargée — relancer avec --replace.")
            if existante:
                cur.execute(f"DELETE FROM {SCHEMA}.labels_methodes WHERE id = %s", (existante[0],))
            cur.execute(f"SELECT coalesce(max(id), 0) + 1 FROM {SCHEMA}.labels_methodes")
            methode_id = cur.fetchone()[0]
            cur.execute(
                f"INSERT INTO {SCHEMA}.labels_methodes (id, methode, description) VALUES (%s, %s, %s)",
                (methode_id, args.methode,
                 f"Passe professeur, schéma riche ; scores gardés au plancher {args.plancher} "
                 f"(thématiques, leviers, compétences) et {PLANCHER_CHOIX} (site, intervention, nature)"),
            )
            cur.executemany(
                f"INSERT INTO {SCHEMA}.labels_referentiel (methode_id, code, famille, label, detail) "
                "VALUES (%s, %s, %s, %s, %s)",
                [(methode_id, *ligne) for ligne in referentiel],
            )

            # 3. scores des textes utiles (un seul enregistrement valide par texte)
            charges = set()
            with cur.copy(f"COPY {SCHEMA}.labels_scores (source_projet_id, methode_id, codes, scores) FROM STDIN") as copy:
                copy.set_types(["text", "int2", "int2[]", "int2[]"])
                for shard in sorted(results.glob("distill_full_0*.jsonl")):
                    for line in open(shard, encoding="utf-8"):
                        r = json.loads(line)
                        if "error" in r or r["id"] not in sources_utiles or r["id"] in charges:
                            continue
                        charges.add(r["id"])
                        codes, scores = compacte(r["a"], code_de, args.plancher)
                        copy.write_row((r["id"], methode_id, codes, scores))
            manquants = sources_utiles - charges
            if manquants:
                raise SystemExit(f"{len(manquants)} textes rattachés sans scores dans les shards — abandon (rien d'écrit).")

            with cur.copy(f"COPY {SCHEMA}.labels_rattachements (projet_id, methode_id, source_projet_id) FROM STDIN") as copy:
                copy.set_types(["text", "int2", "text"])
                for pid, source in rattachements:
                    copy.write_row((pid, methode_id, source))

            cur.execute(f"SELECT pg_total_relation_size('{SCHEMA}.labels_scores'), "
                        f"pg_total_relation_size('{SCHEMA}.labels_rattachements')")
            t_scores, t_ratt = cur.fetchone()
        conn.commit()
        print(f"chargé : {len(charges)} lignes de scores ({t_scores / 1e6:.0f} Mo), "
              f"{len(rattachements)} rattachements ({t_ratt / 1e6:.0f} Mo) — méthode {args.methode} (id {methode_id})")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
