"""Étape 2 du plan révisé — fait tourner une « recette » de classification sur les 180 cas du gold.

Recette = moteur (jev | sonnet) + référentiel (v1 aujourd'hui, v2 quand il sera arrêté)
+ options de prompt :
  --strict     consigne « ne retenir que ce que le texte dit ; dans le doute, rien »
  --source     la source du projet (agences de l'eau, marché public…) en contexte
  --glossaire  les sigles présents dans le texte, développés (glossaire_sigles.json)

Le schéma est réduit à thématiques + nature (le reste se dérive).
DÉPENSE EXTERNE : le coût estimé est affiché, rien n'est appelé sans --confirme-depense.

Sortie : results/gold_<tag>.jsonl, à scorer avec
  python gold_eval.py --compare jev-v1 sonnet-v1 results/gold_<tag>.jsonl

Usage :
  python gold_predict.py --moteur jev --tag jev-v1-strict --strict --source --glossaire
  python gold_predict.py --moteur sonnet --tag sonnet55-v1-strict --strict --source --glossaire --confirme-depense
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from common import load_env
from distill_schema import NATURE_INSTRUCTIONS
from jev_client import jev_decide

BENCH_DIR = Path(__file__).parent
GOLD = BENCH_DIR / "data/gold/gold_fige.jsonl"
RESULTS = BENCH_DIR / "results"

CONSIGNE_STRICTE = (
    "Ne retiens que ce que l'intitulé ou la description disent explicitement ; n'extrapole pas "
    "à partir d'un mot isolé. Dans le doute, ne retiens rien."
)
SUFFIXE_STRICT = " Réponds oui seulement si le texte le dit explicitement."

# Prix (dollars par million de tokens), à vérifier sur https://openrouter.ai/api/v1/models
JEV_DOLLARS_PAR_MTOK = 0.042
SONNET = {"input": 2.0, "output": 10.0, "cache_read": 0.1, "cache_write": 2.5}
CARACTERES_PAR_TOKEN = 3.6


def charge_referentiel(path, defs_path):
    ref = json.load(open(path, encoding="utf-8"))
    defs = json.load(open(defs_path, encoding="utf-8"))
    manquantes = [t for t in ref["thematiques"] if t not in defs]
    if manquantes:
        sys.exit(f"définitions manquantes : {manquantes[:5]}…")
    return ref, defs


def contexte(cas, ref, gloss, avec_source, avec_glossaire):
    """Ce que le moteur voit du projet."""
    state = {"intitule": cas["nom"]}
    if cas.get("description"):
        state["description"] = cas["description"][:4000]
    if avec_source:
        sources = [s for s in re.findall(r"[\w-]+", cas.get("sources") or "")]
        state["source"] = " ; ".join(gloss["sources"].get(s, s) for s in sources)
    if avec_glossaire:
        texte = cas["nom"] + " " + (cas.get("description") or "")
        sigles = {a["acronyme"]: a["definition"] for a in ref.get("acronymes", [])}
        sigles.update(gloss["sigles"])
        trouves = {s: d for s, d in sigles.items() if re.search(rf"\b{re.escape(s)}\b", texte)}
        if trouves:
            state["sigles"] = trouves
    return state


# --- Jev -------------------------------------------------------------------------------

def questions_jev(ref, defs, strict):
    q, th_index = {}, {}
    for i, label in enumerate(ref["thematiques"]):
        qid = f"th_{i:03d}"
        th_index[qid] = label
        q[qid] = {"type": "noul",
                  "instructions": f"Le projet relève de la thématique « {label} » : {defs[label]}."
                  + (SUFFIXE_STRICT if strict else "")}
    nat_index = {f"n{i}": label for i, label in enumerate(ref["natures"])}
    q["nature"] = {"type": "choice", "instructions": ref.get("natures_instructions", NATURE_INSTRUCTIONS),
                   "criteria": nat_index}
    return q, th_index, nat_index


def predit_jev(cas, state, questions, th_index, nat_index, strict):
    if strict:
        state = dict(state, consigne=CONSIGNE_STRICTE)
    resp, _ = jev_decide(state, questions)
    a = resp.get("answers") or {}
    if not a:
        raise RuntimeError("réponse vide")
    th = {th_index[q]: round(v["noul"], 4) for q, v in a.items() if q in th_index and v.get("noul") is not None}
    dist = (a.get("nature") or {}).get("probabilities") or {}
    usage = resp.get("usage") or {}
    return {"id": cas["id"], "thematiques": th,
            "nature": nat_index[max(dist, key=dist.get)] if dist else None,
            "cout": usage.get("cost")}


# --- Sonnet (OpenRouter, prompt système mis en cache) ----------------------------------

def prompt_sonnet(ref, defs, strict):
    lignes = [f"- {t} : {defs[t]}" for t in ref["thematiques"]]
    return (
        "Tu classes des projets de collectivités territoriales françaises.\n\n"
        "THÉMATIQUES (liste fermée, recopie les libellés exactement) :\n" + "\n".join(lignes) + "\n\n"
        "NATURES (une seule) : " + ref.get("natures_instructions", NATURE_INSTRUCTIONS) + "\n\n"
        "Règles : retiens toutes les thématiques qui s'appliquent clairement, et seulement elles "
        "(typiquement 1 à 4) ; une liste vide est légitime si aucune ne convient ; le label précis "
        "l'emporte sur le générique."
        + ("\n" + CONSIGNE_STRICTE if strict else "")
        + '\n\nRéponds uniquement en JSON : {"thematiques": ["..."], "nature": "..."}'
    )


def predit_sonnet(cas, state, systeme, modele, thematiques, natures):
    load_env()
    body = {
        "model": modele,
        "messages": [
            {"role": "system", "content": [{"type": "text", "text": systeme, "cache_control": {"type": "ephemeral"}}]},
            {"role": "user", "content": json.dumps(state, ensure_ascii=False)},
        ],
        "temperature": 0,
        "max_tokens": 400,
        "usage": {"include": True},
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        resp = json.loads(r.read())
    texte = resp["choices"][0]["message"]["content"]
    debut = texte.find("{")
    # raw_decode : ignore un éventuel texte après l'objet JSON
    sortie = json.JSONDecoder().raw_decode(texte[debut:])[0] if debut >= 0 else {}
    th = [t for t in sortie.get("thematiques", []) if t in thematiques]
    hors = [t for t in sortie.get("thematiques", []) if t not in thematiques]
    nature = sortie.get("nature") if sortie.get("nature") in natures else None
    return {"id": cas["id"], "thematiques": th, "nature": nature, "hors_referentiel": hors,
            "cout": (resp.get("usage") or {}).get("cost")}


def estimation(moteur, n, systeme_ou_questions):
    caracteres = len(json.dumps(systeme_ou_questions, ensure_ascii=False))
    tokens = caracteres / CARACTERES_PAR_TOKEN
    if moteur == "jev":
        return n * (tokens + 150) * JEV_DOLLARS_PAR_MTOK / 1e6
    return (tokens * SONNET["cache_write"] + (n - 1) * tokens * SONNET["cache_read"]
            + n * 150 * SONNET["input"] + n * 120 * SONNET["output"]) / 1e6


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--moteur", choices=["jev", "sonnet"], required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--referentiel", default=str(BENCH_DIR / "referentiel_etendu.json"))
    ap.add_argument("--definitions", default=str(BENCH_DIR / "definitions_thematiques_etendu.json"))
    ap.add_argument("--modele", default="anthropic/claude-sonnet-5.5")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--source", action="store_true")
    ap.add_argument("--glossaire", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--confirme-depense", action="store_true")
    args = ap.parse_args()

    ref, defs = charge_referentiel(args.referentiel, args.definitions)
    gloss = json.load(open(BENCH_DIR / "glossaire_sigles.json", encoding="utf-8"))
    gold = [json.loads(l) for l in open(GOLD, encoding="utf-8")]

    if args.moteur == "jev":
        questions, th_index, nat_index = questions_jev(ref, defs, args.strict)
        cout = estimation("jev", len(gold), questions)
        appel = lambda c, s: predit_jev(c, s, questions, th_index, nat_index, args.strict)
    else:
        systeme = prompt_sonnet(ref, defs, args.strict)
        cout = estimation("sonnet", len(gold), systeme)
        appel = lambda c, s: predit_sonnet(c, s, systeme, args.modele, set(ref["thematiques"]), set(ref["natures"]))

    print(f"recette {args.tag} : {args.moteur}, {len(gold)} cas, options "
          f"strict={args.strict} source={args.source} glossaire={args.glossaire}")
    print(f"coût estimé : {cout:.2f} $ (dépense externe OpenRouter)")
    if not args.confirme_depense:
        print("→ rien n'a été appelé. Relancer avec --confirme-depense une fois la dépense validée.")
        return

    RESULTS.mkdir(exist_ok=True)
    sortie = RESULTS / f"gold_{args.tag}.jsonl"
    deja = {json.loads(l)["id"] for l in open(sortie, encoding="utf-8")} if sortie.exists() else set()
    a_faire = [c for c in gold if c["id"] not in deja]

    def tache(c):
        try:
            return appel(c, contexte(c, ref, gloss, args.source, args.glossaire))
        except Exception as e:  # noqa: BLE001 — on note l'erreur, le run est reprenable
            return {"id": c["id"], "error": str(e)[:300]}

    total, erreurs = 0.0, 0
    with open(sortie, "a", encoding="utf-8") as f, ThreadPoolExecutor(args.workers) as ex:
        for r in ex.map(tache, a_faire):
            if "error" in r:
                erreurs += 1
                continue
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            total += r.get("cout") or 0
    print(f"{len(a_faire) - erreurs} cas écrits dans {sortie.name}, {erreurs} erreurs (relancer pour reprendre), coût {total:.2f} $")


if __name__ == "__main__":
    main()
