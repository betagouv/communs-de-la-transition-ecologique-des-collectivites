import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { servicesNumeriques } from "@database/schema";
import { AidesMatchingService } from "@/aides/aides-matching.service";
import { AideClassification } from "@/aides/dto/aides.dto";
import { AjoutsManuelsService } from "@/ajouts-manuels/ajouts-manuels.service";
import type { AjoutManuel, ServiceLibre } from "@/ajouts-manuels/ajout-manuel-contract";
import { fondreAjouts } from "@/ajouts-manuels/fondre-ajouts";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import {
  facteurPhase,
  SEUIL_PERTINENCE,
  type Categorie,
  type NiveauExpertise,
  type PoidsParPhase,
} from "./service-numerique-contract";
import { ProjetServicesResponse, ServiceResponse } from "./dto/service-numerique.dto";

type LigneCatalogue = typeof servicesNumeriques.$inferSelect;

/**
 * Les logos sont hébergés par l'API et stockés en base comme chemins relatifs
 * (`/logos/services/<slug>.svg`) : le catalogue ne doit pas connaître le domaine sur lequel
 * il tourne. On les rend absolus à la sortie, sinon le client les chercherait sur SON propre
 * domaine. Une URL déjà absolue (logo resté chez un partenaire) est laissée telle quelle.
 *
 * `null` est une valeur légitime : quatre services curés n'ont aucun logo — leur marque est
 * purement typographique (en-tête DSFR texte). On n'en invente pas ; au client d'afficher
 * une tuile texte.
 */
function absolutiser(chemin: string | null, baseUrl: string): string | undefined {
  if (!chemin) return undefined;
  return chemin.startsWith("/") ? `${baseUrl}${chemin}` : chemin;
}

/**
 * `undefined` quand le benchmark ne dit rien — et il se tait souvent : 51 lignes sur 125 ne
 * sont pas renseignées. « Non renseigné » n'est pas « non » : le client doit pouvoir
 * distinguer « ce service ne convient pas à un généraliste » de « on n'en sait rien ».
 */
function ternaireVersBooleen(valeur: string | null): boolean | undefined {
  if (valeur === "oui") return true;
  if (valeur === "non") return false;
  return undefined;
}

