import { BadRequestException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { DecisionsService } from "@/decisions/decisions.service";
import { AidesPerimetreService } from "@/aides/aides-perimetre.service";
import { Aide } from "@/aides/dto/aides.dto";
import { AjoutsManuelsService } from "./ajouts-manuels.service";

/**
 * LA GARDE DU PÉRIMÈTRE, et pourquoi elle existe.
 *
 * Une aide n'est persistée nulle part : elle vit en cache, rechargée depuis Aides-territoires et
 * filtrée par le territoire du projet. On ne la résout donc à la lecture QUE parmi les aides du
 * périmètre — et on ne peut pas faire autrement : Aides-territoires ne sait pas récupérer une aide
 * par son id (`/aids/<id>/` répond 404, et `?id=<n>` est silencieusement ignoré, renvoyant le
 * catalogue entier).
 *
 * Conséquence : accepter une aide hors périmètre créerait un ajout que la lecture ne saurait JAMAIS
 * résoudre. Invisible, sans le moindre message. On refuse donc à l'écriture, là où on peut encore
 * l'expliquer à l'agent.
 */
describe("AjoutsManuelsService — garde du périmètre (aides)", () => {
  const PROJET_ID = "019f5c56-5873-72ce-94cd-b7b00e5c619c";

  const aide = (id: number) => ({ id, name: `Aide ${id}` }) as Aide;

  const construire = (aidesDuPerimetre: Aide[]) => {
    const decisionsService = { create: jest.fn().mockResolvedValue({ id: "decision-1" }) };
    const perimetre = {
      extractCodesInsee: jest.fn().mockReturnValue(["44109"]),
      fetchAidesForPerimeterCodes: jest.fn().mockResolvedValue(aidesDuPerimetre),
    };
    const projets = {
      findOneWithSource: jest.fn().mockResolvedValue({
        projet: { id: PROJET_ID, collectivites: [{ type: "Commune", codeInsee: "44109" }] },
      }),
    };

    const service = new AjoutsManuelsService(
      {} as unknown as DatabaseService,
      decisionsService as unknown as DecisionsService,
      projets as unknown as GetProjetsService,
      perimetre as unknown as AidesPerimetreService,
    );

    return { service, decisionsService };
  };

  it("accepte une aide présente sur le territoire du projet", async () => {
    const { service, decisionsService } = construire([aide(111), aide(222)]);

    const { decisionId } = await service.ajouterAide(PROJET_ID, { aideId: 222, message: "Vue en COPIL" }, "MEC");

    expect(decisionId).toBe("decision-1");

    // Le message va dans `commentaire` — le champ que toute décision porte déjà. Le dupliquer dans
    // le payload aurait créé deux endroits où écrire la même chose.
    expect(decisionsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        typeDecision: "ajout_manuel",
        objetAType: "projet",
        objetAId: PROJET_ID,
        objetBType: "aide",
        objetBId: "222",
        commentaire: "Vue en COPIL",
      }),
      "MEC",
    );
  });

  it("REFUSE une aide absente du territoire, plutôt que de créer un ajout invisible", async () => {
    const { service, decisionsService } = construire([aide(111)]);

    await expect(service.ajouterAide(PROJET_ID, { aideId: 999 }, "MEC")).rejects.toThrow(BadRequestException);

    // Rien n'a été écrit : un ajout irrésoluble ne doit pas exister du tout.
    expect(decisionsService.create).not.toHaveBeenCalled();
  });

  it("nomme l'aide fautive dans l'erreur", async () => {
    const { service } = construire([aide(111)]);

    await expect(service.ajouterAide(PROJET_ID, { aideId: 999 }, "MEC")).rejects.toThrow(/999/);
  });
});
