/**
 * Garde contre les erreurs asynchrones non rattrapées de l'application e2e.
 *
 * En e2e, `e2e-global-setup.ts` démarre l'application Nest COMPLÈTE dans le
 * MÊME processus que Jest (`--runInBand`), workers BullMQ compris. La création
 * de projets planifie des jobs de qualification qui appellent l'API Anthropic
 * via `@anthropic-ai/sdk` → `fetch` (undici). Sur ces connexions sortantes,
 * undici peut lever une assertion interne `node:assert` (`assert(false)`) sur un
 * callback de socket (fermeture/abandon keep-alive), EN DEHORS de la promesse
 * `await` du worker : ni le SDK ni le try/catch du worker ne peuvent la capter.
 *
 * jest-circus installe ses propres écouteurs `uncaughtException` /
 * `unhandledRejection` (sur le VRAI processus) qui rattachent l'erreur au test
 * EN COURS et le font échouer. Résultat : une erreur de fond, arrivée ~45-90 s
 * après le boot, fait échouer un test sans rapport (le 1er test de la dernière
 * suite) avec le message cryptique « assert(received) / Expected value to be
 * equal to: true / Received: false » (format produit par jest-circus pour une
 * AssertionError node:assert), sans stack.
 *
 * On ne peut PAS envelopper l'écouteur de jest depuis le code de test :
 * jest-environment-node donne au code de test un `process` cloné, distinct du
 * vrai processus où l'erreur survient et où jest écoute. Seul `globalSetup`
 * s'exécute dans le vrai processus. On y patche donc `process.on` pour
 * envelopper CHAQUE écouteur uncaughtException/unhandledRejection (dont ceux
 * (ré)installés par jest-circus à chaque fichier) avec un filtre : les
 * AssertionError node:assert qui ne proviennent pas du code de test sont
 * journalisées puis ignorées ; tout le reste est transmis à l'écouteur d'origine,
 * préservant le comportement d'échec normal.
 */

type Listener = (...args: unknown[]) => void;
const GUARDED_EVENTS = new Set(["uncaughtException", "unhandledRejection"]);

/** Une erreur d'assertion node:assert (et pas une erreur de matcher Jest). */
const isNodeAssertionError = (err: unknown): err is Error & { code?: string } => {
  if (!err || typeof err !== "object") {
    return false;
  }
  const candidate = err as { code?: string; name?: string };
  return candidate.code === "ERR_ASSERTION" || candidate.name === "AssertionError";
};

/** Vrai si la stack référence du code de test (spec ou helpers e2e). */
const originatesFromTestCode = (err: unknown): boolean => {
  const stack = err instanceof Error && typeof err.stack === "string" ? err.stack : "";
  return /\.e2e-spec\.ts|[/\\]test[/\\]helpers[/\\]/.test(stack);
};

const shouldIgnore = (err: unknown): boolean => isNodeAssertionError(err) && !originatesFromTestCode(err);

const WRAPPED = Symbol("e2e-uncaught-guard-wrapped");
const INSTALLED = Symbol.for("e2e-uncaught-guard-installed");

type WrappableProcess = NodeJS.Process & { [INSTALLED]?: boolean };

/**
 * Patche `process.on`/`addListener` (et `removeListener`/`off`) pour filtrer les
 * AssertionError node:assert de fond. Idempotent.
 */
export const installUncaughtAssertGuard = (proc: NodeJS.Process = process): void => {
  const target = proc as WrappableProcess;
  if (target[INSTALLED]) {
    return;
  }
  target[INSTALLED] = true;

  const wrap = (listener: Listener): Listener => {
    const existing = (listener as Listener & { [WRAPPED]?: Listener })[WRAPPED];
    if (existing) {
      return existing;
    }
    const wrapped: Listener = (...args: unknown[]) => {
      const err = args[0];
      if (shouldIgnore(err)) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[e2e-uncaught-guard] Ignored background node:assert error from the in-process app: ${message}`);
        return;
      }
      return listener(...args);
    };
    (listener as Listener & { [WRAPPED]?: Listener })[WRAPPED] = wrapped;
    return wrapped;
  };

  // Les surcharges de process.on ont des littéraux d'événement : on les ramène à
  // une signature générique pour envelopper les écouteurs de façon uniforme.
  type ProcListenerFn = (event: string, listener: Listener) => NodeJS.Process;
  const originalOn = target.on.bind(target) as unknown as ProcListenerFn;
  const originalAdd = target.addListener.bind(target) as unknown as ProcListenerFn;
  const originalRemove = target.removeListener.bind(target) as unknown as ProcListenerFn;
  const originalOff = target.off.bind(target) as unknown as ProcListenerFn;

  const patchedAdd =
    (base: ProcListenerFn) =>
    (event: string, listener: Listener): NodeJS.Process =>
      GUARDED_EVENTS.has(event) ? base(event, wrap(listener)) : base(event, listener);

  const patchedRemove =
    (base: ProcListenerFn) =>
    (event: string, listener: Listener): NodeJS.Process => {
      if (GUARDED_EVENTS.has(event)) {
        const wrapped = (listener as Listener & { [WRAPPED]?: Listener })[WRAPPED];
        return base(event, wrapped ?? listener);
      }
      return base(event, listener);
    };

  target.on = patchedAdd(originalOn) as NodeJS.Process["on"];
  target.addListener = patchedAdd(originalAdd) as NodeJS.Process["addListener"];
  target.removeListener = patchedRemove(originalRemove) as NodeJS.Process["removeListener"];
  target.off = patchedRemove(originalOff) as NodeJS.Process["off"];
};
