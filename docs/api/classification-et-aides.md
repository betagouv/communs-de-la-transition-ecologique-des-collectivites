# Guide d'intégration — Classification & Matching d'Aides

> Documentation à destination de **Mon Espace Collectivité (MEC)** pour l'utilisation de l'API de classification et du matching d'aides.

## Vue d'ensemble

L'API Collectivités enrichit automatiquement les projets envoyés par MEC avec une **classification thématique** (138 thématiques, 59 sites, 15 interventions) et propose un **matching avec les aides d'Aides-Territoires** basé sur cette classification.

```
┌─────────────┐          ┌──────────────────────────────────┐
│             │  POST     │       API Collectivités          │
│     MEC     │─────────→ │                                  │
│             │ /projets  │  1. Stocke le projet             │
│             │           │  2. Déclenche la classification  │
│             │           │     (async, ~10s)                │
│             │           │  3. Stocke les résultats         │
│             │ GET       │                                  │
│             │─────────→ │  4. Retourne projet + classif    │
│             │ /projets/ │                                  │
│             │ :id       │                                  │
│             │           │                                  │
│             │ GET       │  5. Proxy Aides-Territoires      │
│             │─────────→ │     + enrichissement classif     │
│             │ /aides    │     + matching par pertinence    │
│             │           │                                  │
└─────────────┘          └──────────────────────────────────┘
```

## Quand est-ce que la classification se déclenche ?

### Automatiquement à la création/mise à jour du projet

```
POST /projets ──→ Projet stocké en DB
                     │
                     ├── classificationThematiques est vide ?
                     │   └── OUI → Job async de classification lancé
                     │
                     └── Réponse immédiate (HTTP 201)
                         La classification n'est PAS encore disponible

                    ~~~~ 5-15 secondes plus tard ~~~~

                Job terminé → classification_thematiques,
                               classification_sites,
                               classification_interventions,
                               probabilite_te
                             sont remplis en DB
```

**Important** : La classification est **asynchrone**. Le `POST /projets` retourne immédiatement, avant que la classification soit terminée. Il faut attendre quelques secondes puis faire un `GET /projets/:id` pour récupérer les résultats.

### Pas de re-classification si déjà classifié

Si le projet a déjà des `classificationThematiques`, le job de classification **n'est pas relancé**. Pour forcer une re-classification, envoyer le champ à `null` lors d'un `PATCH`.

## Les endpoints à utiliser

### 1. Créer / mettre à jour un projet (existant)

```http
POST /projets
Authorization: Bearer <MEC_API_KEY>
Content-Type: application/json

{
  "nom": "Rénovation thermique du gymnase",
  "description": "Isolation des murs et remplacement du chauffage",
  "externalId": "mec-projet-123",
  "collectivites": [{"type": "Commune", "code": "44109"}]
}
```

**Réponse** : `{ "id": "019d..." }` — le projet est stocké, la classification est en cours.

### 2. Récupérer un projet avec sa classification

```http
GET /projets/019d...
Authorization: Bearer <MEC_API_KEY>
```

**Réponse** (une fois classifié) :

```json
{
  "id": "019d...",
  "nom": "Rénovation thermique du gymnase",
  "description": "Isolation des murs et remplacement du chauffage",
  "classificationThematiques": [
    "Isolation thermique",
    "Audit ou travaux de rénovation énergétique"
  ],
  "classificationSites": [
    "Salle de sport ou gymnase"
  ],
  "classificationInterventions": [
    "Rénovation bâtiment"
  ],
  "probabiliteTE": "0.88",
  "classificationScores": {
    "thematiques": [
      {"label": "Isolation thermique", "score": 0.95},
      {"label": "Pompes à chaleur", "score": 0.9},
      {"label": "Audit ou travaux de rénovation énergétique", "score": 0.85}
    ],
    "sites": [
      {"label": "Salle de sport ou gymnase", "score": 0.95},
      {"label": "Bâtiment public", "score": 0.5}
    ],
    "interventions": [
      {"label": "Rénovation bâtiment", "score": 0.95},
      {"label": "Entretien", "score": 0.4}
    ]
  },
  "competences": ["90-411"],
  "leviers": ["Rénovation (hors changement chaudières)"],
  ...
}
```

**Différence entre les champs** :
| Champ | Contenu | Usage |
|-------|---------|-------|
| `classificationThematiques` | Labels filtrés (score ≥ 0.8) | Affichage, filtres simples |
| `classificationScores` | Tous les labels avec scores | Matching, analyses avancées |
| `probabiliteTE` | Probabilité transition écologique (0-1) | Indicateur, tri |

### 3. Trouver les aides pertinentes pour un projet

```http
GET /aides?projet_id=019d...&perimeter=70971&limit=10
Authorization: Bearer <MEC_API_KEY>
```

**Paramètres** :
| Param | Description | Requis |
|-------|-------------|--------|
| `projet_id` | ID du projet pour le matching | Non (mais recommandé) |
| `perimeter` | ID de périmètre Aides-Territoires | Non |
| `limit` | Nombre max de résultats (défaut: 20) | Non |

**Réponse** :

