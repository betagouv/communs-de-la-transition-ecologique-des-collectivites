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
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["ProjectsController_update"];
        trace?: never;
    };
    "/projects/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ProjectsController_createBulk"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
        /** Get all services corresponding to a project */
        get: operations["ServicesController_getServicesByProjectId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ServicesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services/{serviceId}/contexts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new service context */
        post: operations["ServicesController_createServiceContext"];
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
        ProjectResponse: {
            id: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            nom: string;
            description: Record<string, never>;
            porteurCodeSiret: Record<string, never>;
            porteurReferentEmail: Record<string, never>;
            porteurReferentTelephone: Record<string, never>;
            porteurReferentPrenom: Record<string, never>;
            porteurReferentNom: Record<string, never>;
            porteurReferentFonction: Record<string, never>;
            communes: string[];
            budget: Record<string, never>;
            forecastedStartDate: Record<string, never>;
            status: Record<string, never>;
            competencesAndSousCompetences: Record<string, never>;
            mecId: Record<string, never>;
            tetId: Record<string, never>;
            recocoId: Record<string, never>;
        };
        ErrorResponse: {
            /** @description HTTP status code */
            statusCode: number;
            /** @description Error message */
            message: string;
        };
        CreateProjectRequest: {
            nom: string;
            description?: string | null;
            porteurCodeSiret?: string | null;
            porteurReferentEmail?: string | null;
            porteurReferentTelephone?: string | null;
            porteurReferentPrenom?: string | null;
            porteurReferentNom?: string | null;
            porteurReferentFonction?: string | null;
            budget?: number | null;
            /**
             * @description Forecasted start date in YYYY-MM-DD format
             * @example 2024-03-01
             */
            forecastedStartDate?: string | null;
            /**
             * @description Current Status for the project
             * @enum {string|null}
             */
            status?: "IDEE" | "FAISABILITE" | "EN_COURS" | "IMPACTE" | "ABANDONNE" | "TERMINE" | null;
            /**
             * @description Array of INSEE codes for the communes
             * @example [
             *       "01001",
             *       "75056",
             *       "97A01"
             *     ]
             */
            communeInseeCodes?: string[];
            /** @description Array of competences and sous-competences */
            competencesAndSousCompetences?: ("Autres interventions de protection civile" | "Autres services annexes de l'enseignement" | "Collecte et traitement des déchets" | "Développement touristique" | "Enseignement du premier degré" | "Enseignement du second degré" | "Enseignement supérieur, professionnel et continu" | "Foires et marchés" | "Hébergement et restauration scolaires" | "Hygiène et salubrité publique" | "Incendie et secours" | "Infrastructures de transport" | "Jeunesse et loisirs" | "Police, sécurité, justice" | "Propreté urbaine" | "Routes et voiries" | "Santé" | "Sports" | "Transports publics (hors scolaire)" | "Transports scolaires" | "Action sociale (hors APA et RSA)__Citoyenneté" | "Action sociale (hors APA et RSA)__Cohésion sociale et inclusion" | "Action sociale (hors APA et RSA)__Egalité des chances" | "Action sociale (hors APA et RSA)__Famille et enfance" | "Action sociale (hors APA et RSA)__Handicap" | "Action sociale (hors APA et RSA)__Inclusion numérique" | "Action sociale (hors APA et RSA)__Jeunesse" | "Action sociale (hors APA et RSA)__Lutte contre la précarité" | "Action sociale (hors APA et RSA)__Personnes âgées" | "Action sociale (hors APA et RSA)__Protection animale" | "Actions en matière de gestion des eaux__Assainissement des eaux" | "Actions en matière de gestion des eaux__Cours d'eau / canaux / plans d'eau" | "Actions en matière de gestion des eaux__Eau pluviale" | "Actions en matière de gestion des eaux__Eau potable" | "Actions en matière de gestion des eaux__Eau souterraine" | "Actions en matière de gestion des eaux__Mers et océans" | "Agriculture, pêche et agro-alimentaire__Consommation alimentaire" | "Agriculture, pêche et agro-alimentaire__Déchets alimentaires et/ou agricoles" | "Agriculture, pêche et agro-alimentaire__Distribution" | "Agriculture, pêche et agro-alimentaire__Précarité et aide alimentaire" | "Agriculture, pêche et agro-alimentaire__Production agricole et foncier" | "Agriculture, pêche et agro-alimentaire__Transformation des produits agricoles" | "Aménagement des territoires__Foncier" | "Aménagement des territoires__Friche" | "Aménagement des territoires__Paysage" | "Aménagement des territoires__Réseaux" | "Culture__Arts plastiques et photographie" | "Culture__Bibliothèques et livres" | "Culture__Médias et communication" | "Culture__Musée" | "Culture__Patrimoine et monuments historiques" | "Culture__Spectacle vivant" | "Habitat__Accessibilité" | "Habitat__Architecture" | "Habitat__Bâtiments et construction" | "Habitat__Cimetières et funéraire" | "Habitat__Equipement public" | "Habitat__Espace public" | "Habitat__Espaces verts" | "Habitat__Logement et habitat" | "Industrie, commerce et artisanat__Artisanat" | "Industrie, commerce et artisanat__Commerces et Services" | "Industrie, commerce et artisanat__Economie locale et circuits courts" | "Industrie, commerce et artisanat__Economie sociale et solidaire" | "Industrie, commerce et artisanat__Fiscalité des entreprises" | "Industrie, commerce et artisanat__Industrie" | "Industrie, commerce et artisanat__Innovation, créativité et recherche" | "Industrie, commerce et artisanat__Technologies numériques et numérisation" | "Industrie, commerce et artisanat__Tiers-lieux")[] | null;
            externalId: string;
        };
        CreateOrUpdateProjectResponse: {
            id: string;
        };
        BulkCreateProjectsRequest: {
            projects: components["schemas"]["CreateProjectRequest"][];
        };
        BulkCreateProjectsResponse: {
            ids: string[];
        };
        UpdateProjectDto: {
            nom?: string;
            description?: string | null;
            porteurCodeSiret?: string | null;
            porteurReferentEmail?: string | null;
            porteurReferentTelephone?: string | null;
            porteurReferentPrenom?: string | null;
            porteurReferentNom?: string | null;
            porteurReferentFonction?: string | null;
            budget?: number | null;
            /**
             * @description Forecasted start date in YYYY-MM-DD format
             * @example 2024-03-01
             */
            forecastedStartDate?: string | null;
            /**
             * @description Current Status for the project
             * @enum {string|null}
             */
            status?: "IDEE" | "FAISABILITE" | "EN_COURS" | "IMPACTE" | "ABANDONNE" | "TERMINE" | null;
            /**
             * @description Array of INSEE codes for the communes
             * @example [
             *       "01001",
             *       "75056",
             *       "97A01"
             *     ]
             */
            communeInseeCodes?: string[];
            /** @description Array of competences and sous-competences */
            competencesAndSousCompetences?: ("Autres interventions de protection civile" | "Autres services annexes de l'enseignement" | "Collecte et traitement des déchets" | "Développement touristique" | "Enseignement du premier degré" | "Enseignement du second degré" | "Enseignement supérieur, professionnel et continu" | "Foires et marchés" | "Hébergement et restauration scolaires" | "Hygiène et salubrité publique" | "Incendie et secours" | "Infrastructures de transport" | "Jeunesse et loisirs" | "Police, sécurité, justice" | "Propreté urbaine" | "Routes et voiries" | "Santé" | "Sports" | "Transports publics (hors scolaire)" | "Transports scolaires" | "Action sociale (hors APA et RSA)__Citoyenneté" | "Action sociale (hors APA et RSA)__Cohésion sociale et inclusion" | "Action sociale (hors APA et RSA)__Egalité des chances" | "Action sociale (hors APA et RSA)__Famille et enfance" | "Action sociale (hors APA et RSA)__Handicap" | "Action sociale (hors APA et RSA)__Inclusion numérique" | "Action sociale (hors APA et RSA)__Jeunesse" | "Action sociale (hors APA et RSA)__Lutte contre la précarité" | "Action sociale (hors APA et RSA)__Personnes âgées" | "Action sociale (hors APA et RSA)__Protection animale" | "Actions en matière de gestion des eaux__Assainissement des eaux" | "Actions en matière de gestion des eaux__Cours d'eau / canaux / plans d'eau" | "Actions en matière de gestion des eaux__Eau pluviale" | "Actions en matière de gestion des eaux__Eau potable" | "Actions en matière de gestion des eaux__Eau souterraine" | "Actions en matière de gestion des eaux__Mers et océans" | "Agriculture, pêche et agro-alimentaire__Consommation alimentaire" | "Agriculture, pêche et agro-alimentaire__Déchets alimentaires et/ou agricoles" | "Agriculture, pêche et agro-alimentaire__Distribution" | "Agriculture, pêche et agro-alimentaire__Précarité et aide alimentaire" | "Agriculture, pêche et agro-alimentaire__Production agricole et foncier" | "Agriculture, pêche et agro-alimentaire__Transformation des produits agricoles" | "Aménagement des territoires__Foncier" | "Aménagement des territoires__Friche" | "Aménagement des territoires__Paysage" | "Aménagement des territoires__Réseaux" | "Culture__Arts plastiques et photographie" | "Culture__Bibliothèques et livres" | "Culture__Médias et communication" | "Culture__Musée" | "Culture__Patrimoine et monuments historiques" | "Culture__Spectacle vivant" | "Habitat__Accessibilité" | "Habitat__Architecture" | "Habitat__Bâtiments et construction" | "Habitat__Cimetières et funéraire" | "Habitat__Equipement public" | "Habitat__Espace public" | "Habitat__Espaces verts" | "Habitat__Logement et habitat" | "Industrie, commerce et artisanat__Artisanat" | "Industrie, commerce et artisanat__Commerces et Services" | "Industrie, commerce et artisanat__Economie locale et circuits courts" | "Industrie, commerce et artisanat__Economie sociale et solidaire" | "Industrie, commerce et artisanat__Fiscalité des entreprises" | "Industrie, commerce et artisanat__Industrie" | "Industrie, commerce et artisanat__Innovation, créativité et recherche" | "Industrie, commerce et artisanat__Technologies numériques et numérisation" | "Industrie, commerce et artisanat__Tiers-lieux")[] | null;
            externalId: string;
        };
        CreateServiceRequest: {
            /**
             * @description The name of the service
             * @example Facili-Tacct
             */
            name: string;
            /**
             * @description Objectivez votre diagnostic avec les données socio-économiques qui rendent votre territoire unique et découvrez des arguments et ressources pour mobiliser vos collègues et partenaires externes sur l'adaptation au changement climatique.
             * @example Version control and collaboration platform
             */
            description: string;
            /**
             * @description The URL of the service logo
             * @example https://facili-tacct.beta.gouv.fr/_next/static/media/favicon.f453a8cf.svg
             */
            logoUrl: string;
            /**
             * @description The URL of the service
             * @example https://www.boussole-te.ecologie.gouv.fr/
             */
            redirectionUrl: string;
            /**
             * @description label of the redirection
             * @example La boussole
             */
            redirectionLabel: string;
            iframeUrl?: string | null;
            extendLabel?: string | null;
        };
        CreateServiceResponse: {
            id: string;
            name: string;
            description: string;
            logoUrl: string;
            redirectionUrl: string;
            redirectionLabel: string;
            iframeUrl: Record<string, never>;
            extendLabel: Record<string, never>;
        };
        CreateServiceContextRequest: {
            /** @description Array of competences and sous-competences, empty array means all competences/sous-competences */
            competencesAndSousCompetences: ("Autres interventions de protection civile" | "Autres services annexes de l'enseignement" | "Collecte et traitement des déchets" | "Développement touristique" | "Enseignement du premier degré" | "Enseignement du second degré" | "Enseignement supérieur, professionnel et continu" | "Foires et marchés" | "Hébergement et restauration scolaires" | "Hygiène et salubrité publique" | "Incendie et secours" | "Infrastructures de transport" | "Jeunesse et loisirs" | "Police, sécurité, justice" | "Propreté urbaine" | "Routes et voiries" | "Santé" | "Sports" | "Transports publics (hors scolaire)" | "Transports scolaires" | "Action sociale (hors APA et RSA)__Citoyenneté" | "Action sociale (hors APA et RSA)__Cohésion sociale et inclusion" | "Action sociale (hors APA et RSA)__Egalité des chances" | "Action sociale (hors APA et RSA)__Famille et enfance" | "Action sociale (hors APA et RSA)__Handicap" | "Action sociale (hors APA et RSA)__Inclusion numérique" | "Action sociale (hors APA et RSA)__Jeunesse" | "Action sociale (hors APA et RSA)__Lutte contre la précarité" | "Action sociale (hors APA et RSA)__Personnes âgées" | "Action sociale (hors APA et RSA)__Protection animale" | "Actions en matière de gestion des eaux__Assainissement des eaux" | "Actions en matière de gestion des eaux__Cours d'eau / canaux / plans d'eau" | "Actions en matière de gestion des eaux__Eau pluviale" | "Actions en matière de gestion des eaux__Eau potable" | "Actions en matière de gestion des eaux__Eau souterraine" | "Actions en matière de gestion des eaux__Mers et océans" | "Agriculture, pêche et agro-alimentaire__Consommation alimentaire" | "Agriculture, pêche et agro-alimentaire__Déchets alimentaires et/ou agricoles" | "Agriculture, pêche et agro-alimentaire__Distribution" | "Agriculture, pêche et agro-alimentaire__Précarité et aide alimentaire" | "Agriculture, pêche et agro-alimentaire__Production agricole et foncier" | "Agriculture, pêche et agro-alimentaire__Transformation des produits agricoles" | "Aménagement des territoires__Foncier" | "Aménagement des territoires__Friche" | "Aménagement des territoires__Paysage" | "Aménagement des territoires__Réseaux" | "Culture__Arts plastiques et photographie" | "Culture__Bibliothèques et livres" | "Culture__Médias et communication" | "Culture__Musée" | "Culture__Patrimoine et monuments historiques" | "Culture__Spectacle vivant" | "Habitat__Accessibilité" | "Habitat__Architecture" | "Habitat__Bâtiments et construction" | "Habitat__Cimetières et funéraire" | "Habitat__Equipement public" | "Habitat__Espace public" | "Habitat__Espaces verts" | "Habitat__Logement et habitat" | "Industrie, commerce et artisanat__Artisanat" | "Industrie, commerce et artisanat__Commerces et Services" | "Industrie, commerce et artisanat__Economie locale et circuits courts" | "Industrie, commerce et artisanat__Economie sociale et solidaire" | "Industrie, commerce et artisanat__Fiscalité des entreprises" | "Industrie, commerce et artisanat__Industrie" | "Industrie, commerce et artisanat__Innovation, créativité et recherche" | "Industrie, commerce et artisanat__Technologies numériques et numérisation" | "Industrie, commerce et artisanat__Tiers-lieux")[];
            description?: string | null;
            /**
             * @description Custom logo URL for the service in this context
             * @example https://example.com/custom-logo.png
             */
            logoUrl?: string | null;
            /**
             * @description Custom redirection URL for the service in this context
             * @example https://service.example.com/specific-page
             */
            redirectionUrl?: string | null;
            /**
             * @description Custom label for the redirection button
             * @example Access Climate Tools
             */
            redirectionLabel?: string | null;
            /**
             * @description Custom label for expanding the service details
             * @example Show climate data
             */
            extendLabel?: string | null;
            iframeUrl?: string | null;
            /** @description Project status for which the serviceContext applies, empty array means all statuses */
            status: ("IDEE" | "FAISABILITE" | "EN_COURS" | "IMPACTE" | "ABANDONNE" | "TERMINE")[];
        };
        CreateServiceContextResponse: {
            id: string;
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
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectResponse"][];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
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
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrUpdateProjectResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
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
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
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
            /** @description Project updated successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrUpdateProjectResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProjectsController_createBulk: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkCreateProjectsRequest"];
            };
        };
        responses: {
            /** @description Bulk Projects created successfully */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BulkCreateProjectsResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
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
                headers: {
                    [name: string]: unknown;
                };
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
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ServicesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateServiceRequest"];
            };
        };
        responses: {
            /** @description Service created successfully */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateServiceResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ServicesController_createServiceContext: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description ID of the service */
                serviceId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateServiceContextRequest"];
            };
        };
        responses: {
            /** @description Service context created successfully */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateServiceContextResponse"];
                };
            };
            /** @description Error response */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
