# API Référentiel Collectivités — Workflow d'implémentation

> Plan d'implémentation step-by-step.
> Réf. : `referentiel-api-requirements.md` + `referentiel-api-design.md`

## Vue d'ensemble

```
Phase 1: Fondations           ███░░░░░░░  ~20%
Phase 2: Seed / Import        ██████░░░░  ~35%
Phase 3: Endpoints API        ████████░░  ~30%
Phase 4: Tests & Validation   ██████████  ~15%
```

Chaque étape a un **checkpoint** vérifiable avant de passer à la suivante.

---

## Phase 1 — Fondations

### 1.1 Dépendances

```bash
cd communs-de-la-transition-ecologique-des-collectivites/api
pnpm add unzipper csv-parse
pnpm add -D @types/unzipper
```

**Checkpoint** : `pnpm build` passe.

---

### 1.2 Schéma Drizzle

Créer `api/src/database/referentiel-schema.ts` avec les 6 tables :
- `ref_communes`
- `ref_groupements`
- `ref_perimetres`
- `ref_competence_categories`
- `ref_competences`
- `ref_groupement_competences`

Plus les relations Drizzle.

Mettre à jour `drizzle.config.ts` pour pointer vers les deux fichiers schéma.

**Checkpoint** : `pnpm db:generate` génère une migration valide.

---

### 1.3 Migration pg_trgm

Créer une migration SQL manuelle (dans `api/drizzle/`) pour :
- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- `CREATE EXTENSION IF NOT EXISTS unaccent`
- `CREATE FUNCTION normalize_search(text)`
- Index GIN trigram sur `ref_communes.nom` et `ref_groupements.nom`

**Checkpoint** : migration appliquée sur la DB locale, `\dx` confirme les extensions.

---

### 1.4 Module NestJS (squelette)

Créer l'arborescence :
```
api/src/referentiel/
├── referentiel.module.ts
├── communes/
│   ├── communes.controller.ts  (endpoints vides, retournent [])
│   ├── communes.service.ts
│   └── dto/
├── groupements/
│   ├── groupements.controller.ts
│   ├── groupements.service.ts
│   └── dto/
├── competences/
│   ├── competences.controller.ts
│   ├── competences.service.ts
│   └── dto/
└── recherche/
    ├── recherche.controller.ts
    └── recherche.service.ts
```

Importer `ReferentielModule` dans `AppModule`.

**Checkpoint** : l'app démarre (`pnpm dev:api`), les routes `/v1/communes`, `/v1/groupements`, `/v1/competences`, `/v1/recherche` répondent 200 avec `[]`.

---

## Phase 2 — Seed / Import des données

C'est la phase la plus complexe. Elle se décompose en 3 sources indépendantes + la fusion.

### 2.1 Source geo.api.gouv.fr

Créer `api/src/referentiel/seed/sources/geo-api.source.ts` :

1. `fetchCommunes()` → `GET https://geo.api.gouv.fr/communes?fields=nom,code,siren,codeEpci,codeDepartement,codeRegion,population,codesPostaux`
   - Retourne ~35K communes
   - Mapping vers `RawCommune[]`

2. `fetchEpcis()` → `GET https://geo.api.gouv.fr/epcis?fields=nom,code`
   - Retourne ~1.2K EPCI
   - Pour chaque EPCI : `GET /epcis/{code}/communes` → périmètre
   - Mapping vers `RawGroupement[]` + `RawPerimetre[]`

**Checkpoint** : script standalone qui affiche le nombre de communes et EPCI récupérés.

---

### 2.2 Source Banatic

Créer `api/src/referentiel/seed/sources/banatic.source.ts` :

1. `fetchGroupements()` :
   - Télécharger `https://www.banatic.interieur.gouv.fr/api/export/pregenere/telecharger/France` (XLSX, 73 Mo)
   - Extraire le ZIP → lire `xl/worksheets/sheet1.xml` + `xl/sharedStrings.xml`
   - Détecter dynamiquement les colonnes par headers (substring matching)
   - Parser : SIREN, nom, type, département, compétences (OUI/NON), membres
   - Extraire la liste des compétences depuis les headers
   - Retourne `{ groupements: RawGroupement[], competences: RawCompetence[], categories: RawCompetenceCategorie[] }`

