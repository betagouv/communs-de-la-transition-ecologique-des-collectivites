# Contenu des questionnaires spécialisés

## Qui écrit quoi

| Fichier                       | Auteur                          | Contenu                                                                       |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `questionnaires/<slug>.json`  | **Le partenaire** (AtoutBiodiv) | Bannière, questions, options, feedbacks. Du contenu affichable, rien d'autre. |
| `recommandations/<slug>.json` | **Le partenaire**               | Recommandations, financements, ressources, engagement, et leur `condition`.   |
| `classification.ts`           | **Communs**                     | L'éligibilité : sur quels projets le questionnaire est proposé.               |

Les JSON sont versionnés en Git et relus en PR : **c'est ça, l'étape « validé avec nous »**.

## Pourquoi l'éligibilité n'est pas dans les fichiers partenaires

Les fichiers d'origine portaient un bloc :

```jsonc
"eligibilite": { "thematiques": ["Équipements et services publics"], "competences": [] }
```

Ces libellés viennent du vocabulaire thématique de **MEC**. L'API, elle, classe les projets
(et les aides) dans des taxonomies fermées bien plus fines — 137 thématiques
(`Voirie`, `Sobriété énergétique`, `Vélo (mobilité douce)`…), 58 sites, 15 interventions,
définies dans `src/projet-qualification/classification/const/`.

Aucun projet n'a jamais porté l'étiquette « Équipements et services publics ». Une règle
booléenne sur ce vocabulaire n'aurait donc matché **aucun projet**, et le bug aurait été
silencieux : des questionnaires jamais proposés, sans la moindre erreur dans les logs.

Le champ a donc été retiré, et le chargeur (`index.ts`) **refuse de démarrer** s'il
réapparaît — un champ mort ne doit pas pouvoir revenir en silence dans une PR de contenu.

## Comment l'éligibilité fonctionne réellement

Chaque questionnaire est **classifié comme l'est une aide**, sur les trois mêmes axes, dans
les mêmes taxonomies (`classification.ts`, typé : une étiquette hors taxonomie ne compile
pas). L'éligibilité est ensuite un **score**, calculé par le moteur du matching des aides
(`AidesMatchingService`, réutilisé tel quel) :

- pondération par axe : thématiques 0.45, sites 0.35, interventions 0.20 ;
- seuil de confiance 0.8 : une étiquette dont le LLM n'est pas sûr ne compte pas ;
- score normalisé dans [0, 1], comparé à `SEUIL_ELIGIBILITE` (0.3, dans
  `questionnaires.service.ts`).

Le seuil est délibérément permissif : un faux positif coûte un onglet ignoré, un faux négatif
coûte une opportunité de biodiversité jamais vue.

Conséquence directe : un projet **non encore classifié** (le job LLM n'a pas tourné) ne se
voit proposer aucun questionnaire.

## Ajouter un questionnaire

1. Le partenaire fournit `questionnaires/<slug>.json` et `recommandations/<slug>.json`.
2. Déclarer l'entrée `<slug>` dans `classification.ts` — sans elle, le chargeur refuse de
   démarrer, plutôt que de laisser un questionnaire invisible en production.
3. Importer les deux fichiers dans `index.ts`.

Le chargeur valide au démarrage que chaque `condition` pointe une question et des options qui
existent : une coquille est une erreur immédiate, pas une recommandation qui ne s'affiche
jamais.

## Ce qui ne sort JAMAIS de l'API

`condition` et `classification`. Les DTO de réponse (`../dto/`) sont des types **distincts**
de ceux du contenu, sans équivalent pour ces champs : la frontière est structurelle, pas
déclarative. Exposer une condition serait une fuite de logique métier vers le client — la
spec l'interdit (§2).
