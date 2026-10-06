# Bench « Jev » — labellisation des projets de collectivités

> Bench exécuté le 22/09/2026 (branche `bench/jev-labellisation`). Question posée :
> **Jev (TypeSafe AI) peut-il faire la labellisation à la demande des projets — thématiques,
> proba TE, paires « même projet ? » — avec une qualité comparable à Sonnet 4.6, en français,
> pour ~100× moins cher et avec des probabilités calibrées ?**

## TL;DR

| Axe | Verdict | Chiffre clé |
|---|---|---|
| Français | ✅ aucun malus détecté | critères FR ≈ EN (écart ≤ 0,07 sur 10 projets × 6 questions) |
| Opérationnel | ✅ largement au-dessus des cibles | p50 0,4 s, p95 0,55 s, 0 erreur sur ~1 400 requêtes |
| Coût | ✅ ~50× moins cher que Sonnet | 0,34 $ / 1 000 projets labellisés (138 thématiques + sites + interventions + TE) → **~100 $ pour les 300 k traces** |
| Paires « même projet ? » | ✅ quasi-go | AUC 0,96 sur les cas tranchés, 1 seul désaccord franc sur 451 paires |
| Thématiques | 🟡 prometteur, **non conclusif sans gold humain** | accord modéré avec Sonnet (F1 ~0,6), mais les désaccords lus à la main donnent souvent raison à Jev |
| Proba TE | ✅ cohérente avec la nôtre | corrélation 0,78, accord binaire 81 % |
| Souveraineté | ❌ inchangé | modèle fermé US, pas d'hébergement UE — même case qu'Anthropic |

**Recommandation** : constituer le gold humain (100-150 projets, 100 paires — Jean/Claire) pour
trancher élève vs professeur sur les thématiques ; en parallèle, la voie « pré-scoring des paires »
est déjà exploitable techniquement. Détail en fin de document et dans la note de décision.

---

## 📖 Comment lire les métriques de ce rapport

Chaque métrique est notée avec son sigle usuel ; voici ce qu'elles mesurent, sur nos exemples.

**Précision, rappel, F1.** Pour une thématique donnée (ex. « Isolation thermique »), on compare
les labels que le modèle attribue aux labels de référence.
- La **précision** répond à : *quand le modèle dit « Isolation thermique », a-t-il raison ?*
  (proportion de vrais positifs parmi ses positifs).
- Le **rappel** répond à : *quand la référence dit « Isolation thermique », le modèle l'a-t-il
  trouvé ?* (proportion de la référence retrouvée).
- Le **F1** combine les deux en un seul chiffre (moyenne harmonique, entre 0 et 1). Un F1 de 0,6
  signifie grosso modo « le modèle et la référence se recouvrent aux deux tiers ».
- **micro** = on compte toutes les décisions (projet × label) dans un seul pot — les thématiques
  fréquentes dominent. **macro** = on calcule le F1 par thématique puis on moyenne — chaque
  thématique, rare ou fréquente, pèse pareil. La longue traîne se lit dans le macro.

**Seuil.** Jev ne répond pas « oui/non » mais par une probabilité (0,73). Pour compter un label
comme « attribué », on choisit un seuil (ex. ≥ 0,5). On reporte le F1 au seuil 0,5 et au seuil
qui maximise le F1 (« optimal ») — l'écart entre les deux dit si le modèle est bien réglé par
défaut ou s'il faut le recalibrer.

**AUC** (aire sous la courbe ROC, entre 0,5 et 1). Pour les paires : *si je tire au hasard une
vraie paire-doublon et une vraie paire-différente, quelle est la probabilité que le modèle ait
donné un score plus élevé à la vraie ?* 0,5 = pile ou face, 1,0 = tri parfait. L'AUC ne dépend
d'aucun seuil : elle mesure la qualité du **classement**, pas de la coupure.

**Calibration, ECE, Brier.** Un modèle est **calibré** si, quand il dit « 0,8 », il a raison
8 fois sur 10. On regroupe les prédictions par tranches de probabilité (« bins ») et on compare
la probabilité moyenne annoncée au taux de succès réel : c'est le diagramme de fiabilité.
- **ECE** (Expected Calibration Error) : l'écart moyen entre annoncé et constaté (0 = parfait ;
  ≤ 0,08 était notre cible).
- **Brier** : l'erreur quadratique moyenne des probabilités (0 = parfait). Pénalise à la fois la
  mauvaise calibration et le manque de discrimination.
