import fs from "fs";
import path from "path";
import { parseServiceAndServiceContextsCSVFiles } from "./parse-service-and-service-context";

describe("parseCSVFiles", () => {
  const tempDir = path.join(__dirname, "temp");
  const serviceCSVPath = path.join(tempDir, "service.csv");
  const serviceContextPath = path.join(tempDir, "context.csv");

  const serviceData =
    "name,subtitle,description,logoUrl,redirectionUrl,redirectionLabel,iframeUrl,extendLabel\n" +
    'UrbanVitaliz,Recommandations d’actions pour faciliter la réhabilitation des friches urbaines,"UrbanVitaliz donne des recommandations d’actions à la collectivité, en fonction du projet qu’elle lui a soumis et des caractéristiques de la friches. Elle oriente ainsi vers les acteurs, dispositifs, financements, prestations, outils et stratégies disponibles, susceptibles de débloquer le porteur de projet. ",https://urbanvitaliz.fr/static/img/favicons/apple-touch-icon.png,https://urbanvitaliz.fr/,Découvrez UrbanVitaliz,,\n' +
    "Bénéfriches,L'outil qui calcule la valeur réelle de votre projet d'aménagement,\"Bénéfriches quantifie et monétarise les impacts environnementaux, sociaux et économiques d'un projet d'aménagement, sur friche ou en extension urbaine.\",https://benefriches.ademe.fr/favicon/favicon-192.png,https://benefriches.ademe.fr/,,,\n";

  const contextValidData =
    "serviceName,sousTitre,description,logoUrl,redirectionUrl,redirectionLabel,iframeUrl,extendLabel,status,leviers,competences,extraField\n" +
    'UrbanVitaliz,Recommandations d’actions pour faciliter la réhabilitation des friches urbaines,"UrbanVitaliz donne des recommandations d’actions à la collectivité, en fonction du projet qu’elle lui a soumis et des caractéristiques de la friches. Elle oriente ainsi vers les acteurs, dispositifs, financements, prestations, outils et stratégies disponibles, susceptibles de débloquer le porteur de projet. ",https://urbanvitaliz.fr/static/img/favicons/apple-touch-icon.png,https://urbanvitaliz.fr/,Découvrez UrbanVitaliz,,,"Etude, Idée, Opération",,Aménagement des territoires > Friche,\n' +
    'UrbanVitaliz,Des ressources autour de la réhabilitation des friches urbaines,Retrouvez des articles thématiques sur le sujet des friches urbaines.,https://urbanvitaliz.fr/static/img/favicons/apple-touch-icon.png,https://urbanvitaliz.fr/ressource/,,,,"Etude, Idée, Opération",,Aménagement des territoires > Friche,\n';

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      console.log("creating temp dir");
      fs.mkdirSync(tempDir);
    }
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should generate an invalid items file when there are invalid service context entries", async () => {
    fs.writeFileSync(serviceCSVPath, serviceData);
    const invalidServiceContextData = contextValidData.replace(/Etude/g, "Invalid_phase");
    fs.writeFileSync(serviceContextPath, invalidServiceContextData.replace(/Aménagement/g, "Améenagement"));

    const { errors } = await parseServiceAndServiceContextsCSVFiles(serviceCSVPath, serviceContextPath);

    expect(errors).toStrictEqual([
      "Invalid competence: Améenagement des territoires > Friche",
      "Invalid phases: Invalid_phase",
      "Invalid competence: Améenagement des territoires > Friche",
      "Invalid phases: Invalid_phase",
    ]);
  });

  it("should not generate an invalid items file when all entries are valid", async () => {
    fs.writeFileSync(serviceCSVPath, serviceData);
    fs.writeFileSync(serviceContextPath, contextValidData);

    const { errors } = await parseServiceAndServiceContextsCSVFiles(serviceCSVPath, serviceContextPath);
    expect(errors.length).toBe(0);
  });
});
