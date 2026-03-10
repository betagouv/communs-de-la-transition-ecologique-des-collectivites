# API Référentiel Collectivités — Design Technique V1

> Design basé sur les patterns existants de l'API Collectivités (Drizzle, NestJS, Swagger).
> Voir `referentiel-api-requirements.md` pour les requirements.

## 1. Vue d'ensemble

### Architecture dans le repo

```
api/src/
├── referentiel/
│   ├── referentiel.module.ts              ← Module NestJS principal
│   ├── referentiel-doc.setup.ts           ← Swagger doc séparée
│   │
│   ├── communes/
│   │   ├── communes.controller.ts
│   │   ├── communes.service.ts
│   │   └── dto/
│   │       ├── commune.response.ts
│   │       └── commune-query.dto.ts
│   │
│   ├── groupements/
│   │   ├── groupements.controller.ts
│   │   ├── groupements.service.ts
│   │   └── dto/
│   │       ├── groupement.response.ts
│   │       └── groupement-query.dto.ts
│   │
│   ├── competences/
│   │   ├── competences.controller.ts
│   │   ├── competences.service.ts
│   │   └── dto/
│   │       ├── competence.response.ts
│   │       └── competence-query.dto.ts
│   │
│   ├── recherche/
│   │   ├── recherche.controller.ts
│   │   └── recherche.service.ts
│   │
│   └── seed/
│       ├── seed-referentiel.ts            ← Entrypoint (NestFactory standalone)
│       ├── seed.module.ts
│       ├── import.service.ts              ← Orchestrateur d'import
│       └── sources/
│           ├── geo-api.source.ts          ← Communes + EPCI depuis geo.api.gouv.fr
│           ├── banatic.source.ts          ← Groupements + compétences + périmètres depuis XLSX
│           └── zlv.source.ts              ← Enrichissement SIRET depuis CSV data.gouv.fr
│
├── database/
│   ├── schema.ts                          ← Schéma existant (inchangé)
│   └── referentiel-schema.ts              ← NOUVEAU : tables du référentiel
│
└── ...
```

### Nouveaux fichiers Drizzle

Le schéma référentiel est dans un fichier séparé (`referentiel-schema.ts`) pour garder le `schema.ts` existant intact. Le `drizzle.config.ts` devra pointer vers les deux fichiers :

```typescript
// drizzle.config.ts — modification
export default defineConfig({
  schema: ["./src/database/schema.ts", "./src/database/referentiel-schema.ts"],
  // ...
});
```

---

## 2. Schéma Drizzle

### `api/src/database/referentiel-schema.ts`

