import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { AjoutsManuelsService } from "@/ajouts-manuels/ajouts-manuels.service";
import { fondreAjouts } from "@/ajouts-manuels/fondre-ajouts";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMoteurService } from "./aides-moteur.service";
import { AidesPerimetreService } from "./aides-perimetre.service";
import { AideWithClassification, AidesListResponse } from "./dto/aides.dto";

/**
 * « Quelles aides pour ce projet ? » — LA réponse de l'API, en un seul endroit.
 *
 * Cette orchestration vivait dans AidesController. Extraite parce qu'elle a désormais DEUX
 * appelants : `GET /aides`, et l'aperçu du back-office.
 *
 * ET C'EST TOUT L'ENJEU. Le back-office ne doit pas ÉMULER l'API : il doit montrer ce qu'elle
 * renvoie RÉELLEMENT. Une reconstitution, même fidèle au départ, finit par diverger — et un outil
 * qui ment sur ce que voit la collectivité est pire que pas d'outil du tout. Il appelle donc
 * exactement cette fonction, celle qui sert MEC.
 *
 * Le cas « projet non classifié » (202 + relance du job) reste au contrôleur : il touche au code
 * HTTP et à la file d'attente, pas au contenu.
 */

export interface ParametresAides {
  maxResults: number;
  cutoff: number;
  thresholds: { projet?: number; aide?: number };
  textualEnabled: boolean;
  /** Texte de la recherche textuelle. Par défaut « nom + description » du projet. */
  textualText?: string;
}

@Injectable()
export class AidesProjetService {
  constructor(
    private readonly projetsService: GetProjetsService,
    private readonly perimetreService: AidesPerimetreService,
    private readonly classificationService: AideClassificationService,
    private readonly moteur: AidesMoteurService,
    private readonly ajoutsManuels: AjoutsManuelsService,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * `plateforme` vient de la clé d'API de l'appelant : les ajouts manuels sont CLOISONNÉS par
   * plateforme, et MEC ne doit pas voir ceux d'une autre. Le back-office doit donc dire au nom de
   * QUI il regarde — sinon il montrerait une liste que personne ne reçoit.
   */
  async pourProjet(projetId: string, plateforme: string, params: ParametresAides): Promise<AidesListResponse> {
    const { projet } = await this.projetsService.findOneWithSource(projetId);

    // Un projet non classifié ne matche rien. Le contrôleur, lui, en fait un 202 et relance le job.
    if (!projet.classificationScores) {
      return { status: "no_match", aides: [], total: 0 };
    }

    const codesInsee = this.perimetreService.extractCodesInsee(projet.collectivites);
    if (codesInsee.length === 0) {
      this.logger.warn(`Projet ${projetId} sans commune à code INSEE : aides récupérées sans filtre de territoire.`);
    }

    const [allAides, ajouts] = await Promise.all([
      this.perimetreService.fetchAidesForPerimeterCodes(codesInsee),
      this.ajoutsManuels.actifs(projetId, "aide", plateforme),
    ]);

    if (allAides.length === 0) {
      return { status: "no_aides_on_perimeter", aides: [], total: 0 };
    }

    const classifications = await this.classificationService.getCachedClassifications(
      allAides.map((a) => String(a.id)),
    );

    const reponse = this.moteur.classer(projet.classificationScores, allAides, classifications, {
      ...params,
      textualText: params.textualText ?? `${projet.nom} ${projet.description ?? ""}`,
    });

    // La fusion s'applique SUR le résultat du moteur : le moteur reste un pur scoreur/classeur, que
    // POST /aides/recherche partage sans rien savoir des ajouts manuels.
    const parId = new Map(allAides.map((a) => [String(a.id), a]));
    const aides = fondreAjouts<AideWithClassification>({
      ajouts,
      resoudre: (idAt, ajout) => {
        const aide = parId.get(idAt);
        // Aide clôturée ou dépubliée depuis l'ajout : on ne sait plus la résoudre, et on ne fabrique
        // rien. Mieux vaut ne rien montrer qu'envoyer candidater à une aide morte.
        return aide ? { ...aide, classification: classifications.get(idAt), ajoutManuel: ajout } : undefined;
      },
      duMoteur: reponse.aides,
      idDe: (a) => String(a.id),
      nomDe: (a) => a.name,
    });

    if (aides.length === 0) return { status: "no_match", aides: [], total: allAides.length };
    return { status: "ok", aides, total: allAides.length };
  }
}
