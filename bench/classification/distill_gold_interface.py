"""B2 — Génère l'interface d'arbitrage en aveugle (HTML autonome) pour le gold.

Entrée : data/gold/gold_projets.jsonl (propositions anonymisées A/B).
Sortie : data/gold/arbitrage.html — fichier unique à envoyer à l'arbitre (Jean) :
  - un cas par écran, texte du projet, propositions A et B côte à côte ;
  - verdict thématiques : A / B / équivalents / aucun bon (+ labels corrects libres) ;
  - tranche nature : choix A / B / autre (menu 9 classes) ;
  - progression en localStorage, bouton « Exporter les verdicts » → JSON à nous renvoyer.
La clé A/B↔algo reste dans gold_key.json, jamais dans le HTML.
"""

import html
import json
from pathlib import Path

BENCH_DIR = Path(__file__).parent
GOLD_DIR = BENCH_DIR / "data" / "gold"

NATURES = ["Projet opérationnel", "Action", "Diagnostic", "Dispositif", "Indicateur",
           "Médiation", "Moyens", "Tâche", "Indéterminé"]

LABELS_PATH = BENCH_DIR / "referentiel_etendu.json"

PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arbitrage gold — classification</title>
<style>
body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;line-height:1.45;background:#fafafa;color:#161616}
.card{background:#fff;border:1px solid #ddd;border-radius:8px;padding:18px 20px;margin:14px 0}
.props{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.prop{border:1px solid #ccc;border-radius:6px;padding:10px 12px;background:#f6f6fe}
.prop h4{margin:0 0 6px}
ul{margin:4px 0;padding-left:18px}
.desc{color:#444;font-size:.92em;white-space:pre-wrap}
.meta{color:#888;font-size:.8em}
button{font-size:1em;padding:8px 14px;border-radius:6px;border:1px solid #888;background:#fff;cursor:pointer;margin:4px 6px 4px 0}
button.sel{background:#000091;color:#fff;border-color:#000091}
#bar{position:sticky;top:0;background:#fafafa;padding:8px 0;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;align-items:center}
textarea{width:100%;min-height:40px}
input{width:100%;padding:6px;margin:6px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box}
#regles ul{font-size:.9em}
.exp{background:#009081;color:#fff;border-color:#009081}
</style></head><body>
<details class="card" id="regles"><summary><b>📏 Règles d'arbitrage (à lire avant de commencer)</b></summary>
<ul>
<li><b>Combien de labels ?</b> Pas de nombre imposé : la bonne liste contient <b>tous les labels qui s'appliquent clairement, et seulement eux</b> — typiquement 1 à 4. Une liste vide est un verdict légitime si le projet ne relève d'aucune thématique du référentiel.</li>
<li><b>Précis bat générique</b> : si « Tourisme » et « Tourisme décarboné » s'appliquent tous deux, le label précis est le bon.</li>
<li><b>Ce qui disqualifie une liste</b> : des labels parasites (hors sujet), ou l'omission d'une thématique centrale du projet. Mieux vaut une liste courte et juste qu'une liste longue et floue.</li>
<li><b>Jugez le fond, pas le style</b> : vous ne savez pas quel algorithme a produit A ou B — n'essayez pas de deviner.</li>
<li><b>Nature de l'objet</b> : <i>Projet opérationnel</i> = concret, localisé, moyens engagés/demandés · <i>Action</i> = action d'un plan, pas encore budgétée · <i>Diagnostic</i> = étude/schéma/audit · <i>Dispositif</i> = aide/accompagnement, pas un projet · <i>Indicateur</i> = ligne de suivi · <i>Médiation</i> = animation/sensibilisation/concertation · <i>Moyens</i> = financement de poste/fonctionnement · <i>Tâche</i> = gestion interne · <i>Indéterminé</i>.</li>
</ul></details>
<div id="bar"><b id="prog"></b><span><button onclick="nav(-1)">◀ Précédent</button>
<button onclick="nav(1)">Suivant ▶</button>
<button class="exp" onclick="exporter()">Exporter les verdicts</button></span></div>
<div id="zone"></div>
<script>
const CAS = __CAS__;
const NATURES = __NATURES__;
const LABELS = __LABELS__;
let filtre = null, filtreTxt = "";
function normTxt(s){ return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function renderList(id){
  const zone = document.getElementById("list-" + id);
  if (!zone) return;
  if (filtreTxt.length < 2){ zone.innerHTML = ""; return; }
  const q = normTxt(filtreTxt);
  zone.innerHTML = LABELS.filter(l => normTxt(l).includes(q)).slice(0, 12)
    .map(l => `<button onclick="toggleLabel('${id}', \`${l}\`)">${l}</button>`).join(" ");
}
function toggleLabel(id, label){
  V[id] = V[id] || {};
  const arr = V[id].labels_corrects || [];
  V[id].labels_corrects = arr.includes(label) ? arr.filter(x => x !== label) : [...arr, label];
  filtreTxt = ""; filtre = null;
  save();
}
let i = +(localStorage.getItem("gold_pos") || 0);
const V = JSON.parse(localStorage.getItem("gold_verdicts") || "{}");
function save(){ localStorage.setItem("gold_verdicts", JSON.stringify(V)); localStorage.setItem("gold_pos", i); render(); }
function setv(id, champ, val){ V[id] = V[id] || {}; V[id][champ] = val; save(); }
function nav(d){ i = Math.max(0, Math.min(CAS.length - 1, i + d)); save(); window.scrollTo(0,0); }
function btn(id, champ, val, label){
  const sel = (V[id]||{})[champ] === val ? "sel" : "";
  return `<button class="${sel}" onclick="setv('${id}','${champ}','${val}')">${label}</button>`;
}
function render(){
  const c = CAS[i], v = V[c.id] || {};
  const faits = Object.keys(V).filter(k => V[k].verdict || V[k].nature).length;
  document.getElementById("prog").textContent = `Cas ${i+1}/${CAS.length} — ${faits} arbitrés — tranche : ${c.tranche}`;
  let h = `<div class="card"><h3>${c.nom}</h3>`;
  if (c.description) h += `<div class="desc">${c.description}</div>`;
  h += `<div class="meta">source : ${c.sources}</div></div>`;
  if (c.tranche !== "nature"){
    h += `<div class="card"><div class="props">
      <div class="prop"><h4>Proposition A</h4><ul>${(c.proposition_A||[]).map(l=>`<li>${l}</li>`).join("") || "<li><i>aucun label</i></li>"}</ul></div>
      <div class="prop"><h4>Proposition B</h4><ul>${(c.proposition_B||[]).map(l=>`<li>${l}</li>`).join("") || "<li><i>aucun label</i></li>"}</ul></div></div>
      <p><b>Quelles thématiques sont les plus justes ?</b></p>
      ${btn(c.id,"verdict","A","A nettement")} ${btn(c.id,"verdict","A+","A plutôt")}
      ${btn(c.id,"verdict","=","équivalents")} ${btn(c.id,"verdict","B+","B plutôt")}
      ${btn(c.id,"verdict","B","B nettement")} ${btn(c.id,"verdict","0","aucun des deux")}
      <p>Labels corrects selon toi (optionnel — surtout si « aucun des deux ») :</p>
      <div>${(v.labels_corrects||[]).map(l=>`<button class="sel" onclick="toggleLabel('${c.id}',\`${l}\`)">${l} ✕</button>`).join(" ")}</div>
      <input placeholder="filtrer les 170 labels…" oninput="filtre='${c.id}'; filtreTxt=this.value; renderList('${c.id}')" value="${filtre===c.id?filtreTxt:''}">
      <div id="list-${c.id}"></div>
      <p style="margin-top:14px">💬 <b>Remarques</b> (optionnel — thématique manquante au référentiel, ambiguïté, règle à fixer, donnée douteuse…)</p>
      <textarea onchange="setv('${c.id}','remarque',this.value)" placeholder="ex. : il manque un label « équipements sportifs et de loisirs »">${v.remarque||""}</textarea></div>`;
  } else {
    h += `<div class="card"><p><b>Nature de l'objet :</b> A = « ${c.nature_A} » · B = « ${c.nature_B} »</p>
      ${btn(c.id,"nature","A","A a raison")} ${btn(c.id,"nature","B","B a raison")}
      ${btn(c.id,"nature","0","ni l'un ni l'autre")}
      <p>Si « ni l'un ni l'autre », la bonne nature :</p>
      ${NATURES.map(n=>btn(c.id,"nature_correcte",n,n)).join(" ")}
      <p style="margin-top:14px">💬 <b>Remarques</b> (optionnel — thématique manquante au référentiel, ambiguïté, règle à fixer, donnée douteuse…)</p>
      <textarea onchange="setv('${c.id}','remarque',this.value)" placeholder="ex. : il manque un label « équipements sportifs et de loisirs »">${v.remarque||""}</textarea></div>`;
  }
  document.getElementById("zone").innerHTML = h;
}
function exporter(){
  const blob = new Blob([JSON.stringify(V, null, 1)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "verdicts_gold.json";
  a.click();
}
render();
</script></body></html>"""


def main():
    cas = [json.loads(l) for l in open(GOLD_DIR / "gold_projets.jsonl", encoding="utf-8")]
    for c in cas:  # l'arbitre ne voit ni les ids d'algo ni les scores
        c.pop("jev_top3", None)
        if c.get("description"):
            c["description"] = html.escape(c["description"][:1200])
        c["nom"] = html.escape(c["nom"])
    labels = json.load(open(LABELS_PATH))["thematiques"]
    page = PAGE.replace("__CAS__", json.dumps(cas, ensure_ascii=False)).replace(
        "__NATURES__", json.dumps(NATURES, ensure_ascii=False)).replace(
        "__LABELS__", json.dumps(labels, ensure_ascii=False))
    out = GOLD_DIR / "arbitrage.html"
    out.write_text(page, encoding="utf-8")
    print(f"{out} — {len(cas)} cas, {out.stat().st_size // 1024} ko")


if __name__ == "__main__":
    main()