```typescript
import { index, integer, pgTable, primaryKey, text, varchar, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// Tables
// ============================================================

export const refCommunes = pgTable(
  "ref_communes",
  {
    codeInsee: varchar("code_insee", { length: 5 }).primaryKey(),
    siren: varchar("siren", { length: 9 }).notNull().unique(),
    siret: varchar("siret", { length: 14 }),
    nom: text("nom").notNull(),
    population: integer("population"),
    codesPostaux: text("codes_postaux").array(),
    codeDepartement: varchar("code_departement", { length: 3 }),
    codeRegion: varchar("code_region", { length: 3 }),
    codeEpci: varchar("code_epci", { length: 9 }),
  },
  (t) => [
    index("ref_communes_siren_idx").on(t.siren),
    index("ref_communes_departement_idx").on(t.codeDepartement),
    index("ref_communes_epci_idx").on(t.codeEpci),
    // Index trigram GIN ajouté via migration SQL brute (voir section 3)
  ],
);

export const refGroupements = pgTable(
  "ref_groupements",
  {
    siren: varchar("siren", { length: 9 }).primaryKey(),
    siret: varchar("siret", { length: 14 }),
    nom: text("nom").notNull(),
    type: varchar("type", { length: 10 }).notNull(),
    population: integer("population"),
    nbCommunes: integer("nb_communes"),
    departements: text("departements").array(),
    regions: text("regions").array(),
    modeFinancement: text("mode_financement"),
    dateCreation: date("date_creation"),
  },
  (t) => [
    index("ref_groupements_type_idx").on(t.type),
    // Index trigram GIN ajouté via migration SQL brute (voir section 3)
  ],
);

export const refPerimetres = pgTable(
  "ref_perimetres",
  {
    sirenGroupement: varchar("siren_groupement", { length: 9 })
      .notNull()
      .references(() => refGroupements.siren),
    codeInseeCommune: varchar("code_insee_commune", { length: 5 })
      .notNull()
      .references(() => refCommunes.codeInsee),
    categorieMembre: varchar("categorie_membre", { length: 20 }),
  },
  (t) => [
    primaryKey({ columns: [t.sirenGroupement, t.codeInseeCommune] }),
    index("ref_perimetres_commune_idx").on(t.codeInseeCommune),
  ],
);

export const refCompetenceCategories = pgTable("ref_competence_categories", {
  code: varchar("code", { length: 10 }).primaryKey(),
  nom: text("nom").notNull(),
});

export const refCompetences = pgTable("ref_competences", {
  code: varchar("code", { length: 10 }).primaryKey(),
  nom: text("nom").notNull(),
  codeCategorie: varchar("code_categorie", { length: 10 })
    .notNull()
    .references(() => refCompetenceCategories.code),
});

export const refGroupementCompetences = pgTable(
  "ref_groupement_competences",
  {
    sirenGroupement: varchar("siren_groupement", { length: 9 })
      .notNull()
      .references(() => refGroupements.siren),
    codeCompetence: varchar("code_competence", { length: 10 })
      .notNull()
      .references(() => refCompetences.code),
  },
  (t) => [
    primaryKey({ columns: [t.sirenGroupement, t.codeCompetence] }),
    index("ref_grp_comp_competence_idx").on(t.codeCompetence),
  ],
);

// ============================================================
// Relations
// ============================================================

export const refCommunesRelations = relations(refCommunes, ({ many }) => ({
  perimetres: many(refPerimetres),
}));

export const refGroupementsRelations = relations(refGroupements, ({ many }) => ({
  perimetres: many(refPerimetres),
  competences: many(refGroupementCompetences),
}));

export const refPerimetresRelations = relations(refPerimetres, ({ one }) => ({
  groupement: one(refGroupements, {
    fields: [refPerimetres.sirenGroupement],
    references: [refGroupements.siren],
  }),
  commune: one(refCommunes, {
    fields: [refPerimetres.codeInseeCommune],
    references: [refCommunes.codeInsee],
  }),
}));

export const refCompetencesRelations = relations(refCompetences, ({ one, many }) => ({
  categorie: one(refCompetenceCategories, {
    fields: [refCompetences.codeCategorie],
    references: [refCompetenceCategories.code],
  }),
  groupements: many(refGroupementCompetences),
}));

export const refCompetenceCategoriesRelations = relations(refCompetenceCategories, ({ many }) => ({
  competences: many(refCompetences),
}));

export const refGroupementCompetencesRelations = relations(refGroupementCompetences, ({ one }) => ({
  groupement: one(refGroupements, {
    fields: [refGroupementCompetences.sirenGroupement],
    references: [refGroupements.siren],
  }),
  competence: one(refCompetences, {
    fields: [refGroupementCompetences.codeCompetence],
    references: [refCompetences.code],
  }),
}));
```

### Diagramme des relations

```
ref_competence_categories
  │ code (PK)
  │ nom
  │
  ├──< ref_competences
  │      │ code (PK)
  │      │ nom
  │      │ code_categorie (FK)
  │      │
  │      ├──< ref_groupement_competences
  │      │      │ siren_groupement (PK, FK)
  │      │      │ code_competence (PK, FK)
  │      │      │
  │      │      ├──> ref_groupements
  │      │             │ siren (PK)
  │      │             │ nom
  │      │             │ type (CC, CA, SIVU, ...)
  │      │             │ population, nb_communes
  │      │             │ departements[], regions[]
  │      │             │ mode_financement, date_creation
  │      │             │
  │      │             ├──< ref_perimetres
  │      │                    │ siren_groupement (PK, FK)
  │      │                    │ code_insee_commune (PK, FK)
  │      │                    │ categorie_membre
  │      │                    │
  │      │                    ├──> ref_communes
  │      │                           │ code_insee (PK)
  │      │                           │ siren (UNIQUE)
  │      │                           │ nom, population
  │      │                           │ codes_postaux[]
  │      │                           │ code_departement
  │      │                           │ code_region
  │      │                           │ code_epci
```

---

## 3. Migration SQL

