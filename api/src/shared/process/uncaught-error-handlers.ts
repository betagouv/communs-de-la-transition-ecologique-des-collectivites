import * as Sentry from "@sentry/node";
import { CustomLogger } from "@/logging/logger.service";
import { isBackgroundAssertionError } from "@/shared/utils/is-background-assertion-error";

type ProcessErrorKind = "uncaughtException" | "unhandledRejection";

/**
 * Dépendances injectables du handler, pour le tester sans toucher au vrai
 * `process` ni à Sentry.
 */
export interface UncaughtErrorHandlerDeps {
  logger: Pick<CustomLogger, "error">;
  captureException: (error: unknown) => void;
  exit: (code: number) => void;
}

const buildDefaultDeps = (): UncaughtErrorHandlerDeps => ({
  logger: new CustomLogger(),
  captureException: (error) => {
    Sentry.captureException(error);
  },
  exit: (code) => {
    process.exit(code);
  },
});

/**
 * Handler global des erreurs non rattrapées (issue #507).
 *
 * SI l'erreur correspond à la signature étroite de l'AssertionError de fond
 * d'undici (voir {@link isBackgroundAssertionError}) : on la journalise + on la
 * remonte à Sentry, et on NE crashe PAS — c'est une erreur réseau de fond, sans
 * lien avec l'état applicatif.
 *
 * SINON : on préserve le comportement par défaut de Node (terminaison). Dans un
 * handler `uncaughtException`, enregistrer un écouteur SUPPRIME l'arrêt
 * automatique du process ; on le rétablit donc EXPLICITEMENT via `exit(1)`
 * (après journalisation + Sentry) pour ne jamais transformer silencieusement une
 * vraie erreur d'état corrompu en process zombie.
 */
export const handleUncaughtProcessError = (
  kind: ProcessErrorKind,
  error: unknown,
  deps: UncaughtErrorHandlerDeps,
): void => {
  if (isBackgroundAssertionError(error)) {
    deps.logger.error(`Erreur node:assert de fond undici ignorée (${kind}), le process reste vivant`, {
      errorName: error.name,
      errorMessage: error.message,
    });
    deps.captureException(error);
    return;
  }

  deps.logger.error(`${kind} fatale, arrêt du process`, {
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  deps.captureException(error);
  deps.exit(1);
};

/**
 * Enregistre les handlers `uncaughtException` / `unhandledRejection` sur le
 * process. À appeler une fois au bootstrap, après l'init Sentry.
 */
export const installUncaughtErrorHandlers = (deps: UncaughtErrorHandlerDeps = buildDefaultDeps()): void => {
  process.on("uncaughtException", (error) => {
    handleUncaughtProcessError("uncaughtException", error, deps);
  });
  process.on("unhandledRejection", (reason) => {
    handleUncaughtProcessError("unhandledRejection", reason, deps);
  });
};