```json
{
  "aides": [
    {
      "id": 89883,
      "name": "Financer la rénovation énergétique des bâtiments publics",
      "url": "/aides/xxxx/",
      "financers": ["ADEME"],
      "description": "...",
      "categories": ["Réhabilitation"],
      "aid_types": ["Subvention"],
      "perimeter": "France",

      "classification": {
        "thematiques": [
          { "label": "Audit ou travaux de rénovation énergétique", "score": 0.92 },
          { "label": "Isolation thermique", "score": 0.85 }
        ],
        "sites": [{ "label": "Bâtiment public", "score": 0.88 }],
        "interventions": [{ "label": "Rénovation bâtiment", "score": 0.9 }]
      },
      "matchingScore": 0.85,
      "labelsCommuns": {
        "thematiques": ["Isolation thermique", "Audit ou travaux de rénovation énergétique"],
        "sites": [],
        "interventions": ["Rénovation bâtiment"]
      }
    }
  ],
  "total": 3038
}
```

**`matchingScore`** : score de pertinence (plus c'est haut, plus l'aide est pertinente pour ce projet). Les aides sont triées par score décroissant.

**`labelsCommuns`** : les labels partagés entre le projet et l'aide qui ont contribué au score.

### 4. Classifier un texte à la volée (optionnel)

Si MEC veut classifier un projet **avant** de l'envoyer via `POST /projets` :

```http
POST /qualification/classification
Authorization: Bearer <MEC_API_KEY>
Content-Type: application/json

{
  "nom": "Rénovation thermique du gymnase",
  "description": "Isolation des murs et remplacement du chauffage",
  "type": "projet",
  "scoreThreshold": 0.8
}
```

Cet endpoint est **synchrone** (réponse en ~3-5 secondes) mais consomme des crédits LLM à chaque appel. Préférer la classification automatique via `POST /projets`.

## Architecture : notre API vs Aides-Territoires

```
                    MEC
                   / | \
                  /  |  \
                 /   |   \
                v    v    v
    ┌────────────┐  ┌──────────────────┐  ┌─────────────────┐
    │ POST       │  │ GET /aides       │  │ AT API          │
    │ /projets   │  │ (notre proxy)    │  │ (directe)       │
    │            │  │                  │  │                 │
    │ Crée le    │  │ Données AT       │  │ Données AT      │
    │ projet +   │  │ + classification │  │ brutes          │
    │ lance la   │  │ + matching       │  │                 │
    │ classif    │  │ + score          │  │                 │
    └────────────┘  └──────────────────┘  └─────────────────┘
         ↑                  ↑                     ↑
     Toujours          Pour le matching      Pour les détails
     utiliser          et la découverte      d'une aide
     notre API         d'aides pertinentes   spécifique
```

**Quand utiliser notre API (`/aides`)** :

- Trouver les aides pertinentes pour un projet (matching)
- Explorer les aides avec leur classification
- Obtenir des aides filtrées par territoire + pertinence

**Quand utiliser AT directement** :

- Afficher le détail complet d'une aide (fiche complète, contact, démarche en ligne)
- Recherche texte libre dans les aides
- Fonctionnalités spécifiques AT (favoris, alertes, etc.)

## Temps d'attente

| Action                               | Temps   | Notes                                         |
| ------------------------------------ | ------- | --------------------------------------------- |
| `POST /projets`                      | < 200ms | Réponse immédiate (classification async)      |
| Classification async                 | 5-15s   | Job en arrière-plan (3 appels LLM parallèles) |
| `GET /projets/:id`                   | < 100ms | Lecture DB                                    |
| `GET /aides` (cache hit)             | < 500ms | Données AT en cache Redis (1h)                |
| `GET /aides` (cache miss)            | 5-30s   | Fetch AT API (61 pages × 50 aides)            |
| `GET /aides` + matching              | +50ms   | Calcul pur, pas de LLM                        |
| `POST /qualification/classification` | 3-5s    | Synchrone (3 appels LLM)                      |

## Cycle de vie recommandé

```
1. MEC crée le projet
   POST /projets → { id: "019d..." }

2. MEC attend ~10s (ou poll)
   GET /projets/019d...
   → classificationThematiques est rempli ? Oui → continuer

3. MEC affiche les aides pertinentes
   GET /aides?projet_id=019d...&perimeter=70971
   → liste triée par matchingScore

4. L'utilisateur clique sur une aide
   → MEC redirige vers AT : https://aides-territoires.beta.gouv.fr{aide.url}
```

## Fréquence des mises à jour

| Donnée                | Fréquence                     | Mécanisme               |
| --------------------- | ----------------------------- | ----------------------- |
| Classification projet | À la création, une seule fois | Job BullMQ async        |
| Classification aides  | Quotidienne (3h UTC)          | Cron job BullMQ         |
| Données aides AT      | Cache 1h                      | Redis                   |
| Matching              | Temps réel                    | Calcul à chaque requête |

## Authentification

Tous les endpoints nécessitent le header :

```http
Authorization: Bearer <MEC_API_KEY>
```

La clé API est la même que celle déjà utilisée pour `POST /projets`.

## Référentiels de classification

Les labels de classification sont issus du [schéma v0.2](https://github.com/betagouv/schema-projet-collectivites-transition-ecologique) :

| Axe               | Nb labels | Exemples                                                               |
| ----------------- | --------- | ---------------------------------------------------------------------- |
| **Thématiques**   | 138       | Energies renouvelables, Gestion des déchets, Voie douce/piste cyclable |
| **Sites**         | 59        | Ecole, Mairie, Friche, Zone humide                                     |
| **Interventions** | 15        | Rénovation bâtiment, Etude/Diagnostic, Construction                    |

La **probabilité TE** (transition écologique) est un score de 0 à 1 calculé comme la moyenne pondérée des probabilités TE de chaque thématique, pondérée par les scores de classification.
