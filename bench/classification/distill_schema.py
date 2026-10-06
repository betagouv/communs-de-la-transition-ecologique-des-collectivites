"""A1 — Schéma Jev RICHE pour la passe professeur (distillation + release SGPE).

Une requête par projet, tout le référentiel d'un coup :
  - 170 noul  : thématiques du référentiel ÉTENDU (138 + 32 ajouts Jean observés en base)
  - 1 choice  : site (59)
  - 1 choice  : intervention (15)
  - 4 noul    : probas TE (global / atténuation / adaptation / biodiversité)
  - 1 choice  : nature de l'objet (9 classes, alignées sur l'algo de Jean en base)
  - 72 noul   : leviers SGPE
  - 6 choice  : budget vert (un par axe, cotation à 4 valeurs)
  - 156 noul  : compétences M57 (désactivables : --no-competences, poste de coût principal)

Le schéma riche coûte plus cher par requête que le bench (411 questions vs 144) mais
évite toute seconde passe : les labels leviers/compétences/budget vert servent de
vérité-terrain aux dérivations (lot C'), et d'assurance si une dérivation échoue.
"""

import json
from pathlib import Path

BENCH_DIR = Path(__file__).parent

TE_QUESTIONS = {
    "te_global": "Le projet contribue directement à la transition écologique : réduction d'émissions de gaz à effet "
    "de serre, adaptation au changement climatique, biodiversité, préservation des ressources, économie circulaire, "
    "réduction des déchets ou des pollutions.",
    "te_attenuation": "Le projet contribue à l'atténuation du changement climatique : il réduit les émissions de gaz "
    "à effet de serre ou la consommation d'énergie.",
    "te_adaptation": "Le projet contribue à l'adaptation au changement climatique : il réduit la vulnérabilité aux "
    "canicules, inondations, sécheresses ou autres effets du climat.",
    "te_biodiversite": "Le projet contribue à la biodiversité : protection ou restauration d'espèces, de milieux "
    "naturels ou de continuités écologiques.",
}

NATURE_INSTRUCTIONS = (
    "Nature de l'objet décrit. « Projet opérationnel » : un projet concret, localisé, avec des moyens engagés ou "
    "demandés. « Action » : une action d'un plan, pas encore une opération budgétée. « Diagnostic » : étude, schéma, "
    "diagnostic, audit. « Dispositif » : un dispositif d'aide ou d'accompagnement, pas un projet. « Indicateur » : "
    "une ligne de suivi ou de mesure. « Médiation » : animation, sensibilisation, concertation. « Moyens » : "
    "financement de poste, de fonctionnement ou d'équipement générique. « Tâche » : une tâche interne de gestion. "
    "« Indéterminé » : impossible à dire."
)

BV_AXES = {
    "bv_attenuation": "l'atténuation du changement climatique (réduction des émissions de gaz à effet de serre)",
    "bv_adaptation": "l'adaptation au changement climatique",
    "bv_eau": "la gestion de la ressource en eau",
    "bv_circulaire": "l'économie circulaire, les déchets et la prévention des risques technologiques",
    "bv_pollution": "la lutte contre les pollutions (air, sols, bruit)",
    "bv_biodiversite": "la biodiversité et la protection des espaces naturels, agricoles et sylvicoles",
}

BV_COTATIONS = {"fav": "favorable", "neu": "neutre", "def": "défavorable", "nc": "non coté / sans objet"}


def build_questions(include_competences=True):
    ref = json.load(open(BENCH_DIR / "referentiel_etendu.json"))
    defs = json.load(open(BENCH_DIR / "definitions_thematiques_etendu.json"))

    missing = [t for t in ref["thematiques"] if t not in defs]
    if missing:
        raise SystemExit(f"définitions manquantes: {missing}")

    questions = {}
    indexes = {}

    th_index = {}
    for i, label in enumerate(ref["thematiques"]):
        qid = f"th_{i:03d}"
        th_index[qid] = label
        questions[qid] = {
            "type": "noul",
            "instructions": f"Le projet relève de la thématique « {label} » : {defs[label]}.",
        }
    indexes["thematiques"] = th_index

    site_index = {f"s{i:02d}": label for i, label in enumerate(ref["sites"])}
    questions["site"] = {
        "type": "choice",
        "instructions": "Type de site ou de lieu principal concerné par le projet.",
        "criteria": site_index,
    }
    indexes["sites"] = site_index

    itv_index = {f"i{i:02d}": label for i, label in enumerate(ref["interventions"])}
    questions["intervention"] = {
        "type": "choice",
        "instructions": "Type d'intervention principal du projet.",
        "criteria": itv_index,
    }
    indexes["interventions"] = itv_index

    for qid, instr in TE_QUESTIONS.items():
        questions[qid] = {"type": "noul", "instructions": instr}

    nat_index = {f"n{i}": label for i, label in enumerate(ref["natures"])}
    questions["nature"] = {"type": "choice", "instructions": NATURE_INSTRUCTIONS, "criteria": nat_index}
    indexes["natures"] = nat_index

    lev_index = {}
    for i, levier in enumerate(ref["leviers"]):
        qid = f"lv_{i:02d}"
        lev_index[qid] = levier
        questions[qid] = {
            "type": "noul",
            "instructions": f"Le projet actionne le levier de transition écologique « {levier} ».",
        }
    indexes["leviers"] = lev_index

    for axe_qid, axe_desc in BV_AXES.items():
        questions[axe_qid] = {
            "type": "choice",
            "instructions": f"Cotation budget vert du projet sur l'axe : {axe_desc}. "
            "Favorable si le projet y contribue, défavorable s'il y nuit, neutre s'il est sans effet notable, "
            "non coté si l'axe est sans objet pour ce projet.",
            "criteria": BV_COTATIONS,
        }
    indexes["budget_vert"] = {"axes": list(BV_AXES), "cotations": BV_COTATIONS}

    if include_competences:
        comp_index = {}
        for i, (code, nom) in enumerate(sorted(ref["competences"].items())):
            qid = f"cp_{i:03d}"
            comp_index[qid] = {"code": code, "nom": nom}
            questions[qid] = {
                "type": "noul",
                "instructions": f"Le projet relève de la compétence « {nom} » (nomenclature M57).",
            }
        indexes["competences"] = comp_index

    return questions, indexes


if __name__ == "__main__":
    q, idx = build_questions()
    q_light, _ = build_questions(include_competences=False)
    chars = sum(len(json.dumps(v, ensure_ascii=False)) for v in q.values())
    chars_light = sum(len(json.dumps(v, ensure_ascii=False)) for v in q_light.values())
    print(f"schéma riche : {len(q)} questions, ~{chars} chars d'instructions (~{chars // 4} tokens)")
    print(f"sans compétences : {len(q_light)} questions, ~{chars_light} chars (~{chars_light // 4} tokens)")