La migration Drizzle sera générée automatiquement via `pnpm db:generate`. Une migration SQL complémentaire est nécessaire pour les index trigram (non supportés nativement par Drizzle) :

```sql
-- Migration manuelle : pg_trgm + index GIN trigram

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Fonction de normalisation pour la recherche
CREATE OR REPLACE FUNCTION normalize_search(text) RETURNS text AS $$
  SELECT lower(unaccent($1));
$$ LANGUAGE SQL IMMUTABLE;

-- Index trigram sur les noms (communes)
CREATE INDEX ref_communes_nom_trgm_idx
  ON ref_communes
  USING GIN (normalize_search(nom) gin_trgm_ops);

-- Index trigram sur les noms (groupements)
CREATE INDEX ref_groupements_nom_trgm_idx
  ON ref_groupements
  USING GIN (normalize_search(nom) gin_trgm_ops);
```

---

## 4. DTOs (Réponses API)

### Communes

```typescript
// communes/dto/commune.response.ts

export class CommuneResponse {
  @ApiProperty({ description: "Code INSEE (5 chiffres)", example: "22006" })
  code!: string;

  @ApiProperty({ example: "Bégard" })
  nom!: string;

  @ApiProperty({ description: "SIREN (9 chiffres)", example: "212200067" })
  siren!: string;

  @ApiProperty({ description: "SIREN de l'EPCI de rattachement", example: "200065928", nullable: true })
  codeEpci!: string | null;

  @ApiProperty({ example: "22" })
  codeDepartement!: string;

  @ApiProperty({ example: "53" })
  codeRegion!: string;

  @ApiProperty({ example: 4832, nullable: true })
  population!: number | null;

  @ApiProperty({ example: ["22140"], nullable: true })
  codesPostaux!: string[] | null;
}

export class CommuneDetailResponse extends CommuneResponse {
  @ApiProperty({ type: [GroupementSummary], description: "Groupements dont cette commune est membre" })
  groupements!: GroupementSummary[];
}

export class GroupementSummary {
  @ApiProperty({ example: "200065928" })
  siren!: string;

  @ApiProperty({ example: "Lannion-Trégor Communauté" })
  nom!: string;

  @ApiProperty({ example: "CA" })
  type!: string;
}
```

### Groupements

```typescript
// groupements/dto/groupement.response.ts

export class GroupementResponse {
  @ApiProperty({ description: "SIREN (9 chiffres)", example: "200065928" })
  siren!: string;

  @ApiProperty({ example: "Lannion-Trégor Communauté" })
  nom!: string;

  @ApiProperty({ description: "Type juridique", example: "CA" })
  type!: string;

  @ApiProperty({ example: 103000, nullable: true })
  population!: number | null;

  @ApiProperty({ example: 57, nullable: true })
  nbCommunes!: number | null;

  @ApiProperty({ example: ["22"] })
  departements!: string[];

  @ApiProperty({ example: ["53"] })
  regions!: string[];

  @ApiProperty({ example: "Fiscalité professionnelle unique", nullable: true })
  modeFinancement!: string | null;

  @ApiProperty({ example: "2017-01-01", nullable: true })
  dateCreation!: string | null;
}

export class MembreResponse {
  @ApiProperty({ example: "22006" })
  code!: string;

  @ApiProperty({ example: "Bégard" })
  nom!: string;

  @ApiProperty({ example: 4832, nullable: true })
  population!: number | null;

  @ApiProperty({ example: "commune" })
  categorieMembre!: string;
}
```

### Compétences

```typescript
// competences/dto/competence.response.ts

export class CompetenceCategorieResponse {
  @ApiProperty({ example: "15" })
  code!: string;

  @ApiProperty({ example: "Eau et Assainissement" })
  nom!: string;
}

export class CompetenceResponse {
  @ApiProperty({ example: "1505" })
  code!: string;

  @ApiProperty({ example: "Eau (production, traitement, adduction, distribution)" })
  nom!: string;

  @ApiProperty()
  categorie!: CompetenceCategorieResponse;
}

export class CompetenceAvecGroupementResponse {
  @ApiProperty()
  competence!: CompetenceResponse;

  @ApiProperty()
  groupement!: GroupementSummary;
}
```

### Recherche

