# API Référentiel Collectivités — Requirements V1

> Document issu du brainstorm du 2026-03-09.
> Implémentation dans le repo API Collectivités (communs).

## 1. Vision

Fournir une API REST ouverte de référence sur les collectivités territoriales et groupements français, comblant les manques de l'API découpage administratif (geo.api.gouv.fr) :

| Manque geo.api.gouv.fr | Cette API |
| --- | --- |
| Pas de lookup par SIREN | SIREN, SIRET, code INSEE |
| Pas de compétences | 123 compétences Banatic (10 catégories) |
| Pas de syndicats (EPCI sans fiscalité propre) | ~8 000 syndicats (SIVU, SIVOM, SMF, SMO) + PETR |
| Pas de relations syndicat→communes | ~108 000 relations de périmètre |

### Use cases

1. **Schéma v0.2** — le schéma commun supprime la table `collectivites` ; cette API fournit la résolution SIREN→détails et INSEE→enrichissement.
2. **ANCT** — besoin d'un Banatic sous forme d'API (feedback Ariane : "il n'y a pas les compétences, et je crois pas qu'on puisse passer par le SIREN").
3. **Convergence** — à terme, merger les travaux Banatic, ZLV, geo.api.gouv.fr en une seule API de référence.

## 2. Périmètre fonctionnel

### In scope V1

- **Communes** : 34 875 entités (identifiants, nom, population, rattachements)
- **Groupements** : ~9 345 entités (EPCI à fiscalité propre + syndicats + PETR + POLEM)
- **Compétences** : 123 compétences en 10 catégories, par groupement
- **Périmètres** : ~221 000 relations groupement→communes membres
- **Recherche** : autocomplete par nom (pg_trgm), lookup par SIREN/SIRET/INSEE
- **Recherche transversale** : recherche sur toutes les familles d'entités
- **Compétences comme axe central** : "qui exerce quelle compétence sur quel territoire"
- **Import autonome** : seed NestJS allant directement aux sources (Banatic, ZLV, geo.api.gouv.fr)
- **Documentation OpenAPI séparée** : `/api/referentiel/docs`
- **API publique** : pas d'authentification requise

### Hors scope V1

- Services déconcentrés de l'État (DDT, DREAL, préfectures...) — V2
- Géométrie / GeoJSON (contours, centroïdes) — renvoyer vers geo.api.gouv.fr
- Refresh automatique des données (cron) — V2
- Migration de l'API `/projets` vers le nouveau référentiel — quand le schéma v0.2 sera validé
- Enrichissements compétences (délégation, dates de transfert) — V2

## 3. Sources de données

| Source | Données | Format | Fréquence | URL |
| --- | --- | --- | --- | --- |
| **Banatic** (DGCL) | Groupements, compétences, périmètres syndicats | XLSX (export France + 18 exports régionaux) | ~1x/an | `banatic.interieur.gouv.fr/api/export/pregenere/telecharger/{code}` |
| **ZLV** (data.gouv.fr) | Communes, EPCI, départements, régions + périmètres géo | CSV | ~1x/an | data.gouv.fr |
| **geo.api.gouv.fr** | Communes (population, codes postaux), EPCI | API REST | ~1x/an (COG) | `geo.api.gouv.fr` |

### Stratégie de mise à jour

V1 : import initial via seed command (`pnpm seed:referentiel`).
V2 : refresh périodique (cron mensuel ou trimestriel), à faire évoluer avec les acteurs des différentes API existantes.

## 4. Modèle de données

### 4.1 Entités

#### Table `ref_communes`

| Champ | Type | Source | Description |
| --- | --- | --- | --- |
| `code_insee` | `varchar(5)` PK | geo.api.gouv.fr | Code INSEE commune |
| `siren` | `varchar(9)` UNIQUE | geo.api.gouv.fr | SIREN de la commune |
| `siret` | `varchar(14)` | ZLV | SIRET du siège |
| `nom` | `text` NOT NULL | geo.api.gouv.fr | Nom officiel |
| `population` | `integer` | geo.api.gouv.fr | Population municipale |
| `codes_postaux` | `text[]` | geo.api.gouv.fr | Codes postaux |
| `code_departement` | `varchar(3)` | geo.api.gouv.fr | Code département |
| `code_region` | `varchar(2)` | geo.api.gouv.fr | Code région |
| `code_epci` | `varchar(9)` | geo.api.gouv.fr | SIREN de l'EPCI de rattachement |

