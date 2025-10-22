/**
 * Type definitions for LLM-based projet qualification
 */

/**
 * Available Anthropic model IDs
 */
export type AnthropicModel = "claude-3-5-haiku-20241022" | "claude-3-7-sonnet-20250219";

/**
 * Levier (lever) classification result from LLM
 */
export interface LeviersLLMResponse {
  projet: string;
  classification:
    | "Le projet n'a pas de lien avec la transition écologique"
    | "Le projet n'est pas assez précis pour être lié ou non à la transition écologique"
    | "Le projet a un lien avec la transition écologique";
  leviers: Record<string, number>; // levier name -> score
}

/**
 * Parsed leviers analysis result
 */
export interface LeviersAnalysisResult {
  json: LeviersLLMResponse;
  raisonnement: string;
  errorMessage?: string;
}

/**
 * Competence result item from LLM
 * Matches Python format from few_shot_exs_competences_V2
 */
export interface CompetenceLLMItem {
  code: string; // M57 code like "90-212" (may be incorrect, validated by post-treatment)
  competence: string; // Full M57 description like "Enseignement du premier degré > Ecoles primaires"
  score: number;
}

/**
 * Competences classification result from LLM
 */
export interface CompetencesLLMResponse {
  projet: string;
  competences: CompetenceLLMItem[];
}

/**
 * Parsed competences analysis result
 */
export interface CompetencesAnalysisResult {
  json: CompetencesLLMResponse;
  errorMessage?: string;
}

/**
 * Cache control configuration for prompt caching
 */
export interface CacheControl {
  type: "ephemeral";
}

/**
 * System message with cache control
 */
export interface SystemMessage {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}
