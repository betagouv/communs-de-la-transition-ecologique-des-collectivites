import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { CustomLogger } from "@logging/logger.service";
import { AnthropicModel, ClassificationAnalysisResult, ClassificationLLMResponse } from "./prompts/types";
import { SYSTEM_PROMPT_CLASSIFICATION } from "./prompts/classification-base.prompts";
import { USER_PROMPT_THEMATIQUES, USER_PROMPT_THEMATIQUES_AIDE } from "./prompts/thematiques.prompts";
import { USER_PROMPT_SITES, USER_PROMPT_SITES_AIDE } from "./prompts/sites.prompts";
import { USER_PROMPT_INTERVENTIONS, USER_PROMPT_INTERVENTIONS_AIDE } from "./prompts/interventions.prompts";

/**
 * Service for classifying projects/aides using Anthropic Claude API
 * Makes 3 independent LLM calls (thematiques, sites, interventions)
 * Prompt structure aligned with Python pipeline (llm_final_*.py)
 */
@Injectable()
export class ClassificationAnthropicService {
  private readonly client: Anthropic;
  private readonly defaultModel: AnthropicModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    const nodeEnv = this.configService.get<string>("NODE_ENV");

    if (!apiKey && nodeEnv !== "test") {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey: apiKey ?? "test-api-key",
    });

    this.defaultModel = this.configService.get<AnthropicModel>("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";
  }

  async analyzeThematiques(context: string, type: "projet" | "aide" = "projet"): Promise<ClassificationAnalysisResult> {
    const userPrompt = type === "aide" ? USER_PROMPT_THEMATIQUES_AIDE : USER_PROMPT_THEMATIQUES;
    return this.analyze(context, userPrompt, type, "thematiques");
  }

  async analyzeSites(context: string, type: "projet" | "aide" = "projet"): Promise<ClassificationAnalysisResult> {
    const userPrompt = type === "aide" ? USER_PROMPT_SITES_AIDE : USER_PROMPT_SITES;
    return this.analyze(context, userPrompt, type, "sites");
  }

  async analyzeInterventions(
    context: string,
    type: "projet" | "aide" = "projet",
  ): Promise<ClassificationAnalysisResult> {
    const userPrompt = type === "aide" ? USER_PROMPT_INTERVENTIONS_AIDE : USER_PROMPT_INTERVENTIONS;
    return this.analyze(context, userPrompt, type, "interventions");
  }

  private async analyze(
    context: string,
    userPrompt: string,
    type: "projet" | "aide",
    axis: string,
  ): Promise<ClassificationAnalysisResult> {
    this.logger.log(`Analyzing ${axis} for ${type} context`);

    // Context label matches Python: "Projet :" or "Aide :"
    const contextLabel = type === "aide" ? "Aide" : "Projet";

    try {
      const message = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 4096,
        temperature: 0.4,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT_CLASSIFICATION,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              // Part 1: User prompt with labels list + rules (cached)
              {
                type: "text",
                text: userPrompt,
                cache_control: { type: "ephemeral" },
              },
              // Part 2: Context (not cached - changes every request)
              {
                type: "text",
                text: `${contextLabel} :\n- "${context}"`,
              },
            ],
          },
        ],
      });

      const textContent = message.content.find((block) => block.type === "text");
      if (textContent?.type !== "text") {
        throw new Error("No text content in Anthropic response");
      }

      return this.parseResponse(textContent.text, context);
    } catch (error) {
      this.logger.error(`Error analyzing ${axis}`, {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        json: {
          projet: context,
          items: [],
        },
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Parse raw JSON response from Claude
   * Matches Python extract_json(): tries direct parse, then regex fallback
   * Prompt says "Aucun texte hors JSON" so response should be pure JSON
   */
  private parseResponse(response: string, context: string): ClassificationAnalysisResult {
    // Try direct JSON parse (expected case: response is pure JSON)
    const trimmed = this.stripMarkdownCodeBlock(response.trim());

    try {
      const jsonData = JSON.parse(trimmed) as ClassificationLLMResponse;
      return { json: jsonData };
    } catch {
      // Fallback: extract JSON block via regex (matching Python's re.findall pattern)
      const jsonCandidates = trimmed.match(/\{[\s\S]*\}/g);
      if (jsonCandidates) {
        for (const block of jsonCandidates) {
          try {
            const jsonData = JSON.parse(block) as ClassificationLLMResponse;
            return { json: jsonData };
          } catch {
            // Try next candidate
          }
        }
      }

      this.logger.error("Failed to parse JSON from LLM response", { response: trimmed.slice(0, 500) });
      return {
        json: { projet: context, items: [] },
        errorMessage: "Failed to parse JSON from LLM response",
      };
    }
  }

  /**
   * Strip markdown code block markers if present
   * Matches Python: text.startswith("```json") / text.endswith("```")
   */
  private stripMarkdownCodeBlock(text: string): string {
    let result = text;
    if (result.startsWith("```json")) {
      result = result.slice(7);
    } else if (result.startsWith("```")) {
      result = result.slice(3);
    }
    if (result.endsWith("```")) {
      result = result.slice(0, -3);
    }
    return result.trim();
  }
}
