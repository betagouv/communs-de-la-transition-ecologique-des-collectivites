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
  "/projects/{id}/update-collaborators": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["CollaboratorsController_create"];
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
    get: operations["ServicesController_findAll"];
    put?: never;
    post: operations["ServicesController_create"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/services/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["ServicesController_findOne"];
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
      porteurCodeSiret?: string;
      porteurReferentEmail?: string;
      porteurReferentTelephone?: string;
      porteurReferentPrenom?: string;
      porteurReferentNom?: string;
      porteurReferentFonction?: string;
      budget: number;
      /**
       * @description Forecasted start date in YYYY-MM-DD format
       * @example 2024-03-01
       */
      forecastedStartDate: string;
      /** @enum {string} */
      status: "DRAFT" | "READY" | "IN_PROGRESS" | "DONE" | "CANCELLED";
      /**
       * @description Array of INSEE codes for the communes
       * @example [
       *       "01001",
       *       "75056",
       *       "97A01"
       *     ]
       */
      communeInseeCodes: string[];
    };
    CreateProjectResponse: {
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
      porteurCodeSiret: string;
      porteurReferentEmail: string;
      porteurReferentTelephone: string;
      porteurReferentPrenom: string;
      porteurReferentNom: string;
      porteurReferentFonction: string;
      communes: components["schemas"]["Commune"][];
      budget: number;
      forecastedStartDate: string;
      status: string;
    };
    UpdateProjectDto: {
      nom?: string;
      description?: string;
      porteurCodeSiret?: string;
      porteurReferentEmail?: string;
      porteurReferentTelephone?: string;
      porteurReferentPrenom?: string;
      porteurReferentNom?: string;
      porteurReferentFonction?: string;
      budget?: number;
      /**
       * @description Forecasted start date in YYYY-MM-DD format
       * @example 2024-03-01
       */
      forecastedStartDate?: string;
      /** @enum {string} */
      status?: "DRAFT" | "READY" | "IN_PROGRESS" | "DONE" | "CANCELLED";
      /**
       * @description Array of INSEE codes for the communes
       * @example [
       *       "01001",
       *       "75056",
       *       "97A01"
       *     ]
       */
      communeInseeCodes?: string[];
    };
    CreateCollaboratorRequest: {
      email: string;
      /** @enum {string} */
      permissionType: "EDIT" | "VIEW";
    };
    CreateCollaboratorResponse: {
      projectId: string;
      email: string;
      /** @enum {string} */
      permissionType: "EDIT" | "VIEW";
      /** Format: date-time */
      createdAt: string;
      /** Format: date-time */
      updatedAt: string;
    };
    CreateServiceDto: {
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
      url: string;
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
          "application/json": components["schemas"]["CreateProjectResponse"];
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
      header: {
        /** @description Email of the user making the request */
        "X-User-Email": string;
      };
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
  ProjectsController_remove: {
    parameters: {
      query?: never;
      header: {
        /** @description Email of the user making the request */
        "X-User-Email": string;
      };
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
        content?: never;
      };
    };
  };
  ProjectsController_update: {
    parameters: {
      query?: never;
      header: {
        /** @description Email of the user making the request */
        "X-User-Email": string;
      };
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
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  CollaboratorsController_create: {
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
        "application/json": components["schemas"]["CreateCollaboratorRequest"];
      };
    };
    responses: {
      /** @description Collaborator updated/created successfully */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CreateCollaboratorResponse"];
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
  ServicesController_findAll: {
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
  ServicesController_create: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateServiceDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  ServicesController_findOne: {
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
}