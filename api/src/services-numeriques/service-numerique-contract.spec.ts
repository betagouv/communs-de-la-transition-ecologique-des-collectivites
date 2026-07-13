import { facteurPhase } from "./service-numerique-contract";

describe("facteurPhase", () => {
  it("ne pénalise pas un service dont la phase correspond (Oui)", () => {
    expect(facteurPhase({ Idée: 1 }, "Idée")).toBe(1);
  });

  it("fait descendre — sans jamais exclure — un service mal phasé (Non)", () => {
    // Le facteur est borné à [0.5, 1] plutôt que multiplié par le poids brut : un « Non »
    // annulerait le score et ferait DISPARAÎTRE un service très pertinent thématiquement.
    // La phase module l'ordre, elle ne filtre pas.
    expect(facteurPhase({ Idée: 0 }, "Idée")).toBe(0.5);
    expect(facteurPhase({ Idée: 0.5 }, "Idée")).toBe(0.75);
  });

  it("reste neutre quand la donnée de phase est absente", () => {
    // Le benchmark n'est rempli qu'à 60 % sur les colonnes de phase : ne pas confondre
    // « le service ne convient pas à cette phase » et « on ne sait pas ».
    expect(facteurPhase({}, "Idée")).toBe(1);
    expect(facteurPhase({ Étude: 0 }, "Idée")).toBe(1);
  });

  it("reste neutre quand le projet n'a pas de phase", () => {
    expect(facteurPhase({ Idée: 0 }, null)).toBe(1);
  });
});
