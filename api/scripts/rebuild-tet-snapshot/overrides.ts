// Résolutions collectiviteId (TeT) → SIREN qui NE sont PAS un match exact du nom sur
// api_referentiel : renommages d'EPCI, département/région/syndicats, et homonymes de
// grandes villes tranchés à la main. Établies une fois (2026-09-21) et auditées ;
// SIREN vérifiés (data.gouv/BANATIC) pour les cas `web*`. Voir la note de conception
// cockpit/projects/api-projets-collectivites/design-decouplage-pont-etl.md et
// workspace/exports/pcaet-tet-siren-2026-09-21.README.md.
//
// Nuance homonymes : un PCAET couvre le territoire de l'EPCI porteur → « La Rochelle »
// et « Saint-Nazaire » (noms nus) sont résolus vers l'EPCI (CA / CARENE), tandis que
// « Ville de Lyon » et « COMMUNE DE GALLUIS » (nom explicite) restent la commune.

export interface SirenOverride {
  siren: string;
  source: string;
  nom: string; // nom TeT au moment de la résolution (traçabilité)
}

export const SIREN_OVERRIDES: Record<number, SirenOverride> = {
  435: { siren: "241700434", source: "epci_porteur_judgment", nom: "La Rochelle" },
  1553: { siren: "244400644", source: "epci_porteur_judgment", nom: "Saint-Nazaire" },
  2518: { siren: "246700488", source: "fuzzy_epci", nom: "Ville et Eurométropole de Strasbourg - public" },
  3597: { siren: "929939411", source: "commune_93", nom: "Saint-Denis (93)" },
  3796: { siren: "219740115", source: "commune_reunion_judgment", nom: "Saint-Denis" },
  3810: { siren: "200042935", source: "fuzzy_epci", nom: "Haut - Bugey Agglomération" },
  3913: { siren: "200041630", source: "fuzzy_epci", nom: "Ardenne Métropole" },
  3966: { siren: "200069383", source: "fuzzy_epci", nom: "Ouest Aveyron Communauté" },
  4025: { siren: "200036473", source: "fuzzy_epci", nom: "CA de Saintes" },
  4132: { siren: "200041150", source: "fuzzy_epci", nom: "CC du Terrassonnais en Périgord Noir Thenon Hautefort" },
  4291: { siren: "243100781", source: "fuzzy_epci", nom: "Grand Ouest Toulousain" },
  4390: { siren: "243500634", source: "fuzzy_epci", nom: "Roche aux Fées Communauté" },
  4451: { siren: "243801255", source: "web", nom: "CC des Collines du Nord Dauphiné" },
  4518: { siren: "200065886", source: "fuzzy_epci", nom: "Loire Forez Agglomération (LFA)" },
  4555: { siren: "244400438", source: "fuzzy_epci", nom: "Grand Lieu Communauté" },
  4673: { siren: "200068666", source: "fuzzy_epci", nom: "CA de Saint-Dizier Der et Blaise" },
  4683: { siren: "200083392", source: "fuzzy_epci", nom: "Laval Agglomération" },
  4693: { siren: "245400262", source: "fuzzy_epci", nom: "Grand Longwy Agglomération" },
  4734: { siren: "200066777", source: "fuzzy_epci", nom: "Ploërmel Communauté" },
  4839: { siren: "200068450", source: "fuzzy_epci", nom: "Terres d'Argentan Interco" },
  4935: { siren: "246700488", source: "fuzzy_epci", nom: "Ville et Eurométropole de Strasbourg" },
  5119: { siren: "200084952", source: "fuzzy_epci", nom: "Le Havre Seine Métropole" },
  5127: { siren: "200069847", source: "web", nom: "CC Plateau de Caux-Doudeville-Yerville" },
  5255: { siren: "248300493", source: "fuzzy_epci", nom: "Dracénie Provence Verdon Agglomération" },
  5276: { siren: "248400236", source: "web", nom: "CC du Pays Réuni d'Orange" },
  5287: { siren: "200023778", source: "fuzzy_epci", nom: "Pays de Saint Gilles Croix de Vie Agglomération" },
  5350: { siren: "200039758", source: "fuzzy_epci", nom: "Communauté de Communes Avallon - Vézelay - Morvan (CCAVM)" },
  5390: { siren: "200057941", source: "web", nom: "Paris Est Marne & Bois" },
  5452: { siren: "255601106", source: "web_syndicat", nom: "Syndicat énergie du Morbihan" },
  5482: { siren: "216901231", source: "commune_ville_lyon", nom: "Ville de Lyon" },
  5522: { siren: "231300021", source: "web_region", nom: "Région Provence-Alpes-Côte d'Azur" },
  5523: { siren: "217802628", source: "commune_explicite", nom: "COMMUNE DE GALLUIS" },
  5543: { siren: "200076289", source: "fuzzy_epci", nom: "PETR Pays d'Arles" },
  5577: { siren: "200074953", source: "fuzzy_epci", nom: "PETR Pays de Saverne, Plaine et Plateau" },
  5607: { siren: "200049583", source: "fuzzy_epci", nom: "SM du Pays Thur Doller" },
  5919: { siren: "220800049", source: "web_departement", nom: "Département Ardennes" },
  6034: { siren: "254603418", source: "fuzzy_epci", nom: "Syndicat Mixte du Pays Bourian" },
};
