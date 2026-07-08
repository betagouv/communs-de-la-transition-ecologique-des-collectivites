import { forbiddenSourcesFor, hasRestrictedSources, RESTRICTED_SOURCES } from "./restricted-sources";

describe("restricted-sources (doctrine d'accès)", () => {
  it("registre par défaut VIDE : aucune source restreinte (non-régression stricte)", () => {
    expect(Object.keys(RESTRICTED_SOURCES)).toHaveLength(0);
    expect(hasRestrictedSources()).toBe(false);
    expect(forbiddenSourcesFor([])).toEqual([]);
    expect(forbiddenSourcesFor(["nimporte_quel_scope"])).toEqual([]);
  });

  // Registre simulé pour l'ouverture DGCL à venir.
  const registry = { "DGCL non financés": "dgcl_non_finances" };

  it("service sans le scope requis → la source est interdite", () => {
    expect(forbiddenSourcesFor([], registry)).toEqual(["DGCL non financés"]);
    expect(forbiddenSourcesFor(["autre_scope"], registry)).toEqual(["DGCL non financés"]);
  });

  it("service porteur du scope → la source est autorisée (absente des interdits)", () => {
    expect(forbiddenSourcesFor(["dgcl_non_finances"], registry)).toEqual([]);
  });

  it("hasRestrictedSources reflète l'état du registre", () => {
    expect(hasRestrictedSources({})).toBe(false);
    expect(hasRestrictedSources(registry)).toBe(true);
  });
});