```typescript
// recherche/dto/recherche.response.ts

export class RechercheResultItem {
  @ApiProperty({ description: "Identifiant principal (code_insee pour communes, siren pour groupements)" })
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ description: "Type d'entité", example: "COM" })
  type!: string;

  @ApiProperty({ enum: ["commune", "groupement"] })
  famille!: string;

  @ApiProperty({ description: "Score de similarité (0-1)", example: 0.85 })
  score!: number;
}

export class RechercheResponse {
  @ApiProperty({ type: [RechercheResultItem] })
  communes!: RechercheResultItem[];

  @ApiProperty({ type: [RechercheResultItem] })
  groupements!: RechercheResultItem[];
}
```

### Query DTOs

```typescript
// communes/dto/commune-query.dto.ts

export class CommuneQueryDto {
  @ApiProperty({ required: false, description: "Recherche par nom (autocomplete)" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ required: false, description: "Code INSEE (5 chiffres)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  codeInsee?: string;

  @ApiProperty({ required: false, description: "SIREN (9 chiffres)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  siren?: string;

  @ApiProperty({ required: false, description: "Code département" })
  @IsOptional()
  @IsString()
  codeDepartement?: string;

  @ApiProperty({ required: false, description: "SIREN de l'EPCI" })
  @IsOptional()
  @IsString()
  codeEpci?: string;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

// groupements/dto/groupement-query.dto.ts

export class GroupementQueryDto {
  @ApiProperty({ required: false, description: "Recherche par nom (autocomplete)" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ required: false, description: "SIREN (9 chiffres)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  siren?: string;

  @ApiProperty({ required: false, description: "SIRET (9 premiers chiffres → SIREN)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/)
  siret?: string;

  @ApiProperty({ required: false, description: "Type(s) séparés par virgules (ex: CA,CC,SIVU)" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false, description: "Code département" })
  @IsOptional()
  @IsString()
  departement?: string;

  @ApiProperty({ required: false, description: "Code compétence Banatic" })
  @IsOptional()
  @IsString()
  competence?: string;

  @ApiProperty({ required: false, description: "Code INSEE commune (groupements couvrant cette commune)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  commune?: string;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
```

---

## 5. Controllers

### CommunesController

```typescript
@Controller("v1/communes")
@ApiTags("Référentiel - Communes")
export class CommunesController {
  constructor(private readonly communesService: CommunesService) {}

  @Get()
  @ApiOperation({ summary: "Rechercher des communes" })
  @ApiEndpointResponses({ successStatus: 200, response: CommuneResponse, isArray: true })
  search(@Query() query: CommuneQueryDto): Promise<CommuneResponse[]> {
    return this.communesService.search(query);
  }

  @Get(":codeInsee")
  @ApiOperation({ summary: "Détail d'une commune" })
  @ApiParam({ name: "codeInsee", description: "Code INSEE (5 chiffres)", example: "22006" })
  @ApiEndpointResponses({ successStatus: 200, response: CommuneDetailResponse })
  findOne(@Param("codeInsee") codeInsee: string): Promise<CommuneDetailResponse> {
    return this.communesService.findOne(codeInsee);
  }

  @Get(":codeInsee/competences")
  @ApiOperation({ summary: "Compétences exercées sur une commune" })
  @ApiParam({ name: "codeInsee", example: "22006" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceAvecGroupementResponse, isArray: true })
  getCompetences(@Param("codeInsee") codeInsee: string): Promise<CompetenceAvecGroupementResponse[]> {
    return this.communesService.getCompetences(codeInsee);
  }
}
```

### GroupementsController

```typescript
@Controller("v1/groupements")
@ApiTags("Référentiel - Groupements")
export class GroupementsController {
  constructor(private readonly groupementsService: GroupementsService) {}

  @Get()
  @ApiOperation({ summary: "Rechercher des groupements" })
  @ApiEndpointResponses({ successStatus: 200, response: GroupementResponse, isArray: true })
  search(@Query() query: GroupementQueryDto): Promise<GroupementResponse[]> {
    return this.groupementsService.search(query);
  }

  @Get(":siren")
  @ApiOperation({ summary: "Détail d'un groupement" })
  @ApiParam({ name: "siren", description: "SIREN (9 chiffres)", example: "200065928" })
  @ApiEndpointResponses({ successStatus: 200, response: GroupementResponse })
  findOne(@Param("siren") siren: string): Promise<GroupementResponse> {
    return this.groupementsService.findOne(siren);
  }

  @Get(":siren/membres")
  @ApiOperation({ summary: "Communes membres d'un groupement" })
  @ApiParam({ name: "siren", example: "200065928" })
  @ApiEndpointResponses({ successStatus: 200, response: MembreResponse, isArray: true })
  getMembres(@Param("siren") siren: string): Promise<MembreResponse[]> {
    return this.groupementsService.getMembres(siren);
  }

  @Get(":siren/competences")
  @ApiOperation({ summary: "Compétences exercées par un groupement" })
  @ApiParam({ name: "siren", example: "200065928" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceResponse, isArray: true })
  getCompetences(@Param("siren") siren: string): Promise<CompetenceResponse[]> {
    return this.groupementsService.getCompetences(siren);
  }
}
```

