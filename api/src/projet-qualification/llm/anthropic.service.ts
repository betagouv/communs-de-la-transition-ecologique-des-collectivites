import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { CustomLogger } from "@logging/logger.service";
import {
  AnthropicConfig,
  AnthropicModel,
  LeviersAnalysisResult,
  CompetencesAnalysisResult,
  LeviersLLMResponse,
  CompetencesLLMResponse,
} from "./prompts/types";
import { SYSTEM_PROMPT_CLASSIFICATION_TE, USER_PROMPT_CLASSIFICATION_TE } from "./prompts/leviers.prompts";
import { SYSTEM_PROMPT_COMPETENCES, USER_PROMPT_COMPETENCES } from "./prompts/competences.prompts";

/**
 * Service for interacting with Anthropic Claude API
 * Handles leviers and competences analysis using LLM
 */
@Injectable()
export class AnthropicService {
  private readonly client: Anthropic;
  private readonly defaultModel: AnthropicModel;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    const nodeEnv = this.configService.get<string>("NODE_ENV");

    // Allow missing API key in test environment
    if (!apiKey && nodeEnv !== "test") {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey: apiKey ?? "test-api-key",
    });

    // Default model from env or fallback to haiku
    this.defaultModel = this.configService.get<AnthropicModel>("ANTHROPIC_MODEL") ?? "claude-3-5-haiku-20241022";

    this.logger.log(`Anthropic service initialized with model: ${this.defaultModel}`);
  }

  /**
   * Analyze project context for leviers classification
   * @param context Project name and description
   * @param model Optional model override
   * @returns Parsed leviers analysis result
   */
  async analyzeLeviers(context: string, model?: AnthropicModel): Promise<LeviersAnalysisResult> {
    this.logger.log("Analyzing leviers for project context");

    const config: AnthropicConfig = {
      model: model ?? this.defaultModel,
      maxTokens: 1024,
      temperature: 0.3,
      systemMessages: [
        {
          type: "text",
          text: SYSTEM_PROMPT_CLASSIFICATION_TE,
          cache_control: { type: "ephemeral" },
        },
      ],
      userPrompt: `${USER_PROMPT_CLASSIFICATION_TE}\n\n<projet>${context}</projet>`,
    };

    try {
      const response = await this.callAnthropic(config);
      return this.parseLeviersResponse(response);
    } catch (error) {
      this.logger.error("Error analyzing leviers", {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        json: {
          projet: context,
          classification: "Le projet n'est pas assez précis pour être lié ou non à la transition écologique",
          leviers: {},
        },
        raisonnement: "",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Analyze project context for competences classification
   * @param context Project name and description
   * @param model Optional model override
   * @returns Parsed competences analysis result
   */
  async analyzeCompetences(context: string, model?: AnthropicModel): Promise<CompetencesAnalysisResult> {
    this.logger.log("Analyzing competences for project context");

    const config: AnthropicConfig = {
      model: model ?? this.defaultModel,
      maxTokens: 1024,
      temperature: 0.5,
      systemMessages: [
        {
          type: "text",
          text: SYSTEM_PROMPT_COMPETENCES,
          cache_control: { type: "ephemeral" },
        },
      ],
      userPrompt: `${USER_PROMPT_COMPETENCES}\n\n<projet>${context}</projet>`,
    };

    try {
      const response = await this.callAnthropic(config);
      return this.parseCompetencesResponse(response);
    } catch (error) {
      this.logger.error("Error analyzing competences", {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      return {
        json: {
          projet: context,
          competences: [],
        },
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Call Anthropic API with given configuration
   * @param config Anthropic API configuration
   * @returns Raw response text from Claude
   */
  private async callAnthropic(config: AnthropicConfig): Promise<string> {
    this.logger.log(`Calling Anthropic API with model ${config.model}`);

    const message = await this.client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: config.systemMessages,
      messages: [
        {
          role: "user",
          content: config.userPrompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Anthropic response");
    }

    return textContent.text;
  }

  /**
   * Parse leviers response from Claude
   * Extracts JSON and reasoning sections using regex
   * @param response Raw response text
   * @returns Parsed leviers result
   */
  private parseLeviersResponse(response: string): LeviersAnalysisResult {
    this.logger.log("Parsing leviers response");

    // Extract JSON using regex
    const jsonMatch = /<json>(.*?)<\/json>/s.exec(response);
    if (!jsonMatch) {
      throw new Error("No JSON block found in response");
    }

    // Extract reasoning using regex
    const raisonnementMatch = /<raisonnement>(.*?)<\/raisonnement>/s.exec(response);
    const raisonnement = raisonnementMatch ? raisonnementMatch[1].trim() : "";

    // Parse JSON
    const jsonData = JSON.parse(jsonMatch[1].trim()) as LeviersLLMResponse;

    return {
      json: jsonData,
      raisonnement,
    };
  }

  /**
   * Parse competences response from Claude
   * Extracts JSON section using regex
   * @param response Raw response text
   * @returns Parsed competences result
   */
  private parseCompetencesResponse(response: string): CompetencesAnalysisResult {
    this.logger.log("Parsing competences response");

    // Extract JSON using regex
    const jsonMatch = /<json>(.*?)<\/json>/s.exec(response);
    if (!jsonMatch) {
      throw new Error("No JSON block found in response");
    }

    // Parse JSON
    const jsonData = JSON.parse(jsonMatch[1].trim()) as CompetencesLLMResponse;

    return {
      json: jsonData,
    };
  }
}
