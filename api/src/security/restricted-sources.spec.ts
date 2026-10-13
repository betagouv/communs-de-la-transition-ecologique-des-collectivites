import {
  CONSOLIDATED_INTERNAL_SCOPE,
  CONSOLIDATED_RESTRICTED_SOURCES,
  forbiddenSourcesFor,
  seesInternalLines,
  hasRestrictedSources,
  RESTRICTED_SOURCES,
} from "./restricted-sources";

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

describe("CONSOLIDATED_RESTRICTED_SOURCES (base consolidée, /consultation)", () => {
  const V0 = ["communs-acv", "communs-pvd", "communs-vivier-cop", "fiches-projets", "villages-avenir"];

  it("déclare les 5 sources non exposées en V0, chacune derrière un scope", () => {
    expect(Object.keys(CONSOLIDATED_RESTRICTED_SOURCES).sort()).toEqual(V0);
    expect(CONSOLIDATED_RESTRICTED_SOURCES["fiches-projets"]).toBe("tet");
    expect(CONSOLIDATED_RESTRICTED_SOURCES["communs-vivier-cop"]).toBe("cop");
    for (const source of ["communs-pvd", "communs-acv", "villages-avenir"]) {
      expect(CONSOLIDATED_RESTRICTED_SOURCES[source]).toBe("anct_contractualisation");
    }
  });

  it("n'y met ni le CRTE, ni le Fonds Vert, ni la DGCL (accès État acquis)", () => {
    for (const source of ["communs-crte", "fonds-vert", "communs-fonds-vert", "dgcl", "decp", "agences-eau"]) {
      expect(CONSOLIDATED_RESTRICTED_SOURCES).not.toHaveProperty(source);
    }
  });

  it("un service sans scope (fail-closed) se voit interdire les 5 ; le scope tet lève seulement fiches-projets", () => {
    expect(forbiddenSourcesFor([], CONSOLIDATED_RESTRICTED_SOURCES).sort()).toEqual(V0);
    expect(forbiddenSourcesFor(["tet"], CONSOLIDATED_RESTRICTED_SOURCES).sort()).toEqual(
      V0.filter((s) => s !== "fiches-projets"),
    );
  });

  it("laisse intact le registre de /territoires (autre table, autres clients)", () => {
    expect(Object.keys(RESTRICTED_SOURCES)).toHaveLength(0);
  });
});

describe("lignes internes de la base consolidée (/consultation)", () => {
  it("réserve les lignes `interne` au scope interne_etat", () => {
    expect(CONSOLIDATED_INTERNAL_SCOPE).toBe("interne_etat");
    expect(seesInternalLines(["interne_etat"])).toBe(true);
    expect(seesInternalLines(["tet", "interne_etat"])).toBe(true);
  });

  it("un service sans ce scope ne voit que l'ouvert et le public sans licence (fail-closed)", () => {
    expect(seesInternalLines([])).toBe(false);
    expect(seesInternalLines(["tet", "cop"])).toBe(false);
  });
});
