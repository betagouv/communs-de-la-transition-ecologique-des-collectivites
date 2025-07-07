# @communs/shared

Package partagé contenant les types et constantes utilisés dans les Communs de la transition écologique.

## Installation

Ce package est utilisé en interne dans le monorepo via pnpm workspaces.

## Utilisation

```typescript
import { 
  CompetenceCode, 
  Levier, 
  ProjetPhase, 
  leviers, 
  competenceCodes 
} from '@communs/shared';

// Types typés
const competence: CompetenceCode = "90-411";
const levier: Levier = "Covoiturage";
const phase: ProjetPhase = "Idée";

// Constantes
const allLeviers = leviers;
const allCompetences = competenceCodes;
```

## Types disponibles

- `CompetenceCode` - Codes des compétences (ex: "90-411")
- `CompetenceCodes` - Array de codes de compétences
- `Levier` - Noms des leviers de transition écologique
- `Leviers` - Array de leviers
- `ProjetPhase` - Phases de projet ("Idée", "Étude", "Réalisation", "Exploitation")
- `IdType` - Types d'identifiants ("communId", "tetId")

## Développement

```bash
# Installer les dépendances
pnpm install

# Construire le package
pnpm build

# Mode développement avec watch
pnpm dev
``` 