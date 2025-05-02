import { Service } from "../../components/ServicesWidget/types.ts";

export const Bénéfriche: Service = {
  id: "7",
  name: "Bénéfriches",
  description:
    "Bénéfriches quantifie et monétarise les impacts environnementaux, sociaux et économiques d'un projet d'aménagement, sur friche ou en extension urbaine.",
  logoUrl: "https://benefriches.ademe.fr/favicon/favicon-192.png",
  redirectionUrl: "https://benefriches.ademe.fr/",
  iframeUrl:
    "https://benefriches-staging.osc-fr1.scalingo.io/embed/calcul-rapide-impacts-projet-urbain?siteSurfaceArea={surface}&siteCityCode=31070",
  sousTitre: "",
  redirectionLabel: null,
  extendLabel: null,
  extraFields: [{ name: "surface", label: "Surface de la friche en m2" }],
  isListed: true,
};
