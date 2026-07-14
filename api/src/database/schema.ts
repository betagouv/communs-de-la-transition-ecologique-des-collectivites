import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { eq, relations, sql } from "drizzle-orm";
import { AideClassification } from "@/aides/dto/aides.dto";
import { uuidv7 } from "uuidv7";

const projetPhases = ["Idée", "Étude", "Opération"] as const;
export const projetPhasesEnum = pgEnum("projet_phases", projetPhases);
export type ProjetPhase = (typeof projetPhasesEnum.enumValues)[number];

const phaseStatut = ["En cours", "En retard", "En pause", "Bloqué", "Abandonné", "Terminé"] as const;
export const phaseStatutEnum = pgEnum("phase_statut", phaseStatut);
export type PhaseStatut = (typeof phaseStatutEnum.enumValues)[number];

export const collectiviteType = ["Commune", "EPCI"] as const;
export const collectiviteTypeEnum = pgEnum("collectivite_type", collectiviteType);
export type CollectiviteType = (typeof collectiviteTypeEnum.enumValues)[number];

export const projets = pgTable("projets", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),

  nom: text("nom").notNull(),
  description: text("description"),
  budgetPrevisionnel: bigint("budget_previsionnel", { mode: "number" }),
  dateDebutPrevisionnelle: text("date_debut_previsionnelle"),
  phase: projetPhasesEnum(),
  phaseStatut: phaseStatutEnum(),
  programme: text(),

  // porteur info
  porteurCodeSiret: text("code_siret"),
  porteurReferentEmail: text("porteur_referent_email"),
  porteurReferentTelephone: text("porteur_referent_telephone"),
  porteurReferentPrenom: text("porteur_referent_prenom"),
  porteurReferentNom: text("porteur_referent_nom"),
  porteurReferentFonction: text("porteur_referent_fonction"),

  //categorization
  competences: text("competences").array(),
  leviers: text("leviers").array(),

  // classification v0.2 (auto-populated via LLM)
  classificationThematiques: text("classification_thematiques").array(),
  classificationSites: text("classification_sites").array(),
  classificationInterventions: text("classification_interventions").array(),
  probabiliteTE: text("probabilite_te"),
  classificationScores: jsonb("classification_scores").$type<{
    thematiques: { label: string; score: number }[];
    sites: { label: string; score: number }[];
    interventions: { label: string; score: number }[];
  }>(),
  contentHash: text("content_hash"),

  // external service id
  mecId: text("mec_id").unique(),
  tetId: text("tet_id").unique(),
  recocoId: text("recoco_id").unique(),
  urbanVitalizId: text("urban_vitaliz_id").unique(),
  sosPontsId: text("sos_ponts_id").unique(),
  fondVertId: text("fond_vert_id").unique(),
});

export const collectivites = pgTable(
  "collectivites",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    nom: text("nom").notNull(),
    type: collectiviteTypeEnum("type").notNull(),

    // Codes officiels
    codeInsee: text("code_insee"),
    codeDepartements: text("code_departements").array(),
    codeRegions: text("code_regions").array(),
    codeEpci: text("code_epci"),
    siren: text("siren"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    //syntax as a workaround https://github.com/drizzle-team/drizzle-orm/issues/3349
    uniqueIndex()
      .on(t.codeEpci, t.type)
      .where(eq(t.type, sql`'EPCI'`)),
    uniqueIndex()
      .on(t.codeInsee, t.type)
      .where(eq(t.type, sql`'Commune'`)),
  ],
);

export const projetsToCollectivites = pgTable(
  "projets_to_collectivites",
  {
    projetId: uuid("projet_id")
      .notNull()
      .references(() => projets.id),
    collectiviteId: uuid("collectivite_id")
      .notNull()
      .references(() => collectivites.id),
  },
  (t) => [
    primaryKey({ columns: [t.projetId, t.collectiviteId] }),
    index("collectivite_projet_idx").on(t.collectiviteId, t.projetId),
  ],
);

