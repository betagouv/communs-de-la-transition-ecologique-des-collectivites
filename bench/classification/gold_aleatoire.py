"""Étape 3 du plan révisé — tranche ALÉATOIRE du gold (projets ordinaires, pas des désaccords).

Le gold du 13/10 ne contient que des cas difficiles (désaccords, traîne) : une recette réglée
dessus risque d'être sur-ajustée. Cette tranche tire N projets au hasard dans le split TEST
du jeu d'entraînement (zéro fuite vers l'élève), hors gold existant ; elle reflète donc la
composition réelle de la base (DECP, DGCL, agences de l'eau…).

Annotation LIBRE, sans proposition d'algorithme (pas d'ancrage) : l'arbitre choisit lui-même
les labels dans le référentiel, la nature, et signale les labels manquants.

Deux temps :
  1. tirage (une fois, graine fixe) :
       python gold_aleatoire.py tirage --test-ids <ids du split test> [--n 100]
     → data/gold/aleatoire_projets.jsonl
  2. page d'annotation, À GÉNÉRER AVEC LE RÉFÉRENTIEL V2 une fois arrêté :
       python gold_aleatoire.py page --referentiel referentiel_v2.json
     → data/gold/annotation_aleatoire.html (fichier autonome, progression en localStorage,
       export JSON des annotations)
"""

import argparse
import html
import json
import random
from pathlib import Path

BENCH_DIR = Path(__file__).parent
GOLD_DIR = BENCH_DIR / "data" / "gold"
SEED = 1310

PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Annotation gold — projets au hasard</title>
<style>
body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;line-height:1.45;background:#fafafa;color:#161616}
.card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:18px 20px;margin:14px 0}
.desc{color:#444;font-size:.92em;white-space:pre-wrap}
.meta{color:#888;font-size:.8em}
button{font-size:.95em;padding:6px 12px;border-radius:6px;border:1px solid #888;background:#fff;cursor:pointer;margin:3px 4px 3px 0}
button.sel{background:#000091;color:#fff;border-color:#000091}
#bar{position:sticky;top:0;background:#fafafa;padding:8px 0;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px}
input,textarea{width:100%;padding:6px;margin:6px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font:inherit}
.choix{max-height:220px;overflow:auto;border:1px solid #eee;padding:6px;border-radius:4px}
details{margin:8px 0}
</style></head><body>
<div id="bar"><span id="prog"></span><span>
<button onclick="go(-1)">◀ Précédent</button><button onclick="go(1)">Suivant ▶</button>
<button onclick="exporter()">Exporter les annotations</button></span></div>
<details class="card"><summary><b>Consignes</b> (à lire avant de commencer)</summary>
<ul>
<li>Ces projets sont tirés <b>au hasard</b> dans la base : beaucoup sont banals, c'est voulu.</li>
<li>Choisissez <b>vous-même</b> les labels qui s'appliquent clairement, et seulement eux. Aucun algorithme ne propose de réponse.</li>
<li>Ne retenez que ce que le texte dit ; dans le doute, ne mettez rien. « Aucun label ne convient » est un verdict légitime.</li>
<li>Le label précis l'emporte sur le générique.</li>
<li>Si un label vous manque, écrivez-le dans « Label manquant ».</li>
</ul>
<p><b>Natures :</b> __NATURES_DEF__</p></details>
<div id="cas"></div>
<script>
const CAS = __CAS__;
const FACETTES = __FACETTES__;
const NATURES = __NATURES__;
const CLE = "annotation_aleatoire_" + __VERSION__;
let V = {}; try { V = JSON.parse(localStorage.getItem(CLE) || "{}"); } catch(e) {}
let i = 0; try { i = +(localStorage.getItem(CLE + "_i") || 0); } catch(e) {}
const save = () => { try { localStorage.setItem(CLE, JSON.stringify(V)); localStorage.setItem(CLE + "_i", i); } catch(e) {} };
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function v(id){ return V[id] = V[id] || {}; }
function toggle(id, facette, label){
  const a = v(id)[facette] || [];
  v(id)[facette] = a.includes(label) ? a.filter(x => x !== label) : [...a, label];
  if (v(id)[facette].length) delete v(id)["aucun_" + facette];
  save(); render();
}
function aucun(id, facette){ v(id)["aucun_" + facette] = !v(id)["aucun_" + facette]; if (v(id)["aucun_" + facette]) v(id)[facette] = []; save(); render(); }
function setv(id, k, val){ v(id)[k] = val; save(); render(); }
function settxt(id, k, el){ v(id)[k] = el.value; save(); }
function filtre(fid, el){ const q = el.value.toLowerCase(); document.querySelectorAll("#" + fid + " button").forEach(b => b.hidden = q && !b.dataset.l.toLowerCase().includes(q)); }
function go(d){ i = Math.max(0, Math.min(CAS.length - 1, i + d)); save(); render(); window.scrollTo(0, 0); }
function fait(id){ const x = V[id] || {}; return x.nature && FACETTES.every(f => (x[f.cle] || []).length || x["aucun_" + f.cle]); }
function render(){
  const c = CAS[i], x = v(c.id);
  document.getElementById("prog").textContent = `Cas ${i + 1} / ${CAS.length} · ${CAS.filter(k => fait(k.id)).length} complets`;
  let h = `<div class="card"><h3>${esc(c.nom)}</h3>${c.description ? `<p class="desc">${esc(c.description)}</p>` : ""}<p class="meta">source : ${esc(c.sources || "")}</p></div>`;
  for (const f of FACETTES){
    const choisis = x[f.cle] || [], fid = "f_" + f.cle;
    h += `<div class="card"><b>${esc(f.titre)}</b>
      <div>${choisis.map(l => `<button class="sel" onclick='toggle(${JSON.stringify(c.id)},${JSON.stringify(f.cle)},${JSON.stringify(l)})'>${esc(l)} ✕</button>`).join("")}</div>
      <button class="${x["aucun_" + f.cle] ? "sel" : ""}" onclick='aucun(${JSON.stringify(c.id)},${JSON.stringify(f.cle)})'>Aucun label ne convient</button>
      <input placeholder="filtrer les labels…" oninput="filtre('${fid}', this)">
      <div class="choix" id="${fid}">${f.labels.map(l => `<button data-l="${esc(l)}" class="${choisis.includes(l) ? "sel" : ""}" title="${esc(f.definitions[l] || "")}" onclick='toggle(${JSON.stringify(c.id)},${JSON.stringify(f.cle)},${JSON.stringify(l)})'>${esc(l)}</button>`).join("")}</div></div>`;
  }
  h += `<div class="card"><b>Nature</b><div>${NATURES.map(n => `<button class="${x.nature === n ? "sel" : ""}" onclick='setv(${JSON.stringify(c.id)},"nature",${JSON.stringify(n)})'>${esc(n)}</button>`).join("")}</div></div>
    <div class="card"><b>Label manquant</b><input value="${esc(x.label_manquant || "")}" oninput='settxt(${JSON.stringify(c.id)},"label_manquant",this)'>
    <b>Remarques</b><textarea oninput='settxt(${JSON.stringify(c.id)},"remarque",this)'>${esc(x.remarque || "")}</textarea></div>`;
  document.getElementById("cas").innerHTML = h;
}
function exporter(){
  const t = document.createElement("textarea");
  t.value = JSON.stringify(V, null, 1); t.style.cssText = "width:100%;height:300px";
  const c = document.getElementById("cas"); c.prepend(t); t.select();
  const p = document.createElement("p"); p.textContent = "Copiez ce texte (Ctrl/Cmd+C) et enregistrez-le dans un fichier annotations_aleatoire.json.";
  c.prepend(p);
}
render();
</script></body></html>"""


def tirage(args):
    gold = {json.loads(l)["id"] for l in open(GOLD_DIR / "gold_fige.jsonl", encoding="utf-8")}
    test = [l.strip() for l in open(args.test_ids) if l.strip() and l.strip() not in gold]
    textes = {}
    for corpus in args.corpus:
        for l in open(corpus, encoding="utf-8"):
            p = json.loads(l)
            textes.setdefault(p["id"], p)
    candidats = sorted(i for i in test if i in textes)
    random.seed(SEED)
    choisis = random.sample(candidats, args.n)
    sortie = GOLD_DIR / "aleatoire_projets.jsonl"
    with open(sortie, "w", encoding="utf-8") as f:
        for i in choisis:
            p = textes[i]
            f.write(json.dumps({"id": i, "nom": p["nom"], "description": p.get("description"),
                                "sources": p.get("sources")}, ensure_ascii=False) + "\n")
    from collections import Counter
    print(f"{len(choisis)} projets tirés parmi {len(candidats)} du split test → {sortie}")
    print(Counter(textes[i].get("sources") for i in choisis).most_common(8))


def page(args):
    from distill_schema import NATURE_INSTRUCTIONS
    ref = json.load(open(args.referentiel, encoding="utf-8"))
    defs = json.load(open(args.definitions, encoding="utf-8")) if args.definitions else {}
    cas = [json.loads(l) for l in open(GOLD_DIR / "aleatoire_projets.jsonl", encoding="utf-8")]
    facettes = []
    if ref.get("domaines"):  # niveau ajouté par le référentiel v2, s'il est retenu
        facettes.append({"cle": "domaines", "titre": "Domaine(s) de politique publique", "labels": ref["domaines"],
                         "definitions": ref.get("definitions_domaines", {})})
    facettes.append({"cle": "thematiques", "titre": "Thématiques", "labels": sorted(ref["thematiques"]),
                     "definitions": defs})
    rendu = (PAGE.replace("__CAS__", json.dumps(cas, ensure_ascii=False))
             .replace("__FACETTES__", json.dumps(facettes, ensure_ascii=False))
             .replace("__NATURES__", json.dumps(ref["natures"], ensure_ascii=False))
             .replace("__NATURES_DEF__", html.escape(ref.get("natures_instructions", NATURE_INSTRUCTIONS)))
             .replace("__VERSION__", json.dumps(Path(args.referentiel).stem)))
    sortie = Path(args.sortie) if args.sortie else GOLD_DIR / "annotation_aleatoire.html"
    sortie.write_text(rendu, encoding="utf-8")
    print(f"page : {sortie} ({len(cas)} cas, facettes : {', '.join(f['cle'] for f in facettes)})")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("tirage")
    t.add_argument("--test-ids", required=True, help="un id par ligne (ids du split test, sur la box)")
    t.add_argument("--corpus", nargs="+", default=[str(BENCH_DIR / "data/corpus_distill.jsonl"),
                                                   str(BENCH_DIR / "data/corpus_compl.jsonl")])
    t.add_argument("--n", type=int, default=100)
    p = sub.add_parser("page")
    p.add_argument("--referentiel", required=True)
    p.add_argument("--definitions")
    p.add_argument("--sortie")
    args = ap.parse_args()
    tirage(args) if args.cmd == "tirage" else page(args)


if __name__ == "__main__":
    main()
