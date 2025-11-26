# Endpoint API `/qualification/leviers`

## Vue d'ensemble

Le nouvel endpoint `/qualification/leviers` permet de qualifier les leviers d'action pour la transition écologique d'un projet de collectivité territoriale. Cet endpoint utilise l'IA (Claude via Anthropic) pour analyser la description d'un projet et identifier les leviers d'action pertinents parmi une liste de 72 leviers.

## Informations techniques

- **URL** : `POST /qualification/leviers`
- **Authentification** : Bearer token (API Key)
- **Rate limiting** : Oui (géré par `QualificationRateLimitGuard`)
- **Tracking** : Oui (via `@TrackApiUsage()`)

## Format de la requête

### Headers

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

### Body

```json
{
  "nom": "string",
  "description": "string"
}
```

#### Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `nom` | string | Oui | Nom du projet |
| `description` | string | Oui | Description détaillée du projet |

### Exemple de requête

```bash
curl -X POST "https://api.example.com/qualification/leviers" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Installation panneaux solaires",
    "description": "Installation de panneaux photovoltaïques sur les toits des bâtiments communaux pour produire de l'\''électricité renouvelable et réduire la facture énergétique"
  }'
```

## Format de la réponse

### Réponse de succès (200 OK)

```json
{
  "projet": "Installation panneaux solaires - Installation de panneaux photovoltaïques...",
  "classification": "Le projet a un lien avec la transition écologique",
  "leviers": [
    {
      "nom": "Electricité renouvelable",
      "score": 0.95
    },
    {
      "nom": "Sobriété énergétique",
      "score": 0.82
    }
  ],
  "raisonnement": "Le projet vise la production d'électricité renouvelable via l'installation de panneaux photovoltaïques, ce qui contribue directement à la transition énergétique de la collectivité."
}
```

#### Champs de réponse

| Champ | Type | Description |
|-------|------|-------------|
| `projet` | string | Écho de la requête (nom + description) |
| `classification` | string \| null | Classification du projet vis-à-vis de la transition écologique |
| `leviers` | array | Liste des leviers identifiés avec leur score |
| `leviers[].nom` | string | Nom du levier d'action |
| `leviers[].score` | number | Score de pertinence (0-1) |
| `raisonnement` | string \| null | Explication du raisonnement du LLM |

### Valeurs possibles de `classification`

- `"Le projet a un lien avec la transition écologique"`
- `"Le projet n'a pas de lien avec la transition écologique"`
- `"Le projet n'est pas assez précis pour être lié ou non à la transition écologique"`
- `null` (si le LLM ne peut pas déterminer)

### Seuil de score

Seuls les leviers avec un score **supérieur à 0.7** sont retournés dans la réponse.

## Codes d'erreur

| Code | Description |
|------|-------------|
| 400 | Requête invalide (champs manquants ou mal formatés) |
| 401 | Non autorisé (API key invalide ou manquante) |
| 429 | Trop de requêtes (rate limit dépassé) |
| 500 | Erreur interne du serveur (erreur LLM, etc.) |

### Exemple d'erreur 400

```json
{
  "statusCode": 400,
  "message": ["description should not be empty"],
  "error": "Bad Request"
}
```

### Exemple d'erreur 401

```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "error": "Unauthorized"
}
```

## Exemples d'utilisation

### Projet écologique clair

**Requête** :
```json
{
  "nom": "Piste cyclable intercommunale",
  "description": "Aménagement d'une piste cyclable sécurisée de 15 km reliant 5 communes pour encourager les déplacements doux et réduire l'usage de la voiture"
}
```

**Réponse** :
```json
{
  "projet": "Piste cyclable intercommunale - Aménagement d'une piste cyclable...",
  "classification": "Le projet a un lien avec la transition écologique",
  "leviers": [
    {
      "nom": "Vélo",
      "score": 0.95
    },
    {
      "nom": "Réduction des déplacements",
      "score": 0.78
    }
  ],
  "raisonnement": "Le projet encourage activement la mobilité douce..."
}
```

### Projet non écologique