Index : GIN trigram sur `nom`, B-tree sur `siren`, `code_departement`, `code_epci`.

#### Table `ref_groupements`

| Champ | Type | Source | Description |
| --- | --- | --- | --- |
| `siren` | `varchar(9)` PK | Banatic / geo.api.gouv.fr | SIREN du groupement |
| `siret` | `varchar(14)` | ZLV | SIRET du siège |
| `nom` | `text` NOT NULL | Banatic / geo.api.gouv.fr | Nom officiel |
| `type` | `varchar(10)` NOT NULL | Banatic | Type juridique (CC, CA, CU, METRO, EPT, SIVU, SIVOM, SMF, SMO, PETR, POLEM) |
| `population` | `integer` | Banatic (somme communes) | Population totale |
| `nb_communes` | `integer` | Dérivé du périmètre | Nombre de communes membres |
| `departements` | `text[]` | Banatic / dérivé | Département(s) de rattachement |
| `regions` | `text[]` | Dérivé | Région(s) |
| `mode_financement` | `text` | Banatic | Mode de financement |
| `date_creation` | `date` | Banatic | Date de création |

Index : GIN trigram sur `nom`, B-tree sur `type`, GIN sur `departements`.

#### Table `ref_perimetres`

| Champ | Type | Description |
| --- | --- | --- |
| `siren_groupement` | `varchar(9)` FK→ref_groupements | SIREN du groupement |
| `code_insee_commune` | `varchar(5)` FK→ref_communes | Code INSEE de la commune membre |
| `categorie_membre` | `varchar(20)` | Type de membre (commune, groupement, personne_morale) |

PK : (`siren_groupement`, `code_insee_commune`).
Index : B-tree sur `code_insee_commune` (pour la recherche inverse).

### 4.2 Compétences

#### Table `ref_competence_categories`

| Champ | Type | Description |
| --- | --- | --- |
| `code` | `varchar(10)` PK | Code catégorie |
| `nom` | `text` NOT NULL | Nom de la catégorie |

10 catégories (Eau/Assainissement, Environnement, Énergie, etc.).

#### Table `ref_competences`

| Champ | Type | Description |
| --- | --- | --- |
| `code` | `varchar(10)` PK | Code compétence Banatic |
| `nom` | `text` NOT NULL | Nom de la compétence |
| `code_categorie` | `varchar(10)` FK→ref_competence_categories | Catégorie parente |

123 compétences.

#### Table `ref_groupement_competences`

| Champ | Type | Description |
| --- | --- | --- |
| `siren_groupement` | `varchar(9)` FK→ref_groupements | SIREN du groupement |
| `code_competence` | `varchar(10)` FK→ref_competences | Code compétence |

PK : (`siren_groupement`, `code_competence`).
Index : B-tree sur `code_competence`.

## 5. Endpoints