export const services = pgTable("services", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("createdAt").defaultNow(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  sousTitre: text("sous_titre").notNull(),
  logoUrl: text("logo_url").notNull(),
  isListed: boolean("is_listed").notNull().default(false),
  redirectionUrl: text("redirection_url").notNull(),
  redirectionLabel: text("redirection_label"),
  iframeUrl: text("iframe_url"),
  extendLabel: text("extend_label"),
  // Doctrine d'accès aux données : scopes détenus par ce service. Un service ne voit
  // une source restreinte (RESTRICTED_SOURCES) que s'il porte le scope requis. La
  // correspondance service appelant → ligne se fait par `name` = serviceType du guard
  // (voir docs/api/DOCTRINE_ACCES_DONNEES.md). Vide par défaut → aucun accès restreint.
  dataScopes: text("data_scopes").array().notNull().default([]),
});

export const serviceContext = pgTable(
  "service_context",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    isListed: boolean("is_listed").notNull().default(false),
    // competences, leviers and phases can be NULL, to remove this field from the matching
    competences: text("competences").array().default([]),
    leviers: text("leviers").array().default([]),
    phases: projetPhasesEnum("phases").array().default([]),
    regions: text("regions").array().default([]),

    // Custom display options
    name: text("name"),
    description: text("description"),
    sousTitre: text("sous_titre"),
    logoUrl: text("logo_url"),
    redirectionUrl: text("redirection_url"),
    redirectionLabel: text("redirection_label"),
    extendLabel: text("extend_label"),
    iframeUrl: text("iframe_url"),
    extraFields: jsonb("extra_fields").$type<{ name: string; label: string }>().array().default([]),
  },
  (t) => [unique().on(t.id, t.description).nullsNotDistinct()],
);

export const serviceExtraFields = pgTable("service_extra_fields", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  projetId: uuid("projet_id")
    .notNull()
    .references(() => projets.id),
  name: text("name").notNull(),
  value: text("value").notNull(),
});

export const apiRequests = pgTable("api_requests", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Request details
  method: text("method").notNull(),
  endpoint: text("endpoint").notNull(),
  fullUrl: text("full_url").notNull(),
  statusCode: integer("status_code").notNull(),
  responseTimeInMs: integer("response_time").notNull(),
  serviceName: text("service_name"),
});

export const aideClassifications = pgTable("aide_classifications", {
  idAt: text("id_at").primaryKey(),
  contentHash: text("content_hash").notNull(),
  classificationScores: jsonb("classification_scores").notNull().$type<AideClassification>(),
  classifiedAt: timestamp("classified_at").notNull().defaultNow(),
});

// relations needed by drizzle to allow nested query : https://orm.drizzle.team/docs/relations
export const projetsRelations = relations(projets, ({ many }) => ({
  collectivites: many(projetsToCollectivites),
  extraFields: many(serviceExtraFields),
}));

export const collectivitesRelations = relations(collectivites, ({ many }) => ({
  projets: many(projetsToCollectivites),
}));

