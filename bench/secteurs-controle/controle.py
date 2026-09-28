#!/usr/bin/env python3
"""Run de contrôle qualité du mapping secteurs — recommandation de la revue du 28/09.

Pour chaque fiche action TeT du stock (lecture seule) :
  (a) le secteur dominant du mapping déterministe (formule exacte de l'endpoint,
      sémantique directe) + la règle (label) qui a le plus contribué à ce dominant ;
  (b) le jugement Jev : choice 8 secteurs + non_attribuable, posé DANS LA SÉMANTIQUE
      TeT (« secteur que l'action vise », pas inventaire d'émissions), avec confiance.

Désaccords flagués :
  CONTRADICTION : mapping sectorisé, Jev confiant (>= 0.8) sur un AUTRE secteur
  RECUPERABLE   : mapping non attribuable, Jev confiant sur un secteur

Sorties (~/Projects/workspace/exports) :
  secteurs-controle-<date>.csv          — une ligne par fiche en désaccord
  secteurs-controle-<date>-regles.md    — agrégat par règle de mapping (pour Jean)
Reprise sur interruption : les jugements sont append-only dans results/.

Usage : bench/classification/.venv, clés dans bench/classification/.env
  python3 controle.py [--limit N]
"""

import csv
import json
import os
import re
import sys
import threading
import time
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).parent
RESULTS = HERE / "results"
EXPORTS = Path.home() / "Projects/workspace/exports"
TODAY = time.strftime("%Y-%m-%d")
CONCURRENCY = 8
SEUIL_CONFIANCE = 0.8

SECTEURS = ["residentiel", "tertiaire", "transport_routier", "autres_transports",
            "agriculture", "dechets", "industrie_hors_branche_energie", "branche_energie"]

POIDS = {"th": 1.0, "si": 0.35, "le": 1.5}
LISSAGE = 0.5


