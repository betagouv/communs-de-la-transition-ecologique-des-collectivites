// Thematique enrichment: when a child thematique is found, add the parent thematique
export const THEMATIQUE_ENRICHMENT_RULES: { found: string; add: string }[] = [
  { found: "Energie éolienne", add: "Energies renouvelables" },
  {
    found: "Energies renouvelables particuliers, énergies renouvelables citoyennes (ENRc)",
    add: "Energies renouvelables",
  },
  { found: "Energie hydraulique", add: "Energies renouvelables" },
  {
    found: "Agrivoltaïsme, panneaux solaires sur le bâti",
    add: "Energies renouvelables",
  },
  { found: "Champs de panneaux solaires", add: "Energies renouvelables" },
  { found: "Réseau électrique", add: "Réseaux" },
  { found: "Réseau de chaleur", add: "Réseaux" },
  { found: "Réseau de froid", add: "Réseaux" },
  { found: "Chauffage bois", add: "Chauffage renouvelable" },
  { found: "Pompes à chaleur", add: "Chauffage renouvelable" },
  { found: "Chauffage biogaz", add: "Chauffage renouvelable" },
  { found: "Chauffage géothermie", add: "Chauffage renouvelable" },
  {
    found: "Chauffage résidus agricoles et alimentaires",
    add: "Chauffage renouvelable",
  },
  { found: "Chauffage solaire thermique", add: "Chauffage renouvelable" },
  {
    found: "Combustibles Solides de Récupération (CSR)",
    add: "Chauffage renouvelable",
  },
  {
    found: "Changement des fenêtres/portes d'un bâtiment public",
    add: "Isolation thermique",
  },
  {
    found: "Audit ou travaux de rénovation énergétique tertiaire",
    add: "Audit ou travaux de rénovation énergétique",
  },
  {
    found: "Audit ou travaux de rénovation énergétique résidentiel",
    add: "Audit ou travaux de rénovation énergétique",
  },
  { found: "Installation de ralentisseur", add: "Voirie" },
  {
    found: "Installation de miroir de circulation de sécurité routière",
    add: "Voirie",
  },
  { found: "Mise en place de radars pédagogiques", add: "Voirie" },
  { found: "Voie douce, piste cyclable", add: "Vélo (mobilité douce)" },
  {
    found: "Subventionnement de l'achat de vélos",
    add: "Vélo (mobilité douce)",
  },
  { found: "Randonnée, vélo tourisme, VTT", add: "Tourisme" },
  {
    found: "Végétalisation d'espaces publics",
    add: "Adaptation au changement climatique",
  },
  {
    found: "Confort thermique des transports collectifs et des mobilités actives",
    add: "Adaptation au changement climatique",
  },
  {
    found: "Adaptation de la filière agricoles au changement climatique",
    add: "Adaptation au changement climatique",
  },
  {
    found: "Retrait-gonflement des argiles",
    add: "Adaptation au changement climatique",
  },
  {
    found: "Rafraîchissement urbain",
    add: "Adaptation au changement climatique",
  },
  {
    found: "Plantation d'arbres",
    add: "Adaptation au changement climatique",
  },
];

// Site enrichment: when a child site is found, add the parent site
export const SITE_ENRICHMENT_RULES: { found: string; add: string }[] = [
  { found: "Pont, viaduc ou tunnel", add: "Ouvrage d'art" },
  { found: "Barrage", add: "Ouvrage d'art" },
  { found: "Bibliothèque municipale", add: "Bâtiment public" },
  { found: "Ecole", add: "Bâtiment public" },
  { found: "Gendarmerie", add: "Bâtiment public" },
  { found: "Hôpital", add: "Bâtiment public" },
  { found: "Caserne pompiers", add: "Bâtiment public" },
  { found: "Mairie", add: "Bâtiment public" },
];

// Cross-axis enrichment: when a site is found, add a thematique
export const SITE_TO_THEMATIQUE_ENRICHMENT_RULES: { siteFound: string; addThematique: string }[] = [
  { siteFound: "Stationnements pour vélos", addThematique: "Vélo (mobilité douce)" },
];