export const projetsToCollectivitesRelations = relations(projetsToCollectivites, ({ one }) => ({
  projet: one(projets, {
    fields: [projetsToCollectivites.projetId],
    references: [projets.id],
  }),
  collectivite: one(collectivites, {
    fields: [projetsToCollectivites.collectiviteId],
    references: [collectivites.id],
  }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  contexts: many(serviceContext),
}));

export const serviceContextRelations = relations(serviceContext, ({ one }) => ({
  service: one(services, {
    fields: [serviceContext.serviceId],
    references: [services.id],
  }),
}));

export const serviceExtraFieldsRelations = relations(serviceExtraFields, ({ one }) => ({
  projet: one(projets, {
    fields: [serviceExtraFields.projetId],
    references: [projets.id],
  }),
}));

export const aideFeedbacks = pgTable(
  "aide_feedbacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projetId: uuid("projet_id").notNull(),
    idAt: text("id_at").notNull(),
    feedback: text("feedback").notNull().default("not_relevant"),
    reason: text("reason"),
    source: text("source").default("MEC"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("aide_feedbacks_projet_aide_idx").on(t.projetId, t.idAt),
    index("aide_feedbacks_projet_idx").on(t.projetId),
    index("aide_feedbacks_id_at_idx").on(t.idAt),
  ],
);

/**
 * Réponses d'un projet à un questionnaire spécialisé (AtoutBiodiv…).
 *
 * Le PUT des réponses est idempotent : la ligne porte l'INTÉGRALITÉ des réponses
 * connues (jsonb `{ [questionId]: optionId }`), jamais un delta — d'où la clé
 * primaire (projet_id, slug) et non une ligne par réponse.
 *
 * `version` fige l'interprétation : c'est la version de la définition en vigueur
 * au moment de la saisie. À la lecture, les réponses dont la (question, option)
 * n'existe plus dans la définition courante sont écartées (cf. QuestionnairesService).
 *
 * Pas de FK vers `projets` : un projet peut vivre dans data_mec/data_tet sans
 * ligne dans public.projets (cf. GetProjetsService.findOneWithSource) — même
 * raison que pour `aide_feedbacks`.
 */
export const projetQuestionnaireReponses = pgTable(
  "projet_questionnaire_reponses",
  {
    projetId: uuid("projet_id").notNull(),
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    reponses: jsonb("reponses").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.projetId, t.slug] }),
    index("projet_questionnaire_reponses_projet_idx").on(t.projetId),
  ],
);

/**
 * Définition des questionnaires — contenu ET règle d'éligibilité.
 *
 * ILS VIVAIENT DANS LE DÉPÔT (JSON partenaire + classification.ts). Le chargeur refusait de
 * DÉMARRER si une condition pointait une question inexistante, si une étiquette sortait de la
 * taxonomie, ou si un questionnaire n'exigeait aucune étiquette (il aurait alors été proposé à
 * TOUS les projets — une conjonction vide est vraie). C'était un filet parfait : le bug ne
 * pouvait pas atteindre la production.
 *
 * En base, ce filet disparaît. Il est donc INTÉGRALEMENT reconstruit à l'écriture : les mêmes
 * vérifications, au même niveau d'exigence, rendues en 400 explicite (cf. validerDefinition).
 * Aucune n'a été assouplie au passage — c'était la condition pour accepter ce déplacement.
 *
 * `version` s'incrémente à chaque édition. Elle n'invalide RIEN : `reconcilierReponses` ignore à
 * la lecture les réponses devenues sans objet, sans réécrire la ligne stockée. Éditer un
 * questionnaire ne détruit donc pas les réponses des collectivités.
 *
 * Amorcée depuis content/ (`pnpm seed:questionnaires`), comme le catalogue de services l'est
 * depuis son CSV : le dépôt reste l'amorçage, la base devient la source de vérité.
 */
