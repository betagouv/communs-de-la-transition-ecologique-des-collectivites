"""Extract the bench sample (read-only) from schema_commun_v2.

Outputs (gitignored):
  data/projets_sample.jsonl  — stratified by source + forced long-tail thematiques
  data/paires_sample.jsonl   — balanced verdicts from llm_pair_judgments, incl. hard negatives

Sampling is deterministic: rows are ordered by md5(id || SEED).
No nominative field is selected anywhere in this script.
"""

import json

from common import DATA_DIR, SEED, get_db_conn

# Per-source quotas for the main stratum (~440 rows before long tail).
SOURCE_QUOTAS = {
    "MEC": 100,
    "DGCL DETR": 80,
    "Fonds Vert": 80,
    "PVD": 60,
    "DGCL DSIL": 40,
    "ACV": 40,
    "DGCL DPV": 20,
    "Vivier COP": 20,
}

N_RARE_LABELS = 30  # rarest thematiques (among labels with score >= 0.8)
PER_RARE_LABEL = 2

PAIR_QUOTAS = {"high": 120, "medium": 120, "low": 96}
PAIR_NO_RANDOM = 60
PAIR_NO_HARD = 60  # 'no' verdicts with the highest embedding similarity

PROJET_COLS = """
    id, source_origine, nom, description,
    llm_thematiques, llm_sites, llm_interventions, llm_probabilite_te,
    llm_leviers, "competencesM57", "leviersSgpe", llm_classified_at
"""


def rows_to_dicts(cur):
    cols = [d.name for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def extract_projets(conn):
    samples = []
    seen = set()

    for source, quota in SOURCE_QUOTAS.items():
        cur = conn.execute(
            f"""
            SELECT {PROJET_COLS}
            FROM schema_commun_v2.projets_operationnels
            WHERE source_origine = %s
              AND nom IS NOT NULL AND length(trim(nom)) > 0
            ORDER BY md5(id || %s)
            LIMIT %s
            """,
            (source, SEED, quota),
        )
        for row in rows_to_dicts(cur):
            row["strata"] = f"source:{source}"
            samples.append(row)
            seen.add(row["id"])

    # Long tail: rarest thematiques among retained labels (score >= 0.8).
    cur = conn.execute(
        """
        SELECT item->>'label' AS label, count(*) AS n
        FROM schema_commun_v2.projets_operationnels,
             jsonb_array_elements(llm_thematiques) AS item
        WHERE llm_thematiques IS NOT NULL
          AND (item->>'score')::float >= 0.8
        GROUP BY 1
        HAVING count(*) >= %s
        ORDER BY n ASC, label
        LIMIT %s
        """,
        (PER_RARE_LABEL, N_RARE_LABELS),
    )
    rare_labels = [(r[0], r[1]) for r in cur.fetchall()]

    for label, _ in rare_labels:
        cur = conn.execute(
            f"""
            SELECT {PROJET_COLS}
            FROM schema_commun_v2.projets_operationnels p
            WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.llm_thematiques) item
                WHERE item->>'label' = %s AND (item->>'score')::float >= 0.8
            )
              AND nom IS NOT NULL AND length(trim(nom)) > 0
            ORDER BY md5(id || %s)
            LIMIT %s
            """,
            (label, SEED, PER_RARE_LABEL),
        )
        for row in rows_to_dicts(cur):
            if row["id"] in seen:
                continue
            row["strata"] = f"longtail:{label}"
            samples.append(row)
            seen.add(row["id"])

    return samples, rare_labels


def extract_paires(conn):
    pair_select = """
        SELECT j.id_a, j.id_b, j.verdict, j.emb_score, j.jac_score, j.jw_score, j.reason,
               a.source_origine AS source_a, a.nom AS nom_a, a.description AS description_a,
               b.source_origine AS source_b, b.nom AS nom_b, b.description AS description_b
        FROM schema_commun_v2.llm_pair_judgments j
        JOIN schema_commun_v2.projets_operationnels a ON a.id = j.id_a
        JOIN schema_commun_v2.projets_operationnels b ON b.id = j.id_b
    """
    samples = []
    seen = set()

    def add(rows, strata):
        for row in rows:
            key = (row["id_a"], row["id_b"])
            if key in seen:
                continue
            row["strata"] = strata
            for col in ("emb_score", "jac_score", "jw_score"):
                if row[col] is not None:
                    row[col] = float(row[col])
            samples.append(row)
            seen.add(key)

    for verdict, quota in PAIR_QUOTAS.items():
        cur = conn.execute(
            pair_select + " WHERE j.verdict = %s ORDER BY md5(j.id_a || j.id_b || %s) LIMIT %s",
            (verdict, SEED, quota),
        )
        add(rows_to_dicts(cur), f"verdict:{verdict}")

    cur = conn.execute(
        pair_select + " WHERE j.verdict = 'no' ORDER BY md5(j.id_a || j.id_b || %s) LIMIT %s",
        (SEED, PAIR_NO_RANDOM),
    )
    add(rows_to_dicts(cur), "verdict:no")

    cur = conn.execute(
        pair_select + " WHERE j.verdict = 'no' AND j.emb_score IS NOT NULL ORDER BY j.emb_score DESC LIMIT %s",
        (PAIR_NO_HARD,),
    )
    add(rows_to_dicts(cur), "verdict:no-hard")

    return samples


def write_jsonl(path, rows):
    with open(path, "w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")


def main():
    DATA_DIR.mkdir(exist_ok=True)
    conn = get_db_conn()

    projets, rare_labels = extract_projets(conn)
    write_jsonl(DATA_DIR / "projets_sample.jsonl", projets)

    paires = extract_paires(conn)
    write_jsonl(DATA_DIR / "paires_sample.jsonl", paires)

    # Console summary
    by_strata = {}
    with_desc = 0
    classified = 0
    for p in projets:
        key = p["strata"].split(":")[0]
        by_strata[key] = by_strata.get(key, 0) + 1
        if p["description"] and len(str(p["description"]).strip()) > 0:
            with_desc += 1
        if p["llm_thematiques"]:
            classified += 1
    print(f"projets: {len(projets)} ({by_strata}), avec description: {with_desc}, deja classes: {classified}")
    print(f"labels longue traine forces: {[l for l, _ in rare_labels][:10]}...")

    by_verdict = {}
    for p in paires:
        by_verdict[p["strata"]] = by_verdict.get(p["strata"], 0) + 1
    print(f"paires: {len(paires)} ({by_verdict})")


if __name__ == "__main__":
    main()
