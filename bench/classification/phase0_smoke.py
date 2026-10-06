"""Phase 0 — smoke test: 10 projects, 5 thematiques as noul + proba TE.

Two instruction variants on the same French state: criteria written in French
vs in English. Prints everything for human reading; raw responses go to
results/phase0.jsonl.
"""

import json

from common import DATA_DIR, RESULTS_DIR
from jev_client import jev_decide

# Five thematiques from the 138-label referentiel, one-line definitions.
THEMATIQUES_FR = {
    "renovation_energetique": (
        "Audit ou travaux de rénovation énergétique",
        "Le projet relève de la thématique « Audit ou travaux de rénovation énergétique » : "
        "audit énergétique, ou travaux visant explicitement à réduire la consommation d'énergie d'un bâtiment "
        "(isolation, chauffage, ventilation).",
    ),
    "isolation_thermique": (
        "Isolation thermique",
        "Le projet relève de la thématique « Isolation thermique » : travaux d'isolation "
        "(murs, toiture, menuiseries) d'un bâtiment.",
    ),
    "voie_douce": (
        "Voie douce, piste cyclable",
        "Le projet relève de la thématique « Voie douce, piste cyclable » : création ou aménagement "
        "de pistes cyclables, voies vertes ou cheminements piétons.",
    ),
    "eclairage_public": (
        "Eclairage public",
        "Le projet relève de la thématique « Eclairage public » : installation, rénovation ou "
        "modernisation de l'éclairage public (candélabres, LED, extinction nocturne).",
    ),
    "energies_renouvelables": (
        "Energies renouvelables",
        "Le projet relève de la thématique « Energies renouvelables » : production d'énergie "
        "renouvelable (solaire, éolien, hydraulique, géothermie, biomasse).",
    ),
}

THEMATIQUES_EN = {
    "renovation_energetique": "The project falls under the theme \"Energy audit or retrofit works\": an energy audit, "
    "or works explicitly aimed at reducing a building's energy consumption (insulation, heating, ventilation).",
    "isolation_thermique": "The project falls under the theme \"Thermal insulation\": insulation works "
    "(walls, roof, windows) on a building.",
    "voie_douce": "The project falls under the theme \"Soft mobility path, cycle lane\": creation or development "
    "of cycle lanes, greenways or pedestrian paths.",
    "eclairage_public": "The project falls under the theme \"Public lighting\": installation, renovation or "
    "modernisation of public lighting (lampposts, LED, night switch-off).",
    "energies_renouvelables": "The project falls under the theme \"Renewable energy\": renewable energy production "
    "(solar, wind, hydro, geothermal, biomass).",
}

PROBA_TE_FR = (
    "Le projet contribue directement à la transition écologique : réduction d'émissions de gaz à effet de serre, "
    "adaptation au changement climatique, biodiversité, préservation des ressources, économie circulaire, "
    "réduction des déchets ou des pollutions."
)
PROBA_TE_EN = (
    "The project directly contributes to the ecological transition: greenhouse gas emission reduction, "
    "climate change adaptation, biodiversity, resource preservation, circular economy, "
    "waste or pollution reduction."
)


def pick_projects():
    projets = [json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl")]
    with_desc = [p for p in projets if p["description"] and p["llm_thematiques"]]
    no_desc = [p for p in projets if not p["description"] and p["llm_thematiques"]]
    unclassified = [p for p in projets if not p["llm_thematiques"]]
    for bucket in (with_desc, no_desc, unclassified):
        bucket.sort(key=lambda p: p["id"])
    return with_desc[:6] + no_desc[:2] + unclassified[:2]


def build_questions(lang):
    questions = {}
    for qid in THEMATIQUES_FR:
        instr = THEMATIQUES_FR[qid][1] if lang == "fr" else THEMATIQUES_EN[qid]
        questions[f"th_{qid}"] = {"type": "noul", "instructions": instr}
    questions["proba_te"] = {"type": "noul", "instructions": PROBA_TE_FR if lang == "fr" else PROBA_TE_EN}
    return questions


def main():
    RESULTS_DIR.mkdir(exist_ok=True)
    projects = pick_projects()
    out = open(RESULTS_DIR / "phase0.jsonl", "w")

    for p in projects:
        state = {"intitule": p["nom"]}
        if p["description"]:
            state["description"] = p["description"]

        sonnet = "-"
        if p["llm_thematiques"]:
            labels = json.loads(p["llm_thematiques"]) if isinstance(p["llm_thematiques"], str) else p["llm_thematiques"]
            sonnet = ", ".join(f"{i['label']} ({i['score']})" for i in labels)

        print(f"\n=== [{p['source_origine']}] {p['nom'][:90]}")
        print(f"    desc: {'oui, ' + str(len(p['description'])) + ' chars' if p['description'] else 'non'}")
        print(f"    Sonnet: {sonnet[:150]}")
        print(f"    Sonnet proba TE: {p['llm_probabilite_te']}")

        record = {"id": p["id"], "nom": p["nom"], "source": p["source_origine"]}
        for lang in ("fr", "en"):
            resp, latency = jev_decide(state, build_questions(lang))
            answers = resp.get("answers", {})
            row = {}
            for qid in list(THEMATIQUES_FR) + ["proba_te"]:
                key = f"th_{qid}" if qid in THEMATIQUES_FR else qid
                ans = answers.get(key, {})
                row[qid] = round(ans.get("noul", -1), 3)
            print(f"    Jev [{lang}] ({latency:.2f}s, {resp.get('usage', {}).get('input_tokens', '?')} tok): " +
                  "  ".join(f"{k}={v}" for k, v in row.items()))
            record[lang] = {"answers": answers, "usage": resp.get("usage"), "latency_s": round(latency, 3)}
        out.write(json.dumps(record, ensure_ascii=False) + "\n")

    out.close()
    print(f"\nRaw responses: {RESULTS_DIR / 'phase0.jsonl'}")


if __name__ == "__main__":
    main()