**Requête** :
```json
{
  "nom": "Salle de convivialité",
  "description": "Création d'une salle de convivialité au complexe sportif"
}
```

**Réponse** :
```json
{
  "projet": "Salle de convivialité - Création d'une salle...",
  "classification": "Le projet n'a pas de lien avec la transition écologique",
  "leviers": [],
  "raisonnement": "Le projet concerne uniquement l'aménagement d'espaces de convivialité..."
}
```

### Projet vague

**Requête** :
```json
{
  "nom": "Revitalisation centre bourg",
  "description": "Revitalisation du centre bourg"
}
```

**Réponse** :
```json
{
  "projet": "Revitalisation centre bourg - Revitalisation du centre bourg",
  "classification": "Le projet n'est pas assez précis pour être lié ou non à la transition écologique",
  "leviers": [],
  "raisonnement": "La description manque de détails..."
}
```

## Différences avec `/qualification/competences`

| Aspect | `/competences` | `/leviers` |
|--------|---------------|-----------|
| **Objet d'analyse** | Compétences M57 des collectivités (158 codes) | Leviers d'action transition écologique (72 leviers) |
| **Classification** | ❌ Non | ✅ Oui (3 valeurs possibles) |
| **Raisonnement** | ❌ Non | ✅ Oui |
| **Température LLM** | 0.5 | 0.3 (plus déterministe) |
| **Nombre de résultats** | Jusqu'à 3 | Illimité (filtré par seuil 0.7) |
| **Structure** | Hiérarchique (compétence > sous-compétence) | Liste plate |
| **Corrections** | 56 entrées | 113 entrées |

## Implémentation technique

### Architecture

```
Controller (HTTP)
  └─> ProjetQualificationService.analyzeLeviers()
       └─> AnthropicService.analyzeLeviers()
            └─> API Claude (Anthropic)
       └─> LeviersValidationService.validateAndCorrect()
            └─> Correction + validation contre liste canonique
       └─> Filtrage par seuil (> 0.7)
```

### Fichiers concernés

| Fichier | Description |
|---------|-------------|
| `projet-qualification.controller.ts` | Endpoint HTTP |
| `projet-qualification.service.ts` | Logique métier |
| `anthropic.service.ts` | Intégration LLM |
| `leviers-validation.service.ts` | Validation et correction |
| `projet-qualification.dto.ts` | Schémas de requête/réponse |

### Tests

- **Tests unitaires** : `projet-qualification.service.spec.ts`
  - Mock des services Anthropic et validation
  - Tests de la logique de filtrage par seuil
  - Tests de gestion d'erreurs

- **Tests d'intégration** : `projet-qualification.integration.spec.ts`
  - Appels LLM réels (nécessite `ANTHROPIC_API_KEY`)
  - Validation de la qualité des résultats
  - Tests de classification

- **Tests E2E** : `qualification.e2e-spec.ts` (à activer après génération des types)
  - Tests de l'endpoint HTTP complet
  - Tests d'authentification
  - Tests de rate limiting

## Performance et coûts

- **Temps de réponse moyen** : 2-5 secondes (appel LLM)
- **Modèle LLM** : `claude-3-5-haiku-20241022` (par défaut)
- **Température** : 0.3 (plus déterministe que competences)
- **Max tokens** : 1024
- **Cache prompt** : Oui (liste des 72 leviers)

## Notes importantes

1. **Validation stricte** : Le service applique 113 corrections automatiques pour normaliser les noms de leviers
2. **Seuil de score** : Identique à `/competences` (0.7)
3. **Classification obligatoire** : Le LLM doit classifier le projet (contrairement aux compétences)
4. **Raisonnement explicite** : Le LLM explique son analyse dans le champ `raisonnement`

## Voir aussi

- [Documentation endpoint `/qualification/competences`]
- [Liste complète des 72 leviers] (`src/shared/const/leviers.ts`)
- [Prompts LLM] (`src/projet-qualification/llm/prompts/`)
- [Corrections automatiques] (`src/projet-qualification/llm/validation/corrections-leviers.ts`)
