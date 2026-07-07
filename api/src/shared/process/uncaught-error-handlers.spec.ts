import assert, { AssertionError } from "node:assert";
import {
  FORCE_EXIT_TIMEOUT_MS,
  handleUncaughtException,
  installUncaughtErrorHandlers,
  reportFatalAndExit,
  SENTRY_FLUSH_TIMEOUT_MS,
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

interface MockedDeps {
  logger: { error: jest.Mock };
  captureException: jest.Mock;
  flush: jest.Mock;
  exit: jest.Mock;
}

const buildDeps = (): MockedDeps => ({
  logger: { error: jest.fn() },
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
  exit: jest.fn(),
});

const INSTALLED = Symbol.for("api.uncaught-error-handlers.installed");
const resetInstallGuard = (): void => {
  delete (process as unknown as Record<symbol, unknown>)[INSTALLED];
};

describe("handleUncaughtException", () => {
  it("neutralise l'erreur de fond undici : log + Sentry (warning), sans flush ni exit", async () => {
    const deps = buildDeps();
    const error = buildUndiciBackgroundError();

    await handleUncaughtException(error, deps);

    expect(deps.logger.error).toHaveBeenCalledTimes(1);
    expect(deps.captureException).toHaveBeenCalledWith(error, "warning");
    expect(deps.flush).not.toHaveBeenCalled();
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it("ne crashe JAMAIS sur le chemin neutralisé, même si le logger lève", async () => {
    const deps = buildDeps();
    deps.logger.error.mockImplementation(() => {
      throw new Error("logger down");
    });
    const error = buildUndiciBackgroundError();

    await expect(handleUncaughtException(error, deps)).resolves.toBeUndefined();
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it("quitte avec exit(1) sur toute autre erreur (comportement fatal préservé)", async () => {
    const deps = buildDeps();
    const error = new Error("état corrompu");

    await handleUncaughtException(error, deps);

    expect(deps.logger.error).toHaveBeenCalledTimes(1);
    expect(deps.captureException).toHaveBeenCalledWith(error, "fatal");
    expect(deps.exit).toHaveBeenCalledWith(1);
  });
});

describe("reportFatalAndExit", () => {
  it("flushe Sentry AVANT de quitter (exit après résolution du flush)", async () => {
    const deps = buildDeps();
    let resolveFlush: (value: boolean) => void = () => undefined;
    deps.flush.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveFlush = resolve;
      }),
    );

    const pending = reportFatalAndExit("uncaughtException", new Error("boom"), deps);
    await Promise.resolve();

    expect(deps.flush).toHaveBeenCalledWith(SENTRY_FLUSH_TIMEOUT_MS);
    expect(deps.exit).not.toHaveBeenCalled();

    resolveFlush(true);
    await pending;

    expect(deps.exit).toHaveBeenCalledTimes(1);
    expect(deps.exit).toHaveBeenCalledWith(1);
  });

  it("force la sortie via le garde-fou si le flush pend indéfiniment", async () => {
    jest.useFakeTimers();
    try {
      const deps = buildDeps();
      deps.flush.mockReturnValue(new Promise<boolean>(() => undefined));

      void reportFatalAndExit("uncaughtException", new Error("boom"), deps);
      await Promise.resolve();

      expect(deps.exit).not.toHaveBeenCalled();

      jest.advanceTimersByTime(FORCE_EXIT_TIMEOUT_MS);

      expect(deps.exit).toHaveBeenCalledWith(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("quitte même si le flush rejette", async () => {
    const deps = buildDeps();
    deps.flush.mockRejectedValue(new Error("transport down"));

    await reportFatalAndExit("uncaughtException", new Error("boom"), deps);

    expect(deps.exit).toHaveBeenCalledWith(1);
  });
});

describe("installUncaughtErrorHandlers", () => {
  beforeEach(resetInstallGuard);
  afterEach(resetInstallGuard);

  it("enregistre un seul handler uncaughtException, même en cas de double appel (idempotent)", () => {
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
      installUncaughtErrorHandlers(deps);

      const uncaughtRegistrations = onSpy.mock.calls.filter(([event]) => event === "uncaughtException");
      expect(uncaughtRegistrations).toHaveLength(1);
      expect(registered.has("unhandledRejection")).toBe(false);
    } finally {
      onSpy.mockRestore();
    }
  });

  it("le listener enregistré délègue au handler (erreur de fond undici → pas d'exit)", async () => {
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

      const listener = registered.get("uncaughtException");
      expect(listener).toBeDefined();

      listener?.(buildUndiciBackgroundError());
      await Promise.resolve();

      expect(deps.exit).not.toHaveBeenCalled();
      expect(deps.captureException).toHaveBeenCalledWith(expect.any(AssertionError), "warning");
    } finally {
      onSpy.mockRestore();
    }
  });
});
