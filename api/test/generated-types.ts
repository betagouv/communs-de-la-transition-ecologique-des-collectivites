/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
    "/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProjectsController_findAll"];
        put?: never;
        post: operations["ProjectsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProjectsController_findOne"];
        put?: never;
        post?: never;
        delete: operations["ProjectsController_remove"];
        options?: never;
        head?: never;
        patch: operations["ProjectsController_update"];
        trace?: never;
    };
    "/services/debug-sentry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ServicesController_getError"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services/project/{projectId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ServicesController_getServicesByProjectId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        CreateProjectRequest: {
            nom: string;
            description: string;
            porteurCodeSiret?: string | null;
            porteurReferentEmail?: string | null;
            porteurReferentTelephone?: string | null;
            porteurReferentPrenom?: string | null;
            porteurReferentNom?: string | null;
            porteurReferentFonction?: string | null;
            budget: number;
            /**
             * @description Forecasted start date in YYYY-MM-DD format
             * @example 2024-03-01
             */
            forecastedStartDate: string;
            /**
             * @description Status specific to the service type
             * @enum {string}
             */
            status: "IDEE" | "FAISABILITE" | "EN_COURS" | "IMPACTE" | "ABANDONNE" | "TERMINE";
            /**
             * @description Array of INSEE codes for the communes
             * @example [
             *       "01001",
             *       "75056",
             *       "97A01"
             *     ]
             */
            communeInseeCodes: string[];
            /** @enum {string|null} */
            competences?: "Action sociale (hors APA et RSA)" | "Actions en matière de gestion des eaux" | "Agriculture, pêche et agro-alimentaire" | "Aménagement des territoires" | "Autres interventions de protection civile" | "Autres services annexes de l'enseignement" | "Collecte et traitement des déchets" | "Culture" | "Développement touristique" | "Enseignement du premier degré" | "Enseignement du second degré" | "Enseignement supérieur, professionnel et continu" | "Foires et marchés" | "Habitat" | "Hébergement et restauration scolaires" | "Hygiène et salubrité publique" | "Incendie et secours" | "Industrie, commerce et artisanat" | "Infrastructures de transport" | "Jeunesse et loisirs" | "Police, sécurité, justice" | "Propreté urbaine" | "Routes et voiries" | "Santé" | "Sports" | "Transports publics (hors scolaire)" | "Transports scolaires" | null;
            /** @enum {string|null} */
            sousCompetences?: "Accessibilité" | "Architecture" | "Artisanat" | "Arts plastiques et photographie" | "Assainissement des eaux" | "Bâtiments et construction" | "Bibliothèques et livres" | "Cimetières et funéraire" | "Citoyenneté" | "Cohésion sociale et inclusion" | "Commerces et Services" | "Consommation alimentaire" | "Cours d'eau / canaux / plans d'eau" | "Déchets alimentaires et/ou agricoles" | "Distribution" | "Eau pluviale" | "Eau potable" | "Eau souterraine" | "Economie locale et circuits courts" | "Economie sociale et solidaire" | "Egalité des chances" | "Equipement public" | "Espace public" | "Espaces verts" | "Famille et enfance" | "Fiscalité des entreprises" | "Foncier" | "Friche" | "Handicap" | "Inclusion numérique" | "Industrie" | "Innovation, créativité et recherche" | "Jeunesse" | "Logement et habitat" | "Lutte contre la précarité" | "Médias et communication" | "Mers et océans" | "Musée" | "Patrimoine et monuments historiques" | "Paysage" | "Personnes âgées" | "Précarité et aide alimentaire" | "Production agricole et foncier" | "Protection animale" | "Réseaux" | "Spectacle vivant" | "Technologies numériques et numérisation" | "Tiers-lieux" | "Transformation des produits agricoles" | null;
        };
        CreateOrUpdateProjectResponse: {
            id: string;
        };
        ErrorResponse: {
            /** @description HTTP status code */
            statusCode: number;
            /** @description Error message */
            message: string;
        };
        Commune: {
            inseeCode: string;
        };
        ProjectResponse: {
            id: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            nom: string;
            description: string;
            porteurCodeSiret: string | null;
            porteurReferentEmail: string | null;
            porteurReferentTelephone: string | null;
            porteurReferentPrenom: string | null;
            porteurReferentNom: string | null;
            porteurReferentFonction: string | null;
            communes: components["schemas"]["Commune"][];
            budget: number;
            forecastedStartDate: string;
            status: string;
            competences: Record<string, never>;
            sousCompetences: Record<string, never>;
        };
        UpdateProjectDto: {
            nom?: string;
            description?: string;
            porteurCodeSiret?: string | null;
            porteurReferentEmail?: string | null;
            porteurReferentTelephone?: string | null;
            porteurReferentPrenom?: string | null;
            porteurReferentNom?: string | null;
            porteurReferentFonction?: string | null;
            budget?: number;
            /**
             * @description Forecasted start date in YYYY-MM-DD format
             * @example 2024-03-01
             */
            forecastedStartDate?: string;
            /**
             * @description Status specific to the service type
             * @enum {string}
             */
            status?: "IDEE" | "FAISABILITE" | "EN_COURS" | "IMPACTE" | "ABANDONNE" | "TERMINE";
            /**
             * @description Array of INSEE codes for the communes
             * @example [
             *       "01001",
             *       "75056",
             *       "97A01"
             *     ]
             */
            communeInseeCodes?: string[];
            /** @enum {string|null} */
            competences?: "Action sociale (hors APA et RSA)" | "Actions en matière de gestion des eaux" | "Agriculture, pêche et agro-alimentaire" | "Aménagement des territoires" | "Autres interventions de protection civile" | "Autres services annexes de l'enseignement" | "Collecte et traitement des déchets" | "Culture" | "Développement touristique" | "Enseignement du premier degré" | "Enseignement du second degré" | "Enseignement supérieur, professionnel et continu" | "Foires et marchés" | "Habitat" | "Hébergement et restauration scolaires" | "Hygiène et salubrité publique" | "Incendie et secours" | "Industrie, commerce et artisanat" | "Infrastructures de transport" | "Jeunesse et loisirs" | "Police, sécurité, justice" | "Propreté urbaine" | "Routes et voiries" | "Santé" | "Sports" | "Transports publics (hors scolaire)" | "Transports scolaires" | null;
            /** @enum {string|null} */
            sousCompetences?: "Accessibilité" | "Architecture" | "Artisanat" | "Arts plastiques et photographie" | "Assainissement des eaux" | "Bâtiments et construction" | "Bibliothèques et livres" | "Cimetières et funéraire" | "Citoyenneté" | "Cohésion sociale et inclusion" | "Commerces et Services" | "Consommation alimentaire" | "Cours d'eau / canaux / plans d'eau" | "Déchets alimentaires et/ou agricoles" | "Distribution" | "Eau pluviale" | "Eau potable" | "Eau souterraine" | "Economie locale et circuits courts" | "Economie sociale et solidaire" | "Egalité des chances" | "Equipement public" | "Espace public" | "Espaces verts" | "Famille et enfance" | "Fiscalité des entreprises" | "Foncier" | "Friche" | "Handicap" | "Inclusion numérique" | "Industrie" | "Innovation, créativité et recherche" | "Jeunesse" | "Logement et habitat" | "Lutte contre la précarité" | "Médias et communication" | "Mers et océans" | "Musée" | "Patrimoine et monuments historiques" | "Paysage" | "Personnes âgées" | "Précarité et aide alimentaire" | "Production agricole et foncier" | "Protection animale" | "Réseaux" | "Spectacle vivant" | "Technologies numériques et numérisation" | "Tiers-lieux" | "Transformation des produits agricoles" | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    ProjectsController_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ProjectResponse"][];
                };
            };
            /** @description Error response */
            default: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProjectsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProjectRequest"];
            };
        };
        responses: {
            /** @description Project created successfully */
            201: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["CreateOrUpdateProjectResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProjectsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ProjectResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProjectsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content?: never;
            };
        };
    };
    ProjectsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProjectDto"];
            };
        };
        responses: {
            200: {
                headers: Record<string, unknown>;
                content?: never;
            };
        };
    };
    ServicesController_getError: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content?: never;
            };
        };
    };
    ServicesController_getServicesByProjectId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                projectId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content?: never;
            };
        };
    };
}
