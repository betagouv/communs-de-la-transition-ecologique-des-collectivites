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

Chaque questionnaire déclare les **étiquettes qui le définissent**, dans les taxonomies fermées
du schéma commun (`classification.ts`, typé : une étiquette hors taxonomie ne compile pas).

La règle : **le projet doit porter TOUTES ces étiquettes**, avec une confiance ≥ 0.8 (le même
seuil que le matching des aides — en dessous, le job LLM hésite, on n'agit pas dessus).

**Toutes**, et non au moins une. Sur `atoutbiodiv-solaire` (« école » + « solaire sur le bâti »),
« école » seule attraperait n'importe quel projet d'école, et « solaire » seul n'importe quelle
installation photovoltaïque. C'est la conjonction qui définit le questionnaire.

### Pourquoi un critère, et pas un score

Le score de matching des aides a été essayé ici, et il échoue pour une raison **structurelle** :
il normalise par le maximum du **projet**. Deux projets portant tous deux « Place ou centre-bourg »
obtenaient 1.00 et 0.11 selon que leur classification était pauvre ou riche — le second était
écarté alors qu'il est bel et bien une place.

Un questionnaire n'est pas une aide. Une aide _ressemble_ plus ou moins à un projet : un score a
du sens. Un questionnaire, lui, s'applique ou ne s'applique pas — c'est une salle des fêtes, ou
ce n'en est pas une. Un critère ne doit pas dépendre de la largeur de la classification d'à côté.

Bénéfice secondaire : on peut dire **pourquoi** un questionnaire n'est pas proposé (« il manque
le lieu _Place ou centre-bourg_ »). Un score de 0.11 ne se corrige pas ; une étiquette manquante,
si — soit la classification du projet est fausse, soit le questionnaire vise autre chose.

Conséquence directe : un projet **non encore classifié** (le job LLM n'a pas tourné) ne se voit
proposer aucun questionnaire.

### Le garde-fou qui compte

Un questionnaire qui n'exige **aucune** étiquette serait proposé à **tous** les projets — une
conjonction vide est vraie. Le chargeur refuse de démarrer dans ce cas.

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
