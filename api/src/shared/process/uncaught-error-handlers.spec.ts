import assert, { AssertionError } from "node:assert";
import {
  handleUncaughtProcessError,
  installUncaughtErrorHandlers,
  UncaughtErrorHandlerDeps,
} from "@/shared/process/uncaught-error-handlers";

const UNDICI_STACK = [
  "AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:",
  "    at makeNetworkError (node:internal/deps/undici/undici:9467:35)",
].join("\n");

const buildUndiciBackgroundError = (): AssertionError => {
  try {
    assert(false);
    throw new Error("unreachable");
  } catch (err) {
    const assertionError = err as AssertionError;
    assertionError.stack = UNDICI_STACK;
    return assertionError;
  }
};

const buildDeps = (): jest.Mocked<UncaughtErrorHandlerDeps> => ({
  logger: { error: jest.fn() },
  captureException: jest.fn(),
  exit: jest.fn(),
});

describe("handleUncaughtProcessError", () => {
  it("journalise + remonte à Sentry mais NE quitte PAS sur l'erreur de fond undici", () => {
    const deps = buildDeps();
    const error = buildUndiciBackgroundError();

    handleUncaughtProcessError("uncaughtException", error, deps);

    expect(deps.logger.error).toHaveBeenCalledTimes(1);
    expect(deps.captureException).toHaveBeenCalledWith(error);
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it("traite de la même façon une unhandledRejection undici de fond", () => {
    const deps = buildDeps();
    const error = buildUndiciBackgroundError();

    handleUncaughtProcessError("unhandledRejection", error, deps);

    expect(deps.exit).not.toHaveBeenCalled();
    expect(deps.captureException).toHaveBeenCalledWith(error);
  });

  it("quitte avec exit(1) sur toute autre erreur (comportement par défaut préservé)", () => {
    const deps = buildDeps();
    const error = new Error("état corrompu");

    handleUncaughtProcessError("uncaughtException", error, deps);

    expect(deps.logger.error).toHaveBeenCalledTimes(1);
    expect(deps.captureException).toHaveBeenCalledWith(error);
    expect(deps.exit).toHaveBeenCalledWith(1);
  });

  it("quitte aussi sur une valeur rejetée non-Error", () => {
    const deps = buildDeps();

    handleUncaughtProcessError("unhandledRejection", "boom", deps);

    expect(deps.exit).toHaveBeenCalledWith(1);
  });
});

describe("installUncaughtErrorHandlers", () => {
  it("enregistre un handler pour uncaughtException et unhandledRejection", () => {
    const registered = new Map<string | symbol, (...args: unknown[]) => void>();
    const onSpy = jest
      .spyOn(process, "on")
      .mockImplementation((event: string | symbol, listener: (...args: unknown[]) => void) => {
        registered.set(event, listener);
        return process;
      });

    try {
      const deps = buildDeps();
      installUncaughtErrorHandlers(deps);

      expect(registered.has("uncaughtException")).toBe(true);
      expect(registered.has("unhandledRejection")).toBe(true);

      // Le listener enregistré délègue bien au handler (ici : erreur non-undici → exit).
      registered.get("uncaughtException")?.(new Error("corrompu"));
      expect(deps.exit).toHaveBeenCalledWith(1);

      // Et ignore l'erreur de fond undici sans quitter.
      deps.exit.mockClear();
      registered.get("unhandledRejection")?.(buildUndiciBackgroundError());
      expect(deps.exit).not.toHaveBeenCalled();
    } finally {
      onSpy.mockRestore();
    }
  });
});
