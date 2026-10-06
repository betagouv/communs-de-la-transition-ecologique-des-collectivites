"""Family-collapsed scoring: quantify how much of the Jev/Sonnet disagreement
is sister-label confusion (Sonnet caps at 3 labels and picks one variant).

A Jev positive counts as TP if Sonnet retained ANY label of the same family;
a Sonnet positive is covered if Jev fired ANY label of its family.
"""

import json
from common import DATA_DIR, RESULTS_DIR

FAMILIES = [
    ["Audit ou travaux de rénovation énergétique", "Audit ou travaux de rénovation énergétique tertiaire",
     "Audit ou travaux de rénovation énergétique résidentiel"],
    ["Voie douce, piste cyclable", "Vélo (mobilité douce)", "Randonnée, vélo tourisme, VTT",
     "Subventionnement de l'achat de vélos"],
    ["Eclairage public", "Eclairage intérieur ou extérieur d'un bâtiment ou d'un équipement sportif"],
    ["Energies renouvelables", "Energie éolienne", "Energie hydraulique", "Champs de panneaux solaires",
     "Agrivoltaïsme, panneaux solaires sur le bâti",
     "Energies renouvelables particuliers, énergies renouvelables citoyennes (ENRc)"],
    ["Remplacement chauffage", "Chauffage bois", "Pompes à chaleur", "Chauffage biogaz", "Chauffage géothermie",
     "Chauffage résidus agricoles et alimentaires", "Chauffage solaire thermique"],
    ["Tourisme", "Tourisme décarboné"],
    ["Adaptation au changement climatique", "Adaptation de la filière agricole au changement climatique"],
    ["Isolation thermique", "Changement des fenêtres/portes d'un bâtiment public", "Toiture"],
]


def main():
    fam_of = {}
    for i, fam in enumerate(FAMILIES):
        for label in fam:
            fam_of[label] = i

    projets = {p["id"]: p for p in (json.loads(l) for l in open(DATA_DIR / "projets_sample.jsonl"))}
    raw = [json.loads(l) for l in open(RESULTS_DIR / "phase1_raw.jsonl") if "answers" in l or True]
    th_index = json.load(open(RESULTS_DIR / "phase1_indexes.json"))["thematiques"]

    def key(label):  # family id if grouped, else the label itself
        return fam_of.get(label, label)

    for thr in (0.5, 0.85):
        tp = fp = fn = 0
        for r in raw:
            if "answers" not in r:
                continue
            p = projets[r["id"]]
            if not p.get("llm_thematiques"):
                continue
            items = p["llm_thematiques"]
            if isinstance(items, str):
                items = json.loads(items)
            sonnet = {key(i["label"]) for i in items if float(i["score"]) >= 0.8}
            jev = {key(th_index[k]) for k, v in r["answers"].items() if k.startswith("th_") and v.get("noul", 0) >= thr}
            tp += len(jev & sonnet)
            fp += len(jev - sonnet)
            fn += len(sonnet - jev)
        prec = tp / (tp + fp) if tp + fp else 0
        rec = tp / (tp + fn) if tp + fn else 0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
        print(f"familles regroupees, seuil {thr}: P={prec:.3f} R={rec:.3f} F1={f1:.3f}")


if __name__ == "__main__":
    main()