export const questionnaires = pgTable("questionnaires", {
  slug: text("slug").primaryKey(),
  version: integer("version").notNull().default(1),
  /** Le partenaire qui fournit le contenu (« AtoutBiodiv »). */
  sourceNom: text("source_nom").notNull(),
  banniere: jsonb("banniere").$type<Record<string, unknown>>().notNull(),
  questions: jsonb("questions").$type<unknown[]>().notNull(),
  /** Recommandations AVEC leurs conditions. Ne sortent jamais de l'API. */
  recommandations: jsonb("recommandations").$type<unknown[]>().notNull(),
  /**
   * Étiquettes que le projet doit TOUTES porter pour que le questionnaire lui soit proposé.
   * Jamais vide : une conjonction vide est vraie, le questionnaire serait proposé à tout le monde.
   */
  etiquettesRequises: jsonb("etiquettes_requises")
    .$type<{ thematiques: string[]; sites: string[]; interventions: string[] }>()
    .notNull(),
  /** Qui a édité en dernier — le back-office le transmet. */
  editePar: text("edite_par"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Catalogue des services numériques (benchmark DINUM « API Projets »).
 *
 * Table DISTINCTE de `public.services` à dessein : `services` est le catalogue du widget,
 * mais elle porte AUSSI `data_scopes`, et la doctrine d'accès aux données y résout les
 * droits d'une plateforme appelante par `services.name = serviceType` (cf.
 * TerritoiresService.getServiceScopes et docs/api/DOCTRINE_ACCES_DONNEES.md). Y verser le
 * catalogue DINUM casserait ce mécanisme en silence.
 *
 * Alimentée par scripts/import-benchmark-dinum/ (ré-exécutable : upsert sur `slug`).
 */
export const servicesNumeriques = pgTable(
  "services_numeriques",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    /** Identifiant stable exposé à l'API, dérivé du nom (ex. "boussole-de-la-transition-ecologique"). */
    slug: text("slug").notNull().unique(),

    // Affichage
    nom: text("nom").notNull(),
    baseline: text("baseline"),
    description: text("description"),
    descriptionLongue: text("description_longue"),
    logoUrl: text("logo_url"),
    operateur: text("operateur"),
    redirectionUrl: text("redirection_url"),
    redirectionLibelle: text("redirection_libelle"),
    // Le benchmark ne fournit aucune iframe : ces colonnes restent vides jusqu'à curation.
    iframeUrl: text("iframe_url"),
    iframeLibelle: text("iframe_libelle"),

    /** expert | contenu | inspirants | discussions | conseil | aides — un service peut en cumuler. */
    categories: text("categories").array().notNull().default([]),
    /** bas | moyen | haut. */
    niveauExpertise: text("niveau_expertise"),
    /** Vocabulaire GROSSIER du benchmark (« Gestion de l'eau »…) : affichage/filtre, jamais matching. */
    thematiquePrincipale: text("thematique_principale"),

    /**
     * oui | non | eventuellement — le service est-il utilisable par un agent NON SPÉCIALISTE ?
     *
     * Ce n'est PAS un critère de sélection : c'est une propriété du service, au même titre que
     * `niveauExpertise`. Elle est donc exposée, et le client peut filtrer dessus. (Anciennement
     * « À intégrer MEC », qui servait de verrou de curation — cf. migration 0045.)
     */
    profilGeneraliste: text("profil_generaliste"),
    /** oui | non | eventuellement — remonte en fallback même sans correspondance fine (§8.3). */
    presentationGenerique: text("presentation_generique"),

    // Contextualisation
    /**
     * Classification sur les trois axes du schéma commun, dans les MÊMES taxonomies fermées
     * que les projets, les aides et les questionnaires. Alimentée par les colonnes
     * Thématiques/Lieux/Modalités du benchmark, normalisées à l'import.
     */
    classification: jsonb("classification").$type<AideClassification>().notNull(),
    /**
     * Poids de pertinence par phase projet : { "Idée": 1, "Étude": 0.5, "Opération": 0 }.
     * Dérivé des colonnes « Phase : … » du benchmark (Oui=1, Un peu=0.5, Non=0). Une phase
     * absente = donnée non renseignée, et ne pénalise pas le service.
     */
    phases: jsonb("phases").$type<Partial<Record<ProjetPhase, number>>>().notNull().default({}),

    // Fiche
    nature: text("nature"),
    beta: boolean("beta"),
    ecosystemePublic: boolean("ecosysteme_public"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("services_numeriques_profil_generaliste_idx").on(t.profilGeneraliste)],
);

// Re-export sub-schemas so DatabaseService picks up all tables
export * from "./referentiel-schema";
export * from "./plans-fiches-schema";
export * from "./tet-schema";
export * from "./mec-schema";
export * from "./decisions-schema";