### CompetencesController

```typescript
@Controller("v1/competences")
@ApiTags("Référentiel - Compétences")
export class CompetencesController {
  constructor(private readonly competencesService: CompetencesService) {}

  @Get()
  @ApiOperation({ summary: "Lister les compétences" })
  @ApiQuery({ name: "categorie", required: false, description: "Code catégorie" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceResponse, isArray: true })
  findAll(@Query("categorie") categorie?: string): Promise<CompetenceResponse[]> {
    return this.competencesService.findAll(categorie);
  }

  @Get(":code")
  @ApiOperation({ summary: "Détail d'une compétence" })
  @ApiParam({ name: "code", example: "1505" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceResponse })
  findOne(@Param("code") code: string): Promise<CompetenceResponse> {
    return this.competencesService.findOne(code);
  }

  @Get(":code/groupements")
  @ApiOperation({ summary: "Groupements exerçant une compétence" })
  @ApiParam({ name: "code", example: "1505" })
  @ApiEndpointResponses({ successStatus: 200, response: GroupementResponse, isArray: true })
  getGroupements(
    @Param("code") code: string,
    @Query("commune") commune?: string,
    @Query("departement") departement?: string,
    @Query("type") type?: string,
    @Query() pagination?: { limit?: number; offset?: number },
  ): Promise<GroupementResponse[]> {
    return this.competencesService.getGroupements(code, { commune, departement, type, ...pagination });
  }
}
```

### RechercheController

```typescript
@Controller("v1/recherche")
@ApiTags("Référentiel - Recherche")
export class RechercheController {
  constructor(private readonly rechercheService: RechercheService) {}

  @Get()
  @ApiOperation({ summary: "Recherche transversale (communes + groupements)" })
  @ApiQuery({ name: "q", required: true, description: "Terme de recherche" })
  @ApiQuery({ name: "famille", required: false, enum: ["commune", "groupement"] })
  @ApiQuery({ name: "limit", required: false, description: "Max résultats par famille (défaut: 5)" })
  @ApiEndpointResponses({ successStatus: 200, response: RechercheResponse })
  search(
    @Query("q") q: string,
    @Query("famille") famille?: string,
    @Query("limit") limit?: number,
  ): Promise<RechercheResponse> {
    return this.rechercheService.search(q, { famille, limit });
  }
}
```

---

## 6. Services — Requêtes clés

### Recherche par nom (pg_trgm)

Requête commune à `CommunesService.search()` et `GroupementsService.search()` :