- ⚠️ Dans ce bench, la « vérité » utilisée pour la calibration est **la sortie de Sonnet**, pas un
  gold humain — voir la limite majeure ci-dessous.

**Couverture × exactitude.** L'usage cible n'est pas « le modèle décide tout » mais un **routage** :
on accepte automatiquement les décisions confiantes, on envoie le reste en revue. La **confiance**
d'une réponse oui/non est sa distance à l'incertitude (une proba de 0,95 ou de 0,05 est confiante ;
0,5 ne l'est pas). On reporte, pour chaque niveau de confiance exigé : la **couverture** (part des
décisions qu'on accepte automatiquement) et l'**exactitude** de ces décisions-là. Ex. « conf ≥ 0,9 :
couverture 75 %, exactitude 99,6 % » = on peut auto-accepter les ¾ des décisions en n'acceptant
qu'un désaccord sur 250.

**⚠️ La limite majeure de ce bench : la référence est Sonnet, pas la vérité.** Tous les chiffres
d'« accord » mesurent un accord *élève/professeur*. Or le protocole Sonnet actuel impose
**exactement 3 thématiques** par projet et n'en retient que celles à score ≥ 0,8 : quand Jev attribue
un 4ᵉ label correct, il est compté *faux positif* ; quand Sonnet choisit un label sœur (« rénovation
énergétique » générique vs « … tertiaire »), le bon label de Jev est compté faux. La lecture manuelle
des désaccords francs (§ phase 1) montre que Jev a souvent raison contre la référence. Seul un
**gold humain** permettra de conclure sur la qualité absolue.

---

## Protocole

- **Échantillon** (extrait en lecture seule de `schema_commun_v2`, prod ; aucun champ nominatif) :
  - **498 projets** stratifiés par source (MEC 136, Fonds Vert 94, DGCL DETR 80, PVD 66, ACV 42,
    DSIL 40, DPV 20, Vivier COP 20) + 58 tirés pour forcer 30 thématiques rares (longue traîne).
    339 ont une classification Sonnet de référence ; 144 ont une description (moyenne 570 car.),
    les autres n'ont qu'un intitulé — c'est représentatif du stock réel.
  - **451 paires** de `llm_pair_judgments` : 120 `high`, 120 `medium`, 91 `low`, 60 `no` aléatoires
    et 60 `no` « difficiles » (similarité d'embedding maximale — les pièges).
- **State envoyé à Jev** : intitulé + description, comme le pipeline Sonnet. Critères en français.
- **Requête type (phase 1)** : 138 `noul` (un par thématique, avec définition d'une ligne) +
  `choice` 59 sites + `choice` 15 interventions + 4 `noul` TE — le tout en **une seule requête**
  de ~8 100 tokens, évaluée en parallèle côté Jev.
- **Accès** : OpenRouter, endpoint decisions (alpha), modèle `typesafe/jev-1.13`, 8 requêtes en
  parallèle, retries avec backoff exponentiel.

Reproduire : `python extract_sample.py` (tunnel DB requis) puis `phase0_smoke.py`,
`phase1_run.py` + `phase1_report.py`, `phase2_pairs.py`, `phase3_choice138.py`,
`phase3_albert.py` + `albert_report.py`. Clés dans `.env` (gitignoré).

## Phase 0 — fumée (10 projets, FR vs EN)

Probabilités quasi identiques entre critères français et anglais (state toujours en français) ;
discrimination nette (« Rénovation thermique des bâtiments communaux », titre seul → rénovation
0,97, isolation 0,90, distracteurs ≤ 0,15) ; désaccords TE instructifs des deux côtés
(éclairage public : Jev 0,84 vs Sonnet 0,56, moyenne pondérée tirée vers le bas par « Voirie » ;
camping/argiles : Jev 0,25 vs Sonnet 0,53, l'adaptation n'est pas visible dans le texte).
**Le risque « français » du brief est écarté.**

## Phase 1 — labellisation complète (498 projets)

### Opérationnel

| Métrique | Valeur | Cible brief |
|---|---|---|
| Erreurs / timeouts | **0 / 498** (pas un seul retry) | — |
| Latence | p50 **0,41 s**, p95 0,55 s | p95 < 2 s ✅ |
| Débit constaté | ~17 req/s (8 workers) — 498 projets en 28 s | — |
| Tokens / projet | 8 124 en entrée (sortie gratuite) | — |
| Coût | **0,34 $ / 1 000 projets** → 102 $ pour 300 k | < 1 $ / 1 000 ✅ |

### Accord avec Sonnet (339 projets de référence)

| Métrique | Valeur |
|---|---|
| Thématiques — micro F1 au seuil 0,5 | 0,39 (précision 0,25, rappel 0,88) |
| Thématiques — micro F1 au seuil optimal (0,85) | **0,58** |
| Thématiques — micro F1, labels sœurs regroupés en familles | 0,61 |
| Thématiques — macro F1 (32 labels à ≥ 3 positifs) | 0,50 |
| top-1 Sonnet présent dans le top-3 Jev | **68 %** |
| Sites (choice 59) — top-1 = top-1 Sonnet / dans les 3 Sonnet | 57 % / 74 % |
| Interventions (choice 15) — idem | 66 % / 77 % |
| Proba TE — corrélation / MAE / accord binaire | **0,78** / 0,14 / 81 % |

Lecture : l'accord brut est moyen, mais il est **plafonné par la référence** (cf. encadré). Le
diagramme de fiabilité le montre : dans le bin 0,9-1,0 — là où Jev est quasi certain — Sonnet n'a
retenu le label que 59 % du temps. Or les désaccords de ce bin, lus à la main, sont massivement
des trous de Sonnet, pas des erreurs de Jev :

```
0.98  Audit ou travaux de rénovation énergétique tertiaire  ←  RENOVATION ENERGETIQUE DE L'ECOLE LOUIS PASTEUR
0.97  Voie douce, piste cyclable                             ←  Voie verte : réalisation de la voie verte de la gare au camping
0.97  Cours d'eau, lacs et étangs                            ←  Travaux de restauration du lit du torrent du Rabioux
```

L'ECE vs Sonnet (0,089) dépasse la cible 0,08, mais mesuré contre cette référence-là il est
ininterprétable : le gold humain est le seul juge valable de la calibration.

### Routage par confiance (l'usage cible)

| Confiance exigée | Couverture | Accord avec Sonnet |
|---|---|---|
| ≥ 0,5 | 100 % | 97,8 % |
| ≥ 0,7 | 95,5 % | 98,9 % |
| ≥ 0,9 | **75 %** | **99,6 %** |

Les désaccords se concentrent exactement dans la zone d'incertitude — c'est le comportement
attendu d'un modèle calibré, et ce qui rend le routage auto/revue exploitable.

### L'arbitrage des désaccords (LLM juge, en aveugle)

Pour dépasser la limite « référence = Sonnet », un arbitre plus capable que les deux candidats
(Claude Fable 5) a jugé **124 décisions en aveugle** (sans savoir qui proposait le label) :
60 labels affirmés par Jev seul (≥ 0,8), 44 retenus par Sonnet seul (Jev < 0,5 — pool exhaustif),
20 contrôles où les deux sont d'accord. Verdicts : `oui` (s'applique), `limite` (défendable —
souvent un générique quand une variante plus précise existe), `non` (erroné).

| Strate | n | oui | limite | non |
|---|---|---|---|---|
| Labels Jev seul | 60 | **53 %** | 38 % | **8 %** |
| Labels Sonnet seul | 44 | **9 %** | 61 % | **30 %** |
| Contrôle (accord) | 20 | 80 % | 20 % | 0 % |

Lecture : quand Jev affirme un label absent chez Sonnet, il est clairement fondé 1 fois sur 2 et
faux 1 fois sur 12 ; quand Sonnet retient un label que Jev rejette, il n'est clairement fondé
qu'1 fois sur 11 et clairement faux 1 fois sur 3. **Le déficit apparent de Jev dans les métriques
d'accord vient majoritairement du plafond de la référence, pas de ses erreurs.** Réserves :
l'arbitre est un modèle Anthropic (biais de famille éventuel — qui jouerait plutôt en faveur de
Sonnet) ; la relecture humaine reste le juge de paix. Reproduire : `arbitre_extract.py` puis
jugement manuel/LLM des cas (`arbitre_verdicts.json` committé).

## Phase 2 — paires « même projet ? » (451 paires)

Référence bien plus propre : un verdict par paire (`no`/`low`/`medium`/`high`) issu du pipeline
de rapprochement. Binaire : `medium`+`high` = même projet.

| Métrique | Valeur | Cible |
|---|---|---|
| AUC (toutes paires) | 0,83 | — |
| **AUC cas tranchés** (`high` vs `no`) | **0,96** | — |
| Exactitude au seuil 0,5 | 0,74 | — |
| conf ≥ 0,9 : couverture / exactitude | 9,3 % / 0,98 | ≥ 0,9 ✅ |
| Négatifs difficiles (forte similarité d'embedding) franchissant 0,5 | **8,3 %** | — |
| Désaccords francs (Jev ≥ 0,9 vs `no`, ou ≤ 0,1 vs `high`) | **1 / 451** | — |
| Coût / latence | 0,01 $ les 451 · p50 0,37 s | — |

La médiane des probabilités par verdict raconte la calibration : `no` 0,17 · `no`-difficiles 0,19 ·
`low` 0,45 · `medium` 0,47 · `high` 0,74. **Jev est incertain exactement là où le pipeline
lui-même dit « probable »** — et le score ordinal à 4 niveaux est à un niveau près du verdict dans
92 % des cas. Le seul désaccord franc (deux rénovations de groupes scolaires, Jev 0,91 vs `no`)
est un cas à arbitrer humainement — le pipeline n'a pas forcément raison.

## Phase 3 — variantes

### (b) `choice` unique à 138 options pour la thématique principale

| Métrique | noul × 138 (phase 1) | choice 138 |
|---|---|---|
| top-1 = top-1 Sonnet | — | 55 % |
| top-1 Jev dans les 3 Sonnet | — | 74 % |
| top-1 Sonnet dans top-3 Jev | 68 % | 74 % |
| conf ≥ 0,9 : couverture / top-1 / dans-les-3 | — | 48 % / 78 % / 86 % |
| Tokens / projet | 8 124 (tout compris) | 6 023 (thématique seule) |

Le `choice` géant fonctionne (74 % de top-1 dans les 3 de Sonnet, confiance médiane 0,88) et
fournit une **distribution normalisée sur les 138 labels** — directement utilisable comme espace
latent pour le clustering. Les deux formes sont complémentaires : `choice` pour « LA » thématique
principale, `noul` pour le multi-label avec seuils par thématique.

### (e) Comparatif souverain — Gemma 4 31B (Albert API), unaire + logprobs

Même protocole, mêmes données, probabilité lue dans les logprobs du premier token (« Réponds
uniquement par Oui ou Non »). 3 700 requêtes, 0 erreur, plafonnées au quota Albert (100 req/min,
throttle client à 92 — d'où 40 min de run et le sous-échantillon thématiques).

| Métrique | Jev | Gemma 4 31B |
|---|---|---|
| Proba TE — corrélation avec Sonnet / MAE (498 projets) | **0,78** / 0,14 | 0,64 / 0,29 |
| Proba TE — probabilités extrêmes (< 0,05 ou > 0,95) | 2,7 % | **97,3 %** |
| Paires — AUC toutes / cas tranchés (451) | **0,83 / 0,96** | 0,75 / 0,94 |
| Paires — médiane des `medium` (« probable ») | 0,47 | **0,007** |
| Thématiques unaires — AUC (20 projets × 138) | **0,989** | 0,967 |
| Thématiques unaires — F1 au seuil optimal | **0,67** | 0,35 (P = 0,21) |

Lecture : Gemma **classe** correctement (AUC honorables) mais ses probabilités **saturent** —
le logprob d'un « Oui/Non » forcé n'est pas une probabilité calibrée. Conséquences concrètes :
pas de seuils par thématique (précision 0,21 au seuil optimal), pas de routage par confiance
(les paires « probables » tombent à 0,007), pas de soft labels pour la distillation. La
décomposition unaire + logprobs, telle quelle, ne remplace pas un modèle de décision calibré ;
la piste souveraine passe par la distillation (avec les probas Jev comme teacher) ou par un
vrai calibrage aval (Platt/isotonic sur gold humain).

## Rapport graphique

Version interactive et didactique du présent rapport (visualisations, encadrés « comment
lire ») : artifact **« Jev au banc d'essai »** —
https://claude.ai/code/artifact/9cfb22e8-2c61-4d04-b200-13320783e2bb
(régénérable : `prep_report_data.py` puis injection de `results/report_data.json` dans
`report_template.html`).

## Verdict et suites

Voir `NOTE-DECISION.md` (une page).