2. `fetchPerimetres()` :
   - Télécharger les 18 exports régionaux
   - Parser les relations groupement→commune membre
   - Filtrer : uniquement syndicats (SIVU, SIVOM, SMF, SMO) + PETR + POLEM
   - Retourne `RawPerimetre[]`

**Dépendance** : réutiliser la logique des scripts Python existants (`convert-banatic-xlsx.py`, `extract-all-syndicat-members.py`), portée en TypeScript.

**Checkpoint** : script standalone qui affiche le nombre de groupements, compétences, et périmètres extraits. Comparer avec les chiffres de référence (9 353 groupements, 123 compétences, ~108K périmètres syndicats).

---

### 2.3 Source ZLV

Créer `api/src/referentiel/seed/sources/zlv.source.ts` :

1. `fetchSirets()` :
   - Télécharger le CSV ZLV collectivités territoriales depuis data.gouv.fr
   - Extraire le mapping SIREN → SIRET pour les communes
   - Retourne `Map<string, string>` (siren → siret)

**Checkpoint** : script qui affiche le nombre de SIRET récupérés (~36K).

---

### 2.4 Compétences — référentiel statique

Créer `api/src/referentiel/seed/sources/banatic-competences.source.ts` :

Les compétences et catégories sont extraites du header de l'export France Banatic (step 2.2). Mais on a aussi les fichiers CSV de référence dans `exploration-intercommunalites/` :
- `banatic-codes-competences.csv` (119 compétences avec codes et catégories)
- `banatic-categorie-competences.csv` (15 catégories)

Stratégie : extraire les compétences dynamiquement depuis l'export Banatic (step 2.2), et utiliser les CSV comme référence de validation.

**Checkpoint** : les compétences extraites de l'XLSX matchent le CSV de référence.

---

### 2.5 Import Service (fusion + insertion)

Créer `api/src/referentiel/seed/import.service.ts` :

1. **Fetch** — appeler les 3 sources en parallèle (geo.api, banatic, zlv)
2. **Merge** :
   - Communes : geo.api.gouv.fr (base) + enrichissement SIRET depuis ZLV
   - Groupements : EPCI (geo.api) + syndicats/PETR (banatic), dédoublonnage par SIREN
   - Périmètres : EPCI→communes (geo.api) + syndicat→communes (banatic régional)
   - Compétences : codes extraits de banatic, associés aux groupements