@Injectable()
export class ServicesNumeriquesService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly getProjetsService: GetProjetsService,
    private readonly matchingService: AidesMatchingService,
    private readonly ajoutsManuels: AjoutsManuelsService,
  ) {}

  /**
   * Services numériques pertinents pour un projet, prêts à afficher.
   *
   * LE SCORE SEUL DÉCIDE. Aucun repêchage, aucun verrou de curation — exactement comme pour les
   * aides et les questionnaires.
   *
   * POURQUOI AUCUN REPÊCHAGE GÉNÉRIQUE. Le benchmark marque certains services « à présenter dans
   * une présentation générique et peu contextualisée » : c'est une propriété utile pour une page
   * VITRINE (un annuaire, une liste d'accueil), où il n'y a pas de contexte. Une fiche projet est
   * l'exact opposé — elle est le contexte. Les faire remonter ici noyait 4 services parfaitement
   * ciblés sous 50 qui n'avaient rien à voir avec le projet.
   *
   * Une liste vide est une réponse LÉGITIME, et plus utile qu'une liste de remplissage : elle dit
   * « le catalogue n'a rien pour ce projet », ce qui est une information. Un projet de salle des
   * fêtes n'a aucun service numérique dédié, et c'est un fait, pas une panne.
   *
   * `findOneWithSource` : le projet peut vivre dans public.projets, data_mec ou data_tet.
   * Aucun service → 200 avec une liste vide, jamais 404.
   */
  async findForProjet(
    projetId: string,
    baseUrl: string,
    plateforme: string,
    /**
     * Seuil de pertinence, exposé au client (`?seuil=`). Défaut : celui de l'API.
     *
     * Une plateforme peut légitimement vouloir être plus permissive ou plus stricte. Le SEUIL est
     * donc à elle ; le DÉFAUT reste à nous — c'est lui qui fait foi, et c'est lui qu'on règle quand
     * la pertinence est en cause.
     *
     * Le rendre paramétrable, plutôt que de le laisser un client le rejouer de son côté, est ce qui
     * évite l'émulation : c'est l'API qui décide, avec le réglage qu'on lui demande d'appliquer.
     */
    seuil: number = SEUIL_PERTINENCE,
  ): Promise<ProjetServicesResponse> {
    // Trois lectures INDÉPENDANTES sur un chemin chaud (chaque fiche projet) : en série, c'était
    // trois allers-retours là où une vague suffit.
    const [{ projet }, catalogue, ajouts] = await Promise.all([
      this.getProjetsService.findOneWithSource(projetId),
      this.dbService.database.select().from(servicesNumeriques),
      this.ajoutsManuels.actifs(projetId, "service_numerique", plateforme),
    ]);

    const pertinents = this.scorer(projet, catalogue)
      .filter((s) => s.score >= seuil)
      .sort((a, b) => b.score - a.score || a.ligne.nom.localeCompare(b.ligne.nom))
      .map(({ ligne }) => this.toResponse(ligne, baseUrl));

    const parSlug = new Map(catalogue.map((l) => [l.slug, l]));

    return {
      services: fondreAjouts<ServiceResponse>({
        ajouts,
        resoudre: (id, ajout) => {
          // Service HORS catalogue : l'agent l'a décrit lui-même, c'est lui la source.
          if (ajout.horsCatalogue) {
            const service = ajouts.get(id)?.service;
            return service ? this.libreVersResponse(id, service, ajout) : undefined;
          }
          // Service DU catalogue : sa fiche reste la source de vérité. On ne recopie rien.
          const ligne = parSlug.get(id);
          return ligne ? { ...this.toResponse(ligne, baseUrl), ajoutManuel: ajout } : undefined;
        },
        duMoteur: pertinents,
        idDe: (s) => s.id,
        nomDe: (s) => s.nom,
      }),
    };
  }

  /**
   * Un service saisi à la main par un agent.
   *
   * `categories` sort VIDE : on ne connaît pas la nature de ce service, et on ne la demande pas —
   * c'est une donnée d'affichage facultative, pas une condition d'existence.
   *
   * `logoUrl` n'est PAS absolutisé : l'API n'héberge que les logos du catalogue. Une URL fournie
   * par un agent est déjà absolue, ou elle n'est rien.
   */
  private libreVersResponse(id: string, s: ServiceLibre, ajout: AjoutManuel): ServiceResponse {
    return {
      id,
      nom: s.nom,
      description: s.description,
      categories: [],
      logoUrl: s.logoUrl,
      operateur: s.operateur,
      redirection: s.url ? { url: s.url, libelle: s.libelleLien } : undefined,
      ajoutManuel: ajout,
    };
  }

  /**
   * Score de pertinence = score de matching sur les trois axes (le MÊME moteur que les aides
   * et les questionnaires), modulé par la phase du projet.
   *
   * Un projet non classifié (le job LLM n'a pas tourné) donne un score nul à tout le monde, donc
   * une liste vide. C'est voulu : on ne sait rien de ce projet, on n'a donc rien à en dire. Le
   * masquer derrière une liste de services de remplissage ferait passer une donnée manquante
   * pour un résultat.
   */
  private scorer(projet: ProjetResponse, lignes: LigneCatalogue[]): { ligne: LigneCatalogue; score: number }[] {
    const scoresProjet = projet.classificationScores;
    if (!scoresProjet) return lignes.map((ligne) => ({ ligne, score: 0 }));

    const parSlug = new Map<string, AideClassification>(lignes.map((l) => [l.slug, l.classification]));
    const matches = new Map(
      this.matchingService.match(scoresProjet, parSlug, lignes.length).map((m) => [m.idAt, m.normalizedScore]),
    );

    return lignes.map((ligne) => {
      const brut = matches.get(ligne.slug) ?? 0;
      return { ligne, score: brut * facteurPhase(ligne.phases as PoidsParPhase, projet.phase) };
    });
  }

  /**
   * Projection vers le contrat public.
   *
   * Les CRITÈRES DE SÉLECTION ne franchissent jamais la frontière : `classification`, `phases` et
   * `presentationGenerique` n'ont aucun équivalent dans le DTO (§1 et §9 de la spec).
   *
   * `thematiques` en faisait partie sans qu'on le voie : c'était la classification, exposée sous
   * forme de libellés. Le contrat se contredisait donc lui-même. Retiré — un client qui l'aurait
   * affichée aurait montré à une collectivité les entrailles du moteur de sélection, et non une
   * information sur le service.
   *
   * `profilGeneraliste`, lui, est exposé — parce que ce n'en est plus un : il ne décide plus
   * de rien côté serveur, il décrit le service (utilisable par un non-spécialiste ?) au même
   * titre que `niveauExpertise`. Le client peut donc filtrer dessus sans dupliquer de règle.
   */
  private toResponse(l: LigneCatalogue, baseUrl: string): ServiceResponse {
    return {
      id: l.slug,
      nom: l.nom,
      baseline: l.baseline ?? undefined,
      description: l.description ?? "",
      descriptionLongue: l.descriptionLongue ?? undefined,
      logoUrl: absolutiser(l.logoUrl, baseUrl),
      categories: l.categories as Categorie[],
      niveauExpertise: (l.niveauExpertise as NiveauExpertise | null) ?? undefined,
      profilGeneraliste: ternaireVersBooleen(l.profilGeneraliste),
      operateur: l.operateur ?? undefined,
      redirection: l.redirectionUrl ? { url: l.redirectionUrl, libelle: l.redirectionLibelle ?? undefined } : undefined,
      iframe: l.iframeUrl ? { url: l.iframeUrl, libelle: l.iframeLibelle ?? undefined } : undefined,
    };
  }
}
