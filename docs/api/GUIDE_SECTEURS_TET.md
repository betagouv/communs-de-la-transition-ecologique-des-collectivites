# Guide d'intégration — Secteurs réglementaires des fiches action

> Documentation à destination de **Territoires en Transitions (TeT)** pour l'utilisation de
> l'endpoint secteurs. Spec machine : Swagger de l'instance (`/api`), section « TeT ».

## Ce que ça fait

Pour chaque fiche action que TeT nous a envoyée, l'API sait dire à quel(s) **secteur(s)
réglementaire(s) d'émissions** la fiche se rattache, parmi les 8 secteurs des inventaires
(SECTEN) : `residentiel`, `tertiaire`, `transport_routier`, `autres_transports`,
`agriculture`, `dechets`, `industrie_hors_branche_energie`, `branche_energie`.

Le calcul est **déterministe** (pas d'appel IA au moment de la requête) : il dérive des
labels déjà portés par la fiche — sa classification automatique et ses leviers SGPE
déclarés — via une table de correspondance métier. Même fiche, même réponse, tant que ses
labels ne changent pas.

## L'appel

```http
GET /tet/v1/actions/{id}/secteurs
Authorization: Bearer <TET_API_KEY>
```

`{id}` accepte **votre identifiant de fiche** (l'`externalId` que vous nous poussez par
webhook) ou notre UUID interne — c'est vrai pour tous les endpoints fiche (`GET`, `PATCH`,
`/secteurs`). Exemple :

```http
GET /tet/v1/actions/144855/secteurs
```

```json
{
  "id": "0199...uuid-interne...",
  "secteursDirect": {
    "dominant": "dechets",
    "nonAttribuable": 0.19,
    "parts": {
      "residentiel": 0, "tertiaire": 0.06, "transport_routier": 0,
      "autres_transports": 0, "agriculture": 0, "dechets": 0.75,
      "industrie_hors_branche_energie": 0, "branche_energie": 0
    }
  },
  "secteursContribution": { "...même forme..." },
  "methode": "mapping-v1.1/agregation-v1"
}
```

## Comment lire la réponse

- **`parts`** : la répartition de la fiche entre les secteurs (0-1). `parts` +
  `nonAttribuable` somment à 1. Vous pouvez prendre le seul `dominant`, ou tous les
  secteurs au-dessus d'un seuil de votre choix (0,2 est un bon défaut).
- **`dominant`** : le secteur de plus forte part — `null` quand le non-attribuable domine.
- **`nonAttribuable`** : la part de la fiche qui ne se rattache à aucun secteur d'émissions.
  Ce n'est pas un défaut de calcul : une fiche de gouvernance, un intitulé muet, ou une
  action **biodiversité/nature** (hors périmètre émissions, volontairement) sortent non
  attribuables. Sur votre stock actuel, ~31 % des fiches sont dans ce cas — vérifié par
  contre-épreuve, c'est une propriété des fiches, pas de la méthode.
- **`methode`** : la version de la table et de l'agrégation. Elle change quand le
  référentiel évolue — si vous stockez nos réponses, stockez-la avec.

### Les deux sémantiques

- **`secteursDirect`** — *de quel secteur relève l'action* : une piste cyclable relève des
  mobilités (`autres_transports`).
- **`secteursContribution`** — *sur quel secteur elle agit* : la même piste cyclable réduit
  la voiture (`transport_routier`).

Prenez celle qui correspond à votre usage (rattachement d'inventaire → direct ; lecture
d'impact → contribution). Les deux sont toujours renvoyées.

### Ce que « secteur » veut dire ici (important)

Le secteur est celui que **l'action vise** — le rattachement naturel dans un plan climat —
pas un inventaire des émissions produites par l'activité elle-même : une sensibilisation au
tri se rattache aux `dechets`, une animation vélo aux transports, une étude de rénovation au
secteur des bâtiments concernés. Convention transports (SECTEN) : `transport_routier` couvre
**tout véhicule sur route, y compris bus, cars, covoiturage et véhicules électriques** ;
`autres_transports` couvre modes actifs (vélo, marche), ferroviaire et fluvial.

## ⏱ Délai de disponibilité après création d'une fiche

Les secteurs dérivent de la **classification automatique** de la fiche, qui est
**asynchrone** : quand vous poussez une fiche par webhook, un job de classification part en
arrière-plan (**3-4 secondes constatées** pour une fiche isolée ; comptez jusqu'à ~30 s,
davantage lors d'un envoi en masse — les jobs sont traités en file).

```
POST /tet/v1/actions  ──→  fiche stockée (réponse immédiate 201)
                              │
                              ├─ leviers SGPE fournis ? → secteurs partiels DISPONIBLES
                              │                            immédiatement (souvent décisifs)
                              └─ classification en file  → ~5-30 s
                                        │
                              secteurs complets disponibles
```

Concrètement, juste après une création :

| État de la fiche | Réponse de `/secteurs` |
|---|---|
| Leviers déclarés dans votre webhook | secteurs calculés **immédiatement** sur les leviers (le signal le plus fort du calcul) — affinés dès que la classification arrive |
| Ni leviers, classification pas encore passée | `secteursDirect` et `secteursContribution` **null** |
| Classification passée | secteurs complets |

**Recommandation d'intégration** : ne bloquez pas votre flux de création sur les secteurs.
Soit vous les récupérez en différé (batch/nuit — le stock existant est déjà classifié à
99,7 %), soit, pour un affichage immédiat, réessayez après ~10 s si la réponse est `null`.
Pour lever l'ambiguïté « fiche muette vs classification en attente », `GET
/tet/v1/actions/{id}` (votre externalId accepté, comme partout) montre si
`classificationScores` est renseigné : renseigné + secteurs null = fiche réellement non
attribuable ; absent = classification encore en file.

À noter : le calcul étant fait **à la lecture**, toute reclassification future d'une fiche
(amélioration de nos modèles, correction) se reflète immédiatement dans les secteurs, sans
action de votre part.

## Exemples réels (stock TeT)

| Fiche | dominant (direct) | parts principales |
|---|---|---|
| « Faciliter l'intégration de matériaux de réemploi dans les marchés » | `dechets` | déchets 0,75 · nonAttr 0,19 |
| « Étude d'opportunités sur les motorisations alternatives » | `transport_routier` | routier 0,62 · nonAttr 0,26 |
| « Améliorer la biodiversité du territoire » | `null` (non attribuable) | nonAttr 0,96 — hors périmètre émissions, comportement attendu |

## Limites et accès

- Auth : votre clé TeT habituelle (`Authorization: Bearer`). Limite : 500 requêtes/min.
- `404` : identifiant inconnu (jamais synchronisé chez nous).
- Qualité : la table de correspondance a été contrôlée sur l'intégralité de votre stock
  (62 514 fiches) contre un juge indépendant — 2,7 % de désaccords résiduels, corrections
  intégrées (`methode: mapping-v1.1`). Signalez-nous les rattachements qui vous semblent
  faux : la table est faite pour être amendée et versionnée.