3. **Insert** (dans une transaction) :
   - `TRUNCATE` toutes les tables `ref_*` (dans l'ordre FK)
   - Insert `ref_competence_categories` (10 lignes)
   - Insert `ref_competences` (123 lignes)
   - Insert `ref_communes` (35K, batch 1000)
   - Insert `ref_groupements` (9.3K, batch 1000)
   - Insert `ref_perimetres` (221K, batch 5000)
   - Insert `ref_groupement_competences` (~50K, batch 5000)
4. **Stats** — retourner un résumé (nombre de lignes par table)

**Checkpoint** : `pnpm seed:referentiel` s'exécute avec succès, affiche les stats, les données sont en base.

---

### 2.6 Entrypoint seed + script npm

Créer `api/src/referentiel/seed/seed-referentiel.ts` (NestFactory standalone).

Ajouter dans `package.json` :
```json
"seed:referentiel": "tsx src/referentiel/seed/seed-referentiel.ts"
```

**Checkpoint** : `pnpm seed:referentiel` fonctionne end-to-end. Vérifier en base :
```sql
SELECT 'ref_communes' AS t, count(*) FROM ref_communes
UNION ALL SELECT 'ref_groupements', count(*) FROM ref_groupements
UNION ALL SELECT 'ref_perimetres', count(*) FROM ref_perimetres
UNION ALL SELECT 'ref_competences', count(*) FROM ref_competences
UNION ALL SELECT 'ref_groupement_competences', count(*) FROM ref_groupement_competences;
```

---

## Phase 3 — Endpoints API

Pré-requis : la base est peuplée (Phase 2 terminée).

### 3.1 DTOs

Créer tous les DTOs (query + response) :
- `communes/dto/commune-query.dto.ts` + `commune.response.ts`
- `groupements/dto/groupement-query.dto.ts` + `groupement.response.ts`
- `competences/dto/competence-query.dto.ts` + `competence.response.ts`
- `recherche/dto/recherche.response.ts`

Inclure les décorateurs `@ApiProperty` pour la doc OpenAPI.

**Checkpoint** : `pnpm build` passe, pas d'erreur TypeScript.

---

### 3.2 CommunesService + Controller

Implémenter :

1. `search(query)` — recherche par nom (pg_trgm) + lookup par INSEE/SIREN + filtres
2. `findOne(codeInsee)` — détail commune + groupements rattachés (via `ref_perimetres`)
3. `getCompetences(codeInsee)` — jointure périmètres → groupements → compétences

**Checkpoint** : tester manuellement avec curl :
```bash
curl localhost:3000/v1/communes?q=bégard
curl localhost:3000/v1/communes/22006
curl localhost:3000/v1/communes/22006/competences
```

---

### 3.3 GroupementsService + Controller

Implémenter :

1. `search(query)` — recherche par nom + lookup SIREN/SIRET + filtres (type, département, compétence, commune)
2. `findOne(siren)` — détail groupement
3. `getMembres(siren)` — communes membres via `ref_perimetres`
4. `getCompetences(siren)` — compétences via `ref_groupement_competences`

**Checkpoint** : tester manuellement :
```bash
curl localhost:3000/v1/groupements?q=lannion
curl localhost:3000/v1/groupements/200065928
curl localhost:3000/v1/groupements/200065928/membres
curl localhost:3000/v1/groupements/200065928/competences
curl "localhost:3000/v1/groupements?commune=22006"
curl "localhost:3000/v1/groupements?competence=1505&commune=22006"
```

---

### 3.4 CompetencesService + Controller

Implémenter :

1. `findAll(categorie?)` — liste des 123 compétences, filtrable par catégorie
2. `findOne(code)` — détail compétence
3. `getGroupements(code, filters)` — groupements exerçant cette compétence, avec filtre commune/département/type

**Checkpoint** : tester manuellement :
```bash
curl localhost:3000/v1/competences
curl localhost:3000/v1/competences?categorie=15
curl localhost:3000/v1/competences/1505
curl "localhost:3000/v1/competences/1505/groupements?commune=22006"
```

---

### 3.5 RechercheService + Controller

Implémenter :

1. `search(q, options)` — recherche transversale (communes + groupements en parallèle)

**Checkpoint** :
```bash
curl "localhost:3000/v1/recherche?q=nantes"
# → doit retourner à la fois Nantes (commune) et Nantes Métropole (groupement)
```

---

### 3.6 Documentation OpenAPI séparée

Créer `api/src/referentiel/referentiel-doc.setup.ts`.
Intégrer dans `main.ts` / `setup-app.ts`.

**Checkpoint** : naviguer vers `http://localhost:3000/api/referentiel` → la doc Swagger s'affiche avec les 4 tags.

---

## Phase 4 — Tests & Validation

### 4.1 Fixtures de test

Créer `api/test/fixtures/referentiel.fixtures.ts` :
- Quelques communes, groupements, compétences, périmètres de test
- Helpers `insertReferentielFixtures()` et `cleanReferentielTables()`

---

### 4.2 Tests d'intégration

Créer les fichiers de tests :

1. `test/referentiel/communes.e2e-spec.ts`
   - Recherche par nom
   - Lookup par code INSEE et SIREN
   - Détail avec groupements
   - Compétences sur une commune
   - 404 sur commune inconnue

2. `test/referentiel/groupements.e2e-spec.ts`
   - Recherche par nom
   - Filtres par type, département, compétence, commune
   - Détail groupement
   - Membres
   - Compétences

3. `test/referentiel/competences.e2e-spec.ts`
   - Liste complète
   - Filtre par catégorie
   - Groupements par compétence + filtre commune
   - Détail compétence

4. `test/referentiel/recherche.e2e-spec.ts`
   - Recherche transversale
   - Filtre par famille

**Checkpoint** : `pnpm test` passe, tous les tests sont verts.

---

### 4.3 Validation de la recherche pg_trgm

Tester manuellement la qualité de la recherche avec des cas limites :
- Accents : `begard` → Bégard
- Tirets : `saint etienne` → Saint-Étienne
- Préfixes : `lannion tregor` → Lannion-Trégor Communauté
- Fautes de frappe : `lanion` → Lannion
- Noms composés courts : `Ay` (commune de la Marne)

Ajuster le seuil de similarité (0.3) si nécessaire.

**Checkpoint** : les cas ci-dessus retournent des résultats pertinents.

---

### 4.4 Validation des données

Vérifier la cohérence des données importées :

```sql
-- Toutes les communes ont un EPCI ?
SELECT count(*) FROM ref_communes WHERE code_epci IS NULL;
-- → Attendu : quelques communes sans EPCI (îles, etc.)

-- Tous les groupements ont au moins un membre ?
SELECT g.siren, g.nom, g.type
FROM ref_groupements g
LEFT JOIN ref_perimetres p ON p.siren_groupement = g.siren
WHERE p.siren_groupement IS NULL;
-- → Devrait être vide ou très peu

-- Distribution des types de groupements
SELECT type, count(*) FROM ref_groupements GROUP BY type ORDER BY count(*) DESC;

-- Compétences les plus fréquentes
SELECT c.code, c.nom, count(gc.siren_groupement) as nb_groupements
FROM ref_competences c
JOIN ref_groupement_competences gc ON gc.code_competence = c.code
GROUP BY c.code, c.nom
ORDER BY nb_groupements DESC
LIMIT 10;
```

**Checkpoint** : les chiffres sont cohérents avec les données de l'exploration (34 875 communes, ~9 345 groupements, ~221K périmètres).

---

### 4.5 Validation build + lint

```bash
pnpm build
pnpm lint
pnpm test
```

**Checkpoint** : zéro erreur.

---

## Ordre d'exécution résumé

```
1.1 Dépendances
 ↓
1.2 Schéma Drizzle → 1.3 Migration pg_trgm
 ↓
1.4 Module squelette
 ↓
2.1 Source geo.api ──┐
2.2 Source Banatic ──┤→ 2.5 Import Service → 2.6 Entrypoint seed
2.3 Source ZLV ──────┘
 ↓
3.1 DTOs
 ↓
3.2 Communes ──┐
3.3 Groupements┤→ 3.5 Recherche → 3.6 Doc OpenAPI
3.4 Compétences┘
 ↓
4.1 Fixtures → 4.2 Tests intégration → 4.3-4.5 Validations
```

Les étapes 2.1, 2.2, 2.3 sont indépendantes et peuvent être développées en parallèle.
Les étapes 3.2, 3.3, 3.4 sont indépendantes et peuvent être développées en parallèle.

---

## Risques et mitigations

| Risque | Impact | Mitigation |
| --- | --- | --- |
| Banatic change le format XLSX | Seed cassé | Détection dynamique des colonnes (pas de positions hardcodées) |
| Banatic rate-limit les téléchargements | Seed lent/échoue | Retry avec backoff, cache local des fichiers téléchargés |
| geo.api.gouv.fr down pendant le seed | Seed échoue | Retry, possibilité de fallback sur cache |
| XLSX France trop gros en mémoire (73 Mo) | OOM | Parsing streaming XML (pas de chargement complet en mémoire) |
| pg_trgm non disponible sur Scalingo | Recherche cassée | Vérifier que les extensions sont activables sur Scalingo (oui, c'est le cas) |
| Dédoublonnage EPCI imparfait | Doublons en base | Clé de dédoublonnage = SIREN (unique, fiable) |