```typescript
// Exemple pour communes
async searchByName(q: string, limit: number, offset: number): Promise<CommuneResponse[]> {
  const normalized = q.trim();
  if (!normalized) return [];

  const results = await this.dbService.database.execute(sql`
    SELECT
      code_insee AS code,
      nom,
      siren,
      code_epci AS "codeEpci",
      code_departement AS "codeDepartement",
      code_region AS "codeRegion",
      population,
      codes_postaux AS "codesPostaux",
      word_similarity(normalize_search(${normalized}), normalize_search(nom)) AS score
    FROM ref_communes
    WHERE word_similarity(normalize_search(${normalized}), normalize_search(nom)) > 0.3
    ORDER BY score DESC, population DESC NULLS LAST
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return results.rows as CommuneResponse[];
}
```

### Compétences sur une commune

```typescript
// CommunesService.getCompetences(codeInsee)
async getCompetences(codeInsee: string): Promise<CompetenceAvecGroupementResponse[]> {
  const results = await this.dbService.database.execute(sql`
    SELECT
      c.code AS competence_code,
      c.nom AS competence_nom,
      cc.code AS categorie_code,
      cc.nom AS categorie_nom,
      g.siren AS groupement_siren,
      g.nom AS groupement_nom,
      g.type AS groupement_type
    FROM ref_perimetres p
    JOIN ref_groupements g ON g.siren = p.siren_groupement
    JOIN ref_groupement_competences gc ON gc.siren_groupement = g.siren
    JOIN ref_competences c ON c.code = gc.code_competence
    JOIN ref_competence_categories cc ON cc.code = c.code_categorie
    WHERE p.code_insee_commune = ${codeInsee}
    ORDER BY cc.code, c.code
  `);

  return results.rows.map((row) => ({
    competence: {
      code: row.competence_code,
      nom: row.competence_nom,
      categorie: { code: row.categorie_code, nom: row.categorie_nom },
    },
    groupement: {
      siren: row.groupement_siren,
      nom: row.groupement_nom,
      type: row.groupement_type,
    },
  }));
}
```

### Qui exerce une compétence sur un territoire

```typescript
// CompetencesService.getGroupements(code, { commune })
async getGroupements(
  codeCompetence: string,
  filters: { commune?: string; departement?: string; type?: string },
): Promise<GroupementResponse[]> {
  const conditions = [
    sql`gc.code_competence = ${codeCompetence}`,
  ];

  if (filters.commune) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ref_perimetres p
        WHERE p.siren_groupement = g.siren
        AND p.code_insee_commune = ${filters.commune}
      )`,
    );
  }

  if (filters.departement) {
    conditions.push(sql`${filters.departement} = ANY(g.departements)`);
  }

  if (filters.type) {
    const types = filters.type.split(",");
    conditions.push(sql`g.type = ANY(${types})`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const results = await this.dbService.database.execute(sql`
    SELECT g.*
    FROM ref_groupements g
    JOIN ref_groupement_competences gc ON gc.siren_groupement = g.siren
    WHERE ${whereClause}
    ORDER BY g.population DESC NULLS LAST
  `);

  return results.rows.map(mapGroupementRow);
}
```

---

## 7. Seed — Pipeline d'import

### Architecture du seed

```
seed-referentiel.ts (entrypoint)
  │
  └── ImportService.run()
        │
        ├── 1. GeoApiSource.fetchCommunes()
        │     → GET geo.api.gouv.fr/communes?fields=...&boost=population
        │     → ~35K communes
        │
        ├── 2. GeoApiSource.fetchEpcis()
        │     → GET geo.api.gouv.fr/epcis?fields=...
        │     → ~1.2K EPCI (CC, CA, CU, METRO)
        │
        ├── 3. BanaticSource.fetchGroupements()
        │     → Download banatic.interieur.gouv.fr/.../France (XLSX, 73 Mo)
        │     → Parse XLSX : groupements + compétences
        │     → ~9.3K groupements avec compétences
        │
        ├── 4. BanaticSource.fetchPerimetres()
        │     → Download 18 regional XLSX (~75 Mo total)
        │     → Parse : relations syndicat → communes membres
        │     → ~108K relations
        │
        ├── 5. ZlvSource.fetchSirets()
        │     → Download CSV data.gouv.fr (ZLV collectivités)
        │     → Extract SIRET for communes (enrichissement)
        │
        ├── 6. ImportService.merge()
        │     │
        │     ├── Communes : geo.api.gouv.fr (base) + ZLV (siret)
        │     ├── Groupements : EPCI geo.api + Banatic syndicats
        │     │   └── Dédoublonnage EPCI (présents dans les deux)
        │     ├── Compétences : Banatic codes/catégories
        │     └── Périmètres :
        │         ├── EPCI : geo.api.gouv.fr (via /epcis/{code}/communes)
        │         └── Syndicats : Banatic régional
        │
        └── 7. ImportService.insertAll()
              │
              ├── TRUNCATE ref_* tables (dans le bon ordre : FK)
              ├── INSERT ref_competence_categories (10 lignes)
              ├── INSERT ref_competences (123 lignes)
              ├── INSERT ref_communes (35K, batch 1000)
              ├── INSERT ref_groupements (9.3K, batch 1000)
              ├── INSERT ref_perimetres (221K, batch 5000)
              └── INSERT ref_groupement_competences (~50K, batch 5000)
```

### Source Banatic — Parsing XLSX

Le parsing XLSX sans dépendance lourde (pas de `xlsx` ni `exceljs`) :

