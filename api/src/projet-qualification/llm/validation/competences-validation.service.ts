import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { CompetenceCode } from "@/shared/types";
import { COMPETENCES_HIERARCHY } from "../prompts/competences.prompts";
import { CompetencesLLMResponse } from "../prompts/types";
import { competencesFromM57Referentials } from "@/shared/const/competences-list";

/**
 * Competences corrections mapping - from Python implementation
 * Maps incorrect competence descriptions to their correct M57 forms
 */
const CORRECTIONS_COMPETENCES: Record<string, string> = {
  // Common writing variations
  "Action en matière de gestion des eaux": "Actions en matière de gestion des eaux",
  "Action sociale": "Action sociale > Autres",
  "Actions en matière de gestion des déchets":
    "Actions déchets et propreté urbaine > Collecte et traitement des déchets",
  "Industries, commerce et artisanat":
    "Action économique / Actions sectorielles > Développement économique industriel et commercial",
  "Industry, commerce et artisanat":
    "Action économique / Actions sectorielles > Développement économique industriel et commercial",
  "Infrastructure de transport": "Infrastructures de transport",
  "Transport publics (hors scolaire)": "Transports publics de voyageurs",
  Transports: "Transports publics de voyageurs",

  // Specific competence variations from Python
  "Égalité des chances": "Action sociale > Egalité des chances",
  "Équipement public": "Aménagement et services urbains > Autres",
  "Média et communication": "Culture > Communication",
  "Espaces publics": "Aménagement et services urbains > Espaces publics et naturels",
  Friche: "Aménagement et services urbains > Opérations d'aménagement",
  Friches: "Aménagement et services urbains > Opérations d'aménagement",
  "Innovation, créativité et recherche": "Action économique / Actions sectorielles > Recherche et innovation",
  "Innovations, créativité et recherche": "Action économique / Actions sectorielles > Recherche et innovation",
  "Économie sociale et solidaire": "Action économique / Insertion économique et économie sociale, solidaire",
  "Economie sociale et solidaire": "Action économique / Insertion économique et économie sociale, solidaire",
  "Économie locale et circuits courts": "Action économique / Insertion économique et économie sociale, solidaire",
  "Economie locale et circuits courts": "Action économique / Insertion économique et économie sociale, solidaire",
  "Circuits courts": "Action économique / Insertion économique et économie sociale, solidaire",

  // Agriculture variations
  "Agriculture péri-urbaine": "Agriculture et pêche > Production agricole",
  "Production agricole et foncier": "Agriculture et pêche > Production agricole",

  // Eau variations
  "Eau de surface": "Actions en matière de gestion des eaux > Autres",

  // Social variations
  Inclusion: "Action sociale > Cohésion sociale",
  "Inclusion sociale": "Action sociale > Cohésion sociale",
  "Cohésion sociale et inclusion": "Action sociale > Cohésion sociale",
  "Dialogue territorial et inclusion": "Action sociale > Cohésion sociale",
  Précarité: "Action sociale > Lutte contre la précarité",
  "Précarité et aide alimentaire": "Action sociale > Lutte contre la précarité",
};

/**
 * Result of competence validation with code assignment
 */
export interface ValidatedCompetence {
  code: CompetenceCode;
  competence: string;
  score: number;
}

/**
 * Service for validating and correcting competences analysis results
 * Implements Python's post_treatment_competences_V2 logic
 */
@Injectable()
export class CompetencesValidationService {
  private readonly descToCode: Map<string, CompetenceCode>;

  constructor(private readonly logger: CustomLogger) {
    // Build reverse mapping from M57 description to code (Python: desc_to_code = {v: k for k, v in competences_dict.items()})
    this.descToCode = new Map(
      Object.entries(competencesFromM57Referentials).map(([code, description]) => [
        description,
        code as CompetenceCode,
      ]),
    );
  }

  /**
   * Validate and correct competences from LLM response
   * Implements Python's post_treatment_competences_V2 logic
   * @param response Raw LLM response
   * @param scoreThreshold Minimum score to keep (default 0.7)
   * @returns Validated competences with codes
   */
  validateAndCorrect(response: CompetencesLLMResponse, scoreThreshold = 0.7): ValidatedCompetence[] {
    this.logger.log("Validating and correcting competences");

    const validatedCompetences: ValidatedCompetence[] = [];

    for (const item of response.competences) {
      // Python logic: code = comp.get("code"), desc = comp.get("competence")
      const llmCode = item.code; // LLM-provided code (may be wrong)
      let competenceDesc = item.competence; // Full M57 description (this is trusted)

      // Apply corrections to competence description
      if (CORRECTIONS_COMPETENCES[competenceDesc]) {
        const originalDesc = competenceDesc;
        competenceDesc = CORRECTIONS_COMPETENCES[competenceDesc];
        this.logger.log(`Applied correction: "${originalDesc}" -> "${competenceDesc}"`);
      }

      // Python logic: Priority is given to description over code
      // If description exists in M57 dictionary, use its code
      if (this.descToCode.has(competenceDesc)) {
        const correctCode = this.descToCode.get(competenceDesc)!;
        validatedCompetences.push({
          code: correctCode,
          competence: competenceDesc,
          score: item.score,
        });
        this.logger.log(`Validated competence: "${competenceDesc}" with code ${correctCode}`);
      } else {
        // Description not found in M57 - log warning and skip
        this.logger.warn(
          `Invalid competence description (not in M57 referentials): "${competenceDesc}". LLM code was: "${llmCode}". Skipping.`,
        );
      }
    }

    // Filter by threshold and sort by score descending
    const filteredCompetences = validatedCompetences
      .filter((c) => c.score > scoreThreshold)
      .sort((a, b) => b.score - a.score);

    this.logger.log(`Validated ${filteredCompetences.length} competences above threshold ${scoreThreshold}`);

    return filteredCompetences;
  }

  /**
   * Get all valid M57 competence descriptions
   * @returns Array of valid M57 descriptions
   */
  getValidCompetences(): string[] {
    return Array.from(this.descToCode.keys());
  }

  /**
   * Get competence code from description
   * @param description Full M57 competence description
   * @returns M57 competence code or undefined if not found
   */
  getCodeFromDescription(description: string): CompetenceCode | undefined {
    return this.descToCode.get(description);
  }

  /**
   * Get competences hierarchy (for reference/display purposes)
   * @returns Full competences hierarchy object
   */
  getHierarchy(): Record<string, string[]> {
    return { ...COMPETENCES_HIERARCHY };
  }
}
