import { AssertionError } from "node:assert";

/**
 * Discrimine l'AssertionError `node:assert` de fond levée par undici que l'on
 * peut ignorer sans crasher le process.
 *
 * Contexte (issue #507) : les connexions sortantes du SDK Anthropic passent par
 * le `fetch` intégré de Node (undici). Sur un callback de socket (fermeture /
 * abandon d'un keep-alive), undici lève parfois une assertion interne
 * `assert(<falsy>)` EN DEHORS de toute promesse `await` : ni le SDK ni le
 * try/catch des workers BullMQ ne peuvent la capter, elle remonte donc en
 * `uncaughtException`.
 *
 * Le prédicat est VOLONTAIREMENT ÉTROIT. Il ne matche que la signature exacte de
 * ce `assert(<falsy>)` auto-généré :
 *  - instance d'`AssertionError` `node:assert` (avec repli code+name pour couvrir
 *    un éventuel undici bundlé dans un autre realm où `instanceof` échouerait) ;
 *  - `operator === "=="` (comparaison implicite d'`assert.ok`) ;
 *  - `expected === true` (undici teste une condition « vérité ») ;
 *  - `generatedMessage === true` (message auto-généré, pas un `assert(x, "…")`
 *    applicatif porteur d'une intention métier) ;
 *  - stack référençant undici (le `fetch` intégré expose des frames
 *    `node:internal/deps/undici/undici`), pour cibler spécifiquement l'origine
 *    réseau et laisser crasher une éventuelle assertion d'un autre code.
 *
 * Tout ce qui ne correspond pas EXACTEMENT à cette signature doit continuer à
 * crasher (état potentiellement corrompu). Le code applicatif de ce dépôt
 * n'utilise pas `node:assert`, donc une AssertionError node:assert légitime ne
 * peut venir que d'une dépendance ; on ne neutralise que celle, identifiée,
 * d'undici.
 */
export const isBackgroundAssertionError = (error: unknown): error is AssertionError => {
  if (!isNodeAssertionError(error)) {
    return false;
  }

  const candidate = error as AssertionError & { generatedMessage?: boolean };
  const hasUndiciAssertSignature =
    candidate.operator === "==" && candidate.expected === true && candidate.generatedMessage === true;

  return hasUndiciAssertSignature && originatesFromUndici(candidate);
};

/**
 * Vrai si l'erreur est une AssertionError `node:assert`. Le repli `code`/`name`
 * couvre les cas où `instanceof` échoue (undici chargé dans un autre realm).
 */
const isNodeAssertionError = (error: unknown): error is AssertionError => {
  if (error instanceof AssertionError) {
    return true;
  }
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: unknown; name?: unknown };
  return candidate.code === "ERR_ASSERTION" && candidate.name === "AssertionError";
};

/** Vrai si la stack référence undici (origine réseau du `fetch` intégré). */
const originatesFromUndici = (error: Error): boolean => {
  const stack = typeof error.stack === "string" ? error.stack : "";
  return /undici/i.test(stack);
};