```typescript
// seed/sources/banatic.source.ts

import { createReadStream } from "fs";
import * as unzipper from "unzipper";

export class BanaticSource {
  /**
   * Télécharge l'export France et extrait groupements + compétences.
   * L'XLSX est un ZIP contenant des fichiers XML.
   */
  async fetchGroupements(): Promise<{ groupements: RawGroupement[]; competences: RawCompetence[] }> {
    // 1. Télécharger le XLSX
    const xlsxPath = await this.downloadFile(
      "https://www.banatic.interieur.gouv.fr/api/export/pregenere/telecharger/France",
      "banatic-france.xlsx",
    );

    // 2. Extraire les XML du ZIP
    const { sharedStrings, sheetXml } = await this.extractXlsx(xlsxPath);

    // 3. Parser les headers pour trouver les colonnes
    const columnMap = this.detectColumns(sheetXml, sharedStrings);

    // 4. Parser chaque ligne
    return this.parseRows(sheetXml, sharedStrings, columnMap);
  }

  /**
   * Télécharge les 18 exports régionaux et extrait les périmètres syndicats.
   */
  async fetchPerimetres(): Promise<RawPerimetre[]> {
    const regionCodes = [
      "01", "02", "03", "04", "06",              // Outre-mer
      "11", "24", "27", "28", "32", "44",         // Métropole
      "52", "53", "75", "76", "84", "93", "94",
    ];

    const allPerimetres: RawPerimetre[] = [];

    for (const code of regionCodes) {
      const xlsxPath = await this.downloadFile(
        `https://www.banatic.interieur.gouv.fr/api/export/pregenere/telecharger/${code}`,
        `banatic-region-${code}.xlsx`,
      );
      const perimetres = await this.parseRegionalExport(xlsxPath);
      allPerimetres.push(...perimetres);
    }

    return allPerimetres;
  }
}
```

### Entrypoint du seed

```typescript
// seed/seed-referentiel.ts

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../../.env.${currentEnv}`),
    }),
    LoggerModule,
  ],
  providers: [
    DatabaseService,
    ImportService,
    GeoApiSource,
    BanaticSource,
    ZlvSource,
  ],
})
class SeedReferentielModule {}

async function seedReferentiel() {
  const app = await NestFactory.createApplicationContext(SeedReferentielModule);
  const importService = app.get(ImportService);
  const logger = app.get(CustomLogger);

  try {
    logger.log("Démarrage de l'import du référentiel...");
    const stats = await importService.run();
    logger.log(`Import terminé : ${stats.communes} communes, ${stats.groupements} groupements, ${stats.competences} compétences, ${stats.perimetres} périmètres`);
  } catch (error) {
    logger.error("Erreur lors de l'import", formatError(error));
    process.exit(1);
  } finally {
    await app.close();
  }
}

void seedReferentiel();
```

### Script npm

```json
{
  "seed:referentiel": "tsx src/referentiel/seed/seed-referentiel.ts",
  "seed:referentiel:dev": "cross-env NODE_ENV=development tsx src/referentiel/seed/seed-referentiel.ts"
}
```

---

## 8. Documentation OpenAPI séparée

### Setup

```typescript
// referentiel/referentiel-doc.setup.ts

export function setupReferentielDoc(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API Référentiel Collectivités")
    .setDescription(
      "API de référence sur les collectivités territoriales, groupements " +
      "et compétences. Données issues de Banatic (DGCL), ZLV et geo.api.gouv.fr.",
    )
    .setVersion("1.0")
    .addTag("Référentiel - Communes", "Communes françaises (34 875 entités)")
    .addTag("Référentiel - Groupements", "EPCI, syndicats, PETR (9 345 entités)")
    .addTag("Référentiel - Compétences", "123 compétences Banatic en 10 catégories")
    .addTag("Référentiel - Recherche", "Recherche transversale par nom")
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      include: [ReferentielModule],
    });

  SwaggerModule.setup("api/referentiel", app, documentFactory, {
    jsonDocumentUrl: "api/referentiel/openapi.json",
    customSiteTitle: "API Référentiel Collectivités - Documentation",
    swaggerOptions: {
      tagsSorter: "alpha",
    },
  });
}
```

### Intégration dans `main.ts`

