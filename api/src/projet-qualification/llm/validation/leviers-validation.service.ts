import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { Levier } from "@/shared/types";
import { leviers as LEVIERS_LIST } from "@/shared/const/leviers";
import { LeviersLLMResponse } from "../prompts/types";
import { LevierDto } from "@/projet-qualification/dto/projet-qualification.dto";

/**
 * Leviers corrections mapping - from Python implementation
 * Maps common variations and typos to canonical levier names
 */
const CORRECTIONS_LEVIERS: Record<string, string> = {
  // Base corrections for accents and common variations
  "Électricité renouvelable": "Electricité renouvelable",
  "Énergies renouvelables": "Electricité renouvelable",
  "Solaire photovoltaïque": "Electricité renouvelable",

  // Agriculture
  "Élevage durable": "Elevage durable",
  "Agriculture biologique": "Développement de l'agriculture biologique et de HVE",
  "Agriculture biologique et de HVE": "Développement de l'agriculture biologique et de HVE",
  "Agriculture biologique et HVE": "Développement de l'agriculture biologique et de HVE",
  "Développement de l'agriculture biologique": "Développement de l'agriculture biologique et de HVE",
  "Développement de l'agriculture biologique et HVE": "Développement de l'agriculture biologique et de HVE",
  HVE: "Développement de l'agriculture biologique et de HVE",
  "Bâtiments & Machines": "Bâtiments & Machines agricoles",
  "Gestion des bâtiments & machines": "Bâtiments & Machines agricoles",
  "Agriculture durable": "Développement de l'agriculture biologique et de HVE",
  "Changements des pratiques agricoles": "Développement de l'agriculture biologique et de HVE",

  // Déchets
  "Collecte et tri des déchets": "Augmentation du taux de collecte",
  "Prévention déchets": "Prévention des déchets",
  "Réduction des déchets": "Prévention des déchets",
  "Sobriété déchets": "Prévention des déchets",
  "Sobriété des déchets": "Prévention des déchets",
  "Gestion des déchets": "Prévention des déchets",

  // Mobility and transport
  "2 roues (élec & efficacité)": "2 roues (élec&efficacité)",
  "Deux roues (élec & efficacité)": "2 roues (élec&efficacité)",
  "Transport en commun": "Transports en commun",
  "Transport décarboné": "Fret décarboné et multimodalité",
  "Véhicules électriques et hybrides": "Véhicules électriques",
  "Véhicules à faibles émissions": "Véhicules électriques",
  "Véhicules (élec & efficacité)": "Véhicules électriques",
  "Véhicules électriques (autre aspect)": "Véhicules électriques",
  "Modes actifs": "Vélo",
  "Mobilités douces": "Vélo",
  "Mobilité douce": "Vélo",

  // Réduction des déplacements
  "Réduction des émissions de CO2 liées aux déplacements": "Réduction des déplacements",
  "Réduction des déplacements (sensibilisation)": "Réduction des déplacements",
  "Réduction des déplacements (consommer local)": "Réduction des déplacements",
  "Réduction des déplacements (connexion)": "Réduction des déplacements",
  "Réduction des déplacements (communication)": "Réduction des déplacements",
  "Réduction des déplacements (mobilité optimisée)": "Réduction des déplacements",
  "Réduction des déplacements professionnels": "Réduction des déplacements",
  "Réduction de l'usage des déplacements": "Réduction des déplacements",
  "Réduction de l'usage des véhicules privés": "Réduction des déplacements",
  "Réduction des émissions de transport": "Réduction des déplacements",
  "Réduction des émissions du transport": "Réduction des déplacements",

  // Industrie
  "Efficacité énergétique des sites industriels": "Industrie diffuse",
  "Industrie et efficacité énergétique": "Industrie diffuse",
  "Industrie (efficacité énergétique)": "Industrie diffuse",
  "Efficacité énergétique des process": "Industrie diffuse",
  "Efficacité énergétique des installations": "Industrie diffuse",

  // Réno et sobriété bâtiments
  "Rénovation (tertiaire)": "Rénovation (hors changement chaudières)",
  Rénovation: "Rénovation (hors changement chaudières)",
  "Rénovation (résidentiel)": "Rénovation (hors changement chaudières)",
  "Efficacité énergétique des bâtiments tertiaires": "Sobriété des bâtiments (tertiaire)",
  "Efficacité énergétique des bâtiments (tertiaire)": "Sobriété des bâtiments (tertiaire)",
  "Performance énergétique des bâtiments (tertiaire)": "Sobriété des bâtiments (tertiaire)",
  "Sobriété des bâtiments": "Sobriété des bâtiments (résidentiel)",

  // Vehicules privés
  "Efficacité des véhicules privés": "Efficacité énergétique des véhicules privés",
  "Efficacité énergétique des véhicules": "Efficacité énergétique des véhicules privés",
  "Réduction des émissions des véhicules": "Efficacité énergétique des véhicules privés",

  // Logistics
  "Sobriété logistique et efficacité": "Efficacité et sobriété logistique",
  "Sobriété logistique": "Efficacité et sobriété logistique",
  "Efficacité logistique et sobriété": "Efficacité et sobriété logistique",

  // Protected areas and biodiversity
  "Résorption des points noirs de continuité écologique":
    "Résorption des points noirs prioritaires de continuité écologique",
  "Superficie en aire protégée": "Surface en aire protégée",
  "9. Surface en aire protégée": "Surface en aire protégée",
  "Restoration des habitats naturels": "Restauration des habitats naturels",
  "Artificialisation des sols": "Sobriété foncière",

  // Eau
  "Sobriété dans l'utilisation de la ressource": "Sobriété dans l'utilisation de la ressource en eau",
  "Réutilisation des eaux usées": "Sobriété dans l'utilisation de la ressource en eau",
  "Réutilisation des eaux usées traitées (REUT)": "Sobriété dans l'utilisation de la ressource en eau",
  "Récupération d'eau de pluie": "Sobriété dans l'utilisation de la ressource en eau",

  // Wood and construction
  "Respect d'Egalim": "Respect d'Egalim pour la restauration collective",
  "Bois construction et commande publique": "Gestion des forêts et produits bois",
  "Construction bois": "Gestion des forêts et produits bois",

  // Biofuels
  Biocaburants: "Bio-carburants",
  Biocarburants: "Bio-carburants",
};