def load_env():
    for line in (HERE.parent / "classification/.env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def load_mapping():
    """Lit la table depuis la source du repo (const généré de l'endpoint)."""
    src = HERE.parent.parent / "api/src/fiches-action/secteurs/secteurs-mapping.const.ts"
    text = src.read_text()
    tables = {}
    for name, key in (("MAPPING_THEMATIQUES", "th"), ("MAPPING_SITES", "si"), ("MAPPING_LEVIERS", "le")):
        block = text.split(f"export const {name}")[1].split("};")[0]
        table = {}
        for m in re.finditer(r'"([^"]+)": \{ direct: (\[[^\]]*\])', block):
            table[m.group(1)] = json.loads(m.group(2))
        tables[key] = table
    return tables


def mapping_dominant(scores, leviers, tables):
    """Retourne (dominant|None, regle dominante 'type:label'|None)."""
    masses = [0.0] * 8
    contrib = defaultdict(lambda: [0.0] * 8)  # regle -> masses
    def add(label, score, key):
        parts = tables[key].get(norm(label))
        if not parts:
            return
        w = POIDS[key] * score
        for s in range(8):
            masses[s] += w * parts[s] / 100
            contrib[f"{key}:{label}"][s] += w * parts[s] / 100
    for t in (scores or {}).get("thematiques") or []:
        add(t["label"], t["score"], "th")
    for t in (scores or {}).get("sites") or []:
        add(t["label"], t["score"], "si")
    for l in leviers or []:
        add(l, 1.0, "le")
    mx = max(masses)
    if mx <= LISSAGE:
        return None, None
    dom = masses.index(mx)
    regle = max(contrib.items(), key=lambda kv: kv[1][dom])[0] if contrib else None
    return SECTEURS[dom], regle


JEV_INSTRUCTIONS = (
    "Dans un plan climat de collectivité, chaque fiche action est rattachée au secteur "
    "réglementaire d'émissions qu'elle VISE — pas à un inventaire des émissions produites "
    "par l'activité elle-même. Une action de sensibilisation au tri se rattache aux déchets ; "
    "une animation vélo aux transports ; une étude sur la rénovation au secteur des bâtiments "
    "concernés. Choisis le secteur de rattachement de cette fiche ; non_attribuable UNIQUEMENT "
    "si la fiche ne vise aucun secteur identifiable (gouvernance générale, intitulé muet)."
)
JEV_CRITERIA = {
    "residentiel": "logement, habitat, parc résidentiel",
    "tertiaire": "bâtiments et activités de services publics ou privés (écoles, bureaux, commerces, équipements)",
    "transport_routier": "déplacements routiers motorisés (voitures, camions, circulation, stationnement)",
    "autres_transports": "mobilités actives, ferroviaire, fluvial (vélo, marche, train)",
    "agriculture": "agriculture, élevage, alimentation, forêt",
    "dechets": "déchets, économie circulaire, réemploi, assainissement",
    "industrie_hors_branche_energie": "activités et procédés industriels",
    "branche_energie": "production et distribution d'énergie (ENR, réseaux de chaleur, photovoltaïque)",
    "non_attribuable": "aucun secteur identifiable",
}


def jev_judge(nom, description, max_retries=5):
    state = {"intitule": nom}
    if description:
        state["description"] = description[:400]
    body = json.dumps({
        "model": "typesafe/jev-1.13",
        "state": state,
        "questions": {"secteur": {"type": "choice", "instructions": JEV_INSTRUCTIONS, "criteria": JEV_CRITERIA}},
    }).encode()
    last = ""
    for attempt in range(max_retries):
        req = urllib.request.Request(
            "https://openrouter.ai/api/alpha/decisions", data=body,
            headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                a = json.loads(resp.read())["answers"]["secteur"]
            return a.get("choice"), a.get("confidence", 0)
        except Exception as e:  # noqa: BLE001
            last = str(e)[:120]
            time.sleep(2 ** attempt * 0.5)
    raise RuntimeError(last)


def main():
    load_env()
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    tables = load_mapping()
    RESULTS.mkdir(exist_ok=True)

    import psycopg
    conn = psycopg.connect(os.environ["BENCH_DATABASE_URL"])
    conn.execute("SET default_transaction_read_only = on")
    cur = conn.execute("""
        SELECT f.id::text, e.external_id, f.nom, left(f.description, 400), f.classification_scores, f.leviers_sgpe
        FROM data_tet.fiches_action f
        LEFT JOIN data_tet.external_ids e ON e.objet_id = f.id AND e.objet_type = 'fiche_action'
        WHERE f.nom IS NOT NULL AND (f.classification_scores IS NOT NULL
              OR (f.leviers_sgpe IS NOT NULL AND array_length(f.leviers_sgpe, 1) > 0))""")
    fiches = cur.fetchall()
    conn.close()
    if limit:
        fiches = fiches[:limit]
    print(f"{len(fiches)} fiches a controler")

    raw_path = RESULTS / "jugements.jsonl"
    done = set()
    if raw_path.exists():
        done = {json.loads(l)["id"] for l in open(raw_path)}
    todo = [f for f in fiches if f[0] not in done]
    print(f"{len(done)} deja jugees, {len(todo)} a juger")

    out = open(raw_path, "a")
    lock = threading.Lock()
    count = [0, 0]
    start = time.monotonic()

    def one(f):
        fid, ext, nom, desc, scores, leviers = f
        try:
            choice, conf = jev_judge(nom, desc)
            rec = {"id": fid, "jev": choice, "conf": conf}
        except Exception as e:  # noqa: BLE001
            rec = {"id": fid, "erreur": str(e)[:120]}
        with lock:
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count[0] += 1
            count[1] += "erreur" in rec
            if count[0] % 2000 == 0:
                out.flush()
                rate = count[0] / (time.monotonic() - start)
                print(f"  {count[0]}/{len(todo)} ({count[1]} err, {rate:.0f}/s, reste ~{(len(todo)-count[0])/rate/60:.0f} min)")

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        for fut in as_completed([pool.submit(one, f) for f in todo]):
            fut.result()
    out.close()

    # ---- analyse
    jugements = {}
    for l in open(raw_path):
        r = json.loads(l)
        if "jev" in r:
            jugements[r["id"]] = (r["jev"], r["conf"])

    stats = Counter()
    contradictions = []
    recuperables = []
    par_regle = Counter()
    for fid, ext, nom, desc, scores, leviers in fiches:
        j = jugements.get(fid)
        if not j:
            stats["sans_jugement"] += 1
            continue
        jev, conf = j
        dom, regle = mapping_dominant(scores, leviers, tables)
        if dom is None:
            if jev != "non_attribuable" and conf >= SEUIL_CONFIANCE:
                stats["recuperable"] += 1
                recuperables.append((fid, ext, nom, jev, conf))
            else:
                stats["na_confirme"] += 1
        elif jev == dom:
            stats["accord"] += 1
        elif jev == "non_attribuable" or conf < SEUIL_CONFIANCE:
            stats["desaccord_faible"] += 1
        else:
            stats["contradiction"] += 1
            contradictions.append((fid, ext, nom, dom, regle, jev, conf))
            par_regle[(regle, dom, jev)] += 1

    print("\n=== Bilan ===")
    for k, v in stats.most_common():
        print(f"  {k}: {v}")

    # ---- exports
    EXPORTS.mkdir(exist_ok=True)
    csv_path = EXPORTS / f"secteurs-controle-{TODAY}.csv"
    with open(csv_path, "w", newline="") as fcsv:
        w = csv.writer(fcsv)
        w.writerow(["type", "fiche_id", "tet_external_id", "nom", "mapping_secteur", "regle_dominante", "jev_secteur", "jev_confiance"])
        for fid, ext, nom, dom, regle, jev, conf in contradictions:
            w.writerow(["contradiction", fid, ext, nom, dom, regle, jev, conf])
        for fid, ext, nom, jev, conf in recuperables:
            w.writerow(["recuperable", fid, ext, nom, "", "", jev, conf])
    print(f"CSV: {csv_path}")

    md_path = EXPORTS / f"secteurs-controle-{TODAY}-regles.md"
    with open(md_path, "w") as fmd:
        fmd.write(f"# Contrôle mapping secteurs — désaccords par règle · {TODAY}\n\n")
        fmd.write(f"Jev (sémantique TeT, confiance ≥ {SEUIL_CONFIANCE}) contredit le mapping sur "
                  f"{stats['contradiction']} fiches sectorisées (accord {stats['accord']}, "
                  f"désaccords faibles {stats['desaccord_faible']}, non-attribuables confirmés "
                  f"{stats['na_confirme']}, récupérables {stats['recuperable']}).\n\n")
        fmd.write("| Règle du mapping | Secteur mapping | Secteur Jev | Fiches |\n|---|---|---|---|\n")
        for (regle, dom, jev), n in par_regle.most_common(60):
            fmd.write(f"| {regle} | {dom} | {jev} | {n} |\n")
    print(f"Agrégat règles: {md_path}")


if __name__ == "__main__":
    main()
