import { Injectable } from "@nestjs/common";
import { Aide } from "./dto/aides.dto";
import { bm25Match, normalizeText, type TextualMatch } from "./textual-matching.bm25";

/**
 * Lexical (BM25) textual matching between a project and a set of aides.
 *
 * Complements the thematic label matching (AidesMatchingService): it works on
 * raw text — including aides not yet classified — and is computed at request
 * time over the territory's aide set as the corpus. No infra, no LLM, no cost.
 *
 * Thin wrapper : the BM25 core lives in `textual-matching.bm25.ts` (pure, no
 * NestJS dependency, also consumed by the diagnostic scripts).
 */

// Re-exported for back-compat — existing imports / tests use the service file.
export { normalizeText, type TextualMatch };

@Injectable()
export class AidesTextualMatchingService {
  /**
   * Score every aide against the project text via BM25.
   * @param projectText project nom + description (the query)
   * @param aides territory aide set (the corpus AND the items to score)
   * @returns Map keyed by String(aide.id) → { score 0-1, matchedTerms }
   */
  score(projectText: string, aides: Aide[]): Map<string, TextualMatch> {
    return bm25Match(
      projectText,
      aides.map((aide) => ({ id: String(aide.id), text: this.aideDocument(aide) })),
    );
  }

  /** Concatenated searchable text of an aide. */
  private aideDocument(aide: Aide): string {
    return [
      aide.name,
      aide.short_title ?? "",
      aide.description ?? "",
      aide.eligibility ?? "",
      aide.project_examples ?? "",
      ...(aide.categories ?? []),
    ].join(" ");
  }
}
