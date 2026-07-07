import * as Sentry from "@sentry/node";
import { CustomLogger } from "@/logging/logger.service";
import { isBackgroundAssertionError } from "@/shared/utils/is-background-assertion-error";

/** Niveau Sentry utilisé selon que l'erreur est neutralisée ou fatale. */
type CaptureLevel = "fatal" | "warning";

/** Délai laissé au transport Sentry pour partir avant la sortie (ms). */
export const SENTRY_FLUSH_TIMEOUT_MS = 2000;
/** Garde-fou : sortie forcée si le flush pend au-delà de ce délai (ms). */
export const FORCE_EXIT_TIMEOUT_MS = 2500;

/**
 * Dépendances injectables du handler, pour le tester sans toucher au vrai
 * `process` ni à Sentry.
 */
export interface UncaughtErrorHandlerDeps {
  logger: Pick<CustomLogger, "error">;
  captureException: (error: unknown, level: CaptureLevel) => void;
  flush: (timeoutMs: number) => Promise<boolean>;
  exit: (code: number) => void;
}

const buildDefaultDeps = (): UncaughtErrorHandlerDeps => ({
  logger: new CustomLogger(),
  captureException: (error, level) => {
    Sentry.captureException(error, { level });
  },
  flush: (timeoutMs) => Sentry.flush(timeoutMs),
  exit: (code) => {
    process.exit(code);
  },
});

/**
 * Journalise + remonte à Sentry l'AssertionError de fond d'undici (issue #507)
 * SANS crasher. Ne DOIT jamais lever : neutraliser cette erreur de fond ne peut
 * pas, à son tour, tuer le process (sinon on réintroduit le crash qu'on corrige).
 */
const swallowBackgroundAssertion = (error: Error, deps: UncaughtErrorHandlerDeps): void => {
  try {
    deps.logger.error("Erreur node:assert de fond undici neutralisée (uncaughtException), process maintenu vivant", {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });
    deps.captureException(error, "warning");
  } catch {
    // Volontairement avalé : la neutralisation ne doit jamais crasher.
  }
};

/**
 * Chemin fatal : journalise + remonte à Sentry, PUIS quitte avec `exit(1)` —
 * mais seulement APRÈS avoir laissé le transport Sentry vider sa file (`flush`),
 * sinon l'événement du crash est perdu. Un garde-fou force la sortie si le flush
 * pend, pour ne jamais laisser de process zombie.
 *
 * Réutilisé au bootstrap (échec de `bootstrap()`), d'où le paramètre `context`.
 */
export const reportFatalAndExit = async (
  context: string,
  error: unknown,
  deps: UncaughtErrorHandlerDeps,
): Promise<void> => {
  try {
    deps.logger.error(`${context} fatale, arrêt du process après flush Sentry`, {
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    deps.captureException(error, "fatal");
  } catch {
    // Même si la journalisation/remontée échoue, on doit tout de même sortir.
  }

  let exited = false;
  const exitOnce = (): void => {
    if (exited) {
      return;
    }
    exited = true;
    deps.exit(1);
  };

  const forceExit = setTimeout(exitOnce, FORCE_EXIT_TIMEOUT_MS);
  if (typeof forceExit.unref === "function") {
    forceExit.unref();
  }

  try {
    await deps.flush(SENTRY_FLUSH_TIMEOUT_MS);
  } catch {
    // Flush en échec : on sort quand même.
  } finally {
    clearTimeout(forceExit);
    exitOnce();
  }
};

/**
 * Handler global des `uncaughtException` (issue #507).
 *
 * SI l'erreur est l'AssertionError de fond d'undici → on la neutralise (log +
 * Sentry), le process reste vivant. SINON → comportement fatal préservé : un
 * écouteur `uncaughtException` supprime l'arrêt automatique de Node, on le
 * rétablit EXPLICITEMENT via `reportFatalAndExit` (flush Sentry puis `exit(1)`)
 * pour ne jamais transformer une vraie erreur d'état corrompu en process zombie.
 *
 * On ne gère PAS `unhandledRejection` : l'intégration Sentry (mode 'warn' par
 * défaut) journalise + capture déjà les rejections sans crasher, et l'assert
 * undici de #507 remonte par `uncaughtException` (levé hors promesse). Passer
 * les rejections en `exit(1)` durcirait la politique prod actuelle (warn) et
 * transformerait un incident transitoire (ex. insert analytics fire-and-forget)
 * en crash-loop : hors périmètre, à traiter dans une PR dédiée.
 */
export const handleUncaughtException = async (error: unknown, deps: UncaughtErrorHandlerDeps): Promise<void> => {
  if (isBackgroundAssertionError(error)) {
    swallowBackgroundAssertion(error, deps);
    return;
  }
  await reportFatalAndExit("uncaughtException", error, deps);
};

const INSTALLED = Symbol.for("api.uncaught-error-handlers.installed");
type GuardedProcess = NodeJS.Process & { [INSTALLED]?: boolean };

/**
 * Enregistre le handler `uncaughtException` sur le process. Idempotent. À
 * appeler une fois au bootstrap, après l'init Sentry.
 */
export const installUncaughtErrorHandlers = (deps: UncaughtErrorHandlerDeps = buildDefaultDeps()): void => {
  const target = process as GuardedProcess;
  if (target[INSTALLED]) {
    return;
  }
  target[INSTALLED] = true;

  process.on("uncaughtException", (error) => {
    void handleUncaughtException(error, deps);
  });
};

/**
 * Journalise + flush Sentry + `exit(1)` sur un échec fatal, avec les
 * dépendances réelles. Utilisé pour l'échec de `bootstrap()` (on ne peut pas
 * rester en zombie), sans installer de politique globale sur les rejections.
 */
export const handleFatalError = (context: string, error: unknown): Promise<void> =>
  reportFatalAndExit(context, error, buildDefaultDeps());
