# Note de décision — Jev pour la labellisation des projets

*22/09/2026 · bench `bench/classification/`, branche `bench/jev-labellisation` · rapport
détaillé et graphique : artifact « Jev au banc d'essai » (+ `README.md` du dossier)*

## Verdict

**Concluant sur tout ce qui était mesurable aujourd'hui ; la seule question ouverte — la
qualité absolue sur les 138 thématiques — exige le gold humain, pas un autre bench.**

| Question du brief | Réponse | Preuve |
|---|---|---|
| Français OK ? | **Oui** | critères FR ≈ EN sur toutes les décisions testées (écart ≤ 0,07) |
| Qualité ≈ Sonnet ? | **Probablement ≥ Sonnet** : accord brut modéré (F1 0,58-0,61), mais l'arbitrage en aveugle de 124 désaccords par un modèle plus capable donne Jev clairement fondé dans 53 % de ses labels exclusifs (faux : 8 %) contre 9 % pour Sonnet (faux : 30 %) — le déficit vient du plafond de la référence. Le gold humain reste le juge de paix | phase 1 + arbitrage |
| ~100× moins cher ? | **Oui (≈ 50×)** : 0,34 $ / 1 000 projets mesurés, ~102 $ pour les 300 k traces (vs ~5 k€ estimés Sonnet) | phase 1 |
| Probabilités calibrées ? | **Comportement calibré confirmé** : l'incertitude est au bon endroit (médianes paires : no 0,17 · low 0,45 · medium 0,47 · high 0,74) ; la mesure ECE exacte attend le gold | phase 2 |
| Paires « même projet ? » | **Quasi-go** : AUC 0,96 cas tranchés, pièges à forte similarité déjoués (8 %), 1 désaccord franc sur 451, 0,01 $ le lot | phase 2 |
| vs souverain (Gemma 4 / Albert) | Gemma classe bien (AUC paires 0,94 vs 0,96, thématiques 0,97 vs 0,99) mais **ses logprobs saturent** (97-99 % de réponses < 0,05 ou > 0,95 ; médiane des paires `medium` = 0,007 ; F1 thématiques 0,35 vs 0,67, précision 0,21) : pas de nuance, pas de routage, pas de seuils par thématique, pas de soft labels | phase 3e |
| Fiabilité opérationnelle | 0 erreur, 0 retry sur ~1 900 requêtes, p95 0,55 s, ~17 req/s soutenus (endpoint pourtant « alpha ») | toutes phases |

## Décisions proposées

1. **Gold humain maintenant** (bloquant pour la suite) : 100-150 projets + 100 paires relus par
   Jean/Claire. C'est le même gold que l'étape 0 du bench Albert — un seul effort, deux usages.
   Le harnais rejoue toutes les métriques pour < 1 $.
2. **Pré-scoring des paires** : brancher Jev en amont du moteur de rapprochement (asynchrone,
   hors chemin critique, données non personnelles). Coût nul (0,01 $/450 paires), gain immédiat :
   routage auto / revue humaine sur la confiance.
3. **Provider `jev` dans l'interface classification** (cadrage §5.9, T4 2026) : à instruire si le
   gold confirme la phase 1 — d'abord labellisation à la demande (flux MEC), pas le stock.
4. **Distillation** : utiliser les probabilités Jev comme *soft labels* pour CamemBERTa — le run
   distillé est souverain par construction et Gemma ne peut pas fournir ces soft labels (saturation).
5. **Négociation d'accès** : demander à TypeSafe hébergement UE + ZDR + DPA avant d'évoquer la
   voie Albert/OpenRouter (accès non souverain via plateforme souveraine : fragile face à ARIANE).

## Garde-fous

- Société d'une semaine ; endpoint OpenRouter en **alpha** (fiable aujourd'hui, sans engagement) ;
  prix et quotas « ajustables sans préavis ». **Rien de critique ne doit en dépendre** ; toute mise
  en production s'accompagne de la trajectoire de sortie (distillation) et du maintien du provider
  Anthropic en repli.
- Périmètre données : non personnelles uniquement (intitulé + description) — même classe
  d'exposition que le run Anthropic actuel.

## Ce que ça coûterait d'aller plus loin

| Action | Coût | Délai |
|---|---|---|
| Re-run complet du bench sur gold humain | < 1 $ | 1 h de calcul |
| Rejouer le stock 300 k traces (si go) | ~102 $ | ~4-5 h au quota actuel |
| Pré-scoring du flux de paires | négligeable | intégration ~2-3 j |
