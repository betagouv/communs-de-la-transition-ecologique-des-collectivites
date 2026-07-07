import assert, { AssertionError } from "node:assert";
import { isBackgroundAssertionError } from "@/shared/utils/is-background-assertion-error";

const UNDICI_STACK = [
  "AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:",
  "    at makeNetworkError (node:internal/deps/undici/undici:9467:35)",
  "    at Object.onConnect (node:internal/deps/undici/undici:10693:20)",
].join("\n");

/** Reproduit l'erreur réelle : `assert(false)` interne d'undici sur un socket. */
const buildUndiciBackgroundError = (): AssertionError => {
  try {
    assert(false);
    throw new Error("unreachable");
  } catch (err) {
    const assertionError = err as AssertionError;
    // La vraie erreur est levée dans le code d'undici : on force une stack qui
    // référence undici (le `fetch` intégré expose ces frames).
    assertionError.stack = UNDICI_STACK;
    return assertionError;
  }
};

describe("isBackgroundAssertionError", () => {
  it("matche l'AssertionError node:assert de fond d'undici (signature exacte)", () => {
    expect(isBackgroundAssertionError(buildUndiciBackgroundError())).toBe(true);
  });

  it("matche via le repli code+name quand instanceof échoue (undici d'un autre realm)", () => {
    const crossRealm = {
      name: "AssertionError",
      code: "ERR_ASSERTION",
      operator: "==",
      expected: true,
      actual: false,
      generatedMessage: true,
      message: "The expression evaluated to a falsy value:",
      stack: UNDICI_STACK,
    };

    expect(isBackgroundAssertionError(crossRealm)).toBe(true);
  });

  it("ne matche PAS une AssertionError node:assert issue du code de test (stack sans undici)", () => {
    // Un `assert(false)` d'un test a la même signature mais une stack de test.
    let testAssertion: AssertionError | undefined;
    try {
      assert(false);
    } catch (err) {
      testAssertion = err as AssertionError;
    }

    expect(isBackgroundAssertionError(testAssertion)).toBe(false);
  });

  it("ne matche PAS un assert(false) levé par du code tiers dont la stack ne TRAVERSE undici qu'après la 1re frame", () => {
    // Cas d'un subscriber diagnostics_channel (ex. instrumentation fetch Sentry)
    // qui `assert(false)` : la 1re frame est le subscriber, undici n'apparaît que
    // dans les frames du publisher plus bas → ne doit PAS être avalé.
    let subscriberAssertion: AssertionError | undefined;
    try {
      assert(false);
    } catch (err) {
      subscriberAssertion = err as AssertionError;
      subscriberAssertion.stack = [
        "AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:",
        "    at Object.subscriber (/home/app/instrumentation.js:12:5)",
        "    at Channel.publish (node:diagnostics_channel:150:12)",
        "    at Request.onHeaders (node:internal/deps/undici/undici:8123:20)",
      ].join("\n");
    }

    expect(isBackgroundAssertionError(subscriberAssertion)).toBe(false);
  });

  it("ne matche PAS un assert(x, message) applicatif (generatedMessage=false)", () => {
    let customMessageError: AssertionError | undefined;
    try {
      assert(false, "règle métier violée");
    } catch (err) {
      customMessageError = err as AssertionError;
      customMessageError.stack = UNDICI_STACK;
    }

    expect(isBackgroundAssertionError(customMessageError)).toBe(false);
  });

  it("ne matche PAS un assert.strictEqual (operator/expected différents)", () => {
    let strictEqualError: AssertionError | undefined;
    try {
      assert.strictEqual(1, 2);
    } catch (err) {
      strictEqualError = err as AssertionError;
      strictEqualError.stack = UNDICI_STACK;
    }

    expect(isBackgroundAssertionError(strictEqualError)).toBe(false);
  });

  it("ne matche PAS une TypeError", () => {
    const typeError = new TypeError("Cannot read properties of undefined");
    typeError.stack = UNDICI_STACK;

    expect(isBackgroundAssertionError(typeError)).toBe(false);
  });

  it("ne matche PAS une Error générique", () => {
    expect(isBackgroundAssertionError(new Error("boom"))).toBe(false);
  });

  it("ne matche PAS les valeurs non-Error", () => {
    expect(isBackgroundAssertionError(null)).toBe(false);
    expect(isBackgroundAssertionError(undefined)).toBe(false);
    expect(isBackgroundAssertionError("The expression evaluated to a falsy value")).toBe(false);
    expect(isBackgroundAssertionError(42)).toBe(false);
  });
});
