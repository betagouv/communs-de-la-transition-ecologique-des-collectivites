import { ClassificationAnthropicService } from "./classification-anthropic.service";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";

describe("ClassificationAnthropicService", () => {
  let service: ClassificationAnthropicService;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as CustomLogger;

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === "ANTHROPIC_API_KEY") return "test-key";
      if (key === "NODE_ENV") return "test";
      if (key === "CLASSIFICATION_MODEL") return undefined;
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassificationAnthropicService(mockConfig, mockLogger);
  });

  // Access private methods for testing
  const callParseResponse = (svc: ClassificationAnthropicService, response: string, context = "test") => {
    return (svc as never as { parseResponse: (r: string, c: string) => unknown }).parseResponse(response, context);
  };

  const callExtractJsonObjects = (svc: ClassificationAnthropicService, text: string) => {
    return (svc as never as { extractJsonObjects: (t: string) => string[] }).extractJsonObjects(text);
  };

  describe("extractJsonObjects", () => {
    it("should extract a single JSON object", () => {
      const text = '{"projet": "test", "items": []}';
      const result = callExtractJsonObjects(service, text);
      expect(result).toEqual(['{"projet": "test", "items": []}']);
    });

    it("should extract multiple JSON objects from text with content between them", () => {
      const text = `{"a": 1}

Some text in between

{"b": 2}`;
      const result = callExtractJsonObjects(service, text);
      expect(result).toHaveLength(2);
      expect(JSON.parse(result[0])).toEqual({ a: 1 });
      expect(JSON.parse(result[1])).toEqual({ b: 2 });
    });

    it("should handle nested braces correctly", () => {
      const text = '{"items": [{"label": "test", "score": 0.9}]}';
      const result = callExtractJsonObjects(service, text);
      expect(result).toHaveLength(1);
      expect(JSON.parse(result[0])).toEqual({ items: [{ label: "test", score: 0.9 }] });
    });

    it("should handle braces inside strings", () => {
      const text = '{"name": "value with { braces }", "score": 1}';
      const result = callExtractJsonObjects(service, text);
      expect(result).toHaveLength(1);
      expect(JSON.parse(result[0])).toEqual({ name: "value with { braces }", score: 1 });
    });

    it("should handle escaped quotes inside strings", () => {
      const text = '{"name": "value with \\"quotes\\"", "score": 1}';
      const result = callExtractJsonObjects(service, text);
      expect(result).toHaveLength(1);
      const parsed = JSON.parse(result[0]) as { score: number };
      expect(parsed.score).toBe(1);
    });

    it("should return empty array when no JSON objects found", () => {
      const result = callExtractJsonObjects(service, "just plain text");
      expect(result).toEqual([]);
    });
  });

  describe("parseResponse", () => {
    it("should parse clean JSON response", () => {
      const response = '{"projet": "test", "items": [{"label": "A", "score": 0.9}]}';
      const result = callParseResponse(service, response) as { json: { items: unknown[] } };
      expect(result.json.items).toHaveLength(1);
    });

    it("should parse JSON wrapped in markdown code block", () => {
      const response = '```json\n{"projet": "test", "items": [{"label": "A", "score": 0.9}]}\n```';
      const result = callParseResponse(service, response) as { json: { items: unknown[] } };
      expect(result.json.items).toHaveLength(1);
    });

    it("should take the LAST valid JSON when LLM self-corrects", () => {
      // This is the exact pattern from the production logs
      const response = `{
  "projet": "Soutenir les collectivités aux usages numériques",
  "items": [
    {"label": "Outillage (notamment numérique)", "score": 0.85},
    {"label": "Structuration du financement", "score": 0.55},
    {"label": "Sécurité / Vidéoprotection", "score": 0.0}
  ]
}
\`\`\`

Correction - uniquement les modalités autorisées :

\`\`\`json
{
  "projet": "Soutenir les collectivités aux usages numériques",
  "items": [
    {"label": "Outillage (notamment numérique)", "score": 0.85},
    {"label": "Structuration du financement", "score": 0.55}
  ]
}`;

      const result = callParseResponse(service, response) as {
        json: { items: { label: string; score: number }[] };
        errorMessage?: string;
      };

      // Should parse the LAST valid JSON (the correction)
      expect(result.errorMessage).toBeUndefined();
      expect(result.json.items).toHaveLength(2);
      expect(result.json.items[0].label).toBe("Outillage (notamment numérique)");
      expect(result.json.items[1].label).toBe("Structuration du financement");
    });

    it("should return error result when no valid JSON found", () => {
      const response = "This is not JSON at all";
      const result = callParseResponse(service, response) as { json: { items: unknown[] }; errorMessage: string };
      expect(result.errorMessage).toBe("Failed to parse JSON from LLM response");
      expect(result.json.items).toEqual([]);
    });

    it("should skip JSON objects that don't have items field", () => {
      const response = `{"error": "something went wrong"}

{"projet": "test", "items": [{"label": "A", "score": 0.9}]}`;

      const result = callParseResponse(service, response) as { json: { items: unknown[] } };
      expect(result.json.items).toHaveLength(1);
    });

    it("should prefer the last valid JSON when there are multiple with items", () => {
      const response = `{"projet": "v1", "items": [{"label": "Old", "score": 0.5}]}
{"projet": "v2", "items": [{"label": "New", "score": 0.9}]}`;

      const result = callParseResponse(service, response) as {
        json: { projet: string; items: { label: string }[] };
      };
      expect(result.json.projet).toBe("v2");
      expect(result.json.items[0].label).toBe("New");
    });
  });
});
