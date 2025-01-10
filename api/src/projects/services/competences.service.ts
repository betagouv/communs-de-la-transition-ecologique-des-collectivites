import { Injectable } from "@nestjs/common";
import {
  Competence,
  Competences,
  CompetencesWithSousCompetences,
  CompetenceWithSousCompetence,
  SousCompetence,
  SousCompetences,
} from "@/shared/types";
import { competencesWithSousCompetences } from "@/shared/const/competences-list";

@Injectable()
export class CompetencesService {
  splitCompetence(competencesList: CompetencesWithSousCompetences | null | undefined): {
    competences: Competences | null;
    sousCompetences: SousCompetences | null;
  } {
    if (!competencesList?.length) {
      return { competences: null, sousCompetences: null };
    }

    const competences = new Set<Competence>();
    const sousCompetences = new Set<SousCompetence>();

    for (const item of competencesList) {
      const parts = item.split("__");
      const mainCompetence = parts[0];
      const sousCompetence = parts[1];

      competences.add(mainCompetence as Competence);
      if (sousCompetence) {
        sousCompetences.add(sousCompetence as SousCompetence);
      }
    }

    return {
      competences: Array.from(competences),
      sousCompetences: sousCompetences.size ? Array.from(sousCompetences) : null,
    };
  }

  combineCompetences(
    competences: Competences | null,
    sousCompetences: SousCompetences | null,
  ): CompetencesWithSousCompetences | null {
    if (!competences?.length) return null;

    return competences.flatMap((competence) => {
      const relatedSousCompetences = sousCompetences?.filter((sous) => this.isRelated(competence, sous)) ?? [];
      if (!relatedSousCompetences.length) {
        return [competence as CompetenceWithSousCompetence];
      }

      return relatedSousCompetences.map((sous) => {
        const combined = `${competence}__${sous}`;
        return combined as CompetenceWithSousCompetence;
      });
    });
  }

  private isRelated(competence: Competence, sousCompetence: SousCompetence): boolean {
    return competencesWithSousCompetences.some((item) => item === `${competence}__${sousCompetence}`);
  }
}