```typescript
// main.ts — ajout
import { setupReferentielDoc } from "./referentiel/referentiel-doc.setup";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);           // Doc existante sur /api
  setupReferentielDoc(app); // Nouvelle doc sur /api/referentiel
  await app.listen(3000);
}
```

---

## 9. Module NestJS

```typescript
// referentiel/referentiel.module.ts

@Module({
  controllers: [
    CommunesController,
    GroupementsController,
    CompetencesController,
    RechercheController,
  ],
  providers: [
    CommunesService,
    GroupementsService,
    CompetencesService,
    RechercheService,
  ],
})
export class ReferentielModule {}
```

Tous les controllers sont publics (pas de guard). Le `ReferentielModule` est importé dans le `AppModule` principal.

---

## 10. Tests

### Stratégie

- **Tests unitaires** pour les services (logique métier, mapping)
- **Tests d'intégration** pour les endpoints (requêtes HTTP réelles sur DB test)
- Les tests d'intégration utilisent le pattern `testModule()` existant

### Fixtures de test

```typescript
// test/fixtures/referentiel.fixtures.ts

export const testCommune = {
  codeInsee: "22006",
  siren: "212200067",
  nom: "Bégard",
  population: 4832,
  codesPostaux: ["22140"],
  codeDepartement: "22",
  codeRegion: "53",
  codeEpci: "200065928",
};

export const testGroupement = {
  siren: "200065928",
  nom: "Lannion-Trégor Communauté",
  type: "CA",
  population: 103000,
  nbCommunes: 57,
  departements: ["22"],
  regions: ["53"],
  modeFinancement: "Fiscalité professionnelle unique",
  dateCreation: "2017-01-01",
};

export const testCompetenceCategorie = {
  code: "15",
  nom: "Eau et Assainissement",
};

export const testCompetence = {
  code: "1505",
  nom: "Eau (production, traitement, adduction, distribution)",
  codeCategorie: "15",
};
```

### Test d'intégration

```typescript
// test/referentiel/communes.e2e-spec.ts

describe("Communes (e2e)", () => {
  beforeEach(async () => {
    // Insérer les fixtures dans les tables ref_*
    await insertReferentielFixtures(global.testDbService.database);
  });

  afterEach(async () => {
    await cleanReferentielTables(global.testDbService.database);
  });

  describe("GET /v1/communes", () => {
    it("should search communes by name", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/communes?q=bégard")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].code).toBe("22006");
      expect(response.body[0].nom).toBe("Bégard");
    });

    it("should lookup commune by code INSEE", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/communes?codeInsee=22006")
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });

  describe("GET /v1/communes/:codeInsee", () => {
    it("should return commune with groupements", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/communes/22006")
        .expect(200);

      expect(response.body.groupements).toContainEqual(
        expect.objectContaining({ siren: "200065928", type: "CA" }),
      );
    });

    it("should return 404 for unknown commune", async () => {
      await request(app.getHttpServer())
        .get("/v1/communes/99999")
        .expect(404);
    });
  });

  describe("GET /v1/communes/:codeInsee/competences", () => {
    it("should return competences with responsible groupement", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/communes/22006/competences")
        .expect(200);

      expect(response.body).toContainEqual(
        expect.objectContaining({
          competence: expect.objectContaining({ code: "1505" }),
          groupement: expect.objectContaining({ siren: "200065928" }),
        }),
      );
    });
  });
});
```

---

## 11. Dépendances à ajouter

```bash
pnpm add unzipper csv-parse    # Parsing XLSX (ZIP) et CSV pour le seed
pnpm add -D @types/unzipper    # Types
```

Note : `pg_trgm` et `unaccent` sont des extensions PostgreSQL incluses par défaut, pas de dépendance Node.

---

## 12. Estimation du volume

| Table | Lignes | Taille estimée |
| --- | --- | --- |
| `ref_communes` | ~35 000 | ~5 Mo |
| `ref_groupements` | ~9 300 | ~1 Mo |
| `ref_perimetres` | ~221 000 | ~10 Mo |
| `ref_competence_categories` | 10 | < 1 Ko |
| `ref_competences` | 123 | ~10 Ko |
| `ref_groupement_competences` | ~50 000 | ~3 Mo |
| **Total** | ~315 000 | **~20 Mo** |

Index trigram GIN : ~15 Mo supplémentaires.

Total en base : **~35 Mo**. Très confortable pour PostgreSQL.
