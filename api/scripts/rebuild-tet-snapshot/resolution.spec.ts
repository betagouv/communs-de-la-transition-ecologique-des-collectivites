import { buildResolver, normalizeNom, RefEntry } from "./resolution";
import { SIREN_OVERRIDES } from "./overrides";

describe("normalizeNom", () => {
  it("retire accents, ponctuation et casse, compacte les espaces", () => {
    expect(normalizeNom("Communauté de Communes  Avallon - Vézelay")).toBe("communaute de communes avallon vezelay");
    expect(normalizeNom("Saint-Dizier, Der & Blaise")).toBe("saint dizier der blaise");
    expect(normalizeNom("  L'Agglo  ")).toBe("l agglo");
  });
  it("gère null/undefined/vide", () => {
    expect(normalizeNom(null)).toBe("");
    expect(normalizeNom(undefined)).toBe("");
    expect(normalizeNom("   ")).toBe("");
  });
});

describe("buildResolver", () => {
  const groupements: RefEntry[] = [
    { siren: "200041630", nom: "CA Ardenne Métropole" },
    { siren: "244400404", nom: "Nantes Métropole" },
  ];
  const communes: RefEntry[] = [
    { siren: "211700016", nom: "Arles" }, // exemple (siren fictif ici)
    { siren: "214401846", nom: "Saint-Nazaire" }, // homonyme 1
    { siren: "216601864", nom: "Saint-Nazaire" }, // homonyme 2
  ];
  const resolver = buildResolver(groupements, communes);

  it("résout un groupement par match exact (insensible aux accents)", () => {
    expect(resolver.resolve(999001, "CA Ardenne Metropole")).toEqual({
      siren: "200041630",
      source: "groupement_exact",
    });
  });

  it("résout une commune quand aucun groupement ne matche", () => {
    expect(resolver.resolve(999002, "Arles")).toEqual({ siren: "211700016", source: "commune_exact" });
  });

  it("ne résout PAS un nom homonyme ambigu (plusieurs communes) sans override", () => {
    // 2 communes 'Saint-Nazaire', aucun override pour cet id → null (ambigu).
    expect(resolver.resolve(999003, "Saint-Nazaire")).toBeNull();
  });

  it("l'override (par collectiviteId) prime sur tout, y compris sur un homonyme", () => {
    // 1553 = 'Saint-Nazaire' → override vers l'EPCI porteur (CARENE).
    expect(SIREN_OVERRIDES[1553]).toBeDefined();
    expect(resolver.resolve(1553, "Saint-Nazaire")).toEqual({
      siren: SIREN_OVERRIDES[1553].siren,
      source: "epci_porteur_judgment",
    });
  });

  it("renvoie null pour un nom inconnu", () => {
    expect(resolver.resolve(999004, "Collectivité Inexistante XYZ")).toBeNull();
  });
});
