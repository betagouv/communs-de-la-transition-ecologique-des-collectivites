import { Injectable } from "@nestjs/common";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { QuestionnairesService } from "@/questionnaires/questionnaires.service";
import { calculerStatut, evaluerCondition } from "@/questionnaires/questionnaire-contract";
import { RecommandationBrute, RecommandationSource } from "../recommandation-source";

/**
 * Source « questionnaire » : contribue les recommandations dont la `condition` est
 * satisfaite par les réponses enregistrées.
 *
 * Deux règles, toutes deux côté serveur :
 *  - un questionnaire `non_commence` ne contribue RIEN. Sans cette garde, les
 *    recommandations inconditionnelles (`condition: true`) s'afficheraient avant toute
 *    réponse — la spec l'interdit explicitement (§7).
 *  - les réponses partielles contribuent : on n'attend pas `complet`.
 */
@Injectable()
export class QuestionnaireRecommandationSource implements RecommandationSource {
  readonly type = "questionnaire";

  constructor(private readonly questionnairesService: QuestionnairesService) {}

  async contribuer(projet: ProjetResponse): Promise<RecommandationBrute[]> {
    const { etats } = await this.questionnairesService.etatsPourProjet(projet.id);

    return etats.flatMap(({ def, reponses }) => {
      if (calculerStatut(def, reponses) === "non_commence") return [];

      return def.recommandations
        .filter((reco) => evaluerCondition(reco.condition, reponses))
        .map((reco) => ({
          cle: `${def.slug}:${reco.id}`,
          ref: def.slug,
          libelleSource: def.source.nom,
          icone: reco.icone,
          titre: reco.titre,
          description: reco.description,
          financements: reco.financements,
          ressources: reco.ressources,
          engagement: reco.engagement,
        }));
    });
  }
}