/**
 * Service for validating and correcting leviers analysis results
 */
@Injectable()
export class LeviersValidationService {
  constructor(private readonly logger: CustomLogger) {}

  /**
   * Validate and correct leviers from LLM response
   * Applies corrections, filters invalid leviers, and sorts by score
   * @param response Raw LLM response
   * @param scoreThreshold Minimum score to keep (default 0.7)
   * @returns Corrected and filtered list of leviers with their scores
   */
  validateAndCorrect(response: LeviersLLMResponse, scoreThreshold = 0.7): LevierDto[] {
    this.logger.log("Validating and correcting leviers");

    const correctedLeviers: Record<string, number> = {};

    // Apply corrections and validate each levier
    for (const [levierName, score] of Object.entries(response.leviers)) {
      // Apply correction if exists
      const correctedName = CORRECTIONS_LEVIERS[levierName] || levierName;

      // Validate levier exists in canonical list
      if (this.isValidLevier(correctedName)) {
        // Keep highest score if duplicate after correction
        if (!correctedLeviers[correctedName] || correctedLeviers[correctedName] < score) {
          correctedLeviers[correctedName] = score;
        }
      } else {
        this.logger.warn(`Invalid levier detected and removed: "${levierName}" -> "${correctedName}"`);
      }
    }

    // Filter by score threshold and sort
    const filteredLeviers = Object.entries(correctedLeviers)
      .filter(([, score]) => score > scoreThreshold)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([name, score]) => ({ nom: name as Levier, score }));

    this.logger.log(`Validated ${filteredLeviers.length} leviers above threshold ${scoreThreshold}`);

    return filteredLeviers;
  }

  /**
   * Check if a levier name is valid
   * @param levierName Name to check
   * @returns True if valid
   */
  private isValidLevier(levierName: string): levierName is Levier {
    return LEVIERS_LIST.includes(levierName as Levier);
  }

  /**
   * Get all valid levier names
   * @returns Array of valid levier names
   */
  getValidLeviers(): readonly Levier[] {
    return LEVIERS_LIST;
  }

  /**
   * Get correction mapping for a specific levier
   * @param levierName Name to check
   * @returns Corrected name if mapping exists, otherwise original name
   */
  getCorrectedName(levierName: string): string {
    return CORRECTIONS_LEVIERS[levierName] || levierName;
  }
}