Tous les endpoints sont préfixés `/v1/` et publics (pas d'authentification).

### 5.1 Communes

#### `GET /v1/communes`

Recherche de communes.

| Paramètre | Type | Description |
| --- | --- | --- |
| `q` | string | Recherche par nom (autocomplete, pg_trgm) |
| `code_insee` | string | Lookup par code INSEE |
| `siren` | string | Lookup par SIREN |
| `code_departement` | string | Filtre par département |
| `code_epci` | string | Filtre par EPCI (SIREN) |
| `limit` | integer | Nombre max de résultats (défaut: 20, max: 100) |
| `offset` | integer | Pagination |

Réponse alignée sur le format geo.api.gouv.fr :

```json
[
  {
    "code": "22006",
    "nom": "Bégard",
    "siren": "212200067",
    "codeEpci": "200065928",
    "codeDepartement": "22",
    "codeRegion": "53",
    "population": 4832,
    "codesPostaux": ["22140"]
  }
]
```

#### `GET /v1/communes/:code_insee`

Détail d'une commune avec rattachements.

```json
{
  "code": "22006",
  "nom": "Bégard",
  "siren": "212200067",
  "codeEpci": "200065928",
  "codeDepartement": "22",
  "codeRegion": "53",
  "population": 4832,
  "codesPostaux": ["22140"],
  "groupements": [
    {
      "siren": "200065928",
      "nom": "Lannion-Trégor Communauté",
      "type": "CA"
    },
    {
      "siren": "252200592",
      "nom": "Syndicat d'eau du Trégor",
      "type": "SIVU"
    }
  ]
}
```

#### `GET /v1/communes/:code_insee/competences`

Toutes les compétences exercées sur cette commune, avec le groupement responsable.

```json
[
  {
    "competence": {
      "code": "1505",
      "nom": "Eau (production, traitement, adduction, distribution)",
      "categorie": { "code": "15", "nom": "Eau et Assainissement" }
    },
    "groupement": {
      "siren": "252200592",
      "nom": "Syndicat d'eau du Trégor",
      "type": "SIVU"
    }
  }
]
```

### 5.2 Groupements

#### `GET /v1/groupements`

Recherche de groupements.

| Paramètre | Type | Description |
| --- | --- | --- |
| `q` | string | Recherche par nom (autocomplete, pg_trgm) |
| `siren` | string | Lookup par SIREN |
| `siret` | string | Lookup par SIRET (les 9 premiers caractères → SIREN) |
| `type` | string | Filtre par type(s), séparés par virgules (ex: `CA,CC`) |
| `departement` | string | Filtre par département |
| `competence` | string | Filtre par code compétence |
| `commune` | string | Filtre par code INSEE commune (groupements couvrant cette commune) |
| `limit` | integer | Nombre max de résultats (défaut: 20, max: 100) |
| `offset` | integer | Pagination |

```json
[
  {
    "siren": "200065928",
    "nom": "Lannion-Trégor Communauté",
    "type": "CA",
    "population": 103000,
    "nbCommunes": 57,
    "departements": ["22"],
    "regions": ["53"],
    "modeFinancement": "Fiscalité professionnelle unique",
    "dateCreation": "2017-01-01"
  }
]
```

#### `GET /v1/groupements/:siren`

Détail d'un groupement.

Même format que ci-dessus avec tous les champs.

#### `GET /v1/groupements/:siren/membres`

Communes membres du groupement.

```json
[
  {
    "code": "22006",
    "nom": "Bégard",
    "population": 4832,
    "categorieMembre": "commune"
  }
]
```

#### `GET /v1/groupements/:siren/competences`

Compétences exercées par le groupement.

```json
[
  {
    "code": "1505",
    "nom": "Eau (production, traitement, adduction, distribution)",
    "categorie": { "code": "15", "nom": "Eau et Assainissement" }
  }
]
```

### 5.3 Compétences

#### `GET /v1/competences`

Liste de toutes les compétences.

| Paramètre | Type | Description |
| --- | --- | --- |
| `categorie` | string | Filtre par code catégorie |

```json
[
  {
    "code": "1505",
    "nom": "Eau (production, traitement, adduction, distribution)",
    "categorie": { "code": "15", "nom": "Eau et Assainissement" }
  }
]
```

#### `GET /v1/competences/:code`

Détail d'une compétence.

#### `GET /v1/competences/:code/groupements`

Groupements exerçant cette compétence.

| Paramètre | Type | Description |
| --- | --- | --- |
| `commune` | string | Filtre par code INSEE commune |
| `departement` | string | Filtre par département |
| `type` | string | Filtre par type de groupement |
| `limit` | integer | Nombre max de résultats (défaut: 20, max: 100) |
| `offset` | integer | Pagination |

### 5.4 Recherche transversale

#### `GET /v1/recherche`

Recherche sur toutes les familles d'entités.

| Paramètre | Type | Description |
| --- | --- | --- |
| `q` | string (requis) | Terme de recherche (autocomplete, pg_trgm) |
| `famille` | string | Filtre : `commune`, `groupement` (défaut: toutes) |
| `limit` | integer | Nombre max de résultats par famille (défaut: 5, max: 20) |

```json
{
  "communes": [
    { "code": "44109", "nom": "Nantes", "siren": "214401093", "type": "COM" }
  ],
  "groupements": [
    { "siren": "244400644", "nom": "Nantes Métropole", "type": "METRO" }
  ]
}
```

## 6. Recherche par nom

### Implémentation

- Extension PostgreSQL `pg_trgm`
- Index GIN trigram sur les colonnes `nom` des tables `ref_communes` et `ref_groupements`
- Fonction `word_similarity()` pour le ranking (meilleur résultat sur les noms composés)
- Seuil de similarité : 0.3 (à ajuster)
- Résultats triés par score de similarité décroissant puis par population décroissante (désambiguïsation)

### Normalisation

- Recherche insensible à la casse et aux accents (collation `unaccent` ou normalisation à l'insertion)
- Gestion des articles (Le, La, Les, L') et préfixes courants (Saint-, Sainte-)

## 7. Import des données (Seed)

### Commande

```bash
pnpm seed:referentiel
```

### Pipeline

1. **geo.api.gouv.fr** → communes (code, nom, siren, population, codesPostaux, codeDepartement, codeRegion, codeEpci) + EPCI (code/siren, nom, type)
2. **Banatic export France** (`telecharger/France`, XLSX 73 Mo) → groupements + compétences
3. **Banatic exports régionaux** (18 XLSX, ~75 Mo) → périmètres syndicats (communes membres)
4. **ZLV** (CSV data.gouv.fr) → enrichissement SIRET pour communes
5. **Fusion** → dédoublonnage EPCI (présents dans geo.api.gouv.fr et Banatic), enrichissement croisé
6. **Insertion DB** → upsert par batch (1 000 lignes)

### Idempotence

Le seed est idempotent (upsert sur les PK). Peut être relancé sans risque.

## 8. Architecture technique

### Module NestJS

```
api/src/referentiel/
├── referentiel.module.ts
├── communes/
│   ├── communes.controller.ts
│   ├── communes.service.ts
│   └── communes.dto.ts
├── groupements/
│   ├── groupements.controller.ts
│   ├── groupements.service.ts
│   └── groupements.dto.ts
├── competences/
│   ├── competences.controller.ts
│   ├── competences.service.ts
│   └── competences.dto.ts
├── recherche/
│   ├── recherche.controller.ts
│   └── recherche.service.ts
├── seed/
│   ├── seed.command.ts
│   ├── sources/
│   │   ├── banatic.source.ts      → télécharge + parse XLSX
│   │   ├── geo-api.source.ts      → appelle geo.api.gouv.fr
│   │   └── zlv.source.ts          → télécharge + parse CSV
│   └── import.service.ts          → fusion + insertion DB
└── database/
    └── referentiel.schema.ts      → tables Drizzle
```

### Documentation OpenAPI

- Path séparé : `/api/referentiel/docs`
- Tag Swagger : `Référentiel`
- Descriptions en français (API à destination d'acteurs francophones)

### Performance

- Volume modeste (~45K entités, ~220K relations) → PostgreSQL suffit, pas de cache ni Elasticsearch
- Index `pg_trgm` GIN pour la recherche par nom
- Index B-tree sur tous les identifiants (SIREN, INSEE, codes compétences)
- Pagination par défaut (limit/offset)

## 9. Format de réponse

### Conventions

- Alignement sur le format geo.api.gouv.fr pour les champs communs (camelCase)
- Champs additionnels en camelCase
- Pagination : `limit` + `offset` (query params), pas de curseur pour la V1
- Pas d'enveloppe (`data`, `meta`) pour la V1 — tableau JSON directement (comme geo.api.gouv.fr)

### Codes d'erreur

| Code | Usage |
| --- | --- |
| 200 | OK |
| 400 | Paramètres invalides |
| 404 | Entité non trouvée |
| 500 | Erreur serveur |

## 10. Questions ouvertes (hors V1)

1. **Services de l'État** : intégrer les DDT, DREAL, préfectures ? Endpoints séparés `/v1/services-etat/`. Données ZLV disponibles.
2. **Géométrie** : ajouter les contours GeoJSON ? Volumétrie importante, à évaluer.
3. **Refresh automatique** : cron de mise à jour quand les sources publient (COG en janvier, Banatic variable).
4. **Compétences enrichies** : transfert vs délégation, dates, source juridique.
5. **Convergence API** : rapprochement formel avec geo.api.gouv.fr et les acteurs existants.
6. **Migration `/projets`** : adapter `POST /projets` pour utiliser le nouveau référentiel quand le schéma v0.2 sera validé.
