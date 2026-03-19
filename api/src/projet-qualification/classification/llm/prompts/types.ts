/**
 * Type definitions for classification LLM responses
 * Matches the Python pipeline output format
 */

/**
 * A single classification item returned by the LLM
 */
export interface ClassificationItem {
  label: string;
  score: number;
}

/**
 * Classification result from LLM for a single axis (thematiques, sites, or interventions)
 * Matches Python format: {"projet": "...", "items": [{"label": "...", "score": 0.0}]}
 */
export interface ClassificationLLMResponse {
  projet: string;
  items: ClassificationItem[];
}

/**
 * Parsed classification analysis result
 */
export interface ClassificationAnalysisResult {
  json: ClassificationLLMResponse;
  errorMessage?: string;
}

// Re-use the same Anthropic model type
export type { AnthropicModel } from "@/projet-qualification/llm/prompts/types";
