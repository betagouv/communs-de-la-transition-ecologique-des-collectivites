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
│             │           │     (async, ~5–15s)              │
│             │           │  3. Stocke les résultats         │
│             │           │                                  │
│             │ GET       │  4. Proxy Aides-Territoires      │
│             │─────────→ │     + enrichissement classif     │
│             │ /aides    │     + matching par pertinence    │
│             │           │  → 200 ok / no_match /           │
│             │           │    no_aides_on_perimeter         │
│             │           │  → 202 classification_pending    │
│             │           │    (relance auto la classif)     │
│             │           │  → 404 (projet inexistant)       │
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
GET /aides?projetId=019d...&limit=10
Authorization: Bearer <MEC_API_KEY>
```

**Paramètres** :
| Param | Description | Requis |
|-------|-------------|--------|
| `projetId` | ID du projet pour le matching et la résolution du périmètre | **Oui** |
| `limit` | Nombre max de résultats (défaut: 20) | Non |
| `projet_id` | _Déprécié_ — alias snake_case de `projetId`, accepté pour compat. Migrer vers `projetId`. | Non |

> Le périmètre territorial est dérivé automatiquement des `collectivites` du projet (codes INSEE des communes). Pas besoin de passer `code_insee`.

#### Statuts de réponse

L'endpoint renvoie l'un des 4 statuts suivants. **Tous les cas 200 et le 202 contiennent un champ `status`** ; MEC peut s'appuyer dessus pour décider quoi afficher.

| HTTP | `status`                  | Quand                                                                                  | Action recommandée côté MEC                          |
| ---- | ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 200  | `ok`                      | Au moins une aide matche                                                               | Afficher la liste triée par `matchingScore`          |
| 200  | `no_match`                | Des aides existent sur le périmètre, mais aucune ne partage de label ≥ 0.8             | Message "aucune aide pertinente" + CTA enrichir desc |
| 200  | `no_aides_on_perimeter`   | Aucune aide AT trouvée pour les codes INSEE du projet                                  | Message "pas d'aide AT pour ce territoire"           |
| 202  | `classification_pending`  | Le projet n'est pas encore classifié — un job a été (re)déclenché                      | Loader + retry automatique après `retryAfter`s      |
| 404  | (NotFoundException)       | `projetId` inexistant en base                                                          | Erreur d'intégration MEC (ID jamais synchronisé)     |

#### `200 ok` — résultat nominal

```json
{
  "status": "ok",
  "total": 3038,
  "aides": [
    {
      "id": 89883,
      "name": "Financer la rénovation énergétique des bâtiments publics",
      "url": "/aides/xxxx/",
      "financers": ["ADEME"],
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
  ]
}
```

- **`matchingScore`** : score de pertinence (plus c'est haut, plus l'aide est pertinente). Aides triées par score décroissant.
- **`labelsCommuns`** : labels partagés entre projet et aide qui ont contribué au score.
- **`total`** : nombre total d'aides AT trouvées sur le périmètre **avant** filtrage matching (utile pour comprendre `no_match`).

#### `200 no_match` — aides existent mais aucune ne matche

```json
{ "status": "no_match", "total": 154, "aides": [] }
```

Le périmètre contient 154 aides AT, mais aucune ne partage un label de classification ≥ 0.8 avec le projet. Causes typiques :
- description du projet trop vague → labels du projet faibles ou inexistants
- domaine du projet rare sur AT (peu d'aides catalogue le couvrent)

#### `200 no_aides_on_perimeter` — aucune aide AT sur le périmètre

```json
{ "status": "no_aides_on_perimeter", "total": 0, "aides": [] }
```

AT ne référence aucune aide pour les codes INSEE du projet. Cause typique : commune sans dispositif AT actif.

#### `202 classification_pending` — projet pas encore classifié

```http
HTTP/1.1 202 Accepted
Retry-After: 15
Content-Type: application/json
```

```json
{
  "status": "classification_pending",
  "projetId": "019d...",
  "retryAfter": 15,
  "classificationTriggered": true
}
```

- Le projet existe mais n'a pas (encore) de `classificationScores`.
- L'API a **automatiquement (re)déclenché** un job de classification (BullMQ, ~5–15 s).
- MEC doit **réessayer après `retryAfter` secondes** (header `Retry-After` également renvoyé).
- `classificationTriggered: false` signifie qu'un job était déjà en vol : pas la peine d'en créer un nouveau, mais MEC doit réessayer quand même.
- **Idempotence** : le job utilise un `jobId` déterministe (`auto-classify:{projetId}`), plusieurs polls MEC ne créent pas de jobs dupliqués.

Causes possibles d'un projet non classifié :
- Job BullMQ pas encore traité (~5–15 s post-création) — cas le plus fréquent
- Job en échec sur les 3 tentatives (Sentry doit avoir capturé l'erreur côté API)
- Projet historique créé avant le déploiement de la classification auto

#### Comment le `matchingScore` est calculé

Le matching ne fait **aucun appel à l'IA**. C'est un calcul mathématique pur basé sur les labels de classification que le projet et l'aide ont en commun.

**Formule par axe** (thématiques, sites, interventions) :

```
1. Garder seulement les labels avec score ≥ 0.8 (haute confiance)
   — côté projet ET côté aide

2. Pour chaque label en commun :
   terme = (score_projet - 0.7) × (score_aide - 0.7)

3. Score axe = somme(termes) / nombre de labels du projet sur cet axe
```

**Score total** = 0.45 × score thématiques + 0.35 × score sites + 0.20 × score interventions

Les trois axes ne pèsent pas autant : la pertinence **thématique** est dominante (45 %), le **lieu** est secondaire (35 %) et le **type d'intervention** sert de critère d'appoint (20 %).

**Pourquoi le `- 0.7` ?** C'est un décalage qui donne plus de poids aux labels dont le modèle est très sûr :

| Score du label | Contribution (`score - 0.7`) |
| -------------- | ---------------------------- |
| 0.8 (seuil)    | 0.1 — poids faible           |
| 0.9            | 0.2 — poids moyen            |
| 1.0 (certain)  | 0.3 — poids fort             |

**La division** par le nombre de labels du projet normalise le score : un projet avec 1 seul label très pertinent n'est pas désavantagé face à un projet avec 3 labels.

**Exemple concret** :

```
Projet "Rénovation thermique du gymnase" :
  Thématiques : Isolation thermique (0.95), Rénovation énergétique (0.85)
  Sites :       Salle de sport (0.95)
  Interventions : Rénovation bâtiment (0.95)

Aide "Subvention rénovation bâtiments publics" :
  Thématiques : Rénovation énergétique (0.92)
  Sites :       Bâtiment public (0.88)
  Interventions : Rénovation bâtiment (0.90)

Score thématiques :
  Label commun : "Rénovation énergétique"
  = (0.85 - 0.7) × (0.92 - 0.7) / 2 labels projet
  = 0.15 × 0.22 / 2 = 0.0165

Score sites :
  Pas de label commun (Salle de sport ≠ Bâtiment public) = 0

Score interventions :
  Label commun : "Rénovation bâtiment"
  = (0.95 - 0.7) × (0.90 - 0.7) / 1 label projet
  = 0.25 × 0.20 = 0.05

Score total = 0.45 × 0.0165 + 0.35 × 0 + 0.20 × 0.05 = 0.0174
```

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

| Action                               | Temps    | Notes                                                   |
| ------------------------------------ | -------- | ------------------------------------------------------- |
| `POST /projets`                      | < 200ms  | Réponse immédiate (classification async)                |
| Classification async                 | 5–15s    | Job en arrière-plan (3 appels LLM parallèles)           |
| `GET /projets/:id`                   | < 100ms  | Lecture DB                                              |
| `GET /aides` (cache fresh, < 1h)     | < 500ms  | MGET Redis sur les IDs d'aides du territoire            |
| `GET /aides` (cache stale, 1h–7j)    | < 500ms  | Renvoi immédiat depuis cache + refresh background       |
| `GET /aides` (cache miss / cold)     | 5–30s    | Fetch AT API synchrone (61 pages × 50 aides)            |
| `GET /aides` + matching              | + 50ms   | Calcul pur, pas de LLM                                  |
| `GET /aides` (projet non classifié)  | < 500ms  | Réponse 202 + enqueue job — MEC réessaye après 15s     |
| `POST /qualification/classification` | 3–5s     | Synchrone (3 appels LLM)                                |

## Cache des aides (Redis, SWR)

Le proxy `GET /aides` ne tape pas Aides-Territoires à chaque requête : un cache Redis à deux niveaux est interrogé en premier, avec une stratégie **stale-while-revalidate** pour absorber les latences AT.

### Architecture

Deux familles de clés Redis :

| Clé                       | Contenu                                  | TTL  |
| ------------------------- | ---------------------------------------- | ---- |
| `at:aide:{id}`            | JSON complet d'une aide AT individuelle  | 7 j  |
| `at:territory:{queryKey}` | `{ ids: number[], storedAt: epoch_ms }`  | 7 j  |

`queryKey` est dérivé des paramètres de requête (ex : `perimeter_codes%5B%5D=44109` pour la commune de Nantes).

À la lecture, l'API récupère d'abord la liste d'IDs du territoire, puis fait un seul `MGET` Redis pour récupérer chaque aide en JSON.

### Statuts (stale-while-revalidate)

À chaque `GET`, l'âge de l'entrée territoire est comparé à deux seuils :

| Statut   | Âge depuis `storedAt` | Comportement                                                          |
| -------- | --------------------- | --------------------------------------------------------------------- |
| `fresh`  | < 1 h                 | Renvoi immédiat depuis Redis                                          |
| `stale`  | 1 h – 7 j             | Renvoi immédiat (données légèrement périmées) + refresh background    |
| `miss`   | aucune entrée / TTL expiré | **Cold start** — fetch AT synchrone (5–30 s), peut bloquer la requête |

Le refresh background est dédupliqué en mémoire (`Set` de clés en cours) : si plusieurs requêtes MEC arrivent en parallèle pour le même territoire stale, **un seul** appel AT est lancé.

### Fan-out par commune

Quand un projet a plusieurs communes (cas EPCI), l'API :

1. Extrait les codes INSEE des `collectivites` de type `Commune` du projet
2. Fait un `GET` cache (puis fetch AT si miss) **par commune** — chaque commune a sa propre clé `at:territory:{key}`
3. Déduplique les aides par `aide.id` au moment de l'union

Les aides individuelles (`at:aide:{id}`) sont partagées entre territoires : une aide nationale n'occupe qu'une seule clé Redis quel que soit le nombre de territoires qui la référencent.

### Invalidation

- Après une `GET /aides/sync` (cron quotidien 3 h UTC ou appel manuel), tous les `at:territory:*` sont supprimés via `SCAN+DEL`.
- Les `at:aide:{id}` ne sont pas invalidés explicitement : ils sont **réécrits** par le warm-up post-sync (`AidesWarmupService`, fire-and-forget) et expirent naturellement après 7 j.
- Cette stratégie évite que l'index pointe vers des aides absentes : on écrit toujours les aides d'abord, l'index ensuite.

### Conséquence pour MEC

- Premier appel sur un nouveau territoire (cold start) : peut prendre **5–30 s** côté MEC. Prévoir un timeout généreux (≥ 30 s) sur le widget pour les premières requêtes après le déploiement d'une nouvelle commune.
- Appels suivants (fresh ou stale) : < 500 ms.
- Après le sync nocturne (3 h UTC), le warm-up repeuple les territoires les plus utilisés en arrière-plan : les requêtes du matin profitent quasi toujours d'un cache chaud.

## Cycle de vie recommandé

```
1. MEC crée le projet
   POST /projets → { id: "019d..." }

2. MEC appelle directement les aides
   GET /aides?projetId=019d...
   → 202 classification_pending si pas encore classifié
     → MEC attend retryAfter secondes et réessaye
   → 200 ok / no_match / no_aides_on_perimeter sinon

3. L'utilisateur clique sur une aide
   → MEC redirige vers AT : https://aides-territoires.beta.gouv.fr{aide.url}
```

> Note : il n'est plus nécessaire de poller `GET /projets/:id` avant `GET /aides`. Le 202 sur `GET /aides` gère le cas "pas encore classifié" et déclenche automatiquement la classification si besoin.

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

## Base URL

```
https://api.collectivites.beta.gouv.fr
```

Documentation Swagger interactive : `https://api.collectivites.beta.gouv.fr/api/projets`

## Rate limiting

| Endpoint           | Limite       | Fenêtre                |
| ------------------ | ------------ | ---------------------- |
| Tous les endpoints | 50 requêtes  | par minute (par IP)    |
| `/qualification/*` | 500 requêtes | par jour (par clé API) |
| `GET /aides`       | 50 requêtes  | par minute (par IP)    |

En cas de dépassement, l'API retourne `HTTP 429 Too Many Requests`.

## Création en lot

Pour synchroniser un grand nombre de projets d'un coup :

```http
POST /projets/bulk
Authorization: Bearer <MEC_API_KEY>
Content-Type: application/json

{
  "projets": [
    { "nom": "Projet 1", "externalId": "mec-1", "collectivites": [...] },
    { "nom": "Projet 2", "externalId": "mec-2", "collectivites": [...] }
  ]
}
```

**Réponse** : `{ "ids": ["019d...", "019e..."] }`

Chaque projet est classifié automatiquement (job async par projet). Pour un lot de 100 projets, la classification complète prend ~30 secondes.

## État actuel du stock

> Données au 23 mars 2026

| Donnée                    | Nombre     | Couverture  |
| ------------------------- | ---------- | ----------- |
| Projets MEC classifiés    | 11 799     | 100%        |
| Aides AT classifiées      | 3 045      | 100%        |
| Thématiques référentiel   | 138 labels | Schéma v0.2 |
| Sites référentiel         | 59 labels  | Schéma v0.2 |
| Interventions référentiel | 15 labels  | Schéma v0.2 |

Le matching est opérationnel dès maintenant sur l'ensemble du stock.

## FAQ

**Q: Le matching utilise-t-il l'IA à chaque requête ?**
Non. L'IA (Claude Sonnet 4.6) est utilisée une seule fois lors de la classification du projet et de l'aide. Le matching est ensuite un calcul mathématique pur (pas de LLM, < 50ms).

**Q: Que se passe-t-il si le projet n'a qu'un titre, pas de description ?**
La classification fonctionne quand même, mais sera moins précise. Un titre seul donne généralement des scores plus bas (plus d'incertitude pour le LLM).

**Q: Comment forcer une re-classification ?**
Envoyer `PATCH /projets/:id` avec `{ "classificationThematiques": null }`. La classification sera relancée.

**Q: Que faire si `GET /aides` renvoie 202 `classification_pending` ?**
Réessayer après `retryAfter` secondes (15 par défaut, valeur dans le body et le header `Retry-After`). L'API a déjà déclenché le job de classification ; pas besoin d'appeler un autre endpoint. Plusieurs polls MEC en parallèle ne créent pas de jobs dupliqués (`jobId` déterministe). Si le 202 persiste plus d'une minute, vérifier Sentry côté API.

**Q: Différence entre `no_match` et `no_aides_on_perimeter` ?**
- `no_aides_on_perimeter` : aucune aide AT n'existe pour les codes INSEE du projet (rare, principalement les communes très petites)
- `no_match` : des aides existent sur le territoire, mais aucune ne partage un label de classification ≥ 0.8 avec le projet. C'est généralement un signal que la description du projet est trop vague.

**Q: Comment fonctionne le filtre géographique ?**
Le périmètre est dérivé automatiquement des `collectivites` du projet (codes INSEE des communes). L'API utilise `perimeter_codes[]` côté Aides-Territoires, qui accepte les codes INSEE directement. Pas besoin de passer `code_insee` en paramètre.

**Q: Quelle est la fraîcheur des données d'aides ?**
Cache Redis avec stratégie **stale-while-revalidate** : `fresh` < 1 h (renvoi direct), `stale` 1 h–7 j (renvoi direct + refresh background), `miss` au-delà (cold start synchrone 5–30 s). Voir la section "Cache des aides" pour les détails. Les classifications d'aides sont re-synchronisées quotidiennement à 3 h UTC ; les aides modifiées côté AT sont re-classifiées automatiquement au prochain sync (détection par hash du contenu).
