/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
    "/projets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get all Projets */
        get: operations["ProjetsController_findAll"];
        put?: never;
        post: operations["ProjetsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get specific Projet by id */
        get: operations["ProjetsController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update a specific Projet */
        patch: operations["ProjetsController_update"];
        trace?: never;
    };
    "/projets/{id}/extra-fields": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ProjetsController_getExtraFields"];
        put?: never;
        post: operations["ProjetsController_updateExtraFields"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/projets/bulk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create new Projets in bulk */
        post: operations["ProjetsController_createBulk"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services/project/{id}": {
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
        /** Create a new service */
        post: operations["ServicesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services/contexts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a new service context for a specific service to match some projects  */
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
        PorteurDto: {
            codeSiret?: string | null;
            referentEmail?: string | null;
            referentTelephone?: string | null;
            referentPrenom?: string | null;
            referentNom?: string | null;
            referentFonction?: string | null;
        };
        Collectivite: {
            id: string;
            nom: string;
            /** @enum {string} */
            type: "Commune" | "EPCI";
            codeInsee: string | null;
            codeEpci: string | null;
            codeDepartements: string | null;
            codeRegions: string | null;
            siren: string | null;
        };
        ProjetResponse: {
            id: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            nom: string;
            description: string | null;
            porteur: components["schemas"]["PorteurDto"] | null;
            collectivites: components["schemas"]["Collectivite"][];
            budgetPrevisionnel: number | null;
            dateDebutPrevisionnelle: string | null;
            /** @enum {string|null} */
            phaseStatut: "En cours" | "En retard" | "En pause" | "Bloqué" | "Abandonné" | "Terminé" | null;
            /** @enum {string|null} */
            phase: "Idée" | "Étude" | "Opération" | null;
            programme: string | null;
            /** @enum {string|null} */
            competences: "90-025" | "90-11" | "90-12" | "90-13" | "90-18" | "90-21" | "90-211" | "90-212" | "90-213" | "90-22" | "90-221" | "90-222" | "90-223" | "90-23" | "90-24" | "90-25" | "90-251" | "90-252" | "90-253" | "90-254" | "90-255" | "90-256" | "90-26" | "90-27" | "90-28" | "90-281" | "90-282" | "90-283" | "90-284" | "90-288" | "90-29" | "90-31" | "90-311" | "90-312" | "90-313" | "90-314" | "90-315" | "90-316" | "90-317" | "90-318" | "90-32" | "90-321" | "90-322" | "90-323" | "90-324" | "90-325" | "90-326" | "90-327" | "90-33" | "90-331" | "90-332" | "90-338" | "90-34" | "90-341" | "90-348" | "90-39" | "90-41" | "90-411" | "90-412" | "90-413" | "90-414" | "90-418" | "90-421" | "90-422" | "90-423" | "90-424" | "90-425" | "90-428" | "90-51" | "90-511" | "90-512" | "90-513" | "90-514" | "90-515" | "90-518" | "90-52" | "90-53" | "90-54" | "90-55" | "90-551" | "90-552" | "90-553" | "90-554" | "90-555" | "90-56" | "90-57" | "90-58" | "90-581" | "90-588" | "90-59" | "90-61" | "90-62" | "90-63" | "90-631" | "90-632" | "90-633" | "90-64" | "90-65" | "90-66" | "90-67" | "90-68" | "90-71" | "90-72" | "90-720" | "90-721" | "90-722" | "90-73" | "90-731" | "90-732" | "90-733" | "90-734" | "90-735" | "90-74" | "90-75" | "90-751" | "90-752" | "90-753" | "90-754" | "90-758" | "90-76" | "90-77" | "90-78" | "90-81" | "90-82" | "90-821" | "90-822" | "90-823" | "90-824" | "90-825" | "90-828" | "90-83" | "90-831" | "90-832" | "90-833" | "90-834" | "90-835" | "90-838" | "90-84" | "90-841" | "90-842" | "90-843" | "90-844" | "90-845" | "90-846" | "90-847" | "90-848" | "90-849" | "90-85" | "90-851" | "90-852" | "90-853" | "90-854" | "90-855" | "90-86" | "90-87" | "90-89" | null;
            /**
             * @description Array of leviers
             * @enum {string|null}
             */
            leviers: "Gestion des forêts et produits bois" | "Changements de pratiques de fertilisation azotée" | "Elevage durable" | "Gestion des haies" | "Bâtiments & Machines agricoles" | "Gestion des prairies" | "Pratiques stockantes" | "Sobriété foncière" | "Surface en aire protégée" | "Résorption des points noirs prioritaires de continuité écologique" | "Restauration des habitats naturels" | "Réduction de l'usage des produits phytosanitaires" | "Développement de l'agriculture biologique et de HVE" | "Respect d'Egalim pour la restauration collective" | "Sobriété des bâtiments (résidentiel)" | "Changement chaudières fioul + rénovation (résidentiel)" | "Changement chaudières gaz + rénovation (résidentiel)" | "Rénovation (hors changement chaudières)" | "Sobriété des bâtiments (tertiaire)" | "Changement chaudières fioul + rénovation (tertiaire)" | "Changement chaudières gaz + rénovation (tertiaire)" | "Gaz fluorés résidentiel" | "Gaz fluorés tertiaire" | "Captage de méthane dans les ISDND" | "Prévention des déchets" | "Valorisation matière des déchets" | "Moindre stockage en décharge" | "Augmentation du taux de collecte" | "Sobriété dans l'utilisation de la ressource en eau" | "Protection des zones de captage d'eau" | "Désimperméabilisation des sols" | "Electricité renouvelable" | "Biogaz" | "Réseaux de chaleur décarbonés" | "Top 50 sites industriels" | "Industrie diffuse" | "Fret décarboné et multimodalité" | "Efficacité et sobriété logistique" | "Réduction des déplacements" | "Covoiturage" | "Vélo" | "Transports en commun" | "Véhicules électriques" | "Efficacité énergétique des véhicules privés" | "Bus et cars décarbonés" | "2 roues (élec&efficacité)" | "Nucléaire" | "Bio-carburants" | "Efficacité des aéronefs" | "SAF" | null;
            mecId: string | null;
            tetId: string | null;
            recocoId: string | null;
        };
        ErrorResponse: {
            /** @description HTTP status code */
            statusCode: number;
            /** @description Error message */
            message: string;
        };
        ExtraField: {
            /** @description Name of the extra field */
            name: string;
            /** @description Value of the extra field */
            value: string;
        };
        ProjetExtraFieldsResponse: {
            /** @description Array of extra field names, values, and labels */
            extraFields: components["schemas"]["ExtraField"][];
        };
        CreateProjetExtraFieldRequest: {
            /** @description Array of extra field names, values, and labels */
            extraFields: components["schemas"]["ExtraField"][];
        };
        CollectiviteReference: {
            /**
             * @description Types of the collectivite
             * @example Commune
             * @enum {string}
             */
            type: "Commune" | "EPCI";
            /** @description Code of the collectivite, codeInsee for communes and codeEpci/siren for EPCI */
            code: string;
        };
        CreateProjetRequest: {
            nom: string;
            description?: string | null;
            porteur?: components["schemas"]["PorteurDto"] | null;
            budgetPrevisionnel?: number | null;
            /**
             * @description Forecasted start date in YYYY-MM-DD format
             * @example 2024-03-01
             */
            dateDebutPrevisionnelle?: string | null;
            /**
             * @description Current Phase for the project
             * @enum {string|null}
             */
            phase?: "Idée" | "Étude" | "Opération" | null;
            /**
             * @description Current phase status for the phase
             * @enum {string|null}
             */
            phaseStatut?: "En cours" | "En retard" | "En pause" | "Bloqué" | "Abandonné" | "Terminé" | null;
            programme?: string | null;
            /**
             * @description Array of collectivite references
             * @example [
             *       {
             *         "type": "Commune",
             *         "code": "44104"
             *       },
             *       {
             *         "type": "EPCI",
             *         "code": "200000438"
             *       }
             *     ]
             */
            collectivites: components["schemas"]["CollectiviteReference"][];
            /** @description Array of competences and sous-competences */
            competences?: ("90-025" | "90-11" | "90-12" | "90-13" | "90-18" | "90-21" | "90-211" | "90-212" | "90-213" | "90-22" | "90-221" | "90-222" | "90-223" | "90-23" | "90-24" | "90-25" | "90-251" | "90-252" | "90-253" | "90-254" | "90-255" | "90-256" | "90-26" | "90-27" | "90-28" | "90-281" | "90-282" | "90-283" | "90-284" | "90-288" | "90-29" | "90-31" | "90-311" | "90-312" | "90-313" | "90-314" | "90-315" | "90-316" | "90-317" | "90-318" | "90-32" | "90-321" | "90-322" | "90-323" | "90-324" | "90-325" | "90-326" | "90-327" | "90-33" | "90-331" | "90-332" | "90-338" | "90-34" | "90-341" | "90-348" | "90-39" | "90-41" | "90-411" | "90-412" | "90-413" | "90-414" | "90-418" | "90-421" | "90-422" | "90-423" | "90-424" | "90-425" | "90-428" | "90-51" | "90-511" | "90-512" | "90-513" | "90-514" | "90-515" | "90-518" | "90-52" | "90-53" | "90-54" | "90-55" | "90-551" | "90-552" | "90-553" | "90-554" | "90-555" | "90-56" | "90-57" | "90-58" | "90-581" | "90-588" | "90-59" | "90-61" | "90-62" | "90-63" | "90-631" | "90-632" | "90-633" | "90-64" | "90-65" | "90-66" | "90-67" | "90-68" | "90-71" | "90-72" | "90-720" | "90-721" | "90-722" | "90-73" | "90-731" | "90-732" | "90-733" | "90-734" | "90-735" | "90-74" | "90-75" | "90-751" | "90-752" | "90-753" | "90-754" | "90-758" | "90-76" | "90-77" | "90-78" | "90-81" | "90-82" | "90-821" | "90-822" | "90-823" | "90-824" | "90-825" | "90-828" | "90-83" | "90-831" | "90-832" | "90-833" | "90-834" | "90-835" | "90-838" | "90-84" | "90-841" | "90-842" | "90-843" | "90-844" | "90-845" | "90-846" | "90-847" | "90-848" | "90-849" | "90-85" | "90-851" | "90-852" | "90-853" | "90-854" | "90-855" | "90-86" | "90-87" | "90-89")[] | null;
            /** @description Array of leviers de la transition écologique */
            leviers?: ("Gestion des forêts et produits bois" | "Changements de pratiques de fertilisation azotée" | "Elevage durable" | "Gestion des haies" | "Bâtiments & Machines agricoles" | "Gestion des prairies" | "Pratiques stockantes" | "Sobriété foncière" | "Surface en aire protégée" | "Résorption des points noirs prioritaires de continuité écologique" | "Restauration des habitats naturels" | "Réduction de l'usage des produits phytosanitaires" | "Développement de l'agriculture biologique et de HVE" | "Respect d'Egalim pour la restauration collective" | "Sobriété des bâtiments (résidentiel)" | "Changement chaudières fioul + rénovation (résidentiel)" | "Changement chaudières gaz + rénovation (résidentiel)" | "Rénovation (hors changement chaudières)" | "Sobriété des bâtiments (tertiaire)" | "Changement chaudières fioul + rénovation (tertiaire)" | "Changement chaudières gaz + rénovation (tertiaire)" | "Gaz fluorés résidentiel" | "Gaz fluorés tertiaire" | "Captage de méthane dans les ISDND" | "Prévention des déchets" | "Valorisation matière des déchets" | "Moindre stockage en décharge" | "Augmentation du taux de collecte" | "Sobriété dans l'utilisation de la ressource en eau" | "Protection des zones de captage d'eau" | "Désimperméabilisation des sols" | "Electricité renouvelable" | "Biogaz" | "Réseaux de chaleur décarbonés" | "Top 50 sites industriels" | "Industrie diffuse" | "Fret décarboné et multimodalité" | "Efficacité et sobriété logistique" | "Réduction des déplacements" | "Covoiturage" | "Vélo" | "Transports en commun" | "Véhicules électriques" | "Efficacité énergétique des véhicules privés" | "Bus et cars décarbonés" | "2 roues (élec&efficacité)" | "Nucléaire" | "Bio-carburants" | "Efficacité des aéronefs" | "SAF")[] | null;
            externalId: string;
        };
        CreateOrUpdateProjetResponse: {
            id: string;
        };
        BulkCreateProjetsRequest: {
            projects: components["schemas"]["CreateProjetRequest"][];
        };
        BulkCreateProjetsResponse: {
            ids: string[];
        };
        UpdateProjetRequest: {
            nom?: string;
            description?: string | null;
            porteur?: components["schemas"]["PorteurDto"] | null;
            budgetPrevisionnel?: number | null;
            /**
             * @description Forecasted start date in YYYY-MM-DD format
             * @example 2024-03-01
             */
            dateDebutPrevisionnelle?: string | null;
            /**
             * @description Current Phase for the project
             * @enum {string|null}
             */
            phase?: "Idée" | "Étude" | "Opération" | null;
            /**
             * @description Current phase status for the phase
             * @enum {string|null}
             */
            phaseStatut?: "En cours" | "En retard" | "En pause" | "Bloqué" | "Abandonné" | "Terminé" | null;
            programme?: string | null;
            /**
             * @description Array of collectivite references
             * @example [
             *       {
             *         "type": "Commune",
             *         "code": "44104"
             *       },
             *       {
             *         "type": "EPCI",
             *         "code": "200000438"
             *       }
             *     ]
             */
            collectivites?: components["schemas"]["CollectiviteReference"][];
            /** @description Array of competences and sous-competences */
            competences?: ("90-025" | "90-11" | "90-12" | "90-13" | "90-18" | "90-21" | "90-211" | "90-212" | "90-213" | "90-22" | "90-221" | "90-222" | "90-223" | "90-23" | "90-24" | "90-25" | "90-251" | "90-252" | "90-253" | "90-254" | "90-255" | "90-256" | "90-26" | "90-27" | "90-28" | "90-281" | "90-282" | "90-283" | "90-284" | "90-288" | "90-29" | "90-31" | "90-311" | "90-312" | "90-313" | "90-314" | "90-315" | "90-316" | "90-317" | "90-318" | "90-32" | "90-321" | "90-322" | "90-323" | "90-324" | "90-325" | "90-326" | "90-327" | "90-33" | "90-331" | "90-332" | "90-338" | "90-34" | "90-341" | "90-348" | "90-39" | "90-41" | "90-411" | "90-412" | "90-413" | "90-414" | "90-418" | "90-421" | "90-422" | "90-423" | "90-424" | "90-425" | "90-428" | "90-51" | "90-511" | "90-512" | "90-513" | "90-514" | "90-515" | "90-518" | "90-52" | "90-53" | "90-54" | "90-55" | "90-551" | "90-552" | "90-553" | "90-554" | "90-555" | "90-56" | "90-57" | "90-58" | "90-581" | "90-588" | "90-59" | "90-61" | "90-62" | "90-63" | "90-631" | "90-632" | "90-633" | "90-64" | "90-65" | "90-66" | "90-67" | "90-68" | "90-71" | "90-72" | "90-720" | "90-721" | "90-722" | "90-73" | "90-731" | "90-732" | "90-733" | "90-734" | "90-735" | "90-74" | "90-75" | "90-751" | "90-752" | "90-753" | "90-754" | "90-758" | "90-76" | "90-77" | "90-78" | "90-81" | "90-82" | "90-821" | "90-822" | "90-823" | "90-824" | "90-825" | "90-828" | "90-83" | "90-831" | "90-832" | "90-833" | "90-834" | "90-835" | "90-838" | "90-84" | "90-841" | "90-842" | "90-843" | "90-844" | "90-845" | "90-846" | "90-847" | "90-848" | "90-849" | "90-85" | "90-851" | "90-852" | "90-853" | "90-854" | "90-855" | "90-86" | "90-87" | "90-89")[] | null;
            /** @description Array of leviers de la transition écologique */
            leviers?: ("Gestion des forêts et produits bois" | "Changements de pratiques de fertilisation azotée" | "Elevage durable" | "Gestion des haies" | "Bâtiments & Machines agricoles" | "Gestion des prairies" | "Pratiques stockantes" | "Sobriété foncière" | "Surface en aire protégée" | "Résorption des points noirs prioritaires de continuité écologique" | "Restauration des habitats naturels" | "Réduction de l'usage des produits phytosanitaires" | "Développement de l'agriculture biologique et de HVE" | "Respect d'Egalim pour la restauration collective" | "Sobriété des bâtiments (résidentiel)" | "Changement chaudières fioul + rénovation (résidentiel)" | "Changement chaudières gaz + rénovation (résidentiel)" | "Rénovation (hors changement chaudières)" | "Sobriété des bâtiments (tertiaire)" | "Changement chaudières fioul + rénovation (tertiaire)" | "Changement chaudières gaz + rénovation (tertiaire)" | "Gaz fluorés résidentiel" | "Gaz fluorés tertiaire" | "Captage de méthane dans les ISDND" | "Prévention des déchets" | "Valorisation matière des déchets" | "Moindre stockage en décharge" | "Augmentation du taux de collecte" | "Sobriété dans l'utilisation de la ressource en eau" | "Protection des zones de captage d'eau" | "Désimperméabilisation des sols" | "Electricité renouvelable" | "Biogaz" | "Réseaux de chaleur décarbonés" | "Top 50 sites industriels" | "Industrie diffuse" | "Fret décarboné et multimodalité" | "Efficacité et sobriété logistique" | "Réduction des déplacements" | "Covoiturage" | "Vélo" | "Transports en commun" | "Véhicules électriques" | "Efficacité énergétique des véhicules privés" | "Bus et cars décarbonés" | "2 roues (élec&efficacité)" | "Nucléaire" | "Bio-carburants" | "Efficacité des aéronefs" | "SAF")[] | null;
            externalId: string;
        };
        ExtraFieldConfig: {
            /** @description Name of the extra field */
            name: string;
            /** @description Value of the extra field */
            label: string;
        };
        ServicesByProjectIdResponse: {
            id: string;
            name: string;
            description: string;
            sousTitre: string;
            redirectionUrl: string;
            logoUrl: string;
            /**
             * @description Array of extra field definitions with name and label
             * @example [
             *       {
             *         "name": "surface",
             *         "label": "Surface (m²)"
             *       }
             *     ]
             */
            extraFields: components["schemas"]["ExtraFieldConfig"][];
            isListed: boolean;
            redirectionLabel: string | null;
            iframeUrl: string | null;
            extendLabel: string | null;
        };
        CreateServiceRequest: {
            /**
             * @description The name of the service
             * @example Facili-Tacct
             */
            name: string;
            /**
             * @description Objectivez votre diagnostic avec les données socio-économiques qui rendent votre territoire unique et découvrez des arguments et ressources pour mobiliser vos collègues et partenaires externes sur l'adaptation au changement climatique.
             * @example Docurba centralise les ressources nécessaires à chaque étape de vos procédures d'urbanisme
             */
            sousTitre: string;
            /** @example Docurba est l’outil de transformation de la planification territoriale. Il facilite la collaboration entre services de l’Etat, collectivités et bureaux d’études pour faciliter l’élaboration et le suivi d’un document d’urbanisme afin que les enjeux et les politiques publiques soient plus rapidement et mieux pris en compte au niveau local. */
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
             * @example Découvrez la boussole
             */
            redirectionLabel?: string | null;
            iframeUrl?: string | null;
            extendLabel?: string | null;
            /** @description Whether the service will be associated with projects */
            isListed?: boolean;
        };
        CreateServiceResponse: {
            id: string;
            name: string;
            description: string;
            sousTitre: string;
            logoUrl: string;
            redirectionUrl: string;
            redirectionLabel: Record<string, never> | null;
            iframeUrl: Record<string, never> | null;
            extendLabel: Record<string, never> | null;
        };
        CreateServiceContextRequest: {
            /** @description Array of competences and sous-competences, empty array means all competences/sous-competences */
            competences: ("90-025" | "90-11" | "90-12" | "90-13" | "90-18" | "90-21" | "90-211" | "90-212" | "90-213" | "90-22" | "90-221" | "90-222" | "90-223" | "90-23" | "90-24" | "90-25" | "90-251" | "90-252" | "90-253" | "90-254" | "90-255" | "90-256" | "90-26" | "90-27" | "90-28" | "90-281" | "90-282" | "90-283" | "90-284" | "90-288" | "90-29" | "90-31" | "90-311" | "90-312" | "90-313" | "90-314" | "90-315" | "90-316" | "90-317" | "90-318" | "90-32" | "90-321" | "90-322" | "90-323" | "90-324" | "90-325" | "90-326" | "90-327" | "90-33" | "90-331" | "90-332" | "90-338" | "90-34" | "90-341" | "90-348" | "90-39" | "90-41" | "90-411" | "90-412" | "90-413" | "90-414" | "90-418" | "90-421" | "90-422" | "90-423" | "90-424" | "90-425" | "90-428" | "90-51" | "90-511" | "90-512" | "90-513" | "90-514" | "90-515" | "90-518" | "90-52" | "90-53" | "90-54" | "90-55" | "90-551" | "90-552" | "90-553" | "90-554" | "90-555" | "90-56" | "90-57" | "90-58" | "90-581" | "90-588" | "90-59" | "90-61" | "90-62" | "90-63" | "90-631" | "90-632" | "90-633" | "90-64" | "90-65" | "90-66" | "90-67" | "90-68" | "90-71" | "90-72" | "90-720" | "90-721" | "90-722" | "90-73" | "90-731" | "90-732" | "90-733" | "90-734" | "90-735" | "90-74" | "90-75" | "90-751" | "90-752" | "90-753" | "90-754" | "90-758" | "90-76" | "90-77" | "90-78" | "90-81" | "90-82" | "90-821" | "90-822" | "90-823" | "90-824" | "90-825" | "90-828" | "90-83" | "90-831" | "90-832" | "90-833" | "90-834" | "90-835" | "90-838" | "90-84" | "90-841" | "90-842" | "90-843" | "90-844" | "90-845" | "90-846" | "90-847" | "90-848" | "90-849" | "90-85" | "90-851" | "90-852" | "90-853" | "90-854" | "90-855" | "90-86" | "90-87" | "90-89")[] | null;
            /**
             * @description Array of leviers, empty array means all leviers
             * @example [
             *       "Bio-carburants",
             *       "Covoiturage"
             *     ]
             */
            leviers: ("Gestion des forêts et produits bois" | "Changements de pratiques de fertilisation azotée" | "Elevage durable" | "Gestion des haies" | "Bâtiments & Machines agricoles" | "Gestion des prairies" | "Pratiques stockantes" | "Sobriété foncière" | "Surface en aire protégée" | "Résorption des points noirs prioritaires de continuité écologique" | "Restauration des habitats naturels" | "Réduction de l'usage des produits phytosanitaires" | "Développement de l'agriculture biologique et de HVE" | "Respect d'Egalim pour la restauration collective" | "Sobriété des bâtiments (résidentiel)" | "Changement chaudières fioul + rénovation (résidentiel)" | "Changement chaudières gaz + rénovation (résidentiel)" | "Rénovation (hors changement chaudières)" | "Sobriété des bâtiments (tertiaire)" | "Changement chaudières fioul + rénovation (tertiaire)" | "Changement chaudières gaz + rénovation (tertiaire)" | "Gaz fluorés résidentiel" | "Gaz fluorés tertiaire" | "Captage de méthane dans les ISDND" | "Prévention des déchets" | "Valorisation matière des déchets" | "Moindre stockage en décharge" | "Augmentation du taux de collecte" | "Sobriété dans l'utilisation de la ressource en eau" | "Protection des zones de captage d'eau" | "Désimperméabilisation des sols" | "Electricité renouvelable" | "Biogaz" | "Réseaux de chaleur décarbonés" | "Top 50 sites industriels" | "Industrie diffuse" | "Fret décarboné et multimodalité" | "Efficacité et sobriété logistique" | "Réduction des déplacements" | "Covoiturage" | "Vélo" | "Transports en commun" | "Véhicules électriques" | "Efficacité énergétique des véhicules privés" | "Bus et cars décarbonés" | "2 roues (élec&efficacité)" | "Nucléaire" | "Bio-carburants" | "Efficacité des aéronefs" | "SAF")[] | null;
            /** @description Project phases for which the serviceContext applies, empty array means all phases */
            phases: ("Idée" | "Étude" | "Opération")[] | null;
            description?: string | null;
            sousTitre?: string | null;
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
            /**
             * @description Array of extra field definitions required for this service context
             * @example [
             *       {
             *         "name": "field1",
             *         "label": "Field 1 Label"
             *       }
             *     ]
             */
            extraFields?: components["schemas"]["ExtraFieldConfig"][] | null;
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
    ProjetsController_findAll: {
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
                    "application/json": components["schemas"]["ProjetResponse"][];
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
    ProjetsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProjetRequest"];
            };
        };
        responses: {
            /** @description Projet created successfully */
            201: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["CreateOrUpdateProjetResponse"];
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
    ProjetsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description An Id in a UUID format */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ProjetResponse"];
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
    ProjetsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description An Id in a UUID format */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProjetRequest"];
            };
        };
        responses: {
            /** @description Projet updated successfully */
            200: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["CreateOrUpdateProjetResponse"];
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
    ProjetsController_getExtraFields: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description An Id in a UUID format */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ProjetExtraFieldsResponse"];
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
    ProjetsController_updateExtraFields: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description An Id in a UUID format */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProjetExtraFieldRequest"];
            };
        };
        responses: {
            201: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ProjetExtraFieldsResponse"];
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
    ProjetsController_createBulk: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BulkCreateProjetsRequest"];
            };
        };
        responses: {
            /** @description Bulk Projets created successfully */
            201: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["BulkCreateProjetsResponse"];
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
    ServicesController_getServicesByProjectId: {
        parameters: {
            query: {
                debug: boolean;
            };
            header?: never;
            path: {
                /** @description An Id in a UUID format */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["ServicesByProjectIdResponse"][];
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
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["CreateServiceResponse"];
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
    ServicesController_createServiceContext: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description An Id in a UUID format */
                id: string;
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
                headers: Record<string, unknown>;
                content: {
                    "application/json": components["schemas"]["CreateServiceContextResponse"];
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
}
