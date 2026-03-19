export const interventions = [
  "Rénovation bâtiment",
  "Rénovation sauf bâtiment (voirie, ...)",
  "Stratégie/Plan",
  "Communication",
  "Développement",
  "Outillage (notamment numérique)",
  "Construction bâtiment",
  "Construction sauf bâtiment (voirie, ...)",
  "Entretien",
  "Structuration du financement",
  "Formation",
  "Dynamisation",
  "Etude/Diagnostic",
  "Sensibilisation",
  "Aménagement urbain et restructuration",
] as const;

export type Intervention = (typeof interventions)[number];
