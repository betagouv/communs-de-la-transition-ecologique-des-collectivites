import { Injectable } from "@nestjs/common";
import { Aide } from "./dto/aides.dto";
import { FRENCH_STOPWORDS } from "./const/french-stopwords";

/**
 * Lexical (BM25) textual matching between a project and a set of aides.
 *
 * Complements the thematic label matching (AidesMatchingService): it works on
 * raw text — including aides not yet classified — and is computed at request
 * time over the territory's aide set as the corpus. No infra, no LLM, no cost.
 *
 * Scores are saturated to 0-1 so the caller can combine them with the
 * thematic normalizedScore and apply absolute thresholds.
 */

// BM25 tuning — standard defaults.
const BM25_K1 = 1.5;
const BM25_B = 0.75;
// Saturation constant : textualScore = bm25 / (bm25 + K). bm25 == K → 0.5.
const SATURATION_K = 6;
const MIN_TOKEN_LENGTH = 3;

export interface TextualMatch {
  /** Relevance 0-1 (saturated BM25). */
  score: number;
  /** Query tokens that appeared in the aide — for display / debugging. */
  matchedTerms: string[];
}

/**
 * Tokenize French text : lowercase → strip diacritics → split on non-letters
 * → drop short tokens and stopwords. Exported for direct unit testing.
 */
export function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}]+/u)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !FRENCH_STOPWORDS.has(t));
}

@Injectable()
export class AidesTextualMatchingService {
  /**
   * Score every aide against the project text via BM25.
   * @param projectText project nom + description (the query)
   * @param aides territory aide set (the corpus AND the items to score)
   * @returns Map keyed by String(aide.id) → { score 0-1, matchedTerms }
   */
  score(projectText: string, aides: Aide[]): Map<string, TextualMatch> {
    const result = new Map<string, TextualMatch>();
    if (aides.length === 0) return result;

    const queryTokens = [...new Set(normalizeText(projectText))];
    if (queryTokens.length === 0) {
      // No usable query — everything scores 0, no rescue possible.
      for (const aide of aides) result.set(String(aide.id), { score: 0, matchedTerms: [] });
      return result;
    }

    const docs = aides.map((aide) => ({
      idAt: String(aide.id),
      tokens: normalizeText(this.aideDocument(aide)),
    }));

    const corpusSize = docs.length;
    const avgDocLength = docs.reduce((sum, d) => sum + d.tokens.length, 0) / corpusSize || 1;

    // Document frequency per query token (how many docs contain it).
    const docFreq = new Map<string, number>(queryTokens.map((t) => [t, 0]));
    for (const doc of docs) {
      const present = new Set(doc.tokens);
      for (const token of queryTokens) {
        if (present.has(token)) docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
      }
    }

    // IDF (Lucene variant : always positive).
    const idf = new Map<string, number>();
    for (const token of queryTokens) {
      const n = docFreq.get(token) ?? 0;
      idf.set(token, Math.log(1 + (corpusSize - n + 0.5) / (n + 0.5)));
    }

    for (const doc of docs) {
      const termFreq = new Map<string, number>();
      for (const token of doc.tokens) {
        if (idf.has(token)) termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      }

      let bm25 = 0;
      const matchedTerms: string[] = [];
      const docLength = doc.tokens.length;

      for (const token of queryTokens) {
        const freq = termFreq.get(token) ?? 0;
        if (freq === 0) continue;
        matchedTerms.push(token);
        const numerator = freq * (BM25_K1 + 1);
        const denominator = freq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
        bm25 += (idf.get(token) ?? 0) * (numerator / denominator);
      }

      result.set(doc.idAt, { score: bm25 / (bm25 + SATURATION_K), matchedTerms });
    }

    return result;
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
