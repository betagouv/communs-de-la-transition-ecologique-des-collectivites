/**
 * Cœur BM25 du matching textuel — pur, sans dépendance NestJS.
 *
 * Isolé ici pour être réutilisable tel quel par les scripts de diagnostic
 * (`scripts/diagnose-aides-geo.ts`, `scripts/aides-labels-stats.ts`) sans
 * tirer tout le module aides. `AidesTextualMatchingService` n'est qu'un
 * wrapper qui mappe les `Aide` vers des documents `{ id, text }`.
 */

import { FRENCH_STOPWORDS } from "./const/french-stopwords";

// BM25 tuning — standard defaults.
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;
// Saturation constant : textualScore = bm25 / (bm25 + K). bm25 == K → 0.5.
export const SATURATION_K = 6;
const MIN_TOKEN_LENGTH = 3;

export interface TextualMatch {
  /** Relevance 0-1 (saturated BM25). */
  score: number;
  /** Query tokens that appeared in the document — for display / debugging. */
  matchedTerms: string[];
}

/** A document to score : an opaque id and its searchable text. */
export interface TextualDoc {
  id: string;
  text: string;
}

/**
 * Tokenize French text : lowercase → strip diacritics → split on non-letters
 * → drop short tokens and stopwords.
 */
export function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}]+/u)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !FRENCH_STOPWORDS.has(t));
}

/**
 * Score every document against the query via BM25 (corpus = the docs).
 * @returns Map keyed by doc.id → { score 0-1 (saturated), matchedTerms }
 */
export function bm25Match(query: string, docs: TextualDoc[]): Map<string, TextualMatch> {
  const result = new Map<string, TextualMatch>();
  if (docs.length === 0) return result;

  const queryTokens = [...new Set(normalizeText(query))];
  if (queryTokens.length === 0) {
    for (const doc of docs) result.set(doc.id, { score: 0, matchedTerms: [] });
    return result;
  }

  const tokenized = docs.map((doc) => ({ id: doc.id, tokens: normalizeText(doc.text) }));

  const corpusSize = tokenized.length;
  const avgDocLength = tokenized.reduce((sum, d) => sum + d.tokens.length, 0) / corpusSize || 1;

  // Document frequency per query token (how many docs contain it).
  const docFreq = new Map<string, number>(queryTokens.map((t) => [t, 0]));
  for (const doc of tokenized) {
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

  for (const doc of tokenized) {
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

    result.set(doc.id, { score: bm25 / (bm25 + SATURATION_K), matchedTerms });
  }

  return result;
}
