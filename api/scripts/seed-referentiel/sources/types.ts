// Raw data types used by source fetchers before DB insertion

export interface RawCommune {
  codeInsee: string;
  siren: string;
  siret: string | null;
  nom: string;
  population: number | null;
  codesPostaux: string[];
  codeDepartement: string | null;
  codeRegion: string | null;
  codeEpci: string | null;
}

export interface RawGroupement {
  siren: string;
  siret: string | null;
  nom: string;
  type: string; // CA, CC, CU, MET, SIVU, SIVOM, SMF, SMO, PETR, POLEM
  population: number | null;
  nbCommunes: number | null;
  departements: string[];
  regions: string[];
  modeFinancement: string | null;
  dateCreation: string | null; // ISO date string
}

export interface RawRegion {
  code: string;
  nom: string;
  siren: string | null;
}

export interface RawDepartement {
  code: string;
  nom: string;
  codeRegion: string;
  siren: string | null;
}

export interface RawPerimetre {
  sirenGroupement: string;
  codeInseeCommune: string;
  categorieMembre: string | null;
}

export interface RawCompetenceCategorie {
  code: string;
  nom: string;
}

export interface RawCompetence {
  code: string;
  nom: string;
  codeCategorie: string;
}

export interface RawGroupementCompetence {
  sirenGroupement: string;
  codeCompetence: string;
}

export interface SeedData {
  regions: RawRegion[];
  departements: RawDepartement[];
  communes: RawCommune[];
  groupements: RawGroupement[];
  perimetres: RawPerimetre[];
  competenceCategories: RawCompetenceCategorie[];
  competences: RawCompetence[];
  groupementCompetences: RawGroupementCompetence[];
}

export interface SeedStats {
  regions: number;
  departements: number;
  communes: number;
  groupements: number;
  perimetres: number;
  competenceCategories: number;
  competences: number;
  groupementCompetences: number;
}
