import { SecteursService } from "./secteurs.service";
import { MAPPING_LEVIERS, MAPPING_SITES, MAPPING_THEMATIQUES, SECTEURS } from "./secteurs-mapping.const";

describe("SecteursService", () => {
  const service = new SecteursService();

  describe("mapping table integrity", () => {
    it("holds the full artefact (156 thematiques, 77 sites, 67 leviers after normalization)", () => {
      // L'artefact source liste 167/86/67 labels ; les doublons sont des variantes de
      // ponctuation aux vecteurs identiques, fusionnées par la normalisation des clés.
      expect(Object.keys(MAPPING_THEMATIQUES)).toHaveLength(156);
      expect(Object.keys(MAPPING_SITES)).toHaveLength(77);
      expect(Object.keys(MAPPING_LEVIERS)).toHaveLength(67);
    });

    it("has 8-sector part vectors bounded to [0, 100] everywhere", () => {
      for (const table of [MAPPING_THEMATIQUES, MAPPING_SITES, MAPPING_LEVIERS]) {
        for (const entry of Object.values(table)) {
          for (const parts of [entry.direct, entry.contribution]) {
            expect(parts).toHaveLength(8);
            expect(parts.every((p) => p >= 0 && p <= 100)).toBe(true);
            expect(parts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100);
          }
        }
      }
    });
  });

  describe("computeSecteurs", () => {
    it("returns null blocks when there is no usable input", () => {
      const result = service.computeSecteurs(null, null);
      expect(result.direct).toBeNull();
      expect(result.contribution).toBeNull();
    });

    it("maps a single fully-scored thematique onto its sector", () => {
      const result = service.computeSecteurs(
        { thematiques: [{ label: "Gestion des déchets", score: 1 }], sites: [] },
        [],
      );
      expect(result.direct).not.toBeNull();
      expect(result.direct!.dominant).toBe("dechets");
      expect(result.direct!.parts.dechets).toBeCloseTo(1, 5);
      expect(result.direct!.nonAttribuable).toBeCloseTo(0, 5);
    });

    it("is tolerant to accents, punctuation and case in label lookup", () => {
      const result = service.computeSecteurs(
        { thematiques: [{ label: "GESTION DES DECHETS !", score: 1 }], sites: [] },
        [],
      );
      expect(result.direct!.dominant).toBe("dechets");
    });

    it("splits multi-sector rules (Bio-carburants: contribution 70/30 branche énergie/agriculture)", () => {
      const result = service.computeSecteurs(null, ["Bio-carburants"]);
      expect(result.direct!.parts.branche_energie).toBeCloseTo(1, 5);
      expect(result.contribution!.parts.branche_energie).toBeCloseTo(0.7, 5);
      expect(result.contribution!.parts.agriculture).toBeCloseTo(0.3, 5);
      expect(result.contribution!.dominant).toBe("branche_energie");
    });

    it("weights inputs by score and by type (levier 1.5 > thematique 1 > site 0.35)", () => {
      // thematique déchets (score 1, poids 1) vs levier vélo (poids 1.5)
      const result = service.computeSecteurs({ thematiques: [{ label: "Gestion des déchets", score: 1 }], sites: [] }, [
        "Vélo",
      ]);
      const parts = result.direct!.parts;
      // masses attendues : dechets 1×1 = 1 ; autres_transports 1.5×1 = 1.5 → normalisées
      expect(parts.autres_transports).toBeCloseTo(1.5 / 2.5, 5);
      expect(parts.dechets).toBeCloseTo(1 / 2.5, 5);
      expect(result.direct!.dominant).toBe("autres_transports");
      // la sémantique contribution du levier Vélo bascule sur le report modal routier
      expect(result.contribution!.parts.transport_routier).toBeGreaterThan(0);
    });

    it("accumulates residual mass as nonAttribuable and can make it dominant", () => {
      // « International » ne mappe sur aucun secteur (vecteur nul)
      const result = service.computeSecteurs(
        {
          thematiques: [
            { label: "International", score: 0.9 },
            { label: "Gestion des déchets", score: 0.2 },
          ],
          sites: [],
        },
        [],
      );
      expect(result.direct!.dominant).toBeNull();
      expect(result.direct!.nonAttribuable).toBeCloseTo(0.9 / 1.1, 5);
      expect(result.direct!.parts.dechets).toBeCloseTo(0.2 / 1.1, 5);
    });

    it("normalizes parts + nonAttribuable to a unit simplex", () => {
      const result = service.computeSecteurs(
        {
          thematiques: [
            { label: "Gestion des déchets", score: 0.9 },
            { label: "Appropriation des enjeux de transition écologique pour les particuliers", score: 0.55 },
          ],
          sites: [
            { label: "Maison, logement ou immeuble résidentiel", score: 0.7 },
            { label: "Bâtiment public", score: 0.5 },
          ],
        },
        ["Prévention des déchets"],
      );
      const d = result.direct!;
      const total = SECTEURS.reduce((acc, s) => acc + d.parts[s], 0) + d.nonAttribuable;
      expect(total).toBeCloseTo(1, 5);
      expect(d.dominant).toBe("dechets");
    });

    it("ignores unknown labels instead of failing", () => {
      const result = service.computeSecteurs(
        { thematiques: [{ label: "Thématique inconnue du mapping", score: 0.9 }], sites: [] },
        ["Levier inexistant"],
      );
      expect(result.direct).toBeNull();
      expect(result.contribution).toBeNull();
    });
  });
});
